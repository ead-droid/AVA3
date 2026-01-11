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

function getActivePage() {
  return document.body?.dataset?.page || '';
}

function needsAuth() {
  return document.body?.dataset?.auth === 'required';
}

/**
 * Checa se usuário é admin.
 * Ordem:
 * 1) tenta RPC public.is_admin(uid) (ideal, pode funcionar mesmo com RLS travando SELECT)
 * 2) fallback: lê profiles.role (se policy permitir)
 */
async function checkIsAdmin(uid) {
  // 1) RPC (tenta nomes comuns de parâmetro)
  const rpcTries = [{ uid }, { user_id: uid }, { p_uid: uid }];
  for (const args of rpcTries) {
    try {
      const { data, error } = await supabase.rpc('is_admin', args);
      if (!error) return !!data;
    } catch (_) {}
  }

  // 2) Fallback: SELECT em profiles
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle();

    if (error) return false;
    const role = (data?.role ?? '').toString().toLowerCase();
    return role === 'admin';
  } catch (_) {
    return false;
  }
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
          <a class="brand" href="${rel('index.html')}">
            <span class="dot"></span>
            <span>AVA</span>
          </a>

          <nav class="nav" aria-label="Menu principal">
            <a class="navlink ${page === 'home' ? 'active' : ''}" href="${rel(
      'index.html'
    )}">Início</a>
            <a class="navlink ${page === 'app' ? 'active' : ''}" href="${rel(
      'app.html'
    )}">Minha área</a>

            <!-- Admin: começa oculto, só aparece se confirmar admin -->
            <a id="nav-admin" class="navlink ${
              page === 'admin' ? 'active' : ''
            }" href="${rel('admin.html')}" style="display:none;">Admin</a>

            <!-- Auth: vira Sair quando logado -->
            <a id="nav-auth" class="navlink ${
              page === 'login' ? 'active' : ''
            }" href="${rel('login.html')}">Entrar</a>
          </nav>

          <div class="right">
            <span id="user-pill" class="badge" style="display:none;" title="">
              <i class="bx bx-user"></i> <span id="user-name"></span>
            </span>

            <a id="auth-link" class="btn primary" href="${rel('login.html')}">
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
}

async function doLogout() {
  try {
    await supabase.auth.signOut();
  } catch (_) {}
  window.location.assign(rel('index.html'));
}

async function syncAuthUI() {
  const navAdmin = document.getElementById('nav-admin');
  const navAuth = document.getElementById('nav-auth');

  const authLink = document.getElementById('auth-link');
  const logoutBtn = document.getElementById('logout-btn');

  const userPill = document.getElementById('user-pill');
  const userName = document.getElementById('user-name');

  const footerAuth = document.getElementById('footer-auth');

  const { session } = await getSessionSafe();
  const isAuthed = !!session;

  document.body.classList.toggle('is-authed', isAuthed);

  // se página exige login
  if (!isAuthed && needsAuth()) {
    window.location.assign(rel('login.html'));
    return;
  }

  // DESLOGADO
  if (!isAuthed) {
    if (userPill) userPill.style.display = 'none';
    if (authLink) authLink.style.display = 'inline-flex';
    if (logoutBtn) logoutBtn.style.display = 'none';

    if (navAdmin) navAdmin.style.display = 'none';

    if (navAuth) {
      navAuth.textContent = 'Entrar';
      navAuth.href = rel('login.html');
      navAuth.onclick = null;
    }

    if (footerAuth) {
      footerAuth.textContent = 'Login';
      footerAuth.href = rel('login.html');
      footerAuth.onclick = null;
    }

    return;
  }

  // LOGADO
  const displayName = getUserDisplayName(session);
  const email = session.user?.email || '';
  const uid = session.user?.id;

  if (userPill && userName) {
    userPill.style.display = 'inline-flex';
    userPill.title = email || displayName;
    userName.textContent = displayName;
  }

  if (authLink) authLink.style.display = 'none';
  if (logoutBtn) {
    logoutBtn.style.display = 'inline-flex';
    logoutBtn.onclick = doLogout;
  }

  // navAuth vira "Sair"
  if (navAuth) {
    navAuth.textContent = 'Sair';
    navAuth.href = '#';
    navAuth.onclick = async (e) => {
      e.preventDefault();
      await doLogout();
    };
  }

  if (footerAuth) {
    footerAuth.textContent = 'Sair';
    footerAuth.href = '#';
    footerAuth.onclick = async (e) => {
      e.preventDefault();
      await doLogout();
    };
  }

  // Admin: só se confirmar admin
  let isAdmin = false;
  if (uid) {
    isAdmin = await checkIsAdmin(uid);
  }
  document.body.classList.toggle('is-admin', isAdmin);

  if (navAdmin) navAdmin.style.display = isAdmin ? '' : 'none';
}

function watchAuthChanges() {
  try {
    supabase.auth.onAuthStateChange(() => {
      syncAuthUI();
    });
  } catch (_) {}
}

// Boot
renderHeaderFooter();
syncAuthUI();
watchAuthChanges();
