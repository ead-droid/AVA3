import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('id') || params.get('classId');

let currentClassData = null; 
let staffMembers = []; // Cache para o dropdown de tarefas

document.addEventListener('DOMContentLoaded', async () => {
    if (!classId) {
        alert("ID da turma não encontrado.");
        window.location.href = 'class-manager.html';
        return;
    }
    await checkAuth();
    
    // Carrega dados na ordem correta
    await loadClassHeader();
    await loadStudents(); 
    loadPosts();      // Carrega o mural (novo)
    loadTeamTasks();  // Carrega tarefas internas
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

// ==========================================
// 1. HEADER & DADOS DA TURMA
// ==========================================
export async function loadClassHeader() {
    const { data: cls, error } = await supabase
        .from('classes')
        .select(`*, courses (title)`)
        .eq('id', classId)
        .single();

    if (error) { console.error(error); return; }
    currentClassData = cls;

    const elName = document.getElementById('dash-class-name');
    if(elName) elName.textContent = cls.name;
    
    const elCourse = document.getElementById('dash-course-name');
    if(elCourse) elCourse.textContent = cls.courses?.title || 'Curso Base';
    
    const elCode = document.getElementById('dash-code');
    if(elCode) elCode.textContent = cls.code || 'S/ CÓDIGO';
    
    if (cls.start_date) {
        const d1 = new Date(cls.start_date).toLocaleDateString();
        const d2 = cls.end_date ? new Date(cls.end_date).toLocaleDateString() : '?';
        const elDates = document.getElementById('dash-dates');
        if(elDates) elDates.innerHTML = `<i class='bx bx-calendar'></i> ${d1} até ${d2}`;
    }
    if (cls.whatsapp_link) {
        const btn = document.getElementById('dash-whatsapp');
        if(btn) {
            btn.href = cls.whatsapp_link;
            btn.style.display = 'inline-flex';
        }
    }
    
    // Preencher Modal Edição
    const inpName = document.getElementById('edit_class_name');
    if(inpName) {
        inpName.value = cls.name;
        document.getElementById('edit_class_code').value = cls.code || '';
        const dFmt = (d) => d ? d.split('T')[0] : '';
        document.getElementById('edit_start_date').value = dFmt(cls.start_date);
        document.getElementById('edit_end_date').value = dFmt(cls.end_date);
        document.getElementById('edit_enrollment_start').value = dFmt(cls.enrollment_start);
        document.getElementById('edit_enrollment_deadline').value = dFmt(cls.enrollment_deadline);
        if(document.getElementById('edit_enrollment_open')) document.getElementById('edit_enrollment_open').checked = cls.enrollment_open;
        if(document.getElementById('edit_is_hidden')) document.getElementById('edit_is_hidden').checked = cls.is_hidden;
    }
}

// ==========================================
// 2. ALUNOS & STAFF
// ==========================================
export async function loadStudents() {
    const tbody = document.getElementById('students-table-body');
    const empty = document.getElementById('students-empty');
    if(!tbody) return;

    // PASSO 1: Busca apenas as matrículas
    const { data: enrolls, error: errorEnrolls } = await supabase
        .from('class_enrollments')
        .select('*') 
        .eq('class_id', classId);

    if (errorEnrolls) {
        console.error("Erro ao buscar matrículas:", errorEnrolls);
        return;
    }

    const elTotal = document.getElementById('dash-total-students');
    if(elTotal) elTotal.textContent = enrolls.length;
    
    tbody.innerHTML = '';
    staffMembers = []; 
    
    if (!enrolls || enrolls.length === 0) {
        if(empty) empty.style.display = 'block';
        return;
    }
    if(empty) empty.style.display = 'none';

    // PASSO 2: Coleta os IDs e busca perfis
    const userIds = enrolls.map(e => e.user_id);
    
    const { data: profilesData, error: errorProfiles } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .in('id', userIds);

    if (errorProfiles) console.error("Erro perfis:", errorProfiles);

    // PASSO 3: Junta os dados
    const fullList = enrolls.map(enroll => {
        const profile = profilesData?.find(p => p.id === enroll.user_id) || {};
        return {
            ...enroll,
            profiles: profile,
            final_date: enroll.joined_at || enroll.enrolled_at || enroll.created_at,
            final_progress: (typeof enroll.progress_percent === 'number') ? enroll.progress_percent : 0
        };
    });

    fullList.sort((a, b) => new Date(b.final_date) - new Date(a.final_date));

    // PASSO 4: Renderiza
    const tpl = document.getElementById('tpl-student-row');
    if(!tpl) return;

    fullList.forEach(row => {
        const clone = tpl.content.cloneNode(true);
        const profile = row.profiles;
        const name = profile.name || 'Aluno sem Nome';
        const role = profile.role || 'aluno';

        if (role !== 'aluno') staffMembers.push({ id: profile.id, name: name, role: role });

        const initials = name.substring(0,2).toUpperCase();
        
        const av = clone.querySelector('.student-avatar'); if(av) av.textContent = initials;
        const nm = clone.querySelector('.student-name'); if(nm) nm.textContent = name;
        const em = clone.querySelector('.student-email'); if(em) em.textContent = profile.email || '---';
        
        const badge = clone.querySelector('.student-status');
        if(badge) {
            badge.textContent = translateStatus(row.status);
            badge.className = `badge rounded-pill ${getStatusClass(row.status)}`;
        }

        const pb = clone.querySelector('.student-progress-bar'); if(pb) pb.style.width = `${row.final_progress}%`;
        const pt = clone.querySelector('.student-progress-text'); if(pt) pt.textContent = `${row.final_progress}%`;
        
        const dt = clone.querySelector('.student-date');
        if(dt && row.final_date) dt.textContent = new Date(row.final_date).toLocaleDateString();

        // Botões
        if (row.status === 'pending') {
            const btn = clone.querySelector('.btn-approve');
            if(btn) {
                btn.style.display = 'inline-block';
                btn.onclick = () => updateEnrollmentStatus(row.id, 'active');
            }
        }
        
        const rmv = clone.querySelector('.btn-remove');
        if(rmv) rmv.onclick = () => removeStudent(row.id);

        const rBtn = clone.querySelector('.profile-role-btn');
        if(rBtn) {
            const rMap = { 'aluno': '🎓 Estudante', 'professor': '👨‍🏫 Professor', 'tutor': '🤝 Tutor', 'gerente': '🏗️ Gerente', 'admin': '⚡ Admin' };
            rBtn.textContent = rMap[role] || role;
        }
        
        clone.querySelectorAll('.dropdown-item[data-role]').forEach(item => {
            item.onclick = (e) => { e.preventDefault(); changeUserRole(profile.id, item.dataset.role); };
        });

        tbody.appendChild(clone);
    });

    populateStaffSelect();
}

function populateStaffSelect() {
    const select = document.getElementById('team_task_assignee');
    if(!select) return;
    select.innerHTML = '<option value="">Para: Equipe Geral</option>';
    staffMembers.forEach(member => {
        const opt = document.createElement('option');
        opt.value = member.name;
        opt.textContent = `${member.name} (${member.role})`;
        select.appendChild(opt);
    });
}

export async function changeUserRole(userId, newRole) {
    if(!confirm(`Mudar perfil para ${newRole}?`)) return;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) alert("Erro: " + error.message);
    else { loadStudents(); }
}
window.changeUserRole = changeUserRole;

// ==========================================
// 3. MURAL (RECONFIGURADO PARA CLASS_EVENTS)
// ==========================================
export async function loadPosts() {
    // Tenta encontrar o container (mural-feed é o novo, posts-feed é o antigo)
    const container = document.getElementById('mural-feed') || document.getElementById('posts-feed');
    
    // Se não achar nenhum container, sai silenciosamente (provavelmente outra aba)
    if(!container) return;

    // Busca dados da tabela correta: class_events
    const { data: posts, error } = await supabase
        .from('class_events')
        .select('*')
        .eq('class_id', classId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) { console.error("Erro mural:", error); return; }
    
    container.innerHTML = '';
    
    if (!posts || posts.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-5"><i class="bx bx-news fs-1"></i><p>Nenhum recado no mural.</p></div>';
        return;
    }

    // Renderiza os posts
    posts.forEach(post => {
        // Define cores e ícones baseados no tipo
        let icon = 'bx-note';
        let badgeColor = 'secondary';
        
        if (post.type === 'AVISO') { icon = 'bx-bell'; badgeColor = 'warning text-dark'; }
        if (post.type === 'MATERIAL') { icon = 'bx-book'; badgeColor = 'primary'; }
        if (post.type === 'EVENTO') { icon = 'bx-calendar'; badgeColor = 'success'; }

        // Formata data do evento se existir
        let dateHtml = '';
        if(post.event_date) {
            const d = new Date(post.event_date).toLocaleDateString('pt-BR');
            dateHtml = `<span class="badge bg-light text-dark border ms-2"><i class='bx bx-calendar'></i> ${d}</span>`;
        }
        
        // Verifica se é fixado
        const pinnedBadge = post.is_pinned ? `<span class="badge bg-warning text-dark ms-2"><i class='bx bx-pin'></i> Fixado</span>` : '';

        // Cria o HTML do Card
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card mb-3 border-0 shadow-sm';
        cardDiv.innerHTML = `
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="d-flex align-items-center mb-2">
                        <div class="rounded-circle bg-${badgeColor} bg-opacity-10 text-${badgeColor.split(' ')[0]} p-2 me-2 d-flex align-items-center justify-content-center" style="width:40px;height:40px;">
                            <i class='bx ${icon} fs-4'></i>
                        </div>
                        <div>
                            <h6 class="fw-bold mb-0">${post.title}</h6>
                            <div class="small text-muted">${new Date(post.created_at).toLocaleDateString('pt-BR')}</div>
                        </div>
                        ${pinnedBadge}
                    </div>
                    <button class="btn btn-sm text-danger" onclick="deletePost('${post.id}')" title="Excluir">
                        <i class='bx bx-trash'></i>
                    </button>
                </div>

                <p class="text-secondary mt-3 mb-2" style="white-space: pre-wrap;">${post.content || post.description || ''}</p>

                ${post.resource_url ? `<a href="${post.resource_url}" target="_blank" class="btn btn-sm btn-outline-primary mt-2"><i class='bx bx-link-external'></i> Acessar Recurso</a>` : ''}
                
                <div class="mt-2 text-end">
                    ${dateHtml}
                </div>
            </div>
        `;
        container.appendChild(cardDiv);
    });
}
window.loadPosts = loadPosts;

// Função global para deletar post
window.deletePost = async function(eventId) {
    if(!confirm("Excluir este item do mural?")) return;
    
    const { error } = await supabase
        .from('class_events')
        .delete()
        .eq('id', eventId);
        
    if(error) alert("Erro ao excluir: " + error.message);
    else loadPosts();
}

// ==========================================
// 4. TAREFAS DA EQUIPE
// ==========================================
export async function loadTeamTasks() {
    const container = document.getElementById('team-tasks-list');
    if(container) container.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div></div>';

    const { data: tasks, error } = await supabase
        .from('class_posts')
        .select('*')
        .eq('class_id', classId)
        .eq('type', 'INTERNAL')
        .order('created_at', { ascending: false });

    if (error) return;
    
    // Badge
    const pendingCount = tasks.filter(t => !t.is_pinned).length;
    const badge = document.getElementById('team-notification-badge');
    if (badge) {
        badge.textContent = pendingCount;
        badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    if (container) {
        container.innerHTML = '';
        if (!tasks || tasks.length === 0) {
            container.innerHTML = `<div class="text-center text-muted py-5 border rounded border-dashed"><i class="bx bx-check-double fs-1"></i><p class="mb-0">Nenhuma pendência.</p></div>`;
            return;
        }

        const tpl = document.getElementById('tpl-team-task');
        if(!tpl) return;

        tasks.forEach(task => {
            const clone = tpl.content.cloneNode(true);
            const card = clone.querySelector('.task-internal-item');
            const check = clone.querySelector('.task-check');
            const text = clone.querySelector('.task-text');
            const assigneeEl = clone.querySelector('.task-assignee');
            const meta = clone.querySelector('.task-meta');

            if(text) text.textContent = task.title; 
            if(meta) meta.textContent = new Date(task.created_at).toLocaleDateString();
            
            if(task.content && task.content !== 'Task Interna' && assigneeEl) {
                assigneeEl.innerHTML = `<i class='bx bx-user'></i> ${task.content}`;
            }

            if(check) {
                check.checked = task.is_pinned;
                check.onchange = async () => {
                    const isDone = check.checked;
                    if(card) isDone ? card.classList.add('done') : card.classList.remove('done');
                    await supabase.from('class_posts').update({ is_pinned: isDone }).eq('id', task.id);
                    loadTeamTasks(); 
                };
            }
            if (task.is_pinned && card) card.classList.add('done');

            const delBtn = clone.querySelector('.btn-delete-task');
            if(delBtn) {
                delBtn.onclick = async () => {
                    if(confirm("Apagar nota?")) {
                        await supabase.from('class_posts').delete().eq('id', task.id);
                        loadTeamTasks();
                    }
                };
            }
            container.appendChild(clone);
        });
    }
}
window.loadTeamTasks = loadTeamTasks;

const formTeamTask = document.getElementById('formTeamTask');
if(formTeamTask) {
    formTeamTask.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = document.getElementById('team_task_input');
        const select = document.getElementById('team_task_assignee');
        const text = input.value.trim();
        const assignee = select.value || 'Equipe Geral';

        if (!text) return;

        const { error } = await supabase.from('class_posts').insert({
            class_id: classId,
            type: 'INTERNAL',
            title: text,
            content: assignee,
            is_pinned: false
        });

        if (error) alert("Erro: " + error.message);
        else {
            input.value = '';
            loadTeamTasks();
        }
    });
}

// ==========================================
// 5. MODAIS E FORMULÁRIOS GERAIS
// ==========================================
export function openEditClassModal() { new bootstrap.Modal(document.getElementById('modalEditClass')).show(); }
export function openCertificates() { alert("Em breve."); }
export async function deleteClass() {
    if(!confirm("Excluir turma e todos os dados?")) return;
    await supabase.from('class_enrollments').delete().eq('class_id', classId);
    await supabase.from('class_posts').delete().eq('class_id', classId);
    await supabase.from('class_events').delete().eq('class_id', classId); // Limpa eventos também
    await supabase.from('classes').delete().eq('id', classId);
    window.location.href = 'class-manager.html';
}
window.openEditClassModal = openEditClassModal;
window.openCertificates = openCertificates;
window.deleteClass = deleteClass;


const formEditClass = document.getElementById('formEditClass');
if(formEditClass) {
    formEditClass.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const updates = {
            name: document.getElementById('edit_class_name').value,
            start_date: document.getElementById('edit_start_date').value || null,
            end_date: document.getElementById('edit_end_date').value || null,
            enrollment_start: document.getElementById('edit_enrollment_start').value || null,
            enrollment_deadline: document.getElementById('edit_enrollment_deadline').value || null,
            enrollment_open: document.getElementById('edit_enrollment_open').checked,
            is_hidden: document.getElementById('edit_is_hidden').checked
        };

        const { error } = await supabase.from('classes').update(updates).eq('id', classId);

        if (error) {
            alert("Erro ao salvar edição: " + error.message);
            console.error(error);
        } else {
            alert("Turma atualizada com sucesso!");
            bootstrap.Modal.getInstance(document.getElementById('modalEditClass')).hide();
            loadClassHeader();
        }
    });
}

// 6. MATRÍCULA
export function openAddStudentModal() {
    const input = document.getElementById('search-student-input');
    const list = document.getElementById('student-search-results-list');
    
    if(input) input.value = '';
    if(list) list.innerHTML = '<div class="text-center py-4 text-muted small border rounded bg-white">Digite...</div>';
    
    new bootstrap.Modal(document.getElementById('modalAddStudent')).show();
}

export async function searchStudentToEnroll() {
    const input = document.getElementById('search-student-input');
    const list = document.getElementById('student-search-results-list');
    
    if(!input || !list) return;
    const term = input.value.trim();

    if(term.length < 3) {
        alert("Digite pelo menos 3 letras.");
        return;
    }
    
    list.innerHTML = '<div class="text-center text-muted">Buscando...</div>';

    const { data: users, error } = await supabase
        .from('profiles')
        .select('id, name, email')
        .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(5);

    list.innerHTML = '';

    if (error) {
        list.innerHTML = `<div class="text-danger small">Erro: ${error.message}</div>`;
        return;
    }

    if(!users || users.length === 0) { 
        list.innerHTML = '<div class="text-muted small">Nenhum aluno encontrado.</div>'; 
        return; 
    }

    users.forEach(u => {
        const div = document.createElement('div');
        div.className = 'card border p-2 d-flex flex-row justify-content-between align-items-center mb-1';
        div.innerHTML = `
            <div style="overflow:hidden;">
                <strong>${u.name || 'Sem nome'}</strong><br>
                <small class="text-muted">${u.email}</small>
            </div>
            <button class="btn btn-sm btn-outline-primary" onclick="window.confirmEnroll('${u.id}', this)">
                <i class='bx bx-plus'></i>
            </button>`;
        list.appendChild(div);
    });
}

export async function confirmEnroll(uid, btn) {
    if(btn) btn.disabled = true;
    const { error } = await supabase.from('class_enrollments').insert({ class_id: classId, user_id: uid, status: 'active' });
    if(error) {
        alert("Erro ao matricular: " + error.message);
        if(btn) btn.disabled = false;
    } else { 
        if(btn) { btn.className = 'btn btn-sm btn-success'; btn.textContent = 'OK'; }
        loadStudents(); 
    }
}

export async function updateEnrollmentStatus(id, st) { 
    if(confirm('Confirmar alteração de status?')) { 
        const { error } = await supabase.from('class_enrollments').update({status:st}).eq('id',id); 
        if(error) alert(error.message);
        else loadStudents(); 
    } 
}

export async function removeStudent(id) { 
    if(confirm('Remover aluno desta turma?')) { 
        const { error } = await supabase.from('class_enrollments').delete().eq('id',id); 
        if(error) alert(error.message);
        else loadStudents(); 
    } 
}

// Conexão manual com Window
window.openAddStudentModal = openAddStudentModal;
window.searchStudentToEnroll = searchStudentToEnroll;
window.confirmEnroll = confirmEnroll;
window.updateEnrollmentStatus = updateEnrollmentStatus;
window.removeStudent = removeStudent;

// 7. PUBLICAR NO MURAL (LISTENER DO FORMULÁRIO)
const formPost = document.getElementById('formPost');
if(formPost) {
    formPost.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Pega usuário para registrar autoria
        const { data: { user } } = await supabase.auth.getUser();
        if(!user) { alert("Sessão expirada"); return; }
        
        const data = {
            class_id: classId,
            created_by: user.id, // ID do usuário
            type: document.getElementById('post_type').value,
            title: document.getElementById('post_title').value,
            content: document.getElementById('post_content').value,
            resource_url: document.getElementById('post_url').value || null,
            event_date: document.getElementById('post_date').value || null,
            is_pinned: document.getElementById('post_pinned').checked
        };

        const { error } = await supabase.from('class_events').insert(data);

        if (error) {
            alert("Erro ao postar: " + error.message);
            console.error(error);
        } else {
            e.target.reset(); 
            loadPosts(); // Atualiza a lateral
        }
    });
}

function translateStatus(st) { const map = { active: 'Ativo', pending: 'Pendente', rejected: 'Rejeitado', dropped: 'Trancado', completed: 'Concluído' }; return map[st] || st; }
function getStatusClass(st) { const map = { active: 'badge-subtle-success', pending: 'badge-subtle-warning', rejected: 'badge-subtle-danger', dropped: 'badge-subtle-secondary', completed: 'badge-subtle-primary' }; return map[st] || 'bg-secondary'; }