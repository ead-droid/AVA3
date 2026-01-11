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
  // sempre relativo (funciona no /AVA3/)
  return new URL(`./${path}`, window.location.href).toString();
}

function getPage() {
  return document.body?.dataset?.page || '';
}

function needsAuth() {
  return document.body?.dataset?.auth === 'required';
}

function renderHeaderFooter() {
  ensureBoxicons();

  const page = getPage();

  const headerHost = document.getElementById('site-header');
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
            <a id="nav-app" class="navlink ${
              page === 'app' ? 'active' : ''
            }" href="${rel('app.html')}">Minha área</a>

            <!-- Admin começa oculto, só aparece se validar admin -->
            <a id="nav-admin" class="navlink ${
              page === 'admin' ? 'active' : ''
            }" href="${rel('admin.html')}" style="display:none;">Admin</a>

            <!-- Esse link vira "Sair" quando logado -->
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

            <button id="logout-btn" class="btn ghost" type="button" style="display:none;">
              <i class="bx bx-log-out"></i> Sair
            </button>
          </div>
        </div>
      </header>
    `;
  }

  const footerHost = document.getElementById('site-footer');
  if (footerHost) {
    footerHost.innerHTML = `
      <footer class="site-footer">
        <div class="inner">
          <div>© ${new Date().getFullYear()} AVA • Protótipo</div>
          <div class="footer-links">
            <a href="${rel('index.html')}">Home</a>
            <a id="footer-auth" href="${rel('login.html')}">Login</a>
            <a href="${rel('app.html')}">Minha área</a>
          </div>
        </div>
      </footer>
    `;
  }
}

async function fetchMyProfile(uid) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('id', uid)
      .maybeSingle();

    if (error) return { profile: null, error: error.message };
    return { profile: data || null, error: null };
  } catch (e) {
    return { profile: null, error: e?.message || String(e) };
  }
}

async function doLogout() {
  try {
    await supabase.auth.signOut();
  } catch (_) {
    // ignora
  }
  window.location.assign(rel('index.html'));
}

async function syncAuthUI() {
  const authLink = document.getElementById('auth-link');
  const logoutBtn = document.getElementById('logout-btn');

  const userPill = document.getElementById('user-pill');
  const userNameEl = document.getElementById('user-name');

  const navAuth = document.getElementById('nav-auth');
  const navAdmin = document.getElementById('nav-admin');
  const footerAuth = document.getElementById('footer-auth');

  // 1) sessão (segura)
  const { session } = await getSessionSafe();
  const isAuthed = !!session;

  // classe útil pro CSS se você quiser no futuro
  document.body.classList.toggle('is-authed', isAuthed);

  // Se página exige login e não está logado, manda pro login
  if (!isAuthed && needsAuth()) {
    window.location.assign(rel('login.html'));
    return;
  }

  // 2) estado DESLOGADO
  if (!isAuthed) {
    if (userPill) userPill.style.display = 'none';
    if (authLink) authLink.style.display = 'inline-flex';
    if (logoutBtn) logoutBtn.style.display = 'none';

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

    // Admin nunca aparece deslogado
    if (navAdmin) navAdmin.style.display = 'none';
    return;
  }

  // 3) estado LOGADO
  const email = session.user?.email || '';
  let displayName = getUserDisplayName(session) || email;

  // tenta pegar nome/role do profiles (se RLS permitir)
  const { profile } = await fetchMyProfile(session.user.id);

  const profileName =
    profile?.name && String(profile.name).trim()
      ? String(profile.name).trim()
      : '';
  if (profileName) displayName = profileName;

  if (userPill) {
    userPill.style.display = 'inline-flex';
    userPill.title = email || displayName || '';
  }
  if (userNameEl) userNameEl.textContent = displayName;

  // botão principal
  if (authLink) authLink.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'inline-flex';

  // menu horizontal vira "Sair"
  if (navAuth) {
    navAuth.textContent = 'Sair';
    navAuth.href = '#';
    navAuth.onclick = async (e) => {
      e.preventDefault();
      await doLogout();
    };
  }

  // rodapé vira "Sair"
  if (footerAuth) {
    footerAuth.textContent = 'Sair';
    footerAuth.href = '#';
    footerAuth.onclick = async (e) => {
      e.preventDefault();
      await doLogout();
    };
  }

  // botão sair (direita)
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await doLogout();
    };
  }

  // Admin: só mostra se confirmar role=admin (se não conseguir ler, fica oculto)
  const role = (profile?.role ?? '').toString().toLowerCase();
  const isAdmin = role === 'admin';
  if (navAdmin) navAdmin.style.display = isAdmin ? '' : 'none';
}

function watchAuthChanges() {
  try {
    supabase.auth.onAuthStateChange(() => {
      syncAuthUI();
    });
  } catch (_) {
    // se por algum motivo falhar, não derruba layout
  }
}

// Boot
renderHeaderFooter();
syncAuthUI();
watchAuthChanges();
