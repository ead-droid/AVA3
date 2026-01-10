// assets/js/layout.js

function ensureBoxicons() {
  if (document.querySelector('link[data-boxicons="1"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css';
  link.setAttribute('data-boxicons', '1');
  document.head.appendChild(link);
}

function rel(path) {
  // sempre relativo (funciona no /AVA3/)
  return new URL(`./${path}`, window.location.href).toString();
}

function getActivePage() {
  return document.body.dataset.page || '';
}

function requiresAuth() {
  return (document.body.dataset.auth || '') === 'required';
}

/** ✅ Supabase passa a ser opcional: se falhar, header/footer continuam aparecendo */
let supabasePromise = null;
async function getSupabaseClient() {
  if (supabasePromise) return supabasePromise;

  supabasePromise = import('./supabaseClient.js')
    .then((m) => m.supabase)
    .catch((err) => {
      console.warn(
        '[layout] Não foi possível carregar supabaseClient.js:',
        err
      );
      return null;
    });

  return supabasePromise;
}

function renderHeaderFooter() {
  ensureBoxicons();

  const page = getActivePage();

  const headerHost = document.getElementById('site-header');
  const footerHost = document.getElementById('site-footer');

  if (headerHost) {
    headerHost.innerHTML = `
      <header class="site-header">
        <div class="inner">
          <div class="left">
            <button id="sidebar-toggle" class="icon-btn" aria-label="Abrir menu" aria-expanded="false" style="display:none;">
              <i class="bx bx-menu"></i>
            </button>

            <a class="brand" href="${rel('index.html')}">
              <span class="mark">AVA</span>
              <span class="sep">•</span>
              <span class="name">Portal</span>
            </a>
          </div>

          <nav class="nav" aria-label="Menu principal">
            <a class="navlink ${page === 'home' ? 'active' : ''}" href="${rel(
      'index.html'
    )}">Início</a>
            <a class="navlink ${page === 'app' ? 'active' : ''}" href="${rel(
      'app.html'
    )}">Meus cursos</a>

            <a class="navlink ${
              page === 'admin' ? 'active' : ''
            }" data-admin-link href="${rel(
      'admin.html'
    )}" style="display:none;">
              Admin
            </a>

            <a class="navlink ${page === 'login' ? 'active' : ''}" href="${rel(
      'login.html'
    )}">Entrar</a>
          </nav>

          <div class="right">
            <span id="user-pill" class="badge" style="display:none;">
              <i class="bx bx-user"></i> <span id="user-email"></span>
            </span>

            <a id="auth-link" class="btn primary" href="${rel('login.html')}">
              <i class="bx bx-log-in"></i> Entrar
            </a>

            <button id="logout-btn" class="btn ghost" style="display:none;">
              <i class="bx bx-log-out"></i> Sair
            </button>
          </div>
        </div>
      </header>
    `;
  }

  if (footerHost) {
    footerHost.innerHTML = `
      <footer class="site-footer">
        <div class="inner">
          <span class="muted">© ${new Date().getFullYear()} • AVA</span>
          <span class="muted">Versão do protótipo</span>
        </div>
      </footer>
    `;
  }
}

function renderSidebarIfPresent() {
  const sidebarHost = document.getElementById('site-sidebar');
  if (!sidebarHost) return;

  const page = getActivePage();
  document.body.classList.add('has-sidebar');

  sidebarHost.innerHTML = `
    <aside class="site-sidebar" aria-label="Menu lateral">
      <div class="side-group">
        <a class="side-item ${page === 'app' ? 'active' : ''}" href="${rel(
    'app.html'
  )}">
          <i class="bx bx-grid-alt"></i>
          <span class="side-label">Meus cursos</span>
        </a>

        <a class="side-item ${
          page === 'admin' ? 'active' : ''
        }" data-admin-link href="${rel('admin.html')}" style="display:none;">
          <i class="bx bx-cog"></i>
          <span class="side-label">Admin</span>
        </a>

        <a class="side-item ${page === 'home' ? 'active' : ''}" href="${rel(
    'index.html'
  )}">
          <i class="bx bx-home"></i>
          <span class="side-label">Início</span>
        </a>
      </div>

      <div class="side-divider"></div>

      <div class="side-group">
        <a class="side-item" href="${rel('login.html')}">
          <i class="bx bx-log-in"></i>
          <span class="side-label">Entrar</span>
        </a>

        <button class="side-item danger" id="sidebar-logout" style="display:none;" type="button">
          <i class="bx bx-log-out"></i>
          <span class="side-label">Sair</span>
        </button>
      </div>
    </aside>

    <div class="sidebar-overlay" id="sidebar-overlay" aria-hidden="true"></div>
  `;
}

function setupSidebarBehavior() {
  const sidebarHost = document.getElementById('site-sidebar');
  if (!sidebarHost) return;

  const btn = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sidebar-overlay');

  if (btn) btn.style.display = 'inline-flex';

  const mql = window.matchMedia('(max-width: 920px)');

  // estado desktop (colapsado/expandido)
  const saved = localStorage.getItem('ava_sidebar_state');
  if (saved === 'collapsed' && !mql.matches) {
    document.body.classList.add('sidebar-collapsed');
  }

  function closeMobile() {
    document.body.classList.remove('sidebar-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (overlay) overlay.setAttribute('aria-hidden', 'true');
  }

  function toggle() {
    if (mql.matches) {
      document.body.classList.toggle('sidebar-open');
      const open = document.body.classList.contains('sidebar-open');
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (overlay) overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    } else {
      document.body.classList.toggle('sidebar-collapsed');
      const collapsed = document.body.classList.contains('sidebar-collapsed');
      localStorage.setItem(
        'ava_sidebar_state',
        collapsed ? 'collapsed' : 'expanded'
      );
    }
  }

  btn?.addEventListener('click', toggle);
  overlay?.addEventListener('click', closeMobile);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobile();
  });

  // ao sair do mobile, não “prender” overlay aberto
  mql.addEventListener('change', () => {
    closeMobile();
  });
}

async function syncAuthUI() {
  const authLink = document.getElementById('auth-link');
  const logoutBtn = document.getElementById('logout-btn');
  const userPill = document.getElementById('user-pill');
  const userEmail = document.getElementById('user-email');

  const sidebarLogout = document.getElementById('sidebar-logout');

  // Admin links (header + sidebar)
  const adminLinks = document.querySelectorAll('[data-admin-link]');

  const supabase = await getSupabaseClient();
  if (!supabase) return; // ✅ sem supabase: mantém layout, mas sem estado de login

  const { data, error } = await supabase.auth.getSession();
  if (error) return;

  const session = data?.session || null;
  const email = session?.user?.email || '';

  // ✅ Se a página exige login e não tem sessão, manda para login
  if (!session && requiresAuth()) {
    window.location.assign(rel('login.html'));
    return;
  }

  // Admin só aparece quando logado (por enquanto)
  adminLinks.forEach((el) => {
    el.style.display = session ? '' : 'none';
  });

  if (session) {
    if (authLink) {
      authLink.href = rel('app.html');
      authLink.innerHTML = `<i class="bx bx-grid-alt"></i> Ir para o App`;
    }

    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    if (sidebarLogout) sidebarLogout.style.display = 'inline-flex';

    if (userPill && userEmail) {
      userPill.style.display = 'inline-flex';
      userEmail.textContent = email || 'sessão ativa';
    }
  } else {
    if (authLink) {
      authLink.href = rel('login.html');
      authLink.innerHTML = `<i class="bx bx-log-in"></i> Entrar`;
    }

    if (logoutBtn) logoutBtn.style.display = 'none';
    if (sidebarLogout) sidebarLogout.style.display = 'none';
    if (userPill) userPill.style.display = 'none';
  }

  async function doLogout() {
    await supabase.auth.signOut();
    window.location.assign(rel('index.html'));
  }

  if (logoutBtn) logoutBtn.onclick = doLogout;
  if (sidebarLogout) sidebarLogout.onclick = doLogout;
}

async function watchAuthChanges() {
  const supabase = await getSupabaseClient();
  if (!supabase) return;

  supabase.auth.onAuthStateChange(() => {
    syncAuthUI();
  });
}

// Boot
renderHeaderFooter();
renderSidebarIfPresent();
setupSidebarBehavior();
syncAuthUI();
watchAuthChanges();
