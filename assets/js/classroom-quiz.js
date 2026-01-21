import { supabase } from './supabaseClient.js';

// Estado local do Quiz
let quizState = { 
    questions: [], currentIndex: 0, answers: {}, totalPoints: 0, 
    lesson: null, enrollmentId: null, currentUserRole: 'student'
};

// Injeta CSS e HTML da Gaveta automaticamente
function setupDrawer() {
    if (document.getElementById('quiz-drawer')) return;
    
    const style = document.createElement('style');
    style.textContent = `
        .quiz-drawer { position: fixed; top: 0; right: -100%; width: 90%; max-width: 1200px; height: 100%; background: #f8f9fa; z-index: 2000; transition: right 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); box-shadow: -10px 0 30px rgba(0,0,0,0.2); display: flex; flex-direction: column; border-left: 1px solid #dee2e6; }
        .quiz-drawer.open { right: 0; }
        .quiz-drawer-header { padding: 20px 30px; background: #fff; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
        .quiz-drawer-body { flex: 1; overflow-y: auto; padding: 40px; }
        .quiz-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1999; display: none; }
        .quiz-backdrop.show { display: block; }
        @media(max-width:768px){ .quiz-drawer { width:100%; } }
    `;
    document.head.appendChild(style);

    const html = `
        <div id="quiz-backdrop" class="quiz-backdrop" onclick="window.Quiz.close()"></div>
        <div id="quiz-drawer" class="quiz-drawer">
            <div class="quiz-drawer-header">
                <h5 class="mb-0 fw-bold text-primary"><i class='bx bx-joystick'></i> Avaliação</h5>
                <button class="btn-close" onclick="window.Quiz.close()"></button>
            </div>
            <div id="quiz-drawer-content" class="quiz-drawer-body"></div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

// --- Funções Exportadas ---

export function openDrawer(lesson, enrollment, role) {
    setupDrawer();
    quizState.lesson = lesson;
    quizState.enrollmentId = enrollment.id;
    quizState.currentUserRole = role;
    
    document.getElementById('quiz-drawer').classList.add('open');
    document.getElementById('quiz-backdrop').classList.add('show');
    
    renderIntro();
}

export function closeDrawer() {
    document.getElementById('quiz-drawer').classList.remove('open');
    document.getElementById('quiz-backdrop').classList.remove('show');
}

function renderIntro() {
    const lesson = quizState.lesson;
    
    // 1. Datas
    const now = new Date();
    const start = lesson.available_from ? new Date(lesson.available_from) : null;
    const end = lesson.available_until ? new Date(lesson.available_until) : null;
    let isLocked = false, lockMsg = "";

    if (start && now < start) { isLocked = true; lockMsg = `Abre em: ${start.toLocaleString()}`; }
    else if (end && now > end) { isLocked = true; lockMsg = `Fechado em: ${end.toLocaleString()}`; }

    if (isLocked && !['admin', 'professor'].includes(quizState.currentUserRole)) {
        document.getElementById('quiz-drawer-content').innerHTML = `<div class="text-center p-5"><i class='bx bx-lock display-1 text-danger'></i><h4>Indisponível</h4><p>${lockMsg}</p></div>`;
        return;
    }

    // 2. Configura Sorteio
    let qCount = 0, limit = 10, quizDataObj = null;
    if (lesson.quiz_data) quizDataObj = lesson.quiz_data;
    else if (lesson.description && lesson.description.startsWith('{')) { try { quizDataObj = JSON.parse(lesson.description); } catch(e){} }

    if (quizDataObj) {
        qCount = quizDataObj.questions ? quizDataObj.questions.length : (Array.isArray(quizDataObj) ? quizDataObj.length : 0);
        if (quizDataObj.settings && quizDataObj.settings.drawCount) limit = parseInt(quizDataObj.settings.drawCount);
        else if (Array.isArray(quizDataObj)) limit = qCount;
        else limit = qCount;
    }
    const questionsToAsk = Math.min(qCount, limit);

    // 3. Tentativas (Max 2)
    // Precisamos buscar o enrollment atualizado para garantir contagem correta
    // Por simplificação, vamos assumir que o enrollment passado está fresco ou usar um contador local se não vier do banco
    const attempts = (window.currentEnrollment.grades.attempts && window.currentEnrollment.grades.attempts[lesson.id]) || 0;
    const maxAttempts = 2;
    const lastScore = window.currentEnrollment.grades.scores[lesson.id];
    
    let btnHtml = '';
    if(attempts >= maxAttempts && !['admin', 'professor'].includes(quizState.currentUserRole)) {
        btnHtml = `<div class="alert alert-warning">Você esgotou suas ${maxAttempts} tentativas. Nota final: ${lastScore}</div>`;
    } else {
        const lbl = attempts > 0 ? `Tentar Novamente (${attempts}/${maxAttempts})` : "Iniciar";
        btnHtml = `<button class="btn btn-primary btn-lg rounded-pill px-5 fw-bold" onclick="window.Quiz.start()">${lbl}</button>`;
    }

    document.getElementById('quiz-drawer-content').innerHTML = `
        <div class="container-fluid px-0">
            <h3 class="fw-bold mb-3">${lesson.title}</h3>
            ${isLocked ? `<div class="alert alert-warning">Modo Professor: Fora do prazo (${lockMsg})</div>` : ''}
            <div class="row g-3 mb-4">
                <div class="col-6"><div class="p-3 bg-white border rounded text-center"><small class="text-muted fw-bold">Questões</small><div class="fs-4 fw-bold text-primary">${questionsToAsk}</div></div></div>
                <div class="col-6"><div class="p-3 bg-white border rounded text-center"><small class="text-muted fw-bold">Pontos</small><div class="fs-4 fw-bold text-success">${lesson.points||0}</div></div></div>
            </div>
            ${lesson.description && !lesson.description.startsWith('{') ? `<div class="p-3 bg-white border rounded mb-4">${lesson.description}</div>` : ''}
            <div class="text-center mt-5">${btnHtml}</div>
        </div>`;
}

export function start() {
    const lesson = quizState.lesson;
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

    if (!allQuestions.length) { alert("Sem questões."); return; }

    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    quizState.questions = shuffled.slice(0, limit);
    quizState.currentIndex = 0;
    quizState.answers = {};
    quizState.totalPoints = lesson.points || 100;
    
    renderStep();
}

function renderStep() {
    const container = document.getElementById('quiz-drawer-content');
    const q = quizState.questions[quizState.currentIndex];
    const total = quizState.questions.length;
    const progress = ((quizState.currentIndex + 1) / total) * 100;

    let optionsHtml = '';
    if(q.options) {
        q.options.forEach((opt, idx) => {
            const isSelected = quizState.answers[quizState.currentIndex] === idx;
            optionsHtml += `
                <div class="card mb-2 cursor-pointer ${isSelected ? 'border-primary bg-primary bg-opacity-10' : ''}" onclick="window.Quiz.selectAnswer(${idx})">
                    <div class="card-body py-3 d-flex align-items-center">
                        <div class="rounded-circle border ${isSelected?'bg-primary border-primary':'bg-white'}" style="width:20px;height:20px;min-width:20px;"></div>
                        <span class="ms-3 fw-medium">${opt.text || opt}</span>
                    </div>
                </div>`;
        });
    }

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="badge bg-light text-dark border">Q ${quizState.currentIndex+1}/${total}</span>
            <div class="progress w-50" style="height: 6px;"><div class="progress-bar" style="width: ${progress}%"></div></div>
        </div>
        <h5 class="fw-bold mb-4 lh-base">${q.text || q.title}</h5>
        <div class="mb-5">${optionsHtml}</div>
        <div class="d-flex justify-content-between mt-auto pt-3 border-top">
            <button class="btn btn-outline-secondary" onclick="window.Quiz.prev()" ${quizState.currentIndex===0?'disabled':''}>Anterior</button>
            ${quizState.currentIndex === total - 1 
                ? `<button class="btn btn-success fw-bold px-4" onclick="window.Quiz.finish()">Finalizar</button>`
                : `<button class="btn btn-primary fw-bold px-4" onclick="window.Quiz.next()">Próxima</button>`
            }
        </div>`;
}

export function selectAnswer(idx) { quizState.answers[quizState.currentIndex] = idx; renderStep(); }
export function next() { if (quizState.currentIndex < quizState.questions.length - 1) { quizState.currentIndex++; renderStep(); } }
export function prev() { if (quizState.currentIndex > 0) { quizState.currentIndex--; renderStep(); } }

export async function finish() {
    if(!confirm("Finalizar?")) return;
    
    let correct = 0;
    quizState.questions.forEach((q, idx) => {
        const ans = quizState.answers[idx];
        if(ans !== undefined && String(ans) === String(q.correctIndex)) correct++;
    });
    
    const finalScore = Math.round((correct / quizState.questions.length) * quizState.totalPoints);
    document.getElementById('quiz-drawer-content').innerHTML = `<div class="text-center py-5"><div class="spinner-border"></div><p>Salvando...</p></div>`;

    // Salva no Supabase
    // Nota: O objeto 'window.currentEnrollment' é atualizado pelo classroom.js
    if(!window.currentEnrollment.grades.attempts) window.currentEnrollment.grades.attempts = {};
    const attempts = (window.currentEnrollment.grades.attempts[quizState.lesson.id] || 0) + 1;
    window.currentEnrollment.grades.attempts[quizState.lesson.id] = attempts;
    window.currentEnrollment.grades.scores[quizState.lesson.id] = finalScore;
    
    if (!window.currentEnrollment.grades.completed.includes(quizState.lesson.id)) {
        window.currentEnrollment.grades.completed.push(quizState.lesson.id);
    }

    const { error } = await supabase.from('class_enrollments')
        .update({ grades: window.currentEnrollment.grades })
        .eq('id', quizState.enrollmentId);

    if (error) alert("Erro ao salvar: " + error.message);
    else {
        // Renderiza resultado
        const isPass = (finalScore / quizState.totalPoints) >= 0.7;
        document.getElementById('quiz-drawer-content').innerHTML = `
            <div class="text-center py-5">
                <div class="display-1 mb-3 ${isPass?'text-success':'text-danger'}"><i class='bx ${isPass?'bx-check-circle':'bx-x-circle'}'></i></div>
                <h2>${isPass ? 'Aprovado!' : 'Concluído'}</h2>
                <p class="fs-4">Nota: <strong>${finalScore}</strong> / ${quizState.totalPoints}</p>
                <button class="btn btn-outline-dark mt-4" onclick="window.Quiz.close()">Fechar</button>
            </div>`;
        
        // Atualiza UI principal
        if(window.refreshProgress) window.refreshProgress();
    }
}