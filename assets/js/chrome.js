import { supabase } from './supabaseClient.js';
import { goTo } from './router.js';

const LAYOUT_URL = './assets/chrome.html';

async function initChrome() {
  ensureSlot('site-header');
  ensureSlot('site-sidebar');
  ensureSlot('site-footer');

  try {
    const res = await fetch(LAYOUT_URL);
    if (!res.ok) throw new Error('Falha ao carregar menu');
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    inject('site-header', doc, 'header');
    inject('site-sidebar', doc, 'sidebar');
    inject('site-footer', doc, 'footer');

    document.body.classList.add('has-sidebar');
    restoreState();

    // Verificação de auth
    await checkAuth();

    supabase.auth.onAuthStateChange(() => checkAuth());
  } catch (err) {
    console.error('Erro no Chrome:', err);
  }
}

async function checkAuth() {
  try {
    // Busca elementos
    const nameEl = document.getElementById('user-name');
    const pillEl = document.getElementById('user-pill');
    const userPillContainer = document.getElementById('user-pill'); // O container do header
    const authActions = document.getElementById('auth-actions');

    // Elementos do Admin (IDs baseados no seu chrome.html)
    const adminLink = document.getElementById('link-admin');
    const adminGroup = document.getElementById('sidebar-admin-group');
    const logoutBtn = document.getElementById('side-logout');

    // 1. Reseta estado (Esconde Admin e Botão Sair por segurança)
    if (adminLink) adminLink.style.display = 'none';
    if (adminGroup) adminGroup.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';

    // 2. Verifica Sessão
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (!session) {
      // Visitante
      if (userPillContainer) userPillContainer.style.display = 'none';
      if (authActions) authActions.style.display = 'block';
      return;
    }

    // --- USUÁRIO LOGADO ---
    if (authActions) authActions.style.display = 'none';
    if (userPillContainer) userPillContainer.style.display = 'flex';

    // Libera botão sair
    if (logoutBtn) {
      logoutBtn.style.display = 'flex';
      logoutBtn.onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
      };
    }

    // 3. Busca Perfil no Banco
    const { data: rows, error: dbError } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('id', session.user.id)
      .limit(1);

    if (dbError) console.warn('Erro ao ler perfil:', dbError.message);

    const profile = rows?.[0];

    // Atualiza nome
    const displayName = profile?.name || session.user.email;
    if (nameEl) nameEl.textContent = displayName;

    // --- VERIFICAÇÃO DE ADMIN ---
    // Normaliza para minúsculo e remove espaços
    const roleRaw = profile?.role;
    const role = roleRaw ? String(roleRaw).toLowerCase().trim() : 'aluno';

    console.log(`[Auth] Usuário: ${session.user.email} | Cargo: "${role}"`);

    if (role === 'admin') {
      console.log('✅ Acesso Admin Liberado');

      // Mostra itens do menu
      if (adminLink) adminLink.style.display = 'flex'; // Link topo
      if (adminGroup) adminGroup.style.display = 'block'; // Grupo lateral
    }
  } catch (e) {
    console.error('Erro no checkAuth:', e);
  }
}

// Funções Auxiliares (Mantidas idênticas para preservar layout)
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
  const btn = document.getElementById('sidebar-toggle');
  if (btn)
    btn.onclick = () => document.body.classList.toggle('sidebar-collapsed');
}

initChrome();
