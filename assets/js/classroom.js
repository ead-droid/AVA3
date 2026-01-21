import { supabase } from './supabaseClient.js';
// Importa o módulo do Quiz
import * as QuizModule from './classroom-quiz.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('id') || params.get('classId');

// Estado
let enrollment = null;
let flatLessons = [];
let currentLesson = null;
let currentUserRole = 'student';
let taskState = { items: [], currentIndex: -1, answers: {}, isSubmitted: false, teacherScores: {}, teacherFeedback: {} };
let gradingCache = { students: [], currentStudentId: null };

const ICONS = { 'VIDEO_AULA': 'bx-play-circle', 'VIDEO': 'bx-movie-play', 'AUDIO': 'bx-headphone', 'PODCAST': 'bx-podcast', 'PDF': 'bxs-file-pdf', 'QUIZ': 'bx-trophy', 'TAREFA': 'bx-task', 'MATERIAL': 'bx-link', 'TEXTO': 'bx-paragraph', 'default': 'bx-file' };

// === INIT ===
document.addEventListener('DOMContentLoaded', async () => {
    if (!classId) { window.location.href = 'app.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    try {
        await checkUserRole(session.user.id);
        await loadEnrollment(session.user.id);
        await loadCourse();
        
        if (flatLessons.length > 0) {
            const validIds = flatLessons.map(l => l.id);
            enrollment.grades.completed = enrollment.grades.completed.filter(id => validIds.includes(id));
            const next = flatLessons.find(l => !enrollment.grades.completed.includes(l.id)) || flatLessons[0];
            openLesson(next);
        }
        updateOverallProgress();
        loadMural(); checkUnreadMural(); 
    } catch (error) { 
        console.error("Erro:", error); 
    }
});

// Ponte para o HTML fechar a gaveta
window.closeQuizDrawer = QuizModule.closeQuizDrawer;

async function checkUserRole(userId) {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (data) currentUserRole = data.role;
}

async function loadEnrollment(userId) {
    const { data } = await supabase.from('class_enrollments').select('*').eq('class_id', classId).eq('user_id', userId).single();
    enrollment = data;
    if (!enrollment.grades) enrollment.grades = { completed: [], scores: {}, tasks: {} };
    if (!enrollment.grades.scores) enrollment.grades.scores = {};
    if (!enrollment.grades.completed) enrollment.grades.completed = [];
    if (!enrollment.grades.tasks) enrollment.grades.tasks = {};
}

async function loadCourse() {
    const { data: cls } = await supabase.from('classes').select('*, courses(title)').eq('id', classId).single();
    if (cls) {
        document.getElementById('header-course-title').textContent = cls.courses?.title;
        document.getElementById('header-class-name').textContent = cls.name;
        if (['admin', 'professor'].includes(currentUserRole)) {
            const headerActions = document.getElementById('header-actions');
            if (headerActions && !document.getElementById('btn-edit-course')) {
                const editBtn = document.createElement('a');
                editBtn.id = 'btn-edit-course';
                editBtn.href = `course-editor.html?id=${cls.course_id}`; 
                editBtn.className = 'btn btn-sm btn-dark border-0 fw-bold shadow-sm me-2';
                editBtn.innerHTML = `<i class='bx bx-edit-alt'></i> Editar Conteúdo`;
                headerActions.insertBefore(editBtn, headerActions.firstChild);
            }
        }
    }
    const { data: modules } = await supabase.from('modules').select(`*, sections (*, lessons (*))`).eq('course_id', cls.course_id).order('ordem', { ascending: true });
    
    const container = document.getElementById('modules-list');
    container.innerHTML = ''; flatLessons = [];
    
    if (modules) {
        modules.forEach(mod => {
            if(mod.sections) mod.sections.sort((a,b)=> (a.ordem||0)-(b.ordem||0));
            mod.sections.forEach(sec => { if(sec.lessons) sec.lessons.sort((a,b)=> (a.ordem||0)-(b.ordem||0)); });
        });
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
                        lessonsHtml += `<div class="lesson-item ${isDone?'completed':''}" id="lesson-${l.id}" onclick="window.openLessonById(${l.id})"><i class='bx ${ICONS[l.type] || ICONS.default} fs-5'></i><span class="text-truncate flex-grow-1">${l.title}</span>${isDone ? "<i class='bx bxs-check-circle text-success'></i>" : ""}</div>`;
                    });
                }
            });
            container.innerHTML += `<div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#${modId}"><div class="d-flex w-100 justify-content-between me-2 align-items-center"><span>${mod.title}</span></div></button></h2><div id="${modId}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#modules-list"><div class="accordion-body p-0">${lessonsHtml}</div></div></div>`;
        });
    }
}

window.openLessonById = (id) => { const l = flatLessons.find(x => x.id === id); if(l) openLesson(l); };

function openLesson(lesson) {
    currentLesson = lesson;
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`lesson-${lesson.id}`)?.classList.add('active');
    document.getElementById('lbl-title').textContent = lesson.title;
    document.getElementById('lbl-type').textContent = lesson.type;
    
    const activity = document.getElementById('activity-area');
    const playerFrame = document.getElementById('player-frame');
    const descContainer = document.getElementById('lbl-desc');
    
    activity.innerHTML = ''; playerFrame.style.display = 'none'; playerFrame.innerHTML = '';

    if (['TAREFA', 'QUIZ'].includes(lesson.type)) descContainer.style.display = 'none'; 
    else { descContainer.style.display = 'block'; descContainer.innerHTML = lesson.description || ''; }

    const url = getEmbedUrl(lesson.video_url || lesson.content_url);

    // Renderização
    if (lesson.type === 'VIDEO_AULA' || lesson.type === 'VIDEO') {
        playerFrame.style.display = 'flex'; playerFrame.innerHTML = `<iframe src="${url}" allowfullscreen></iframe>`;
    } else if (lesson.type === 'AUDIO' || lesson.type === 'PODCAST') {
        activity.innerHTML = `<div class="audio-container"><i class='bx bx-headphone display-1 text-primary mb-3'></i><audio controls class="w-100"><source src="${url}" type="audio/mpeg"></audio></div>`;
    } else if ((lesson.type === 'PDF' || lesson.type === 'MATERIAL') && url) {
        activity.innerHTML = `<iframe class="pdf-viewer" src="${url}"></iframe>`;
    } else if (lesson.type === 'TEXTO') {
        descContainer.style.display = 'block'; activity.innerHTML = `<div class="p-4 bg-light rounded border">${lesson.description || 'Conteúdo não disponível.'}</div>`;
    } else if (lesson.type === 'TAREFA') {
        renderTaskIntro(lesson);
    } else if (lesson.type === 'QUIZ') {
        // AQUI ESTÁ A MUDANÇA: Abre a gaveta em vez de renderizar inline
        QuizModule.openQuizDrawer(lesson, enrollment, currentUserRole);
        // Exibe um placeholder na tela principal
        activity.innerHTML = `
            <div class="text-center p-5 bg-light rounded border">
                <i class='bx bx-joystick display-1 text-primary mb-3'></i>
                <h3>Avaliação Aberta</h3>
                <p>O questionário está aberto no painel lateral.</p>
                <button class="btn btn-outline-primary" onclick="window.reopenQuizDrawer()">Reabrir Painel</button>
            </div>`;
    }
    
    updateFinishButton();
    updateNavigation();
    if (window.innerWidth < 992) document.getElementById('course-nav').classList.add('closed');
}

// Função auxiliar para reabrir se fechar sem querer
window.reopenQuizDrawer = () => { QuizModule.openQuizDrawer(currentLesson, enrollment, currentUserRole); };

function updateNavigation() {
    const idx = flatLessons.findIndex(l => l.id === currentLesson.id);
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    if (idx > 0) { prevBtn.disabled = false; prevBtn.onclick = () => openLesson(flatLessons[idx - 1]); } 
    else { prevBtn.disabled = true; prevBtn.onclick = null; }
    if (idx < flatLessons.length - 1) { nextBtn.disabled = false; nextBtn.onclick = () => openLesson(flatLessons[idx + 1]); } 
    else { nextBtn.disabled = true; nextBtn.onclick = null; }
}

// === TAREFA (PAGINADA) ===

window.renderTaskIntro = (lesson) => {
    const now = new Date();
    const start = lesson.available_from ? new Date(lesson.available_from) : null;
    const end = lesson.available_until ? new Date(lesson.available_until) : null;
    let isLocked = false, lockMsg = "";

    if (start && now < start) { isLocked = true; lockMsg = `Abre em: ${start.toLocaleString()}`; }
    else if (end && now > end) { isLocked = true; lockMsg = `Fechado em: ${end.toLocaleString()}`; }

    const isAdmin = ['admin', 'professor'].includes(currentUserRole);
    if (isLocked && !isAdmin) {
        document.getElementById('activity-area').innerHTML = `<div class="alert alert-danger text-center p-5"><h4>Tarefa Indisponível</h4><p>${lockMsg}</p></div>`;
        return;
    }

    let items = [];
    let instructions = lesson.description || '';
    if (lesson.task_data) {
        items = lesson.task_data.items || [];
        instructions = lesson.task_data.instructions || instructions;
    } else if (lesson.quiz_data && lesson.quiz_data.items) {
        items = lesson.quiz_data.items; 
    }

    let adminBtn = isAdmin ? `<button class="btn btn-warning text-dark fw-bold w-100 mb-3" onclick="window.openGradingList()"><i class='bx bx-check-circle'></i> Painel de Correção</button>` : '';

    document.getElementById('activity-area').innerHTML = `
        <div class="mx-auto" style="max-width: 96%;">
            ${adminBtn}
            <div class="card border-0 shadow-sm bg-white mb-4">
                <div class="card-body p-5">
                    <h2 class="fw-bold mb-3">${lesson.title}</h2>
                    <div class="text-secondary mb-4 fs-5 p-3 bg-light rounded">${instructions}</div>
                    ${isLocked ? `<div class="alert alert-warning mb-3">Modo Professor: Fora do prazo (${lockMsg})</div>` : ''}
                    <button class="btn btn-primary btn-lg px-5 rounded-pill fw-bold" onclick="window.startTask()">INICIAR TAREFA</button>
                </div>
            </div>
        </div>`;
};

window.startTask = () => {
    const lesson = currentLesson;
    let items = (lesson.task_data && lesson.task_data.items) ? lesson.task_data.items : [];
    if (!items.length && lesson.quiz_data && lesson.quiz_data.items) items = lesson.quiz_data.items;
    
    const savedTask = enrollment.grades.tasks && enrollment.grades.tasks[lesson.id];
    taskState = {
        items: items, currentIndex: 0, answers: savedTask ? savedTask.answers : {},
        isSubmitted: savedTask ? true : false, teacherFeedback: savedTask ? savedTask.item_feedback : {}, teacherScores: savedTask ? savedTask.item_scores : {}
    };
    renderTaskStep();
};

window.renderTaskStep = () => {
    const container = document.getElementById('activity-area');
    const item = taskState.items[taskState.currentIndex];
    const total = taskState.items.length;
    const answer = taskState.answers[item.id] || '';
    
    let inputHtml = item.type === 'text' 
        ? `<textarea class="form-control mb-3 fs-5" rows="6" oninput="window.updateTaskAnswer(${item.id}, this.value)" ${taskState.isSubmitted?'disabled':''}>${answer}</textarea>`
        : `<div class="mb-3"><input type="file" class="form-control" onchange="window.updateTaskFile(${item.id}, this)" ${taskState.isSubmitted?'disabled':''}></div>`;

    // Painel Professor
    let teacherAreaHtml = '';
    if (['admin', 'professor'].includes(currentUserRole)) {
        const score = taskState.teacherScores?.[item.id] || 0;
        const fb = taskState.teacherFeedback?.[item.id] || '';
        teacherAreaHtml = `
            <div class="mt-4 p-4 rounded bg-warning bg-opacity-10 border border-warning">
                <h6 class="fw-bold">Avaliação do Professor</h6>
                <div class="row g-2">
                    <div class="col-3"><label class="small fw-bold">Nota</label><input type="number" class="form-control" value="${score}" max="${item.points}" onchange="window.saveTeacherGrade('${item.id}', 'score', this.value)"></div>
                    <div class="col-9"><label class="small fw-bold">Feedback</label><input type="text" class="form-control" value="${fb}" onchange="window.saveTeacherGrade('${item.id}', 'feedback', this.value)"></div>
                </div>
            </div>`;
    }

    container.innerHTML = `
        <div class="mx-auto" style="max-width: 96%;">
            <div class="card border-0 shadow-sm bg-white">
                <div class="card-body p-5">
                    <div class="d-flex justify-content-between mb-4"><span class="badge bg-primary">Questão ${taskState.currentIndex + 1} / ${total}</span><span class="badge bg-light text-dark border">Vale ${item.points} pts</span></div>
                    <div class="fs-4 mb-5 fw-bold text-dark lh-base">${item.statement}</div>
                    <div class="p-4 bg-light rounded border mb-3"><label class="small text-muted fw-bold mb-2">SUA RESPOSTA:</label>${inputHtml}</div>
                    ${teacherAreaHtml}
                    <div class="d-flex justify-content-between mt-5 border-top pt-4">
                        <button class="btn btn-outline-secondary btn-lg" onclick="window.prevTaskStep()" ${taskState.currentIndex===0?'disabled':''}>Anterior</button>
                        ${taskState.currentIndex === total - 1 ? `<button class="btn btn-success btn-lg px-5 fw-bold" onclick="window.finishTask()" ${taskState.isSubmitted && currentUserRole==='student'?'disabled':''}>${taskState.isSubmitted?'Enviado':'Finalizar'}</button>` : `<button class="btn btn-primary btn-lg px-5 fw-bold" onclick="window.nextTaskStep()">Próxima</button>`}
                    </div>
                </div>
            </div>
        </div>`;
};

window.updateTaskAnswer = (id, val) => { taskState.answers[id] = val; };
window.updateTaskFile = (id, inp) => { taskState.answers[id] = inp.files[0] ? inp.files[0].name : "Arquivo"; };
window.nextTaskStep = () => { if(taskState.currentIndex < taskState.items.length - 1) { taskState.currentIndex++; renderTaskStep(); } };
window.prevTaskStep = () => { if(taskState.currentIndex > 0) { taskState.currentIndex--; renderTaskStep(); } };

window.finishTask = async () => {
    if(['admin', 'professor'].includes(currentUserRole)) { alert("Salvo."); return; }
    if(!confirm("Enviar?")) return;
    if (!enrollment.grades.tasks) enrollment.grades.tasks = {};
    enrollment.grades.tasks[currentLesson.id] = { submitted_at: new Date().toISOString(), answers: taskState.answers, status: 'submitted' };
    if (!enrollment.grades.completed.includes(currentLesson.id)) enrollment.grades.completed.push(currentLesson.id);
    await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id);
    alert("Enviado!"); taskState.isSubmitted = true; renderTaskStep(); updateOverallProgress();
};

window.saveTeacherGrade = async (itemId, type, value) => {
    if (!enrollment.grades.tasks) enrollment.grades.tasks = {};
    let task = enrollment.grades.tasks[currentLesson.id] || { answers: {}, item_scores: {}, item_feedback: {}, submitted_at: new Date().toISOString() };
    if(!task.item_scores) task.item_scores = {};
    if(!task.item_feedback) task.item_feedback = {};
    if (type === 'score') task.item_scores[itemId] = parseFloat(value);
    if (type === 'feedback') task.item_feedback[itemId] = value;
    enrollment.grades.tasks[currentLesson.id] = task;
    let total = 0;
    Object.values(task.item_scores).forEach(v => total += (v||0));
    enrollment.grades.scores[currentLesson.id] = total;
    await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id);
};

// === PAINEL DE CORREÇÃO ===
window.openGradingList = async () => {
    const container = document.getElementById('activity-area');
    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div></div>';
    const { data: enrollments } = await supabase.from('class_enrollments').select('id, grades, profiles:user_id(name, email)').eq('class_id', classId);
    let listHtml = `<div class="d-flex align-items-center mb-3"><button class="btn btn-light me-3" onclick="openLesson(currentLesson)"><i class='bx bx-arrow-back'></i> Voltar</button><h4>Entregas</h4></div><div class="list-group">`;
    enrollments.forEach(enrol => {
        const task = enrol.grades?.tasks?.[currentLesson.id];
        if(task && task.status === 'submitted') {
            const score = enrol.grades?.scores?.[currentLesson.id] !== undefined ? enrol.grades.scores[currentLesson.id] : '-';
            listHtml += `<button class="list-group-item list-group-item-action d-flex justify-content-between p-3" onclick="window.gradeStudent('${enrol.id}')"><div><h6 class="mb-0">${enrol.profiles.name}</h6><small>${enrol.profiles.email}</small></div><span class="badge ${score !== '-' ? 'bg-success' : 'bg-warning text-dark'}">Nota: ${score}</span></button>`;
        }
    });
    listHtml += `</div>`;
    container.innerHTML = `<div class="mx-auto bg-white p-4 rounded shadow-sm" style="max-width: 96%;">${listHtml}</div>`;
    gradingCache.students = enrollments;
};

window.gradeStudent = (id) => {
    const student = gradingCache.students.find(e => e.id === id);
    enrollment = student; // Hack: troca enrollment global temporariamente para usar a renderização da tarefa
    taskState = {
        items: currentLesson.task_data.items, currentIndex: 0,
        answers: student.grades.tasks[currentLesson.id].answers,
        isSubmitted: true,
        teacherScores: student.grades.tasks[currentLesson.id].item_scores || {},
        teacherFeedback: student.grades.tasks[currentLesson.id].item_feedback || {}
    };
    renderTaskStep(); // Reusa a renderização padrão que já tem o painel amarelo
};

// === UTILITÁRIOS ===
window.loadMural = async () => {
    const container = document.getElementById('wall-container');
    if (!container) return; 
    const { data: posts } = await supabase.from('class_posts').select('*').eq('class_id', classId).neq('type', 'INTERNAL').order('created_at', { ascending: false });
    if (!posts || !posts.length) { container.innerHTML = `<div class="text-center p-5 opacity-50"><h4>Mural Vazio</h4></div>`; return; }
    const read = JSON.parse(localStorage.getItem(`ava3_read_posts_${enrollment.id}`) || '[]');
    container.innerHTML = posts.map(p => {
        const isRead = read.includes(p.id);
        return `<div class="post-it post-yellow">${!isRead ? '<div class="new-indicator">NOVO!</div>' : ''}<div class="post-body"><b>${p.title}</b><br>${p.content}</div><div class="post-footer"><button class="btn-read-mark" onclick="window.markPostRead('${p.id}')">Marcar Lido</button></div></div>`;
    }).join('');
};

window.markPostRead = (id) => {
    let read = JSON.parse(localStorage.getItem(`ava3_read_posts_${enrollment.id}`) || '[]');
    if (!read.includes(id)) { read.push(id); localStorage.setItem(`ava3_read_posts_${enrollment.id}`, JSON.stringify(read)); loadMural(); }
};

async function checkUnreadMural() {
    const { data: posts } = await supabase.from('class_posts').select('id').eq('class_id', classId).neq('type', 'INTERNAL');
    if(!posts) return;
    const read = JSON.parse(localStorage.getItem(`ava3_read_posts_${enrollment.id}`) || '[]');
    const count = posts.filter(p => !read.includes(p.id)).length;
    const badge = document.getElementById('mural-badge');
    if(badge) { badge.textContent = count; badge.style.display = count > 0 ? 'inline-block' : 'none'; }
}

function forceSwitchToContent() { const b = document.querySelector('button[data-bs-target="#tab-aula"]'); if(b) bootstrap.Tab.getOrCreateInstance(b).show(); }
function updateOverallProgress() {
    const done = enrollment.grades.completed.filter(id => flatLessons.some(l => l.id === id)).length;
    const pct = flatLessons.length > 0 ? Math.round((done / flatLessons.length) * 100) : 0;
    document.getElementById('overall-progress').style.width = `${pct}%`;
    document.getElementById('progress-text').textContent = `${pct}%`;
}
function getEmbedUrl(url) { if(!url) return ''; if(url.includes('watch?v=')) return url.replace('watch?v=', 'embed/'); if(url.includes('drive.google.com')) return url.replace('/view', '/preview'); return url; }
async function checkEditorAccess(courseId) { /* Lógica inclusa no loadCourse */ }

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