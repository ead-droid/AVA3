const COOLDOWN_HOURS = 48;
const MAX_ATTEMPTS = 2;

let drawerEl = null;
let drawerBodyEl = null;
let drawerHeaderTitleEl = null;
let backdropEl = null;

function ensureDrawer() {
  drawerEl = document.getElementById('quiz-drawer');
  drawerBodyEl = document.getElementById('quiz-drawer-content');
  drawerHeaderTitleEl = drawerEl?.querySelector('.quiz-drawer-header h5');

  if (!drawerEl || !drawerBodyEl) {
    console.error('Drawer não encontrado no HTML (quiz-drawer / quiz-drawer-content).');
    return false;
  }

  backdropEl = document.querySelector('.quiz-backdrop');
  if (!backdropEl) {
    backdropEl = document.createElement('div');
    backdropEl.className = 'quiz-backdrop';
    backdropEl.addEventListener('click', closeDrawer);
    document.body.appendChild(backdropEl);
  }

  return true;
}

function fmtDT(dt) {
  if (!dt) return '—';
  try { return new Date(dt).toLocaleString('pt-BR'); }
  catch { return '—'; }
}

function hoursToMs(h) { return h * 60 * 60 * 1000; }

function openDrawer(titleHtml) {
  if (!ensureDrawer()) return;

  if (drawerHeaderTitleEl) drawerHeaderTitleEl.innerHTML = titleHtml || `<i class='bx bx-joystick'></i> Atividade`;
  drawerEl.classList.add('open');
  backdropEl.classList.add('show');
}

export function closeDrawer() {
  if (!drawerEl) drawerEl = document.getElementById('quiz-drawer');
  if (!backdropEl) backdropEl = document.querySelector('.quiz-backdrop');

  drawerEl?.classList.remove('open');
  backdropEl?.classList.remove('show');
}

// ==========================
// QUIZ
// ==========================
export function openQuizDrawer({ supabase, classId, lesson, enrollment, role, onAfterSave } = {}) {
  if (!lesson || !enrollment) return;

  openDrawer(`<i class='bx bx-trophy'></i> Questionário`);

  const isTeacher = ['admin', 'professor'].includes(role);
  const now = new Date();

  const start = lesson.available_from ? new Date(lesson.available_from) : null;
  const end = lesson.available_until ? new Date(lesson.available_until) : null;

  // Tentativas
  if (!enrollment.grades) enrollment.grades = {};
  if (!enrollment.grades.quiz_attempts) enrollment.grades.quiz_attempts = {};

  const meta = enrollment.grades.quiz_attempts[String(lesson.id)] || { attempts: [] };
  const attempts = Array.isArray(meta.attempts) ? meta.attempts : [];
  const attemptsUsed = attempts.length;

  const lastAttempt = attemptsUsed ? attempts[attemptsUsed - 1] : null;
  const lastFinish = lastAttempt?.finished_at ? new Date(lastAttempt.finished_at) : (lastAttempt?.started_at ? new Date(lastAttempt.started_at) : null);
  const nextAllowed = lastFinish ? new Date(lastFinish.getTime() + hoursToMs(COOLDOWN_HOURS)) : null;

  // Bloqueios (aluno)
  let blockedMsg = '';
  if (!isTeacher) {
    if (start && now < start) blockedMsg = `Este questionário abre em ${fmtDT(start)}.`;
    else if (end && now > end) blockedMsg = `Este questionário foi encerrado em ${fmtDT(end)}.`;
    else if (attemptsUsed >= MAX_ATTEMPTS) blockedMsg = `Você já usou as ${MAX_ATTEMPTS} tentativas disponíveis.`;
    else if (nextAllowed && now < nextAllowed) blockedMsg = `A próxima tentativa estará disponível em ${fmtDT(nextAllowed)} (intervalo de ${COOLDOWN_HOURS}h).`;
  }

  // Normaliza questões (tenta aceitar formatos diferentes)
  const qRaw =
    lesson.quiz_data?.questions ||
    lesson.quiz_data?.items ||
    lesson.quiz_data?.data?.questions ||
    [];

  const questions = (Array.isArray(qRaw) ? qRaw : []).map((q, i) => ({
    id: String(q.id ?? i + 1),
    statement: q.statement ?? q.question ?? q.enunciado ?? '',
    options: q.options ?? q.alternatives ?? q.answers ?? [],
    correctIndex: (q.correctIndex ?? q.correct_option ?? q.answerIndex ?? q.gabarito),
    points: Number(q.points ?? q.valor ?? q.score ?? 1),
  }));

  // Render “capa”
  if (blockedMsg) {
    drawerBodyEl.innerHTML = quizHero({
      locked: true,
      title: lesson.title,
      start, end,
      attemptsUsed,
      nextAllowed,
      message: blockedMsg
    });
    return;
  }

  drawerBodyEl.innerHTML = quizHero({
    locked: false,
    title: lesson.title,
    start, end,
    attemptsUsed,
    nextAllowed,
    message: `Tentativas: ${attemptsUsed}/${MAX_ATTEMPTS}.`
  });

  const btnStart = drawerBodyEl.querySelector('[data-quiz-action="start"]');
  btnStart?.addEventListener('click', () => runQuiz());

  function quizHero({ locked, title, start, end, attemptsUsed, nextAllowed, message }) {
    return `
      <div class="quiz-wrapper">
        <div class="quiz-hero">
          <div class="quiz-hero-icon ${locked ? 'locked' : 'start'}">
            <i class='bx ${locked ? 'bx-lock-alt' : 'bx-play'}'></i>
          </div>
          <h3 class="fw-bold mb-2">${title || 'Questionário'}</h3>

          <div class="activity-info-grid">
            <div class="activity-info-card">
              <div class="activity-info-label">Início</div>
              <div class="activity-info-value">${start ? fmtDT(start) : 'Sem restrição'}</div>
            </div>
            <div class="activity-info-card">
              <div class="activity-info-label">Término</div>
              <div class="activity-info-value">${end ? fmtDT(end) : 'Sem restrição'}</div>
            </div>
            <div class="activity-info-card">
              <div class="activity-info-label">Tentativas</div>
              <div class="activity-info-value">${attemptsUsed}/${MAX_ATTEMPTS}</div>
            </div>
            <div class="activity-info-card">
              <div class="activity-info-label">Intervalo</div>
              <div class="activity-info-value">${COOLDOWN_HOURS}h</div>
            </div>
          </div>

          <p class="text-muted mt-3 mb-4">${message || ''}</p>

          ${locked ? `
            <button class="btn btn-outline-secondary rounded-pill px-4" onclick="window.closeQuizDrawer()">
              Fechar
            </button>
          ` : `
            <button class="btn btn-primary rounded-pill px-5 fw-bold" data-quiz-action="start">
              Iniciar tentativa
            </button>
          `}
        </div>
      </div>`;
  }

  function runQuiz() {
    // Registra início de tentativa (local)
    const startedAt = new Date().toISOString();
    const answers = {};

    let idx = 0;

    renderQuestion();

    function renderQuestion() {
      const q = questions[idx];
      const total = questions.length;
      const pct = total ? Math.round(((idx) / total) * 100) : 0;

      drawerBodyEl.innerHTML = `
        <div class="quiz-wrapper">
          <div class="quiz-progress-container">
            <div class="quiz-progress-fill" style="width:${pct}%"></div>
          </div>

          <div class="quiz-body">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <span class="badge bg-primary">Questão ${idx + 1}/${total}</span>
              <span class="badge bg-light text-dark border">Vale ${q?.points ?? 1} pts</span>
            </div>

            <div class="quiz-question-text">${q?.statement || 'Questão sem enunciado'}</div>

            <div class="mt-3" id="quiz-options">
              ${(q?.options || []).map((opt, i) => {
                const selected = answers[q.id] === i ? 'selected' : '';
                return `
                  <div class="quiz-option-label ${selected}" data-opt="${i}">
                    <div class="quiz-radio"></div>
                    <div>${opt}</div>
                  </div>`;
              }).join('')}
            </div>

            <div class="d-flex justify-content-between mt-4 pt-3 border-top">
              <button class="btn btn-outline-secondary rounded-pill px-4" ${idx === 0 ? 'disabled' : ''} data-quiz-nav="prev">
                Anterior
              </button>

              ${idx === total - 1 ? `
                <button class="btn btn-success rounded-pill px-5 fw-bold" data-quiz-nav="finish">
                  Finalizar
                </button>
              ` : `
                <button class="btn btn-primary rounded-pill px-5 fw-bold" data-quiz-nav="next">
                  Próxima
                </button>
              `}
            </div>
          </div>
        </div>`;

      // Seleção de opção
      drawerBodyEl.querySelectorAll('[data-opt]').forEach(el => {
        el.addEventListener('click', () => {
          const opt = Number(el.getAttribute('data-opt'));
          answers[q.id] = opt;
          renderQuestion();
        });
      });

      // Navegação
      drawerBodyEl.querySelector('[data-quiz-nav="prev"]')?.addEventListener('click', () => { idx--; renderQuestion(); });
      drawerBodyEl.querySelector('[data-quiz-nav="next"]')?.addEventListener('click', () => { idx++; renderQuestion(); });
      drawerBodyEl.querySelector('[data-quiz-nav="finish"]')?.addEventListener('click', finishQuiz);
    }

    async function finishQuiz() {
      // Calcula score (se tiver correctIndex)
      let totalPts = 0;
      let score = 0;

      questions.forEach(q => {
        totalPts += (q.points || 0);
        const ci = (typeof q.correctIndex === 'number') ? q.correctIndex : (Number.isFinite(Number(q.correctIndex)) ? Number(q.correctIndex) : null);
        if (ci !== null && answers[q.id] === ci) score += (q.points || 0);
      });

      // Salva tentativa (persistente)
      const finishedAt = new Date().toISOString();

      const newAttempt = {
        started_at: startedAt,
        finished_at: finishedAt,
        score,
        total: totalPts,
        answers
      };

      const updated = structuredClone(enrollment);

      if (!updated.grades) updated.grades = {};
      if (!updated.grades.completed) updated.grades.completed = [];
      if (!updated.grades.scores) updated.grades.scores = {};
      if (!updated.grades.quiz_attempts) updated.grades.quiz_attempts = {};

      const key = String(lesson.id);
      const currentMeta = updated.grades.quiz_attempts[key] || { attempts: [] };
      const arr = Array.isArray(currentMeta.attempts) ? currentMeta.attempts : [];

      arr.push(newAttempt);

      updated.grades.quiz_attempts[key] = { attempts: arr };
      updated.grades.scores[key] = score;

      if (!updated.grades.completed.includes(lesson.id)) updated.grades.completed.push(lesson.id);

      await supabase.from('class_enrollments')
        .update({ grades: updated.grades })
        .eq('id', updated.id);

      // Resultado
      drawerBodyEl.innerHTML = `
        <div class="quiz-wrapper">
          <div class="quiz-hero">
            <div class="quiz-hero-icon">
              <i class='bx bx-check'></i>
            </div>
            <h3 class="fw-bold mb-2">Tentativa finalizada</h3>

            <div class="quiz-stat-grid">
              <div class="quiz-stat-box">
                <span class="quiz-stat-val">${score}</span>
                <span class="quiz-stat-lbl">Pontos</span>
              </div>
              <div class="quiz-stat-box">
                <span class="quiz-stat-val">${totalPts}</span>
                <span class="quiz-stat-lbl">Total</span>
              </div>
            </div>

            <p class="text-muted mb-4">
              Tentativas usadas: ${arr.length}/${MAX_ATTEMPTS}.<br>
              ${arr.length < MAX_ATTEMPTS ? `Próxima tentativa após ${COOLDOWN_HOURS}h.` : `Sem novas tentativas.`}
            </p>

            <button class="btn btn-primary rounded-pill px-5 fw-bold" onclick="window.closeQuizDrawer()">
              Fechar
            </button>
          </div>
        </div>`;

      if (typeof onAfterSave === 'function') onAfterSave(updated);
    }
  }
}

// ==========================
// TASK
// ==========================
export function openTaskDrawer({ supabase, classId, lesson, enrollment, role, onAfterSave } = {}) {
  if (!lesson || !enrollment) return;

  openDrawer(`<i class='bx bx-task'></i> Tarefa`);

  const isTeacher = ['admin', 'professor'].includes(role);
  const now = new Date();

  const start = lesson.available_from ? new Date(lesson.available_from) : null;
  const end = lesson.available_until ? new Date(lesson.available_until) : null;

  let isLocked = false;
  let lockMsg = '';

  if (start && now < start) { isLocked = true; lockMsg = `Abre em: ${fmtDT(start)}`; }
  else if (end && now > end) { isLocked = true; lockMsg = `Fechado em: ${fmtDT(end)}`; }

  if (isLocked && !isTeacher) {
    drawerBodyEl.innerHTML = `
      <div class="quiz-wrapper">
        <div class="quiz-hero">
          <div class="quiz-hero-icon locked"><i class='bx bx-lock-alt'></i></div>
          <h3 class="fw-bold mb-2">${lesson.title || 'Tarefa'}</h3>

          <div class="activity-info-grid">
            <div class="activity-info-card">
              <div class="activity-info-label">Início</div>
              <div class="activity-info-value">${start ? fmtDT(start) : 'Sem restrição'}</div>
            </div>
            <div class="activity-info-card">
              <div class="activity-info-label">Término</div>
              <div class="activity-info-value">${end ? fmtDT(end) : 'Sem restrição'}</div>
            </div>
          </div>

          <p class="text-muted mt-3">${lockMsg}</p>
          <button class="btn btn-outline-secondary rounded-pill px-4" onclick="window.closeQuizDrawer()">Fechar</button>
        </div>
      </div>`;
    return;
  }

  // Itens
  let items = [];
  let instructions = lesson.description || '';

  if (lesson.task_data) {
    items = lesson.task_data.items || [];
    instructions = lesson.task_data.instructions || instructions;
  }

  const savedTask = enrollment.grades?.tasks?.[lesson.id] || null;

  const state = {
    items,
    idx: 0,
    answers: savedTask?.answers || {},
    isSubmitted: !!savedTask,
    teacherScores: savedTask?.item_scores || {},
    teacherFeedback: savedTask?.item_feedback || {}
  };

  renderIntro();

  function renderIntro() {
    drawerBodyEl.innerHTML = `
      <div class="quiz-wrapper">
        <div class="quiz-hero" style="text-align:left">
          <h3 class="fw-bold mb-2">${lesson.title || 'Tarefa'}</h3>

          <div class="activity-info-grid">
            <div class="activity-info-card">
              <div class="activity-info-label">Início</div>
              <div class="activity-info-value">${start ? fmtDT(start) : 'Sem restrição'}</div>
            </div>
            <div class="activity-info-card">
              <div class="activity-info-label">Término</div>
              <div class="activity-info-value">${end ? fmtDT(end) : 'Sem restrição'}</div>
            </div>
            <div class="activity-info-card">
              <div class="activity-info-label">Status</div>
              <div class="activity-info-value">${state.isSubmitted ? 'Enviado' : 'Não enviado'}</div>
            </div>
            <div class="activity-info-card">
              <div class="activity-info-label">Itens</div>
              <div class="activity-info-value">${state.items.length}</div>
            </div>
          </div>

          ${isLocked && isTeacher ? `<div class="alert alert-warning mt-3">Modo Professor: Fora do prazo (${lockMsg})</div>` : ''}

          <div class="mt-3 p-3 bg-light rounded border">${instructions || 'Sem instruções.'}</div>

          <div class="mt-4 d-flex gap-2">
            <button class="btn btn-primary rounded-pill px-5 fw-bold" ${state.items.length ? '' : 'disabled'} data-task-action="start">
              ${state.isSubmitted ? 'Ver envio' : 'Iniciar'}
            </button>
            <button class="btn btn-outline-secondary rounded-pill px-4" onclick="window.closeQuizDrawer()">Fechar</button>
          </div>
        </div>
      </div>`;

    drawerBodyEl.querySelector('[data-task-action="start"]')?.addEventListener('click', () => {
      state.idx = 0;
      renderStep();
    });
  }

  function renderStep() {
    const item = state.items[state.idx];
    const total = state.items.length;

    const answer = state.answers[item.id] || '';

    const inputHtml = item.type === 'text'
      ? `<textarea class="form-control mb-3 fs-5" rows="6" ${state.isSubmitted && !isTeacher ? 'disabled' : ''} data-task-input="text">${answer}</textarea>`
      : `<input type="file" class="form-control mb-3" ${state.isSubmitted && !isTeacher ? 'disabled' : ''} data-task-input="file">`;

    let teacherHtml = '';
    if (isTeacher) {
      const score = state.teacherScores?.[item.id] || 0;
      const fb = state.teacherFeedback?.[item.id] || '';
      teacherHtml = `
        <div class="mt-4 p-4 rounded bg-warning bg-opacity-10 border border-warning">
          <h6 class="fw-bold">Avaliação</h6>
          <div class="row g-2">
            <div class="col-3">
              <label class="small fw-bold">Nota</label>
              <input type="number" class="form-control" value="${score}" max="${item.points}" data-teacher="score">
            </div>
            <div class="col-9">
              <label class="small fw-bold">Feedback</label>
              <input type="text" class="form-control" value="${fb}" data-teacher="feedback">
            </div>
          </div>
          <div class="mt-3">
            <button class="btn btn-sm btn-success fw-bold" data-task-action="save-teacher">Salvar avaliação</button>
          </div>
        </div>`;
    }

    drawerBodyEl.innerHTML = `
      <div class="quiz-wrapper">
        <div class="quiz-body">
          <div class="d-flex justify-content-between mb-3">
            <span class="badge bg-primary">Item ${state.idx + 1}/${total}</span>
            <span class="badge bg-light text-dark border">Vale ${item.points} pts</span>
          </div>

          <div class="fs-5 mb-3 fw-bold text-dark lh-base">${item.statement || ''}</div>

          <div class="p-3 bg-light rounded border">
            <label class="small text-muted fw-bold mb-2">SUA RESPOSTA</label>
            ${inputHtml}
          </div>

          ${teacherHtml}

          <div class="d-flex justify-content-between mt-4 pt-3 border-top">
            <button class="btn btn-outline-secondary rounded-pill px-4" ${state.idx === 0 ? 'disabled' : ''} data-task-nav="prev">
              Anterior
            </button>

            ${state.idx === total - 1 ? `
              <button class="btn btn-success rounded-pill px-5 fw-bold" data-task-action="finish" ${state.isSubmitted && !isTeacher ? 'disabled' : ''}>
                ${state.isSubmitted ? 'Enviado' : 'Finalizar'}
              </button>
            ` : `
              <button class="btn btn-primary rounded-pill px-5 fw-bold" data-task-nav="next">
                Próxima
              </button>
            `}
          </div>
        </div>
      </div>`;

    // Captura input
    const txt = drawerBodyEl.querySelector('[data-task-input="text"]');
    if (txt) {
      txt.addEventListener('input', () => {
        state.answers[item.id] = txt.value;
      });
    }

    const file = drawerBodyEl.querySelector('[data-task-input="file"]');
    if (file) {
      file.addEventListener('change', () => {
        state.answers[item.id] = file.files?.[0]?.name || 'Arquivo';
      });
    }

    // Navegação
    drawerBodyEl.querySelector('[data-task-nav="prev"]')?.addEventListener('click', () => { state.idx--; renderStep(); });
    drawerBodyEl.querySelector('[data-task-nav="next"]')?.addEventListener('click', () => { state.idx++; renderStep(); });

    // Finalizar (aluno)
    drawerBodyEl.querySelector('[data-task-action="finish"]')?.addEventListener('click', async () => {
      if (isTeacher) return; // professor não “envia” por aqui
      const ok = confirm('Enviar tarefa?');
      if (!ok) return;

      const updated = structuredClone(enrollment);
      if (!updated.grades) updated.grades = {};
      if (!updated.grades.tasks) updated.grades.tasks = {};
      if (!updated.grades.completed) updated.grades.completed = [];

      updated.grades.tasks[lesson.id] = {
        submitted_at: new Date().toISOString(),
        answers: state.answers,
        status: 'submitted'
      };

      if (!updated.grades.completed.includes(lesson.id)) updated.grades.completed.push(lesson.id);

      await supabase.from('class_enrollments')
        .update({ grades: updated.grades })
        .eq('id', updated.id);

      state.isSubmitted = true;
      if (typeof onAfterSave === 'function') onAfterSave(updated);

      renderStep();
    });

    // Salvar avaliação (professor)
    drawerBodyEl.querySelector('[data-task-action="save-teacher"]')?.addEventListener('click', async () => {
      if (!isTeacher) return;

      const scoreEl = drawerBodyEl.querySelector('[data-teacher="score"]');
      const fbEl = drawerBodyEl.querySelector('[data-teacher="feedback"]');

      const score = Number(scoreEl?.value || 0);
      const fb = String(fbEl?.value || '');

      // salva no enrollment do aluno (no seu caso, você está corrigindo a própria matrícula logada;
      // se você quiser o "Painel de Correção", a gente mantém fora daqui depois)
      const updated = structuredClone(enrollment);

      if (!updated.grades) updated.grades = {};
      if (!updated.grades.tasks) updated.grades.tasks = {};
      if (!updated.grades.scores) updated.grades.scores = {};

      const t = updated.grades.tasks[lesson.id] || { answers: state.answers, item_scores: {}, item_feedback: {}, submitted_at: new Date().toISOString() };
      if (!t.item_scores) t.item_scores = {};
      if (!t.item_feedback) t.item_feedback = {};

      t.item_scores[item.id] = score;
      t.item_feedback[item.id] = fb;

      updated.grades.tasks[lesson.id] = t;

      // soma total
      let total = 0;
      Object.values(t.item_scores).forEach(v => total += Number(v || 0));
      updated.grades.scores[lesson.id] = total;

      await supabase.from('class_enrollments')
        .update({ grades: updated.grades })
        .eq('id', updated.id);

      // atualiza estado local
      state.teacherScores[item.id] = score;
      state.teacherFeedback[item.id] = fb;

      if (typeof onAfterSave === 'function') onAfterSave(updated);

      alert('Avaliação salva.');
    });
  }
}
