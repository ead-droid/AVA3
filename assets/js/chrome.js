import { supabase } from './supabaseClient.js';
import { goTo } from './router.js';

const LAYOUT_URL = './assets/chrome.html';

async function initChrome() {
  ensureSlot('site-header');
  ensureSlot('site-sidebar');
  ensureSlot('site-footer');

  try {
    const res = await fetch(LAYOUT_URL);
    if (!res.ok) throw new Error('Menu error');
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    inject('site-header', doc, 'header');
    inject('site-sidebar', doc, 'sidebar');
    inject('site-footer', doc, 'footer');

    // Restaura estado do menu (fechado/aberto)
    restoreState();

    // Inicia verificação de permissões
    checkAuth();
  } catch (err) {
    console.error(err);
  }
}

// === VERIFICAÇÃO DE LOGIN E PERMISSÃO (ADMIN) ===
async function checkAuth() {
  try {
    // 1. Pega a sessão atual
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const pill = document.getElementById('user-pill');
    const actions = document.getElementById('auth-actions');
    const nameEl = document.getElementById('user-name');
    const logoutBtn = document.getElementById('side-logout');

    // Links que devem ser protegidos
    const adminLink = document.getElementById('link-admin');
    const adminGroup = document.getElementById('sidebar-admin-group');

    if (session) {
      // --- USUÁRIO LOGADO ---

      // A. Ajusta visual (Esconde botão entrar, mostra perfil)
      if (pill) pill.style.display = 'flex';
      if (actions) actions.style.display = 'none';
      if (logoutBtn) {
        logoutBtn.style.display = 'flex';
        logoutBtn.onclick = async () => {
          await supabase.auth.signOut();
          goTo('login.html');
        };
      }

      // B. Define o Nome (Metadados ou Email)
      const meta = session.user.user_metadata || {};
      // Tenta 'full_name', 'name', ou parte do email
      const displayName =
        meta.full_name || meta.name || session.user.email.split('@')[0];
      if (nameEl) nameEl.textContent = displayName;

      // C. VERIFICA SE É ADMIN (Consulta no Banco)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      // Se o role for 'admin', mostra os links
      if (profile && profile.role === 'admin') {
        if (adminLink) adminLink.style.display = 'block';
        if (adminGroup) adminGroup.style.display = 'block';
      } else {
        // Garante que fiquem ocultos se não for admin
        if (adminLink) adminLink.style.display = 'none';
        if (adminGroup) adminGroup.style.display = 'none';
      }
    } else {
      // --- VISITANTE ---
      if (pill) pill.style.display = 'none';
      if (actions) actions.style.display = 'block'; // Botão Entrar visível
      if (adminLink) adminLink.style.display = 'none';
      if (adminGroup) adminGroup.style.display = 'none';
    }
  } catch (e) {
    console.warn('Erro ao verificar auth:', e);
  }
}

// === LÓGICA DE ABRIR/FECHAR MENU ===
document.addEventListener('click', (e) => {
  if (
    e.target.closest('#sidebar-toggle') ||
    e.target.closest('#sidebar-overlay')
  ) {
    const isMobile = window.innerWidth <= 900;
    const body = document.body;

    if (isMobile) {
      body.classList.toggle('sidebar-open');
    } else {
      body.classList.toggle('sidebar-collapsed');
      localStorage.setItem(
        'sidebar_collapsed',
        body.classList.contains('sidebar-collapsed')
      );
    }
  }
});

function restoreState() {
  if (window.innerWidth > 900) {
    const collapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    document.body.classList.add('has-sidebar');
    if (collapsed) document.body.classList.add('sidebar-collapsed');
  }
}

function ensureSlot(id) {
  if (!document.getElementById(id)) {
    const div = document.createElement('div');
    div.id = id;
    if (id === 'site-footer') document.body.appendChild(div);
    else document.body.insertBefore(div, document.body.firstChild);
  }
}

function inject(id, doc, slot) {
  const el = document.getElementById(id);
  const content = doc.querySelector(`[data-slot="${slot}"]`);
  if (el && content) el.innerHTML = content.innerHTML;
}

initChrome();
