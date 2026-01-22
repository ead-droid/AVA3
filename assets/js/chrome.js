import { supabase } from './supabaseClient.js';

// Caminho para o HTML do layout
const LAYOUT_URL = new URL('../chrome.html', import.meta.url).toString();

// === VERSÃO v5: Limpa cache para mostrar a nova logo ===
const VER = 'v5'; 
const CACHE_KEYS = {
  header: `ava3.chrome.${VER}.header`,
  sidebar: `ava3.chrome.${VER}.sidebar`,
  footer: `ava3.chrome.${VER}.footer`,
};

const SIDEBAR_STATE_KEY = 'ava3.sidebarCollapsed';

let wiredNavCache = false;
let wiredAuth = false;

async function initChrome() {
  ensureSlot('site-header');
  ensureSlot('site-sidebar');
  ensureSlot('site-footer');

  // Aplica estado inicial do menu (Verifica se é classroom aqui dentro)
  applySavedSidebarState();

  wireCacheBeforeNavigation();
  window.addEventListener('beforeunload', cacheCurrentChromeDOM, { capture: true });

  document.body.classList.add('has-sidebar');

  setupSidebarToggle();
  highlightActiveLink();
  applyCachedRole();
  await checkAuth();
  wireAuthStateChange();
  wireLogoutButton();

  try {
    const res = await fetch(LAYOUT_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Erro layout: ${res.status}`);

    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    inject('site-header', doc, 'header');
    inject('site-sidebar', doc, 'sidebar');
    inject('site-footer', doc, 'footer');

    document.body.classList.add('has-sidebar');
    applySavedSidebarState(); // Reaplica após injeção para garantir

    setupSidebarToggle();
    highlightActiveLink();
    
    cacheCurrentChromeDOM();

    await checkAuth();
    wireLogoutButton();

  } catch (err) {
    console.error('Chrome UI Error:', err);
    injectFromCacheFallback();
    setupSidebarToggle();
    highlightActiveLink();
    applyCachedRole();
  }
}

// --- Cache System ---
function cacheCurrentChromeDOM() {
  const headerEl = document.getElementById('site-header');
  const sidebarEl = document.getElementById('site-sidebar');
  const footerEl = document.getElementById('site-footer');

  if (headerEl && headerEl.innerHTML.trim()) sessionStorage.setItem(CACHE_KEYS.header, headerEl.innerHTML);
  if (sidebarEl && sidebarEl.innerHTML.trim()) sessionStorage.setItem(CACHE_KEYS.sidebar, sidebarEl.innerHTML);
  if (footerEl && footerEl.innerHTML.trim()) sessionStorage.setItem(CACHE_KEYS.footer, footerEl.innerHTML);
}

function injectFromCacheFallback() {
  const headerEl = document.getElementById('site-header');
  const sidebarEl = document.getElementById('site-sidebar');
  const footerEl = document.getElementById('site-footer');

  const headerHTML = sessionStorage.getItem(CACHE_KEYS.header) || '';
  const sidebarHTML = sessionStorage.getItem(CACHE_KEYS.sidebar) || '';
  const footerHTML = sessionStorage.getItem(CACHE_KEYS.footer) || '';

  if (headerEl && !headerEl.innerHTML.trim()) headerEl.innerHTML = headerHTML;
  if (sidebarEl && !sidebarEl.innerHTML.trim()) sidebarEl.innerHTML = sidebarHTML;
  if (footerEl && !footerEl.innerHTML.trim()) footerEl.innerHTML = footerHTML;
}

function wireCacheBeforeNavigation() {
  if (wiredNavCache) return;
  wiredNavCache = true;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || /^(https?:)?\/\//i.test(href)) return;
    if (a.getAttribute('target') === '_blank') return;
    cacheCurrentChromeDOM();
  }, { capture: true });
}

// --- LÓGICA DO MENU COLAPSADO ---
function applySavedSidebarState() {
  // Verifica se estamos na página de sala de aula
  const isClassroom = window.location.href.includes('classroom.html');
  
  let collapsed;
  
  if (isClassroom) {
    // Se for sala de aula, SEMPRE começa fechado (true)
    collapsed = true;
  } else {
    // Nas outras páginas, lembra a escolha do usuário
    collapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === '1';
  }

  // Aplica as classes
  document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
  document.body.classList.toggle('sidebar-collapsed', collapsed);
}

function saveSidebarState() {
  const collapsed = document.body.classList.contains('sidebar-collapsed');
  
  // Só salva a preferência no localStorage se NÃO estivermos no classroom
  // Assim, se o usuário fechar o menu no classroom, não afeta a home
  if (!window.location.href.includes('classroom.html')) {
      localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? '1' : '0');
  }
}

// --- UI Actions ---
function highlightActiveLink() {
  const path = window.location.pathname;
  const page = path.split("/").pop();
  document.querySelectorAll('.side-item, .navlink').forEach(link => {
    const href = link.getAttribute('href');
    if (href && page && href.includes(page)) {
      link.style.color = 'var(--brand)';
      link.style.backgroundColor = 'var(--sidebar-hover)';
      link.style.fontWeight = 'bold';
    }
  });
}

function setupSidebarToggle() {
  const btn = document.getElementById('sidebar-toggle');
  if (!btn) return;
  btn.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (window.innerWidth <= 900) {
      document.body.classList.toggle('sidebar-open');
      if (!document.getElementById('sidebar-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.className = 'sidebar-overlay';
        overlay.onclick = () => document.body.classList.remove('sidebar-open');
        document.body.appendChild(overlay);
      }
    } else {
      document.body.classList.toggle('sidebar-collapsed');
      document.documentElement.classList.toggle('sidebar-collapsed', document.body.classList.contains('sidebar-collapsed'));
      saveSidebarState();
    }
  };
}

// --- Auth ---
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  updateUI(session);
}

function updateUI(session) {
  const userPill = document.getElementById('user-pill');
  const authActions = document.getElementById('auth-actions');
  const userNameEl = document.getElementById('user-name');
  const logoutBtn = document.getElementById('side-logout');

  if (session) {
    if (authActions) authActions.style.display = 'none';
    if (userPill) userPill.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'flex';
    if (userNameEl) userNameEl.textContent = session.user.user_metadata?.full_name || session.user.email;
    checkRole(session.user.id);
  } else {
    if (authActions) authActions.style.display = 'block';
    if (userPill) userPill.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    const adminGroup = document.getElementById('sidebar-admin-group');
    if (adminGroup) adminGroup.style.display = 'none';
  }
}

async function checkRole(uid) {
  const cachedRole = localStorage.getItem('ava3_role');
  if (cachedRole) applyRoleUI(cachedRole);

  const { data } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
  if (data) {
    const role = data.role || 'aluno';
    localStorage.setItem('ava3_role', role);
    applyRoleUI(role);
  }
}

function applyRoleUI(role) {
  const adminGroup = document.getElementById('sidebar-admin-group');
  const linkAdmin = document.getElementById('link-admin');
  
  if (adminGroup) {
    if (['admin', 'gerente', 'professor'].includes(role)) {
      adminGroup.style.display = 'block';
      if (linkAdmin) linkAdmin.style.display = 'inline-block';
    } else {
      adminGroup.style.display = 'none';
      if (linkAdmin) linkAdmin.style.display = 'none';
    }
  }
}

function applyCachedRole() {
  const cachedRole = localStorage.getItem('ava3_role');
  if (cachedRole) applyRoleUI(cachedRole);
}

function wireAuthStateChange() {
  if (wiredAuth) return;
  wiredAuth = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      localStorage.removeItem('ava3_role');
      window.location.href = 'login.html';
    } else if (event === 'SIGNED_IN') {
      checkAuth();
    }
  });
}

function wireLogoutButton() {
  const btnLogout = document.getElementById('side-logout');
  if (!btnLogout) return;
  btnLogout.onclick = async () => {
    if (confirm("Deseja sair?")) await supabase.auth.signOut();
  };
}

// --- Injection Helpers ---
function ensureSlot(id) {
  if (!document.getElementById(id)) {
    const div = document.createElement('div');
    div.id = id;
    if (id === 'site-footer') document.body.appendChild(div);
    else document.body.insertBefore(div, document.body.firstChild);
  }
}

function inject(id, doc, slotName) {
  const container = document.getElementById(id);
  const source = doc.querySelector(`[data-slot="${slotName}"]`);
  if (container && source) container.innerHTML = source.innerHTML;
}

initChrome();