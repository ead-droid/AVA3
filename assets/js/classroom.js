import { supabase } from './supabaseClient.js';
import * as Activities from './classroom-activities.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('id') || params.get('classId');

// Estado
let enrollment = null;
let flatLessons = [];
let currentLesson = null;
let currentUserRole = 'student';

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

// === INIT ===
document.addEventListener('DOMContentLoaded', async () => {
  if (!classId) { window.location.href = 'app.html'; return; }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  try {
    await checkUserRole(session.user.id);
    await loadEnrollment(session.user.id);

    // Inicializa o módulo único de atividades (QUIZ + TAREFA)
    Activities.initActivities({
      classId,
      getEnrollment: () => enrollment,
      getUserRole: () => currentUserRole,
      getCurrentLesson: () => currentLesson,
      refreshUI: () => {
        if (currentLesson?.id) refreshLessonUI(currentLesson.id);
        updateOverallProgress();
        updateFinishButton();
      }
    });

    await loadCourse();

    // Remove "concluídos" que não existem mais no curso
    if (flatLessons.length > 0) {
      const validIds = new Set(flatLessons.map(l => l.id));
      enrollment.grades.completed = (enrollment.grades.completed || []).filter(id => validIds.has(id));

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

async function checkUserRole(userId) {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (error) {
    console.warn('Falha ao buscar role:', error.message);
    currentUserRole = 'student';
    return;
  }
  if (data?.role) currentUserRole = data.role;
}

async function loadEnrollment(userId) {
  const { data, error } = await supabase
    .from('class_enrollments')
    .select('*')
    .eq('class_id', classId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    console.error('Erro ao carregar matrícula:', error?.message);
    enrollment = { grades: { completed: [], scores: {}, tasks: {} } };
    return;
  }

  enrollment = data;

  if (!enrollment.grades) enrollment.grades = { completed: [], scores: {}, tasks: {} };
  if (!enrollment.grades.completed) enrollment.grades.completed = [];
  if (!enrollment.grades.scores) enrollment.grades.scores = {};
  if (!enrollment.grades.tasks) enrollment.grades.tasks = {};
  if (!enrollment.grades.attempts) enrollment.grades.attempts = {};
}

async function loadCourse() {
  const { data: cls, error: clsErr } = await supabase
    .from('classes')
    .select('*, courses(title)')
    .eq('id', classId)
    .single();

  if (clsErr || !cls) {
    console.error('Erro ao carregar turma:', clsErr?.message);
    return;
  }

  // Cabeçalho
  document.getElementById('header-course-title').textContent = cls.courses?.title || 'Curso';
  document.getElementById('header-class-name').textContent = cls.name || 'Turma';

  // Botão "Editar Conteúdo" para admin/professor
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

  // Módulos/Seções/Lições
  const { data: modules, error: modErr } = await supabase
    .from('modules')
    .select(`*, sections (*, lessons (*))`)
    .eq('course_id', cls.course_id)
    .order('ordem', { ascending: true });

  if (modErr) {
    console.error('Erro ao carregar módulos:', modErr.message);
    return;
  }

  const container = document.getElementById('modules-list');
  container.innerHTML = '';
  flatLessons = [];

  if (modules?.length) {
    // Ordena seções e lições por "ordem"
    modules.forEach(mod => {
      if (mod.sections) mod.sections.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      mod.sections?.forEach(sec => {
        if (sec.lessons) sec.lessons.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      });
    });

    modules.forEach((mod, index) => {
      const modId = `mod-${mod.id}`;
      let lessonsHtml = '';

      (mod.sections || []).forEach(sec => {
        if (sec.title) lessonsHtml += `<div class="section-title">${sec.title}</div>`;

        (sec.lessons || []).forEach(l => {
          if (l.is_published === false) return;

          flatLessons.push(l);

          const isDone = enrollment.grades.completed.includes(l.id);
          lessonsHtml += `
            <div class="lesson-item ${isDone ? 'completed' : ''}"
                 id="lesson-${l.id}"
                 onclick="window.openLessonById(${l.id})">
              <i class='bx ${ICONS[l.type] || ICONS.default} fs-5'></i>
              <span class="text-truncate flex-grow-1">${l.title}</span>
              ${isDone ? "<i class='bx bxs-check-circle text-success'></i>" : ""}
            </div>
          `;
        });
      });

      container.innerHTML += `
        <div class="accordion-item">
          <h2 class="accordion-header">
            <button class="accordion-button ${index === 0 ? '' : 'collapsed'}"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#${modId}">
              <div class="d-flex w-100 justify-content-between me-2 align-items-center">
                <span>${mod.title}</span>
              </div>
            </button>
          </h2>
          <div id="${modId}"
               class="accordion-collapse collapse ${index === 0 ? 'show' : ''}"
               data-bs-parent="#modules-list">
            <div class="accordion-body p-0">${lessonsHtml}</div>
          </div>
        </div>
      `;
    });
  }
}

window.openLessonById = (id) => {
  const l = flatLessons.find(x => x.id === id);
  if (l) openLesson(l);
};

function openLesson(lesson) {
  currentLesson = lesson;

  // Fecha drawer do quiz se estiver aberto e trocar de lição
  window.closeQuizDrawer?.();

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

  if (['TAREFA', 'QUIZ'].includes(lesson.type)) {
    descContainer.style.display = 'none';
  } else {
    descContainer.style.display = 'block';
    descContainer.innerHTML = lesson.description || '';
  }

  const url = getEmbedUrl(lesson.video_url || lesson.content_url);

  // Renderização
  if (lesson.type === 'VIDEO_AULA' || lesson.type === 'VIDEO') {
    playerFrame.style.display = 'flex';
    playerFrame.innerHTML = `<iframe src="${url}" allowfullscreen></iframe>`;
  } else if (lesson.type === 'AUDIO' || lesson.type === 'PODCAST') {
    activity.innerHTML = `
      <div class="audio-container">
        <i class='bx bx-headphone display-1 text-primary mb-3'></i>
        <audio controls class="w-100">
          <source src="${url}" type="audio/mpeg">
        </audio>
      </div>`;
  } else if ((lesson.type === 'PDF' || lesson.type === 'MATERIAL') && url) {
    activity.innerHTML = `<iframe class="pdf-viewer" src="${url}"></iframe>`;
  } else if (lesson.type === 'TEXTO') {
    descContainer.style.display = 'block';
    activity.innerHTML = `<div class="p-4 bg-light rounded border">${lesson.description || 'Conteúdo não disponível.'}</div>`;
  } else if (lesson.type === 'TAREFA') {
    // Delegado ao módulo único (QUIZ + TAREFA)
    Activities.renderTaskIntro(lesson);
  } else if (lesson.type === 'QUIZ') {
    // Abre o drawer lateral
    Activities.openQuizDrawer(lesson, enrollment, currentUserRole);

    // Placeholder na área central
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

  if (window.innerWidth < 992) {
    document.getElementById('course-nav')?.classList.add('closed');
  }
}

// Reabrir drawer (caso feche sem querer)
window.reopenQuizDrawer = () => {
  if (currentLesson?.type === 'QUIZ') {
    Activities.openQuizDrawer(currentLesson, enrollment, currentUserRole);
  }
};

function updateNavigation() {
  if (!currentLesson) return;

  const idx = flatLessons.findIndex(l => l.id === currentLesson.id);
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');

  if (idx > 0) {
    prevBtn.disabled = false;
    prevBtn.onclick = () => openLesson(flatLessons[idx - 1]);
  } else {
    prevBtn.disabled = true;
    prevBtn.onclick = null;
  }

  if (idx < flatLessons.length - 1) {
    nextBtn.disabled = false;
    nextBtn.onclick = () => openLesson(flatLessons[idx + 1]);
  } else {
    nextBtn.disabled = true;
    nextBtn.onclick = null;
  }
}

// === MURAL ===
window.loadMural = async () => {
  const container = document.getElementById('wall-container');
  if (!container) return;

  const { data: posts, error } = await supabase
    .from('class_posts')
    .select('*')
    .eq('class_id', classId)
    .neq('type', 'INTERNAL')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="alert alert-danger">Erro ao carregar mural: ${error.message}</div>`;
    return;
  }

  if (!posts || !posts.length) {
    container.innerHTML = `<div class="text-center p-5 opacity-50"><h4>Mural Vazio</h4></div>`;
    return;
  }

  const read = JSON.parse(localStorage.getItem(`ava3_read_posts_${enrollment.id}`) || '[]');

  container.innerHTML = posts.map(p => {
    const isRead = read.includes(p.id);
    return `
      <div class="post-it post-yellow">
        ${!isRead ? '<div class="new-indicator">NOVO!</div>' : ''}
        <div class="post-body"><b>${p.title}</b><br>${p.content}</div>
        <div class="post-footer">
          <button class="btn-read-mark" onclick="window.markPostRead('${p.id}')">Marcar Lido</button>
        </div>
      </div>`;
  }).join('');
};

window.markPostRead = (id) => {
  let read = JSON.parse(localStorage.getItem(`ava3_read_posts_${enrollment.id}`) || '[]');
  if (!read.includes(id)) {
    read.push(id);
    localStorage.setItem(`ava3_read_posts_${enrollment.id}`, JSON.stringify(read));
    loadMural();
    checkUnreadMural();
  }
};

async function checkUnreadMural() {
  const { data: posts, error } = await supabase
    .from('class_posts')
    .select('id')
    .eq('class_id', classId)
    .neq('type', 'INTERNAL');

  if (error || !posts) return;

  const read = JSON.parse(localStorage.getItem(`ava3_read_posts_${enrollment.id}`) || '[]');
  const count = posts.filter(p => !read.includes(p.id)).length;

  const badge = document.getElementById('mural-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

// === PROGRESSO / CONCLUSÃO ===
function updateOverallProgress() {
  const validSet = new Set(flatLessons.map(l => l.id));
  const done = (enrollment.grades.completed || []).filter(id => validSet.has(id)).length;

  const pct = flatLessons.length > 0 ? Math.round((done / flatLessons.length) * 100) : 0;
  document.getElementById('overall-progress').style.width = `${pct}%`;
  document.getElementById('progress-text').textContent = `${pct}%`;
}

window.toggleLessonStatus = async () => {
  if (!currentLesson) return;

  const done = enrollment.grades.completed.includes(currentLesson.id);
  if (done) enrollment.grades.completed = enrollment.grades.completed.filter(id => id !== currentLesson.id);
  else enrollment.grades.completed.push(currentLesson.id);

  await supabase
    .from('class_enrollments')
    .update({ grades: enrollment.grades })
    .eq('id', enrollment.id);

  refreshLessonUI(currentLesson.id);
  updateOverallProgress();
  updateFinishButton();
};

function refreshLessonUI(lessonId) {
  const el = document.getElementById(`lesson-${lessonId}`);
  if (!el) return;

  const done = enrollment.grades.completed.includes(lessonId);

  el.classList.toggle('completed', done);

  // Ícone check
  const hasCheck = !!el.querySelector('.bxs-check-circle');
  if (done && !hasCheck) {
    el.insertAdjacentHTML('beforeend', "<i class='bx bxs-check-circle text-success'></i>");
  } else if (!done && hasCheck) {
    el.querySelector('.bxs-check-circle')?.remove();
  }
}

function updateFinishButton() {
  const btn = document.getElementById('btn-finish');
  if (!btn || !currentLesson) return;

  const done = enrollment.grades.completed.includes(currentLesson.id);

  // QUIZ/TAREFA: concluído apenas via Activities
  if (['QUIZ', 'TAREFA'].includes(currentLesson.type)) {
    btn.disabled = true;
    btn.innerHTML = done ? "<i class='bx bx-check-double'></i> Concluído" : "Complete a Atividade";
    btn.className = done
      ? "btn btn-success rounded-pill fw-bold"
      : "btn btn-outline-secondary rounded-pill fw-bold";
    return;
  }

  // Aulas normais: botão concluir manual
  btn.disabled = false;
  btn.onclick = window.toggleLessonStatus;
  btn.innerHTML = done ? "<i class='bx bx-check'></i> Concluído" : "Concluir Aula";
  btn.className = done
    ? "btn btn-success rounded-pill fw-bold"
    : "btn btn-outline-success rounded-pill fw-bold";
}

// === UTILITÁRIOS ===
function getEmbedUrl(url) {
  if (!url) return '';
  if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/');
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview');
  return url;
}

// Abas (mantidas para compatibilidade)
window.loadGrades = () => {
  document.getElementById('grades-list').innerHTML = '<div class="alert alert-info">Notas em desenvolvimento.</div>';
};
window.loadCalendar = () => {};
window.loadCertificate = () => {};
