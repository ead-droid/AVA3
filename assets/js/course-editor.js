import { supabase } from './supabaseClient.js';

// === CONFIGURAÇÃO E UTILITÁRIOS ===
const params = new URLSearchParams(window.location.search);
const courseId = params.get('id') || params.get('courseId');

// Globais para Modais
let modalModule = null;
let modalSection = null;
let modalLesson = null;

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', async () => {
    if (!courseId) {
        alert("ID do curso não encontrado.");
        window.location.href = 'admin.html';
        return;
    }

    // Inicializa Modais (Bootstrap 5)
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
        console.error("Erro fatal ao iniciar editor:", error);
    }
});

// =========================================================
// 1. CARREGAR DADOS DO CURSO
// =========================================================
async function loadCourseData() {
    const { data: course, error } = await supabase.from('courses').select('*').eq('id', courseId).single();

    if (error) {
        console.error("Erro ao buscar curso:", error);
        document.getElementById('header-title').textContent = "Erro ao carregar";
        return;
    }

    document.getElementById('header-title').textContent = course.title;
    document.getElementById('course-id-badge').textContent = `ID: ${course.id}`;

    const titleInput = document.getElementById('edit_title');
    if (titleInput) titleInput.value = course.title;

    const descInput = document.getElementById('edit_desc');
    if (descInput) descInput.value = course.description || '';

    const statusSelect = document.getElementById('edit_status');
    if (statusSelect) {
        const st = (course.status || '').toUpperCase();
        statusSelect.value = (st === 'PUBLISHED' || st === 'CONCLUIDO') ? 'published' : 'draft';
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

    // Dados Básicos
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

    if (les.points > 0) {
        const badge = clone.querySelector('.lesson-points');
        badge.style.display = 'inline-block';
        badge.textContent = `${les.points} pts`;
        badge.className = 'badge bg-success ms-2';
    }

    // --- RESTAURAÇÃO: BOTÕES ESPECÍFICOS DE CONFIGURAÇÃO ---
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

    // Ações Padrão
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
    const emptyDiv = document.getElementById('classes-empty');
    if (!tbody) return;

    tbody.innerHTML = '';
    const { data: classes } = await supabase.from('classes').select('*, class_enrollments(count)').eq('course_id', courseId);

    if (!classes || classes.length === 0) {
        if (emptyDiv) emptyDiv.style.display = 'block';
        return;
    }
    if (emptyDiv) emptyDiv.style.display = 'none';

    classes.forEach(cls => {
        const count = cls.class_enrollments ? cls.class_enrollments[0].count : 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4 fw-bold">${cls.name}</td>
            <td><code>${cls.access_code || '-'}</code></td>
            <td><span class="badge bg-secondary">${count} alunos</span></td>
            <td>${cls.start_date ? new Date(cls.start_date).toLocaleDateString() : 'Indefinido'}</td>
            <td class="text-end pe-4"><a href="class-manager.html" class="btn btn-sm btn-outline-primary fw-bold">Gerenciar</a></td>
        `;
        tbody.appendChild(tr);
    });
}

// Modais
window.openModuleModal = (mod = null) => {
    document.getElementById('formModule').reset();
    document.getElementById('mod_id').value = mod ? mod.id : '';
    if (mod) {
        document.getElementById('mod_title').value = mod.title;
        document.getElementById('mod_order').value = mod.ordem;
        document.getElementById('mod_hours').value = mod.carga_horaria || '';
    } else {
        document.getElementById('mod_order').value = document.querySelectorAll('.module-card').length + 1;
    }
    if (modalModule) modalModule.show();
};

window.openSectionModal = (modId, sec = null) => {
    document.getElementById('formSection').reset();
    document.getElementById('sec_module_id').value = modId;
    document.getElementById('sec_id').value = sec ? sec.id : '';
    if (sec) {
        document.getElementById('sec_title').value = sec.title;
        document.getElementById('sec_order').value = sec.ordem;
    }
    if (modalSection) modalSection.show();
};

window.openLessonModal = (modId, secId, les = null) => {
    document.getElementById('formLesson').reset();
    document.getElementById('les_module_id').value = modId;
    document.getElementById('les_section_id').value = secId;
    document.getElementById('les_id').value = les ? les.id : '';

    if (les) {
        document.getElementById('les_title').value = les.title;
        document.getElementById('les_type').value = les.type;
        document.getElementById('les_order').value = les.ordem;
        document.getElementById('les_url').value = les.video_url || les.content_url || '';
        document.getElementById('les_desc').value = les.description || '';
        document.getElementById('les_points').value = les.points || 0;
        document.getElementById('les_published').checked = les.is_published !== false;
    }
    if (modalLesson) modalLesson.show();
};

// =========================================================
// 4. SALVAR E EXCLUIR
// =========================================================
function setupFormListeners() {
    
    // Configurações do Curso
    const formCourse = document.getElementById('formEditCourse');
    if (formCourse) {
        formCourse.addEventListener('submit', async (e) => {
            e.preventDefault();
            const updates = {
                title: document.getElementById('edit_title').value,
                description: document.getElementById('edit_desc').value,
                status: document.getElementById('edit_status').value === 'published' ? 'CONCLUIDO' : 'EM_CONSTRUCAO'
            };
            const { error } = await supabase.from('courses').update(updates).eq('id', courseId);
            if (error) alert("Erro: " + error.message);
            else { alert("Atualizado!"); loadCourseData(); }
        });
    }

    // Módulo
    document.getElementById('formModule').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('mod_id').value;
        const payload = {
            course_id: courseId,
            title: document.getElementById('mod_title').value,
            ordem: document.getElementById('mod_order').value,
            carga_horaria: document.getElementById('mod_hours').value || null
        };
        const op = id ? supabase.from('modules').update(payload).eq('id', id) : supabase.from('modules').insert(payload);
        const { error } = await op;
        if(error) alert("Erro: " + error.message); else { modalModule.hide(); loadModules(); }
    });

    // Seção
    document.getElementById('formSection').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('sec_id').value;
        const payload = {
            module_id: document.getElementById('sec_module_id').value,
            title: document.getElementById('sec_title').value,
            ordem: document.getElementById('sec_order').value
        };
        const op = id ? supabase.from('sections').update(payload).eq('id', id) : supabase.from('sections').insert(payload);
        const { error } = await op;
        if(error) alert("Erro: " + error.message); else { modalSection.hide(); loadModules(); }
    });

    // Conteúdo (Aula)
    document.getElementById('formLesson').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('les_id').value;
        const type = document.getElementById('les_type').value;
        const payload = {
            section_id: document.getElementById('les_section_id').value,
            title: document.getElementById('les_title').value,
            type: type,
            ordem: document.getElementById('les_order').value,
            video_url: ['VIDEO_AULA','VIDEO'].includes(type) ? document.getElementById('les_url').value : null,
            content_url: !['VIDEO_AULA','VIDEO','QUIZ','TAREFA','TEXTO'].includes(type) ? document.getElementById('les_url').value : null,
            description: document.getElementById('les_desc').value,
            points: document.getElementById('les_points').value || 0,
            is_published: document.getElementById('les_published').checked
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