// assets/js/layout.js
import { supabase } from './supabaseClient.js';

const PROFILE_CACHE_KEY = 'ava_profile_v1';

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
  // defina <body data-page="home"> etc.
  return document.body.dataset.page || '';
}

function isAuthRequired() {
  return (document.body.dataset.auth || '').toLowerCase() === 'required';
}

function requiredRole() {
  // ex.: <body data-role="admin">
  return (document.body.dataset.role || '').trim();
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getCachedProfile(userId) {
  const raw = sessionStorage.getItem(PROFILE_CACHE_KEY);
  if (!raw) return null;
  const obj = safeJsonParse(raw);
  if (!obj?.id || obj.id !== userId) return null;
  return obj;
}

function setCachedProfile(profile) {
  sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
}

async function loadMyProfile(session) {
  const userId = session?.user?.id;
  const email = session?.user?.email || '';
  if (!userId) return null;

  const cached = getCachedProfile(userId);
  if (cached) return cached;

  // 1) tenta ler profiles
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, email')
    .eq('id', userId)
    .maybeSingle();

  if (!error && data) {
    const p = {
      id: data.id,
      full_name: data.full_name || '',
      role: data.role || 'aluno',
      email: data.email || email,
    };
    setCachedProfile(p);
    return p;
  }

  // 2) se não existir, tenta criar (depende das suas policies)
  const meta = session.user?.user_metadata || {};
  const fullName = (meta.full_name || meta.name || meta.nome || '').trim();

  const upsertPayload = {
    id: userId,
    email,
    full_name: fullName,
    role: 'aluno',
  };

  const up = await supabase
    .from('profiles')
    .upsert(upsertPayload)
    .select('*')
    .maybeSingle();

  if (!up.error && up.data) {
    const p = {
      id: up.data.id,
      full_name: up.data.full_name || fullName || '',
      role: up.data.role || 'aluno',
      email: up.data.email || email,
    };
    setCachedProfile(p);
    return p;
  }

  // 3) fallback: pelo menos devolve algo para o menu
  return {
    id: userId,
    full_name: fullName || '',
    role: 'aluno',
    email,
  };
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

            <a id="nav-login" class="navlink" href="${rel(
              'login.html'
            )}">Entrar</a>

            <a id="nav-app" class="navlink ${
              page === 'app' ? 'active' : ''
            }" href="${rel('app.html')}">Minha área</a>

            <a id="nav-admin" class="navlink ${
              page === 'admin' ? 'active' : ''
            }" href="${rel('admin.html')}" style="display:none;">
              Admin
            </a>
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
          <div>© ${new Date().getFullYear()} AVA • Protótipo</div>
          <div class="footer-links">
            <a href="${rel('index.html')}">Home</a>
            <a href="${rel('app.html')}">Minha área</a>
            <a id="footer-admin" href="${rel(
              'admin.html'
            )}" style="display:none;">Admin</a>
          </div>
        </div>
      </footer>
    `;
  }
}

function applyAuthUI(session, profile) {
  const authLink = document.getElementById('auth-link');
  const logoutBtn = document.getElementById('logout-btn');
  const userPill = document.getElementById('user-pill');
  const userEmail = document.getElementById('user-email');

  const navLogin = document.getElementById('nav-login');
  const navAdmin = document.getElementById('nav-admin');
  const footerAdmin = document.getElementById('footer-admin');

  if (!authLink || !logoutBtn) return;

  const email = session?.user?.email || '';
  const name = (profile?.full_name || '').trim();
  const pillText = name || email || 'sessão ativa';

  const role = (profile?.role || '').toLowerCase();

  if (session) {
    // botão principal vira “Ir para Minha área”
    authLink.href = rel('app.html');
    authLink.innerHTML = `<i class="bx bx-grid-alt"></i> Ir para Minha área`;

    logoutBtn.style.display = 'inline-flex';

    if (userPill && userEmail) {
      userPill.style.display = 'inline-flex';
      userEmail.textContent = pillText;
    }

    if (navLogin) navLogin.style.display = 'none';

    const canSeeAdmin = role === 'admin';
    if (navAdmin) navAdmin.style.display = canSeeAdmin ? 'inline-flex' : 'none';
    if (footerAdmin)
      footerAdmin.style.display = canSeeAdmin ? 'inline-flex' : 'none';
  } else {
    authLink.href = rel('login.html');
    authLink.innerHTML = `<i class="bx bx-log-in"></i> Entrar`;

    logoutBtn.style.display = 'none';
    if (userPill) userPill.style.display = 'none';
    if (navLogin) navLogin.style.display = 'inline-flex';

    if (navAdmin) navAdmin.style.display = 'none';
    if (footerAdmin) footerAdmin.style.display = 'none';
  }

  logoutBtn.onclick = async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem(PROFILE_CACHE_KEY);
    window.location.assign(rel('index.html'));
  };
}

function enforceGuards(session, profile) {
  // 1) auth required
  if (isAuthRequired() && !session) {
    window.location.assign(rel('login.html'));
    return false;
  }

  // 2) role required (ex.: admin)
  const needRole = requiredRole();
  if (needRole && session) {
    const role = (profile?.role || '').toLowerCase();
    if (role !== needRole.toLowerCase()) {
      // sem permissão: manda para a área padrão
      window.location.assign(rel('app.html'));
      return false;
    }
  }

  return true;
}

async function boot() {
  renderHeaderFooter();

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    // se der erro, deixa menu público mesmo
    applyAuthUI(null, null);
    return;
  }

  const session = data?.session || null;

  // carrega perfil (role) se logado
  const profile = session ? await loadMyProfile(session) : null;

  // guarda contexto global (útil para páginas internas)
  window.AVA = { session, profile };

  // protege páginas
  if (!enforceGuards(session, profile)) return;

  // aplica UI
  applyAuthUI(session, profile);
}

function watchAuthChanges() {
  supabase.auth.onAuthStateChange(() => boot());
}

// Boot
boot();
watchAuthChanges();
