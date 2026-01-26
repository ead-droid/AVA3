import { supabase } from './supabaseClient.js';

// =========================================================
// GLOBAIS
// =========================================================
let modalCourse = null;
let modalNewUser = null;
let modalEditUser = null;
let modalViewMsg = null;
let modalSiteConfig = null;
let searchTimeout = null;
let currentMsgId = null;

// =========================================================
// INICIALIZAÇÃO
// =========================================================
async function initAdminPage() {
    console.log("🚀 Admin JS Iniciado (Com contadores corrigidos)");

    initializeModals();
    setupCourseForm();
    setupUserForms();
    setupUserSearch();
    setupSystemConfig();
    setupMessageResponse();

    try {
        // 1. Verifica Sessão
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { window.location.href = 'login.html'; return; }

        // 2. Verifica Permissão
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        const role = profile?.role ? String(profile.role).toLowerCase().trim() : 'aluno';

        if (role !== 'admin') {
            alert("Acesso Negado: Apenas administradores.");
            window.location.href = 'index.html';
            return;
        }

        // 3. Libera Painel
        const adminStatus = document.getElementById('admin-status');
        if(adminStatus) {
            adminStatus.textContent = "Admin Conectado";
            adminStatus.className = "badge bg-success";
        }
        
        const spinner = document.getElementById('loading-spinner');
        if(spinner) spinner.style.display = 'none';
        
        const dashboard = document.getElementById('admin-dashboard');
        if(dashboard) dashboard.style.display = 'block';

        // 4. Carrega Dados
        loadCounts();
        loadCourses();
        loadUsers(); 
        loadMessages();

    } catch (err) {
        console.error("Erro Fatal Admin:", err);
        const spinner = document.getElementById('loading-spinner');
        if(spinner) spinner.style.display = 'none';
    }
}

// Inicializa os Modais do Bootstrap
function initializeModals() {
    if (window.bootstrap) {
        const getModal = (id) => {
            const el = document.getElementById(id);
            return el ? (window.bootstrap.Modal.getInstance(el) || new window.bootstrap.Modal(el)) : null;
        };
        modalCourse = getModal('modalCourse');
        modalNewUser = getModal('modalNewUser');
        modalEditUser = getModal('modalEditUser');
        modalViewMsg = getModal('modalViewMessage');
        modalSiteConfig = getModal('modalSiteConfig');
    }
}

// =========================================================
// NAVEGAÇÃO
// =========================================================
window.showPanel = function(panelId) {
    document.querySelectorAll('.admin-panel').forEach(el => el.style.display = 'none');
    const target = document.getElementById('panel-' + panelId);
    if(target) target.style.display = 'block';
};

// =========================================================
// MÓDULO: CURSOS
// =========================================================
window.openNewCourseModal = function() {
    if (!modalCourse) initializeModals();
    if (modalCourse) {
        document.getElementById('formCourse').reset();
        document.getElementById('course_id').value = "";
        modalCourse.show();
    }
};

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
            const id = document.getElementById('course_id').value;
            
            const newCourse = {
                title: document.getElementById('course_title').value,
                slug: document.getElementById('course_slug').value || null,
                description: document.getElementById('course_desc').value,
                carga_horaria_horas: parseFloat(document.getElementById('course_hours').value) || null,
                status: document.getElementById('course_status').value,
                tipo: document.getElementById('course_type').value,
                status_inscricao: document.getElementById('course_enroll_status').value,
                image_url: document.getElementById('course_img').value,
                updated_at: new Date()
            };

            const { data: { user } } = await supabase.auth.getUser();
            if (user && !id) newCourse.created_by = user.id;

            let error;
            if (id) {
                ({ error } = await supabase.from('courses').update(newCourse).eq('id', id));
            } else {
                ({ error } = await supabase.from('courses').insert(newCourse));
            }

            if (error) alert("Erro: " + error.message);
            else {
                alert("Salvo!");
                form.reset(); 
                modalCourse.hide();
                loadCourses(); 
                loadCounts();
            }
        });
    }
}

async function loadCourses() {
    const tbody = document.getElementById('table-courses');
    const template = document.getElementById('template-course-row'); 
    if(!tbody || !template) return;
    tbody.innerHTML = ''; 
    
    const { data: courses } = await supabase.from('courses').select('*').order('id', { ascending: false }).limit(20);
    
    if (courses) {
        courses.forEach(c => {
            const clone = template.content.cloneNode(true);
            const row = clone.querySelector('tr');

            clone.querySelector('.row-id').textContent = `#${c.id}`;
            clone.querySelector('.row-title').textContent = c.title;
            clone.querySelector('.row-subtitle').textContent = `${c.tipo || 'OUTRO'} • ${c.carga_horaria_horas || 0}h`;
            
            const badge = clone.querySelector('.row-status');
            badge.textContent = c.status === 'published' ? 'Publicado' : 'Rascunho';
            badge.className = `badge row-status rounded-pill ${c.status === 'published' ? 'bg-success' : 'bg-secondary'}`;
            
            row.style.cursor = 'pointer';
            row.onclick = (e) => {
                if (!e.target.closest('.edit-btn')) window.location.href = `course-editor.html?id=${c.id}`;
            };

            const btnEdit = clone.querySelector('.edit-btn');
            if(btnEdit) {
                btnEdit.onclick = (e) => {
                    e.stopPropagation();
                    openEditCourse(c);
                };
            }
            tbody.appendChild(clone);
        });
    }
}

function openEditCourse(course) {
    if (!modalCourse) initializeModals();
    document.getElementById('course_id').value = course.id;
    document.getElementById('course_title').value = course.title;
    document.getElementById('course_slug').value = course.slug;
    document.getElementById('course_desc').value = course.description || '';
    document.getElementById('course_hours').value = course.carga_horaria_horas || '';
    document.getElementById('course_img').value = course.image_url || '';
    document.getElementById('course_status').value = course.status; 
    document.getElementById('course_type').value = course.tipo || 'OUTRO';
    document.getElementById('course_enroll_status').value = course.status_inscricao || 'FECHADO';
    modalCourse.show();
}

// =========================================================
// MÓDULO: USUÁRIOS
// =========================================================

function setupUserForms() {
    const formNew = document.getElementById('formNewUser');
    if(formNew) {
        formNew.addEventListener('submit', async (e) => {
            e.preventDefault();
            alert("Para criar usuários, use a tela de login.");
        });
    }

    const formEdit = document.getElementById('formEditUser');
    if(formEdit) {
        formEdit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const userId = document.getElementById('edit_user_id').value;
            const roleEl = document.getElementById('edit_user_role');
            
            if(!roleEl) {
                console.error("Elemento 'edit_user_role' não encontrado.");
                return;
            }

            const updates = {
                name: document.getElementById('edit_user_name').value,
                role: roleEl.value 
            };

            const { error } = await supabase.from('profiles').update(updates).eq('id', userId);

            if (error) alert("Erro: " + error.message);
            else {
                alert("Usuário atualizado com sucesso!");
                if(modalEditUser) modalEditUser.hide();
                loadUsers();
            }
        });
    }
}

window.openNewUserModal = function() {
    if(!modalNewUser) initializeModals();
    document.getElementById('formNewUser').reset();
    if(modalNewUser) modalNewUser.show();
};

window.openEditUserModal = async function(id, name, currentRole) {
    if(!modalEditUser) initializeModals();
    
    document.getElementById('edit_user_id').value = id;
    document.getElementById('edit_user_name').value = name;
    document.getElementById('edit_user_uid').value = id;

    const roleSelect = document.getElementById('edit_user_role');
    if (roleSelect) {
        roleSelect.value = currentRole || 'aluno';
    }

    if(modalEditUser) modalEditUser.show();
};

window.deleteUser = async function(id) {
    if(!confirm("⚠️ Remover acesso deste usuário?")) return;
    await supabase.from('class_enrollments').delete().eq('user_id', id);
    const { error } = await supabase.from('profiles').delete().eq('id', id); 
    if (error) alert("Erro: " + error.message);
    else { loadUsers(document.getElementById('user-search-input').value); loadCounts(); }
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
    const tpl = document.getElementById('template-user-row');
    if(!tbody || !tpl) return;
    tbody.innerHTML = '';

    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
    if (term.length > 0) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);

    const { data: users, error } = await query;
    if (error) return;

    users.forEach(u => {
        const clone = tpl.content.cloneNode(true);
        const role = u.role || 'aluno';

        clone.querySelector('.user-name').textContent = u.name || '(Sem nome)';
        clone.querySelector('.user-id').textContent = u.id.substring(0,8) + '...';
        clone.querySelector('.user-email').textContent = u.email;
        
        const btnRole = clone.querySelector('.user-role-btn');
        if(btnRole) {
            btnRole.textContent = role.toUpperCase();
            if (role === 'admin') btnRole.className = 'btn btn-sm btn-dark user-role-btn shadow-sm';
            else if (role === 'professor') btnRole.className = 'btn btn-sm btn-primary user-role-btn shadow-sm';
            else btnRole.className = 'btn btn-sm btn-outline-secondary user-role-btn shadow-sm';
            
            btnRole.onclick = () => window.openEditUserModal(u.id, u.name, role);
        }

        const btnEdit = clone.querySelector('.btn-edit-user');
        if(btnEdit) btnEdit.onclick = () => window.openEditUserModal(u.id, u.name, role);
        
        const btnDel = clone.querySelector('.btn-delete-user');
        if(btnDel) btnDel.onclick = () => window.deleteUser(u.id);

        tbody.appendChild(clone);
    });
}

// =========================================================
// MENSAGENS E CONFIG
// =========================================================
async function loadMessages() {
    const tbody = document.getElementById('table-messages');
    const empty = document.getElementById('messages-empty');
    if(!tbody) return;
    tbody.innerHTML = '';
    const { data: msgs, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false });

    if(error || !msgs || msgs.length === 0) { 
        if(empty) empty.textContent = "Nenhuma mensagem."; 
        return; 
    }
    if(empty) empty.style.display = 'none';

    msgs.forEach(msg => {
        const tr = document.createElement('tr');
        const weight = msg.is_read ? 'normal' : 'bold';
        tr.innerHTML = `
            <td class="ps-4 text-muted small">${new Date(msg.created_at).toLocaleDateString()}</td>
            <td style="font-weight: ${weight}">${msg.name}</td>
            <td style="font-weight: ${weight}">${msg.subject}</td>
            <td class="text-end pe-4"><button class="btn btn-sm btn-outline-primary rounded-circle btn-view-msg"><i class='bx bx-envelope-open'></i></button></td>
        `;
        tr.querySelector('.btn-view-msg').onclick = () => window.openMessageModal(msg.id);
        tbody.appendChild(tr);
    });
}

window.openMessageModal = async function(id) {
    if(!modalViewMsg) initializeModals();
    const { data: msg } = await supabase.from('contact_messages').select('*').eq('id', id).single();
    if(!msg) return;
    currentMsgId = msg.id;
    document.getElementById('msg-view-content').textContent = msg.message;
    document.getElementById('msg-view-name').textContent = msg.name;
    document.getElementById('msg-view-date').textContent = new Date(msg.created_at).toLocaleString();
    document.getElementById('msg_status').value = msg.status || 'aberto';
    document.getElementById('msg_admin_reply').value = msg.admin_reply || '';
    if(!msg.is_read) supabase.from('contact_messages').update({ is_read: true }).eq('id', msg.id).then(loadMessages);
    modalViewMsg.show();
};

function setupMessageResponse() {
    const btn = document.getElementById('btn-save-attendance');
    if(btn) btn.onclick = async () => {
        if(!currentMsgId) return;
        await supabase.from('contact_messages').update({ 
            status: document.getElementById('msg_status').value, 
            admin_reply: document.getElementById('msg_admin_reply').value 
        }).eq('id', currentMsgId);
        alert("Salvo!"); modalViewMsg.hide(); loadMessages();
    };
    
    const btnDel = document.getElementById('btn-delete-msg-modal');
    if(btnDel) btnDel.onclick = async () => {
        if(!confirm("Excluir?")) return;
        await supabase.from('contact_messages').delete().eq('id', currentMsgId);
        modalViewMsg.hide(); loadMessages();
    };
}

function setupSystemConfig() {
    const form = document.getElementById('formSiteConfig');
    if(form) form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updates = {
            address: document.getElementById('conf_address').value,
            whatsapp: document.getElementById('conf_whatsapp').value,
            updated_at: new Date()
        };
        await supabase.from('site_config').upsert({ id: 1, ...updates });
        alert("Configurações atualizadas!"); modalSiteConfig.hide();
    });
}

window.openSiteConfig = async function() {
    if(!modalSiteConfig) initializeModals();
    modalSiteConfig.show();
    const { data } = await supabase.from('site_config').select('*').eq('id', 1).maybeSingle();
    if (data) {
        document.getElementById('conf_address').value = data.address || '';
        document.getElementById('conf_whatsapp').value = data.whatsapp || '';
    }
};

// ============================================
// CARREGAR CONTAGENS DO DASHBOARD (CORRIGIDO)
// ============================================
async function loadCounts() {
    // 1. Cursos
    const { count: c } = await supabase.from('courses').select('*', { count: 'exact', head: true });
    // 2. Usuários
    const { count: u } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    // 3. Mensagens (Fale Conosco)
    const { count: m } = await supabase.from('contact_messages').select('*', { count: 'exact', head: true });
    // 4. Turmas Ativas (Offers/Classes)
    const { count: cl } = await supabase.from('classes').select('*', { count: 'exact', head: true });
    
    if(document.getElementById('count-courses')) document.getElementById('count-courses').textContent = c || 0;
    if(document.getElementById('count-users')) document.getElementById('count-users').textContent = u || 0;
    if(document.getElementById('count-messages')) document.getElementById('count-messages').textContent = m || 0;
    if(document.getElementById('count-offers')) document.getElementById('count-offers').textContent = cl || 0;
}

document.addEventListener('DOMContentLoaded', initAdminPage);