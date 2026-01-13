import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('id') || params.get('classId');

let enrollment = null;
let flatLessons = [];
let currentLesson = null;
let quizState = { data: null, currentIndex: -1, answers: {}, isFinished: false };

const ICONS = { 'VIDEO_AULA': 'bx-play-circle', 'PDF': 'bxs-file-pdf', 'QUIZ': 'bx-trophy', 'default': 'bx-file' };

document.addEventListener('DOMContentLoaded', async () => {
    if (!classId) { window.location.href = 'app.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';

    try {
        await loadEnrollment(session.user.id);
        await loadCourse();
        if (flatLessons.length > 0) openLesson(flatLessons[0]);
    } catch (error) { console.error("Erro ao carregar dados:", error); }
});

async function loadEnrollment(userId) {
    const { data, error } = await supabase.from('class_enrollments').select('*').eq('class_id', classId).eq('user_id', userId).single();
    if (error || !data) throw new Error("Sem matrícula");
    enrollment = data;
    if (!enrollment.grades) enrollment.grades = { completed: [] };
    updateProgressUI();
}

function updateProgressUI() {
    // Implementação futura se necessário
}

async function loadCourse() {
    const { data: cls } = await supabase.from('classes').select('*, courses(title)').eq('id', classId).single();
    if (cls) {
        document.getElementById('header-course-title').textContent = cls.courses?.title || 'Curso';
        document.getElementById('header-class-name').textContent = cls.name;
    }
    const { data: modules } = await supabase.from('modules').select(`*, sections(*, lessons(*))`).eq('course_id', cls.course_id).order('ordem');
    
    const container = document.getElementById('modules-list');
    container.innerHTML = ''; flatLessons = [];
    
    modules.forEach(mod => {
        let modHtml = `<div class="p-3 bg-light fw-bold small text-uppercase text-secondary border-bottom">${mod.title}</div>`;
        mod.sections.forEach(sec => {
            sec.lessons.forEach(l => {
                flatLessons.push(l);
                const isDone = enrollment.grades.completed.includes(l.id);
                modHtml += `
                    <div class="lesson-item ${isDone?'completed':''}" id="lesson-${l.id}" onclick="window.openLessonById(${l.id})">
                        <i class='bx ${ICONS[l.type] || ICONS.default} fs-5'></i>
                        <span class="text-truncate flex-grow-1">${l.title}</span>
                        ${isDone ? "<i class='bx bxs-check-circle text-success'></i>" : ""}
                    </div>`;
            });
        });
        container.innerHTML += modHtml;
    });
}

window.openLessonById = (id) => { const l = flatLessons.find(x => x.id === id); if(l) openLesson(l); };

function openLesson(lesson) {
    currentLesson = lesson;
    
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`lesson-${lesson.id}`)?.classList.add('active');
    
    document.getElementById('lbl-title').textContent = lesson.title;
    document.getElementById('lbl-desc').innerHTML = lesson.description || '';
    document.getElementById('lbl-type').textContent = lesson.type.replace('_', ' ');

    const activity = document.getElementById('activity-area');
    const playerFrame = document.getElementById('player-frame');
    activity.innerHTML = '';
    playerFrame.style.display = 'none';
    playerFrame.innerHTML = '';

    if (lesson.type === 'VIDEO_AULA' && lesson.video_url) {
        playerFrame.style.display = 'block';
        playerFrame.innerHTML = `<iframe src="${getEmbedUrl(lesson.video_url)}" allowfullscreen></iframe>`;
    } else if (lesson.type === 'PDF' && lesson.content_url) {
        activity.innerHTML = `<a href="${lesson.content_url}" target="_blank" class="btn btn-outline-primary w-100 py-3"><i class='bx bxs-file-pdf'></i> Abrir Material em PDF</a>`;
    }

    if (lesson.type === 'QUIZ') {
        let qs = [...(lesson.quiz_data?.questions || [])];
        if (lesson.quiz_data?.settings?.mode === 'bank') {
            qs = qs.sort(() => Math.random() - 0.5).slice(0, lesson.quiz_data.settings.drawCount || 5);
        }
        quizState = { data: { questions: qs }, currentIndex: -1, answers: {}, isFinished: false };
        renderQuizStep();
    }

    updateFinishButton();
}

function renderQuizStep() {
    const container = document.getElementById('activity-area');
    const { data, currentIndex, answers, isFinished } = quizState;

    if (isFinished) {
        let correct = 0;
        data.questions.forEach((q, i) => { if(q.options[answers[i]]?.isCorrect) correct++; });
        const score = (correct / data.questions.length) * (currentLesson.points || 0);
        container.innerHTML = `<div class="text-center p-5"><h2>Resultado</h2><div class="display-1 text-primary">${score.toFixed(1)}</div><p>Pontos obtidos</p></div>`;
        return;
    }

    if (currentIndex === -1) {
        container.innerHTML = `<div class="text-center p-5"><h4>${data.questions.length} questões</h4><button class="btn btn-primary px-5 mt-3" onclick="window.nextQuizStep()">Iniciar</button></div>`;
    } else {
        const q = data.questions[currentIndex];
        container.innerHTML = `<h5>${q.text}</h5><div class="mt-4">` + q.options.map((opt, i) => `
            <div class="quiz-option-card p-3 mb-2" onclick="window.saveAns(${i})">
                <input type="radio" name="q" ${answers[currentIndex]==i?'checked':''}> ${opt.text || opt}
            </div>`).join('') + `</div>
            <div class="d-flex justify-content-between mt-4">
                <button class="btn btn-light" onclick="window.prevQuizStep()" ${currentIndex===0?'disabled':''}>Anterior</button>
                <button class="btn btn-primary" onclick="${currentIndex===data.questions.length-1?'window.submitQuiz()':'window.nextQuizStep()'}">
                    ${currentIndex===data.questions.length-1?'Finalizar':'Próxima'}
                </button>
            </div>`;
    }
}

window.nextQuizStep = () => { quizState.currentIndex++; renderQuizStep(); };
window.prevQuizStep = () => { quizState.currentIndex--; renderQuizStep(); };
window.saveAns = (i) => { quizState.answers[quizState.currentIndex] = i; renderQuizStep(); };
window.submitQuiz = () => { quizState.isFinished = true; renderQuizStep(); finishLesson(); };

window.finishLesson = async () => {
    if (enrollment.grades.completed.includes(currentLesson.id)) return;
    enrollment.grades.completed.push(currentLesson.id);
    await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id);
    openLesson(currentLesson);
};

function getEmbedUrl(url) { return url ? url.replace('watch?v=', 'embed/') : ''; }

// === FUNÇÃO DO MURAL (ATUALIZADA E REAL) ===
window.loadMural = async () => {
    const container = document.getElementById('wall-container');
    container.innerHTML = '<div class="text-center py-5 text-muted"><i class="bx bx-loader-alt bx-spin fs-2"></i><p>Carregando mural...</p></div>';

    // Busca posts do banco
    const { data: posts, error } = await supabase
        .from('class_posts')
        .select('*')
        .eq('class_id', classId)
        .order('is_pinned', { ascending: false }) // Fixados primeiro
        .order('created_at', { ascending: false });

    container.innerHTML = ''; // Limpa loader

    if (error) {
        console.error(error);
        container.innerHTML = '<div class="alert alert-danger">Erro ao carregar o mural.</div>';
        return;
    }

    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class='bx bx-message-square-dots fs-1 mb-2'></i>
                <p>Nenhuma publicação no mural ainda.</p>
            </div>`;
        return;
    }

    // Renderiza cada post
    posts.forEach(post => {
        const date = new Date(post.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' });
        const pinnedIcon = post.is_pinned ? `<i class='bx bx-pin text-danger fs-5' title="Fixado"></i>` : '';
        
        let extras = '';
        if (post.resource_url) {
            extras += `<div class="mt-3"><a href="${post.resource_url}" target="_blank" class="btn btn-sm btn-outline-primary"><i class='bx bx-link-external'></i> Acessar Link / Material</a></div>`;
        }
        if (post.event_date) {
            const evtDate = new Date(post.event_date).toLocaleString();
            extras += `<div class="mt-2 text-success fw-bold small bg-light p-2 rounded border border-success"><i class='bx bx-calendar'></i> Evento: ${evtDate}</div>`;
        }

        const html = `
            <div class="wall-post post-${post.type} fade-in-up">
                <div class="post-meta">
                    <span class="post-badge bg-${post.type}">${post.type}</span>
                    <small class="text-muted d-flex align-items-center gap-1">${date} ${pinnedIcon}</small>
                </div>
                <h5 class="fw-bold text-dark mb-2">${post.title}</h5>
                <div class="text-secondary" style="white-space: pre-wrap; line-height: 1.5;">${post.content || ''}</div>
                ${extras}
            </div>`;
        
        container.insertAdjacentHTML('beforeend', html);
    });
};

// Funções de atualização do botão de conclusão
function updateFinishButton() {
    const btn = document.getElementById('btn-finish');
    const isDone = enrollment.grades.completed.includes(currentLesson.id);
    if(isDone) {
        btn.innerHTML = "<i class='bx bx-check'></i> Concluído";
        btn.classList.replace('btn-outline-success', 'btn-success');
    } else {
        btn.innerHTML = "Concluir";
        btn.classList.replace('btn-success', 'btn-outline-success');
    }
}