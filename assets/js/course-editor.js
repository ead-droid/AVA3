import { supabase } from './supabaseClient.js';

// === CONFIGURAÇÃO E UTILITÁRIOS ===
const params = new URLSearchParams(window.location.search);
const courseId = params.get('id') || params.get('courseId');

// Globais para Modais
let modalModule = null;
let modalSection = null;
let modalLesson = null;
let globalModules = []; // Armazena a estrutura para usar no select de pré-requisitos

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', async () => {
    if (!courseId) {
        alert("ID do curso não encontrado.");
        window.location.href = 'admin.html';
        return;
    }

    if (window.bootstrap) {
        const getM = (id) => document.getElementById(id) ? new window.bootstrap.Modal(document.getElementById(id)) : null;
        modalModule = getM('modalModule');
        modalSection = getM('modalSection');
        modalLesson = getM('modalLesson');
    }

    try {
        await loadCourseData();   
        await loadModules();      
        await loadLinkedClasses();
        setupFormListeners();     
    } catch (error) {
        console.error("Erro fatal:", error);
    }
});

// =========================================================
// 1. CARREGAR DADOS DO CURSO
// =========================================================
async function loadCourseData() {
    const { data: course, error } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (error) return console.error(error);

    document.getElementById('header-title').textContent = course.title;
    document.getElementById('course-id-badge').textContent = `ID: ${course.id}`;
    document.getElementById('edit_title').value = course.title;
    document.getElementById('edit_desc').value = course.description || '';
    if (document.getElementById('edit_status')) {
        const st = (course.status || '').toUpperCase();
        document.getElementById('edit_status').value = (st === 'PUBLISHED' || st === 'CONCLUIDO') ? 'published' : 'draft';
    }
}

// =========================================================
// 2. GRADE CURRICULAR
// =========================================================
async function loadModules() {
    const container = document.getElementById('modules-list');
    const emptyMsg = document.getElementById('modules-empty');
    
    if (!container) return;
    container.innerHTML = ''; 

    const { data: modules, error } = await supabase
        .from('modules')
        .select(`*, sections (*, lessons (*))`)
        .eq('course_id', courseId)
        .order('ordem', { ascending: true });

    if (error) { console.error(error); return; }

    globalModules = modules || [];

    if (!modules || modules.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        return;
    }
    if (emptyMsg) emptyMsg.style.display = 'none';

    modules.forEach(mod => {
        if (mod.sections) {
            mod.sections.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
            mod.sections.forEach(sec => {
                if (sec.lessons) sec.lessons.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
            });
        }
        renderModuleItem(mod, container);
    });
}

function renderModuleItem(mod, container) {
    const tpl = document.getElementById('tpl-module');
    if (!tpl) return;
    
    const clone = tpl.content.cloneNode(true);
    
    clone.querySelector('.mod-badge').textContent = mod.ordem;
    clone.querySelector('.mod-title').textContent = mod.title;
    
    // Badge de bloqueio no módulo
    if (mod.unlock_at || (mod.prerequisite_ids && mod.prerequisite_ids.length > 0)) {
        const lockBadge = clone.querySelector('.mod-lock-badge');
        if (lockBadge) lockBadge.style.display = 'inline-flex';
    }

    clone.querySelector('.btn-edit').onclick = () => openModuleModal(mod);
    clone.querySelector('.btn-del').onclick = () => deleteItem('modules', mod.id);
    clone.querySelector('.btn-add-sec').onclick = () => openSectionModal(mod.id);

    const secContainer = clone.querySelector('.sections-container');
    
    if (mod.sections && mod.sections.length > 0) {
        mod.sections.forEach(sec => renderSectionItem(sec, secContainer, mod.id));
    } else {
        secContainer.innerHTML = `<div class="p-4 text-center text-muted border-top bg-light small">Nenhuma seção neste módulo.</div>`;
    }

    container.appendChild(clone);
}

function renderSectionItem(sec, container, modId) {
    const tpl = document.getElementById('tpl-section');
    if (!tpl) return;

    const clone = tpl.content.cloneNode(true);

    clone.querySelector('.sec-badge').textContent = sec.ordem;
    clone.querySelector('.sec-title').textContent = sec.title;

    // Badge de bloqueio na seção
    if (sec.unlock_at || (sec.prerequisite_ids && sec.prerequisite_ids.length > 0)) {
        const lockBadge = clone.querySelector('.sec-lock-badge');
        if (lockBadge) lockBadge.style.display = 'inline-flex';
    }

    clone.querySelector('.btn-add-content').onclick = () => openLessonModal(modId, sec.id);
    clone.querySelector('.btn-edit').onclick = () => openSectionModal(modId, sec);
    clone.querySelector('.btn-del').onclick = () => deleteItem('sections', sec.id);

    const contentContainer = clone.querySelector('.content-container');

    if (sec.lessons && sec.lessons.length > 0) {
        sec.lessons.forEach(les => renderLessonItem(les, contentContainer, modId, sec.id));
    } else {
        contentContainer.innerHTML = `<div class="p-2 text-center text-muted small fst-italic">Sem conteúdo cadastrado.</div>`;
    }

    container.appendChild(clone);
}

function renderLessonItem(les, container, modId, secId) {
    const tpl = document.getElementById('tpl-lesson');
    if (!tpl) return;

    const clone = tpl.content.cloneNode(true);
    clone.querySelector('.lesson-order').textContent = les.ordem;
    clone.querySelector('.lesson-title').textContent = les.title;
    
    const iconEl = clone.querySelector('.icon-circle i');
    const typeLabel = clone.querySelector('.lesson-type');
    
    let iconClass = 'bx-file';
    let typeName = 'Conteúdo';

    switch (les.type) {
        case 'VIDEO_AULA': iconClass = 'bx-video'; typeName = 'Vídeo'; break;
        case 'QUIZ': iconClass = 'bx-trophy'; typeName = 'Quiz'; break;
        case 'TAREFA': iconClass = 'bx-task'; typeName = 'Tarefa'; break;
        case 'PDF': iconClass = 'bx-file-pdf'; typeName = 'PDF'; break;
        case 'TEXTO': iconClass = 'bx-text'; typeName = 'Texto'; break;
        case 'MATERIAL': iconClass = 'bx-link'; typeName = 'Link'; break;
        case 'AVISO': iconClass = 'bx-bell'; typeName = 'Aviso'; break;
    }
    
    iconEl.className = `bx ${iconClass}`;
    typeLabel.textContent = typeName;

    // Badges de Condição
    if (les.unlock_at) {
        const badgeDate = clone.querySelector('.condition-date-badge');
        if(badgeDate) badgeDate.style.display = 'inline-flex';
    }
    if (les.prerequisite_ids && les.prerequisite_ids.length > 0) {
        const badgeLock = clone.querySelector('.condition-lock-badge');
        if(badgeLock) badgeLock.style.display = 'inline-flex';
    }
    if (les.points > 0) {
        const badge = clone.querySelector('.lesson-points');
        badge.style.display = 'inline-block';
        badge.textContent = `${les.points} pts`;
        badge.className = 'badge bg-success ms-2';
    }

    const actionsArea = clone.querySelector('.actions-area');
    
    if (les.type === 'QUIZ') {
        const tplBtn = document.getElementById('tpl-btn-quiz');
        if (tplBtn) {
            const btn = tplBtn.content.cloneNode(true).querySelector('a');
            btn.href = `quiz-builder.html?id=${les.id}`; 
            actionsArea.prepend(btn);
        }
    } else if (les.type === 'TAREFA') {
        const tplBtn = document.getElementById('tpl-btn-task');
        if (tplBtn) {
            const btn = tplBtn.content.cloneNode(true).querySelector('a');
            btn.href = `task-builder.html?id=${les.id}`;
            actionsArea.prepend(btn);
        }
    } else if (les.type === 'TEXTO') {
        const tplBtn = document.getElementById('tpl-btn-text');
        if (tplBtn) {
            const btn = tplBtn.content.cloneNode(true).querySelector('a');
            btn.href = `text-builder.html?id=${les.id}`;
            actionsArea.prepend(btn);
        }
    }

    clone.querySelector('.btn-edit').onclick = () => openLessonModal(modId, secId, les);
    clone.querySelector('.btn-del').onclick = () => deleteItem('lessons', les.id);
    clone.querySelector('.btn-preview').onclick = () => window.open(`classroom.html?id=${courseId}`, '_blank');

    container.appendChild(clone);
}

// =========================================================
// 3. TURMAS E MODAIS
// =========================================================
async function loadLinkedClasses() {
    const tbody = document.getElementById('linked-classes-list');
    if (!tbody) return;
    tbody.innerHTML = '';
    const { data: classes } = await supabase.from('classes').select('*, class_enrollments(count)').eq('course_id', courseId);
    if (!classes || classes.length === 0) {
        document.getElementById('classes-empty').style.display = 'block';
        return;
    }
    document.getElementById('classes-empty').style.display = 'none';
    classes.forEach(cls => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="ps-4 fw-bold">${cls.name}</td><td><code>${cls.access_code || '-'}</code></td><td><span class="badge bg-secondary">${cls.class_enrollments ? cls.class_enrollments[0].count : 0} alunos</span></td><td>${cls.start_date ? new Date(cls.start_date).toLocaleDateString() : 'Indefinido'}</td><td class="text-end pe-4"><a href="class-manager.html" class="btn btn-sm btn-outline-primary fw-bold">Gerenciar</a></td>`;
        tbody.appendChild(tr);
    });
}

// --- MODAL DE MÓDULO (COM REGRAS) ---
window.openModuleModal = (mod = null) => {
    document.getElementById('formModule').reset();
    resetTabs('modTabs');
    document.getElementById('mod_id').value = mod ? mod.id : '';

    // Popula Lista de Pré-requisitos (Outros Módulos)
    const listContainer = document.getElementById('mod-prerequisites-list');
    listContainer.innerHTML = '';
    let hasItems = false;
    globalModules.forEach(m => {
        if (mod && m.id === mod.id) return; // Não listar a si mesmo
        hasItems = true;
        const isChecked = mod && mod.prerequisite_ids && mod.prerequisite_ids.includes(m.id);
        const div = document.createElement('div');
        div.className = 'form-check border-bottom py-1';
        div.innerHTML = `
            <input class="form-check-input mod-prereq-check" type="checkbox" value="${m.id}" id="mod_pre_${m.id}" ${isChecked ? 'checked' : ''}>
            <label class="form-check-label w-100 cursor-pointer" for="mod_pre_${m.id}">
                <small class="text-muted">#${m.ordem}</small> <span class="fw-bold text-dark">${m.title}</span>
            </label>
        `;
        listContainer.appendChild(div);
    });
    if(!hasItems) listContainer.innerHTML = '<div class="text-muted small">Nenhum outro módulo disponível.</div>';

    if (mod) {
        document.getElementById('mod_title').value = mod.title;
        document.getElementById('mod_order').value = mod.ordem;
        document.getElementById('mod_hours').value = mod.carga_horaria || '';
        if (mod.unlock_at) {
            const date = new Date(mod.unlock_at);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
            document.getElementById('mod_unlock_at').value = date.toISOString().slice(0, 16);
        }
    } else {
        document.getElementById('mod_order').value = document.querySelectorAll('.module-card').length + 1;
    }
    if (modalModule) modalModule.show();
};

// --- MODAL DE SEÇÃO (COM REGRAS) ---
window.openSectionModal = (modId, sec = null) => {
    document.getElementById('formSection').reset();
    resetTabs('secTabs');
    document.getElementById('sec_module_id').value = modId;
    document.getElementById('sec_id').value = sec ? sec.id : '';

    // Popula Lista de Pré-requisitos (Outras Seções do mesmo módulo ou de módulos anteriores)
    const listContainer = document.getElementById('sec-prerequisites-list');
    listContainer.innerHTML = '';
    let hasItems = false;
    
    // Varre todos os módulos para listar seções anteriores
    globalModules.forEach(m => {
        if(m.sections) {
            m.sections.forEach(s => {
                if (sec && s.id === sec.id) return; // Ignora a própria seção
                hasItems = true;
                const isChecked = sec && sec.prerequisite_ids && sec.prerequisite_ids.includes(s.id);
                const div = document.createElement('div');
                div.className = 'form-check border-bottom py-1';
                div.innerHTML = `
                    <input class="form-check-input sec-prereq-check" type="checkbox" value="${s.id}" id="sec_pre_${s.id}" ${isChecked ? 'checked' : ''}>
                    <label class="form-check-label w-100 cursor-pointer" for="sec_pre_${s.id}">
                        <small class="text-muted">[${m.title}]</small> #${s.ordem} - <span class="fw-bold text-dark">${s.title}</span>
                    </label>
                `;
                listContainer.appendChild(div);
            });
        }
    });
    if(!hasItems) listContainer.innerHTML = '<div class="text-muted small">Nenhuma outra seção disponível.</div>';

    if (sec) {
        document.getElementById('sec_title').value = sec.title;
        document.getElementById('sec_order').value = sec.ordem;
        if (sec.unlock_at) {
            const date = new Date(sec.unlock_at);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
            document.getElementById('sec_unlock_at').value = date.toISOString().slice(0, 16);
        }
    }
    if (modalSection) modalSection.show();
};

// --- MODAL DE LIÇÃO ---
window.openLessonModal = (modId, secId, les = null) => {
    document.getElementById('formLesson').reset();
    resetTabs('lessonTabs');
    document.getElementById('les_module_id').value = modId;
    document.getElementById('les_section_id').value = secId;
    document.getElementById('les_id').value = les ? les.id : '';

    // Popula Lista com #Ordem
    const listContainer = document.getElementById('prerequisites-list');
    listContainer.innerHTML = '';
    let hasItems = false;
    globalModules.forEach(mod => {
        if(mod.sections) {
            mod.sections.forEach(sec => {
                if(sec.lessons) {
                    sec.lessons.forEach(l => {
                        if (les && l.id === les.id) return;
                        hasItems = true;
                        const isChecked = les && les.prerequisite_ids && les.prerequisite_ids.includes(l.id);
                        const div = document.createElement('div');
                        div.className = 'form-check border-bottom py-1';
                        div.innerHTML = `
                            <input class="form-check-input prereq-check" type="checkbox" value="${l.id}" id="pre_${l.id}" ${isChecked ? 'checked' : ''}>
                            <label class="form-check-label w-100 cursor-pointer" for="pre_${l.id}">
                                <small class="text-muted">[${mod.title}]</small> 
                                <strong>#${l.ordem}</strong> - ${l.title} 
                                <span class="badge bg-light text-secondary border ms-1" style="font-size:0.7em">${l.type}</span>
                            </label>
                        `;
                        listContainer.appendChild(div);
                    });
                }
            });
        }
    });

    if(!hasItems) listContainer.innerHTML = '<div class="text-muted small text-center p-2">Nenhum outro conteúdo disponível.</div>';

    if (les) {
        document.getElementById('les_title').value = les.title;
        document.getElementById('les_type').value = les.type;
        document.getElementById('les_order').value = les.ordem;
        document.getElementById('les_url').value = les.video_url || les.content_url || '';
        document.getElementById('les_desc').value = les.description || '';
        document.getElementById('les_points').value = les.points || 0;
        document.getElementById('les_published').checked = les.is_published !== false;

        if (les.unlock_at) {
            const date = new Date(les.unlock_at);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
            document.getElementById('les_unlock_at').value = date.toISOString().slice(0, 16);
        }
        
        if (les.prerequisite_logic === 'OR') document.getElementById('logic_or').checked = true;
        else document.getElementById('logic_and').checked = true;
    } else {
        document.getElementById('logic_and').checked = true;
    }
    
    if (modalLesson) modalLesson.show();
};

function resetTabs(id) {
    if(window.bootstrap) {
        const triggerEl = document.querySelector(`#${id} button:first-child`);
        if(triggerEl) window.bootstrap.Tab.getOrCreateInstance(triggerEl).show();
    }
}

// =========================================================
// 4. SALVAR E EXCLUIR
// =========================================================
function setupFormListeners() {
    
    // Módulo (Salvar com Restrições)
    document.getElementById('formModule').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('mod_id').value;
        const selectedPrereqs = [];
        document.querySelectorAll('.mod-prereq-check:checked').forEach(chk => selectedPrereqs.push(chk.value));
        const unlockDate = document.getElementById('mod_unlock_at').value || null;

        const payload = {
            course_id: courseId,
            title: document.getElementById('mod_title').value,
            ordem: document.getElementById('mod_order').value,
            carga_horaria: document.getElementById('mod_hours').value || null,
            unlock_at: unlockDate,
            prerequisite_ids: selectedPrereqs.length > 0 ? selectedPrereqs : null
        };
        const op = id ? supabase.from('modules').update(payload).eq('id', id) : supabase.from('modules').insert(payload);
        const { error } = await op;
        if(error) alert("Erro: " + error.message); else { modalModule.hide(); loadModules(); }
    });

    // Seção (Salvar com Restrições)
    document.getElementById('formSection').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('sec_id').value;
        const selectedPrereqs = [];
        document.querySelectorAll('.sec-prereq-check:checked').forEach(chk => selectedPrereqs.push(chk.value));
        const unlockDate = document.getElementById('sec_unlock_at').value || null;

        const payload = {
            module_id: document.getElementById('sec_module_id').value,
            title: document.getElementById('sec_title').value,
            ordem: document.getElementById('sec_order').value,
            unlock_at: unlockDate,
            prerequisite_ids: selectedPrereqs.length > 0 ? selectedPrereqs : null
        };
        const op = id ? supabase.from('sections').update(payload).eq('id', id) : supabase.from('sections').insert(payload);
        const { error } = await op;
        if(error) alert("Erro: " + error.message); else { modalSection.hide(); loadModules(); }
    });

    // Conteúdo (Salvar com Restrições)
    document.getElementById('formLesson').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('les_id').value;
        const type = document.getElementById('les_type').value;

        const selectedPrereqs = [];
        document.querySelectorAll('.prereq-check:checked').forEach(chk => selectedPrereqs.push(chk.value));
        const prereqLogic = document.querySelector('input[name="prereq_logic"]:checked').value;
        const unlockDate = document.getElementById('les_unlock_at').value || null;

        const payload = {
            section_id: document.getElementById('les_section_id').value,
            title: document.getElementById('les_title').value,
            type: type,
            ordem: document.getElementById('les_order').value,
            video_url: ['VIDEO_AULA','VIDEO'].includes(type) ? document.getElementById('les_url').value : null,
            content_url: !['VIDEO_AULA','VIDEO','QUIZ','TAREFA','TEXTO'].includes(type) ? document.getElementById('les_url').value : null,
            description: document.getElementById('les_desc').value,
            points: document.getElementById('les_points').value || 0,
            is_published: document.getElementById('les_published').checked,
            unlock_at: unlockDate, 
            prerequisite_ids: selectedPrereqs.length > 0 ? selectedPrereqs : null,
            prerequisite_logic: prereqLogic
        };
        const op = id ? supabase.from('lessons').update(payload).eq('id', id) : supabase.from('lessons').insert(payload);
        const { error } = await op;
        if(error) alert("Erro: " + error.message); else { modalLesson.hide(); loadModules(); }
    });
}

async function deleteItem(table, id) {
    if (!confirm("Excluir item?")) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) alert("Erro: " + error.message); else loadModules();
}