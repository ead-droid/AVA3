import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('id') || params.get('classId');

let enrollment = null;
let classInfo = null;
let flatLessons = [];
let currentLesson = null;
let currentUserRole = 'student';

const ICONS = {
  'VIDEO_AULA': 'bx-play-circle',
  'VIDEO': 'bx-movie-play',
  'AUDIO': 'bx-volume-full',
  'PODCAST': 'bx-podcast',
  'PDF': 'bxs-file-pdf',
  'QUIZ': 'bx-trophy',
  'TAREFA': 'bx-task',
  'MATERIAL': 'bx-link',
  'TEXTO': 'bx-paragraph',
  'default': 'bx-file'
};

/* =========================
   INIT
========================= */
document.addEventListener('DOMContentLoaded', async () => {
  if (!classId) { window.location.href = 'app.html'; return; }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  try {
    bindUI();

    await checkUserRole(session.user.id);
    await loadEnrollment(session.user.id);
    await loadCourse();

    // expõe para depuração/compat
    window.currentEnrollment = enrollment;

    // abre próxima aula automaticamente
    if (flatLessons.length > 0) {
      const validIds = flatLessons.map(l => l.id);
      enrollment.grades.completed = (enrollment.grades.completed || []).filter(id => validIds.includes(id));
      const next = flatLessons.find(l => !enrollment.grades.completed.includes(l.id)) || flatLessons[0];
      openLesson(next);
    } else {
      setEmptyState("Nenhuma aula publicada encontrada.");
    }

    updateOverallProgress();
    await loadMural();
    await checkUnreadMural();

  } catch (err) {
    console.error('Erro no classroom:', err);
    setEmptyState("Erro ao carregar o curso. Verifique o console.");
  }
});

/* =========================
   UI BINDINGS
========================= */
function bindUI() {
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  prevBtn.onclick = () => {};
  nextBtn.onclick = () => {};

  document.getElementById('btn-toggle-nav')?.addEventListener('click', () => {
    document.getElementById('course-nav')?.classList.toggle('closed');
  });

  // Drawer
  const closeBtn = document.getElementById('drawer-close');
  const backdrop = document.getElementById('activity-backdrop');
  closeBtn?.addEventListener('click', closeDrawer);
  backdrop?.addEventListener('click', closeDrawer);

  // Tabs
  document.getElementById('tab-notas-btn')?.addEventListener('click', () => loadGrades());
  document.getElementById('tab-cal-btn')?.addEventListener('click', () => loadCalendar());

  // Concluir aula (somente topo)
  document.getElementById('btn-finish')?.addEventListener('click', async () => {
    if (!currentLesson) return;
    await toggleLessonStatus();
  });
}

function setEmptyState(msg) {
  const activity = document.getElementById('activity-area');
  activity.innerHTML = `
    <div class="empty-state">
      <i class='bx bx-error-circle'></i>
      <div class="fw-bold">${msg}</div>
    </div>`;
}

/* =========================
   AUTH/ROLE/ENROLLMENT
========================= */
async function checkUserRole(userId) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (data?.role) currentUserRole = data.role;
}

async function loadEnrollment(userId) {
  const { data, error } = await supabase
    .from('class_enrollments')
    .select('*')
    .eq('class_id', classId)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  enrollment = data;

  if (!enrollment.grades) enrollment.grades = {};
  if (!enrollment.grades.completed) enrollment.grades.completed = [];
  if (!enrollment.grades.scores) enrollment.grades.scores = {};
  if (!enrollment.grades.tasks) enrollment.grades.tasks = {};
  if (!enrollment.grades.quiz) enrollment.grades.quiz = {}; // { lessonId: { attempts, last_at } }
}

/* =========================
   COURSE LOAD
========================= */
async function loadCourse() {
  const { data: cls, error: clsErr } = await supabase
    .from('classes')
    .select('*, courses(title)')
    .eq('id', classId)
    .single();

  if (clsErr) throw clsErr;

  classInfo = cls;

  document.getElementById('header-course-title').textContent = cls?.courses?.title || 'Curso';
  document.getElementById('header-class-name').textContent = cls?.name || 'Turma';

  // botão editar (só admin/professor) - sem mexer em layout
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

  const { data: modules, error: modErr } = await supabase
    .from('modules')
    .select(`*, sections (*, lessons (*))`)
    .eq('course_id', cls.course_id)
    .order('ordem', { ascending: true });

  if (modErr) throw modErr;

  const container = document.getElementById('modules-list');
  container.innerHTML = '';
  flatLessons = [];

  (modules || []).forEach((mod, index) => {
    const sections = Array.isArray(mod.sections) ? mod.sections : [];
    sections.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    let lessonsHtml = '';

    sections.forEach(sec => {
      if (sec?.title) lessonsHtml += `<div class="section-title">${sec.title}</div>`;

      const lessons = Array.isArray(sec.lessons) ? sec.lessons : [];
      lessons.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

      lessons.forEach(l => {
        if (l.is_published === false) return;

        // guarda metadata p/ Notas
        flatLessons.push({
          ...l,
          __moduleTitle: mod.title,
          __sectionTitle: sec.title || '',
          __moduleId: mod.id,
          __sectionId: sec.id
        });

        const isDone = enrollment.grades.completed.includes(l.id);
        lessonsHtml += `
          <div class="lesson-item ${isDone ? 'completed' : ''}" id="lesson-${l.id}" onclick="window.openLessonById(${l.id})">
            <i class='bx ${ICONS[l.type] || ICONS.default} fs-5'></i>
            <span class="text-truncate flex-grow-1">${l.title}</span>
            ${isDone ? "<i class='bx bxs-check-circle text-success'></i>" : ""}
          </div>`;
      });
    });

    const modId = `mod-${mod.id}`;
    container.innerHTML += `
      <div class="accordion-item">
        <h2 class="accordion-header">
          <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button"
            data-bs-toggle="collapse" data-bs-target="#${modId}">
            <div class="d-flex w-100 justify-content-between me-2 align-items-center">
              <span>${mod.title}</span>
            </div>
          </button>
        </h2>
        <div id="${modId}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#modules-list">
          <div class="accordion-body p-0">${lessonsHtml || `<div class="p-3 text-muted small">Sem aulas publicadas neste módulo.</div>`}</div>
        </div>
      </div>`;
  });

  // fallback se vier vazio
  if (!modules || modules.length === 0) {
    container.innerHTML = `<div class="p-3 text-muted small">Nenhum módulo encontrado para este curso.</div>`;
  }
}

window.openLessonById = (id) => {
  const l = flatLessons.find(x => x.id === id);
  if (l) openLesson(l);
};

/* =========================
   OPEN LESSON
========================= */
function openLesson(lesson) {
  currentLesson = lesson;

  // ao clicar na esquerda, sempre volta pra aba Aula (evita “ficar clicando em Aula”)
  forceSwitchToContent();

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

  // descrição aparece só para tipos “conteúdo”
  if (['TAREFA', 'QUIZ'].includes(lesson.type)) {
    descContainer.style.display = 'none';
  } else {
    descContainer.style.display = 'block';
    descContainer.innerHTML = lesson.description || '';
  }

  const url = getEmbedUrl(lesson.video_url || lesson.content_url);

  if (lesson.type === 'VIDEO_AULA' || lesson.type === 'VIDEO') {
    playerFrame.style.display = 'flex';
    playerFrame.innerHTML = `<iframe src="${url}" allowfullscreen></iframe>`;
  }
  else if (lesson.type === 'AUDIO' || lesson.type === 'PODCAST') {
    activity.innerHTML = `
      <div class="audio-container">
        <div class="audio-icon"><i class='bx bx-speaker'></i></div>
        <div class="fw-bold mb-2">${lesson.title}</div>
        <audio controls class="w-100">
          <source src="${url}" type="audio/mpeg">
        </audio>
        <div class="small text-muted mt-2">Se não tocar, verifique se o link é direto para o arquivo.</div>
      </div>`;
  }
  else if ((lesson.type === 'PDF' || lesson.type === 'MATERIAL') && url) {
    activity.innerHTML = `<iframe class="pdf-viewer" src="${url}"></iframe>`;
  }
  else if (lesson.type === 'TEXTO') {
    activity.innerHTML = `<div class="p-4 bg-light rounded border">${lesson.description || 'Conteúdo não disponível.'}</div>`;
  }
  else if (lesson.type === 'QUIZ') {
    openQuizDrawer(lesson);
    activity.innerHTML = `
      <div class="empty-state">
        <i class='bx bx-joystick'></i>
        <div class="fw-bold">Questionário aberto no painel lateral</div>
        <div class="text-muted small">Se fechar sem querer, clique em “Reabrir”.</div>
        <div class="mt-3">
          <button class="btn btn-outline-primary rounded-pill px-4" onclick="window.reopenDrawer()">Reabrir</button>
        </div>
      </div>`;
  }
  else if (lesson.type === 'TAREFA') {
    openTaskDrawer(lesson);
    activity.innerHTML = `
      <div class="empty-state">
        <i class='bx bx-task'></i>
        <div class="fw-bold">Tarefa aberta no painel lateral</div>
        <div class="text-muted small">Você responde questão por questão e envia ao final.</div>
        <div class="mt-3">
          <button class="btn btn-outline-primary rounded-pill px-4" onclick="window.reopenDrawer()">Reabrir</button>
        </div>
      </div>`;
  }

  updateFinishButton();
  updateNavigation();

  // em telas menores: recolhe o menu do curso pra liberar espaço
  if (window.innerWidth < 992) document.getElementById('course-nav')?.classList.add('closed');
}

window.reopenDrawer = () => {
  if (!currentLesson) return;
  if (currentLesson.type === 'QUIZ') openQuizDrawer(currentLesson);
  if (currentLesson.type === 'TAREFA') openTaskDrawer(currentLesson);
};

function updateNavigation() {
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

/* =========================
   COMPLETE LESSON (conteúdo)
========================= */
async function toggleLessonStatus() {
  if (!currentLesson) return;

  // para QUIZ e TAREFA, conclusão é pela atividade
  if (['QUIZ', 'TAREFA'].includes(currentLesson.type)) return;

  const done = enrollment.grades.completed.includes(currentLesson.id);
  if (done) enrollment.grades.completed = enrollment.grades.completed.filter(id => id !== currentLesson.id);
  else enrollment.grades.completed.push(currentLesson.id);

  await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id);

  markLessonCompletedUI(currentLesson.id, !done);
  updateOverallProgress();
  updateFinishButton();
}

function markLessonCompletedUI(lessonId, completed) {
  const el = document.getElementById(`lesson-${lessonId}`);
  if (!el) return;

  el.classList.toggle('completed', completed);

  const hasCheck = !!el.querySelector('.bxs-check-circle');
  if (completed && !hasCheck) {
    const icon = document.createElement('i');
    icon.className = 'bx bxs-check-circle text-success';
    el.appendChild(icon);
  }
  if (!completed && hasCheck) {
    el.querySelector('.bxs-check-circle')?.remove();
  }
}

function updateFinishButton() {
  const btn = document.getElementById('btn-finish');
  if (!btn) return;

  if (!currentLesson) {
    btn.disabled = true;
    btn.innerHTML = `<i class='bx bx-check'></i> Concluir Aula`;
    return;
  }

  const done = enrollment.grades.completed.includes(currentLesson.id);

  if (['QUIZ', 'TAREFA'].includes(currentLesson.type)) {
    btn.disabled = true;
    btn.innerHTML = done ? "<i class='bx bx-check-double'></i> Concluído" : "Complete a Atividade";
    btn.className = done ? "btn btn-success rounded-pill fw-bold" : "btn btn-outline-secondary rounded-pill fw-bold";
  } else {
    btn.disabled = false;
    btn.innerHTML = done ? "<i class='bx bx-check'></i> Concluído" : "Concluir Aula";
    btn.className = done ? "btn btn-success rounded-pill fw-bold" : "btn btn-outline-success rounded-pill fw-bold";
  }
}

function updateOverallProgress() {
  const done = enrollment.grades.completed.filter(id => flatLessons.some(l => l.id === id)).length;
  const pct = flatLessons.length > 0 ? Math.round((done / flatLessons.length) * 100) : 0;

  document.getElementById('overall-progress').style.width = `${pct}%`;
  document.getElementById('progress-text').textContent = `${pct}%`;
}

function forceSwitchToContent() {
  const b = document.getElementById('tab-aula-btn');
  if (!b) return;
  bootstrap.Tab.getOrCreateInstance(b).show();
}

function getEmbedUrl(url) {
  if (!url) return '';
  if (url.includes('watch?v=')) return url.replace('watch?v=', 'embed/');
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview');
  return url;
}

/* =========================
   DRAWER BASE
========================= */
function openDrawer({ title, subtitle = '', bodyHtml = '' }) {
  const drawer = document.getElementById('activity-drawer');
  const backdrop = document.getElementById('activity-backdrop');

  document.getElementById('drawer-title').textContent = title;
  document.getElementById('drawer-subtitle').textContent = subtitle;
  document.getElementById('drawer-body').innerHTML = bodyHtml;

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  backdrop.classList.add('show');
}

function closeDrawer() {
  const drawer = document.getElementById('activity-drawer');
  const backdrop = document.getElementById('activity-backdrop');

  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  backdrop.classList.remove('show');
}

/* =========================
   QUIZ (2 tentativas + 48h)
========================= */
function getQuizState(lessonId) {
  const st = enrollment.grades.quiz?.[lessonId] || { attempts: 0, last_at: null };
  const attempts = Number(st.attempts || 0);
  const lastAt = st.last_at ? new Date(st.last_at) : null;

  const maxAttempts = 2;
  const cooldownHours = 48;

  let canAttempt = attempts < maxAttempts;
  let cooldownLeftMs = 0;

  if (lastAt && attempts > 0 && attempts < maxAttempts) {
    const nextAllowed = new Date(lastAt.getTime() + cooldownHours * 3600 * 1000);
    const now = new Date();
    if (now < nextAllowed) {
      canAttempt = false;
      cooldownLeftMs = nextAllowed.getTime() - now.getTime();
    }
  }

  // professor/admin sempre pode abrir e corrigir
  if (['admin', 'professor'].includes(currentUserRole)) {
    canAttempt = true;
    cooldownLeftMs = 0;
  }

  return { attempts, maxAttempts, canAttempt, cooldownLeftMs, lastAt };
}

function fmtMs(ms) {
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}min`;
}

function openQuizDrawer(lesson) {
  const quiz = lesson.quiz_data || {};
  const items = Array.isArray(quiz.items) ? quiz.items : [];
  const points = Number(lesson.points || quiz.points || items.length || 0);

  const { attempts, maxAttempts, canAttempt, cooldownLeftMs, lastAt } = getQuizState(lesson.id);

  const infoHtml = `
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="fw-bold">Informações</div>
          <span class="badge bg-primary">${items.length} questões</span>
        </div>
        <div class="small text-muted">
          <div><b>Pontuação:</b> até ${points} pts</div>
          <div><b>Tentativas:</b> ${attempts} / ${maxAttempts}</div>
          ${lastAt ? `<div><b>Última tentativa:</b> ${lastAt.toLocaleString()}</div>` : ``}
          ${(!canAttempt && cooldownLeftMs) ? `<div class="mt-2 text-danger"><b>Aguarde:</b> nova tentativa liberada em ${fmtMs(cooldownLeftMs)}.</div>` : ``}
        </div>
      </div>
    </div>`;

  const actionHtml = `
    <div class="d-flex gap-2">
      <button class="btn btn-outline-secondary w-50" onclick="window.closeDrawer()">Fechar</button>
      <button class="btn btn-primary w-50" ${canAttempt ? '' : 'disabled'} onclick="window.startQuiz()">
        <i class='bx bx-play'></i> Iniciar
      </button>
    </div>`;

  openDrawer({
    title: `Questionário`,
    subtitle: lesson.title,
    bodyHtml: `${infoHtml}
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div class="fw-bold mb-2">Como funciona</div>
          <div class="small text-muted">
            Responda e finalize. Sua nota é salva automaticamente.
            <br><b>Regras:</b> máximo ${maxAttempts} tentativas e intervalo de 48h entre tentativas.
          </div>
        </div>
      </div>
      <div class="mt-3">${actionHtml}</div>`
  });

  // estado do quiz em memória
  window.__quizRuntime = {
    lesson,
    items,
    points,
    answers: {},
    index: 0
  };
}

window.startQuiz = () => {
  const rt = window.__quizRuntime;
  if (!rt) return;
  renderQuizQuestion();
};

function normalizeOptions(item) {
  // aceita: ["a","b"] ou [{id,text}] etc
  const raw = Array.isArray(item.options) ? item.options : [];
  return raw.map((op, idx) => {
    if (typeof op === 'string') return { id: String(idx), text: op, idx };
    return { id: (op.id ?? String(idx)), text: (op.text ?? String(op)), idx };
  });
}

function getCorrect(item, options) {
  if (typeof item.correctIndex === 'number') return options[item.correctIndex]?.id;
  if (typeof item.correct === 'number') return options[item.correct]?.id;
  if (typeof item.correctId === 'string') return item.correctId;
  if (typeof item.answer === 'string') {
    // tenta casar com id ou texto
    const byId = options.find(o => o.id === item.answer);
    if (byId) return byId.id;
    const byText = options.find(o => (o.text || '').trim() === item.answer.trim());
    if (byText) return byText.id;
  }
  return null;
}

function renderQuizQuestion() {
  const rt = window.__quizRuntime;
  if (!rt) return;

  const item = rt.items[rt.index];
  const total = rt.items.length;
  const options = normalizeOptions(item);
  const picked = rt.answers[item.id] ?? null;

  const optsHtml = options.map(o => `
    <label class="d-flex gap-2 align-items-start p-3 rounded border bg-white mb-2" style="cursor:pointer;">
      <input type="radio" name="qopt" value="${o.id}" ${picked === o.id ? 'checked' : ''} onchange="window.pickQuiz('${item.id}','${o.id}')">
      <div><b>${String.fromCharCode(65 + o.idx)}.</b> ${o.text}</div>
    </label>
  `).join('');

  const body = `
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between mb-2">
          <span class="badge bg-primary">Questão ${rt.index + 1} / ${total}</span>
          <span class="badge bg-light text-dark border">Vale até ${rt.points} pts</span>
        </div>
        <div class="fw-bold fs-5 mb-3">${item.statement || item.title || 'Questão'}</div>
        ${optsHtml || `<div class="text-muted small">Questão sem alternativas configuradas.</div>`}
      </div>
    </div>

    <div class="d-flex justify-content-between gap-2">
      <button class="btn btn-outline-secondary" onclick="window.prevQuiz()" ${rt.index === 0 ? 'disabled' : ''}>Anterior</button>
      ${rt.index < total - 1
        ? `<button class="btn btn-primary" onclick="window.nextQuiz()">Próxima</button>`
        : `<button class="btn btn-success fw-bold" onclick="window.finishQuiz()">Finalizar</button>`
      }
    </div>
  `;

  openDrawer({ title: `Questionário`, subtitle: rt.lesson.title, bodyHtml: body });
}

window.pickQuiz = (qid, oid) => {
  const rt = window.__quizRuntime;
  if (!rt) return;
  rt.answers[qid] = oid;
};

window.nextQuiz = () => {
  const rt = window.__quizRuntime;
  if (!rt) return;
  if (rt.index < rt.items.length - 1) rt.index++;
  renderQuizQuestion();
};

window.prevQuiz = () => {
  const rt = window.__quizRuntime;
  if (!rt) return;
  if (rt.index > 0) rt.index--;
  renderQuizQuestion();
};

window.finishQuiz = async () => {
  const rt = window.__quizRuntime;
  if (!rt) return;

  // Corrige
  let correctCount = 0;
  rt.items.forEach(item => {
    const options = normalizeOptions(item);
    const correctId = getCorrect(item, options);
    const ans = rt.answers[item.id];
    if (correctId && ans === correctId) correctCount++;
  });

  const total = rt.items.length || 1;
  const score = Math.round((correctCount / total) * rt.points);

  // salva tentativas com cooldown 48h
  const st = getQuizState(rt.lesson.id);
  const nextAttempts = Math.min(st.attempts + 1, st.maxAttempts);

  enrollment.grades.quiz[rt.lesson.id] = {
    attempts: nextAttempts,
    last_at: new Date().toISOString()
  };

  enrollment.grades.scores[rt.lesson.id] = score;

  // marca concluído
  if (!enrollment.grades.completed.includes(rt.lesson.id)) {
    enrollment.grades.completed.push(rt.lesson.id);
  }

  await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id);

  markLessonCompletedUI(rt.lesson.id, true);
  updateOverallProgress();
  updateFinishButton();

  openDrawer({
    title: `Resultado`,
    subtitle: rt.lesson.title,
    bodyHtml: `
      <div class="card border-0 shadow-sm">
        <div class="card-body text-center">
          <div class="display-6 fw-bold mb-2">${score} pts</div>
          <div class="text-muted">Acertos: ${correctCount} / ${total}</div>
          <div class="small text-muted mt-2">
            Tentativas: ${nextAttempts} / 2 • Nova tentativa somente após 48h (se ainda houver).
          </div>
          <div class="mt-3">
            <button class="btn btn-outline-secondary rounded-pill px-4" onclick="window.closeDrawer()">Fechar</button>
          </div>
        </div>
      </div>
    `
  });
};

window.closeDrawer = closeDrawer;

/* =========================
   TASK (gaveta + envio)
========================= */
function getTaskItems(lesson) {
  if (lesson.task_data?.items) return lesson.task_data.items;
  if (lesson.quiz_data?.items) return lesson.quiz_data.items; // fallback
  return [];
}

function openTaskDrawer(lesson) {
  const items = getTaskItems(lesson);
  const instructions = lesson.task_data?.instructions || lesson.description || '';
  const saved = enrollment.grades.tasks?.[lesson.id] || null;

  const isSubmitted = !!saved;
  const subtitle = lesson.title;

  const info = `
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="fw-bold mb-2">Orientações</div>
        <div class="small text-muted" style="white-space:pre-wrap;">${instructions || 'Sem instruções adicionais.'}</div>
        <hr>
        <div class="small text-muted">
          <b>Questões:</b> ${items.length} • <b>Status:</b> ${isSubmitted ? 'Enviado' : 'Não enviado'}
        </div>
      </div>
    </div>`;

  openDrawer({
    title: 'Tarefa',
    subtitle,
    bodyHtml: `
      ${info}
      <div class="d-flex gap-2">
        <button class="btn btn-outline-secondary w-50" onclick="window.closeDrawer()">Fechar</button>
        <button class="btn btn-primary w-50" onclick="window.startTask()">
          <i class='bx bx-play'></i> ${isSubmitted ? 'Ver Respostas' : 'Iniciar'}
        </button>
      </div>
    `
  });

  window.__taskRuntime = {
    lesson,
    items,
    index: 0,
    answers: saved?.answers || {},
    isSubmitted,
    teacherScores: saved?.item_scores || {},
    teacherFeedback: saved?.item_feedback || {}
  };
}

window.startTask = () => renderTaskStep();

function renderTaskStep() {
  const rt = window.__taskRuntime;
  if (!rt) return;

  const item = rt.items[rt.index];
  const total = rt.items.length || 1;
  const answer = rt.answers[item.id] || '';

  let inputHtml = '';
  const disabled = (rt.isSubmitted && currentUserRole === 'student') ? 'disabled' : '';

  if ((item.type || 'text') === 'text') {
    inputHtml = `
      <textarea class="form-control fs-6" rows="6" ${disabled}
        oninput="window.setTaskAnswer(${item.id}, this.value)">${answer}</textarea>`;
  } else {
    inputHtml = `
      <input type="file" class="form-control" ${disabled}
        onchange="window.setTaskFile(${item.id}, this)">`;
  }

  let teacherArea = '';
  if (['admin', 'professor'].includes(currentUserRole)) {
    const score = rt.teacherScores?.[item.id] ?? '';
    const fb = rt.teacherFeedback?.[item.id] ?? '';
    teacherArea = `
      <div class="mt-3 p-3 rounded border" style="background:#fff7ed;">
        <div class="fw-bold mb-2">Avaliação do Professor</div>
        <div class="row g-2">
          <div class="col-3">
            <label class="small fw-bold">Nota</label>
            <input type="number" class="form-control" value="${score}" onchange="window.saveTeacherTask('${item.id}','score',this.value)">
          </div>
          <div class="col-9">
            <label class="small fw-bold">Feedback</label>
            <input type="text" class="form-control" value="${fb}" onchange="window.saveTeacherTask('${item.id}','feedback',this.value)">
          </div>
        </div>
      </div>`;
  }

  const body = `
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <div class="d-flex justify-content-between mb-2">
          <span class="badge bg-primary">Questão ${rt.index + 1} / ${total}</span>
          <span class="badge bg-light text-dark border">Tarefa</span>
        </div>

        <div class="fw-bold fs-5 mb-3">${item.statement || 'Questão'}</div>

        <div class="p-3 rounded border bg-white">
          <div class="small text-muted fw-bold mb-2">SUA RESPOSTA</div>
          ${inputHtml}
        </div>

        ${teacherArea}
      </div>
    </div>

    <div class="d-flex justify-content-between gap-2">
      <button class="btn btn-outline-secondary" onclick="window.prevTask()" ${rt.index === 0 ? 'disabled' : ''}>Anterior</button>
      ${rt.index < total - 1
        ? `<button class="btn btn-primary" onclick="window.nextTask()">Próxima</button>`
        : `<button class="btn btn-success fw-bold" onclick="window.submitTask()" ${(rt.isSubmitted && currentUserRole==='student') ? 'disabled' : ''}>${rt.isSubmitted ? 'Enviado' : 'Finalizar e Enviar'}</button>`
      }
    </div>
  `;

  openDrawer({ title: 'Tarefa', subtitle: rt.lesson.title, bodyHtml: body });
}

window.setTaskAnswer = (id, val) => {
  const rt = window.__taskRuntime;
  if (!rt) return;
  rt.answers[id] = val;
};

window.setTaskFile = (id, inp) => {
  const rt = window.__taskRuntime;
  if (!rt) return;
  rt.answers[id] = inp.files?.[0]?.name ? inp.files[0].name : 'Arquivo';
};

window.nextTask = () => {
  const rt = window.__taskRuntime;
  if (!rt) return;
  if (rt.index < rt.items.length - 1) rt.index++;
  renderTaskStep();
};

window.prevTask = () => {
  const rt = window.__taskRuntime;
  if (!rt) return;
  if (rt.index > 0) rt.index--;
  renderTaskStep();
};

window.submitTask = async () => {
  const rt = window.__taskRuntime;
  if (!rt) return;

  if (['admin', 'professor'].includes(currentUserRole)) {
    // professor só avalia (salvo em saveTeacherTask)
    return;
  }

  if (!confirm('Enviar tarefa?')) return;

  enrollment.grades.tasks[rt.lesson.id] = {
    submitted_at: new Date().toISOString(),
    status: 'submitted',
    answers: rt.answers,
    item_scores: enrollment.grades.tasks?.[rt.lesson.id]?.item_scores || {},
    item_feedback: enrollment.grades.tasks?.[rt.lesson.id]?.item_feedback || {}
  };

  if (!enrollment.grades.completed.includes(rt.lesson.id)) {
    enrollment.grades.completed.push(rt.lesson.id);
  }

  await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id);

  rt.isSubmitted = true;

  markLessonCompletedUI(rt.lesson.id, true);
  updateOverallProgress();
  updateFinishButton();

  openDrawer({
    title: 'Tarefa enviada',
    subtitle: rt.lesson.title,
    bodyHtml: `
      <div class="card border-0 shadow-sm">
        <div class="card-body text-center">
          <div class="fw-bold mb-1">Envio registrado com sucesso.</div>
          <div class="text-muted small">O retorno/nota será exibido em “Notas”, quando atribuído.</div>
          <div class="mt-3">
            <button class="btn btn-outline-secondary rounded-pill px-4" onclick="window.closeDrawer()">Fechar</button>
          </div>
        </div>
      </div>
    `
  });
};

window.saveTeacherTask = async (itemId, type, value) => {
  const rt = window.__taskRuntime;
  if (!rt) return;

  const lessonId = rt.lesson.id;

  const existing = enrollment.grades.tasks[lessonId] || { answers: rt.answers, item_scores: {}, item_feedback: {}, submitted_at: new Date().toISOString(), status: 'submitted' };
  if (!existing.item_scores) existing.item_scores = {};
  if (!existing.item_feedback) existing.item_feedback = {};

  if (type === 'score') existing.item_scores[itemId] = Number(value || 0);
  if (type === 'feedback') existing.item_feedback[itemId] = String(value || '');

  enrollment.grades.tasks[lessonId] = existing;

  // total da tarefa -> scores[lessonId]
  let total = 0;
  Object.values(existing.item_scores).forEach(v => total += (Number(v) || 0));
  enrollment.grades.scores[lessonId] = total;

  await supabase.from('class_enrollments').update({ grades: enrollment.grades }).eq('id', enrollment.id);
};

/* =========================
   MURAL (POST-IT + DRAG)
========================= */
async function loadMural() {
  const container = document.getElementById('wall-container');
  if (!container) return;

  const { data: posts, error } = await supabase
    .from('class_posts')
    .select('*')
    .eq('class_id', classId)
    .neq('type', 'INTERNAL')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = `<div class="text-muted p-3">Erro ao carregar mural.</div>`;
    return;
  }

  if (!posts || posts.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class='bx bx-message-square-dots'></i><div class="fw-bold">Mural vazio</div></div>`;
    return;
  }

  // leitura local (lido/não lido)
  const readKey = `ava3_read_posts_${enrollment.id}`;
  const read = JSON.parse(localStorage.getItem(readKey) || '[]');

  // ordem local tipo trello
  const orderKey = `ava3_mural_order_${classId}`;
  const savedOrder = JSON.parse(localStorage.getItem(orderKey) || '[]');
  const byId = new Map(posts.map(p => [String(p.id), p]));
  const ordered = [
    ...savedOrder.map(id => byId.get(String(id))).filter(Boolean),
    ...posts.filter(p => !savedOrder.includes(String(p.id)))
  ];

  container.innerHTML = ordered.map(p => {
    const isRead = read.includes(p.id);
    const color = pickPostColor(p.type);
    return `
      <div class="post-it ${color}" draggable="true" data-post-id="${p.id}">
        ${!isRead ? `<div class="new-indicator">NOVO</div>` : ``}
        <div class="post-title">${escapeHtml(p.title || 'Sem título')}</div>
        <div class="post-body">${escapeHtml(p.content || '')}</div>
        <div class="post-footer">
          <span class="post-tag">${escapeHtml(p.type || '')}</span>
          <button class="post-btn" onclick="window.markPostRead('${p.id}')">Marcar lido</button>
        </div>
      </div>
    `;
  }).join('');

  enablePostItDrag(container, orderKey);
}

function pickPostColor(type) {
  const t = String(type || '').toUpperCase();
  if (t.includes('EVENTO')) return 'post-blue';
  if (t.includes('MATERIAL')) return 'post-green';
  if (t.includes('AVISO')) return 'post-yellow';
  return 'post-pink';
}

function enablePostItDrag(container, orderKey) {
  let dragEl = null;
  let placeholder = null;

  const items = () => Array.from(container.querySelectorAll('.post-it'));

  container.querySelectorAll('.post-it').forEach(el => {
    el.addEventListener('dragstart', () => {
      dragEl = el;
      placeholder = document.createElement('div');
      placeholder.className = 'postit-drop';
      setTimeout(() => el.style.display = 'none', 0);
    });

    el.addEventListener('dragend', () => {
      if (dragEl) dragEl.style.display = '';
      placeholder?.remove();
      dragEl = null;
      placeholder = null;

      // salva ordem
      const order = items().map(x => String(x.dataset.postId));
      localStorage.setItem(orderKey, JSON.stringify(order));
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      const target = e.currentTarget;
      if (!dragEl || target === dragEl) return;

      const rect = target.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;

      if (before) container.insertBefore(placeholder, target);
      else container.insertBefore(placeholder, target.nextSibling);
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!dragEl || !placeholder) return;
      container.insertBefore(dragEl, placeholder);
    });
  });

  container.addEventListener('dragover', (e) => e.preventDefault());
  container.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!dragEl || !placeholder) return;
    container.insertBefore(dragEl, placeholder);
  });
}

window.markPostRead = async (id) => {
  const readKey = `ava3_read_posts_${enrollment.id}`;
  let read = JSON.parse(localStorage.getItem(readKey) || '[]');
  if (!read.includes(Number(id))) {
    read.push(Number(id));
    localStorage.setItem(readKey, JSON.stringify(read));
    await loadMural();
    await checkUnreadMural();
  }
};

async function checkUnreadMural() {
  const { data: posts } = await supabase
    .from('class_posts')
    .select('id')
    .eq('class_id', classId)
    .neq('type', 'INTERNAL');

  if (!posts) return;

  const readKey = `ava3_read_posts_${enrollment.id}`;
  const read = JSON.parse(localStorage.getItem(readKey) || '[]');

  const count = posts.filter(p => !read.includes(p.id)).length;
  const badge = document.getElementById('mural-badge');

  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

/* =========================
   NOTAS (por módulo/seção)
========================= */
function loadGrades() {
  const wrap = document.getElementById('grades-list');
  if (!wrap) return;

  const grouped = {};
  flatLessons.forEach(l => {
    const mod = l.__moduleTitle || 'Sem módulo';
    const sec = l.__sectionTitle || 'Sem seção';
    grouped[mod] = grouped[mod] || {};
    grouped[mod][sec] = grouped[mod][sec] || [];
    grouped[mod][sec].push(l);
  });

  const html = Object.keys(grouped).map(modTitle => {
    const secObj = grouped[modTitle];
    const secHtml = Object.keys(secObj).map(secTitle => {
      const rows = secObj[secTitle].map(l => {
        const score = enrollment.grades.scores?.[l.id];
        const shown = (score === 0 || typeof score === 'number') ? score : 'NSA';
        const status = enrollment.grades.completed.includes(l.id) ? 'Concluído' : 'Pendente';
        return `
          <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
            <div class="d-flex align-items-center gap-2">
              <i class='bx ${ICONS[l.type] || ICONS.default}'></i>
              <div>
                <div class="fw-bold">${escapeHtml(l.title)}</div>
                <div class="small text-muted">${l.type} • ${status}</div>
              </div>
            </div>
            <span class="badge bg-light text-dark border">Nota: ${shown}</span>
          </div>`;
      }).join('');

      return `
        <div class="mt-3 p-3 rounded border bg-white">
          <div class="fw-bold mb-2">${escapeHtml(secTitle)}</div>
          ${rows || `<div class="text-muted small">Sem itens.</div>`}
        </div>
      `;
    }).join('');

    return `
      <div class="p-3 rounded border bg-light mb-3">
        <div class="fw-bold">${escapeHtml(modTitle)}</div>
        ${secHtml}
      </div>
    `;
  }).join('');

  wrap.innerHTML = html || `<div class="alert alert-info">Sem dados de notas.</div>`;
}

/* =========================
   CALENDÁRIO (básico)
========================= */
function loadCalendar() {
  const wrap = document.getElementById('calendar-list');
  if (!wrap) return;

  const start = classInfo?.start_date ? new Date(classInfo.start_date).toLocaleDateString() : '—';
  const end = classInfo?.end_date ? new Date(classInfo.end_date).toLocaleDateString() : '—';

  wrap.innerHTML = `
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <div class="fw-bold mb-2">Calendário da Turma</div>
        <div class="small text-muted">
          <div><b>Início:</b> ${start}</div>
          <div><b>Término:</b> ${end}</div>
          <hr>
          <div class="text-muted small">
            (Você pode evoluir isso depois para listar eventos do mural com <code>event_date</code> e prazos de tarefas.)
          </div>
        </div>
      </div>
    </div>
  `;
}

/* =========================
   HELPERS
========================= */
function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
