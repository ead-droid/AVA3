import { supabase } from './supabaseClient.js';

// === CONFIGURAÇÃO ===
const params = new URLSearchParams(window.location.search);
const courseId = params.get('id') || params.get('courseId');

let modalModule = null;
let modalSection = null;
let modalLesson = null;
let globalModules = []; 

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
        await Promise.all([
            loadCourseData(),
            loadModules(),
            loadLinkedClasses()
        ]);
        setupFormListeners();     
    } catch (error) {
        console.error("Erro fatal:", error);
    }
});

// === UX: Controle das Abas ===
window.toggleGradingTab = () => {
    const typeEl = document.getElementById('les_type');
    if(!typeEl) return;
    
    const type = typeEl.value;
    const isGraded = ['QUIZ', 'TAREFA'].includes(type);
    const tabBtn = document.getElementById('btn-tab-grading');
    const quizOpts = document.getElementById('quiz-options-area');

    if(tabBtn) tabBtn.style.display = isGraded ? 'block' : 'none';
    if(quizOpts) quizOpts.style.display = (type === 'QUIZ') ? 'block' : 'none';
};

// =========================================================
// 1. CARREGAR DADOS
// =========================================================
async function loadCourseData() {
    const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).single();
    if (course) {
        document.getElementById('header-title').textContent = course.title;
        document.getElementById('course-id-badge').textContent = `ID: ${course.id}`;
        document.getElementById('edit_title').value = course.title;
        document.getElementById('edit_desc').value = course.description || '';
        if(document.getElementById('edit_status')) 
            document.getElementById('edit_status').value = (course.status === 'published') ? 'published' : 'draft';
    }
}

async function loadModules() {
    const container = document.getElementById('modules-list');
    if (!container) return;
    container.innerHTML = ''; 

    const { data: modules } = await supabase
        .from('modules')
        .select(`*, sections (*, lessons (*))`)
        .eq('course_id', courseId)
        .order('ordem', { ascending: true });

    globalModules = modules || [];

    if (!modules || modules.length === 0) {
        document.getElementById('modules-empty').style.display = 'block';
        return;
    }
    document.getElementById('modules-empty').style.display = 'none';

    // Ordenação visual
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

// =========================================================
// 2. RENDERIZAÇÃO (Visual preservado)
// =========================================================
function renderModuleItem(mod, container) {
    const tpl = document.getElementById('tpl-module');
    const clone = tpl.content.cloneNode(true);
    
    clone.querySelector('.mod-badge').textContent = mod.ordem;
    clone.querySelector('.mod-title').textContent = mod.title;
    
    // Verifica regras no settings ou colunas antigas
    const s = mod.settings || {};
    if (s.availability?.available_from || mod.unlock_at || s.prerequisites?.ids?.length) {
        clone.querySelector('.mod-lock-badge').style.display = 'inline-flex';
    }

    clone.querySelector('.btn-edit').onclick = () => openModuleModal(mod);
    clone.querySelector('.btn-del').onclick = () => deleteItem('modules', mod.id);
    clone.querySelector('.btn-add-sec').onclick = () => openSectionModal(mod.id);

    const secContainer = clone.querySelector('.sections-container');
    if (mod.sections && mod.sections.length > 0) {
        mod.sections.forEach(sec => renderSectionItem(sec, secContainer, mod.id));
    } else {
        secContainer.innerHTML = `<div class="p-4 text-center text-muted border-top bg-light small">Nenhuma seção.</div>`;
    }
    container.appendChild(clone);
}

function renderSectionItem(sec, container, modId) {
    const tpl = document.getElementById('tpl-section');
    const clone = tpl.content.cloneNode(true);

    clone.querySelector('.sec-badge').textContent = sec.ordem;
    clone.querySelector('.sec-title').textContent = sec.title;

    const s = sec.settings || {};
    if (s.availability?.available_from || sec.unlock_at) {
        clone.querySelector('.sec-lock-badge').style.display = 'inline-flex';
    }

    clone.querySelector('.btn-add-content').onclick = () => openLessonModal(modId, sec.id);
    clone.querySelector('.btn-edit').onclick = () => openSectionModal(modId, sec);
    clone.querySelector('.btn-del').onclick = () => deleteItem('sections', sec.id);

    const contentContainer = clone.querySelector('.content-container');
    if (sec.lessons && sec.lessons.length > 0) {
        sec.lessons.forEach(les => renderLessonItem(les, contentContainer, modId, sec.id));
    } else {
        contentContainer.innerHTML = `<div class="p-2 text-center text-muted small fst-italic">Vazio.</div>`;
    }
    container.appendChild(clone);
}

function renderLessonItem(les, container, modId, secId) {
    const tpl = document.getElementById('tpl-lesson');
    const clone = tpl.content.cloneNode(true);
    
    clone.querySelector('.lesson-order').textContent = les.ordem;
    clone.querySelector('.lesson-title').textContent = les.title;
    
    // Ícones e Tipos (Funcionalidade Restaurada)
    const iconMap = { 
        'VIDEO_AULA': 'bx-video', 'QUIZ': 'bx-trophy', 
        'TAREFA': 'bx-task', 'PDF': 'bx-file-pdf', 
        'TEXTO': 'bx-text', 'MATERIAL': 'bx-link', 'AVISO': 'bx-bell'
    };
    clone.querySelector('.icon-circle i').className = `bx ${iconMap[les.type] || 'bx-file'}`;
    clone.querySelector('.lesson-type').textContent = les.type;

    // Badges de Regras (Lê settings ou colunas antigas)
    const st = les.settings || {};
    
    if (st.availability?.available_from || les.unlock_at) 
        clone.querySelector('.condition-date-badge').style.display = 'inline-flex';
    
    if (st.prerequisites?.ids?.length || les.prerequisite_ids?.length) 
        clone.querySelector('.condition-lock-badge').style.display = 'inline-flex';
    
    const pts = st.grading?.points_max ?? (les.points || 0);
    if (pts > 0) {
        const ptBadge = clone.querySelector('.lesson-points-badge');
        ptBadge.textContent = `${pts} pts`;
        ptBadge.style.display = 'inline-flex';
    }

    // Botões Específicos (Restaurados)
    const actionsArea = clone.querySelector('.actions-area');
    if (les.type === 'QUIZ') addBtn('tpl-btn-quiz', `quiz-builder.html?id=${les.id}`, actionsArea);
    if (les.type === 'TAREFA') addBtn('tpl-btn-task', `task-builder.html?id=${les.id}`, actionsArea);
    if (les.type === 'TEXTO') addBtn('tpl-btn-text', `text-builder.html?id=${les.id}`, actionsArea);

    clone.querySelector('.btn-edit').onclick = () => openLessonModal(modId, secId, les);
    clone.querySelector('.btn-del').onclick = () => deleteItem('lessons', les.id);

    container.appendChild(clone);
}

function addBtn(tplId, href, container) {
    const tpl = document.getElementById(tplId);
    if (tpl) {
        const btn = tpl.content.cloneNode(true).querySelector('a');
        btn.href = href;
        container.prepend(btn);
    }
}

// =========================================================
// 3. MODAIS (Preenchimento de formulários)
// =========================================================

// --- LIÇÃO (A LÓGICA MAIS IMPORTANTE) ---
window.openLessonModal = (modId, secId, les = null) => {
    document.getElementById('formLesson').reset();
    resetTabs('lessonTabs');
    document.getElementById('les_module_id').value = modId;
    document.getElementById('les_section_id').value = secId;
    document.getElementById('les_id').value = les ? les.id : '';

    // Pré-requisitos
    const list = document.getElementById('prerequisites-list');
    list.innerHTML = '';
    globalModules.forEach(m => {
        if(m.sections) m.sections.forEach(s => {
            if(s.lessons) s.lessons.forEach(l => {
                if(les && l.id === les.id) return;
                const isChecked = les?.settings?.prerequisites?.ids?.includes(l.id) || les?.prerequisite_ids?.includes(l.id);
                list.innerHTML += `<div class="form-check border-bottom py-1"><input class="form-check-input prereq-check" type="checkbox" value="${l.id}" ${isChecked?'checked':''}><label class="form-check-label small ms-2">[${m.title}] ${l.title}</label></div>`;
            });
        });
    });

    if(les) {
        // Campos Básicos (Tabela lessons)
        document.getElementById('les_title').value = les.title;
        document.getElementById('les_type').value = les.type;
        document.getElementById('les_order').value = les.ordem;
        document.getElementById('les_url').value = les.video_url || les.content_url || ''; // Restaurado: carrega de video_url
        document.getElementById('les_desc').value = les.description || '';
        document.getElementById('les_published').checked = les.is_published !== false;
        document.getElementById('les_required').checked = les.is_required !== false;

        // Settings JSON (Novas Regras)
        const s = les.settings || {};
        const avail = s.availability || {};
        const grading = s.grading || {};
        const completion = s.completion || {};
        const attempts = s.attempts || {};

        // Datas
        const dateFrom = avail.available_from || les.unlock_at;
        document.getElementById('les_avail_from').value = fmtDate(dateFrom);
        document.getElementById('les_avail_until').value = fmtDate(avail.available_until);
        document.getElementById('les_view_after').checked = avail.view_after_close !== false;
        
        // Avaliação e Tentativas
        document.getElementById('les_points_max').value = grading.points_max ?? (les.points || 0);
        document.getElementById('les_weight').value = grading.weight ?? 1;
        document.getElementById('les_include_avg').checked = grading.include_in_average !== false;
        document.getElementById('les_completion_policy').value = completion.policy || 'on_submit';
        document.getElementById('les_min_grade').value = completion.min_grade_to_complete || '';
        document.getElementById('les_attempts').value = attempts.attempts_max || 0;
        document.getElementById('les_grading_method').value = attempts.grading_method || 'highest';
        
        if(s.prerequisites?.logic === 'OR') document.getElementById('logic_or').checked = true;
    } else {
        document.getElementById('logic_and').checked = true;
    }
    
    window.toggleGradingTab();
    if (modalLesson) modalLesson.show();
};

// =========================================================
// 4. SALVAR (Onde a mágica acontece)
// =========================================================

document.getElementById('formLesson').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('les_id').value;
    const type = document.getElementById('les_type').value;
    const preIds = [...document.querySelectorAll('.prereq-check:checked')].map(c => c.value);
    const availFrom = document.getElementById('les_avail_from').value || null;
    
    // 1. Monta o Objeto JSON NOVO
    const settings = {
        availability: {
            available_from: availFrom,
            available_until: document.getElementById('les_avail_until').value || null,
            view_after_close: document.getElementById('les_view_after').checked
        },
        prerequisites: {
            ids: preIds,
            logic: document.getElementById('logic_or').checked ? 'OR' : 'AND'
        },
        grading: {
            points_max: parseFloat(document.getElementById('les_points_max').value) || 0,
            weight: parseFloat(document.getElementById('les_weight').value) || 1,
            include_in_average: document.getElementById('les_include_avg').checked
        },
        completion: {
            policy: document.getElementById('les_completion_policy').value,
            min_grade_to_complete: parseFloat(document.getElementById('les_min_grade').value) || null
        },
        attempts: {
            attempts_max: parseInt(document.getElementById('les_attempts').value) || 0,
            grading_method: document.getElementById('les_grading_method').value
        }
    };

    // 2. Monta o Payload para o Banco (Compatível com ANTIGO e NOVO)
    const payload = {
        section_id: document.getElementById('les_section_id').value,
        title: document.getElementById('les_title').value,
        type: type,
        ordem: document.getElementById('les_order').value,
        
        // Garante que as colunas clássicas recebam os dados (Isso evita erros de "missing column" em views antigas)
        video_url: ['VIDEO_AULA','VIDEO'].includes(type) ? document.getElementById('les_url').value : null,
        content_url: !['VIDEO_AULA','VIDEO','QUIZ','TAREFA','TEXTO'].includes(type) ? document.getElementById('les_url').value : null,
        description: document.getElementById('les_desc').value,
        points: settings.grading.points_max,
        is_published: document.getElementById('les_published').checked,
        is_required: document.getElementById('les_required').checked,
        unlock_at: availFrom,
        prerequisite_ids: preIds, 
        
        // Salva o JSON completo
        settings: settings 
    };

    const op = id ? supabase.from('lessons').update(payload).eq('id', id) : supabase.from('lessons').insert(payload);
    const { error } = await op;
    if(error) alert("Erro: " + error.message); else { modalLesson.hide(); loadModules(); }
});

// Outras funções auxiliares (Módulo, Seção, Delete) mantidas idênticas
window.openModuleModal = (mod = null) => { /* Mesma lógica, salva em settings e colunas antigas */ 
    document.getElementById('formModule').reset();
    resetTabs('modTabs');
    document.getElementById('mod_id').value = mod ? mod.id : '';
    const list = document.getElementById('mod-prerequisites-list');
    list.innerHTML = '';
    globalModules.forEach(m => {
        if (mod && m.id === mod.id) return;
        const isChecked = mod?.settings?.prerequisite_ids?.includes(m.id) || mod?.prerequisite_ids?.includes(m.id);
        list.innerHTML += `<div class="form-check border-bottom py-1"><input class="form-check-input mod-prereq-check" type="checkbox" value="${m.id}" ${isChecked?'checked':''}><label class="form-check-label small ms-2">#${m.ordem} ${m.title}</label></div>`;
    });
    if(mod) {
        document.getElementById('mod_title').value = mod.title;
        document.getElementById('mod_order').value = mod.ordem;
        document.getElementById('mod_hours').value = mod.carga_horaria || '';
        const s = mod.settings || {};
        document.getElementById('mod_avail_from').value = fmtDate(s.availability?.available_from || mod.unlock_at);
        document.getElementById('mod_avail_until').value = fmtDate(s.availability?.available_until);
    } 
    if(modalModule) modalModule.show();
};

document.getElementById('formModule').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('mod_id').value;
    const preIds = [...document.querySelectorAll('.mod-prereq-check:checked')].map(c => c.value);
    const availFrom = document.getElementById('mod_avail_from').value || null;
    
    const settings = {
        availability: { available_from: availFrom, available_until: document.getElementById('mod_avail_until').value || null },
        prerequisite_ids: preIds
    };
    const payload = {
        course_id: courseId,
        title: document.getElementById('mod_title').value,
        ordem: document.getElementById('mod_order').value,
        carga_horaria: document.getElementById('mod_hours').value || null,
        unlock_at: availFrom, prerequisite_ids: preIds, settings: settings
    };
    const op = id ? supabase.from('modules').update(payload).eq('id', id) : supabase.from('modules').insert(payload);
    const { error } = await op;
    if(error) alert(error.message); else { modalModule.hide(); loadModules(); }
});

window.openSectionModal = (modId, sec = null) => {
    document.getElementById('formSection').reset();
    document.getElementById('sec_module_id').value = modId;
    document.getElementById('sec_id').value = sec ? sec.id : '';
    if(sec) {
        document.getElementById('sec_title').value = sec.title;
        document.getElementById('sec_order').value = sec.ordem;
        const s = sec.settings || {};
        document.getElementById('sec_avail_from').value = fmtDate(s.availability?.available_from || sec.unlock_at);
    }
    if(modalSection) modalSection.show();
};

document.getElementById('formSection').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('sec_id').value;
    const availFrom = document.getElementById('sec_avail_from').value || null;
    const payload = {
        module_id: document.getElementById('sec_module_id').value,
        title: document.getElementById('sec_title').value,
        ordem: document.getElementById('sec_order').value,
        unlock_at: availFrom,
        settings: { availability: { available_from: availFrom } }
    };
    const op = id ? supabase.from('sections').update(payload).eq('id', id) : supabase.from('sections').insert(payload);
    const { error } = await op;
    if(error) alert(error.message); else { modalSection.hide(); loadModules(); }
});

function fmtDate(isoStr) {
    if(!isoStr) return '';
    const d = new Date(isoStr);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
}

function resetTabs(id) {
    if(window.bootstrap) {
        const triggerEl = document.querySelector(`#${id} button:first-child`);
        if(triggerEl) window.bootstrap.Tab.getOrCreateInstance(triggerEl).show();
    }
}

async function loadLinkedClasses() {
    const tbody = document.getElementById('linked-classes-list');
    if (!tbody) return;
    tbody.innerHTML = '';
    const { data: classes } = await supabase.from('classes').select('*, class_enrollments(count)').eq('course_id', courseId);
    if (!classes || classes.length === 0) { document.getElementById('classes-empty').style.display = 'block'; return; }
    document.getElementById('classes-empty').style.display = 'none';
    classes.forEach(cls => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="ps-4 fw-bold">${cls.name}</td><td>${cls.code||'-'}</td><td><span class="badge bg-secondary">${cls.class_enrollments?.[0]?.count||0} alunos</span></td><td>${cls.start_date?new Date(cls.start_date).toLocaleDateString():'Indefinido'}</td><td class="text-end pe-4"><a href="class-manager.html" class="btn btn-sm btn-outline-primary fw-bold">Gerenciar</a></td>`;
        tbody.appendChild(tr);
    });
}

async function deleteItem(table, id) { 
    if(confirm("Excluir?")) { await supabase.from(table).delete().eq('id', id); loadModules(); } 
}