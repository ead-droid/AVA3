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

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
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

  // tenta ler profiles (se existir)
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, email')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      const p = {
        id: data.id,
        full_name: data.full_name || '',
        role: (data.role || 'aluno').toLowerCase(),
        email: data.email || email,
      };
      setCachedProfile(p);
      return p;
    }
  } catch (_) {
    // se tabela não existir/sem permissão, cai no fallback
  }

  // fallback (não quebra o menu)
  const meta = session.user?.user_metadata || {};
  const fullName = (meta.full_name || meta.name || meta.nome || '').trim();

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
            <a class="navlink ${page === 'home' ? 'active' : ''}" href="${rel('index.html')}">Início</a>
            <a id="nav-login" class="navlink ${page === 'login' ? 'active' : ''}" href="${rel('login.html')}">Entrar</a>
            <a id="nav-app" class="navlink ${page === 'app' ? 'active' : ''}" href="${rel('app.html')}">Minha área</a>

            <!-- Admin (visível só para role admin/staff via JS) -->
            <a id="nav-admin" class="navlink ${page === 'admin' ? 'active' : ''}" href="${rel('admin.html')}" style="display:none;">
              Admin
            </a>
          </nav>

          <div class="right">
            <button id="sidebar-toggle" class="btn icon" style="display:none;" aria-label="Abrir menu lateral">
              <i class="bx bx-menu"></i>
            </button>

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
          <div>© ${new Date().getFullYear()} AVA</div>
          <div class="footer-links">
            <a href="${rel('index.html')}">Home</a>
            <a href="${rel('app.html')}">Minha área</a>
            <a id="footer-admin" href="${rel('admin.html')}" style="display:none;">Admin</a>
          </div>
        </div>
      </footer>
    `;
  }

  // cria sidebar (uma vez) — fica fixa via CSS
  if (!document.getElementById('side-nav')) {
    const aside = document.createElement('aside');
    aside.id = 'side-nav';
    aside.className = 'side-nav';
    document.body.insertBefore(aside, document.body.firstChild);
  }
}

function renderSidebar(session, profile) {
  const aside = document.getElementById('side-nav');
  if (!aside) return;

  const page = getActivePage();
  const role = (profile?.role || '').toLowerCase();
  const canSeeAdmin = role === 'admin' || role === 'staff';

  const email = session?.user?.email || '';
  const name = (profile?.full_name || '').trim();
  const who = name || email || 'Usuário';

  aside.innerHTML = `
    <div class="side-title">
      <i class="bx bx-layer"></i> <span>Menu</span>
    </div>
    <div class="side-sub">${who}${role ? ` • ${role}` : ''}</div>

    <div class="side-links">
      <a class="side-link ${page === 'home' ? 'active' : ''}" href="${rel('index.html')}">
        <i class="bx bx-home"></i> Início
      </a>

      <a class="side-link ${page === 'app' ? 'active' : ''}" href="${rel('app.html')}">
        <i class="bx bx-grid-alt"></i> Minha área
      </a>

      <a id="side-admin" class="side-link ${page === 'admin' ? 'active' : ''}" href="${rel('admin.html')}" style="display:${canSeeAdmin ? 'flex' : 'none'};">
        <i class="bx bx-shield-quarter"></i> Admin
      </a>

      <div class="side-divider"></div>

      <button id="side-logout" class="side-link" type="button">
        <i class="bx bx-log-out"></i> Sair
      </button>
    </div>
  `;
}

function bindSidebarHandlers() {
  const toggle = document.getElementById('sidebar-toggle');

  if (toggle) {
    toggle.onclick = () => {
      document.body.classList.toggle('sidebar-open');
    };
  }

  // fecha ao clicar no overlay (mobile)
  document.addEventListener('click', (e) => {
    if (!document.body.classList.contains('sidebar-open')) return;

    const aside = document.getElementById('side-nav');
    const t = document.getElementById('sidebar-toggle');

    // se clicou dentro da sidebar ou no botão toggle, não fecha
    if (aside && aside.contains(e.target)) return;
    if (t && t.contains(e.target)) return;

    // qualquer clique fora fecha
    document.body.classList.remove('sidebar-open');
  });

  // fecha com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.body.classList.remove('sidebar-open');
  });
}

async function
