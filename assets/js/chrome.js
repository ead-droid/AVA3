// assets/js/chrome.js
import { supabase } from './supabaseClient.js';

// Arquivo layout (o seu chrome.html)
const LAYOUT_URL = './assets/chrome.html';

// Versão do cache
const CHROME_CACHE_VER = 'v1';
const HEADER_KEY  = `ava3.chrome.header.${CHROME_CACHE_VER}`;
const SIDEBAR_KEY = `ava3.chrome.sidebar.${CHROME_CACHE_VER}`;
const FOOTER_KEY  = `ava3.chrome.footer.${CHROME_CACHE_VER}`;

const SIDEBAR_STATE_KEY = 'ava3.sidebarCollapsed';

let eventsWired = false;
let authListenerWired = false;

function ensureSlotsExist() {
  // Só garante se existir no HTML da página. Se faltar, cria (mas SEM bagunçar layout).
  // Ideal: todas páginas com menu já terem os 3 <div id="site-..."></div>.
  if (!document.getElementById('site-header')) {
    const div = document.createElement('div');
    div.id = 'site-header';
    document.body.insertBefore(div, document.body.firstChild);
  }
  if (!document.getElementById('site-sidebar')) {
    const div = document.createElement('div');
    div.id = 'site-sidebar';
    document.body.insertBefore(div, document.body.firstChild.nextSibling);
  }
  if (!document.getElementById('site-footer')) {
    const div = document.createElement('div');
    div.id = 'site-footer';
    document.body.appendChild(div);
  }
}

function getCache() {
  const fromBoot = window.__AVA3_CHROME_CACHE__ || {};
  return {
    header: fromBoot.header || sessionStorage.getItem(HEADER_KEY) || '',
    sidebar: fromBoot.sidebar || sessionStorage.getItem(SIDEBAR_KEY) || '',
    footer: fromBoot.footer || sessionStorage.getItem(FOOTER_KEY) || ''
  };
}

function saveCache({ header, sidebar, footer }) {
  try {
    if (header) sessionStorage.setItem(HEADER_KEY, header);
    if (sidebar) sessionStorage.setItem(SIDEBAR_KEY, sidebar);
    if (footer) sessionStorage.setItem(FOOTER_KEY, footer);
  } catch {}

  window.__AVA3_CHROME_CACHE__ = { header, sidebar, footer };
}

function injectIfDifferent(id, html) {
  const el = document.getElementById(id);
  if (!el || !html) return false;
  if (el.innerHTML === html) return false;
  el.innerHTML = html;
  return true;
}

function injectFromCacheFast() {
  const cache = getCache();

  // Mantém estado recolhido/aberto
  const collapsed = document.documentElement.classList.contains('sidebar-collapsed');

  let changed = false;
  if (cache.header)  changed = injectIfDifferent('site-header', cache.header)  || changed;
  if (cache.sidebar) changed = injectIfDifferent('site-sidebar', cache.sidebar) || changed;
  if (cache.footer)  changed = injectIfDifferent('site-footer', cache.footer)  || changed;

  // Reaplica estado depois de injetar
  setSidebarCollapsed(collapsed);

  return changed;
}

async function fetchLayout() {
  const res = await fetch(LAYOUT_URL, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Não foi possível carregar: ${LAYOUT_URL} (${res.status})`);
  return await res.text();
}

function parseSlots(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  const header = doc.querySelector('[data-slot="header"]')?.innerHTML || '';
  const sidebar = doc.querySelector('[data-slot="sidebar"]')?.innerHTML || '';
  const footer = doc.querySelector('[data-slot="footer"]')?.innerHTML || '';

  return { header, sidebar, footer };
}

async function refreshFromNetwork() {
  try {
    const text = await fetchLayout();
    const { header, sidebar, footer } = parseSlots(text);

    // Salva no cache
    saveCache({ header, sidebar, footer });

    // Só reinjeta se realmente mudou (evita flicker)
    const collapsed = document.documentElement.classList.contains('sidebar-collapsed');

    let changed = false;
    if (header)  changed = injectIfDifferent('site-header', header)  || changed;
    if (sidebar) changed = injectIfDifferent('site-sidebar', sidebar) || changed;
    if (footer)  changed = injectIfDifferent('site-footer', footer)  || changed;

    setSidebarCollapsed(collapsed);

    // Reaplica detalhes de UI após possível reinjeção
    highlightActiveLink();
    applyCachedRole();

    return changed;
  } catch (err) {
    console.error('Erro ao atualizar chrome (network):', err);
    return false;
  }
}

function setSidebarCollapsed(isCollapsed) {
  const html = document.documentElement;
  const body = document.body;

  html.classList.toggle('sidebar-collapsed', isCollapsed);
  if (body) body.classList.toggle('sidebar-collapsed', isCollapsed);

  try {
    localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? '1' : '0');
  } catch {}
}

function restoreSidebarState() {
  try {
    const collapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === '1';
    setSidebarCollapsed(collapsed);
  } catch {}
}

function wireEventsOnce() {
  if (eventsWired) return;
  eventsWired = true;

  // A) Antes de navegar, salva o chrome atual no cache (para a próxima página nascer com menu pronto)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;

    const href = a.getAttribute('href') || '';
    const isInternal =
      href &&
      !href.startsWith('http') &&
      !href.startsWith('mailto:') &&
      !href.startsWith('tel:') &&
      !href.startsWith('#') &&
      !href.startsWith('javascript:');

    if (isInternal) {
      const header = document.getElementById('site-header')?.innerHTML || '';
      const sidebar = document.getElementById('site-sidebar')?.innerHTML || '';
      const footer = document.getElementById('site-footer')?.innerHTML || '';
      if (header || sidebar || footer) saveCache({ header, sidebar, footer });
    }
  }, { capture: true });

  // B) Toggle sidebar (desktop recolhe / mobile abre overlay)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#sidebar-toggle, [data-toggle="sidebar"], [data-sidebar-toggle]');
    if (!btn) return;

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
      const nowCollapsed = document.documentElement.classList.contains('sidebar-collapsed');
      setSidebarCollapsed(!nowCollapsed);
    }
  });

  // C) Logout
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#side-logout, [data-action="logout"], .js-logout');
    if (!btn) return;

    e.preventDefault();
    if (!confirm('Deseja sair?')) return;

    try {
      await supabase.auth.signOut();
    } finally {
      localStorage.removeItem('ava3_role');
      window.location.href = 'login.html';
    }
  });
}

// Marca o link ativo no menu lateral
function highlightActiveLink() {
  const path = window.location.pathname;
  const page = path.split('/').pop();

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

async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  updateUI(session);
}

// Atualiza UI básica
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

// Role com cache primeiro (para não piscar)
async function checkRole(uid) {
  const cachedRole = localStorage.getItem('ava3_role');
  if (cachedRole) applyRoleUI(cachedRole);

  const { data } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle();
  if (data) {
    const role = (data.role || 'aluno').toLowerCase();
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

function wireAuthListenerOnce() {
  if (authListenerWired) return;
  authListenerWired = true;

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      localStorage.removeItem('ava3_role');
      window.location.href = 'login.html';
    } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
      checkAuth();
    }
  });
}

async function initChrome() {
  ensureSlotsExist();

  // Deixa layout estável (evita shift)
  document.body.classList.add('has-sidebar');

  // 1) injeta cache rápido (se existir)
  injectFromCacheFast();

  // 2) wire eventos (delegação, funciona mesmo após reinjeção)
  wireEventsOnce();

  // 3) UI "visual" imediata
  restoreSidebarState();
  highlightActiveLink();
  applyCachedRole();

  // 4) auth em paralelo (não segura o menu)
  checkAuth();
  wireAuthListenerOnce();

  // 5) refresh do layout em background (atualiza cache)
  await refreshFromNetwork();

  // 6) sinaliza para o boot.js liberar transições
  document.dispatchEvent(new CustomEvent('ava3:chrome-ready'));
}

initChrome();
