import { supabase } from './supabaseClient.js';

/**
 * CONFIGURAÇÃO DE CAMINHOS
 * Verifique se o chrome.html está na pasta assets. 
 * Se estiver na mesma pasta que este JS, mude para './chrome.html'
 */
const LAYOUT_URL = './assets/chrome.html';

async function initChrome() {
  // 1. Cria os slots necessários no HTML da página antes de injetar
  ensureSlot('site-header');
  ensureSlot('site-sidebar');
  ensureSlot('site-footer');

  try {
    // 2. Busca o layout compartilhado
    const res = await fetch(LAYOUT_URL);
    if (!res.ok) throw new Error(`Não foi possível carregar o arquivo: ${LAYOUT_URL}`);
    
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    // 3. Injeta o conteúdo nos slots
    inject('site-header', doc, 'header');
    inject('site-sidebar', doc, 'sidebar');
    inject('site-footer', doc, 'footer');

    // 4. Configura as interações de UI (Menu sanduíche)
    document.body.classList.add('has-sidebar');
    setupSidebarToggle();

    // 5. Autenticação e Níveis de Acesso
    applyCachedRole(); // Mostra Admin instantaneamente se estiver no cache
    await checkAuth(); // Valida a sessão real com o Supabase

    // 6. Monitoramento em tempo real
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            localStorage.removeItem('ava3_role');
            window.location.href = 'login.html';
        } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            checkAuth();
        }
    });

  } catch (err) {
    console.error('Erro ao inicializar interface (Chrome):', err);
    // Fallback: se o fetch falhar, removemos travamentos visuais
    const header = document.getElementById('site-header');
    if (header) header.innerHTML = '<div style="padding:10px; color:red;">Erro ao carregar menu.</div>';
  }
}

/**
 * Gerencia a visibilidade de elementos baseado no papel do usuário salvo no navegador
 */
function applyCachedRole() {
    const cachedRole = localStorage.getItem('ava3_role');
    const adminLink = document.getElementById('link-admin');
    const adminGroup = document.getElementById('sidebar-admin-group');

    if (cachedRole === 'admin') {
        if (adminLink) adminLink.style.display = 'flex';
        if (adminGroup) adminGroup.style.display = 'block';
    }
}

/**
 * Validação principal de login e permissões
 */
async function checkAuth() {
  try {
    const nameEl = document.getElementById('user-name');
    const userPillContainer = document.getElementById('user-pill');
    const authActions = document.getElementById('auth-actions');
    const logoutBtn = document.getElementById('side-logout');
    const adminLink = document.getElementById('link-admin');
    const adminGroup = document.getElementById('sidebar-admin-group');

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      if (userPillContainer) userPillContainer.style.display = 'none';
      if (authActions) authActions.style.display = 'block';
      if (adminLink) adminLink.style.display = 'none';
      if (adminGroup) adminGroup.style.display = 'none';
      return;
    }

    // Usuário Logado
    if (authActions) authActions.style.display = 'none';
    if (userPillContainer) userPillContainer.style.display = 'flex';

    if (logoutBtn) {
      logoutBtn.style.display = 'flex';
      logoutBtn.onclick = async () => {
        localStorage.removeItem('ava3_role');
        await supabase.auth.signOut();
        window.location.href = 'login.html';
      };
    }

    // Busca perfil para definir Role
    const { data: rows } = await supabase
      .from('profiles')
      .select('name, role')
      .eq('id', session.user.id)
      .limit(1);

    const profile = rows?.[0];
    if (nameEl) nameEl.textContent = profile?.name || session.user.email;

    const role = profile?.role ? String(profile.role).toLowerCase().trim() : 'aluno';
    localStorage.setItem('ava3_role', role);

    if (role === 'admin') {
      if (adminLink) adminLink.style.display = 'flex';
      if (adminGroup) adminGroup.style.display = 'block';
    } else {
      if (adminLink) adminLink.style.display = 'none';
      if (adminGroup) adminGroup.style.display = 'none';
    }

  } catch (e) {
    console.error('Erro na verificação de autenticação:', e);
  }
}

/**
 * FUNÇÕES AUXILIARES DE INJEÇÃO
 */
function ensureSlot(id) {
  if (!document.getElementById(id)) {
    const div = document.createElement('div');
    div.id = id;
    if (id === 'site-footer') {
        document.body.appendChild(div);
    } else {
        document.body.insertBefore(div, document.body.firstChild);
    }
  }
}

function inject(id, doc, slotName) {
  const container = document.getElementById(id);
  const source = doc.querySelector(`[data-slot="${slotName}"]`);
  if (container && source) {
    container.innerHTML = source.innerHTML;
  }
}

function setupSidebarToggle() {
  const btn = document.getElementById('sidebar-toggle');
  if (btn) {
    btn.onclick = () => {
      document.body.classList.toggle('sidebar-collapsed');
    };
  }
}

// Inicia o processo
initChrome();