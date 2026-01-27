/* ============================================================
   AVA3 • classroom.js (MOCK + LAYOUT)
   - Contato direto via MODAL (sem card na página)
   - Restrição sequencial: bloqueados visíveis (cinza), sem clique
   - Quiz/Tarefa: 1 questão/etapa por vez (wizard)
   ============================================================ */

const STORAGE_KEY = "ava3.classroom.mock.v4";

/* ===================== MOCK DATA ===================== */
const MOCK = {
  settings: {
    progressionMode: "sequential", // "sequential" | "free"
    progressionScope: "course",    // "course" | "module"
  },

  header: { className: "Turma 2026/1 • Noite", courseTitle: "Auxiliar de Almoxarifado" },

  staff: [
    { id: "t1", name: "Prof. Ricardo Santos", role: "Professor" },
    { id: "t2", name: "Tutor(a) Elisângela Lima", role: "Tutoria" },
    { id: "t3", name: "Tutor(a) Endrigo Silva", role: "Tutoria" },
  ],

  modules: [
    {
      id: "m1",
      title: "Módulo 1 — Boas-vindas e organização",
      sections: [
        {
          title: "Seção 1.1 — Introdução",
          lessons: [
            {
              id: "l1",
              type: "VIDEO_AULA",
              title: "1. Boas-vindas e apresentação (vídeo)",
              description: "Abertura do curso, organização e dinâmica das conclusões.",
              videoUrl: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
            },
            {
              id: "l2",
              type: "PDF",
              title: "2. Guia do estudante (PDF)",
              description: "Leia o guia para entender a dinâmica do curso.",
              pdfUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            },
            {
              id: "l3",
              type: "AUDIO",
              title: "3. Áudio: Dicas rápidas (podcast)",
              description: "Um exemplo de aula em áudio (mock).",
              audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            },
            {
              id: "l4",
              type: "TEXTO",
              title: "4. Texto: Checklist de organização (leitura)",
              description: "Exemplo de conteúdo textual estruturado.",
              textHtml: `
                <h4>Checklist de organização do almoxarifado</h4>
                <p>Antes de iniciar, verifique:</p>
                <ul>
                  <li>Separação de áreas (recebimento / armazenagem / expedição)</li>
                  <li>Identificação e sinalização de corredores</li>
                  <li>Endereçamento e padrão de etiquetas</li>
                  <li>Rotina de conferência e registro</li>
                </ul>
                <div class="alert alert-light border">
                  <b>Dica:</b> padronização reduz erros e acelera inventários.
                </div>
              `,
            },
            {
              id: "l5",
              type: "QUIZ",
              title: "5. Quiz diagnóstico (modelo)",
              description: "Questionário rápido (mock).",
              points: 10,
              quiz: {
                questions: [
                  { q: "O que é conferência documental?", options: ["Validação de notas/pedidos/itens", "Guardar produtos", "Somente expedição"], correct: 0 },
                  { q: "Qual documento é comum no recebimento?", options: ["Nota fiscal", "Carteira de trabalho", "Passaporte"], correct: 0 },
                ],
              },
            },
          ],
        },
        {
          title: "Seção 1.2 — Avaliações",
          lessons: [
            {
              id: "l6",
              type: "TASK",
              title: "6. Tarefa: Plano de estudos (modelo)",
              description: "Monte um plano simples de estudos.",
              points: 20,
              task: {
                instructions: [
                  "Defina 3 dias/semana para estudar.",
                  "Inclua horário e meta.",
                  "Envie como texto (mock).",
                ],
                questions: [
                  { label: "1) Quais dias e horários você vai estudar?", type: "textarea", placeholder: "Ex.: seg/qua/sex, 19h–20h..." },
                  { label: "2) Qual sua meta de aprendizado para esta semana?", type: "textarea", placeholder: "Ex.: concluir Módulo 1 + quiz..." },
                  { label: "3) Como você vai acompanhar seu progresso?", type: "textarea", placeholder: "Ex.: checklist diário, agenda, etc." },
                ]
              },
            },
          ],
        },
      ],
    },

    {
      id: "m2",
      title: "Módulo 2 — Recebimento e expedição",
      sections: [
        {
          title: "Seção 2.1 — Conceitos",
          lessons: [
            {
              id: "l7",
              type: "VIDEO_AULA",
              title: "1. Conferência e documentação (vídeo)",
              description: "Conceitos básicos do recebimento e conferência.",
              videoUrl: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
            },
            {
              id: "l8",
              type: "QUIZ",
              title: "2. Quiz: Conferência (modelo)",
              description: "Fixação (mock).",
              points: 15,
              quiz: {
                questions: [
                  { q: "Função do recebimento:", options: ["Garantir entrada correta e registrada", "Apenas guardar", "Somente vender"], correct: 0 },
                  { q: "Conferência física compara:", options: ["Itens/volumes x documento", "Preço x salário", "E-mail x telefone"], correct: 0 },
                ],
              },
            },
          ],
        },
      ],
    },
  ],

  mural: [
    { id: "p1", color: "post-yellow", title: "Boas-vindas!", body: "Leia o Guia do Estudante antes do Módulo 2.", tag: "AVISO • 02/02", isNew: true },
    { id: "p2", color: "post-blue", title: "Aula ao vivo", body: "Segunda, terça e quarta • 18h às 20h.", tag: "EVENTO • 05/02", isNew: false },
    { id: "p3", color: "post-green", title: "Material", body: "Checklist de recebimento estará no Módulo 2.", tag: "MATERIAL", isNew: false },
  ],

  commentsByLesson: {
    l1: [
      {
        id: "c1",
        author: "Gabriel Almeida",
        initials: "GA",
        time: "há 2h",
        text: "Prof, qual a diferença entre recebimento e conferência documental?",
        replies: [
          { id: "r1", author: "Prof. Ricardo Santos", initials: "RS", time: "há 1h", text: "Recebimento é o processo; conferência documental é uma etapa de validação." },
        ],
      },
    ],
  },

  grades: [
    { moduleId: "m1", lessonId: "l5", title: "Quiz diagnóstico", value: 10, score: 7 },
    { moduleId: "m1", lessonId: "l6", title: "Tarefa: Plano de estudos", value: 20, score: "NSA" },
    { moduleId: "m2", lessonId: "l8", title: "Quiz: Conferência", value: 15, score: "—" },
  ],

  calendar: {
    monthLabel: "Fevereiro 2026",
    days: Array.from({ length: 28 }, (_, i) => ({ n: i + 1, muted: false, events: [] })),
    upcoming: [
      { when: "02/02 • 18:00", title: "Abertura do curso", desc: "Início das aulas", badge: "Encontro", badgeClass: "bg-primary" },
      { when: "07/02 • 23:59", title: "Prazo: Quiz diagnóstico", desc: "Entregar até o final do dia", badge: "Prazo", badgeClass: "bg-warning text-dark" },
    ],
  },
};

/* ===================== STATE ===================== */
function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
}
function saveState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

const DEFAULT_STATE = {
  completed: [],
  currentLessonId: null,
  muralOrder: null,
  quizDone: {},
  quizAnswers: {},
  taskAnswers: {},
  _comments: {},
};
const STATE = Object.assign({}, DEFAULT_STATE, loadState() || {});
const completedSet = new Set(STATE.completed);

const $ = (id) => document.getElementById(id);

const ICONS = {
  VIDEO_AULA: "bx-play-circle",
  PDF: "bxs-file-pdf",
  AUDIO: "bx-music",
  TEXTO: "bx-book-open",
  QUIZ: "bx-trophy",
  TASK: "bx-edit",
  default: "bx-file",
};

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function toEmbedUrl(url) {
  if (!url) return "";
  if (url.includes("youtube.com/watch")) return url.replace("watch?v=", "embed/");
  if (url.includes("youtu.be/")) {
    const code = url.split("youtu.be/")[1].split("?")[0];
    return `https://www.youtube.com/embed/${code}`;
  }
  return url;
}

function isCompleted(lessonId) { return completedSet.has(lessonId); }
function markCompleted(lessonId) {
  completedSet.add(lessonId);
  STATE.completed = Array.from(completedSet);
  saveState(STATE);
}
function setCurrentLesson(lessonId) {
  STATE.currentLessonId = lessonId;
  saveState(STATE);
}

/* ===================== FLAT LESSONS ===================== */
function getAllLessonsFlat() {
  const flat = [];
  for (const mod of MOCK.modules) {
    for (const sec of mod.sections) {
      for (const l of sec.lessons) {
        flat.push({ ...l, moduleId: mod.id, moduleTitle: mod.title, sectionTitle: sec.title });
      }
    }
  }
  return flat;
}
const FLAT_LESSONS = getAllLessonsFlat();
function getLessonById(id) { return FLAT_LESSONS.find((l) => l.id === id) || null; }

/* ===================== RESTRIÇÃO (SEQUENCIAL) ===================== */
function getProgressionSettings() {
  const mode = MOCK.settings?.progressionMode || "free";
  const scope = MOCK.settings?.progressionScope || "course";
  return { mode, scope };
}
function computeGateCourse() {
  const idx = FLAT_LESSONS.findIndex((l) => !isCompleted(l.id));
  return idx === -1 ? (FLAT_LESSONS.length - 1) : idx;
}
function computeGateByModule(moduleId) {
  const lessons = FLAT_LESSONS.filter((l) => l.moduleId === moduleId);
  const idx = lessons.findIndex((l) => !isCompleted(l.id));
  return idx === -1 ? (lessons.length - 1) : idx;
}
function isAccessible(lesson) {
  const { mode, scope } = getProgressionSettings();
  if (mode !== "sequential") return true;

  if (scope === "course") {
    const gate = computeGateCourse();
    const myIndex = FLAT_LESSONS.findIndex((l) => l.id === lesson.id);
    return myIndex <= gate;
  }
  if (scope === "module") {
    const lessons = FLAT_LESSONS.filter((l) => l.moduleId === lesson.moduleId);
    const gate = computeGateByModule(lesson.moduleId);
    const myIndex = lessons.findIndex((l) => l.id === lesson.id);
    return myIndex <= gate;
  }
  return true;
}
function firstAccessibleLessonId() {
  const first = FLAT_LESSONS.find((l) => isAccessible(l));
  return first ? first.id : null;
}
function getAccessibleLessonsList() {
  return FLAT_LESSONS.filter((l) => isAccessible(l));
}

/* ===================== PROGRESS ===================== */
function getProgress() {
  const total = FLAT_LESSONS.length;
  const done = FLAT_LESSONS.filter((l) => isCompleted(l.id)).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, pct };
}
function getModuleProgress(moduleId) {
  const lessons = FLAT_LESSONS.filter((l) => l.moduleId === moduleId);
  const total = lessons.length;
  const done = lessons.filter((l) => isCompleted(l.id)).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, pct };
}
function updateHeaderProgress() {
  const { pct } = getProgress();
  $("overall-progress").style.width = `${pct}%`;
  $("progress-text").textContent = `${pct}%`;
}

/* ===================== RENDER: MODULES ===================== */
function renderModules() {
  const container = $("modules-list");
  container.innerHTML = "";

  MOCK.modules.forEach((mod, idx) => {
    const mp = getModuleProgress(mod.id);
    const headId = `head-${mod.id}`;
    const collId = `coll-${mod.id}`;
    const show = idx === 0 ? "show" : "";

    let bodyHtml = "";

    mod.sections.forEach((sec) => {
      bodyHtml += `<div class="section-title">${escapeHtml(sec.title)}</div>`;

      sec.lessons.forEach((lesson) => {
        const full = getLessonById(lesson.id);
        if (!full) return;

        const done = isCompleted(full.id);
        const accessible = isAccessible(full);
        const locked = !accessible;
        const icon = ICONS[full.type] || ICONS.default;

        bodyHtml += `
          <div class="lesson-item ${done ? "completed" : ""} ${locked ? "locked" : ""}" data-lesson-id="${full.id}" aria-disabled="${locked ? "true" : "false"}">
            <i class='bx ${icon} fs-5'></i>
            <span class="text-truncate flex-grow-1">${escapeHtml(full.title)}</span>
            ${locked ? "<i class='bx bx-lock-alt text-muted'></i>" : (done ? "<i class='bx bxs-check-circle text-success'></i>" : "")}
          </div>
        `;
      });
    });

    container.insertAdjacentHTML("beforeend", `
      <div class="accordion-item">
        <h2 class="accordion-header" id="${headId}">
          <button class="accordion-button ${show ? "" : "collapsed"}" type="button"
            data-bs-toggle="collapse" data-bs-target="#${collId}" aria-expanded="${show ? "true" : "false"}">
            <span class="text-truncate">${escapeHtml(mod.title)}</span>
            <span class="ms-auto d-flex align-items-center gap-2">
              <span class="badge bg-light text-dark border">${mp.done}/${mp.total}</span>
              <span class="small text-muted fw-bold">${mp.pct}%</span>
            </span>
          </button>
        </h2>

        <div class="px-3 pb-2 pt-0" style="background:#fff;">
          <div class="progress" style="height:6px; width:100%;">
            <div class="progress-bar bg-primary" style="width:${mp.pct}%"></div>
          </div>
        </div>

        <div id="${collId}" class="accordion-collapse collapse ${show}" aria-labelledby="${headId}">
          <div class="accordion-body p-0">${bodyHtml}</div>
        </div>
      </div>
    `);

    if (STATE.currentLessonId) {
      const activeEl = container.querySelector(`[data-lesson-id="${STATE.currentLessonId}"]`);
      if (activeEl) activeEl.classList.add("active");
    }
  });
}

/* ===================== RENDER: LESSON ===================== */
let CURRENT = null;

function setFinishUI(isDone, isQuiz) {
  const btn = $("btn-finish");
  const badge = $("lesson-status");

  if (isQuiz) {
    btn.style.display = "none";
    badge.style.display = "inline-flex";
    badge.textContent = isDone ? "Concluído" : "Pendente";
    badge.className = isDone ? "badge bg-success" : "badge bg-light text-dark border";
    return;
  }

  if (isDone) {
    btn.style.display = "none";
    badge.style.display = "inline-flex";
    badge.textContent = "Concluída";
    badge.className = "badge bg-success";
  } else {
    btn.style.display = "inline-flex";
    btn.disabled = false;
    badge.style.display = "none";
  }
}

function renderLesson(lessonId) {
  const lesson = getLessonById(lessonId);
  if (!lesson) return;

  if (!isAccessible(lesson)) {
    const first = firstAccessibleLessonId();
    if (first) lessonId = first;
  }

  const current = getLessonById(lessonId);
  if (!current) return;

  CURRENT = current;
  setCurrentLesson(current.id);

  document.querySelectorAll(".lesson-item").forEach((el) => el.classList.remove("active"));
  const li = document.querySelector(`.lesson-item[data-lesson-id="${current.id}"]`);
  if (li) li.classList.add("active");

  try { bootstrap.Tab.getOrCreateInstance($("tab-aula-btn")).show(); } catch {}

  $("lbl-type").textContent = current.type.replaceAll("_", " ");
  $("lbl-title").textContent = current.title;

  const desc = $("lbl-desc");
  if (current.description) {
    desc.style.display = "block";
    desc.innerHTML = `<p class="m-0">${escapeHtml(current.description)}</p>`;
  } else {
    desc.style.display = "none";
    desc.innerHTML = "";
  }

  const done = isCompleted(current.id);
  const isQuiz = current.type === "QUIZ";
  setFinishUI(done, isQuiz);

  const player = $("player-frame");
  const area = $("activity-area");
  player.style.display = "none";
  player.innerHTML = "";
  area.innerHTML = "";

  // ✅ dúvidas/comentários: exceto quiz
  $("lesson-extras").style.display = isQuiz ? "none" : "block";

  if (current.type === "VIDEO_AULA") {
    player.style.display = "block";
    player.innerHTML = `<iframe src="${toEmbedUrl(current.videoUrl)}" title="Vídeo" allowfullscreen></iframe>`;
  }

  if (current.type === "PDF") {
    area.innerHTML = `
      <div class="mb-3 d-flex justify-content-end">
        <a class="btn btn-outline-primary rounded-pill" href="${current.pdfUrl || "#"}" target="_blank" rel="noopener">
          <i class='bx bxs-file-pdf'></i> Abrir em nova aba
        </a>
      </div>
      <iframe class="pdf-viewer" src="${current.pdfUrl || ""}"></iframe>
    `;
  }

  if (current.type === "AUDIO") {
    area.innerHTML = `
      <div class="audio-container">
        <div class="audio-icon"><i class='bx bx-music'></i></div>
        <div class="fw-bold mb-1">Aula em áudio (modelo)</div>
        <div class="text-muted small mb-3">Você pode ouvir e depois concluir a aula normalmente.</div>
        <audio controls style="width:100%;">
          <source src="${current.audioUrl || ""}" type="audio/mpeg">
        </audio>
      </div>
    `;
  }

  if (current.type === "TEXTO") {
    area.innerHTML = `
      <div class="p-3 border rounded-3 bg-white">
        <div class="content-text">${current.textHtml || "<p>(Sem conteúdo)</p>"}</div>
      </div>
    `;
  }

  if (current.type === "TASK") {
    area.innerHTML = `
      <div class="p-3 border rounded-3 bg-white">
        <div class="fw-bold mb-2"><i class='bx bx-edit'></i> Tarefa</div>
        <div class="text-muted mb-3">Valor: <b>${current.points ?? "—"}</b></div>
        <button class="btn btn-primary rounded-pill px-4" id="btnOpenTask" type="button">
          <i class='bx bx-window-open'></i> Abrir tarefa
        </button>
      </div>
    `;
    $("btnOpenTask").onclick = () => openTaskDrawer(current);
  }

  if (current.type === "QUIZ") {
    const already = !!STATE.quizDone[current.id];
    area.innerHTML = `
      <div class="p-3 border rounded-3 bg-white">
        <div class="fw-bold mb-2"><i class='bx bx-trophy'></i> Quiz</div>
        <div class="text-muted mb-3">${current.quiz?.questions?.length || 0} questões • Valor: <b>${current.points ?? "—"}</b></div>
        <button class="btn btn-primary rounded-pill px-4" id="btnOpenQuiz" type="button">
          <i class='bx bx-window-open'></i> ${already ? "Revisar" : "Iniciar quiz"}
        </button>
        ${already ? `<div class="mt-3 alert alert-success mb-0"><i class='bx bx-check-circle'></i> Quiz finalizado.</div>` : ""}
      </div>
    `;
    $("btnOpenQuiz").onclick = () => openQuizDrawer(current);
  }

  if (!isQuiz) {
    renderComments(current.id);
  }

  renderPrevNext();
  updateHeaderProgress();
  renderModules();
  renderGrades();
}

/* ===================== PREV/NEXT ===================== */
function renderPrevNext() {
  const prevBtn = $("btn-prev");
  const nextBtn = $("btn-next");

  const accessible = getAccessibleLessonsList();
  const idx = accessible.findIndex((l) => l.id === CURRENT?.id);

  prevBtn.disabled = idx <= 0;
  nextBtn.disabled = idx < 0 || idx >= accessible.length - 1;

  prevBtn.onclick = () => { if (idx > 0) renderLesson(accessible[idx - 1].id); };
  nextBtn.onclick = () => { if (idx >= 0 && idx < accessible.length - 1) renderLesson(accessible[idx + 1].id); };
}

/* ===================== CONCLUIR AULA ===================== */
function onFinishLesson() {
  if (!CURRENT) return;
  if (CURRENT.type === "QUIZ") return;
  if (!isCompleted(CURRENT.id)) markCompleted(CURRENT.id);
  renderLesson(CURRENT.id);
}

/* ===================== DRAWER ===================== */
function openDrawer(title, subtitle, html) {
  $("drawer-title").textContent = title || "Atividade";
  $("drawer-subtitle").textContent = subtitle || "";
  $("drawer-body").innerHTML = html || "";
  $("activity-backdrop").classList.add("show");
  $("activity-drawer").classList.add("open");
  $("activity-drawer").setAttribute("aria-hidden", "false");
}
function closeDrawer() {
  $("activity-backdrop").classList.remove("show");
  $("activity-drawer").classList.remove("open");
  $("activity-drawer").setAttribute("aria-hidden", "true");
}

/* ===================== TASK WIZARD (1 etapa por vez) ===================== */
function openTaskDrawer(lesson) {
  const steps =
    (lesson.task?.questions && Array.isArray(lesson.task.questions) && lesson.task.questions.length)
      ? lesson.task.questions
      : [{ label: "Resposta", type: "textarea", placeholder: "Digite sua resposta..." }];

  if (!STATE.taskAnswers) STATE.taskAnswers = {};
  if (!STATE.taskAnswers[lesson.id]) STATE.taskAnswers[lesson.id] = {};

  let idx = 0;

  openDrawer("Tarefa", lesson.title, `<div id="taskWizard"></div>`);
  const root = document.getElementById("taskWizard");

  function getSaved(stepIndex) {
    return STATE.taskAnswers[lesson.id]?.[stepIndex] ?? "";
  }

  function saveStep(stepIndex, value) {
    STATE.taskAnswers[lesson.id][stepIndex] = value;
    saveState(STATE);
  }

  function render() {
    const step = steps[idx];
    const isLast = idx === steps.length - 1;

    const instructions = (lesson.task?.instructions || []).length
      ? `
        <div class="mb-3">
          <div class="fw-bold mb-1">Orientações</div>
          <ul class="mb-0">
            ${(lesson.task.instructions || []).map(x => `<li>${escapeHtml(x)}</li>`).join("")}
          </ul>
        </div>
      `
      : "";

    const value = getSaved(idx);

    const field =
      (step.type === "text")
        ? `<input class="form-control" id="taskInput" value="${escapeAttr(value)}" placeholder="${escapeAttr(step.placeholder || "")}" />`
        : `<textarea class="form-control" id="taskInput" rows="7" placeholder="${escapeAttr(step.placeholder || "")}">${escapeHtml(value)}</textarea>`;

    root.innerHTML = `
      <div class="p-3 bg-white rounded-3 border">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="fw-bold">Etapa ${idx + 1} de ${steps.length}</div>
          ${lesson.points ? `<span class="badge bg-light text-dark border">${lesson.points} pts</span>` : `<span class="badge bg-light text-dark border">Tarefa</span>`}
        </div>

        ${instructions}

        <label class="form-label fw-bold mb-1">${escapeHtml(step.label || "Etapa")}</label>
        ${field}

        <div class="d-flex justify-content-between align-items-center mt-3">
          <button class="btn btn-light border" id="tPrev" ${idx === 0 ? "disabled" : ""}>Anterior</button>

          <div class="d-flex gap-2">
            ${!isLast
              ? `<button class="btn btn-primary" id="tNext" disabled>Próxima</button>`
              : `<button class="btn btn-primary" id="tSubmit" disabled><i class='bx bx-send'></i> Enviar</button>`
            }
          </div>
        </div>

        <div class="alert alert-light border mt-3 mb-0 small">
          Mock: ao enviar, marca como concluída.
        </div>
      </div>
    `;

    const input = root.querySelector("#taskInput");
    const nextBtn = root.querySelector("#tNext");
    const submitBtn = root.querySelector("#tSubmit");

    function refreshButtons() {
      const ok = !!(input.value || "").trim();
      if (nextBtn) nextBtn.disabled = !ok;
      if (submitBtn) submitBtn.disabled = !ok;
    }
    refreshButtons();

    input.addEventListener("input", () => {
      saveStep(idx, input.value);
      refreshButtons();
    });

    const prevBtn = root.querySelector("#tPrev");
    if (prevBtn) prevBtn.onclick = () => {
      if (idx > 0) {
        saveStep(idx, input.value);
        idx--;
        render();
      }
    };

    if (nextBtn) nextBtn.onclick = () => {
      if (idx < steps.length - 1) {
        saveStep(idx, input.value);
        idx++;
        render();
      }
    };

    if (submitBtn) submitBtn.onclick = () => {
      saveStep(idx, input.value);
      markCompleted(lesson.id);
      closeDrawer();
      renderLesson(lesson.id);
    };
  }

  render();
}

/* ===================== QUIZ WIZARD (1 questão por vez) ===================== */
function openQuizDrawer(lesson) {
  const questions = lesson.quiz?.questions || [];
  if (!questions.length) {
    openDrawer("Quiz", lesson.title, `<div class="p-3 bg-white rounded-3 border">Sem questões.</div>`);
    return;
  }

  if (!STATE.quizAnswers[lesson.id]) STATE.quizAnswers[lesson.id] = {};
  let idx = 0;

  openDrawer("Quiz", lesson.title, `<div id="quizWizard"></div>`);
  const root = document.getElementById("quizWizard");

  const isDone = !!STATE.quizDone[lesson.id];

  function getSavedAnswer(qIndex) {
    return STATE.quizAnswers[lesson.id]?.[qIndex];
  }

  function saveAnswer(qIndex, optIndex) {
    STATE.quizAnswers[lesson.id][qIndex] = optIndex;
    saveState(STATE);
  }

  function render() {
    const q = questions[idx];
    const saved = getSavedAnswer(idx);
    const isLast = idx === questions.length - 1;
    const canAdvance = saved !== undefined;

    const optionsHtml = (q.options || []).map((opt, oi) => {
      const checked = saved === oi ? "checked" : "";
      return `
        <label class="d-flex align-items-center gap-2 p-2 border rounded-3 bg-white mb-2" style="cursor:pointer;">
          <input type="radio" name="qOne" value="${oi}" ${checked} />
          <span>${escapeHtml(opt)}</span>
        </label>
      `;
    }).join("");

    root.innerHTML = `
      <div class="p-3 bg-white rounded-3 border">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="fw-bold">Questão ${idx + 1} de ${questions.length}</div>
          <span class="badge bg-light text-dark border">${lesson.points ?? "—"} pts</span>
        </div>

        <div class="fw-bold mb-2">${escapeHtml(q.q)}</div>
        ${optionsHtml}

        <div class="d-flex justify-content-between align-items-center mt-3">
          <button class="btn btn-light border" id="qPrev" ${idx === 0 ? "disabled" : ""}>Anterior</button>

          <div class="d-flex gap-2">
            ${
              !isLast
                ? `<button class="btn btn-primary" id="qNext" ${canAdvance ? "" : "disabled"}>Próxima</button>`
                : `<button class="btn btn-primary" id="qFinish" ${canAdvance ? "" : "disabled"}>Finalizar</button>`
            }
          </div>
        </div>

        ${
          isDone
            ? `<div class="alert alert-light border mt-3 mb-0 small">
                 Quiz já finalizado. (Mock) Você pode revisar as respostas.
               </div>`
            : ""
        }
      </div>
    `;

    root.querySelectorAll('input[name="qOne"]').forEach((inp) => {
      inp.addEventListener("change", (e) => {
        const oi = parseInt(e.target.value, 10);
        saveAnswer(idx, oi);
        const btn = root.querySelector("#qNext") || root.querySelector("#qFinish");
        if (btn) btn.disabled = false;
      });
    });

    const prevBtn = root.querySelector("#qPrev");
    if (prevBtn) prevBtn.onclick = () => {
      if (idx > 0) { idx--; render(); }
    };

    const nextBtn = root.querySelector("#qNext");
    if (nextBtn) nextBtn.onclick = () => {
      if (idx < questions.length - 1) { idx++; render(); }
    };

    const finishBtn = root.querySelector("#qFinish");
    if (finishBtn) finishBtn.onclick = () => {
      STATE.quizDone[lesson.id] = true;
      saveState(STATE);
      markCompleted(lesson.id);
      closeDrawer();
      renderLesson(lesson.id);
    };
  }

  render();
}

/* ===================== COMMENTS ===================== */
let replyTarget = { lessonId: null, commentId: null };

function getCommentsForLesson(lessonId) {
  if (!STATE._comments[lessonId]) {
    const initial = MOCK.commentsByLesson[lessonId] || [];
    STATE._comments[lessonId] = initial.map(c => ({ ...c, replies: (c.replies || []).map(r => ({ ...r })) }));
    saveState(STATE);
  }
  return STATE._comments[lessonId];
}

function renderComments(lessonId) {
  const thread = $("commentsThread");
  const comments = getCommentsForLesson(lessonId);

  if (!comments || comments.length === 0) {
    thread.innerHTML = `<div class="text-muted small">Sem comentários ainda. Seja o primeiro 🙂</div>`;
    return;
  }

  thread.innerHTML = comments.map((c) => {
    const replies = (c.replies || []).map((r) => `
      <div class="d-flex gap-2 mt-2">
        <div class="avatar" style="width:30px;height:30px;border-radius:10px;font-size:12px;">${escapeHtml(r.initials)}</div>
        <div class="flex-grow-1">
          <div class="d-flex gap-2 align-items-baseline">
            <div class="fw-bold">${escapeHtml(r.author)}</div>
            <div class="small text-muted">${escapeHtml(r.time)}</div>
          </div>
          <div>${escapeHtml(r.text)}</div>
        </div>
      </div>
    `).join("");

    return `
      <div class="d-flex gap-2 py-3" style="border-top:1px solid #f1f5f9;">
        <div class="avatar">${escapeHtml(c.initials)}</div>
        <div class="flex-grow-1">
          <div class="d-flex gap-2 align-items-baseline">
            <div class="fw-bold">${escapeHtml(c.author)}</div>
            <div class="small text-muted">${escapeHtml(c.time)}</div>
          </div>

          <div class="mt-1">${escapeHtml(c.text)}</div>

          <div class="mt-2">
            <button class="btn btn-sm btn-outline-primary rounded-pill"
              data-lesson-id="${lessonId}"
              data-comment-id="${c.id}"
              data-reply-to="${escapeAttr(c.author)}"
              data-reply-context="${escapeAttr(c.text)}"
              data-bs-toggle="modal"
              data-bs-target="#modalReply">
              <i class='bx bx-reply'></i> Responder
            </button>
          </div>

          ${replies ? `<div class="mt-2 ps-2" style="border-left:3px solid #e2e8f0;">${replies}</div>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function publishComment() {
  if (!CURRENT) return;
  const text = $("newCommentText").value.trim();
  if (!text) return;

  const comments = getCommentsForLesson(CURRENT.id);
  comments.unshift({
    id: "c" + Math.random().toString(16).slice(2),
    author: "Você",
    initials: "VC",
    time: "agora",
    text,
    replies: [],
  });

  $("newCommentText").value = "";
  saveState(STATE);
  renderComments(CURRENT.id);
}

function sendReply() {
  const txt = $("replyText").value.trim();
  if (!txt || !replyTarget.lessonId || !replyTarget.commentId) return;

  const comments = getCommentsForLesson(replyTarget.lessonId);
  const parent = comments.find((c) => c.id === replyTarget.commentId);
  if (!parent) return;

  parent.replies = parent.replies || [];
  parent.replies.push({
    id: "r" + Math.random().toString(16).slice(2),
    author: "Você",
    initials: "VC",
    time: "agora",
    text: txt,
  });

  saveState(STATE);
  renderComments(replyTarget.lessonId);

  try { bootstrap.Modal.getOrCreateInstance($("modalReply")).hide(); } catch {}
}

/* ===================== CONTATO (MODAL) ===================== */
let selectedStaffId = null;

function renderStaffModal() {
  const list = $("staffModalList");
  list.innerHTML = "";

  MOCK.staff.forEach((p) => {
    list.insertAdjacentHTML("beforeend", `
      <button type="button"
        class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
        data-staff-id="${p.id}">
        <div class="text-start">
          <div class="fw-bold">${escapeHtml(p.name)}</div>
          <div class="small text-muted">${escapeHtml(p.role)}</div>
        </div>
        <i class='bx bx-chevron-right text-muted'></i>
      </button>
    `);
  });

  list.querySelectorAll("[data-staff-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedStaffId = btn.getAttribute("data-staff-id");

      // marca visualmente
      list.querySelectorAll(".active").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");

      const staff = MOCK.staff.find(s => s.id === selectedStaffId);
      $("contactToName").textContent = staff?.name || "—";
      $("contactToRole").textContent = staff?.role || "—";

      $("btnSendContact").disabled = false;
      $("contactText").focus();
    });
  });
}

function openContactModal() {
  const modal = bootstrap.Modal.getOrCreateInstance($("modalContact"));
  // reset
  selectedStaffId = null;
  $("contactToName").textContent = "—";
  $("contactToRole").textContent = "Selecione alguém à esquerda";
  $("contactText").value = "";
  $("btnSendContact").disabled = true;

  renderStaffModal();
  modal.show();
}

function sendContact() {
  if (!selectedStaffId) return;
  // mock: fecha
  try { bootstrap.Modal.getOrCreateInstance($("modalContact")).hide(); } catch {}
  $("contactText").value = "";
}

/* ===================== MURAL (drag) ===================== */
function getMuralOrder() {
  const base = MOCK.mural.map(p => p.id);
  if (!STATE.muralOrder || !Array.isArray(STATE.muralOrder)) return base;
  const merged = STATE.muralOrder.filter(id => base.includes(id));
  base.forEach(id => { if (!merged.includes(id)) merged.push(id); });
  return merged;
}

function renderMural() {
  const container = $("wall-container");
  container.innerHTML = "";

  const order = getMuralOrder();
  const byId = Object.fromEntries(MOCK.mural.map(p => [p.id, p]));

  order.forEach((id) => {
    const p = byId[id];
    if (!p) return;
    container.insertAdjacentHTML("beforeend", `
      <div class="post-it ${p.color}" draggable="true" data-post-id="${p.id}">
        ${p.isNew ? `<div class="new-indicator">NOVO</div>` : ""}
        <div class="post-title">${escapeHtml(p.title)}</div>
        <div class="post-body">${escapeHtml(p.body)}</div>
        <div class="post-footer">
          <span class="post-tag">${escapeHtml(p.tag)}</span>
          <button class="post-btn" type="button">Abrir</button>
        </div>
      </div>
    `);
  });

  const newCount = MOCK.mural.filter(p => p.isNew).length;
  const badge = $("mural-badge");
  if (newCount > 0) {
    badge.style.display = "inline-block";
    badge.textContent = String(newCount);
  } else {
    badge.style.display = "none";
  }

  enableMuralDrag(container);
}

function enableMuralDrag(board) {
  let dragged = null;
  let placeholder = null;

  function createPlaceholder() {
    const ph = document.createElement("div");
    ph.className = "postit-drop";
    return ph;
  }

  board.querySelectorAll(".post-it").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      dragged = card;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.dataset.postId);
      placeholder = createPlaceholder();
      setTimeout(() => card.style.display = "none", 0);
    });

    card.addEventListener("dragend", () => {
      if (dragged) dragged.style.display = "";
      if (placeholder && placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      dragged = null;
      placeholder = null;
      persistMuralOrder();
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!dragged || card === dragged) return;
      const rect = card.getBoundingClientRect();
      const after = (e.clientX - rect.left) > (rect.width / 2);

      if (!placeholder) placeholder = createPlaceholder();

      if (after) {
        if (card.nextSibling !== placeholder) board.insertBefore(placeholder, card.nextSibling);
      } else {
        if (card.previousSibling !== placeholder) board.insertBefore(placeholder, card);
      }
    });

    card.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!dragged || !placeholder) return;
      board.insertBefore(dragged, placeholder);
    });
  });

  board.addEventListener("dragover", (e) => e.preventDefault());
  board.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!dragged) return;
    if (placeholder) board.insertBefore(dragged, placeholder);
  });

  function persistMuralOrder() {
    const ids = Array.from(board.querySelectorAll(".post-it")).map(el => el.dataset.postId);
    STATE.muralOrder = ids;
    saveState(STATE);
  }
}

/* ===================== NOTAS ===================== */
function renderGrades() {
  const wrap = $("grades-list");

  const byModule = {};
  MOCK.grades.forEach((g) => {
    if (!byModule[g.moduleId]) byModule[g.moduleId] = [];
    byModule[g.moduleId].push(g);
  });

  const modTitle = (moduleId) => (MOCK.modules.find(m => m.id === moduleId)?.title || `Módulo ${moduleId}`);

  const cards = Object.entries(byModule).map(([moduleId, items]) => {
    const total = items.reduce((s, x) => s + (typeof x.value === "number" ? x.value : 0), 0);
    const got = items.reduce((s, x) => s + (typeof x.score === "number" ? x.score : 0), 0);

    const rows = items.map((x) => `
      <tr>
        <td class="fw-bold text-truncate">${escapeHtml(x.title)}</td>
        <td class="text-end">${x.value ?? "NSA"}</td>
        <td class="text-end">${x.score ?? "NSA"}</td>
        <td class="text-end">
          ${isCompleted(x.lessonId) ? `<span class="badge bg-success">Concluído</span>` : `<span class="badge bg-light text-dark border">Pendente</span>`}
        </td>
      </tr>
    `).join("");

    return `
      <div class="card border-0 shadow-sm mb-3">
        <div class="card-header bg-white border-bottom d-flex justify-content-between align-items-center">
          <div>
            <div class="fw-bold">${escapeHtml(modTitle(moduleId))}</div>
            <div class="small text-muted">Pontuação do módulo</div>
          </div>
          <div class="d-flex gap-2 flex-wrap justify-content-end">
            <span class="badge bg-light text-dark border">Total: ${total}</span>
            <span class="badge bg-light text-dark border">Obtido: ${got}</span>
          </div>
        </div>

        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0 grades-table">
              <colgroup>
                <col style="width:52%">
                <col style="width:16%">
                <col style="width:18%">
                <col style="width:14%">
              </colgroup>
              <thead class="table-light">
                <tr>
                  <th>Atividade</th>
                  <th class="text-end">Valor</th>
                  <th class="text-end">Sua pontuação</th>
                  <th class="text-end">Status</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }).join("");

  wrap.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-2 mb-3">
      <div>
        <div class="fw-bold">Notas e pontuações</div>
        <div class="small text-muted">Itens avaliativos do curso (mock)</div>
      </div>
      <div class="d-flex gap-2 flex-wrap justify-content-end">
        <span class="badge bg-primary">Progresso: ${getProgress().pct}%</span>
      </div>
    </div>
    ${cards}
  `;
}

/* ===================== CALENDÁRIO ===================== */
function renderCalendar() {
  const el = $("calendar-list");
  const cal = MOCK.calendar;

  const grid = cal.days.map((d) => `
    <div class="cal-cell ${d.muted ? "muted" : ""}">
      <div class="n">${d.n}</div>
      ${(d.events || []).slice(0,2).map(x => `<div class="pill-event">${escapeHtml(x)}</div>`).join("")}
    </div>
  `).join("");

  const upcoming = cal.upcoming.map((u) => `
    <div class="up-item">
      <div class="when">${escapeHtml(u.when)}</div>
      <div class="what">
        <div class="t">${escapeHtml(u.title)}</div>
        <div class="d">${escapeHtml(u.desc)}</div>
      </div>
      <span class="badge ${u.badgeClass}">${escapeHtml(u.badge)}</span>
    </div>
  `).join("");

  el.innerHTML = `
    <div class="d-flex justify-content-between align-items-start gap-2 mb-3 pb-2" style="border-bottom:1px solid var(--line);">
      <div>
        <div class="fw-bold">Calendário da turma</div>
        <div class="small text-muted">Visão mensal + próximos eventos (mock)</div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-light border btn-sm" type="button" disabled><i class='bx bx-chevron-left'></i></button>
        <span class="fw-bold">${escapeHtml(cal.monthLabel)}</span>
        <button class="btn btn-light border btn-sm" type="button" disabled><i class='bx bx-chevron-right'></i></button>
      </div>
    </div>

    <div class="cal-grid">
      <div class="cal-dow">Dom</div><div class="cal-dow">Seg</div><div class="cal-dow">Ter</div>
      <div class="cal-dow">Qua</div><div class="cal-dow">Qui</div><div class="cal-dow">Sex</div><div class="cal-dow">Sáb</div>
      ${grid}
    </div>

    <div class="cal-upcoming mt-3">
      <div class="fw-bold mb-2">Próximos eventos</div>
      ${upcoming}
    </div>
  `;
}

/* ===================== NAV TOGGLE ===================== */
function setupNavToggle() {
  const btn = $("btn-toggle-nav");
  const nav = $("course-nav");
  const layout = $("classroomLayout");

  btn.addEventListener("click", () => {
    const closed = nav.classList.toggle("closed");
    layout.style.gridTemplateColumns = closed ? "84px 1fr" : "360px 1fr";
    btn.innerHTML = closed ? `<i class='bx bx-chevron-right'></i>` : `<i class='bx bx-chevron-left'></i>`;
  });
}

/* ===================== TOP ACTIONS ===================== */
function setupTopActions() {
  $("btnTopContact").addEventListener("click", openContactModal);

  $("btnTopClassCfg").addEventListener("click", (e) => {
    e.preventDefault();
    alert("Configurações da Turma (mock) — vamos ligar depois.");
  });

  $("btnTopCourseCfg").addEventListener("click", (e) => {
    e.preventDefault();
    alert("Configurações do Curso (mock) — vamos ligar depois.");
  });
}

/* ===================== EVENTS ===================== */
function setupEvents() {
  $("modules-list").addEventListener("click", (e) => {
    const item = e.target.closest(".lesson-item");
    if (!item) return;
    if (item.classList.contains("locked")) return;
    renderLesson(item.dataset.lessonId);
  });

  $("btn-finish").addEventListener("click", onFinishLesson);

  $("drawer-close").addEventListener("click", closeDrawer);
  $("activity-backdrop").addEventListener("click", closeDrawer);

  $("btnPublishComment").addEventListener("click", publishComment);

  $("modalReply").addEventListener("show.bs.modal", (ev) => {
    const btn = ev.relatedTarget;
    if (!btn) return;
    replyTarget = {
      lessonId: btn.getAttribute("data-lesson-id"),
      commentId: btn.getAttribute("data-comment-id"),
    };
    $("replyToName").textContent = btn.getAttribute("data-reply-to") || "—";
    $("replyContextText").textContent = btn.getAttribute("data-reply-context") || "—";
    $("replyText").value = "";
  });

  $("btnSendReply").addEventListener("click", sendReply);

  $("btnSendContact").addEventListener("click", sendContact);
}

/* ===================== INIT ===================== */
function init() {
  $("header-class-name").textContent = MOCK.header.className;
  $("header-course-title").textContent = MOCK.header.courseTitle;

  setupNavToggle();
  setupTopActions();
  setupEvents();

  renderMural();
  renderGrades();
  renderCalendar();

  updateHeaderProgress();
  renderModules();

  const startId =
    (STATE.currentLessonId && getLessonById(STATE.currentLessonId) && isAccessible(getLessonById(STATE.currentLessonId)))
      ? STATE.currentLessonId
      : firstAccessibleLessonId();

  if (startId) renderLesson(startId);
}

document.addEventListener("DOMContentLoaded", init);
