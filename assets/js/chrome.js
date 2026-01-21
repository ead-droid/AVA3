// assets/js/chrome.js
import { supabase } from './supabaseClient.js';

// Caminho robusto: chrome.js está em /assets/js/ -> ../chrome.html = /assets/chrome.html
const LAYOUT_URL = new URL('../chrome.html', import.meta.url).toString();

// Cache de slots (PRECISA bater com o boot.js)
const VER = 'v1';
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

  // garante classe no body conforme estado salvo
  applySavedSidebarState();

  // Liga cache antes de navegação (para não perder cache)
  wireCacheBeforeNavigation();
  // Fallback forte: garante cache mesmo se navegação não for por <a>
  window.addEventListener('beforeunload', cacheCurrentChromeDOM, { capture: true });

  // UI básica (pode já existir via boot.js)
  document.body.classList.add('has-sidebar');

  // Reaplica handlers (se o boot.js já hidratou HTML, agora ativamos botões)
  setupSidebarToggle();
  highlightActiveLink();
  applyCachedRole();
  await checkAuth();
  wireAuthStateChange();
  wireLogoutButton();

  // Atualiza o layout “de verdade” (rede) em background
  try {
    const res = await fetch(LAYOUT_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Não foi possível carregar: ${LAYOUT_URL} (${res.status})`);

    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    inject('site-header', doc, 'header');
    inject('site-sidebar', doc, 'sidebar');
    inject('site-footer', doc, 'footer');

    document.body.classList.add('has-sidebar');
    applySavedSidebarState();

    setupSidebarToggle();
    highlightActiveLink();

    // MUITO IMPORTANTE: salvar cache para a próxima página abrir instantâneo
    cacheCurrentChromeDOM();

    // Revalida auth/role depois de reinjetar (garante ids existirem)
    await checkAuth();
    wireLogoutButton();

  } catch (err) {
    console.error('Erro ao inicializar interface (Chrome):', err);

    // Se a rede falhar, pelo menos tenta garantir que existe cache (se tiver)
    injectFromCacheFallback();
    setupSidebarToggle();
    highlightActiveLink();
    applyCachedRole();
  }
}

// ----------------------
// Cache / Hydration
// ----------------------
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

  if (headerEl && headerHTML && headerEl.innerHTML.trim() === '') headerEl.innerHTML = headerHTML;
  if (sidebarEl && sidebarHTML && sidebarEl.innerHTML.trim() === '') sidebarEl.innerHTML = sidebarHTML;
  if (footerEl && footerHTML && footerEl.innerHTML.trim() === '') footerEl.innerHTML = footerHTML;
}

function wireCacheBeforeNavigation() {
  if (wiredNavCache) return;
  wiredNavCache = true;

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;

    const href = a.getAttribute('href') || '';
    if (!href) return;

    // ignora âncoras e links externos
    if (
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      /^(https?:)?\/\//i.test(href)
    ) return;

    // ignora nova aba
    const target = (a.getAttribute('target') || '').toLowerCase();
    if (target === '_blank') return;

    // salva cache antes de navegar
    cacheCurrentChromeDOM();
  }, { capture: true });
}

// ----------------------
// Sidebar state
// ----------------------
function applySavedSidebarState() {
  const collapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === '1';
  document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
  document.body.classList.toggle('sidebar-collapsed', collapsed);
}

function saveSidebarState() {
  const collapsed =
    document.body.classList.contains('sidebar-collapsed') ||
    document.documentElement.classList.contains('sidebar-collapsed');

  localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? '1' : '0');
}

// ----------------------
// UI functions (suas)
// ----------------------
function highlightActiveLink() {
  const path = window.location.pathname;
  const page = path.split("/").pop();

  const links = document.querySelectorAll('.side-item, .navlink');
  links.forEach(link => {
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
    e.preventDefault();
    e.stopPropagation();

    if (window.innerWidth <= 900) {
      document.body.classList.toggle('sidebar-open');

      let overlay = document.getElementById('sidebar-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
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

// ----------------------
// Auth / Role (seus)
// ----------------------
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

    const name = session.user.user_metadata?.full_name || session.user.email;
    if (userNameEl) userNameEl.textContent = name;

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

  const { data, error } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
  if (error) {
    console.warn('Erro ao buscar role:', error.message);
    return;
  }
  if (data) {
    const role = data.role || 'aluno';
    localStorage.setItem('ava3_role', role);
    applyRoleUI(role);
  }
}

function applyRoleUI(role) {
  const adminGroup = document.getElementById('sidebar-admin-group');
  const linkAdmin = document.getElementById('link-admin');

  if (['admin', 'gerente', 'professor'].includes(role)) {
    if (adminGroup) adminGroup.style.display = 'block';
    if (linkAdmin) linkAdmin.style.display = 'inline-block';
  } else {
    if (adminGroup) adminGroup.style.display = 'none';
    if (linkAdmin) linkAdmin.style.display = 'none';
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
    } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      checkAuth();
    }
  });
}

function wireLogoutButton() {
  const btnLogout = document.getElementById('side-logout');
  if (!btnLogout) return;

  btnLogout.onclick = async () => {
    if (confirm("Deseja sair?")) {
      await supabase.auth.signOut();
    }
  };
}

// ----------------------
// Slots/inject (seus)
// ----------------------
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

// Inicia
initChrome();
