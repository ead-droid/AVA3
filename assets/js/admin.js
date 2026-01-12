/* ARQUIVO: assets/admin.js */
import { supabase } from './supabaseClient.js';

// Elementos da tela
const statusEl = document.getElementById('admin-status');
const spinnerEl = document.getElementById('loading-spinner');
const dashboardEl = document.getElementById('admin-dashboard');

async function initAdminPage() {
  console.log('🚀 Iniciando Painel Admin...');

  try {
    // 1. Verifica Sessão
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = 'login.html';
      return;
    }

    // 2. Verifica Cargo (Role)
    // Usa .maybeSingle() para evitar erros vermelhos no console se não achar
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role, name')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      console.warn('Erro ao ler perfil:', error.message);
    }

    const role = profile?.role
      ? String(profile.role).toLowerCase().trim()
      : 'aluno';

    if (role !== 'admin') {
      statusEl.textContent = 'ACESSO NEGADO';
      statusEl.className = 'badge bg-danger';
      spinnerEl.innerHTML = `<h4 class="text-danger">Você não tem permissão.</h4><p>Redirecionando...</p>`;
      setTimeout(() => (window.location.href = 'dashboard.html'), 2000);
      return;
    }

    // 3. SUCESSO: É Admin
    statusEl.textContent = 'Admin Conectado';
    statusEl.className = 'badge bg-success';

    // Esconde spinner e mostra painel
    spinnerEl.style.display = 'none';
    dashboardEl.style.display = 'block';

    // 4. Carrega Dados (KPIs)
    loadCounts();
    loadLists();
  } catch (err) {
    console.error('Erro fatal no Admin:', err);
    statusEl.textContent = 'Erro de Sistema';
  }
}

async function loadCounts() {
  // Conta Cursos
  const { count: courses } = await supabase
    .from('courses')
    .select('*', { count: 'exact', head: true });
  document.getElementById('count-courses').textContent = courses || 0;

  // Conta Usuários
  const { count: users } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  document.getElementById('count-users').textContent = users || 0;
}

async function loadLists() {
  // Lista rápida de Cursos
  const { data: courses } = await supabase.from('courses').select('*').limit(5);
  const tbody = document.getElementById('table-courses');

  if (courses && courses.length > 0) {
    tbody.innerHTML = courses
      .map(
        (c) => `
            <tr>
                <td><strong>${c.title}</strong></td>
                <td><span class="badge bg-success">Ativo</span></td>
                <td><button class="btn btn-sm btn-light">Editar</button></td>
            </tr>
        `
      )
      .join('');
  } else {
    tbody.innerHTML =
      '<tr><td colspan="3" class="text-center text-muted">Nenhum curso encontrado.</td></tr>';
  }

  // Lista rápida de Usuários (só para preencher)
  const { data: users } = await supabase
    .from('profiles')
    .select('name, email, role')
    .limit(5);
  const tbodyUsers = document.getElementById('table-users');
  if (users) {
    tbodyUsers.innerHTML = users
      .map(
        (u) => `
            <tr>
                <td>${u.name || '-'}</td>
                <td>${u.email}</td>
                <td><span class="badge ${
                  u.role === 'admin' ? 'bg-danger' : 'bg-secondary'
                }">${u.role || 'aluno'}</span></td>
            </tr>
        `
      )
      .join('');
  }
}

// Inicia
initAdminPage();
