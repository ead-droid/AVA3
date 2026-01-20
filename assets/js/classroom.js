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
    'default': 'bx-file' 
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!classId) { window.location.href = 'app.html'; return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';

    try {
        await loadEnrollment(session.user.id);
        await loadCourse();
        
        if (flatLessons.length > 0) {
            const validIds = flatLessons.map(l => l.id);
            enrollment.grades.completed = enrollment.grades.completed.filter(id => validIds.includes(id));
            const next = flatLessons.find(l => !enrollment.grades.completed.includes(l.id)) || flatLessons[0];
            openLesson(next);
        }
        
        updateOverallProgress();
        checkUnreadMural(); 
    } catch (error) { console.error("Erro:", error); }
});

async function loadEnrollment(userId) {
    const { data, error } = await supabase.from('class_enrollments').select('*').eq('class_id', classId).eq('user_id', userId).single();
    if (error || !data) throw new Error("Sem matrícula");
    enrollment = data;
    if (!enrollment.grades) enrollment.grades = { completed: [], scores: {} };
    if (!enrollment.grades.scores) enrollment.grades.scores = {};
}

async function loadCourse() {
    const { data: cls } = await supabase.from('classes').select('*, courses(title)').eq('id', classId).single();
    if (cls) {
        document.getElementById('header-course-title').textContent = cls.courses?.title || 'Curso';
        document.getElementById('header-class-name').textContent = cls.name;
        
        // --- NOVA CHAMADA: Verifica se pode editar ---
        checkEditorAccess(cls.course_id);
    }

    const { data: modules } = await supabase.from('modules').select(`*, sections (*, lessons (*))`).eq('course_id', cls.course_id).order('ordem', { ascending: true });
    
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
    container.innerHTML = ''; flatLessons = [];
    
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

// --- FUNÇÃO NOVA: VERIFICA PERMISSÃO E CRIA BOTÃO EDITAR ---
async function checkEditorAccess(courseId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Busca perfil do usuário
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    // Se for admin ou professor, cria o botão
    if (profile && (profile.role === 'admin' || profile.role === 'professor')) {
        const headerActions = document.getElementById('header-actions');
        if (headerActions) {
            const editBtn = document.createElement('a');
            editBtn.href = `course-editor.html?id=${courseId}`; // Link para o ID do curso pai
            editBtn.className = 'btn btn-sm btn-dark border-0 fw-bold shadow-sm';
            editBtn.innerHTML = `<i class='bx bx-edit-alt'></i> Editar Conteúdo`;
            editBtn.style.marginRight = '10px';
            
            // Insere antes do botão de Sair (que é o último)
            headerActions.insertBefore(editBtn, headerActions.lastElementChild);
        }
    }
}

// === FUNÇÃO DO MURAL ===
// === FUNÇÃO DO MURAL (ATUALIZADA) ===
window.loadMural = async () => {
    const container = document.getElementById('wall-container');
    if (!container) return; // Segurança caso a tab não esteja ativa
    
    // Loader divertido
    container.innerHTML = '<div class="text-center p-5 w-100"><i class="bx bx-loader-alt bx-spin fs-1 text-muted"></i><p class="mt-2 text-muted">Organizando os post-its...</p></div>';
    
    // 1. SEGURANÇA: Garante que temos o ID da turma
    if (!classId) {
        container.innerHTML = '<div class="alert alert-danger">Erro: Identificação da turma não encontrada.</div>';
        return;
    }

    // 2. BUSCA: Filtra EXTRITAMENTE pelo class_id da URL
    const { data: posts, error } = await supabase
        .from('class_posts')
        .select('*')
        .eq('class_id', classId) // <--- O FILTRO IMPORTANTE
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
                <p>O professor ainda não colou nenhum aviso aqui.</p>
            </div>`;
        return;
    }

    const readPosts = getReadPosts();

    // Mapeamento de Cores por Tipo
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
        const type = post.type || 'AVISO';
        const colorClass = colorMap[type.toUpperCase()] || colorMap['default'];
        
        // Se não for lido, mostra o selo "NOVO"
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

function openLesson(lesson) {
    currentLesson = lesson;
    forceSwitchToContent();
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`lesson-${lesson.id}`)?.classList.add('active');
    
    document.getElementById('lbl-title').textContent = lesson.title;
    document.getElementById('lbl-type').textContent = lesson.type;
    document.getElementById('lbl-desc').innerHTML = lesson.description || '';
    
    const activity = document.getElementById('activity-area');
    const playerFrame = document.getElementById('player-frame');
    activity.innerHTML = ''; playerFrame.style.display = 'none'; playerFrame.innerHTML = '';

    const url = getEmbedUrl(lesson.video_url || lesson.content_url);

    if (lesson.type === 'VIDEO_AULA' || lesson.type === 'VIDEO') {
        playerFrame.style.display = 'flex';
        playerFrame.innerHTML = `<iframe src="${url}" allowfullscreen></iframe>`;
    } else if (lesson.type === 'AUDIO' || lesson.type === 'PODCAST') {
        activity.innerHTML = `<div class="audio-container"><i class='bx bx-headphone display-1 text-primary mb-3'></i><audio controls class="w-100"><source src="${url}" type="audio/mpeg"></audio></div>`;
    } else if ((lesson.type === 'PDF' || lesson.type === 'MATERIAL') && url) {
        activity.innerHTML = `<iframe class="pdf-viewer" src="${url}"></iframe>`;
    } else if (lesson.type === 'QUIZ') {
        const score = enrollment.grades.scores ? enrollment.grades.scores[lesson.id] : undefined;
        if (enrollment.grades.completed.includes(lesson.id) && score !== undefined) {
            activity.innerHTML = `<div class="text-center p-5 bg-white border rounded"><h3 class="text-success">Concluído</h3><p>Nota: ${score} / ${lesson.points}</p></div>`;
        } else { initQuiz(lesson); }
    }
    updateFinishButton();
    if (window.innerWidth < 992) document.getElementById('course-nav').classList.add('closed');
}

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

function getReadPosts() { const key = `ava3_read_posts_${enrollment.id}`; return JSON.parse(localStorage.getItem(key) || '[]'); }

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
    const { data: posts } = await supabase.from('class_posts').select('id').eq('class_id', classId);
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
    btn.disabled = currentLesson.type === 'QUIZ';
    btn.onclick = window.toggleLessonStatus;
    btn.innerHTML = isDone ? "<i class='bx bx-check'></i> Concluído" : "Concluir Aula";
    btn.className = isDone ? "btn btn-success rounded-pill fw-bold" : "btn btn-outline-success rounded-pill fw-bold";
}

function initQuiz(lesson) { quizState = { data: { questions: lesson.quiz_data?.questions || [] }, currentIndex: -1, answers: {}, isFinished: false }; renderQuizStep(); }
function renderQuizStep() { /* Lógica de renderização do quiz */ }
window.loadGrades = () => { /* Lógica de carregamento de notas */ };