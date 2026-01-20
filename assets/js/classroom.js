import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('id') || params.get('classId');

// --- ESTADO GLOBAL ---
let enrollment = null;
let flatLessons = [];
let courseModules = []; 
let currentLesson = null;
let currentUserRole = 'student'; // 'admin', 'professor', 'student'

// Estados das Atividades
let quizState = { questions: [], currentIndex: -1, answers: {}, totalPoints: 0, isFinished: false };
let taskState = { items: [], currentIndex: -1, answers: {}, isSubmitted: false, teacherScores: {}, teacherFeedback: {} };

const ICONS = { 
    'VIDEO_AULA': 'bx-play-circle', 
    'VIDEO': 'bx-movie-play',
    'AUDIO': 'bx-headphone',
    'PODCAST': 'bx-podcast',
    'PDF': 'bxs-file-pdf', 
    'QUIZ': 'bx-trophy', 
    'TAREFA': 'bx-task',
    'MATERIAL': 'bx-link',
    'TEXTO': 'bx-paragraph',
    'default': 'bx-file' 
};

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', async () => {
    if (!classId) { 
        alert("Turma não identificada.");
        window.location.href = 'app.html'; 
        return; 
    }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    try {
        // 1. Verifica Permissões
        await checkUserRole(session.user.id);

        // 2. Carrega Dados
        await loadEnrollment(session.user.id);
        await loadCourse();
        
        // 3. Abre a primeira aula pendente
        if (flatLessons.length > 0) {
            const validIds = flatLessons.map(l => l.id);
            enrollment.grades.completed = enrollment.grades.completed.filter(id => validIds.includes(id));
            
            // Tenta abrir a última acessada ou a primeira não feita
            const next = flatLessons.find(l => !enrollment.grades.completed.includes(l.id)) || flatLessons[0];
            openLesson(next);
        }
        
        updateOverallProgress();
        loadMural(); 
        checkUnreadMural(); 

    } catch (error) { 
        console.error("Erro crítico:", error); 
        document.getElementById('modules-list').innerHTML = `<div class="p-3 text-danger">Erro ao carregar: ${error.message}</div>`;
    }
});

async function checkUserRole(userId) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (profile) currentUserRole = profile.role;
}

// === CARREGAMENTO DE DADOS ===

async function loadEnrollment(userId) {
    const { data, error } = await supabase
        .from('class_enrollments')
        .select('*')
        .eq('class_id', classId)
        .eq('user_id', userId)
        .single();

    if (error || !data) throw new Error("Você não está matriculado nesta turma.");
    
    enrollment = data;
    // Garante inicialização dos objetos
    if (!enrollment.grades) enrollment.grades = { completed: [], scores: {}, tasks: {} };
    if (!enrollment.grades.scores) enrollment.grades.scores = {};
    if (!enrollment.grades.completed) enrollment.grades.completed = [];
    if (!enrollment.grades.tasks) enrollment.grades.tasks = {};
}

async function loadCourse() {
    // 1. Busca dados da Turma
    const { data: cls } = await supabase.from('classes').select('*, courses(title)').eq('id', classId).single();
    
    if (cls) {
        document.getElementById('header-course-title').textContent = cls.courses?.title || 'Curso';
        document.getElementById('header-class-name').textContent = cls.name;
        
        // --- ÁREA DE BOTÕES DO PROFESSOR/ADMIN ---
        if (['admin', 'professor'].includes(currentUserRole)) {
            const headerActions = document.getElementById('header-actions');
            if (headerActions) {
                
                // Botão 1: Painel de Correção (Grading)
                if (!document.getElementById('btn-grading')) {
                    const gradingBtn = document.createElement('a');
                    gradingBtn.id = 'btn-grading';
                    gradingBtn.href = `grading.html?classId=${classId}`; 
                    gradingBtn.className = 'btn btn-sm btn-warning fw-bold shadow-sm me-2 text-dark';
                    gradingBtn.innerHTML = `<i class='bx bx-check-double'></i> Corrigir Tarefas`;
                    // Insere como primeiro item
                    headerActions.insertBefore(gradingBtn, headerActions.firstChild);
                }

                // Botão 2: Editar Conteúdo (Course Editor)
                if (!document.getElementById('btn-edit-course')) {
                    const editBtn = document.createElement('a');
                    editBtn.id = 'btn-edit-course';
                    editBtn.href = `course-editor.html?id=${cls.course_id}`; 
                    editBtn.className = 'btn btn-sm btn-dark border-0 fw-bold shadow-sm me-2';
                    editBtn.innerHTML = `<i class='bx bx-edit-alt'></i> Editar Conteúdo`;
                    // Insere após o botão de grading (ou primeiro se grading não existir)
                    headerActions.insertBefore(editBtn, headerActions.lastElementChild);
                }
            }
        }
    }

    // 2. Busca Módulos e Aulas
    const { data: modules, error } = await supabase
        .from('modules')
        .select(`*, sections (*, lessons (*))`)
        .eq('course_id', cls.course_id)
        .order('ordem', { ascending: true });

    if(error) { console.error("Erro módulos:", error); return; }

    // 3. Renderiza Menu Lateral
    const container = document.getElementById('modules-list');
    container.innerHTML = ''; 
    flatLessons = [];
    
    if (modules) {
        // Ordenação
        modules.forEach(mod => {
            if (mod.sections) {
                mod.sections.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
                mod.sections.forEach(sec => {
                    if (sec.lessons) sec.lessons.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
                });
            }
        });

        // Renderização HTML
        modules.forEach((mod, index) => {
            const modId = `mod-${mod.id}`;
            let lessonsHtml = '';
            
            mod.sections.forEach(sec => {
                if (sec.title) lessonsHtml += `<div class="section-title">${sec.title}</div>`;
                if (sec.lessons) {
                    sec.lessons.forEach(l => {
                        if (l.is_published === false) return;
                        
                        flatLessons.push(l);
                        const isDone = enrollment.grades.completed.includes(l.id);
                        
                        lessonsHtml += `
                            <div class="lesson-item ${isDone?'completed':''}" id="lesson-${l.id}" onclick="window.openLessonById(${l.id})">
                                <i class='bx ${ICONS[l.type] || ICONS.default} fs-5'></i>
                                <span class="text-truncate flex-grow-1">${l.title}</span>
                                ${isDone ? "<i class='bx bxs-check-circle text-success'></i>" : ""}
                            </div>`;
                    });
                }
            });

            container.innerHTML += `
                <div class="accordion-item">
                    <h2 class="accordion-header">
                        <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#${modId}">
                            <span>${mod.title}</span>
                        </button>
                    </h2>
                    <div id="${modId}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#modules-list">
                        <div class="accordion-body p-0">${lessonsHtml}</div>
                    </div>
                </div>`;
        });
    }
}

// === CONTROLADOR DE AULA ===

function openLesson(lesson) {
    currentLesson = lesson;
    forceSwitchToContent();
    
    // UI Updates
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`lesson-${lesson.id}`)?.classList.add('active');
    document.getElementById('lbl-title').textContent = lesson.title;
    document.getElementById('lbl-type').textContent = lesson.type;
    
    const activity = document.getElementById('activity-area');
    const playerFrame = document.getElementById('player-frame');
    const descContainer = document.getElementById('lbl-desc');
    
    activity.innerHTML = ''; 
    playerFrame.style.display = 'none'; 
    playerFrame.innerHTML = '';

    // Descrição: Oculta para tipos interativos
    if (['TAREFA', 'QUIZ'].includes(lesson.type)) {
        descContainer.style.display = 'none'; 
    } else {
        descContainer.style.display = 'block';
        descContainer.innerHTML = lesson.description || '';
    }

    const url = getEmbedUrl(lesson.video_url || lesson.content_url);

    // --- ROTEADOR ---

    if (lesson.type === 'VIDEO_AULA' || lesson.type === 'VIDEO') {
        playerFrame.style.display = 'flex';
        playerFrame.innerHTML = `<iframe src="${url}" allowfullscreen></iframe>`;
    
    } else if (lesson.type === 'AUDIO' || lesson.type === 'PODCAST') {
        activity.innerHTML = `<div class="audio-container"><i class='bx bx-headphone display-1 text-primary mb-3'></i><audio controls class="w-100"><source src="${url}" type="audio/mpeg"></audio></div>`;
    
    } else if ((lesson.type === 'PDF' || lesson.type === 'MATERIAL') && url) {
        activity.innerHTML = `<iframe class="pdf-viewer" src="${url}"></iframe>`;
    
    } else if (lesson.type === 'TEXTO') {
        descContainer.style.display = 'block';
        activity.innerHTML = `<div class="p-4 bg-light rounded border">${lesson.description || 'Conteúdo não disponível.'}</div>`;

    } else if (lesson.type === 'TAREFA') {
        renderTaskIntro(lesson); // Inicia fluxo da tarefa
    
    } else if (lesson.type === 'QUIZ') {
        const score = enrollment.grades.scores ? enrollment.grades.scores[lesson.id] : undefined;
        // Se já tem nota, mostra resultado.
        if (enrollment.grades.completed.includes(lesson.id) && score !== undefined) {
            renderQuizResult(score, lesson.points || 100);
        } else { 
            renderQuizIntro(lesson);
        }
    }
    
    updateFinishButton();
    updateNavigation();
    if (window.innerWidth < 992) document.getElementById('course-nav').classList.add('closed');
}

// === NAVEGAÇÃO ENTRE AULAS ===
function updateNavigation() {
    const idx = flatLessons.findIndex(l => l.id === currentLesson.id);
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');

    // Botão Anterior
    if (idx > 0) {
        prevBtn.disabled = false;
        prevBtn.onclick = () => openLesson(flatLessons[idx - 1]);
    } else {
        prevBtn.disabled = true;
        prevBtn.onclick = null;
    }

    // Botão Próximo
    if (idx < flatLessons.length - 1) {
        nextBtn.disabled = false;
        nextBtn.onclick = () => openLesson(flatLessons[idx + 1]);
    } else {
        nextBtn.disabled = true;
        nextBtn.onclick = null;
    }
}

// --- HELPER DE DATAS (CRÍTICO) ---
function checkDateStatus(lesson) {
    const now = new Date();
    const start = lesson.available_from ? new Date(lesson.available_from) : null;
    const end = lesson.available_until ? new Date(lesson.available_until) : null;
    
    if (start && now < start) return { locked: true, msg: `Abre em: ${start.toLocaleString()}` };
    if (end && now > end) return { locked: true, msg: `Encerrado em: ${end.toLocaleString()}` };
    
    return { locked: false, msg: end ? `Fecha em: ${end.toLocaleString()}` : '' };
}

// =======================================================
// === MÓDULO DE TAREFAS (COM BLOQUEIO E NOTAS) ===
// =======================================================

window.renderTaskIntro = (lesson) => {
    // 1. Verifica Datas
    const status = checkDateStatus(lesson);
    const isAdmin = ['admin', 'professor'].includes(currentUserRole);

    // Se bloqueado e não é admin, mostra erro e para.
    if (status.locked && !isAdmin) {
        document.getElementById('activity-area').innerHTML = `<div class="alert alert-danger text-center p-5"><h4><i class='bx bx-lock-alt'></i> Tarefa Indisponível</h4><p>${status.msg}</p></div>`;
        return;
    }

    // 2. Prepara Dados (Lê de task_data ou fallback)
    let items = [];
    let instructions = lesson.description || '';

    if (lesson.task_data) {
        items = lesson.task_data.items || [];
        instructions = lesson.task_data.instructions || instructions;
    } else if (lesson.quiz_data && lesson.quiz_data.items) {
        items = lesson.quiz_data.items; // Fallback
    }

    document.getElementById('activity-area').innerHTML = `
        <div class="task-container mx-auto" style="max-width: 96%;">
            <div class="card border-0 shadow-sm bg-white mb-4">
                <div class="card-body p-5">
                    <h2 class="fw-bold mb-3">${lesson.title}</h2>
                    
                    ${status.locked ? `<div class="alert alert-warning mb-3"><strong>Modo Professor:</strong> Visualizando fora do prazo (${status.msg}).</div>` : ''}
                    ${status.msg && !status.locked ? `<div class="alert alert-info py-1 small"><i class='bx bx-time'></i> ${status.msg}</div>` : ''}

                    <div class="alert alert-light border-0 bg-light"><i class='bx bx-info-circle'></i> Instruções:</div>
                    <div class="text-secondary mb-4 fs-5 p-3 rounded border">${instructions}</div>
                    
                    <div class="d-flex justify-content-between align-items-center mt-5">
                        <div class="text-muted"><i class='bx bx-list-ol'></i> ${items.length} Questões</div>
                        <button class="btn btn-primary btn-lg px-5 rounded-pill fw-bold" onclick="window.startTask()">
                            INICIAR TAREFA <i class='bx bx-right-arrow-alt'></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
};

window.startTask = () => {
    const lesson = currentLesson;
    let items = [];
    if (lesson.task_data && lesson.task_data.items) items = lesson.task_data.items;
    else if (lesson.quiz_data && lesson.quiz_data.items) items = lesson.quiz_data.items;
    
    if (items.length === 0) { alert("Nenhuma questão cadastrada."); return; }

    const savedTask = enrollment.grades.tasks && enrollment.grades.tasks[lesson.id];
    
    taskState = {
        items: items,
        currentIndex: 0,
        answers: savedTask ? savedTask.answers : {},
        isSubmitted: savedTask ? true : false, 
        teacherScores: savedTask ? (savedTask.item_scores || {}) : {},
        teacherFeedback: savedTask ? (savedTask.item_feedback || {}) : {}
    };
    
    renderTaskStep();
};

window.renderTaskStep = () => {
    const container = document.getElementById('activity-area');
    const item = taskState.items[taskState.currentIndex];
    const total = taskState.items.length;
    const progress = ((taskState.currentIndex + 1) / total) * 100;
    
    const answer = taskState.answers[item.id] || '';
    const isSubmitted = taskState.isSubmitted; 
    
    let inputHtml = '';
    if (item.type === 'text') {
        inputHtml = `<textarea class="form-control mb-3 fs-5" rows="6" oninput="window.updateTaskAnswer(${item.id}, this.value)" ${isSubmitted?'disabled':''}>${answer}</textarea>`;
    } else {
        inputHtml = `<div class="mb-3">
            <input type="file" class="form-control" onchange="window.updateTaskFile(${item.id}, this)" ${isSubmitted?'disabled':''}>
            ${answer ? `<div class="mt-2 p-2 bg-light border rounded"><i class='bx bx-file'></i> <strong>Arquivo Atual:</strong> ${answer}</div>` : ''}
        </div>`;
    }

    // --- ÁREA DO PROFESSOR ---
    let teacherAreaHtml = '';
    if (['admin', 'professor'].includes(currentUserRole)) {
        const currentScore = taskState.teacherScores[item.id] || 0;
        const currentFb = taskState.teacherFeedback[item.id] || '';
        
        teacherAreaHtml = `
            <div class="mt-4 p-4 rounded border-warning border border-2 bg-warning bg-opacity-10">
                <div class="d-flex justify-content-between mb-2">
                    <h6 class="fw-bold text-dark"><i class='bx bx-edit'></i> Avaliação (Professor)</h6>
                    <span class="badge bg-warning text-dark">Máx: ${item.points} pts</span>
                </div>
                <div class="row g-3">
                    <div class="col-md-3">
                        <label class="small fw-bold">Nota:</label>
                        <input type="number" class="form-control border-warning fw-bold" 
                               value="${currentScore}" max="${item.points}" 
                               onchange="window.saveTeacherGrade('${item.id}', 'score', this.value)">
                    </div>
                    <div class="col-md-9">
                        <label class="small fw-bold">Feedback:</label>
                        <input type="text" class="form-control border-warning" 
                               value="${currentFb}" placeholder="Comentário para o aluno..."
                               onchange="window.saveTeacherGrade('${item.id}', 'feedback', this.value)">
                    </div>
                </div>
            </div>`;
    }

    // Feedback para o Aluno
    let studentFeedbackView = '';
    if (currentUserRole === 'student' && isSubmitted && taskState.teacherFeedback[item.id]) {
        studentFeedbackView = `
            <div class="alert alert-warning mt-3 border-warning">
                <i class='bx bx-message-detail'></i> <strong>Feedback do Professor:</strong> ${taskState.teacherFeedback[item.id]} <br>
                <i class='bx bx-star'></i> <strong>Nota:</strong> ${taskState.teacherScores[item.id] || 0} / ${item.points}
            </div>`;
    }

    container.innerHTML = `
        <div class="task-container mx-auto" style="max-width: 96%;">
            <div class="progress mb-4" style="height: 8px;"><div class="progress-bar" style="width: ${progress}%"></div></div>
            
            <div class="card border-0 shadow-sm bg-white">
                <div class="card-body p-5">
                    <div class="d-flex justify-content-between mb-4">
                        <span class="badge bg-primary fs-6 px-3 py-2">Questão ${taskState.currentIndex + 1} de ${total}</span>
                        <span class="badge bg-light text-dark border fs-6 px-3 py-2">Vale ${item.points} pts</span>
                    </div>
                    
                    <div class="fs-4 mb-5 fw-bold text-dark lh-base">${item.statement}</div>
                    
                    <div class="p-4 bg-light rounded border mb-3">
                        <label class="small text-muted fw-bold mb-2 text-uppercase">Sua Resposta:</label>
                        ${inputHtml}
                        ${studentFeedbackView}
                    </div>

                    ${teacherAreaHtml}

                    <div class="d-flex justify-content-between mt-5 border-top pt-4">
                        <button class="btn btn-outline-secondary btn-lg px-4" onclick="window.prevTaskStep()" ${taskState.currentIndex===0?'disabled':''}>Anterior</button>
                        ${taskState.currentIndex === total - 1 
                            ? `<button class="btn btn-success btn-lg px-5 fw-bold" onclick="window.finishTask()" ${isSubmitted && currentUserRole==='student'?'disabled':''}>
                                ${isSubmitted ? 'Tarefa Enviada' : 'Finalizar e Enviar <i class="bx bx-send"></i>'}
                               </button>` 
                            : `<button class="btn btn-primary btn-lg px-5 fw-bold" onclick="window.nextTaskStep()">Próxima</button>`
                        }
                    </div>
                </div>
            </div>
        </div>`;
};

window.updateTaskAnswer = (itemId, val) => { taskState.answers[itemId] = val; };
window.updateTaskFile = (itemId, input) => { 
    const fileName = input.files[0] ? input.files[0].name : "Arquivo";
    taskState.answers[itemId] = fileName + " (Enviado)"; 
};

window.nextTaskStep = () => { if (taskState.currentIndex < taskState.items.length - 1) { taskState.currentIndex++; renderTaskStep(); } };
window.prevTaskStep = () => { if (taskState.currentIndex > 0) { taskState.currentIndex--; renderTaskStep(); } };

window.finishTask = async () => {
    if(['admin', 'professor'].includes(currentUserRole)) {
        alert("Avaliação salva localmente. As notas foram atualizadas.");
        return;
    }

    if(!confirm("Enviar tarefa?")) return;
    
    if (!enrollment.grades.tasks) enrollment.grades.tasks = {};
    
    enrollment.grades.tasks[currentLesson.id] = {
        submitted_at: new Date().toISOString(),
        answers: taskState.answers,
        item_scores: {}, 
        item_feedback: {}
    };
    
    if (!enrollment.grades.completed.includes(currentLesson.id)) enrollment.grades.completed.push(currentLesson.id);

    const { error } = await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id);
    
    if(error) alert("Erro: "+error.message);
    else {
        alert("Tarefa enviada com sucesso!");
        taskState.isSubmitted = true;
        renderTaskStep();
        updateOverallProgress();
        updateFinishButton();
    }
};

window.saveTeacherGrade = async (itemId, type, value) => {
    if (!enrollment.grades.tasks) enrollment.grades.tasks = {};
    
    let taskRecord = enrollment.grades.tasks[currentLesson.id];
    if (!taskRecord) {
        taskRecord = { answers: {}, item_scores: {}, item_feedback: {}, submitted_at: new Date().toISOString() };
    }
    if(!taskRecord.item_scores) taskRecord.item_scores = {};
    if(!taskRecord.item_feedback) taskRecord.item_feedback = {};

    if (type === 'score') taskRecord.item_scores[itemId] = parseFloat(value);
    if (type === 'feedback') taskRecord.item_feedback[itemId] = value;

    enrollment.grades.tasks[currentLesson.id] = taskRecord;

    let totalScore = 0;
    Object.values(taskRecord.item_scores).forEach(v => totalScore += (v||0));
    enrollment.grades.scores[currentLesson.id] = totalScore;

    await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id);
};

// =======================================================
// === MÓDULO DE QUIZ (FULL WIDTH & SORTEIO & DATAS) ===
// =======================================================

window.renderQuizIntro = (lesson) => {
    // 1. Verifica Datas (Lógica de Bloqueio)
    const status = checkDateStatus(lesson);
    const isAdmin = ['admin', 'professor'].includes(currentUserRole);

    if (status.locked && !isAdmin) {
        document.getElementById('activity-area').innerHTML = `<div class="alert alert-danger text-center p-5"><h4><i class='bx bx-lock-alt'></i> Quiz Bloqueado</h4><p>${status.msg}</p></div>`;
        return;
    }

    // 2. Configura Sorteio
    let qCount = 0, limit = 10, quizDataObj = null;
    if (lesson.quiz_data) quizDataObj = lesson.quiz_data;
    else if (lesson.description && lesson.description.startsWith('{')) { try { quizDataObj = JSON.parse(lesson.description); } catch(e){} }

    if (quizDataObj) {
        qCount = quizDataObj.questions ? quizDataObj.questions.length : (Array.isArray(quizDataObj) ? quizDataObj.length : 0);
        // Respeita drawCount
        if (quizDataObj.settings && quizDataObj.settings.drawCount) limit = parseInt(quizDataObj.settings.drawCount);
        else if (Array.isArray(quizDataObj)) limit = qCount;
        else limit = qCount;
    }
    const questionsToAsk = Math.min(qCount, limit);

    document.getElementById('activity-area').innerHTML = `
        <div class="quiz-wrapper mx-auto" style="max-width: 96%;">
            <div class="quiz-hero text-center p-5 bg-white rounded shadow-sm">
                <div class="quiz-hero-icon start mb-3"><i class='bx bx-joystick fs-1 text-primary'></i></div>
                <h2 class="fw-bold mb-2">${lesson.title}</h2>
                
                ${status.locked ? `<div class="alert alert-warning mb-3"><strong>Modo Professor:</strong> Visualizando fora do prazo (${status.msg})</div>` : ''}
                ${status.msg && !status.locked ? `<div class="alert alert-info py-1 small"><i class='bx bx-time'></i> ${status.msg}</div>` : ''}

                <div class="d-flex justify-content-center gap-4 my-4">
                    <div class="bg-light p-3 rounded border text-center" style="min-width: 120px;">
                        <span class="d-block fs-3 fw-bold text-dark">${questionsToAsk}</span>
                        <span class="text-muted small uppercase">Questões</span>
                    </div>
                    <div class="bg-light p-3 rounded border text-center" style="min-width: 120px;">
                        <span class="d-block fs-3 fw-bold text-dark">${lesson.points || 0}</span>
                        <span class="text-muted small uppercase">Pontos</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-lg rounded-pill px-5 fw-bold" onclick="window.startQuiz()">INICIAR AVALIAÇÃO</button>
            </div>
        </div>`;
};

window.startQuiz = () => {
    const lesson = currentLesson;
    let allQuestions = [];
    let limit = 100;
    let quizDataObj = null;

    if (lesson.quiz_data) quizDataObj = lesson.quiz_data;
    else if (lesson.description && lesson.description.startsWith('{')) { try { quizDataObj = JSON.parse(lesson.description); } catch(e){} }

    if (quizDataObj) {
        if (Array.isArray(quizDataObj)) { allQuestions = quizDataObj; limit = allQuestions.length; }
        else {
            allQuestions = quizDataObj.questions || [];
            if (quizDataObj.settings && quizDataObj.settings.drawCount > 0) limit = parseInt(quizDataObj.settings.drawCount);
            else limit = allQuestions.length;
        }
    }

    if (!allQuestions || allQuestions.length === 0) { alert("Sem questões."); return; }

    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, limit);

    quizState = { questions: selectedQuestions, currentIndex: 0, answers: {}, totalPoints: lesson.points || 100 };
    renderQuizStep();
};

window.renderQuizStep = () => {
    const container = document.getElementById('activity-area');
    const q = quizState.questions[quizState.currentIndex];
    const total = quizState.questions.length;
    const progress = ((quizState.currentIndex + 1) / total) * 100;

    let optionsHtml = '';
    if(q.options) {
        q.options.forEach((opt, idx) => {
            const isSelected = quizState.answers[quizState.currentIndex] === idx;
            optionsHtml += `
                <div class="quiz-option-label ${isSelected?'selected':''} p-3 border rounded mb-2 d-flex align-items-center cursor-pointer" onclick="window.selectQuizAnswer(${idx})">
                    <div class="quiz-radio me-3" style="width:20px;height:20px;border:2px solid #ddd;border-radius:50%;background:${isSelected?'#2563eb':'#fff'}"></div>
                    <span class="fw-medium">${opt.text || opt}</span>
                </div>`;
        });
    }

    container.innerHTML = `
        <div class="quiz-wrapper mx-auto" style="max-width: 96%;">
            <div class="progress mb-4" style="height: 6px;"><div class="progress-bar" style="width: ${progress}%"></div></div>
            <div class="card border-0 shadow-sm p-4">
                <div class="d-flex justify-content-between mb-3 text-muted fw-bold"><span>Questão ${quizState.currentIndex+1}/${total}</span></div>
                <h4 class="mb-4">${q.text || q.title}</h4>
                <div class="mb-4">${optionsHtml}</div>
                <div class="d-flex justify-content-between">
                    <button class="btn btn-light" onclick="window.prevQuizStep()" ${quizState.currentIndex===0?'disabled':''}>Anterior</button>
                    ${quizState.currentIndex === total - 1 
                        ? `<button class="btn btn-success px-4" onclick="window.finishQuiz()">Finalizar</button>`
                        : `<button class="btn btn-primary px-4" onclick="window.nextQuizStep()">Próxima</button>`
                    }
                </div>
            </div>
        </div>`;
};

window.selectQuizAnswer = (idx) => { quizState.answers[quizState.currentIndex] = idx; renderQuizStep(); };
window.nextQuizStep = () => { if (quizState.currentIndex < quizState.questions.length - 1) { quizState.currentIndex++; renderQuizStep(); } };
window.prevQuizStep = () => { if (quizState.currentIndex > 0) { quizState.currentIndex--; renderQuizStep(); } };

window.finishQuiz = async () => {
    if(!confirm("Finalizar?")) return;
    let correct = 0;
    quizState.questions.forEach((q, idx) => {
        const ans = quizState.answers[idx];
        if(ans !== undefined && String(ans) === String(q.correctIndex)) correct++;
    });
    const finalScore = Math.round((correct / quizState.questions.length) * quizState.totalPoints);
    
    enrollment.grades.scores[currentLesson.id] = finalScore;
    if (!enrollment.grades.completed.includes(currentLesson.id)) enrollment.grades.completed.push(currentLesson.id);
    
    await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id);
    renderQuizResult(finalScore, quizState.totalPoints);
    updateOverallProgress(); updateFinishButton();
};

window.renderQuizResult = (score, total) => {
    const pct = total > 0 ? Math.round((score/total)*100) : 0;
    const isPass = pct >= 70;
    document.getElementById('activity-area').innerHTML = `
        <div class="quiz-wrapper mx-auto text-center p-5 bg-white rounded shadow-sm" style="max-width: 96%;">
            <div class="mb-3 display-1 ${isPass?'text-success':'text-danger'}"><i class='bx ${isPass?'bx-check-circle':'bx-x-circle'}'></i></div>
            <h2>${isPass ? 'Parabéns!' : 'Avaliação Concluída'}</h2>
            <p class="text-muted">Sua nota: <strong>${score}</strong> / ${total}</p>
            <div class="alert ${isPass?'alert-success':'alert-danger'} d-inline-block px-4">${isPass?'APROVADO':'ABAIXO DA MÉDIA'}</div>
        </div>`;
    updateFinishButton();
};

// === MURAL ===
window.loadMural = async () => {
    const container = document.getElementById('wall-container');
    if (!container) return; 
    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div></div>';
    const { data: posts } = await supabase.from('class_posts').select('*').eq('class_id', classId).neq('type', 'INTERNAL').order('created_at', { ascending: false });
    
    if (!posts || !posts.length) { container.innerHTML = `<div class="text-center p-5 opacity-50"><h4>Mural Vazio</h4></div>`; return; }
    
    const readPosts = JSON.parse(localStorage.getItem(`ava3_read_posts_${enrollment.id}`) || '[]');
    const colorMap = { 'AVISO': 'post-yellow', 'MATERIAL': 'post-blue', 'EVENTO': 'post-green', 'URGENTE': 'post-pink', 'default': 'post-yellow' };

    container.innerHTML = posts.map(p => {
        const isRead = readPosts.includes(p.id);
        const color = colorMap[p.type] || colorMap['default'];
        return `
            <div class="post-it ${color}">
                ${!isRead ? '<div class="new-indicator">NOVO!</div>' : ''}
                <div class="post-header"><span class="post-badge">${p.type}</span><span class="post-date">${new Date(p.created_at).toLocaleDateString()}</span></div>
                <div class="post-body"><span class="post-title">${p.title}</span>${p.content}</div>
                <div class="post-footer">${isRead ? '<div class="mark-done"><i class="bx bx-check-double"></i> Lido</div>' : `<button class="btn-read-mark" onclick="window.markPostRead('${p.id}')">Marcar Lido</button>`}</div>
            </div>`;
    }).join('');
};

window.markPostRead = (id) => {
    const key = `ava3_read_posts_${enrollment.id}`;
    let read = JSON.parse(localStorage.getItem(key) || '[]');
    if (!read.includes(id)) { read.push(id); localStorage.setItem(key, JSON.stringify(read)); loadMural(); checkUnreadMural(); }
};

async function checkUnreadMural() {
    const { data: posts } = await supabase.from('class_posts').select('id').eq('class_id', classId).neq('type', 'INTERNAL');
    if(!posts) return;
    const read = JSON.parse(localStorage.getItem(`ava3_read_posts_${enrollment.id}`) || '[]');
    const count = posts.filter(p => !read.includes(p.id)).length;
    const badge = document.getElementById('mural-badge');
    if(badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-block' : 'none'; }
}

// === UTILITÁRIOS ===
function forceSwitchToContent() { const b = document.querySelector('button[data-bs-target="#tab-aula"]'); if(b) bootstrap.Tab.getOrCreateInstance(b).show(); }
function updateOverallProgress() {
    const done = enrollment.grades.completed.filter(id => flatLessons.some(l => l.id === id)).length;
    const pct = flatLessons.length > 0 ? Math.round((done / flatLessons.length) * 100) : 0;
    document.getElementById('overall-progress').style.width = `${pct}%`;
    document.getElementById('progress-text').textContent = `${pct}%`;
}
function getEmbedUrl(url) { if(!url) return ''; if(url.includes('watch?v=')) return url.replace('watch?v=', 'embed/'); if(url.includes('drive.google.com')) return url.replace('/view', '/preview'); return url; }
async function checkEditorAccess(courseId) { /* Lógica já inclusa no loadCourse */ }

window.toggleLessonStatus = async () => {
    const done = enrollment.grades.completed.includes(currentLesson.id);
    if(done) enrollment.grades.completed = enrollment.grades.completed.filter(id => id !== currentLesson.id);
    else enrollment.grades.completed.push(currentLesson.id);
    await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id);
    loadCourse(); updateOverallProgress(); updateFinishButton();
};

function updateFinishButton() {
    const btn = document.getElementById('btn-finish');
    const done = enrollment.grades.completed.includes(currentLesson.id);
    if(['QUIZ','TAREFA'].includes(currentLesson.type)) {
        btn.disabled = true;
        btn.innerHTML = done ? "<i class='bx bx-check-double'></i> Concluído" : "Complete a Atividade";
        btn.className = done ? "btn btn-success rounded-pill fw-bold" : "btn btn-outline-secondary rounded-pill fw-bold";
    } else {
        btn.disabled = false;
        btn.onclick = window.toggleLessonStatus;
        btn.innerHTML = done ? "<i class='bx bx-check'></i> Concluído" : "Concluir Aula";
        btn.className = done ? "btn btn-success rounded-pill fw-bold" : "btn btn-outline-success rounded-pill fw-bold";
    }
}

window.loadGrades = () => document.getElementById('grades-list').innerHTML = '<div class="alert alert-info">Notas em desenvolvimento.</div>';
window.loadCalendar = () => {}; window.loadCertificate = () => {};