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
            loadModules(), // Carrega e ativa o Drag & Drop
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

    initSortable();
}

// =========================================================
// 2. RENDERIZAÇÃO
// =========================================================
function renderModuleItem(mod, container) {
    const tpl = document.getElementById('tpl-module');
    const clone = tpl.content.cloneNode(true);
    
    const card = clone.querySelector('.module-card');
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
    secContainer.setAttribute('data-module-id', mod.id); 

    if (mod.sections && mod.sections.length > 0) {
        mod.sections.forEach(sec => renderSectionItem(sec, secContainer, mod.id));
    } else {
        secContainer.innerHTML = `<div class="p-4 text-center text-muted border-top bg-light small empty-placeholder">Nenhuma seção.</div>`;
    }
    container.appendChild(clone);
}

function renderSectionItem(sec, container, modId) {
    const tpl = document.getElementById('tpl-section');
    const clone = tpl.content.cloneNode(true);

    const sectionBox = clone.querySelector('.section-box');
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
    contentContainer.setAttribute('data-section-id', sec.id); 

    if (sec.lessons && sec.lessons.length > 0) {
        sec.lessons.forEach(les => renderLessonItem(les, contentContainer, modId, sec.id));
    } else {
        contentContainer.innerHTML = `<div class="p-2 text-center text-muted small fst-italic empty-placeholder">Arraste aulas para cá.</div>`;
    }
    container.appendChild(clone);
}

// --- FUNÇÃO AUXILIAR NOVA: Busca nome da aula pelo ID ---
function getLessonTitleById(id) {
    if (!globalModules) return id;
    for (const mod of globalModules) {
        if (mod.sections) {
            for (const sec of mod.sections) {
                if (sec.lessons) {
                    // Usa == para permitir comparação entre string e number
                    const found = sec.lessons.find(l => l.id == id);
                    if (found) return found.title;
                }
            }
        }
    }
    return "ID: " + id;
}

// --- ATUALIZAÇÃO: renderLessonItem (Datas e Pré-requisitos juntos) ---
function renderLessonItem(les, container, modId, secId) {
    const tpl = document.createElement('div');
    tpl.setAttribute('data-id', les.id);
    tpl.className = "lesson-item-wrapper";

    // Mapeamento de Estilos
    const typeMap = {
        'VIDEO_AULA': { icon: 'bx-play-circle', bg: 'bg-video', label: 'Vídeo Aula' },
        'VIDEO':      { icon: 'bx-play-circle', bg: 'bg-video', label: 'Vídeo' },
        'QUIZ':       { icon: 'bx-trophy', bg: 'bg-quiz', label: 'Questionário' },
        'TAREFA':     { icon: 'bx-task', bg: 'bg-task', label: 'Atividade' },
        'TEXTO':      { icon: 'bx-text', bg: 'bg-text', label: 'Leitura' },
        'PDF':        { icon: 'bx-file-pdf', bg: 'bg-file', label: 'PDF' },
        'MATERIAL':   { icon: 'bx-link', bg: 'bg-file', label: 'Link Externo' }
    };
    const style = typeMap[les.type] || { icon: 'bx-file', bg: 'bg-file', label: les.type };

    // --- LÓGICA DE DATAS E REQUISITOS ---
    const st = les.settings || {};
    const avail = st.availability || {};
    let metaHtml = '';

    // 1. Data de Início
    const startIso = avail.available_from || les.unlock_at;
    if (startIso) {
        const dStart = new Date(startIso).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
        metaHtml += `<div class="meta-row text-muted" style="font-size:0.75rem"><i class='bx bx-calendar text-success'></i> Início: ${dStart}</div>`;
    }

    // 2. Data de Término
    const endIso = avail.available_until;
    if (endIso) {
        const dEnd = new Date(endIso).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
        metaHtml += `<div class="meta-row text-muted" style="font-size:0.75rem"><i class='bx bx-time-five text-danger'></i> Fim: ${dEnd}</div>`;
    }

    // 3. Pré-requisitos (Mostra os nomes)
    const prereqIds = st.prerequisites?.ids || les.prerequisite_ids || [];
    if (prereqIds.length > 0) {
        // Busca os títulos usando a função auxiliar
        const titles = prereqIds.map(pid => getLessonTitleById(pid));
        const titlesHtml = titles.map(t => `<div class="text-truncate" style="max-width: 160px;">• ${t}</div>`).join('');
        
        metaHtml += `
        <div class="mt-1 pt-1 border-top border-light">
            <div class="text-danger fw-bold" style="font-size: 0.7rem;"><i class='bx bx-lock-alt'></i> Pré-requisitos:</div>
            <div class="text-muted fst-italic" style="font-size: 0.7rem; line-height: 1.2;">
                ${titlesHtml}
            </div>
        </div>`;
    }
    
    // Se não tiver nenhuma restrição
    if (!metaHtml) metaHtml = `<span class="text-muted opacity-25" style="font-size:0.7rem;">Livre</span>`;

    // --- LÓGICA DE NOTA ---
    const pts = st.grading?.points_max ?? (les.points || 0);
    const gradeHtml = pts > 0 
        ? `<span class="grade-value fw-bold text-dark">${pts}</span> <span style="font-size:0.7rem; font-weight:400;">pts</span>` 
        : '<span class="text-muted opacity-25">-</span>';

    // --- RENDERIZAÇÃO DO GRID ---
    tpl.innerHTML = `
    <div class="lesson-row">
        <div class="lesson-handle"><i class='bx bx-grid-vertical fs-5 handle'></i></div>

        <div class="icon-box ${style.bg}"><i class='bx ${style.icon}'></i></div>

        <div class="lesson-content">
            <div class="lesson-title" title="${les.title}">${les.title}</div>
            <div class="lesson-subtitle">${style.label}</div>
        </div>

        <div class="lesson-meta d-flex flex-column justify-content-center ps-2">
            ${metaHtml}
        </div>

        <div class="lesson-grade">
            ${gradeHtml}
        </div>

        <div class="actions-area">
            <button class="btn btn-sm btn-light border-0 text-muted btn-view hover-dark" title="Visualizar"><i class='bx bx-show fs-5'></i></button>
            <button class="btn btn-sm btn-light border-0 text-muted btn-edit hover-primary" title="Configurações"><i class='bx bx-cog fs-5'></i></button>
            <button class="btn btn-sm btn-light border-0 text-muted btn-del hover-danger" title="Excluir"><i class='bx bx-trash fs-5'></i></button>
        </div>
    </div>`;

    // Botões Específicos de Edição de Conteúdo
    const actionsArea = tpl.querySelector('.actions-area');
    let editPage = '';
    if (les.type === 'QUIZ') editPage = 'quiz-builder.html';
    else if (les.type === 'TAREFA') editPage = 'task-builder.html';
    else if (les.type === 'TEXTO') editPage = 'text-builder.html';

    if (editPage) {
        const btnContent = document.createElement('a');
        btnContent.href = `${editPage}?id=${les.id}&courseId=${courseId}`;
        btnContent.className = "btn btn-sm btn-light border-0 text-primary fw-bold";
        btnContent.title = "Editar Conteúdo";
        btnContent.innerHTML = "<i class='bx bx-edit-alt fs-5'></i>";
        actionsArea.insertBefore(btnContent, actionsArea.firstChild);
    }

    // Eventos
    tpl.querySelector('.btn-view').onclick = () => openPreview(les);
    tpl.querySelector('.btn-edit').onclick = () => openLessonModal(modId, secId, les);
    tpl.querySelector('.btn-del').onclick = () => deleteItem('lessons', les.id);

    container.appendChild(tpl);
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
// 3. LOGICA DE ARRASTAR E SOLTAR (SortableJS)
// =========================================================
function initSortable() {
    if (typeof Sortable === 'undefined') return;

    // 1. Módulos
    const modulesList = document.getElementById('modules-list');
    if (modulesList) {
        new Sortable(modulesList, {
            animation: 150,
            handle: '.mod-handle', 
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
}

// =========================================================
// 4. FUNÇÃO DE PREVIEW (VISUALIZAR)
// =========================================================
window.openPreview = async (lesson) => {
    const modalEl = document.getElementById('modalPreviewLesson');
    if (!modalEl) { alert("ERRO: O modal 'modalPreviewLesson' não existe no HTML."); return; }
    
    const modal = new bootstrap.Modal(modalEl);
    const contentDiv = document.getElementById('previewContent');
    const titleDiv = document.getElementById('previewTitle');
    
    if (titleDiv) titleDiv.textContent = lesson.title || "Visualizar Aula";
    
    contentDiv.className = 'modal-body p-0 bg-white'; 
    contentDiv.innerHTML = '<div class="h-100 d-flex align-items-center justify-content-center"><div class="spinner-border text-primary"></div></div>';
    
    modal.show();

    let fullLesson = lesson;
    if (!lesson.description && !lesson.quiz_data && !lesson.task_data && !lesson.content) {
         const { data } = await supabase.from('lessons').select('*').eq('id', lesson.id).single();
         if(data) fullLesson = data;
    }

    let html = '';
    const rawUrl = fullLesson.video_url || fullLesson.content_url || '';

    // 1. VÍDEO
    const isYouTubeLink = rawUrl.includes('youtube') || rawUrl.includes('youtu.be');

    if (['VIDEO_AULA', 'VIDEO'].includes(fullLesson.type) || isYouTubeLink) {
        contentDiv.className = 'modal-body p-0 bg-black'; 
        
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
        const match = rawUrl.match(regExp);

        if (match && match[2].length === 11) {
            const videoId = match[2];
            html = `
            <div class="ratio ratio-16x9 h-100">
                <iframe src="https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1" 
                    title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen>
                </iframe>
            </div>`;
        } else {
            if(rawUrl) {
                html = `<iframe src="${rawUrl}" class="w-100 h-100 border-0" allowfullscreen></iframe>`;
            } else {
                html = `<div class="d-flex h-100 align-items-center justify-content-center text-white flex-column"><i class='bx bx-error-circle fs-1 mb-2'></i><p>Link de vídeo inválido.</p></div>`;
            }
        }
    }

    // 2. TEXTO
    else if (fullLesson.type === 'TEXTO') {
        const content = fullLesson.description || fullLesson.content || "<p class='text-center text-muted mt-5'>Conteúdo vazio.</p>";
        html = `<div class="container py-5 h-100 overflow-auto"><div class="row justify-content-center"><div class="col-lg-10"><div class="p-5 bg-white shadow-sm border rounded" style="min-height: 60vh;">${content}</div></div></div></div>`;
    }

    // 3. QUIZ
    else if (fullLesson.type === 'QUIZ') {
        const data = fullLesson.quiz_data || { questions: [] };
        if (data.settings?.mode === 'bank') {
            html = `<div class="d-flex h-100 align-items-center justify-content-center flex-column text-center p-5"><i class='bx bx-shuffle fs-1 text-primary mb-3'></i><h4>Banco de Questões</h4><p class="text-muted">Sorteio de <strong>${data.settings.drawCount}</strong> questões.</p><span class="badge bg-light text-dark border">Total: ${data.questions.length}</span></div>`;
        } else {
            const list = (data.questions || []).map((q, i) => `
                <div class="card mb-3 shadow-sm border-0"><div class="card-body"><h6 class="fw-bold text-primary mb-2">Questão #${i+1}</h6><div class="mb-3 fw-bold">${q.text}</div>
                <ul class="list-group list-group-flush small bg-light rounded">${q.options.map(opt => `<li class="list-group-item bg-transparent border-0 d-flex align-items-center gap-2">${opt.isCorrect ? '<i class="bx bxs-check-circle text-success fs-5"></i>' : '<i class="bx bx-radio-circle text-muted fs-5"></i>'}<span class="${opt.isCorrect ? 'fw-bold text-success' : ''}">${opt.text}</span></li>`).join('')}</ul></div></div>`).join('');
            html = `<div class="container py-4 h-100 overflow-auto bg-light"><div class="d-flex justify-content-between align-items-center mb-4"><h5 class="fw-bold mb-0"><i class='bx bx-trophy'></i> Quiz</h5><span class="badge bg-warning text-dark border">${fullLesson.points || 0} pts</span></div>${list || '<div class="alert alert-warning">Vazio.</div>'}</div>`;
        }
    }

    // 4. TAREFA
    else if (fullLesson.type === 'TAREFA') {
        const data = fullLesson.task_data || { items: [] };
        const instructions = data.instructions || "Sem instruções.";
        const list = (data.items || []).map((item, i) => `<div class="card mb-3 border-start border-4 ${item.type==='text'?'border-primary':'border-success'} shadow-sm"><div class="card-body"><div class="d-flex justify-content-between mb-2"><span class="badge bg-light text-dark border text-uppercase">${item.type === 'text' ? 'Dissertativa' : 'Envio de Link'}</span><span class="fw-bold text-muted small">${item.points} pts</span></div><h6 class="fw-bold">Item #${i+1}</h6><div class="bg-light p-3 rounded border border-dashed">${item.statement || 'Sem enunciado...'}</div></div></div>`).join('');
        html = `<div class="container py-4 h-100 overflow-auto"><div class="alert alert-info border-0 shadow-sm mb-4"><h6 class="fw-bold"><i class='bx bx-info-circle'></i> Instruções</h6>${instructions}</div><h6 class="fw-bold mb-3 text-muted border-bottom pb-2">ITENS</h6>${list || '<div class="text-center text-muted py-4">Vazio.</div>'}</div>`;
    }

    // 5. PDF / DRIVE
    else {
        let finalUrl = rawUrl;
        if (finalUrl.includes('drive.google.com')) finalUrl = finalUrl.replace(/\/view.*/, '/preview').replace(/\/edit.*/, '/preview');
        
        if (finalUrl) {
            html = `<iframe src="${finalUrl}" style="width:100%; height:100%; border:none;"></iframe><div style="position:absolute; bottom:15px; right:15px;"><a href="${finalUrl}" target="_blank" class="btn btn-dark btn-sm shadow fw-bold"><i class='bx bx-link-external'></i> Abrir Nova Guia</a></div>`;
        } else {
            html = `<div class="h-100 d-flex align-items-center justify-content-center text-muted">Nenhum conteúdo vinculado.</div>`;
        }
    }
    contentDiv.innerHTML = html;
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
        
        // --- ATUALIZAÇÃO: Carrega tentativas e tempo de espera (Padrão 24h) ---
        document.getElementById('les_attempts').value = attempts.attempts_max || 0;
        document.getElementById('les_attempt_wait').value = (attempts.wait_time !== undefined) ? attempts.wait_time : 24;
        document.getElementById('les_grading_method').value = attempts.grading_method || 'highest';
        
        if(s.prerequisites?.logic === 'OR') document.getElementById('logic_or').checked = true;
    } else {
        document.getElementById('logic_and').checked = true;
        // Para novas lições, define padrão de 24h
        document.getElementById('les_attempt_wait').value = 24;
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
        
        // --- ATUALIZAÇÃO: Inclui wait_time no payload ---
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
                wait_time: parseInt(document.getElementById('les_attempt_wait').value) || 0,
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