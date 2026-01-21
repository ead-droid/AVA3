import { supabase } from './supabaseClient.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Globais para Modais
let modalCourse = null;
let modalNewUser = null;
let modalEditUser = null;
let modalViewMsg = null;
let modalSiteConfig = null;
let searchTimeout = null;
let currentMsgId = null;

// =========================================================
// INICIALIZAÇÃO E AUTENTICAÇÃO
// =========================================================
async function initAdminPage() {
    console.log("🚀 Admin JS Iniciado");

    // Inicializa Modais do Bootstrap se disponível
    if (window.bootstrap) {
        const getModal = (id) => {
            const el = document.getElementById(id);
            return el ? new window.bootstrap.Modal(el) : null;
        };

        modalCourse = getModal('modalCourse');
        modalNewUser = getModal('modalNewUser');
        modalEditUser = getModal('modalEditUser');
        modalViewMsg = getModal('modalViewMessage');
        modalSiteConfig = getModal('modalSiteConfig');
    }

    // Configura Listeners de Formulários
    setupCourseForm();
    setupUserForms();
    setupUserSearch();
    setupSystemConfig();
    setupMessageResponse();

    try {
        // Verifica Sessão
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { window.location.href = 'login.html'; return; }

        // Verifica Permissão de Admin
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        const role = profile?.role ? String(profile.role).toLowerCase().trim() : 'aluno';

        if (role !== 'admin') {
            const statusEl = document.getElementById('admin-status');
            if(statusEl) {
                statusEl.textContent = "Acesso Negado";
                statusEl.className = "badge bg-danger";
            }
            setTimeout(() => window.location.href = 'index.html', 1500); 
            return;
        }

        // Libera Interface
        const statusEl = document.getElementById('admin-status');
        if(statusEl) {
            statusEl.textContent = "Admin Conectado";
            statusEl.className = "badge bg-success";
        }

        const spinner = document.getElementById('loading-spinner');
        if(spinner) spinner.style.display = 'none';
        
        const dashboard = document.getElementById('admin-dashboard');
        if(dashboard) dashboard.style.display = 'block';

        // Carrega Dados Iniciais
        loadCounts();
        loadCourses();
        loadUsers(); 
        loadMessages();

    } catch (err) {
        console.error("Erro Admin:", err);
    }
}

// =========================================================
// NAVEGAÇÃO DE PAINÉIS
// =========================================================
window.showPanel = function(panelId) {
    document.querySelectorAll('.admin-panel').forEach(el => el.style.display = 'none');
    
    const target = document.getElementById('panel-' + panelId);
    if(target) target.style.display = 'block';
    
    const titles = { 
        'courses': 'Gerenciar Cursos', 
        'users': 'Gerenciar Usuários', 
        'offers': 'Gerenciar Turmas',
        'messages': 'Mensagens Recebidas'
    };
    
    const titleEl = document.getElementById('panel-title');
    if(titleEl) titleEl.textContent = titles[panelId] || 'Visão Geral';
};

// =========================================================
// MÓDULO: CURSOS (Criação e Listagem)
// =========================================================

// Abre o Modal de Novo Curso (Limpo)
window.openNewCourseModal = function() {
    if (modalCourse) {
        const form = document.getElementById('formCourse');
        if(form) form.reset();
        
        // Garante que o slug esteja limpo
        const slugInp = document.getElementById('course_slug');
        if(slugInp) slugInp.value = "";

        modalCourse.show();
    } else {
        alert("Erro: Modal de curso não carregado.");
    }
};

// Configura o formulário de criação
function setupCourseForm() {
    const form = document.getElementById('formCourse');
    const titleInp = document.getElementById('course_title');
    const slugInp = document.getElementById('course_slug');

    // Gera Slug automático
    if (titleInp && slugInp) {
        titleInp.addEventListener('input', () => {
            slugInp.value = titleInp.value.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const getVal = (id) => document.getElementById(id)?.value || null;
            
            // Tratamento de valores numéricos
            let horas = parseFloat(getVal('course_hours'));
            if(isNaN(horas)) horas = null;

            // Objeto do Curso
            const newCourse = {
                title: getVal('course_title'),
                slug: getVal('course_slug'),
                description: getVal('course_desc'),
                total_hours: horas,
                carga_horaria_horas: horas, // Duplicado para compatibilidade
                status: getVal('course_status') || 'draft',
                tipo: getVal('course_type') || 'LIVRE',
                status_inscricao: getVal('course_enroll_status') || 'FECHADO',
                image_url: getVal('course_img'),
            };

            // Normaliza status antigo para novo padrão
            if (newCourse.status === 'draft') newCourse.status = 'EM_CONSTRUCAO';
            if (newCourse.status === 'published') newCourse.status = 'CONCLUIDO';

            const { data: { user } } = await supabase.auth.getUser();
            if (user) newCourse.created_by = user.id;

            const { error } = await supabase.from('courses').insert(newCourse);
            
            if (error) {
                alert("Erro ao criar curso: " + error.message);
            } else {
                alert("Curso criado com sucesso!");
                form.reset(); 
                modalCourse.hide();
                loadCounts(); 
                loadCourses(); 
            }
        });
    }
}

// Carrega a tabela de cursos
async function loadCourses() {
    const tbody = document.getElementById('table-courses');
    const template = document.getElementById('template-course-row'); 
    
    if (!tbody || !template) return;

    tbody.innerHTML = ''; 
    
    // Busca os cursos (limite de 50 para performance)
    const { data: courses, error } = await supabase
        .from('courses')
        .select('*')
        .order('id', { ascending: false })
        .limit(50);

    if (error) {
        console.error("Erro SQL:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-3">Erro ao carregar lista de cursos.</td></tr>';
        return;
    }

    if (courses && courses.length > 0) {
        courses.forEach(c => {
            const clone = template.content.cloneNode(true);
            
            clone.querySelector('.row-id').textContent = `#${c.id}`;
            clone.querySelector('.row-title').textContent = c.title;
            
            const carga = c.total_hours || c.carga_horaria_horas || 0;
            const tipo = c.tipo || 'LIVRE';
            clone.querySelector('.row-subtitle').textContent = `${tipo} • ${carga}h`;
            
            // Badge de Status
            let statusLabel = 'Rascunho';
            let statusClass = 'bg-secondary';
            const st = (c.status || '').toUpperCase();
            
            if (st === 'PUBLISHED' || st === 'CONCLUIDO') {
                statusLabel = 'Publicado';
                statusClass = 'bg-success';
            } else if (st === 'CANCELADO') {
                statusLabel = 'Cancelado';
                statusClass = 'bg-danger';
            } else {
                statusLabel = 'Em Construção'; 
                statusClass = 'bg-warning text-dark';
            }

            const badge = clone.querySelector('.row-status');
            badge.textContent = statusLabel;
            badge.className = `badge row-status rounded-pill ${statusClass}`;
            
            // --- AÇÃO DE EDIÇÃO (IMPORTANTE) ---
            const editBtn = clone.querySelector('.edit-btn');
            editBtn.title = "Editar Conteúdo do Curso";
            
            // Redireciona para o course-editor.html com o ID correto
            editBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                window.location.href = `course-editor.html?id=${c.id}`;
            };

            tbody.appendChild(clone);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Nenhum curso encontrado.</td></tr>';
    }
}

// =========================================================
// MÓDULO: USUÁRIOS (Criar, Editar, Excluir)
// =========================================================

function setupUserForms() {
    // Form Novo Usuário
    const formNew = document.getElementById('formNewUser');
    if(formNew) {
        formNew.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.submitter;
            btn.disabled = true; btn.innerHTML = 'Criando...';

            const name = document.getElementById('new_user_name').value.trim();
            const email = document.getElementById('new_user_email').value.trim();
            const password = document.getElementById('new_user_password').value;
            const role = document.getElementById('new_user_role').value;

            // Usa cliente separado para não deslogar o admin atual
            const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data, error } = await tempClient.auth.signUp({
                email, password,
                options: { data: { full_name: name } }
            });

            if(error) {
                alert("Erro ao criar conta: " + error.message);
                btn.disabled = false; btn.innerHTML = 'Cadastrar';
                return;
            }

            if(data.user) {
                // Atualiza perfil com a role correta
                await supabase.from('profiles').update({ role: role, name: name }).eq('id', data.user.id);
                alert(`Usuário cadastrado com sucesso!`);
                formNew.reset();
                modalNewUser.hide();
                loadUsers();
                loadCounts();
            }
            btn.disabled = false; btn.innerHTML = 'Cadastrar';
        });
    }

    // Form Editar Usuário
    const formEdit = document.getElementById('formEditUser');
    if(formEdit) {
        formEdit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('edit_user_id').value;
            const updates = {
                name: document.getElementById('edit_user_name').value,
                role: document.getElementById('edit_user_role').value
            };
            const { error } = await supabase.from('profiles').update(updates).eq('id', id);
            if(error) alert("Erro: " + error.message);
            else { 
                alert("Usuário atualizado!"); 
                modalEditUser.hide(); 
                loadUsers(); 
            }
        });
    }
}

window.openNewUserModal = function() {
    document.getElementById('formNewUser').reset();
    if(modalNewUser) modalNewUser.show();
};

window.openEditUserModal = function(id, name, role) {
    document.getElementById('edit_user_id').value = id;
    document.getElementById('edit_user_name').value = name;
    document.getElementById('edit_user_role').value = role;
    document.getElementById('edit_user_uid').value = id;
    if(modalEditUser) modalEditUser.show();
};

window.deleteUser = async function(id) {
    if(!confirm("⚠️ PERIGO: Isso removerá o acesso do usuário e histórico de matrículas. Continuar?")) return;
    
    // Remove matrículas primeiro (foreign key)
    await supabase.from('class_enrollments').delete().eq('user_id', id);
    const { error } = await supabase.from('profiles').delete().eq('id', id);

    if (error) alert("Erro ao excluir: " + error.message);
    else { 
        alert("Usuário removido."); 
        loadUsers(document.getElementById('user-search-input').value); 
        loadCounts(); 
    }
};

function setupUserSearch() {
    const input = document.getElementById('user-search-input');
    if(!input) return;
    input.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => { loadUsers(e.target.value); }, 500);
    });
}

async function loadUsers(term = '') {
    const tbody = document.getElementById('table-users');
    const statusDiv = document.getElementById('users-loading-status');
    const tpl = document.getElementById('template-user-row');
    
    if(!tbody) return;
    tbody.innerHTML = '';
    if(statusDiv) statusDiv.style.display = 'block';

    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
    
    // Filtro de busca
    if (term.length > 0) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);

    const { data: users, error } = await query;

    if(statusDiv) statusDiv.style.display = 'none';
    if (error || !users || users.length === 0) return;

    users.forEach(u => {
        const clone = tpl.content.cloneNode(true);
        const role = u.role || 'aluno';
        
        clone.querySelector('.user-name').textContent = u.name || '(Sem nome)';
        clone.querySelector('.user-id').textContent = u.id.substring(0,8) + '...';
        clone.querySelector('.user-email').textContent = u.email;
        
        // Botão de Role
        const btnRole = clone.querySelector('.user-role-btn');
        btnRole.textContent = role.toUpperCase();
        
        if (role === 'admin') btnRole.classList.add('btn-dark');
        else if (role === 'professor') btnRole.classList.add('btn-outline-dark');
        else btnRole.classList.add('btn-outline-secondary');

        // Dropdown de troca rápida de perfil
        clone.querySelectorAll('.dropdown-item[data-value]').forEach(item => {
            item.onclick = (e) => { e.preventDefault(); changeGlobalRole(u.id, item.dataset.value); };
        });
        
        // Ações
        clone.querySelector('.btn-edit-user').onclick = () => window.openEditUserModal(u.id, u.name, role);
        clone.querySelector('.btn-delete-user').onclick = () => window.deleteUser(u.id);

        tbody.appendChild(clone);
    });
}

async function changeGlobalRole(userId, newRole) {
    if(!confirm(`Alterar perfil para ${newRole.toUpperCase()}?`)) return;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) alert("Erro: " + error.message);
    else loadUsers(document.getElementById('user-search-input').value);
}

// =========================================================
// MÓDULO: MENSAGENS (Fale Conosco)
// =========================================================
async function loadMessages() {
    const tbody = document.getElementById('table-messages');
    const empty = document.getElementById('messages-empty');
    if(!tbody) return;

    tbody.innerHTML = '';
    
    const { data: msgs, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false });

    if(error) { if(empty) empty.textContent = "Erro ao carregar."; return; }
    if(!msgs || msgs.length === 0) { if(empty) empty.textContent = "Nenhuma mensagem."; return; }

    if(empty) empty.style.display = 'none';

    msgs.forEach(msg => {
        const tr = document.createElement('tr');
        const weight = msg.is_read ? 'normal' : 'bold';
        const bg = msg.is_read ? '' : 'bg-light';
        
        let statusBadge = `<span class="badge bg-secondary opacity-50 border me-1">${msg.status}</span>`;
        if (msg.status === 'aberto') statusBadge = `<span class="badge bg-primary me-1">ABERTO</span>`;
        else if (msg.status === 'respondido') statusBadge = `<span class="badge bg-success me-1">RESPONDIDO</span>`;

        tr.className = `${bg}`;
        tr.innerHTML = `
            <td class="ps-4 text-muted small" style="width: 120px;">${new Date(msg.created_at).toLocaleDateString()}</td>
            <td style="font-weight: ${weight}"><div>${msg.name}</div><small class="text-muted">${msg.email}</small></td>
            <td style="font-weight: ${weight}">
                ${statusBadge}
                ${msg.is_read ? '' : '<span class="badge bg-danger ms-1">Nova</span>'}
                <div class="small text-muted text-truncate" style="max-width: 250px;">${msg.subject}</div>
            </td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-primary rounded-circle btn-view-msg" title="Ler"><i class='bx bx-envelope-open'></i></button>
            </td>
        `;
        tr.querySelector('.btn-view-msg').onclick = () => openMessageModal(msg);
        tbody.appendChild(tr);
    });
}

function openMessageModal(msg) {
    currentMsgId = msg.id;
    const setText = (id, txt) => { const el = document.getElementById(id); if(el) el.textContent = txt; };
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };

    setText('msg-view-subject', msg.subject || 'Sem Assunto');
    setText('msg-view-name', msg.name);
    setText('msg-view-email', msg.email);
    setText('msg-view-date', new Date(msg.created_at).toLocaleString());
    setText('msg-view-content', msg.message);

    setVal('msg_status', msg.status || 'aberto');
    setVal('msg_admin_reply', msg.admin_reply || '');
    
    const alertBox = document.getElementById('msg-modal-alert');
    if(alertBox) alertBox.className = 'alert d-none';

    const btnDel = document.getElementById('btn-delete-msg-modal');
    if(btnDel) {
        btnDel.onclick = async () => {
            if(confirm("Excluir esta mensagem?")) {
                await supabase.from('contact_messages').delete().eq('id', msg.id);
                modalViewMsg.hide();
                loadMessages();
                loadCounts();
            }
        };
    }

    if(!msg.is_read) {
        supabase.from('contact_messages').update({ is_read: true }).eq('id', msg.id).then(() => loadMessages());
    }

    if(modalViewMsg) modalViewMsg.show();
}

function setupMessageResponse() {
    const btn = document.getElementById('btn-save-attendance');
    if(btn) {
        btn.onclick = async () => {
            if(!currentMsgId) return;
            btn.disabled = true; btn.innerHTML = 'Salvando...';

            const status = document.getElementById('msg_status').value;
            const reply = document.getElementById('msg_admin_reply').value;

            const { error } = await supabase.from('contact_messages').update({
                status: status,
                admin_reply: reply,
                is_read: true
            }).eq('id', currentMsgId);

            btn.disabled = false; btn.innerHTML = "<i class='bx bx-message-square-check'></i> Salvar Atendimento";

            const alertBox = document.getElementById('msg-modal-alert');
            if(alertBox) {
                alertBox.classList.remove('d-none');
                if (error) {
                    alertBox.className = "alert alert-danger py-2 px-3 small";
                    alertBox.textContent = "Erro: " + error.message;
                } else {
                    alertBox.className = "alert alert-success py-2 px-3 small";
                    alertBox.textContent = "Salvo com sucesso!";
                    loadMessages(); 
                }
            }
        };
    }
}

// =========================================================
// MÓDULO: CONFIGURAÇÕES DO SITE
// =========================================================
function setupSystemConfig() {
    const form = document.getElementById('formSiteConfig');
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const updates = {
                address: document.getElementById('conf_address').value,
                email_support: document.getElementById('conf_email_sup').value,
                email_commercial: document.getElementById('conf_email_com').value,
                whatsapp: document.getElementById('conf_whatsapp').value,
                map_url: document.getElementById('conf_map').value,
                updated_at: new Date()
            };
            
            const { error } = await supabase.from('site_config').upsert({ id: 1, ...updates });
            
            if (error) alert("Erro ao salvar: " + error.message);
            else {
                alert("Configurações atualizadas!");
                modalSiteConfig.hide();
            }
        });
    }
}

window.openSiteConfig = async function() {
    if(modalSiteConfig) modalSiteConfig.show();
    
    const { data } = await supabase.from('site_config').select('*').eq('id', 1).maybeSingle();
    if (data) {
        const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
        setVal('conf_address', data.address || '');
        setVal('conf_email_sup', data.email_support || '');
        setVal('conf_email_com', data.email_commercial || '');
        setVal('conf_whatsapp', data.whatsapp || '');
        setVal('conf_map', data.map_url || '');
    }
};

// =========================================================
// ESTATÍSTICAS E CONTAGENS
// =========================================================
async function loadCounts() {
    const { count: c } = await supabase.from('courses').select('*', { count: 'exact', head: true });
    const { count: u } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: m } = await supabase.from('contact_messages').select('*', { count: 'exact', head: true });
    const { count: cl } = await supabase.from('classes').select('*', { count: 'exact', head: true });
    
    const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val || 0; };
    setText('count-courses', c);
    setText('count-users', u);
    setText('count-messages', m);
    setText('count-offers', cl);
}

// Inicializa tudo
initAdminPage();