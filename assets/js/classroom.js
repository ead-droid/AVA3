/* ============================================================
   AVA3 • classroom.js (MOCK + LAYOUT + RESTRIÇÃO VISÍVEL)
   - Sem Supabase / sem auth
   - Restrição sequencial: bloqueados ficam visíveis (cinza), mas não abrem
   - Modelos: VIDEO_AULA, PDF, QUIZ, TASK, AUDIO, TEXTO
   ============================================================ */

const STORAGE_KEY = "ava3.classroom.mock.v3";

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

/* ===================== RENDER: MODULES (bloqueado visível) ===================== */
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
        const locked = !accessible; // ✅ VISÍVEL, mas cinza e sem clique
        const icon = ICONS[full.type] || ICONS.default;

        bodyHtml += `
          <div class="lesson-item ${done ? "completed" : ""} ${locked ? "locked" : ""}" data-lesson-id="${full.id}" aria-disabled="${locked ? "true" : "false"}">
            <i class='bx ${icon} fs-5'></i>
            <span class="text-truncate flex-grow-1">${escapeHtml(full.title)}</span>
            ${full.type === "QUIZ" ? `<span class="badge bg-light text-dark border">Quiz</span>` : ""}
            ${full.type === "TASK" ? `<span class="badge bg-light text-dark border">Tarefa</span>` : ""}
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

  // se for bloqueado: não abre (mantém no último acessível)
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

  $("lbl-type").textContent = current.type.replace("_", " ");
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

  // extras (exceto quiz)
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
        <div class="fw-bold mb-2"><i class='bx bx-edit'></i> Instruções da tarefa</div>
        <ul class="mb-3">
          ${(current.task?.instructions || []).map((x) => `<li>${escapeHtml(x)}</li>`).join("")}
        </ul>
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
          <i class='bx bx-window-open'></i> ${already ? "Ver tentativa" : "Iniciar quiz"}
        </button>
        ${already ? `<div class="mt-3 alert alert-success mb-0"><i class='bx bx-check-circle'></i> Quiz finalizado.</div>` : ""}
      </div>
    `;
    $("btnOpenQuiz").onclick = () => openQuizDrawer(current);
  }

  if (!isQuiz) {
    renderComments(current.id);
    renderStaff();
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

function openTaskDrawer(lesson) {
  const html = `
    <div class="p-3 bg-white rounded-3 border">
      <div class="fw-bold mb-2">Entrega (mock)</div>
      <label class="form-label fw-bold">Resposta</label>
      <textarea class="form-control mb-3" rows="6" placeholder="Digite sua resposta..."></textarea>
      <div class="d-flex justify-content-end gap-2">
        <button class="btn btn-light border" id="drawerCancel">Cancelar</button>
        <button class="btn btn-primary" id="drawerSubmitTask"><i class='bx bx-send'></i> Enviar</button>
      </div>
      <div class="alert alert-light border mt-3 mb-0 small">
        Mock: ao enviar, marca como concluída.
      </div>
    </div>
  `;
  openDrawer("Tarefa", lesson.title, html);
  $("drawerCancel").onclick = closeDrawer;
  $("drawerSubmitTask").onclick = () => {
    markCompleted(lesson.id);
    closeDrawer();
    renderLesson(lesson.id);
  };
}

function openQuizDrawer(lesson) {
  const questions = lesson.quiz?.questions || [];
  const saved = STATE.quizAnswers[lesson.id] || {};

  const qHtml = questions.map((q, qi) => {
    const opts = q.options.map((opt, oi) => {
      const checked = (saved[qi] === oi) ? "checked" : "";
      return `
        <label class="d-flex align-items-center gap-2 p-2 border rounded-3 bg-white mb-2" style="cursor:pointer;">
          <input type="radio" name="q${qi}" value="${oi}" ${checked} />
          <span>${escapeHtml(opt)}</span>
        </label>
      `;
    }).join("");

    return `
      <div class="mb-4">
        <div class="fw-bold mb-2">${qi + 1}. ${escapeHtml(q.q)}</div>
        ${opts}
      </div>
    `;
  }).join("");

  const html = `
    <div class="p-3 bg-white rounded-3 border">
      <div class="fw-bold mb-2">Responda e finalize</div>
      ${qHtml}
      <div class="d-flex justify-content-end gap-2">
        <button class="btn btn-light border" id="drawerCancel">Cancelar</button>
        <button class="btn btn-primary" id="drawerFinishQuiz"><i class='bx bx-check'></i> Finalizar</button>
      </div>
    </div>
  `;

  openDrawer("Quiz", lesson.title, html);

  $("drawer-body").querySelectorAll("input[type=radio]").forEach((inp) => {
    inp.addEventListener("change", (e) => {
      const qi = parseInt(e.target.name.replace("q", ""), 10);
      const oi = parseInt(e.target.value, 10);
      if (!STATE.quizAnswers[lesson.id]) STATE.quizAnswers[lesson.id] = {};
      STATE.quizAnswers[lesson.id][qi] = oi;
      saveState(STATE);
    });
  });

  $("drawerCancel").onclick = closeDrawer;
  $("drawerFinishQuiz").onclick = () => {
    STATE.quizDone[lesson.id] = true;
    saveState(STATE);
    markCompleted(lesson.id); // quiz conclui aqui
    closeDrawer();
    renderLesson(lesson.id);
  };
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

/* ===================== STAFF ===================== */
function renderStaff() {
  const container = $("staffList");
  container.innerHTML = "";

  MOCK.staff.forEach((p) => {
    container.insertAdjacentHTML("beforeend", `
      <div class="d-flex justify-content-between align-items-center p-2 border rounded-3 mb-2 bg-white">
        <div>
          <div class="fw-bold">${escapeHtml(p.name)}</div>
          <div class="small text-muted">${escapeHtml(p.role)}</div>
        </div>
        <button class="btn btn-outline-primary btn-sm rounded-pill"
          data-staff-id="${p.id}"
          data-bs-toggle="modal"
          data-bs-target="#modalContact">
          <i class='bx bx-chat'></i> Mensagem
        </button>
      </div>
    `);
  });
}

function sendContact() {
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

/* ===================== NOTAS (alinhadas) ===================== */
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

/* ===================== TOP ACTIONS (Contato/Configs) ===================== */
function setupTopActions() {
  $("btnTopContact").addEventListener("click", () => {
    try { bootstrap.Tab.getOrCreateInstance($("tab-aula-btn")).show(); } catch {}
    const block = $("contactBlock");
    if (block) block.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // placeholders (pra não quebrar navegação agora)
  $("btnTopClassCfg").addEventListener("click", (e) => {
    e.preventDefault();
    alert("Configurações da Turma (mock) — vamos ligar depois no módulo de configurações.");
  });

  $("btnTopCourseCfg").addEventListener("click", (e) => {
    e.preventDefault();
    alert("Configurações do Curso (mock) — vamos ligar depois no course-editor.");
  });
}

/* ===================== EVENTS ===================== */
function setupEvents() {
  $("modules-list").addEventListener("click", (e) => {
    const item = e.target.closest(".lesson-item");
    if (!item) return;
    if (item.classList.contains("locked")) return; // ✅ bloqueado não abre
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

  $("modalContact").addEventListener("show.bs.modal", (ev) => {
    const btn = ev.relatedTarget;
    const staffId = btn?.getAttribute("data-staff-id");
    const staff = MOCK.staff.find(s => s.id === staffId);
    $("contactToName").textContent = staff?.name || "—";
    $("contactToRole").textContent = staff?.role || "—";
    $("contactText").value = "";
  });

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
