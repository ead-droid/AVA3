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
            loadModules(), // Agora carrega e ativa o Drag & Drop
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
    const quizOpts = document.getElementById('quiz-options-area');
    const tabBtn = document.getElementById('btn-tab-grading');
    if(tabBtn) tabBtn.style.display = 'block'; 
    
    if(quizOpts) {
        quizOpts.style.display = (type === 'QUIZ') ? 'block' : 'none';
    }
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
        document.getElementById('edit_slug').value = course.slug || '';
        document.getElementById('edit_desc').value = course.description || '';
        document.getElementById('edit_hours').value = course.carga_horaria_horas || course.total_hours || '';
        document.getElementById('edit_img').value = course.image_url || '';
        
        if(document.getElementById('edit_passing')) document.getElementById('edit_passing').value = course.passing_grade || '';
        if(document.getElementById('edit_status')) document.getElementById('edit_status').value = (course.status === 'published') ? 'published' : 'draft';
        if(document.getElementById('edit_type')) document.getElementById('edit_type').value = course.tipo || 'OUTRO';
        if(document.getElementById('edit_enroll')) document.getElementById('edit_enroll').value = course.status_inscricao || 'FECHADO';
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

    // Renderiza e Ordena na memória antes de exibir
    modules.forEach(mod => {
        if (mod.sections) {
            mod.sections.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
            mod.sections.forEach(sec => {
                if (sec.lessons) sec.lessons.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
            });
        }
        renderModuleItem(mod, container);
    });

    // --- REINSERIDO: INICIALIZA O DRAG & DROP APÓS RENDERIZAR ---
    initSortable();
}

// =========================================================
// 2. RENDERIZAÇÃO (Com atributos data-id para Drag & Drop)
// =========================================================
function renderModuleItem(mod, container) {
    const tpl = document.getElementById('tpl-module');
    const clone = tpl.content.cloneNode(true);
    
    // Configura o ID no elemento pai para o Drag & Drop funcionar
    const card = clone.querySelector('.module-card'); // Certifique-se que seu HTML tem essa classe no div principal
    if(card) card.setAttribute('data-id', mod.id);

    clone.querySelector('.mod-badge').textContent = mod.ordem;
    clone.querySelector('.mod-title').textContent = mod.title;
    
    const s = mod.settings || {};
    if (s.availability?.available_from || mod.unlock_at || s.prerequisites?.ids?.length) {
        clone.querySelector('.mod-lock-badge').style.display = 'inline-flex';
    }

    const btnEdit = clone.querySelector('.btn-edit');
    const btnDel = clone.querySelector('.btn-del');
    const btnAddSec = clone.querySelector('.btn-add-sec');

    btnEdit.onclick = (e) => { e.stopPropagation(); openModuleModal(mod); };
    btnDel.onclick = (e) => { e.stopPropagation(); deleteItem('modules', mod.id); };
    btnAddSec.onclick = (e) => { e.stopPropagation(); e.preventDefault(); openSectionModal(mod.id); };

    const secContainer = clone.querySelector('.sections-container');
    // Adiciona ID para saber de qual módulo é a seção
    secContainer.setAttribute('data-module-id', mod.id); 

    if (mod.sections && mod.sections.length > 0) {
        mod.sections.forEach(sec => renderSectionItem(sec, secContainer, mod.id));
    } else {
        // Remove mensagem de vazio se quiser permitir drop em área vazia, ou mantenha
        secContainer.innerHTML = `<div class="p-4 text-center text-muted border-top bg-light small empty-placeholder">Nenhuma seção.</div>`;
    }
    container.appendChild(clone);
}

function renderSectionItem(sec, container, modId) {
    const tpl = document.getElementById('tpl-section');
    const clone = tpl.content.cloneNode(true);

    const sectionBox = clone.querySelector('.section-box'); // Certifique-se que seu HTML tem essa classe
    if(sectionBox) sectionBox.setAttribute('data-id', sec.id);

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
    contentContainer.setAttribute('data-section-id', sec.id); // Para saber onde a aula caiu

    if (sec.lessons && sec.lessons.length > 0) {
        sec.lessons.forEach(les => renderLessonItem(les, contentContainer, modId, sec.id));
    } else {
        contentContainer.innerHTML = `<div class="p-2 text-center text-muted small fst-italic empty-placeholder">Arraste aulas para cá.</div>`;
    }
    container.appendChild(clone);
}

function renderLessonItem(les, container, modId, secId) {
    const tpl = document.getElementById('tpl-lesson');
    const clone = tpl.content.cloneNode(true);
    
    const lessonItem = clone.querySelector('.lesson-item');
    if(lessonItem) lessonItem.setAttribute('data-id', les.id);

    clone.querySelector('.lesson-order').textContent = les.ordem;
    clone.querySelector('.lesson-title').textContent = les.title;
    
    const iconMap = { 
        'VIDEO_AULA': 'bx-video', 'VIDEO': 'bx-video', 
        'QUIZ': 'bx-trophy', 'TAREFA': 'bx-task', 
        'PDF': 'bx-file-pdf', 'TEXTO': 'bx-text', 
        'MATERIAL': 'bx-link', 'AVISO': 'bx-bell'
    };
    clone.querySelector('.icon-circle i').className = `bx ${iconMap[les.type] || 'bx-file'}`;
    clone.querySelector('.lesson-type').textContent = les.type;

    // --- REINSERIDO: BOTÃO DE VISUALIZAR ---
    // Procura se já existe botão de view, se não cria (dependendo do template)
    // Assumindo que o TPL tem um lugar para botões
    const btnEdit = clone.querySelector('.btn-edit');
    if(btnEdit) {
        const btnView = document.createElement('button');
        btnView.className = 'btn btn-sm btn-icon text-primary me-1';
        btnView.title = 'Visualizar';
        btnView.innerHTML = `<i class='bx bx-show'></i>`;
        btnView.onclick = (e) => { e.stopPropagation(); openPreview(les); };
        btnEdit.parentNode.insertBefore(btnView, btnEdit);
    }

    const st = les.settings || {};
    if (st.availability?.available_from || les.unlock_at) clone.querySelector('.condition-date-badge').style.display = 'inline-flex';
    if (st.prerequisites?.ids?.length || les.prerequisite_ids?.length) clone.querySelector('.condition-lock-badge').style.display = 'inline-flex';
    
    const pts = st.grading?.points_max ?? (les.points || 0);
    if (pts > 0) {
        const ptBadge = clone.querySelector('.lesson-points-badge');
        ptBadge.textContent = `${pts} pts`;
        ptBadge.style.display = 'inline-flex';
    }

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
// 3. LOGICA DE ARRASTAR E SOLTAR (SortableJS) - REINSERIDA
// =========================================================
function initSortable() {
    if (typeof Sortable === 'undefined') return;

    // 1. Módulos
    const modulesList = document.getElementById('modules-list');
    if (modulesList) {
        new Sortable(modulesList, {
            animation: 150,
            handle: '.mod-handle', // Adicione classe .mod-handle no seu HTML do modulo ou remova para arrastar pelo card todo
            ghostClass: 'bg-light',
            onEnd: (evt) => saveOrder('modules', evt.from)
        });
    }

    // 2. Seções (dentro de módulos)
    document.querySelectorAll('.sections-container').forEach(el => {
        new Sortable(el, {
            group: 'sections',
            animation: 150,
            ghostClass: 'bg-light',
            onEnd: (evt) => {
                const modId = evt.to.getAttribute('data-module-id');
                saveOrder('sections', evt.to, modId);
            }
        });
    });

    // 3. Aulas (dentro de seções)
    document.querySelectorAll('.content-container').forEach(el => {
        new Sortable(el, {
            group: 'lessons',
            animation: 150,
            ghostClass: 'bg-light',
            onEnd: (evt) => {
                const secId = evt.to.getAttribute('data-section-id');
                saveOrder('lessons', evt.to, secId);
            }
        });
    });
}

async function saveOrder(type, container, parentId = null) {
    // Remove os placeholders "Vazio" antes de contar
    const items = [...container.children].filter(c => !c.classList.contains('empty-placeholder'));
    
    const updates = items.map((item, index) => {
        const id = item.getAttribute('data-id');
        if(!id) return null;

        const payload = { ordem: index + 1 };
        
        if (type === 'sections' && parentId) payload.module_id = parentId;
        if (type === 'lessons' && parentId) payload.section_id = parentId;

        return supabase.from(type).update(payload).eq('id', id);
    }).filter(p => p !== null);

    await Promise.all(updates);
    // Opcional: Recarregar para garantir numeração visual correta
    // loadModules(); 
}

// =========================================================
// 4. FUNÇÃO DE PREVIEW (VISUALIZAR) - REINSERIDA
// =========================================================
window.openPreview = async (lesson) => {
    // Requer um Modal HTML com id="modalPreviewLesson"
    const modalEl = document.getElementById('modalPreviewLesson');
    if(!modalEl) { alert("Aula: " + lesson.title); return; }
    
    const modal = new bootstrap.Modal(modalEl);
    const contentDiv = document.getElementById('previewContent'); // ID do body do modal
    const titleDiv = document.getElementById('previewTitle'); // ID do titulo do modal
    
    if(titleDiv) titleDiv.textContent = lesson.title;
    if(contentDiv) {
        contentDiv.innerHTML = '<div class="text-center py-5"><div class="spinner-border"></div></div>';
        modal.show();

        // Se o conteúdo já estiver no objeto lesson (depende do select inicial)
        // Se não tiver, faz fetch:
        let fullLesson = lesson;
        if(lesson.type === 'TEXTO' && !lesson.content) {
             const { data } = await supabase.from('lessons').select('*').eq('id', lesson.id).single();
             fullLesson = data;
        }

        let html = '';
        if (fullLesson.type === 'VIDEO_AULA' || fullLesson.type === 'VIDEO') {
            const url = fullLesson.video_url || '';
            let embedUrl = url;
            if (url.includes('youtu')) {
                const vidId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
                embedUrl = `https://www.youtube.com/embed/${vidId}`;
            }
            html = `<div class="ratio ratio-16x9"><iframe src="${embedUrl}" allowfullscreen></iframe></div>`;
        } else if (fullLesson.type === 'TEXTO') {
            html = `<div class="p-3 bg-white border rounded">${fullLesson.content || 'Sem conteúdo.'}</div>`;
        } else {
            html = `<div class="alert alert-info">Pré-visualização simplificada indisponível para ${fullLesson.type}. <br><a href="${fullLesson.content_url}" target="_blank">Abrir Link</a></div>`;
        }
        
        contentDiv.innerHTML = html;
    }
};

// =========================================================
// 5. MODAIS (Formulários)
// =========================================================

window.openModuleModal = (mod = null) => {
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
        document.getElementById('mod_passing').value = s.passing_grade || '';
        if(s.availability) {
            document.getElementById('mod_avail_from').value = fmtDate(s.availability.available_from || mod.unlock_at);
            document.getElementById('mod_avail_until').value = fmtDate(s.availability.available_until);
        }
    } else {
        document.getElementById('mod_order').value = globalModules.length + 1;
    }
    if (modalModule) modalModule.show();
};

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

window.openLessonModal = (modId, secId, les = null) => {
    document.getElementById('formLesson').reset();
    resetTabs('lessonTabs');
    document.getElementById('les_module_id').value = modId;
    document.getElementById('les_section_id').value = secId;
    document.getElementById('les_id').value = les ? les.id : '';

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
        document.getElementById('les_title').value = les.title;
        document.getElementById('les_type').value = les.type;
        document.getElementById('les_order').value = les.ordem;
        document.getElementById('les_url').value = les.video_url || les.content_url || '';
        document.getElementById('les_desc').value = les.description || '';
        document.getElementById('les_published').checked = les.is_published !== false;
        document.getElementById('les_required').checked = les.is_required !== false;

        const s = les.settings || {};
        const avail = s.availability || {};
        const grading = s.grading || {};
        const completion = s.completion || {};
        const attempts = s.attempts || {};

        document.getElementById('les_avail_from').value = fmtDate(avail.available_from || les.unlock_at);
        document.getElementById('les_avail_until').value = fmtDate(avail.available_until);
        document.getElementById('les_view_after').checked = avail.view_after_close !== false;
        
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
// 6. LISTENERS (SUBMITS)
// =========================================================

function setupFormListeners() {
    
    const formSettings = document.getElementById('formEditCourse');
    if(formSettings) {
        formSettings.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.submitter;
            const originalText = btn.innerHTML;
            btn.disabled = true; btn.innerHTML = "Salvando...";

            const updates = {
                title: document.getElementById('edit_title').value,
                description: document.getElementById('edit_desc').value,
                status: document.getElementById('edit_status').value,
                carga_horaria_horas: parseFloat(document.getElementById('edit_hours').value) || null,
                total_hours: parseFloat(document.getElementById('edit_hours').value) || null,
                passing_grade: parseFloat(document.getElementById('edit_passing').value) || null,
                tipo: document.getElementById('edit_type').value,
                status_inscricao: document.getElementById('edit_enroll').value,
                image_url: document.getElementById('edit_img').value
            };

            const { error } = await supabase.from('courses').update(updates).eq('id', courseId);
            
            btn.disabled = false; btn.innerHTML = originalText;
            if (error) alert("Erro ao salvar: " + error.message);
            else {
                alert("Configurações atualizadas!");
                loadCourseData();
            }
        });
    }

    document.getElementById('formLesson').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('les_id').value;
        const type = document.getElementById('les_type').value;
        const preIds = [...document.querySelectorAll('.prereq-check:checked')].map(c => c.value);
        const availFrom = document.getElementById('les_avail_from').value || null;
        
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

        const payload = {
            section_id: document.getElementById('les_section_id').value,
            title: document.getElementById('les_title').value,
            type: type,
            ordem: document.getElementById('les_order').value,
            
            video_url: ['VIDEO_AULA','VIDEO'].includes(type) ? document.getElementById('les_url').value : null,
            content_url: !['VIDEO_AULA','VIDEO','QUIZ','TAREFA','TEXTO'].includes(type) ? document.getElementById('les_url').value : null,
            description: document.getElementById('les_desc').value,
            points: settings.grading.points_max,
            is_published: document.getElementById('les_published').checked,
            is_required: document.getElementById('les_required').checked,
            unlock_at: availFrom,
            prerequisite_ids: preIds, 
            settings: settings 
        };

        const op = id ? supabase.from('lessons').update(payload).eq('id', id) : supabase.from('lessons').insert(payload);
        const { error } = await op;
        if(error) alert("Erro: " + error.message); else { modalLesson.hide(); loadModules(); }
    });

    document.getElementById('formModule').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('mod_id').value;
        const preIds = [...document.querySelectorAll('.mod-prereq-check:checked')].map(c => c.value);
        const availFrom = document.getElementById('mod_avail_from').value || null;
        
        const settings = {
            availability: { available_from: availFrom, available_until: document.getElementById('mod_avail_until').value || null },
            prerequisite_ids: preIds,
            passing_grade: parseFloat(document.getElementById('mod_passing').value) || null
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
}

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