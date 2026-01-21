import { supabase as defaultSupabase } from './supabaseClient.js';

let drawerReady = false;
let ctx = null;
let lessonRef = null;
let mode = null; // 'QUIZ' | 'TAREFA'

let quizState = null;
let taskState = null;

const MAX_ATTEMPTS = 2;
const COOLDOWN_HOURS = 48;

export function open(lesson, context) {
  lessonRef = lesson;
  ctx = context || {};
  mode = String(lesson?.type || '').toUpperCase();

  ensureDrawer();
  setHeader(
    mode === 'QUIZ' ? 'Questionário' :
    mode === 'TAREFA' ? 'Tarefa' : 'Atividade',
    mode
  );

  showDrawer();

  if (mode === 'QUIZ') renderQuizIntro();
  else if (mode === 'TAREFA') renderTaskIntro();
  else setContent(`<div class="p-4 text-muted">Tipo de atividade não suportado.</div>`);
}

export function close() {
  document.getElementById('quiz-drawer')?.classList.remove('open');
  document.getElementById('quiz-backdrop')?.classList.remove('show');
}

export function isOpen() {
  return document.getElementById('quiz-drawer')?.classList.contains('open');
}

/* ---------------- Drawer ---------------- */
function ensureDrawer() {
  if (drawerReady) return;

  // Backdrop
  if (!document.getElementById('quiz-backdrop')) {
    const bd = document.createElement('div');
    bd.id = 'quiz-backdrop';
    bd.className = 'quiz-backdrop';
    document.body.appendChild(bd);
  }
  document.getElementById('quiz-backdrop')?.addEventListener('click', close);

  // Drawer (se seu HTML já tem #quiz-drawer e #quiz-drawer-content, perfeito)
  if (!document.getElementById('quiz-drawer')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="quiz-drawer" class="quiz-drawer">
        <div class="quiz-drawer-header">
          <h5 class="mb-0 fw-bold text-primary"><i class='bx bx-layer'></i> Atividade</h5>
          <button class="btn-close" aria-label="Fechar"></button>
        </div>
        <div id="quiz-drawer-content" class="quiz-drawer-body"></div>
      </div>
    `);
  }

  document.querySelector('#quiz-drawer .btn-close')?.addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) close();
  });

  drawerReady = true;
}

function showDrawer() {
  document.getElementById('quiz-drawer')?.classList.add('open');
  document.getElementById('quiz-backdrop')?.classList.add('show');
}

function setHeader(title, type) {
  const h5 = document.querySelector('#quiz-drawer .quiz-drawer-header h5');
  if (!h5) return;

  const icon =
    type === 'QUIZ' ? 'bx-joystick' :
    type === 'TAREFA' ? 'bx-task' :
    'bx-layer';

  h5.innerHTML = `<i class='bx ${icon}'></i> ${title}`;
}

function setContent(html) {
  const content = document.getElementById('quiz-drawer-content');
  if (content) content.innerHTML = html;
}

/* ---------------- Helpers ---------------- */
function getSupabase() { return ctx?.supabase || defaultSupabase; }
function getEnrollment() { return ctx?.getEnrollment ? ctx.getEnrollment() : window.currentEnrollment; }
function setEnrollment(e) { ctx?.setEnrollment ? ctx.setEnrollment(e) : (window.currentEnrollment = e); }
function isAdmin() { return ['admin', 'professor'].includes(ctx?.role || 'student'); }

function parseDate(d) { try { return d ? new Date(d) : null; } catch { return null; } }
function fmtDate(d) { return d ? d.toLocaleString() : '-'; }

function getAvailability(lesson) {
  const now = new Date();
  const start = parseDate(lesson?.available_from);
  const end = parseDate(lesson?.available_until);

  let locked = false;
  let msg = '';

  if (start && now < start) { locked = true; msg = `Abre em: ${fmtDate(start)}`; }
  else if (end && now > end) { locked = true; msg = `Fechado em: ${fmtDate(end)}`; }

  return { start, end, locked, msg };
}

function getAttemptInfo(grades, lessonId) {
  const attemptsObj = grades?.attempts || {};
  const metaObj = grades?.attempt_meta || {};
  const attempts = Number(attemptsObj[lessonId] || 0);
  const lastAttemptAt = metaObj?.[lessonId]?.last_attempt_at ? new Date(metaObj[lessonId].last_attempt_at) : null;
  return { attempts, lastAttemptAt };
}

function remainingCooldown(lastAttemptAt) {
  if (!lastAttemptAt) return null;
  const ms = COOLDOWN_HOURS * 60 * 60 * 1000;
  const until = new Date(lastAttemptAt.getTime() + ms);
  const diff = until.getTime() - Date.now();
  if (diff <= 0) return null;
  return { until };
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function lockScreen(title, msg) {
  return `
    <div class="text-center p-5">
      <i class='bx bx-lock display-1 text-danger'></i>
      <h4 class="fw-bold mt-3">${escapeHtml(title)}</h4>
      <p class="text-muted">${escapeHtml(msg || '')}</p>
      <button class="btn btn-outline-dark mt-3" id="btn-lock-close">Fechar</button>
    </div>
  `;
}

/* =========================================================
   QUIZ  (2 tentativas + 48h)
   ========================================================= */
function renderQuizIntro() {
  const enrollment = getEnrollment();
  const grades = enrollment?.grades || {};
  const { start, end, locked, msg } = getAvailability(lessonRef);

  if (locked && !isAdmin()) {
    setContent(lockScreen('Questionário indisponível', msg));
    document.getElementById('btn-lock-close')?.addEventListener('click', close);
    return;
  }

  const quizData = lessonRef?.quiz_data || null;
  const allQuestions = Array.isArray(quizData) ? quizData : (quizData?.questions || []);
  const drawCount = Number(quizData?.settings?.drawCount || allQuestions.length || 0);
  const questionsToAsk = Math.min(allQuestions.length, drawCount);
  const points = Number(lessonRef?.points || 100);

  const { attempts, lastAttemptAt } = getAttemptInfo(grades, lessonRef.id);
  const cooldown = remainingCooldown(lastAttemptAt);

  let blockMsg = '';
  if (!isAdmin()) {
    if (attempts >= MAX_ATTEMPTS) blockMsg = `Você já realizou ${MAX_ATTEMPTS} tentativas.`;
    else if (attempts > 0 && cooldown) blockMsg = `Próxima tentativa liberada em: ${fmtDate(cooldown.until)}`;
  }

  setContent(`
    <h3 class="fw-bold mb-3">${escapeHtml(lessonRef.title || 'Questionário')}</h3>

    <div class="row g-3">
      <div class="col-6">
        <div class="p-3 bg-white border rounded text-center">
          <small class="text-muted fw-bold">Questões</small>
          <div class="fs-4 fw-bold text-primary">${questionsToAsk || 0}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="p-3 bg-white border rounded text-center">
          <small class="text-muted fw-bold">Pontos</small>
          <div class="fs-4 fw-bold text-success">${points}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="p-3 bg-white border rounded text-center">
          <small class="text-muted fw-bold">Tentativas</small>
          <div class="fw-bold">${attempts}/${MAX_ATTEMPTS}</div>
        </div>
      </div>
      <div class="col-6">
        <div class="p-3 bg-white border rounded text-center">
          <small class="text-muted fw-bold">Janela</small>
          <div class="small fw-bold">${start ? fmtDate(start) : '—'}<br>${end ? fmtDate(end) : '—'}</div>
        </div>
      </div>
    </div>

    <div class="mt-3">
      ${blockMsg
        ? `<div class="alert alert-warning mb-0">${escapeHtml(blockMsg)}</div>`
        : (questionsToAsk > 0
            ? `<button class="btn btn-primary btn-lg rounded-pill px-5 fw-bold w-100" id="btn-quiz-start">Iniciar</button>`
            : `<div class="alert alert-warning mb-0">Sem questões configuradas.</div>`)
      }
    </div>

    <div class="text-muted small text-center mt-3">
      Regras: máximo ${MAX_ATTEMPTS} tentativas, com intervalo de ${COOLDOWN_HOURS}h entre elas.
    </div>
  `);

  document.getElementById('btn-quiz-start')?.addEventListener('click', () => startQuiz(quizData));
}

function startQuiz(quizData) {
  const enrollment = getEnrollment();
  const grades = enrollment?.grades || {};
  const { locked, msg } = getAvailability(lessonRef);

  if (locked && !isAdmin()) {
    setContent(lockScreen('Questionário indisponível', msg));
    document.getElementById('btn-lock-close')?.addEventListener('click', close);
    return;
  }

  const { attempts, lastAttemptAt } = getAttemptInfo(grades, lessonRef.id);
  const cooldown = remainingCooldown(lastAttemptAt);

  if (!isAdmin()) {
    if (attempts >= MAX_ATTEMPTS) {
      setContent(lockScreen('Tentativas esgotadas', `Você já usou ${MAX_ATTEMPTS} tentativas.`));
      document.getElementById('btn-lock-close')?.addEventListener('click', close);
      return;
    }
    if (attempts > 0 && cooldown) {
      setContent(lockScreen('Aguarde para tentar novamente', `Liberado em: ${fmtDate(cooldown.until)}`));
      document.getElementById('btn-lock-close')?.addEventListener('click', close);
      return;
    }
  }

  const allQuestions = Array.isArray(quizData) ? quizData : (quizData?.questions || []);
  const drawCount = Number(quizData?.settings?.drawCount || allQuestions.length || 0);
  const limit = Math.min(allQuestions.length, drawCount);

  if (!allQuestions.length) {
    setContent(`<div class="alert alert-warning">Sem questões configuradas.</div>`);
    return;
  }

  const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
  const questions = shuffled.slice(0, limit);

  quizState = {
    questions,
    currentIndex: 0,
    answers: {},
    totalPoints: Number(lessonRef?.points || 100)
  };

  renderQuizStep();
}

function renderQuizStep() {
  const q = quizState.questions[quizState.currentIndex];
  const total = quizState.questions.length;
  const progress = Math.round(((quizState.currentIndex + 1) / total) * 100);

  const options = Array.isArray(q?.options) ? q.options : [];
  const selected = quizState.answers[quizState.currentIndex];

  const optionsHtml = options.map((opt, idx) => {
    const text = (opt && typeof opt === 'object') ? (opt.text ?? JSON.stringify(opt)) : String(opt);
    const isSel = selected === idx;

    return `
      <div class="card mb-2 ${isSel ? 'border-primary bg-primary bg-opacity-10' : ''}" data-idx="${idx}">
        <div class="card-body py-3 d-flex align-items-center">
          <div class="rounded-circle border ${isSel ? 'bg-primary border-primary' : 'bg-white'}" style="width:20px;height:20px;"></div>
          <span class="ms-3 fw-medium">${escapeHtml(text)}</span>
        </div>
      </div>
    `;
  }).join('');

  setContent(`
    <div class="d-flex justify-content-between align-items-center mb-3">
      <span class="badge bg-light text-dark border">Q ${quizState.currentIndex + 1}/${total}</span>
      <div class="progress w-50" style="height: 6px;">
        <div class="progress-bar" style="width: ${progress}%"></div>
      </div>
    </div>

    <h5 class="fw-bold mb-4 lh-base">${escapeHtml(q?.text || q?.title || 'Questão')}</h5>
    <div class="mb-4" id="quiz-options">${optionsHtml}</div>

    <div class="d-flex justify-content-between
