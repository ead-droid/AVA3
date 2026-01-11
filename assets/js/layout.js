// assets/js/layout.js
import {
  supabase,
  getSessionSafe,
  getUserDisplayName,
} from './supabaseClient.js';

function ensureBoxicons() {
  if (document.querySelector('link[data-boxicons="1"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css';
  link.setAttribute('data-boxicons', '1');
  document.head.appendChild(link);
}

function rel(path) {
  return new URL(`./${path}`, window.location.href).toString();
}

function page() {
  return document.body?.dataset?.page || '';
}

function isAuthRequiredPage() {
  return document.body?.dataset?.auth === 'required';
}

/** Tenta validar admin por RPC e, se não der, tenta por profiles.role */
async function checkIsAdmin(uid) {
  // 1) RPC (se existir)
  const tries = [{ uid }, { user_id: uid }, { p_uid: uid }];
  for (const args of tries) {
    try {
      const { data, error } = await supabase.rpc('is_admin', args);
      if (!error) return !!data;
    } catch (_) {}
  }

  // 2) fallback: profiles.role (precisa policy select own)
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle();

    if (error) return false;
    return String(data?.role || '').toLowerCase() === 'admin';
  } catch (_) {
    return false;
  }
}

function ensureSidebarHosts() {
  // Só cria sidebar automaticamente em páginas privadas (ex.: app.html/admin.html)
  if (!isAuthRequiredPage()) return;

  let sidebar = document.getElementById('site-sidebar');
  if (!sidebar) {
    sidebar = document.createElement('aside');
    sidebar.id = 'site-sidebar';
    document.body.insertBefore(sidebar, document.querySelector('main') || null);
  }
  sidebar.classList.add('site-sidebar');

  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }
  overlay.classList.add('sidebar-overlay');
}

function renderHeaderFooter() {
  ensureBoxicons();
  ensureSidebarHosts();

  const p = page();

  const headerHost = document.getElementById('site-header');
  const footerHost = document.getElementById('site-footer');
  const sidebarHost = document.getElementById('site-sidebar');

  if (headerHost) {
    headerHost.innerHTML = `
      <header class="site-header">
        <div class="inner">
          <a class="brand" href="${rel('index.html')}">
            <span class="dot"></span>
            <span>AVA</span>
          </a>

          <nav class="nav" aria-label="Menu principal">
            <a class="navlink ${p === 'home' ? 'active' : ''}" href="${rel(
      'index.html'
    )}">Início</a>
            <a class="navlink ${p === 'app' ? 'active' : ''}" href="${rel(
      'app.html'
    )}">Minha área</a>

            <!-- Admin começa oculto: só aparece se confirmar admin -->
            <a id="nav-admin" class="navlink ${
              p === 'admin' ? 'active' : ''
            }" href="${rel('admin.html')}" style="display:none;">Admin</a>
          </nav>

          <div class="right">
            <span id="user-pill" class="badge" style="display:none;" title="">
              <i class="bx bx-user"></i> <span id="user-name"></span>
            </span>

            <a id="auth-link" class="btn primary" href="${rel('login.html')}">
              <i class="bx bx-log-in"></i> Entrar
            </a>

            <button id="logout-btn" class="btn ghost" type="button" style="display:none;">
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
          <div>© ${new Date().getFullYear()} AVA • Protótipo</div>
          <div class="footer-links">
            <a href="${rel('index.html')}">Home</a>
            <a href="${rel('app.html')}">Minha área</a>
            <a id="footer-auth" href="${rel('login.html')}">Login</a>
          </div>
        </div>
      </footer>
    `;
  }

  // Sidebar (só em páginas com data-auth="required")
  if (sidebarHost) {
    sidebarHost.innerHTML = `
      <div class="sb-head">
        <div class="sb-title">
          <span class="sb-dot"></span>
          <div>
            <div class="sb-ttl">Menu</div>
            <div class="sb-sub">Navegação</div>
          </div>
        </div>

        <button class="sb-collapse" id="sb-collapse" type="button" title="Recolher/Expandir">
          &laquo;
        </button>
      </div>

      <nav class="sb-nav" aria-label="Menu lateral">
        <a class="sb-item ${p === 'app' ? 'active' : ''}" href="${rel(
      'app.html'
    )}">
          <i class="bx bx-grid-alt"></i>
          <span class="sb-label">Minha área</span>
        </a>

        <a class="sb-item ${p === 'home' ? 'active' : ''}" href="${rel(
      'index.html'
    )}">
          <i class="bx bx-home"></i>
          <span class="sb-label">Início</span>
        </a>

        <a id="sb-admin" class="sb-item ${
          p === 'admin' ? 'active' : ''
        }" href="${rel('admin.html')}" style="display:none;">
          <i class="bx bx-lock-alt"></i>
          <span class="sb-label">Admin</span>
        </a>
      </nav>
    `;

    const btn = document.getElementById('sb-collapse');
    if (btn) {
      btn.onclick = () => {
        document.body.classList.toggle('sidebar-collapsed');
      };
    }

    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
      overlay.onclick = () => document.body.classList.remove('sidebar-open');
    }
  }
}

async function doLogout() {
  try {
    await supabase.auth.signOut();
  } catch (_) {}
  window.location.assign(rel('index.html'));
}

async function syncAuthUI() {
  const navAdmin = document.getElementById('nav-admin');
  const sbAdmin = document.getElementById('sb-admin');

  const authLink = document.getElementById('auth-link');
  const logoutBtn = document.getElementById('logout-btn');

  const userPill = document.getElementById('user-pill');
  const userNameEl = document.getElementById('user-name');

  const footerAuth = document.getElementById('footer-auth');

  const { session } = await getSessionSafe();
  const authed = !!session;

  document.body.classList.toggle('is-authed', authed);

  // Sidebar só faz sentido quando autenticado
  document.body.classList.toggle('has-sidebar', authed && isAuthRequiredPage());

  if (!authed && isAuthRequiredPage()) {
    window.location.assign(rel('login.html'));
    return;
  }

  if (!authed) {
    if (userPill) userPill.style.display = 'none';
    if (authLink) authLink.style.display = 'inline-flex';
    if (logoutBtn) logoutBtn.style.display = 'none';

    if (footerAuth) {
      footerAuth.textContent = 'Login';
      footerAuth.href = rel('login.html');
      footerAuth.onclick = null;
    }

    if (navAdmin) navAdmin.style.display = 'none';
    if (sbAdmin) sbAdmin.style.display = 'none';

    return;
  }

  // LOGADO
  const displayName = getUserDisplayName(session);
  const email = session.user?.email || '';
  const uid = session.user?.id;

  if (userPill && userNameEl) {
    userPill.style.display = 'inline-flex';
    userPill.title = email || displayName;
    userNameEl.textContent = displayName || email;
  }

  // Mantém apenas "Sair" da DIREITA
  if (authLink) authLink.style.display = 'none';
  if (logoutBtn) {
    logoutBtn.style.display = 'inline-flex';
    logoutBtn.onclick = doLogout;
  }

  if (footerAuth) {
    footerAuth.textContent = 'Sair';
    footerAuth.href = '#';
    footerAuth.onclick = async (e) => {
      e.preventDefault();
      await doLogout();
    };
  }

  // Admin: só aparece se confirmar admin
  let isAdmin = false;
  if (uid) isAdmin = await checkIsAdmin(uid);

  document.body.classList.toggle('is-admin', isAdmin);

  if (navAdmin) navAdmin.style.display = isAdmin ? '' : 'none';
  if (sbAdmin) sbAdmin.style.display = isAdmin ? '' : 'none';
}

function watchAuthChanges() {
  try {
    supabase.auth.onAuthStateChange(() => syncAuthUI());
  } catch (_) {}
}

// BOOT
renderHeaderFooter();
syncAuthUI();
watchAuthChanges();
