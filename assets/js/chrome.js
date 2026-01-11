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

    // Estado inicial
    document.body.classList.add('has-sidebar');
    restoreState();

    // Inicia verificação de login
    checkAuth();
  } catch (err) {
    console.error(err);
  }
}

// === TOGGLE E RESTAURAÇÃO ===
document.addEventListener('click', (e) => {
  if (
    e.target.closest('#sidebar-toggle') ||
    e.target.closest('#sidebar-overlay')
  ) {
    const isMobile = window.innerWidth <= 900;
    if (isMobile) {
      document.body.classList.toggle('sidebar-open');
    } else {
      document.body.classList.toggle('sidebar-collapsed');
      localStorage.setItem(
        'sidebar_collapsed',
        document.body.classList.contains('sidebar-collapsed')
      );
    }
  }
});

function restoreState() {
  if (window.innerWidth > 900) {
    const collapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (collapsed) document.body.classList.add('sidebar-collapsed');
  }
}

// === AUTH (AQUI ESTÁ A CORREÇÃO DO NOME) ===
async function checkAuth() {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;

    const pill = document.getElementById('user-pill');
    const actions = document.getElementById('auth-actions');
    const nameEl = document.getElementById('user-name');
    const logoutBtn = document.getElementById('side-logout');
    const adminLink = document.getElementById('link-admin');
    const adminGroup = document.getElementById('sidebar-admin-group');

    if (session) {
      // 1. Mostrar interface de logado
      if (pill) pill.style.display = 'flex';
      if (actions) actions.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'flex';

      // 2. Definir o Nome (Tenta metadados, senão email)
      const fullName = session.user.user_metadata?.full_name;
      const emailName = session.user.email.split('@')[0];
      const displayName = fullName || emailName || 'Usuário';

      // Força a atualização do texto
      if (nameEl) nameEl.textContent = displayName;

      // 3. Ações de Admin (Exemplo)
      if (adminLink) adminLink.style.display = 'block';
      if (adminGroup) adminGroup.style.display = 'block';

      // 4. Logout
      if (logoutBtn) {
        logoutBtn.onclick = async () => {
          await supabase.auth.signOut();
          goTo('login.html');
        };
      }
    } else {
      // Visitante
      if (pill) pill.style.display = 'none';
      if (actions) actions.style.display = 'block';
    }
  } catch (e) {
    console.warn('Auth check failed:', e);
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
