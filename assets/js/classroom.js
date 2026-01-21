import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('id') || params.get('classId');

// --- ESTADO GLOBAL ---
let enrollment = null;
let flatLessons = [];
let currentLesson = null;
let currentUserRole = 'student';

// Estado do Quiz (Volátil)
let quizState = { questions: [], currentIndex: -1, answers: {}, totalPoints: 0 };

const ICONS = { 
    'VIDEO_AULA': 'bx-play-circle', 'VIDEO': 'bx-movie-play', 'AUDIO': 'bx-headphone',
    'PODCAST': 'bx-podcast', 'PDF': 'bxs-file-pdf', 'QUIZ': 'bx-trophy', 
    'TAREFA': 'bx-task', 'MATERIAL': 'bx-link', 'TEXTO': 'bx-paragraph', 'default': 'bx-file' 
};

// === INICIALIZAÇÃO ===
document.addEventListener('DOMContentLoaded', async () => {
    if (!classId) { window.location.href = 'app.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    try {
        // Injeta CSS da Gaveta do Quiz dinamicamente
        injectQuizDrawerCSS();
        
        await checkUserRole(session.user.id);
        await loadEnrollment(session.user.id);
        await loadCourse();
        
        // Abre primeira aula pendente
        if (flatLessons.length > 0) {
            const validIds = flatLessons.map(l => l.id);
            enrollment.grades.completed = enrollment.grades.completed.filter(id => validIds.includes(id));
            const next = flatLessons.find(l => !enrollment.grades.completed.includes(l.id)) || flatLessons[0];
            openLesson(next);
        }
        
        updateOverallProgress();
        loadMural(); 
        checkUnreadMural(); 
    } catch (error) { 
        console.error("Erro:", error);
    }
});

// --- CSS DA GAVETA (INJETADO) ---
function injectQuizDrawerCSS() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* Overlay Escuro */
        .quiz-backdrop {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); z-index: 2000; display: none;
            backdrop-filter: blur(2px);
        }
        .quiz-backdrop.show { display: block; }

        /* Gaveta Deslizante */
        .quiz-drawer {
            position: fixed; top: 0; right: -100%; width: 90%; max-width: 1000px; height: 100%;
            background: #fff; z-index: 2001;
            transition: right 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
            box-shadow: -10px 0 30px rgba(0,0,0,0.3);
            display: flex; flex-direction: column;
        }
        .quiz-drawer.open { right: 0; }

        /* Header e Body da Gaveta */
        .quiz-drawer-header {
            padding: 20px 30px; background: #f8f9fa; border-bottom: 1px solid #e2e8f0;
            display: flex; justify-content: space-between; align-items: center;
        }
        .quiz-drawer-body { flex: 1; overflow-y: auto; padding: 40px; background: #fff; }
        
        @media(max-width: 768px) { .quiz-drawer { width: 100%; } }
    `;
    document.head.appendChild(style);

    // Cria elementos HTML se não existirem
    if (!document.getElementById('quiz-drawer')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="quiz-backdrop" class="quiz-backdrop" onclick="window.closeQuizDrawer()"></div>
            <div id="quiz-drawer" class="quiz-drawer">
                <div class="quiz-drawer-header">
                    <h5 class="mb-0 fw-bold"><i class='bx bx-joystick'></i> Avaliação</h5>
                    <button class="btn-close" onclick="window.closeQuizDrawer()"></button>
                </div>
                <div id="quiz-drawer-content" class="quiz-drawer-body"></div>
            </div>
        `);
    }
}

// === LÓGICA PRINCIPAL DO CLASSROOM ===

async function checkUserRole(userId) {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (data) currentUserRole = data.role;
}

async function loadEnrollment(userId) {
    const { data, error } = await supabase.from('class_enrollments').select('*').eq('class_id', classId).eq('user_id', userId).single();
    if (error || !data) throw new Error("Matrícula não encontrada.");
    enrollment = data;
    // Garante estrutura de notas e tentativas
    if (!enrollment.grades) enrollment.grades = { completed: [], scores: {}, attempts: {} };
    if (!enrollment.grades.scores) enrollment.grades.scores = {};
    if (!enrollment.grades.attempts) enrollment.grades.attempts = {}; // Contador de tentativas
    if (!enrollment.grades.completed) enrollment.grades.completed = [];
}

async function loadCourse() {
    const { data: cls } = await supabase.from('classes').select('*, courses(title)').eq('id', classId).single();
    if (cls) {
        document.getElementById('header-course-title').textContent = cls.courses?.title;
        document.getElementById('header-class-name').textContent = cls.name;
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
    forceSwitchToContent();
    
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`lesson-${lesson.id}`)?.classList.add('active');
    document.getElementById('lbl-title').textContent = lesson.title;
    document.getElementById('lbl-type').textContent = lesson.type;
    
    const activity = document.getElementById('activity-area');
    const playerFrame = document.getElementById('player-frame');
    const descContainer = document.getElementById('lbl-desc');
    
    activity.innerHTML = ''; playerFrame.style.display = 'none'; playerFrame.innerHTML = '';

    // Lógica Específica do QUIZ (Gaveta)
    if (lesson.type === 'QUIZ') {
        descContainer.style.display = 'none'; // Esconde descrição padrão
        
        // Renderiza um placeholder na tela principal
        activity.innerHTML = `
            <div class="d-flex flex-column align-items-center justify-content-center py-5 bg-white border rounded shadow-sm" style="min-height: 400px;">
                <div class="mb-3 p-4 bg-primary bg-opacity-10 rounded-circle text-primary"><i class='bx bx-joystick display-1'></i></div>
                <h3 class="fw-bold">Avaliação</h3>
                <p class="text-muted mb-4">Esta atividade deve ser realizada no painel lateral.</p>
                <button class="btn btn-primary btn-lg rounded-pill px-5 fw-bold shadow-sm" onclick="window.openQuizDrawer()">
                    <i class='bx bx-window-open'></i> Abrir Avaliação
                </button>
            </div>
        `;
        
        // Abre a gaveta automaticamente
        window.openQuizDrawer();
    
    } else {
        // Outros Tipos (Mantém como estava)
        descContainer.style.display = 'block';
        descContainer.innerHTML = lesson.description || '';
        
        const url = getEmbedUrl(lesson.video_url || lesson.content_url);
        
        if (lesson.type === 'VIDEO_AULA' || lesson.type === 'VIDEO') {
            playerFrame.style.display = 'flex'; playerFrame.innerHTML = `<iframe src="${url}" allowfullscreen></iframe>`;
        } else if (lesson.type === 'AUDIO' || lesson.type === 'PODCAST') {
            activity.innerHTML = `<div class="audio-container"><i class='bx bx-headphone display-1 text-primary mb-3'></i><audio controls class="w-100"><source src="${url}" type="audio/mpeg"></audio></div>`;
        } else if ((lesson.type === 'PDF' || lesson.type === 'MATERIAL') && url) {
            activity.innerHTML = `<iframe class="pdf-viewer" src="${url}"></iframe>`;
        } else if (lesson.type === 'TEXTO') {
            activity.innerHTML = `<div class="p-4 bg-light rounded border">${lesson.description || 'Conteúdo não disponível.'}</div>`;
        } else if (lesson.type === 'TAREFA') {
            activity.innerHTML = `<div class="alert alert-info">Módulo de Tarefas será carregado aqui (preservado).</div>`;
            // Aqui entraria sua lógica de tarefa se tiver, mas o foco é o Quiz.
        }
    }
    
    updateFinishButton();
    updateNavigation(); // Atualiza botões Prev/Next
    if (window.innerWidth < 992) document.getElementById('course-nav').classList.add('closed');
}

// === GESTÃO DA GAVETA DO QUIZ ===

window.openQuizDrawer = () => {
    document.getElementById('quiz-drawer').classList.add('open');
    document.getElementById('quiz-backdrop').classList.add('show');
    renderQuizIntro(currentLesson);
};

window.closeQuizDrawer = () => {
    document.getElementById('quiz-drawer').classList.remove('open');
    document.getElementById('quiz-backdrop').classList.remove('show');
};

// === LÓGICA DO QUIZ (SORTEIO, DATAS, TENTATIVAS) ===

function renderQuizIntro(lesson) {
    const container = document.getElementById('quiz-drawer-content');
    
    // 1. Verificação de Datas
    const now = new Date();
    const start = lesson.available_from ? new Date(lesson.available_from) : null;
    const end = lesson.available_until ? new Date(lesson.available_until) : null;
    let isLocked = false, lockMsg = "";

    if (start && now < start) { isLocked = true; lockMsg = `Abre em: ${start.toLocaleString()}`; }
    else if (end && now > end) { isLocked = true; lockMsg = `Fechado em: ${end.toLocaleString()}`; }

    // Bloqueia se não for admin
    if (isLocked && !['admin', 'professor'].includes(currentUserRole)) {
        container.innerHTML = `
            <div class="h-100 d-flex flex-column align-items-center justify-content-center text-center">
                <i class='bx bx-time-five display-1 text-danger mb-3'></i>
                <h4 class="fw-bold text-secondary">Avaliação Indisponível</h4>
                <p class="text-danger bg-danger bg-opacity-10 px-3 py-2 rounded fw-bold">${lockMsg}</p>
                <button class="btn btn-outline-secondary mt-3" onclick="window.closeQuizDrawer()">Fechar</button>
            </div>`;
        return;
    }

    // 2. Configuração de Sorteio
    let qCount = 0, limit = 10, quizDataObj = null;
    if (lesson.quiz_data) quizDataObj = lesson.quiz_data;
    else if (lesson.description && lesson.description.startsWith('{')) { try { quizDataObj = JSON.parse(lesson.description); } catch(e){} }

    if (quizDataObj) {
        qCount = quizDataObj.questions ? quizDataObj.questions.length : (Array.isArray(quizDataObj) ? quizDataObj.length : 0);
        // Usa drawCount se existir
        if (quizDataObj.settings && quizDataObj.settings.drawCount) limit = parseInt(quizDataObj.settings.drawCount);
        else if (Array.isArray(quizDataObj)) limit = qCount;
        else limit = qCount;
    }
    const questionsToAsk = Math.min(qCount, limit);

    // 3. Controle de Tentativas (Max 2)
    const attemptsUsed = enrollment.grades.attempts[lesson.id] || 0;
    const maxAttempts = 2;
    const bestScore = enrollment.grades.scores[lesson.id];
    const canTry = attemptsUsed < maxAttempts;

    // Botão de Ação
    let actionBtn = '';
    if (!canTry && !['admin', 'professor'].includes(currentUserRole)) {
        actionBtn = `
            <div class="alert alert-warning border-warning">
                <strong>Tentativas Esgotadas!</strong><br>
                Você já realizou esta avaliação ${attemptsUsed} vezes.<br>
                Nota registrada: <strong>${bestScore !== undefined ? bestScore : '-'}</strong>
            </div>
            <button class="btn btn-secondary w-100" disabled>Iniciar (Bloqueado)</button>
        `;
    } else {
        const btnText = attemptsUsed === 0 ? "INICIAR AVALIAÇÃO" : `TENTAR NOVAMENTE (${attemptsUsed}/${maxAttempts})`;
        actionBtn = `<button class="btn btn-primary btn-lg w-100 rounded-pill fw-bold shadow-sm" onclick="window.startQuizLogic()">${btnText}</button>`;
    }

    container.innerHTML = `
        <div class="container-fluid px-2">
            <h2 class="fw-bold mb-3">${lesson.title}</h2>
            <div class="text-secondary mb-4 p-3 bg-white border rounded">
                ${lesson.description && !lesson.description.startsWith('{') ? lesson.description : 'Sem instruções adicionais.'}
            </div>

            ${isLocked ? `<div class="alert alert-warning mb-4"><strong>Modo Professor:</strong> Visualizando fora do prazo (${lockMsg})</div>` : ''}

            <div class="row g-3 mb-4">
                <div class="col-6"><div class="p-3 bg-white border rounded text-center"><small class="text-muted fw-bold">QUESTÕES</small><div class="fs-4 fw-bold text-primary">${questionsToAsk}</div></div></div>
                <div class="col-6"><div class="p-3 bg-white border rounded text-center"><small class="text-muted fw-bold">PONTOS</small><div class="fs-4 fw-bold text-success">${lesson.points || 0}</div></div></div>
                <div class="col-6"><div class="p-3 bg-white border rounded text-center"><small class="text-muted fw-bold">TENTATIVAS</small><div class="fs-4 fw-bold text-dark">${attemptsUsed} / ${maxAttempts}</div></div></div>
                <div class="col-6"><div class="p-3 bg-white border rounded text-center"><small class="text-muted fw-bold">SUA NOTA</small><div class="fs-4 fw-bold text-dark">${bestScore !== undefined ? bestScore : '-'}</div></div></div>
            </div>

            <div class="mt-5">
                ${actionBtn}
            </div>
        </div>
    `;
}

window.startQuizLogic = () => {
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

    if (!allQuestions.length) { alert("Sem questões configuradas."); return; }

    // Sorteio
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, limit);

    quizState = { 
        questions: selectedQuestions, 
        currentIndex: 0, 
        answers: {}, 
        totalPoints: lesson.points || 100 
    };
    
    renderQuizStep();
};

window.renderQuizStep = () => {
    const container = document.getElementById('quiz-drawer-content');
    const q = quizState.questions[quizState.currentIndex];
    const total = quizState.questions.length;
    const progress = ((quizState.currentIndex + 1) / total) * 100;

    let optionsHtml = '';
    if(q.options) {
        q.options.forEach((opt, idx) => {
            const isSelected = quizState.answers[quizState.currentIndex] === idx;
            optionsHtml += `
                <div class="card mb-3 cursor-pointer ${isSelected ? 'border-primary bg-primary bg-opacity-10' : ''}" onclick="window.selectQuizAnswer(${idx})">
                    <div class="card-body py-3 d-flex align-items-center">
                        <div class="rounded-circle border ${isSelected?'bg-primary border-primary':'bg-white'}" style="width:20px;height:20px;min-width:20px;"></div>
                        <span class="ms-3 fw-medium text-dark">${opt.text || opt}</span>
                    </div>
                </div>`;
        });
    }

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <span class="badge bg-light text-dark border">Q ${quizState.currentIndex+1}/${total}</span>
            <div class="progress w-50" style="height: 6px;"><div class="progress-bar" style="width: ${progress}%"></div></div>
        </div>
        
        <h5 class="fw-bold mb-4 lh-base text-dark">${q.text || q.title}</h5>
        <div class="mb-5">${optionsHtml}</div>
        
        <div class="d-flex justify-content-between mt-auto pt-3 border-top">
            <button class="btn btn-outline-secondary" onclick="window.quizPrev()" ${quizState.currentIndex===0?'disabled':''}>Anterior</button>
            ${quizState.currentIndex === total - 1 
                ? `<button class="btn btn-success fw-bold px-4" onclick="window.quizFinish()">Finalizar</button>`
                : `<button class="btn btn-primary fw-bold px-4" onclick="window.quizNext()">Próxima</button>`
            }
        </div>
    `;
};

window.selectQuizAnswer = (idx) => { quizState.answers[quizState.currentIndex] = idx; renderQuizStep(); };
window.quizNext = () => { if (quizState.currentIndex < quizState.questions.length - 1) { quizState.currentIndex++; renderQuizStep(); } };
window.quizPrev = () => { if (quizState.currentIndex > 0) { quizState.currentIndex--; renderQuizStep(); } };

window.quizFinish = async () => {
    if(!confirm("Tem certeza que deseja finalizar a avaliação?")) return;
    
    // Calcula Nota
    let correct = 0;
    quizState.questions.forEach((q, idx) => {
        const ans = quizState.answers[idx];
        if(ans !== undefined && String(ans) === String(q.correctIndex)) correct++;
    });
    
    const finalScore = Math.round((correct / quizState.questions.length) * quizState.totalPoints);
    
    document.getElementById('quiz-drawer-content').innerHTML = `<div class="h-100 d-flex flex-column align-items-center justify-content-center"><div class="spinner-border text-primary mb-3"></div><p>Salvando resultados...</p></div>`;

    // Atualiza Enrollment (Incrementa tentativas e salva nota)
    const attempts = (enrollment.grades.attempts[currentLesson.id] || 0) + 1;
    enrollment.grades.attempts[currentLesson.id] = attempts;
    
    // Só atualiza a nota se for maior que a anterior (opcional, aqui sobrescreve a última)
    enrollment.grades.scores[currentLesson.id] = finalScore;
    
    if (!enrollment.grades.completed.includes(currentLesson.id)) {
        enrollment.grades.completed.push(currentLesson.id);
    }

    const { error } = await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id);

    if (error) {
        alert('Erro ao salvar: ' + error.message);
        renderQuizStep(); // Volta se der erro
    } else {
        // Tela Final
        const isPass = (finalScore / quizState.totalPoints) >= 0.7;
        document.getElementById('quiz-drawer-content').innerHTML = `
            <div class="h-100 d-flex flex-column align-items-center justify-content-center text-center">
                <div class="display-1 mb-3 ${isPass?'text-success':'text-danger'}"><i class='bx ${isPass?'bx-check-circle':'bx-x-circle'}'></i></div>
                <h2 class="fw-bold mb-2">${isPass ? 'Aprovado!' : 'Concluído'}</h2>
                <p class="fs-4 text-muted mb-4">Nota: <strong>${finalScore}</strong> / ${quizState.totalPoints}</p>
                <button class="btn btn-outline-dark px-5 rounded-pill" onclick="window.closeQuizDrawer()">Fechar Painel</button>
            </div>`;
        
        updateOverallProgress(); // Atualiza barra principal
        updateFinishButton();    // Atualiza botão principal
    }
};

// === UTILITÁRIOS GERAIS ===

function updateNavigation() {
    const idx = flatLessons.findIndex(l => l.id === currentLesson.id);
    const prevBtn = document.getElementById('btn-prev');
    const nextBtn = document.getElementById('btn-next');
    if (idx > 0) { prevBtn.disabled = false; prevBtn.onclick = () => openLesson(flatLessons[idx - 1]); } 
    else { prevBtn.disabled = true; prevBtn.onclick = null; }
    if (idx < flatLessons.length - 1) { nextBtn.disabled = false; nextBtn.onclick = () => openLesson(flatLessons[idx + 1]); } 
    else { nextBtn.disabled = true; nextBtn.onclick = null; }
}

function updateOverallProgress() {
    const done = enrollment.grades.completed.filter(id => flatLessons.some(l => l.id === id)).length;
    const pct = flatLessons.length > 0 ? Math.round((done/flatLessons.length)*100) : 0;
    document.getElementById('overall-progress').style.width = `${pct}%`; document.getElementById('progress-text').textContent = `${pct}%`;
}

function forceSwitchToContent() { const b = document.querySelector('button[data-bs-target="#tab-aula"]'); if(b) bootstrap.Tab.getOrCreateInstance(b).show(); }

function getEmbedUrl(url) { if(!url) return ''; if(url.includes('watch?v=')) return url.replace('watch?v=', 'embed/'); if(url.includes('drive.google.com')) return url.replace('/view', '/preview'); return url; }

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
        btn.disabled = true; btn.innerHTML = done ? "Concluído" : "Pendente";
        btn.className = done ? "btn btn-success rounded-pill" : "btn btn-outline-secondary rounded-pill";
    } else {
        btn.disabled = false; btn.onclick = window.toggleLessonStatus;
        btn.innerHTML = done ? "Concluído" : "Concluir";
        btn.className = done ? "btn btn-success rounded-pill" : "btn btn-outline-success rounded-pill";
    }
}

// === MURAL (Preservado) ===
window.loadMural = async () => {
    const c = document.getElementById('wall-container'); if(!c) return;
    const { data: p } = await supabase.from('class_posts').select('*').eq('class_id', classId).neq('type','INTERNAL').order('created_at',{ascending:false});
    if(!p || !p.length) { c.innerHTML = '<div class="text-center p-5 opacity-50">Vazio</div>'; return; }
    const r = JSON.parse(localStorage.getItem(`ava3_read_${enrollment.id}`) || '[]');
    c.innerHTML = p.map(x => `<div class="post-it post-yellow">${!r.includes(x.id)?'<div class="new-indicator">!</div>':''}<div class="post-body"><b>${x.title}</b><br>${x.content}</div><div class="post-footer"><button class="btn-read-mark" onclick="window.markPostRead('${x.id}')">Lido</button></div></div>`).join('');
};
window.markPostRead = (id) => { let r = JSON.parse(localStorage.getItem(`ava3_read_${enrollment.id}`)||'[]'); if(!r.includes(id)) r.push(id); localStorage.setItem(`ava3_read_${enrollment.id}`, JSON.stringify(r)); loadMural(); };
async function checkUnreadMural() {} 

window.loadGrades = () => document.getElementById('grades-list').innerHTML = '<div class="alert alert-info">Em breve.</div>';
window.loadCalendar = () => {}; window.loadCertificate = () => {};