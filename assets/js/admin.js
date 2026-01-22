import { supabase } from './supabaseClient.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

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
    console.log("🚀 Admin JS Iniciado (Versão Completa Restaurada)");

    // Tenta inicializar modais imediatamente
    initializeModals();

    // Configura os formulários
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
    }
}

// Inicializa os Modais do Bootstrap de forma segura
function initializeModals() {
    if (window.bootstrap) {
        const getModal = (id) => {
            const el = document.getElementById(id);
            if (!el) return null;
            // Retorna instância existente ou cria uma nova
            return window.bootstrap.Modal.getInstance(el) || new window.bootstrap.Modal(el);
        };

        modalCourse = getModal('modalCourse');
        modalNewUser = getModal('modalNewUser');
        modalEditUser = getModal('modalEditUser');
        modalViewMsg = getModal('modalViewMessage');
        modalSiteConfig = getModal('modalSiteConfig');
    }
}

// =========================================================
// NAVEGAÇÃO ENTRE PAINÉIS
// =========================================================
window.showPanel = function(panelId) {
    // Esconde todos
    document.querySelectorAll('.admin-panel').forEach(el => el.style.display = 'none');
    
    // Mostra o alvo
    const target = document.getElementById('panel-' + panelId);
    if(target) target.style.display = 'block';
    
    // Atualiza título
    const titleEl = document.getElementById('panel-title');
    if(titleEl) {
        const titles = { 
            'courses': 'Gerenciar Cursos', 
            'users': 'Gerenciar Usuários', 
            'offers': 'Gerenciar Turmas', 
            'messages': 'Mensagens Recebidas' 
        };
        titleEl.textContent = titles[panelId] || 'Visão Geral';
    }
};

// =========================================================
// MÓDULO: CURSOS (CORRIGIDO)
// =========================================================

window.openNewCourseModal = function() {
    // PROTEÇÃO: Se o modal não carregou no início (ex: internet lenta), tenta carregar agora
    if (!modalCourse) initializeModals();

    if (modalCourse) {
        const form = document.getElementById('formCourse');
        if(form) form.reset();
        
        const idField = document.getElementById('course_id');
        if(idField) idField.value = "";
        
        // Define padrões seguros para o banco (Evita erro de constraint)
        const statusField = document.getElementById('course_status');
        if(statusField) statusField.value = 'draft';
        
        const enrollField = document.getElementById('course_enroll_status');
        if(enrollField) enrollField.value = 'FECHADO';
        
        modalCourse.show();
    } else {
        alert("Erro: O formulário de curso não foi carregado. Tente recarregar a página.");
    }
};

function setupCourseForm() {
    const form = document.getElementById('formCourse');
    const titleInp = document.getElementById('course_title');
    const slugInp = document.getElementById('course_slug');

    // Slug automático
    if (titleInp && slugInp) {
        titleInp.addEventListener('input', () => {
            slugInp.value = titleInp.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('course_id').value;
            const hours = parseFloat(document.getElementById('course_hours').value) || null;
            
            // Dados estritos para a tabela courses (Modelo 9.2)
            const newCourse = {
                title: document.getElementById('course_title').value,
                slug: document.getElementById('course_slug').value || null,
                description: document.getElementById('course_desc').value,
                
                // Mapeia para as colunas de horas
                total_hours: hours,
                carga_horaria_horas: hours,
                
                // Status deve ser 'draft' ou 'published' (sem novos status)
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
                const { error: err } = await supabase.from('courses').update(newCourse).eq('id', id);
                error = err;
            } else {
                const { error: err } = await supabase.from('courses').insert(newCourse);
                error = err;
            }

            if (error) {
                alert("Erro ao salvar curso: " + error.message);
                console.error(error);
            } else {
                alert(id ? "Curso atualizado!" : "Curso criado!");
                form.reset(); 
                if(modalCourse) modalCourse.hide();
                loadCounts(); 
                loadCourses(); 
            }
        });
    }
}

async function loadCourses() {
    const tbody = document.getElementById('table-courses');
    const template = document.getElementById('template-course-row'); 
    
    if(!tbody || !template) return;
    tbody.innerHTML = ''; 
    
    const { data: courses, error } = await supabase.from('courses').select('*').order('id', { ascending: false }).limit(20);
    
    if (error) { console.error("Erro loadCourses:", error); return; }

    if (courses) {
        courses.forEach(c => {
            const clone = template.content.cloneNode(true);
            const row = clone.querySelector('tr'); // Seleciona a linha inteira

            // Preenche os dados visuais
            clone.querySelector('.row-id').textContent = `#${c.id}`;
            clone.querySelector('.row-title').textContent = c.title;
            clone.querySelector('.row-subtitle').textContent = `${c.tipo || 'OUTRO'} • ${c.carga_horaria_horas || 0}h`;
            
            // Badge Status
            const badge = clone.querySelector('.row-status');
            if (c.status === 'published') {
                badge.textContent = 'Publicado';
                badge.className = 'badge row-status bg-success rounded-pill';
            } else {
                badge.textContent = 'Rascunho';
                badge.className = 'badge row-status bg-secondary rounded-pill';
            }
            
            // --- NOVA LÓGICA DE CLIQUE NA LINHA ---
            
            // 1. Muda o cursor para mãozinha para indicar clique
            row.style.cursor = 'pointer'; 
            row.title = "Clique para editar o conteúdo do curso";

            // 2. Adiciona o evento de redirecionamento na linha
            row.onclick = (e) => {
                // Se o clique foi no botão de editar (lápis), não redireciona
                if (e.target.closest('.edit-btn') || e.target.closest('.btn-delete-user')) {
                    return;
                }
                // Redireciona para o editor de curso com o ID
                window.location.href = `course-editor.html?id=${c.id}`;
            };

            // Botão Editar (Abre o Modal rápido, sem redirecionar)
            const btnEdit = clone.querySelector('.edit-btn');
            if(btnEdit) {
                btnEdit.onclick = (e) => {
                    e.stopPropagation(); // Garante que o clique não suba para a linha
                    openEditCourse(c);
                };
            }
            
            tbody.appendChild(clone);
        });
    }
}

function openEditCourse(course) {
    if (!modalCourse) initializeModals();
    if (!modalCourse) return;
    
    document.getElementById('course_id').value = course.id;
    document.getElementById('course_title').value = course.title;
    document.getElementById('course_slug').value = course.slug;
    document.getElementById('course_desc').value = course.description || '';
    document.getElementById('course_hours').value = course.carga_horaria_horas || course.total_hours || '';
    document.getElementById('course_img').value = course.image_url || '';
    
    // Selects
    document.getElementById('course_status').value = course.status; 
    document.getElementById('course_type').value = course.tipo || 'OUTRO';
    document.getElementById('course_enroll_status').value = course.status_inscricao || 'FECHADO';

    modalCourse.show();
}

// =========================================================
// MÓDULO: USUÁRIOS (CÓDIGO RESTAURADO)
// =========================================================

function setupUserForms() {
    // Form Novo Usuário
    const formNew = document.getElementById('formNewUser');
    if(formNew) {
        formNew.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.submitter; 
            btn.disabled = true; 
            btn.innerHTML = 'Criando...';

            const name = document.getElementById('new_user_name').value.trim();
            const email = document.getElementById('new_user_email').value.trim();
            const password = document.getElementById('new_user_password').value;
            const role = document.getElementById('new_user_role').value;

            // Usa cliente temporário para criar usuário sem deslogar admin
            const tempClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data, error } = await tempClient.auth.signUp({
                email, password,
                options: { data: { full_name: name } }
            });

            if(error) {
                alert("Erro ao criar conta: " + error.message);
                btn.disabled = false; 
                btn.innerHTML = 'Cadastrar';
                return;
            }

            // Atualiza role no perfil
            if(data.user) {
                await supabase.from('profiles').update({ role: role, name: name }).eq('id', data.user.id);
                alert(`Usuário cadastrado com sucesso!`);
                formNew.reset();
                if(modalNewUser) modalNewUser.hide();
                loadUsers();
            }
            btn.disabled = false; 
            btn.innerHTML = 'Cadastrar';
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
            else { alert("Salvo!"); if(modalEditUser) modalEditUser.hide(); loadUsers(); }
        });
    }
}

window.openNewUserModal = function() {
    if(!modalNewUser) initializeModals();
    document.getElementById('formNewUser').reset();
    if(modalNewUser) modalNewUser.show();
};

window.openEditUserModal = function(id, name, role) {
    if(!modalEditUser) initializeModals();
    document.getElementById('edit_user_id').value = id;
    document.getElementById('edit_user_name').value = name;
    document.getElementById('edit_user_role').value = role;
    document.getElementById('edit_user_uid').value = id;
    if(modalEditUser) modalEditUser.show();
};

window.deleteUser = async function(id) {
    if(!confirm("⚠️ PERIGO: Tem certeza absoluta? Isso removerá o acesso do usuário.")) return;
    
    // Limpa dependências
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
    
    if(!tbody || !tpl) return;
    tbody.innerHTML = '';
    if(statusDiv) statusDiv.style.display = 'block';

    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
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
        
        const btnRole = clone.querySelector('.user-role-btn');
        btnRole.textContent = role.toUpperCase();
        
        if (role === 'admin') btnRole.classList.add('btn-dark');
        else if (role === 'professor') btnRole.classList.add('btn-outline-dark');
        else btnRole.classList.add('btn-outline-secondary');

        clone.querySelectorAll('.dropdown-item[data-value]').forEach(item => {
            item.onclick = (e) => { e.preventDefault(); changeGlobalRole(u.id, item.dataset.value); };
        });
        
        const btnEdit = clone.querySelector('.btn-edit-user');
        if(btnEdit) btnEdit.onclick = () => window.openEditUserModal(u.id, u.name, role);
        
        const btnDel = clone.querySelector('.btn-delete-user');
        if(btnDel) btnDel.onclick = () => window.deleteUser(u.id);

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
// MÓDULO: MENSAGENS E CONFIG (CÓDIGO RESTAURADO)
// =========================================================

async function loadMessages() {
    const tbody = document.getElementById('table-messages');
    const empty = document.getElementById('messages-empty');
    if(!tbody) return;

    tbody.innerHTML = '';
    const { data: msgs, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false });

    if(error || !msgs || msgs.length === 0) { 
        if(empty) empty.textContent = "Nenhuma mensagem recebida."; 
        return; 
    }
    if(empty) empty.style.display = 'none';

    msgs.forEach(msg => {
        const tr = document.createElement('tr');
        const weight = msg.is_read ? 'normal' : 'bold';
        
        tr.innerHTML = `
            <td class="ps-4 text-muted small">${new Date(msg.created_at).toLocaleDateString()}</td>
            <td style="font-weight: ${weight}"><div>${msg.name}</div><small class="text-muted">${msg.email}</small></td>
            <td style="font-weight: ${weight}"><div class="small text-muted text-truncate" style="max-width: 250px;">${msg.subject}</div></td>
            <td class="text-end pe-4"><button class="btn btn-sm btn-outline-primary rounded-circle btn-view-msg"><i class='bx bx-envelope-open'></i></button></td>
        `;
        
        const btn = tr.querySelector('.btn-view-msg');
        if(btn) btn.onclick = () => window.openMessageModal(msg.id);
        
        tbody.appendChild(tr);
    });
}

window.openMessageModal = async function(id) {
    if(!modalViewMsg) initializeModals();
    const { data: msg } = await supabase.from('contact_messages').select('*').eq('id', id).single();
    if(!msg) return;
    
    currentMsgId = msg.id;
    document.getElementById('msg-view-subject').textContent = msg.subject;
    document.getElementById('msg-view-name').textContent = msg.name;
    document.getElementById('msg-view-email').textContent = msg.email;
    document.getElementById('msg-view-date').textContent = new Date(msg.created_at).toLocaleString();
    document.getElementById('msg-view-content').textContent = msg.message;
    document.getElementById('msg_status').value = msg.status || 'aberto';
    document.getElementById('msg_admin_reply').value = msg.admin_reply || '';
    
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
};

function setupMessageResponse() {
    const btn = document.getElementById('btn-save-attendance');
    if(btn) {
        btn.onclick = async () => {
            if(!currentMsgId) return;
            const status = document.getElementById('msg_status').value;
            const reply = document.getElementById('msg_admin_reply').value;
            const { error } = await supabase.from('contact_messages').update({ status, admin_reply: reply, is_read: true }).eq('id', currentMsgId);
            if (!error) { 
                alert("Salvo!"); 
                if(modalViewMsg) modalViewMsg.hide(); 
                loadMessages(); 
            } else {
                alert("Erro ao salvar: " + error.message);
            }
        };
    }
}

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
            if (error) alert("Erro: " + error.message);
            else { alert("Configurações atualizadas!"); if(modalSiteConfig) modalSiteConfig.hide(); }
        });
    }
}

window.openSiteConfig = async function() {
    if(!modalSiteConfig) initializeModals();
    if(modalSiteConfig) modalSiteConfig.show();
    const { data } = await supabase.from('site_config').select('*').eq('id', 1).maybeSingle();
    if (data) {
        document.getElementById('conf_address').value = data.address || '';
        document.getElementById('conf_email_sup').value = data.email_support || '';
        document.getElementById('conf_email_com').value = data.email_commercial || '';
        document.getElementById('conf_whatsapp').value = data.whatsapp || '';
        document.getElementById('conf_map').value = data.map_url || '';
    }
};

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

// Inicializa a página assim que o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initAdminPage);