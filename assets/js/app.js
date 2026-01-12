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

    document.body.classList.add('has-sidebar');
    restoreState();

    await checkAuth(); // Checa permissão

    supabase.auth.onAuthStateChange(() => checkAuth());
  } catch (err) {
    console.error(err);
  }
}

async function checkAuth() {
  try {
    // 1. Pega elementos com segurança (evita o erro TypeError)
    const nameEl = document.getElementById('user-name');
    const adminLink = document.getElementById('link-admin'); // Link do topo
    const adminGroup = document.getElementById('sidebar-admin-group'); // Link lateral

    // 2. Esconde Admin por padrão
    if (adminLink) adminLink.style.display = 'none';
    if (adminGroup) adminGroup.style.display = 'none';

    const {
      data: { session },
      error: sessErr,
    } = await supabase.auth.getSession();
    if (sessErr || !session) return;

    // 3. Atualiza nome na tela (COM PROTEÇÃO)
    if (nameEl) nameEl.textContent = session.user.email;

    // 4. Busca Role no Banco
    const { data: rows, error } = await supabase
      .from('profiles')
      .select('role, name')
      .eq('id', session.user.id)
      .limit(1);

    const profile = rows && rows.length > 0 ? rows[0] : null;

    if (profile) {
      // Atualiza nome se tiver
      if (nameEl && profile.name) nameEl.textContent = profile.name;

      // VERIFICAÇÃO DE ADMIN
      const role = String(profile.role || '')
        .trim()
        .toLowerCase();
      console.log('Cargo do usuário:', role);

      if (role === 'admin') {
        console.log('LIGANDO MODO ADMIN');
        if (adminLink) adminLink.style.display = 'block'; // Mostra botão
        if (adminGroup) adminGroup.style.display = 'block'; // Mostra menu lateral

        // Ativa cliques
        if (adminLink) wireLink(adminLink);
      }
    }
  } catch (e) {
    console.error('Erro no Auth:', e);
  }
}

function wireLink(el) {
  el.addEventListener('click', (e) => {
    // Garante navegação
    window.location.href = el.href;
  });
}

// Funções auxiliares de layout
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
function restoreState() {
  /* Lógica do menu lateral... */
}

initChrome();
