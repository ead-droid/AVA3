// assets/js/layout.js
import { supabase } from './supabaseClient.js';

function ensureBoxicons() {
  if (document.querySelector('link[data-boxicons="1"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css';
  link.setAttribute('data-boxicons', '1');
  document.head.appendChild(link);
}

function rel(path) {
  // sempre relativo (funciona em /AVA3/ ou subpasta)
  return new URL(`./${path}`, window.location.href).toString();
}

function getActivePage() {
  // defina <body data-page="home">, <body data-page="app">, <body data-page="admin"> etc.
  return document.body?.dataset?.page || '';
}

function setSidebarOpen(open) {
  document.body.classList.toggle('sidebar-open', !!open);
}

function bindSidebarEvents() {
  const toggle = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('side-overlay');

  if (toggle) {
    toggle.addEventListener('click', () => {
      setSidebarOpen(!document.body.classList.contains('sidebar-open'));
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => setSidebarOpen(false));
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setSidebarOpen(false);
  });
}

function renderHeader(page) {
  const headerHost = document.getElementById('site-header');
  if (!headerHost) return;

  const hrefHome = rel('index.html');
  const hrefApp = rel('app.html');
  const hrefAdmin = rel('admin.html');
  const hrefLogin = rel('login.html');

  headerHost.innerHTML = `
    <header class="site-header">
      <div class="inner">
        <div class="left">
          <button id="sidebar-toggle" class="btn icon" type="button" aria-label="Abrir menu">
            <i class="bx bx-menu"></i>
          </button>

          <a class="brand" href="${hrefHome}">
            <span class="dot"></span>
            <span>AVA</span>
          </a>
        </div>

        <nav class="nav" aria-label="Menu principal">
          <a class="navlink ${
            page === 'home' ? 'active' : ''
          }" href="${hrefHome}">Início</a>
          <a class="navlink ${
            page === 'app' ? 'active' : ''
          }" href="${hrefApp}">Meus cursos</a>
          <a id="top-admin-link" class="navlink ${
            page === 'admin' ? 'active' : ''
          }" href="${hrefAdmin}">Admin</a>
        </nav>

        <div class="right">
          <span id="user-pill" class="badge" style="display:none;">
            <i class="bx bx-user"></i> <span id="user-email"></span>
          </span>

          <a id="auth-link" class="btn primary" href="${hrefLogin}">
            <i class="bx bx-log-in"></i> Entrar
          </a>

          <button id="logout-btn" class="btn ghost" style="display:none;" type="button">
            <i class="bx bx-log-out"></i> Sair
          </button>
        </div>
      </div>
    </header>
  `;
}

function renderFooter() {
  const footerHost = document.getElementById('site-footer');
  if (!footerHost) return;

  const year = new Date().getFullYear();
  const hrefHome = rel('index.html');
  const hrefLogin = rel('login.html');
  const hrefApp = rel('app.html');

  footerHost.innerHTML = `
    <footer class="site-footer">
      <div class="inner">
        <div>© ${year} AVA • Protótipo</div>
        <div class="footer-links">
          <a href="${hrefHome}">Home</a>
          <a href="${hrefLogin}">Login</a>
          <a href="${hrefApp}">App</a>
        </div>
      </div>
    </footer>
  `;
}

function renderSidebar(page) {
  // sidebar fixa no desktop; drawer no mobile
  document.body.classList.add('has-sidenav');

  const hrefHome = rel('index.html');
  const hrefApp = rel('app.html');
  const hrefAdmin = rel('admin.html');
  const hrefLogin = rel('login.html');
  const year = new Date().getFullYear();

  const existing = document.getElementById('side-nav');
  const overlayExisting = document.getElementById('side-overlay');

  const sidebarHTML = `
    <aside class="side-nav" id="side-nav" aria-label="Menu lateral">
      <div class="sn-head">
        <a class="sn-brand" href="${hrefHome}">
          <span class="dot"></span>
          <span>AVA</span>
        </a>
        <span class="sn-tag">Menu</span>
      </div>

      <div id="side-user" class="sn-user" style="display:none;">
        <div class="badge">
          <i class="bx bx-user"></i> <span id="side-user-email"></span>
        </div>
      </div>

      <nav class="sn-nav">
        <a class="${page === 'home' ? 'active' : ''}" href="${hrefHome}">
          <i class="bx bx-home"></i> Início
        </a>
        <a class="${page === 'app' ? 'active' : ''}" href="${hrefApp}">
          <i class="bx bx-grid-alt"></i> Meus cursos
        </a>
        <a id="side-admin-link" class="${
          page === 'admin' ? 'active' : ''
        }" href="${hrefAdmin}">
          <i class="bx bx-cog"></i> Admin
        </a>
      </nav>

      <div class="sn-actions">
        <a id="side-auth-link" class="btn primary" href="${hrefLogin}">
          <i class="bx bx-log-in"></i> Entrar
        </a>
        <button id="side-logout-btn" class="btn ghost" style="display:none;" type="button">
          <i class="bx bx-log-out"></i> Sair
        </button>
      </div>

      <div class="sn-footer muted">© ${year}</div>
    </aside>

    <div class="side-overlay" id="side-overlay" aria-hidden="true"></div>
  `;

  if (existing) {
    existing.outerHTML = sidebarHTML;
  } else {
    document.body.insertAdjacentHTML('beforeend', sidebarHTML);
  }

  // se já existia overlay separado por algum motivo, remove duplicata visual
  if (overlayExisting && overlayExisting.id === 'side-overlay') {
    // ok
  }
}

async function syncAuthUI() {
  const authLink = document.getElementById('auth-link');
  const logoutBtn = document.getElementById('logout-btn');
  const userPill = document.getElementById('user-pill');
  const userEmail = document.getElementById('user-email');

  const sideUser = document.getElementById('side-user');
  const sideUserEmail = document.getElementById('side-user-email');
  const sideAuthLink = document.getElementById('side-auth-link');
  const sideLogoutBtn = document.getElementById('side-logout-btn');

  const topAdminLink = document.getElementById('top-admin-link');
  const sideAdminLink = document.getElementById('side-admin-link');

  const { data, error } = await supabase.auth.getSession();
  if (error) return;

  const session = data?.session || null;
  const email = session?.user?.email || '';

  if (session) {
    // header
    if (authLink) {
      authLink.href = rel('app.html');
      authLink.innerHTML = `<i class="bx bx-grid-alt"></i> Ir para o App`;
    }
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (userPill && userEmail) {
      userPill.style.display = 'inline-flex';
      userEmail.textContent = email || 'sessão ativa';
    }

    // sidebar
    if (sideUser && sideUserEmail) {
      sideUser.style.display = 'block';
      sideUserEmail.textContent = email || 'sessão ativa';
    }
    if (sideAuthLink) {
      sideAuthLink.href = rel('app.html');
      sideAuthLink.innerHTML = `<i class="bx bx-grid-alt"></i> Ir para o App`;
    }
    if (sideLogoutBtn) sideLogoutBtn.style.display = 'inline-flex';

    // Admin aparece quando logado (por enquanto)
    if (topAdminLink) topAdminLink.style.display = '';
    if (sideAdminLink) sideAdminLink.style.display = '';
  } else {
    // header
    if (authLink) {
      authLink.href = rel('login.html');
      authLink.innerHTML = `<i class="bx bx-log-in"></i> Entrar`;
    }
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (userPill) userPill.style.display = 'none';

    // sidebar
    if (sideUser) sideUser.style.display = 'none';
    if (sideAuthLink) {
      sideAuthLink.href = rel('login.html');
      sideAuthLink.innerHTML = `<i class="bx bx-log-in"></i> Entrar`;
    }
    if (sideLogoutBtn) sideLogoutBtn.style.display = 'none';

    // Admin escondido quando não logado (você pode mudar isso depois)
    if (topAdminLink) topAdminLink.style.display = 'none';
    if (sideAdminLink) sideAdminLink.style.display = 'none';
  }

  const doLogout = async () => {
    await supabase.auth.signOut();
    setSidebarOpen(false);
    window.location.assign(rel('index.html'));
  };

  if (logoutBtn) logoutBtn.onclick = doLogout;
  if (sideLogoutBtn) sideLogoutBtn.onclick = doLogout;
}

async function enforceAuthIfRequired() {
  const required = document.body?.dataset?.auth === 'required';
  if (!required) return;

  const { data } = await supabase.auth.getSession();
  const hasSession = !!data?.session;

  if (!hasSession) {
    window.location.assign(rel('login.html'));
  }
}

function boot() {
  ensureBoxicons();

  const page = getActivePage();

  renderHeader(page);
  renderFooter();
  renderSidebar(page);

  bindSidebarEvents();

  syncAuthUI();
  enforceAuthIfRequired();

  supabase.auth.onAuthStateChange(() => {
    syncAuthUI();
  });
}

boot();
