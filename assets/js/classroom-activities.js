// assets/js/classroom-activities.js
import { supabase } from './supabaseClient.js';

/**
 * Um módulo único para QUIZ + TAREFA.
 * - NÃO injeta CSS (usa classroom-styles.css).
 * - Usa o drawer já existente no classroom.html (#quiz-drawer / #quiz-drawer-content).
 * - Expõe funções no window para não quebrar onclicks existentes.
 */

let ctx = {
  classId: null,
  getEnrollment: () => null,
  getUserRole: () => 'student',
  getCurrentLesson: () => null,
  refreshUI: () => {}
};

// -------------------------
// Helpers de DOM (Quiz Drawer)
// -------------------------
function ensureQuizBackdrop() {
  if (document.getElementById('quiz-backdrop')) return;

  const bd = document.createElement('div');
  bd.id = 'quiz-backdrop';
  bd.className = 'quiz-backdrop';
  bd.addEventListener('click', () => closeQuizDrawer());
  document.body.appendChild(bd);
}

function openQuizDrawerUI() {
  ensureQuizBackdrop();
  const drawer = document.getElementById('quiz-drawer');
  const backdrop = document.getElementById('quiz-backdrop');

  if (drawer) drawer.classList.add('open');
  if (backdrop) backdrop.classList.add('show');
}

function closeQuizDrawerUI() {
  const drawer = document.getElementById('quiz-drawer');
  const backdrop = document.getElementById('quiz-backdrop');

  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('show');
}

function setQuizDrawerContent(html) {
  const content = document.getElementById('quiz-drawer-content');
  if (content) content.innerHTML = html;
}

// -------------------------
// QUIZ
// -------------------------
let quizState = {
  lesson: null,
  enrollmentId: null,
  role: 'student',
  questions: [],
  currentIndex: 0,
  answers: {},
  totalPoints: 100,
  maxAttempts: 2,
  drawCount: null
};

function parseQuizQuestions(lesson) {
  // Aceita:
  // lesson.quiz_data = { questions: [...], settings: { drawCount } }
  // ou lesson.description começando com JSON
  let obj = null;
  if (lesson.quiz_data) obj = lesson.quiz_data;
  else if (lesson.description && String(lesson.description).trim().startsWith('{')) {
    try { obj = JSON.parse(lesson.description); } catch { obj = null; }
  }

  let questions = [];
  let drawCount = null;

  if (Array.isArray(obj)) {
    questions = obj;
    drawCount = obj.length;
  } else if (obj && typeof obj === 'object') {
    questions = Array.isArray(obj.questions) ? obj.questions : [];
    if (obj.settings && obj.settings.drawCount != null) {
      const n = parseInt(obj.settings.drawCount, 10);
      if (!Number.isNaN(n) && n > 0) drawCount = n;
    }
  }

  return { questions, drawCount };
}

function isActivityLocked(lesson, role) {
  const now = new Date();
  const start = lesson.available_from ? new Date(lesson.available_from) : null;
  const end = lesson.available_until ? new Date(lesson.available_until) : null;

  let locked = false;
  let msg = '';

  if (start && now < start) { locked = true; msg = `Abre em: ${start.toLocaleString()}`; }
  else if (end && now > end) { locked = true; msg = `Fechado em: ${end.toLocaleString()}`; }

  const isTeacher = ['admin', 'professor'].includes(role);
  return { locked: locked && !isTeacher, msg, teacherOutOfDate: locked && isTeacher ? msg : '' };
}

export function openQuizDrawer(lesson, enrollment, role) {
  quizState.lesson = lesson;
  quizState.enrollmentId = enrollment?.id || null;
  quizState.role = role || 'student';
  quizState.answers = {};
  quizState.currentIndex = 0;

  quizState.totalPoints = lesson?.points || 100;

  openQuizDrawerUI();
  renderQuizIntro();
}

export function closeQuizDrawer() {
  closeQuizDrawerUI();
}

function renderQuizIntro() {
  const lesson = quizState.lesson;
  const enrollment = ctx.getEnrollment();

  if (!lesson || !enrollment) {
    setQuizDrawerContent(`<div class="p-4 bg-white rounded border">Erro: contexto do quiz não carregado.</div>`);
    return;
  }

  const lock = isActivityLocked(lesson, quizState.role);
  if (lock.locked) {
    setQuizDrawerContent(`
      <div class="text-center p-5 bg-white rounded border">
        <i class='bx bx-lock display-1 text-danger'></i>
        <h4 class="mt-3">Indisponível</h4>
        <p class="text-muted">${lock.msg}</p>
      </div>
    `);
    return;
  }

  const { questions, drawCount } = parseQuizQuestions(lesson);
  const totalQ = questions.length;
  const ask = drawCount ? Math.min(totalQ, drawCount) : totalQ;

  if (!enrollment.grades) enrollment.grades = {};
  if (!enrollment.grades.attempts) enrollment.grades.attempts = {};
  if (!enrollment.grades.scores) enrollment.grades.scores = {};
  if (!enrollment.grades.completed) enrollment.grades.completed = [];

  const attempts = enrollment.grades.attempts[lesson.id] || 0;
  const lastScore = enrollment.grades.scores[lesson.id];

  let btnHtml = '';
  const isTeacher = ['admin', 'professor'].includes(quizState.role);

  if (!isTeacher && attempts >= quizState.maxAttempts) {
    btnHtml = `<div class="alert alert-warning mt-4">
      Você esgotou ${quizState.maxAttempts} tentativas.<br>
      Nota final: <strong>${(lastScore ?? '-')}</strong>
    </div>`;
  } else {
    const lbl = attempts > 0 ? `Tentar novamente (${attempts}/${quizState.maxAttempts})` : 'Iniciar';
    btnHtml = `<button class="btn btn-primary btn-lg rounded-pill px-5 fw-bold" onclick="window.Quiz.start()">${lbl}</button>`;
  }

  setQuizDrawerContent(`
    <div class="quiz-wrapper">
      <div class="quiz-hero">
        <div class="quiz-hero-icon start"><i class='bx bx-joystick'></i></div>
        <h3 class="fw-bold mb-2">${lesson.title}</h3>
        ${lock.teacherOutOfDate ? `<div class="alert alert-warning mt-3">Modo Professor: Fora do prazo (${lock.teacherOutOfDate})</div>` : ''}
        <div class="quiz-stat-grid">
          <div class="quiz-stat-box">
            <span class="quiz-stat-val">${ask || 0}</span>
            <span class="quiz-stat-lbl">Questões</span>
          </div>
          <div class="quiz-stat-box">
            <span class="quiz-stat-val">${lesson.points || 0}</span>
            <span class="quiz-stat-lbl">Pontos</span>
          </div>
        </div>
        ${lesson.description && !String(lesson.description).trim().startsWith('{')
          ? `<div class="p-3 bg-light rounded border text-start">${lesson.description}</div>`
          : ''
        }
        <div class="mt-4">${btnHtml}</div>
      </div>
    </div>
  `);
}

function buildQuizSet() {
  const lesson = quizState.lesson;
  const { questions, drawCount } = parseQuizQuestions(lesson);

  if (!questions.length) return { ok: false, msg: 'Sem questões cadastradas.' };

  const shuffled = [...questions].sort(() => 0.5 - Math.random());
  const limit = drawCount ? Math.min(shuffled.length, drawCount) : shuffled.length;

  quizState.questions = shuffled.slice(0, limit);
  quizState.currentIndex = 0;
  quizState.answers = {};

  return { ok: true };
}

export function startQuiz() {
  const enrollment = ctx.getEnrollment();
  const lesson = quizState.lesson;

  if (!enrollment || !lesson) return;

  const isTeacher = ['admin', 'professor'].includes(quizState.role);

  if (!enrollment.grades) enrollment.grades = {};
  if (!enrollment.grades.attempts) enrollment.grades.attempts = {};
  const attempts = enrollment.grades.attempts[lesson.id] || 0;

  if (!isTeacher && attempts >= quizState.maxAttempts) {
    renderQuizIntro();
    return;
  }

  const built = buildQuizSet();
  if (!built.ok) {
    setQuizDrawerContent(`<div class="p-4 bg-white rounded border">${built.msg}</div>`);
    return;
  }

  renderQuizStep();
}

function renderQuizStep() {
  const q = quizState.questions[quizState.currentIndex];
  const total = quizState.questions.length;
  const progress = Math.round(((quizState.currentIndex + 1) / total) * 100);

  const title = q.text || q.title || 'Questão';
  const options = Array.isArray(q.options) ? q.options : [];

  let optionsHtml = options.map((opt, idx) => {
    const label = (opt && typeof opt === 'object') ? (opt.text ?? String(opt)) : String(opt);
    const selected = quizState.answers[quizState.currentIndex] === idx;
    return `
      <div class="quiz-option-label ${selected ? 'selected' : ''}" onclick="window.Quiz.select(${idx})">
        <span class="quiz-radio"></span>
        <span>${label}</span>
      </div>
    `;
  }).join('');

  setQuizDrawerContent(`
    <div class="quiz-wrapper">
      <div class="quiz-progress-container">
        <div class="quiz-progress-fill" style="width:${progress}%"></div>
      </div>
      <div class="quiz-body">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <span class="badge bg-light text-dark border">Q ${quizState.currentIndex + 1}/${total}</span>
          <span class="badge bg-light text-dark border">${progress}%</span>
        </div>

        <div class="quiz-question-text">${title}</div>
        <div>${optionsHtml}</div>

        <div class="d-flex justify-content-between mt-4 pt-4 border-top">
          <button class="btn btn-outline-secondary rounded-pill px-4" onclick="window.Quiz.prev()" ${quizState.currentIndex === 0 ? 'disabled' : ''}>Anterior</button>
          ${quizState.currentIndex === total - 1
            ? `<button class="btn btn-success rounded-pill px-4 fw-bold" onclick="window.Quiz.finish()">Finalizar</button>`
            : `<button class="btn btn-primary rounded-pill px-4 fw-bold" onclick="window.Quiz.next()">Próxima</button>`
          }
        </div>
      </div>
    </div>
  `);
}

export function selectQuizAnswer(idx) {
  quizState.answers[quizState.currentIndex] = idx;
  renderQuizStep();
}
export function nextQuiz() {
  if (quizState.currentIndex < quizState.questions.length - 1) {
    quizState.currentIndex++;
    renderQuizStep();
  }
}
export function prevQuiz() {
  if (quizState.currentIndex > 0) {
    quizState.currentIndex--;
    renderQuizStep();
  }
}

export async function finishQuiz() {
  const enrollment = ctx.getEnrollment();
  const lesson = quizState.lesson;
  if (!enrollment || !lesson) return;

  if (!confirm('Finalizar?')) return;

  // Calcula acertos
  let correct = 0;
  quizState.questions.forEach((q, idx) => {
    const ans = quizState.answers[idx];
    if (ans !== undefined && String(ans) === String(q.correctIndex)) correct++;
  });

  const totalQ = quizState.questions.length || 1;
  const finalScore = Math.round((correct / totalQ) * quizState.totalPoints);

  setQuizDrawerContent(`<div class="text-center py-5"><div class="spinner-border"></div><p class="mt-3">Salvando...</p></div>`);

  // Atualiza grades
  if (!enrollment.grades) enrollment.grades = { completed: [], scores: {}, tasks: {} };
  if (!enrollment.grades.attempts) enrollment.grades.attempts = {};
  if (!enrollment.grades.scores) enrollment.grades.scores = {};
  if (!enrollment.grades.completed) enrollment.grades.completed = [];

  const isTeacher = ['admin', 'professor'].includes(quizState.role);
  if (!isTeacher) {
    enrollment.grades.attempts[lesson.id] = (enrollment.grades.attempts[lesson.id] || 0) + 1;
  }

  enrollment.grades.scores[lesson.id] = finalScore;
  if (!enrollment.grades.completed.includes(lesson.id)) enrollment.grades.completed.push(lesson.id);

  const { error } = await supabase
    .from('class_enrollments')
    .update({ grades: enrollment.grades })
    .eq('id', enrollment.id);

  if (error) {
    alert('Erro ao salvar: ' + error.message);
    renderQuizIntro();
    return;
  }

  const pct = Math.round((finalScore / quizState.totalPoints) * 100);
  const isPass = pct >= 70;

  setQuizDrawerContent(`
    <div class="quiz-wrapper">
      <div class="quiz-hero">
        <div class="quiz-hero-icon ${isPass ? '' : 'locked'}">
          <i class='bx ${isPass ? 'bx-check-circle' : 'bx-x-circle'}'></i>
        </div>
        <h2 class="fw-bold mb-2">${isPass ? 'Aprovado!' : 'Concluído'}</h2>
        <div class="score-circle" style="--pct:${pct}%;" data-score="${finalScore}"></div>
        <p class="text-muted mb-4">Nota: <strong>${finalScore}</strong> / ${quizState.totalPoints}</p>
        <button class="btn btn-outline-dark rounded-pill px-4" onclick="window.closeQuizDrawer()">Fechar</button>
      </div>
    </div>
  `);

  // Atualiza UI principal (check, progresso, botão concluir)
  ctx.refreshUI();
}

// -------------------------
// TAREFA (mantém sua lógica, mas isolada aqui)
// -------------------------
let taskState = {
  items: [],
  currentIndex: -1,
  answers: {},
  isSubmitted: false,
  teacherScores: {},
  teacherFeedback: {}
};

let gradingCache = { students: [], currentStudent: null };

export function renderTaskIntro(lesson) {
  const role = ctx.getUserRole();
  const now = new Date();
  const start = lesson.available_from ? new Date(lesson.available_from) : null;
  const end = lesson.available_until ? new Date(lesson.available_until) : null;

  let isLocked = false, lockMsg = '';
  if (start && now < start) { isLocked = true; lockMsg = `Abre em: ${start.toLocaleString()}`; }
  else if (end && now > end) { isLocked = true; lockMsg = `Fechado em: ${end.toLocaleString()}`; }

  const isAdmin = ['admin', 'professor'].includes(role);

  const activity = document.getElementById('activity-area');
  if (!activity) return;

  if (isLocked && !isAdmin) {
    activity.innerHTML = `<div class="alert alert-danger text-center p-5"><h4>Tarefa Indisponível</h4><p>${lockMsg}</p></div>`;
    return;
  }

  let instructions = lesson.description || '';
  if (lesson.task_data) instructions = lesson.task_data.instructions || instructions;

  const adminBtn = isAdmin
    ? `<button class="btn btn-warning text-dark fw-bold w-100 mb-3" onclick="window.openGradingList()">
         <i class='bx bx-check-circle'></i> Painel de Correção
       </button>`
    : '';

  activity.innerHTML = `
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
    </div>
  `;
}

export function startTask() {
  const lesson = ctx.getCurrentLesson();
  const enrollment = ctx.getEnrollment();
  if (!lesson || !enrollment) return;

  let items = (lesson.task_data && Array.isArray(lesson.task_data.items)) ? lesson.task_data.items : [];
  if (!items.length && lesson.quiz_data && Array.isArray(lesson.quiz_data.items)) items = lesson.quiz_data.items;

  const savedTask = enrollment.grades?.tasks?.[lesson.id];

  taskState = {
    items,
    currentIndex: 0,
    answers: savedTask ? (savedTask.answers || {}) : {},
    isSubmitted: savedTask ? true : false,
    teacherFeedback: savedTask ? (savedTask.item_feedback || {}) : {},
    teacherScores: savedTask ? (savedTask.item_scores || {}) : {}
  };

  renderTaskStep();
}

export function renderTaskStep() {
  const lesson = ctx.getCurrentLesson();
  const role = ctx.getUserRole();
  const activity = document.getElementById('activity-area');
  if (!activity || !lesson) return;

  const item = taskState.items[taskState.currentIndex];
  const total = taskState.items.length;
  if (!item) {
    activity.innerHTML = `<div class="alert alert-warning">Sem itens na tarefa.</div>`;
    return;
  }

  const answer = taskState.answers[item.id] || '';

  const inputHtml = item.type === 'text'
    ? `<textarea class="form-control mb-3 fs-5" rows="6"
         oninput="window.updateTaskAnswer('${item.id}', this.value)"
         ${taskState.isSubmitted && role === 'student' ? 'disabled' : ''}>${answer}</textarea>`
    : `<div class="mb-3">
         <input type="file" class="form-control"
           onchange="window.updateTaskFile('${item.id}', this)"
           ${taskState.isSubmitted && role === 'student' ? 'disabled' : ''}>
       </div>`;

  let teacherAreaHtml = '';
  if (['admin', 'professor'].includes(role)) {
    const score = taskState.teacherScores?.[item.id] || 0;
    const fb = taskState.teacherFeedback?.[item.id] || '';
    teacherAreaHtml = `
      <div class="mt-4 p-4 rounded bg-warning bg-opacity-10 border border-warning">
        <h6 class="fw-bold">Avaliação</h6>
        <div class="row g-2">
          <div class="col-3">
            <label class="small fw-bold">Nota</label>
            <input type="number" class="form-control" value="${score}" max="${item.points}"
              onchange="window.saveTeacherGrade('${item.id}', 'score', this.value)">
          </div>
          <div class="col-9">
            <label class="small fw-bold">Feedback</label>
            <input type="text" class="form-control" value="${fb}"
              onchange="window.saveTeacherGrade('${item.id}', 'feedback', this.value)">
          </div>
        </div>
      </div>
    `;
  }

  activity.innerHTML = `
    <div class="mx-auto" style="max-width: 96%;">
      <div class="card border-0 shadow-sm bg-white">
        <div class="card-body p-5">
          <div class="d-flex justify-content-between mb-4">
            <span class="badge bg-primary">Questão ${taskState.currentIndex + 1} / ${total}</span>
            <span class="badge bg-light text-dark border">Vale ${item.points} pts</span>
          </div>

          <div class="fs-4 mb-5 fw-bold text-dark lh-base">${item.statement}</div>

          <div class="p-4 bg-light rounded border mb-3">
            <label class="small text-muted fw-bold mb-2">SUA RESPOSTA:</label>
            ${inputHtml}
          </div>

          ${teacherAreaHtml}

          <div class="d-flex justify-content-between mt-5 border-top pt-4">
            <button class="btn btn-outline-secondary btn-lg"
              onclick="window.prevTaskStep()"
              ${taskState.currentIndex === 0 ? 'disabled' : ''}>Anterior</button>

            ${taskState.currentIndex === total - 1
              ? `<button class="btn btn-success btn-lg px-5 fw-bold"
                   onclick="window.finishTask()"
                   ${taskState.isSubmitted && role === 'student' ? 'disabled' : ''}>
                   ${taskState.isSubmitted ? 'Enviado' : 'Finalizar'}
                 </button>`
              : `<button class="btn btn-primary btn-lg px-5 fw-bold" onclick="window.nextTaskStep()">Próxima</button>`
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

export function updateTaskAnswer(id, val) { taskState.answers[id] = val; }
export function updateTaskFile(id, inp) { taskState.answers[id] = inp.files[0] ? inp.files[0].name : 'Arquivo'; }
export function nextTaskStep() { if (taskState.currentIndex < taskState.items.length - 1) { taskState.currentIndex++; renderTaskStep(); } }
export function prevTaskStep() { if (taskState.currentIndex > 0) { taskState.currentIndex--; renderTaskStep(); } }

export async function finishTask() {
  const role = ctx.getUserRole();
  const lesson = ctx.getCurrentLesson();
  const enrollment = ctx.getEnrollment();

  if (!lesson || !enrollment) return;

  // Professor só avalia; não "envia"
  if (['admin', 'professor'].includes(role)) {
    alert('Para professor, use o painel de correção.');
    return;
  }

  if (!confirm('Enviar?')) return;

  if (!enrollment.grades) enrollment.grades = { completed: [], scores: {}, tasks: {} };
  if (!enrollment.grades.tasks) enrollment.grades.tasks = {};
  if (!enrollment.grades.completed) enrollment.grades.completed = [];

  enrollment.grades.tasks[lesson.id] = {
    submitted_at: new Date().toISOString(),
    answers: taskState.answers,
    status: 'submitted'
  };

  if (!enrollment.grades.completed.includes(lesson.id)) enrollment.grades.completed.push(lesson.id);

  const { error } = await supabase
    .from('class_enrollments')
    .update({ grades: enrollment.grades })
    .eq('id', enrollment.id);

  if (error) {
    alert('Erro ao enviar: ' + error.message);
    return;
  }

  alert('Enviado!');
  taskState.isSubmitted = true;
  renderTaskStep();
  ctx.refreshUI();
}

export async function openGradingList() {
  const activity = document.getElementById('activity-area');
  if (!activity) return;

  activity.innerHTML = '<div class="text-center p-5"><div class="spinner-border"></div></div>';

  const { data: enrollments, error } = await supabase
    .from('class_enrollments')
    .select('id, grades, profiles:user_id(name, email)')
    .eq('class_id', ctx.classId);

  if (error) {
    activity.innerHTML = `<div class="alert alert-danger">Erro: ${error.message}</div>`;
    return;
  }

  gradingCache.students = enrollments || [];

  const lesson = ctx.getCurrentLesson();
  let listHtml = `
    <div class="d-flex align-items-center mb-3">
      <button class="btn btn-light me-3" onclick="window.openLessonById(${lesson.id})">
        <i class='bx bx-arrow-back'></i> Voltar
      </button>
      <h4 class="m-0">Entregas</h4>
    </div>
    <div class="list-group">
  `;

  gradingCache.students.forEach(enrol => {
    const task = enrol.grades?.tasks?.[lesson.id];
    if (task && task.status === 'submitted') {
      const score = enrol.grades?.scores?.[lesson.id] !== undefined ? enrol.grades.scores[lesson.id] : '-';
      listHtml += `
        <button class="list-group-item list-group-item-action d-flex justify-content-between p-3"
          onclick="window.gradeStudent('${enrol.id}')">
          <div>
            <h6 class="mb-0">${enrol.profiles?.name || 'Aluno'}</h6>
            <small>${enrol.profiles?.email || ''}</small>
          </div>
          <span class="badge ${score !== '-' ? 'bg-success' : 'bg-warning text-dark'}">Nota: ${score}</span>
        </button>
      `;
    }
  });

  listHtml += `</div>`;

  activity.innerHTML = `<div class="mx-auto bg-white p-4 rounded shadow-sm" style="max-width: 96%;">${listHtml}</div>`;
}

export function gradeStudent(enrollmentId) {
  const lesson = ctx.getCurrentLesson();
  const student = gradingCache.students.find(e => e.id === enrollmentId);
  if (!lesson || !student) return;

  gradingCache.currentStudent = student;

  const stTask = student.grades?.tasks?.[lesson.id];
  const items = (lesson.task_data && Array.isArray(lesson.task_data.items)) ? lesson.task_data.items : [];

  taskState = {
    items,
    currentIndex: 0,
    answers: stTask?.answers || {},
    isSubmitted: true,
    teacherScores: stTask?.item_scores || {},
    teacherFeedback: stTask?.item_feedback || {}
  };

  renderTaskStep();
}

export async function saveTeacherGrade(itemId, type, value) {
  const lesson = ctx.getCurrentLesson();
  const role = ctx.getUserRole();
  if (!lesson || !['admin', 'professor'].includes(role)) return;

  const student = gradingCache.currentStudent;
  if (!student) return;

  if (!student.grades) student.grades = { completed: [], scores: {}, tasks: {} };
  if (!student.grades.tasks) student.grades.tasks = {};
  if (!student.grades.scores) student.grades.scores = {};

  let task = student.grades.tasks[lesson.id] || {
    answers: {},
    item_scores: {},
    item_feedback: {},
    submitted_at: new Date().toISOString(),
    status: 'submitted'
  };

  if (!task.item_scores) task.item_scores = {};
  if (!task.item_feedback) task.item_feedback = {};

  if (type === 'score') task.item_scores[itemId] = parseFloat(value);
  if (type === 'feedback') task.item_feedback[itemId] = value;

  student.grades.tasks[lesson.id] = task;

  // Soma total
  let total = 0;
  Object.values(task.item_scores).forEach(v => total += (v || 0));
  student.grades.scores[lesson.id] = total;

  const { error } = await supabase
    .from('class_enrollments')
    .update({ grades: student.grades })
    .eq('id', student.id);

  if (error) alert('Erro ao salvar avaliação: ' + error.message);
}

// -------------------------
// INIT + exposição global (garante que onclicks funcionem)
// -------------------------
export function initActivities(options) {
  ctx = { ...ctx, ...options };

  // Quiz globals
  window.closeQuizDrawer = closeQuizDrawer;
  window.reopenQuizDrawer = () => {
    const lesson = ctx.getCurrentLesson();
    const enrollment = ctx.getEnrollment();
    const role = ctx.getUserRole();
    if (lesson && enrollment) openQuizDrawer(lesson, enrollment, role);
  };

  // Um objeto global compatível para chamadas no HTML/JS
  window.Quiz = {
    open: () => {
      const lesson = ctx.getCurrentLesson();
      const enrollment = ctx.getEnrollment();
      const role = ctx.getUserRole();
      if (lesson && enrollment) openQuizDrawer(lesson, enrollment, role);
    },
    close: closeQuizDrawer,
    start: startQuiz,
    select: selectQuizAnswer,
    next: nextQuiz,
    prev: prevQuiz,
    finish: finishQuiz
  };

  // Task globals (para os onclick nos templates)
  window.renderTaskIntro = renderTaskIntro;
  window.startTask = startTask;
  window.renderTaskStep = renderTaskStep;
  window.updateTaskAnswer = updateTaskAnswer;
  window.updateTaskFile = updateTaskFile;
  window.nextTaskStep = nextTaskStep;
  window.prevTaskStep = prevTaskStep;
  window.finishTask = finishTask;

  window.openGradingList = openGradingList;
  window.gradeStudent = gradeStudent;
  window.saveTeacherGrade = saveTeacherGrade;

  // Garante backdrop do quiz, sem mexer no HTML
  ensureQuizBackdrop();
}
