import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('id') || params.get('classId');

let enrollment = null;
let flatLessons = [];
let courseModules = []; 
let currentLesson = null;
// Estado inicial do Quiz
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
    'default': 'bx-file' 
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!classId) { window.location.href = 'app.html'; return; }
    
    // Verifica sessão
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';

    try {
        await loadEnrollment(session.user.id);
        await loadCourse();
        
        // Abre a primeira aula não concluída
        if (flatLessons.length > 0) {
            const validIds = flatLessons.map(l => l.id);
            // Limpa IDs de aulas que foram excluídas do curso
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
    const { data, error } = await supabase.from('class_enrollments').select('*').eq('class_id', classId).eq('user_id', userId).single();
    if (error || !data) throw new Error("Sem matrícula ativa para este usuário.");
    enrollment = data;
    if (!enrollment.grades) enrollment.grades = { completed: [], scores: {} };
    if (!enrollment.grades.scores) enrollment.grades.scores = {};
}

async function loadCourse() {
    // Carrega dados da Turma e Nome do Curso
    const { data: cls } = await supabase.from('classes').select('*, courses(title)').eq('id', classId).single();
    
    if (cls) {
        document.getElementById('header-course-title').textContent = cls.courses?.title || 'Curso';
        document.getElementById('header-class-name').textContent = cls.name;
        checkEditorAccess(cls.course_id);
    }

    // Busca Módulos, Seções e Aulas
    // O select aninhado garante que pegamos toda a hierarquia
    const { data: modules, error } = await supabase
        .from('modules')
        .select(`*, sections (*, lessons (*))`)
        .eq('course_id', cls.course_id)
        .order('ordem', { ascending: true });

    if (error) {
        console.error("Erro ao carregar módulos:", error);
        return;
    }
    
    // Ordenação manual no Front-end para garantir a sequência correta
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
    
    // Renderiza a lista lateral
    modules.forEach((mod, index) => {
        const modId = `mod-${mod.id}`;
        let lessonsHtml = '';
        let modLessonIds = [];

        mod.sections.forEach(sec => {
            if (sec.title) lessonsHtml += `<div class="section-title">${sec.title}</div>`;
            if (sec.lessons) {
                sec.lessons.forEach(l => {
                    // Ignora aulas não publicadas
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

        // Calcula progresso do módulo
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

// Verifica se usuário pode editar o curso (Admin/Professor)
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

// === LÓGICA DO MURAL ===
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
        .neq('type', 'INTERNAL') // Filtra posts internos
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

// === SUBSTITUIR A FUNÇÃO openLesson EXISTENTE POR ESTA ===
function openLesson(lesson) {
    currentLesson = lesson;
    forceSwitchToContent();
    
    // Atualiza Menu Lateral
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`lesson-${lesson.id}`)?.classList.add('active');
    
    // Header
    document.getElementById('lbl-title').textContent = lesson.title;
    document.getElementById('lbl-type').textContent = lesson.type;
    
    // Limpa área de atividade
    const activity = document.getElementById('activity-area');
    const playerFrame = document.getElementById('player-frame');
    const descContainer = document.getElementById('lbl-desc');
    
    activity.innerHTML = ''; 
    playerFrame.style.display = 'none'; 
    playerFrame.innerHTML = '';

    // Oculta descrição padrão se for Quiz (tem tela própria)
    if (lesson.type === 'QUIZ') {
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
        activity.innerHTML = `<div class="p-4 bg-light rounded border">${lesson.description || 'Conteúdo não disponível.'}</div>`;

    } else if (lesson.type === 'TAREFA') {
        activity.innerHTML = `
            <div class="card border-0 shadow-sm bg-light">
                <div class="card-body p-4">
                    <h5 class="fw-bold mb-3"><i class='bx bx-notepad'></i> Enunciado da Tarefa</h5>
                    <div class="fs-6 mb-4">${lesson.description || '<p class="text-muted">Sem instruções definidas.</p>'}</div>
                </div>
            </div>`;
    
    } else if (lesson.type === 'QUIZ') {
        // --- LÓGICA INTELIGENTE DO QUIZ ---
        // Verifica se o aluno JÁ fez o quiz (tem nota salva)
        const savedScore = enrollment.grades.scores ? enrollment.grades.scores[lesson.id] : undefined;
        const isCompleted = enrollment.grades.completed.includes(lesson.id);

        if (isCompleted && savedScore !== undefined) {
            // Se já fez, mostra direto o resultado (Bloqueado)
            renderQuizResult(savedScore, lesson.points || 100);
        } else { 
            // Se não fez, mostra a Capa (Intro)
            renderQuizIntro(lesson);
        }
    }
    
    updateFinishButton();
    if (window.innerWidth < 992) document.getElementById('course-nav').classList.add('closed');
}


// === NOVAS FUNÇÕES DO QUIZ (COPIAR TUDO ABAIXO) ===

// 1. TELA DE INTRODUÇÃO (CAPA)
window.renderQuizIntro = (lesson) => {
    let qCount = 0;
    // Tenta contar quantas questões existem no total
    try {
        const data = lesson.quiz_data || (lesson.description.startsWith('{') ? JSON.parse(lesson.description) : {});
        if(data.questions) qCount = data.questions.length;
    } catch(e) {}

    // Define quantas questões serão sorteadas (Padrão 10 ou o que tiver)
    const questionsToAsk = 10; // Você pode mudar esse número ou puxar do JSON

    const container = document.getElementById('activity-area');
    container.innerHTML = `
        <div class="quiz-wrapper">
            <div class="quiz-hero">
                <div class="quiz-hero-icon start"><i class='bx bx-joystick'></i></div>
                <h2 class="fw-bold mb-2">${lesson.title}</h2>
                <p class="text-muted mb-4">Esta avaliação testará seus conhecimentos sobre este módulo.</p>
                
                <div class="quiz-stat-grid">
                    <div class="quiz-stat-box">
                        <span class="quiz-stat-val">${Math.min(qCount, questionsToAsk)}</span>
                        <span class="quiz-stat-lbl">Questões</span>
                    </div>
                    <div class="quiz-stat-box">
                        <span class="quiz-stat-val">${lesson.points || 100}</span>
                        <span class="quiz-stat-lbl">Pontos</span>
                    </div>
                </div>

                <div class="alert alert-warning small text-start">
                    <i class='bx bx-error-circle'></i> <strong>Atenção:</strong> Você só tem uma tentativa. Após finalizar, sua nota será registrada automaticamente.
                </div>

                <button class="btn btn-primary btn-lg rounded-pill px-5 fw-bold mt-3" onclick="startQuiz()">
                    INICIAR AVALIAÇÃO
                </button>
            </div>
        </div>
    `;
}

// 2. INICIAR E SORTEAR QUESTÕES
window.startQuiz = () => {
    const lesson = currentLesson;
    let allQuestions = [];
    
    // Carrega questões
    if (lesson.quiz_data && lesson.quiz_data.questions) {
        allQuestions = lesson.quiz_data.questions;
    } else if (lesson.description && lesson.description.startsWith('{')) {
        try { allQuestions = JSON.parse(lesson.description).questions; } catch(e){}
    }

    if (!allQuestions || allQuestions.length === 0) {
        alert("Erro: Nenhuma questão encontrada."); return;
    }

    // --- LÓGICA DE BANCO DE QUESTÕES (SHUFFLE) ---
    // 1. Embaralha todas as questões
    const shuffled = allQuestions.sort(() => 0.5 - Math.random());
    
    // 2. Pega apenas as X primeiras (ex: 5 ou 10). 
    // Se quiser configurar por aula, adicione "limit" no JSON do quiz. Por padrão, pega 10.
    const limit = lesson.quiz_data?.limit || 10; 
    const selectedQuestions = shuffled.slice(0, limit);

    // Inicia estado do Quiz
    quizState = { 
        questions: selectedQuestions, 
        currentIndex: 0, 
        answers: {}, // Armazena índices das respostas
        totalPoints: lesson.points || 100
    };
    
    renderQuizStep();
}

// 3. RENDERIZAR QUESTÃO (VISUAL NOVO)
window.renderQuizStep = () => {
    const container = document.getElementById('activity-area');
    const q = quizState.questions[quizState.currentIndex];
    const total = quizState.questions.length;
    const progressPct = ((quizState.currentIndex) / total) * 100;

    // Renderiza Opções
    let optionsHtml = '';
    if(q.options) {
        q.options.forEach((opt, idx) => {
            // Verifica se está selecionado
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
                        ? `<button class="btn btn-success fw-bold px-4" onclick="finishQuiz()">FINALIZAR PROVA</button>`
                        : `<button class="btn btn-primary fw-bold px-4" onclick="nextQuizStep()">Próxima <i class='bx bx-right-arrow-alt'></i></button>`
                    }
                </div>
            </div>
        </div>
    `;
}

// 4. SELEÇÃO DE RESPOSTA (ATUALIZA UI INSTANTANEAMENTE)
window.selectQuizAnswer = (idx) => {
    quizState.answers[quizState.currentIndex] = idx;
    renderQuizStep(); // Re-renderiza para mostrar a seleção visual
};

// 5. FINALIZAR E SALVAR
window.finishQuiz = async () => {
    if(!confirm("Tem certeza que deseja finalizar? Você não poderá alterar as respostas depois.")) return;

    const questions = quizState.questions;
    let correctCount = 0;

    questions.forEach((q, idx) => {
        // Compara resposta do aluno com o índice correto da questão
        const userAnswer = quizState.answers[idx];
        if (userAnswer !== undefined && String(userAnswer) === String(q.correctIndex)) {
            correctCount++;
        }
    });

    // Regra de Três para calcular nota baseada no valor da aula
    const finalScore = Math.round((correctCount / questions.length) * quizState.totalPoints);
    
    // Salva no Banco de Dados
    if (!enrollment.grades.scores) enrollment.grades.scores = {};
    enrollment.grades.scores[currentLesson.id] = finalScore;
    
    if (!enrollment.grades.completed.includes(currentLesson.id)) {
        enrollment.grades.completed.push(currentLesson.id);
    }

    // Feedback de carregamento
    document.getElementById('activity-area').innerHTML = `<div class="text-center p-5"><div class="spinner-border text-primary"></div><p class="mt-3">Calculando nota e salvando...</p></div>`;

    const { error } = await supabase
        .from('class_enrollments')
        .update({ grades: enrollment.grades })
        .eq('id', enrollment.id);

    if (error) {
        alert('Erro ao salvar: ' + error.message);
        renderQuizStep(); // Volta para a prova se der erro
    } else {
        // Atualiza objeto local e mostra resultado
        renderQuizResult(finalScore, quizState.totalPoints);
        updateOverallProgress();
        updateFinishButton(); // Atualiza botão lateral
    }
};

// 6. TELA DE RESULTADO (BLOQUEADA PARA NOVAS TENTATIVAS)
window.renderQuizResult = (score, total) => {
    const percent = Math.round((score / total) * 100);
    const isPass = percent >= 70; // 70% para aprovar (exemplo)
    
    // Cor do círculo
    const color = isPass ? '#16a34a' : '#dc2626'; // Verde ou Vermelho
    
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
    
    // Garante que o botão de "Concluir" no topo fique verde e desabilitado
    const btnFinish = document.getElementById('btn-finish');
    if(btnFinish) {
        btnFinish.disabled = true;
        btnFinish.className = "btn btn-success rounded-pill fw-bold";
        btnFinish.innerHTML = "<i class='bx bx-check-double'></i> Avaliado";
    }
}

// Mantive as funções de navegação simples
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
// === FIM DAS FUNÇÕES DO QUIZ ===
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
    const btn = document.getElementById('btn-finish');
    const isDone = enrollment.grades.completed.includes(currentLesson.id);
    
    // Quiz se completa automaticamente ao finalizar a prova
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

// Função placeholder para notas (implemente conforme necessário)
window.loadGrades = () => { 
    document.getElementById('grades-list').innerHTML = '<div class="alert alert-info">Módulo de notas em desenvolvimento.</div>';
};