import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('id') || params.get('classId');

let enrollment = null;
let flatLessons = [];
let courseModules = []; 
let currentLesson = null;
let quizState = { data: null, currentIndex: -1, answers: {}, isFinished: false };

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
    if (!classId) { window.location.href = 'app.html'; return; }
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';

    try {
        await loadEnrollment(session.user.id);
        await loadCourse();
        
        // Abre a primeira aula não concluída
        if (flatLessons.length > 0) {
            const validIds = flatLessons.map(l => l.id);
            // Limpa IDs de aulas que foram excluídas do curso mas ainda constam na matrícula
            enrollment.grades.completed = enrollment.grades.completed.filter(id => validIds.includes(id));
            
            const next = flatLessons.find(l => !enrollment.grades.completed.includes(l.id)) || flatLessons[0];
            openLesson(next);
        }
        
        updateOverallProgress();
        checkUnreadMural(); 
    } catch (error) { 
        console.error("Erro crítico ao iniciar sala de aula:", error); 
    }
});

async function loadEnrollment(userId) {
    const { data, error } = await supabase
        .from('class_enrollments')
        .select('*')
        .eq('class_id', classId)
        .eq('user_id', userId)
        .single();

    if (error || !data) throw new Error("Sem matrícula ativa para este usuário.");
    enrollment = data;
    
    // Garante estrutura de notas
    if (!enrollment.grades) enrollment.grades = { completed: [], scores: {} };
    if (!enrollment.grades.scores) enrollment.grades.scores = {};
    if (!enrollment.grades.completed) enrollment.grades.completed = [];
}

async function loadCourse() {
    // 1. Carrega dados da Turma
    const { data: cls } = await supabase
        .from('classes')
        .select('*, courses(title)')
        .eq('id', classId)
        .single();
    
    if (cls) {
        document.getElementById('header-course-title').textContent = cls.courses?.title || 'Curso';
        document.getElementById('header-class-name').textContent = cls.name;
        checkEditorAccess(cls.course_id);
    }

    // 2. Carrega Módulos > Seções > Lições
    const { data: modules, error } = await supabase
        .from('modules')
        .select(`*, sections (*, lessons (*))`)
        .eq('course_id', cls.course_id)
        .order('ordem', { ascending: true });

    if (error) { console.error("Erro ao carregar módulos:", error); return; }
    
    // Ordenação no Front-end
    if (modules) {
        modules.forEach(mod => {
            if (mod.sections) {
                mod.sections.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
                mod.sections.forEach(sec => {
                    if (sec.lessons) sec.lessons.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
                });
            }
        });
    }

    courseModules = modules; 
    const container = document.getElementById('modules-list');
    container.innerHTML = ''; 
    flatLessons = [];
    
    // 3. Renderiza Menu Lateral
    modules.forEach((mod, index) => {
        const modId = `mod-${mod.id}`;
        let lessonsHtml = '';
        let modLessonIds = [];

        mod.sections.forEach(sec => {
            if (sec.title) lessonsHtml += `<div class="section-title">${sec.title}</div>`;
            if (sec.lessons) {
                sec.lessons.forEach(l => {
                    if (l.is_published === false) return;
                    
                    flatLessons.push(l);
                    modLessonIds.push(l.id);
                    
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

        const modTotal = modLessonIds.length;
        const modDone = modLessonIds.filter(id => enrollment.grades.completed.includes(id)).length;
        let pct = modTotal > 0 ? Math.round((modDone/modTotal)*100) : 0;

        container.innerHTML += `
            <div class="accordion-item">
                <h2 class="accordion-header">
                    <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#${modId}">
                        <div class="d-flex w-100 justify-content-between me-2 align-items-center">
                            <span>${mod.title}</span>
                            <div class="d-flex align-items-center">
                                <div class="mod-progress-track me-2"><div class="mod-progress-bar" style="width:${pct}%"></div></div>
                                <small class="fw-bold" style="font-size:0.75rem;">${pct}%</small>
                            </div>
                        </div>
                    </button>
                </h2>
                <div id="${modId}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#modules-list">
                    <div class="accordion-body p-0">${lessonsHtml}</div>
                </div>
            </div>`;
    });
}

// Verifica permissão para botão "Editar Conteúdo"
async function checkEditorAccess(courseId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    if (profile && (profile.role === 'admin' || profile.role === 'professor')) {
        const headerActions = document.getElementById('header-actions');
        if (headerActions) {
            const editBtn = document.createElement('a');
            editBtn.href = `course-editor.html?id=${courseId}`; 
            editBtn.className = 'btn btn-sm btn-dark border-0 fw-bold shadow-sm';
            editBtn.innerHTML = `<i class='bx bx-edit-alt'></i> Editar Conteúdo`;
            editBtn.style.marginRight = '10px';
            headerActions.insertBefore(editBtn, headerActions.lastElementChild);
        }
    }
}

// === MURAL (Com filtro de segurança) ===
window.loadMural = async () => {
    const container = document.getElementById('wall-container');
    if (!container) return; 
    
    container.innerHTML = '<div class="text-center p-5 w-100"><i class="bx bx-loader-alt bx-spin fs-1 text-muted"></i><p class="mt-2 text-muted">Carregando avisos...</p></div>';
    
    if (!classId) {
        container.innerHTML = '<div class="alert alert-danger">Erro: Turma não identificada.</div>';
        return;
    }

    const { data: posts, error } = await supabase
        .from('class_posts')
        .select('*')
        .eq('class_id', classId)
        .neq('type', 'INTERNAL') // Filtra posts administrativos
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro mural:", error);
        container.innerHTML = '<div class="alert alert-warning">Não foi possível carregar o mural.</div>';
        return;
    }

    if (!posts || posts.length === 0) {
        container.innerHTML = `
            <div class="text-center p-5 w-100 opacity-50">
                <i class="bx bx-note display-1"></i>
                <h4 class="mt-3">Mural Vazio</h4>
                <p>Nenhum aviso para você por enquanto.</p>
            </div>`;
        return;
    }

    const readPosts = getReadPosts();

    const colorMap = {
        'AVISO': 'post-yellow',
        'MATERIAL': 'post-blue',
        'EVENTO': 'post-green',
        'URGENTE': 'post-pink',
        'default': 'post-yellow'
    };

    container.innerHTML = posts.map(post => {
        const isRead = readPosts.includes(post.id);
        const date = new Date(post.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        
        let type = post.type || 'AVISO';
        if(type.toUpperCase() === 'INTERNAL') return ''; 

        const colorClass = colorMap[type.toUpperCase()] || colorMap['default'];
        const newBadge = !isRead ? `<div class="new-indicator">NOVO!</div>` : '';

        return `
            <div class="post-it ${colorClass}">
                ${newBadge}
                <div class="post-header">
                    <span class="post-badge">${type}</span>
                    <span class="post-date">${date}</span>
                </div>
                <div class="post-body">
                    <span class="post-title">${post.title}</span>
                    ${post.content}
                </div>
                <div class="post-footer">
                    ${isRead 
                        ? '<div class="mark-done"><i class="bx bx-check-double"></i> Lido</div>' 
                        : `<button class="btn-read-mark" onclick="window.markPostRead('${post.id}', this)"><i class="bx bx-check"></i> Marcar como lido</button>`
                    }
                </div>
            </div>`;
    }).join('');
};

window.openLessonById = (id) => { const l = flatLessons.find(x => x.id === id); if(l) openLesson(l); };

// === ABRIR AULA (GERENCIADOR DE TIPOS) ===
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

    // Lógica de Descrição: Oculta se for Tarefa ou Quiz
    if (['TAREFA', 'QUIZ'].includes(lesson.type)) {
        descContainer.style.display = 'none'; 
    } else {
        descContainer.style.display = 'block';
        descContainer.innerHTML = lesson.description || '';
    }

    const url = getEmbedUrl(lesson.video_url || lesson.content_url);

    // --- RENDERIZAÇÃO POR TIPO ---

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
        // Renderização da Tarefa (com enunciado)
        activity.innerHTML = `
            <div class="card border-0 shadow-sm bg-light">
                <div class="card-body p-4">
                    <h5 class="fw-bold mb-3 text-primary"><i class='bx bx-notepad'></i> Instruções da Tarefa</h5>
                    <div class="fs-6 mb-4 text-dark">${lesson.description || '<p class="text-muted fst-italic">Sem instruções definidas pelo professor.</p>'}</div>
                    <hr>
                    <div class="d-flex align-items-center gap-3">
                         <i class='bx bx-info-circle fs-1 text-info'></i>
                         <small class="text-muted">Para entregar, siga as instruções acima. Caso precise enviar arquivos, utilize os canais indicados pelo professor.</small>
                    </div>
                </div>
            </div>`;
    
    } else if (lesson.type === 'QUIZ') {
        // Verifica se já tem nota
        const savedScore = enrollment.grades.scores ? enrollment.grades.scores[lesson.id] : undefined;
        const isCompleted = enrollment.grades.completed.includes(lesson.id);

        if (isCompleted && savedScore !== undefined) {
            renderQuizResult(savedScore, lesson.points || 100);
        } else { 
            renderQuizIntro(lesson);
        }
    }
    
    updateFinishButton();
    if (window.innerWidth < 992) document.getElementById('course-nav').classList.add('closed');
}

// === LÓGICA DO QUIZ (ATUALIZADA) ===

// 1. Capa do Quiz
window.renderQuizIntro = (lesson) => {
    let qCount = 0;
    let limit = 10;
    
    // Tenta ler dados do JSONB ou string JSON
    let quizDataObj = null;
    if (lesson.quiz_data) {
        quizDataObj = lesson.quiz_data;
    } else if (lesson.description && lesson.description.startsWith('{')) {
        try { quizDataObj = JSON.parse(lesson.description); } catch(e){}
    }

    if (quizDataObj) {
        if (Array.isArray(quizDataObj)) {
            // Formato legado (Array direto)
            qCount = quizDataObj.length;
            limit = qCount;
        } else {
            // Formato novo (Objeto com settings e questions)
            qCount = quizDataObj.questions ? quizDataObj.questions.length : 0;
            if (quizDataObj.settings && quizDataObj.settings.mode === 'bank') {
                limit = quizDataObj.settings.drawCount || 5;
            } else {
                limit = qCount; // Manual usa todas
            }
        }
    }

    const questionsToAsk = Math.min(qCount, limit);

    const container = document.getElementById('activity-area');
    container.innerHTML = `
        <div class="quiz-wrapper">
            <div class="quiz-hero">
                <div class="quiz-hero-icon start"><i class='bx bx-joystick'></i></div>
                <h2 class="fw-bold mb-2">${lesson.title}</h2>
                <p class="text-muted mb-4">Avaliação do Módulo</p>
                
                <div class="quiz-stat-grid">
                    <div class="quiz-stat-box">
                        <span class="quiz-stat-val">${questionsToAsk}</span>
                        <span class="quiz-stat-lbl">Questões</span>
                    </div>
                    <div class="quiz-stat-box">
                        <span class="quiz-stat-val">${lesson.points || 0}</span>
                        <span class="quiz-stat-lbl">Pontos</span>
                    </div>
                </div>

                <div class="alert alert-warning small text-start">
                    <i class='bx bx-error-circle'></i> Atenção: Ao iniciar, você deverá responder todas as questões.
                </div>

                <button class="btn btn-primary btn-lg rounded-pill px-5 fw-bold mt-3" onclick="startQuiz()">
                    INICIAR AVALIAÇÃO
                </button>
            </div>
        </div>
    `;
}

// 2. Iniciar e Sortear
window.startQuiz = () => {
    const lesson = currentLesson;
    let allQuestions = [];
    let limit = 100;

    // Carrega questões
    if (lesson.quiz_data) {
        if (Array.isArray(lesson.quiz_data)) {
            allQuestions = lesson.quiz_data;
            limit = allQuestions.length;
        } else {
            allQuestions = lesson.quiz_data.questions || [];
            if (lesson.quiz_data.settings && lesson.quiz_data.settings.mode === 'bank') {
                limit = lesson.quiz_data.settings.drawCount || 5;
            } else {
                limit = allQuestions.length;
            }
        }
    } else if (lesson.description && lesson.description.startsWith('{')) {
        try { allQuestions = JSON.parse(lesson.description).questions; } catch(e){}
    }

    if (!allQuestions || allQuestions.length === 0) {
        alert("Erro: Nenhuma questão encontrada para este quiz."); return;
    }

    // Embaralha e Corta
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    const selectedQuestions = shuffled.slice(0, limit);

    quizState = { 
        questions: selectedQuestions, 
        currentIndex: 0, 
        answers: {}, 
        totalPoints: lesson.points || 100
    };
    
    renderQuizStep();
}

// 3. Renderizar Passo
window.renderQuizStep = () => {
    const container = document.getElementById('activity-area');
    if(!quizState.questions) return;

    const q = quizState.questions[quizState.currentIndex];
    const total = quizState.questions.length;
    const progressPct = ((quizState.currentIndex) / total) * 100;

    let optionsHtml = '';
    if(q.options) {
        q.options.forEach((opt, idx) => {
            const isSelected = quizState.answers[quizState.currentIndex] === idx;
            const activeClass = isSelected ? 'selected' : '';
            
            optionsHtml += `
                <div class="quiz-option-label ${activeClass}" onclick="selectQuizAnswer(${idx})">
                    <div class="quiz-radio"></div>
                    <span class="fw-medium">${opt.text || opt}</span>
                </div>`;
        });
    }

    container.innerHTML = `
        <div class="quiz-wrapper text-start">
            <div class="quiz-progress-container">
                <div class="quiz-progress-fill" style="width: ${progressPct}%"></div>
            </div>
            <div class="quiz-body">
                <div class="d-flex justify-content-between mb-3 text-muted small fw-bold uppercase">
                    <span>Questão ${quizState.currentIndex + 1} de ${total}</span>
                    <span>Valendo nota</span>
                </div>

                <h4 class="quiz-question-text">${q.text || q.title}</h4>
                
                <div class="mb-4">
                    ${optionsHtml}
                </div>

                <div class="d-flex justify-content-between pt-3 border-top">
                    <button class="btn btn-light text-muted fw-bold" onclick="prevQuizStep()" ${quizState.currentIndex === 0 ? 'disabled' : ''}>
                        Anterior
                    </button>
                    
                    ${quizState.currentIndex === total - 1 
                        ? `<button class="btn btn-success fw-bold px-4" onclick="finishQuiz()">FINALIZAR</button>`
                        : `<button class="btn btn-primary fw-bold px-4" onclick="nextQuizStep()">Próxima <i class='bx bx-right-arrow-alt'></i></button>`
                    }
                </div>
            </div>
        </div>
    `;
}

window.selectQuizAnswer = (idx) => {
    quizState.answers[quizState.currentIndex] = idx;
    renderQuizStep();
};

window.nextQuizStep = () => {
    if (quizState.currentIndex < quizState.questions.length - 1) {
        quizState.currentIndex++;
        renderQuizStep();
    }
};

window.prevQuizStep = () => {
    if (quizState.currentIndex > 0) {
        quizState.currentIndex--;
        renderQuizStep();
    }
};

window.finishQuiz = async () => {
    if(!confirm("Tem certeza que deseja finalizar?")) return;

    let correctCount = 0;
    const questions = quizState.questions;
    
    questions.forEach((q, idx) => {
        const userAnswer = quizState.answers[idx];
        if (userAnswer !== undefined && String(userAnswer) === String(q.correctIndex)) {
            correctCount++;
        }
    });

    // Regra de Três
    const finalScore = Math.round((correctCount / questions.length) * quizState.totalPoints);
    
    document.getElementById('activity-area').innerHTML = `<div class="text-center p-5"><div class="spinner-border text-primary"></div><p class="mt-3">Calculando nota...</p></div>`;

    // Atualiza Local
    enrollment.grades.scores[currentLesson.id] = finalScore;
    if (!enrollment.grades.completed.includes(currentLesson.id)) {
        enrollment.grades.completed.push(currentLesson.id);
    }

    // Salva no Supabase
    const { error } = await supabase
        .from('class_enrollments')
        .update({ grades: enrollment.grades })
        .eq('id', enrollment.id);

    if (error) {
        alert('Erro ao salvar nota: ' + error.message);
        renderQuizStep();
    } else {
        renderQuizResult(finalScore, quizState.totalPoints);
        updateOverallProgress();
        updateFinishButton();
    }
};

// 4. Resultado Final
window.renderQuizResult = (score, total) => {
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    const isPass = percent >= 70;
    const color = isPass ? '#16a34a' : '#dc2626'; 
    
    const container = document.getElementById('activity-area');
    container.innerHTML = `
        <div class="quiz-wrapper">
            <div class="quiz-hero">
                <div class="score-circle" style="--pct: ${percent}%; background: conic-gradient(${color} ${percent}%, #e2e8f0 0);" data-score="${score}"></div>
                
                <h2 class="fw-bold text-dark mb-1">${isPass ? 'Parabéns!' : 'Avaliação Concluída'}</h2>
                <p class="text-muted mb-4">Sua nota final foi registrada.</p>

                <div class="alert ${isPass ? 'alert-success' : 'alert-danger'} d-inline-block px-4 py-2 rounded-pill fw-bold mb-4">
                    ${isPass ? 'APROVADO' : 'ABAIXO DA MÉDIA'}
                </div>
                
                <div class="mt-2">
                    <button class="btn btn-outline-secondary px-4" onclick="document.getElementById('btn-next').click()">Continuar Curso</button>
                </div>
            </div>
        </div>
    `;
    updateFinishButton();
}

// === UTILITÁRIOS ===

function getEmbedUrl(url) { 
    if(!url) return '';
    if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/'); 
    if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'youtube.com/embed/');
    if (url.includes('drive.google.com') && url.includes('/view')) return url.replace('/view', '/preview');
    return url; 
}

function updateOverallProgress() {
    const total = flatLessons.length;
    const done = enrollment.grades.completed.filter(id => flatLessons.some(l => l.id === id)).length;
    let pct = total === 0 ? 0 : Math.round((done / total) * 100);
    document.getElementById('overall-progress').style.width = `${pct}%`;
    document.getElementById('progress-text').textContent = `${pct}%`;
}

function getReadPosts() { 
    const key = `ava3_read_posts_${enrollment.id}`; 
    return JSON.parse(localStorage.getItem(key) || '[]'); 
}

window.markPostRead = (postId, btn) => {
    const key = `ava3_read_posts_${enrollment.id}`;
    let read = getReadPosts();
    if (!read.includes(postId)) {
        read.push(postId);
        localStorage.setItem(key, JSON.stringify(read));
        window.loadMural();
        checkUnreadMural();
    }
};

async function checkUnreadMural() {
    const { data: posts } = await supabase
        .from('class_posts')
        .select('id')
        .eq('class_id', classId)
        .neq('type', 'INTERNAL'); 

    if (!posts) return;

    const unreadCount = posts.filter(p => !getReadPosts().includes(p.id)).length;
    const badge = document.getElementById('mural-badge');
    if (badge) {
        badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
        badge.textContent = unreadCount;
    }
}

function forceSwitchToContent() {
    const tabAulaBtn = document.querySelector('button[data-bs-target="#tab-aula"]');
    if (tabAulaBtn) bootstrap.Tab.getOrCreateInstance(tabAulaBtn).show();
}

window.toggleLessonStatus = async () => {
    const isDone = enrollment.grades.completed.includes(currentLesson.id);
    if (isDone) {
        enrollment.grades.completed = enrollment.grades.completed.filter(id => id !== currentLesson.id);
    } else {
        enrollment.grades.completed.push(currentLesson.id);
    }
    await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id);
    loadCourse(); updateOverallProgress(); updateFinishButton();
};

function updateFinishButton() {
    if(!currentLesson) return;
    const btn = document.getElementById('btn-finish');
    const isDone = enrollment.grades.completed.includes(currentLesson.id);
    
    // Quiz se completa automaticamente
    if(currentLesson.type === 'QUIZ') {
        btn.disabled = true;
        btn.innerHTML = isDone ? "<i class='bx bx-trophy'></i> Quiz Concluído" : "Complete o Quiz";
        btn.className = isDone ? "btn btn-success rounded-pill fw-bold" : "btn btn-outline-secondary rounded-pill fw-bold";
        return;
    }

    btn.disabled = false;
    btn.onclick = window.toggleLessonStatus;
    btn.innerHTML = isDone ? "<i class='bx bx-check'></i> Concluído" : "Concluir Aula";
    btn.className = isDone ? "btn btn-success rounded-pill fw-bold" : "btn btn-outline-success rounded-pill fw-bold";
}

window.loadGrades = () => { 
    document.getElementById('grades-list').innerHTML = '<div class="alert alert-info">Módulo de notas em desenvolvimento.</div>';
};
window.loadCalendar = () => { /* Placeholder */ };
window.loadCertificate = () => { /* Placeholder */ };