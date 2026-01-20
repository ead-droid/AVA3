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

async function initAdminPage() {
    console.log("🚀 Admin JS Iniciado");

    if (window.bootstrap) {
        // Inicializa Modais se o Bootstrap estiver carregado
        const mCourse = document.getElementById('modalCourse');
        if(mCourse) modalCourse = new window.bootstrap.Modal(mCourse);

        const mNewUser = document.getElementById('modalNewUser');
        if(mNewUser) modalNewUser = new window.bootstrap.Modal(mNewUser);

        const mEditUser = document.getElementById('modalEditUser');
        if(mEditUser) modalEditUser = new window.bootstrap.Modal(mEditUser);

        const mViewMsg = document.getElementById('modalViewMessage');
        if(mViewMsg) modalViewMsg = new window.bootstrap.Modal(mViewMsg);

        const mSiteConfig = document.getElementById('modalSiteConfig');
        if(mSiteConfig) modalSiteConfig = new window.bootstrap.Modal(mSiteConfig);
    }

    setupCourseForm();
    setupUserForms();
    setupUserSearch();
    setupSystemConfig();
    setupMessageResponse();

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { window.location.href = 'login.html'; return; }

        // Verifica perfil
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        const role = profile?.role ? String(profile.role).toLowerCase().trim() : 'aluno';

        if (role !== 'admin') {
            document.getElementById('admin-status').textContent = "Acesso Negado";
            document.getElementById('admin-status').className = "badge bg-danger";
            setTimeout(() => window.location.href = 'index.html', 1500); 
            return;
        }

        document.getElementById('admin-status').textContent = "Admin Conectado";
        document.getElementById('admin-status').className = "badge bg-success";
        document.getElementById('loading-spinner').style.display = 'none';
        document.getElementById('admin-dashboard').style.display = 'block';

        loadCounts();
        loadCourses();
        loadUsers(); 
        loadMessages();

    } catch (err) {
        console.error("Erro Admin:", err);
    }
}

// --- FUNÇÕES GLOBAIS DE NAVEGAÇÃO E MODAIS ---

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

// --- CORREÇÃO: Função para abrir o modal de Novo Curso ---
window.openNewCourseModal = function() {
    if (modalCourse) {
        document.getElementById('formCourse').reset(); // Limpa o formulário
        modalCourse.show();
    } else {
        console.error("Modal de curso não inicializado.");
    }
};

// =========================================================
// MÓDULO: MENSAGENS (FALE CONOSCO)
// =========================================================
async function loadMessages() {
    const tbody = document.getElementById('table-messages');
    const empty = document.getElementById('messages-empty');
    if(!tbody) return;

    tbody.innerHTML = '';
    
    const { data: msgs, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false });

    if(error) { empty.textContent = "Erro ao carregar mensagens."; return; }
    if(!msgs || msgs.length === 0) { empty.textContent = "Nenhuma mensagem recebida."; return; }

    empty.style.display = 'none';

    msgs.forEach(msg => {
        const tr = document.createElement('tr');
        const weight = msg.is_read ? 'normal' : 'bold';
        const bg = msg.is_read ? '' : 'bg-light';
        
        let statusBadge = `<span class="badge bg-secondary opacity-50 border me-1">${msg.status}</span>`;
        if (msg.status === 'aberto') statusBadge = `<span class="badge bg-primary me-1">ABERTO</span>`;
        else if (msg.status === 'respondido') statusBadge = `<span class="badge bg-success me-1">RESPONDIDO</span>`;
        else if (msg.status === 'fechado') statusBadge = `<span class="badge bg-secondary me-1">FECHADO</span>`;

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
    document.getElementById('msg-view-subject').textContent = msg.subject || 'Sem Assunto';
    document.getElementById('msg-view-name').textContent = msg.name;
    document.getElementById('msg-view-email').textContent = msg.email;
    document.getElementById('msg-view-date').textContent = new Date(msg.created_at).toLocaleString();
    document.getElementById('msg-view-content').textContent = msg.message;

    document.getElementById('msg_status').value = msg.status || 'aberto';
    document.getElementById('msg_admin_reply').value = msg.admin_reply || '';
    document.getElementById('msg-modal-alert').className = 'alert d-none';

    const btnDel = document.getElementById('btn-delete-msg-modal');
    btnDel.onclick = async () => {
        if(confirm("Excluir esta mensagem?")) {
            await supabase.from('contact_messages').delete().eq('id', msg.id);
            modalViewMsg.hide();
            loadMessages();
            loadCounts();
        }
    };

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
            alertBox.classList.remove('d-none');
            
            if (error) {
                alertBox.className = "alert alert-danger py-2 px-3 small";
                alertBox.textContent = "Erro: " + error.message;
            } else {
                alertBox.className = "alert alert-success py-2 px-3 small";
                alertBox.textContent = "Atendimento salvo com sucesso!";
                loadMessages(); 
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
    
    const { data, error } = await supabase.from('site_config').select('*').eq('id', 1).maybeSingle();
    if (data) {
        document.getElementById('conf_address').value = data.address || '';
        document.getElementById('conf_email_sup').value = data.email_support || '';
        document.getElementById('conf_email_com').value = data.email_commercial || '';
        document.getElementById('conf_whatsapp').value = data.whatsapp || '';
        document.getElementById('conf_map').value = data.map_url || '';
    }
};

// =========================================================
// MÓDULO: CURSOS
// =========================================================
function setupCourseForm() {
    const form = document.getElementById('formCourse');
    const titleInp = document.getElementById('course_title');
    const slugInp = document.getElementById('course_slug');

    if (titleInp && slugInp) {
        titleInp.addEventListener('input', () => {
            slugInp.value = titleInp.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newCourse = {
                title: document.getElementById('course_title').value,
                slug: document.getElementById('course_slug').value || null,
                description: document.getElementById('course_desc').value,
                total_hours: parseFloat(document.getElementById('course_hours').value) || null,
                carga_horaria_horas: parseFloat(document.getElementById('course_hours').value) || null,
                status: document.getElementById('course_status').value,
                tipo: document.getElementById('course_type').value,
                status_inscricao: document.getElementById('course_enroll_status').value,
                image_url: document.getElementById('course_img').value,
            };
            const { data: { user } } = await supabase.auth.getUser();
            if (user) newCourse.created_by = user.id;

            const { error } = await supabase.from('courses').insert(newCourse);
            if (error) alert("Erro: " + error.message);
            else {
                alert("Curso criado!");
                form.reset(); 
                modalCourse.hide();
                loadCounts(); 
                loadCourses(); 
            }
        });
    }
}

async function loadCourses() {
    const tbody = document.getElementById('table-courses');
    const template = document.getElementById('template-course-row'); 
    tbody.innerHTML = ''; 
    const { data: courses } = await supabase.from('courses').select('*').order('id', { ascending: false }).limit(20);
    if (courses) {
        courses.forEach(c => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.row-id').textContent = `#${c.id}`;
            clone.querySelector('.row-title').textContent = c.title;
            clone.querySelector('.row-subtitle').textContent = `${c.tipo || 'OUTRO'} • ${c.carga_horaria_horas || 0}h`;
            const badge = clone.querySelector('.row-status');
            badge.textContent = c.status === 'published' ? 'Publicado' : 'Rascunho';
            badge.className = `badge row-status ${c.status === 'published' ? 'bg-success' : 'bg-secondary'}`;
            clone.querySelector('.edit-btn').onclick = () => window.location.href = 'course-editor.html?id=' + c.id;
            tbody.appendChild(clone);
        });
    }
}

// =========================================================
// MÓDULO: USUÁRIOS
// =========================================================
function setupUserForms() {
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

            // Cliente Temporário para criar conta sem deslogar admin
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
                // Atualiza a role no banco
                await supabase.from('profiles').update({ role: role, name: name }).eq('id', data.user.id);
                alert(`Usuário cadastrado com sucesso!`);
                formNew.reset();
                modalNewUser.hide();
                loadUsers();
            }
            btn.disabled = false; btn.innerHTML = 'Cadastrar';
        });
    }

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
            else { alert("Salvo!"); modalEditUser.hide(); loadUsers(); }
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
    if(!confirm("⚠️ PERIGO: Tem certeza absoluta? Isso removerá o acesso do usuário.")) return;
    
    await supabase.from('class_enrollments').delete().eq('user_id', id);
    const { error } = await supabase.from('profiles').delete().eq('id', id);

    if (error) alert("Erro ao excluir: " + error.message);
    else { alert("Usuário removido."); loadUsers(document.getElementById('user-search-input').value); loadCounts(); }
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
    statusDiv.style.display = 'block';

    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
    if (term.length > 0) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);

    const { data: users, error } = await query;

    statusDiv.style.display = 'none';
    if (error || !users || users.length === 0) return;

    users.forEach(u => {
        const clone = tpl.content.cloneNode(true);
        const role = u.role || 'aluno';
        
        clone.querySelector('.user-name').textContent = u.name || '(Sem nome)';
        clone.querySelector('.user-id').textContent = u.id.substring(0,8) + '...';
        clone.querySelector('.user-email').textContent = u.email;
        
        const btnRole = clone.querySelector('.user-role-btn');
        btnRole.textContent = role.toUpperCase();
        
        if (role === 'admin') btnRole.classList.add('btn-dark');
        else if (role === 'professor') btnRole.classList.add('btn-outline-dark');
        else btnRole.classList.add('btn-outline-secondary');

        clone.querySelectorAll('.dropdown-item[data-value]').forEach(item => {
            item.onclick = (e) => { e.preventDefault(); changeGlobalRole(u.id, item.dataset.value); };
        });
        clone.querySelector('.btn-edit-user').onclick = () => window.openEditUserModal(u.id, u.name, role);
        clone.querySelector('.btn-delete-user').onclick = () => window.deleteUser(u.id);

        tbody.appendChild(clone);
    });
}

async function changeGlobalRole(userId, newRole) {
    if(!confirm(`Alterar para ${newRole.toUpperCase()}?`)) return;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) alert("Erro: " + error.message);
    else loadUsers(document.getElementById('user-search-input').value);
}

// =========================================================
// ESTATÍSTICAS
// =========================================================
async function loadCounts() {
    const { count: c } = await supabase.from('courses').select('*', { count: 'exact', head: true });
    const { count: u } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: m } = await supabase.from('contact_messages').select('*', { count: 'exact', head: true });
    const { count: cl } = await supabase.from('classes').select('*', { count: 'exact', head: true });
    
    if(document.getElementById('count-courses')) document.getElementById('count-courses').textContent = c || 0;
    if(document.getElementById('count-users')) document.getElementById('count-users').textContent = u || 0;
    if(document.getElementById('count-messages')) document.getElementById('count-messages').textContent = m || 0;
    if(document.getElementById('count-offers')) document.getElementById('count-offers').textContent = cl || 0;
}

initAdminPage();