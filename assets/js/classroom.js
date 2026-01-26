/* ============================================================
   AVA3 • classroom.js (MOCK + LAYOUT) — FIX COMPLETO
   - Mantém HTML/CSS existentes
   - Restrição sequencial: bloqueados visíveis (cinza), sem clique
   - Progresso geral + por módulo
   - Quiz/Tarefa: 1 questão por vez (wizard) em gaveta (drawer)
   - Dúvidas e comentários abaixo da aula (modal p/ comentar e responder)
   - Contato direto via MODAL (sem card feio na página)
   - Botões (Contato / Config. Turma / Config. Curso) na linha das abas
   ============================================================ */

const STORAGE_KEY = "ava3.classroom.mock.v4";

/* ===================== MOCK DATA ===================== */
const MOCK = {
  settings: {
    progressionMode: "sequential", // "sequential" | "free"
    progressionScope: "course",    // "course" | "module"
  },

  header: {
    className: "Turma 2026/1 • Noite",
    courseTitle: "Auxiliar de Almoxarifado",
  },

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
              title: "5. Quiz diagnóstico",
              description: "Questionário rápido (mock).",
              points: 10,
              quiz: {
                questions: [
                  {
                    q: "O que é conferência documental?",
                    options: ["Validação de notas/pedidos/itens", "Guardar produtos", "Somente expedição"],
                    correct: 0
                  },
                  {
                    q: "Qual documento é comum no recebimento?",
                    options: ["Nota fiscal", "Carteira de trabalho", "Passaporte"],
                    correct: 0
                  },
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
              title: "6. Tarefa: Plano de estudos",
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
              title: "2. Quiz: Conferência",
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
  quizStep: {},
  quizScore: {},
  taskAnswers: {},
  taskStep: {},
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
  const bar = $("overall-progress");
  const txt = $("progress-text");
  if (bar) bar.style.width = `${pct}%`;
  if (txt) txt.textContent = `${pct}%`;
}

/* ===================== TOP ACTIONS (linha das abas) ===================== */
function mountTabActions() {
  const tabs = $("classTabs");
  if (!tabs || tabs.dataset._mountedActions) return;
  tabs.dataset._mountedActions = "1";

  const wrap = document.createElement("div");
  wrap.className = "d-flex align-items-center justify-content-between gap-2 flex-wrap";

  const left = document.createElement("div");
  left.className = "flex-grow-1";
  const right = document.createElement("div");
  right.className = "d-flex align-items-center gap-2";

  // Move o UL (abas) para dentro do wrapper
  tabs.parentNode.insertBefore(wrap, tabs);
  wrap.appendChild(left);
  wrap.appendChild(right);
  left.appendChild(tabs);

  // Botões à direita (Contato + Configs)
  right.insertAdjacentHTML("beforeend", `
    <button class="btn btn-outline-secondary btn-sm rounded-pill" id="btn-contact">
      <i class='bx bx-message-dots'></i> Contato
    </button>
    <a class="btn btn-outline-secondary btn-sm rounded-pill" id="btn-conf-class" href="class-dashboard.html">
      <i class='bx bx-cog'></i> Config. Turma
    </a>
    <a class="btn btn-outline-secondary btn-sm rounded-pill" id="btn-conf-course" href="course-editor.html">
      <i class='bx bx-edit-alt'></i> Config. Curso
    </a>
  `);

  const contactBtn = $("btn-contact");
  if (contactBtn) contactBtn.addEventListener("click", () => openContactModal());
}

/* ===================== RENDER: MODULES ===================== */
function renderModules() {
  const container = $("modules-list");
  if (!container) return;
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
          <div class="lesson-item ${done ? "completed" : ""} ${locked ? "locked" : ""}"
               data-lesson-id="${full.id}"
               aria-disabled="${locked ? "true" : "false"}">
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
  });

  // aplica active
  if (STATE.currentLessonId) {
    const activeEl = container.querySelector(`[data-lesson-id="${STATE.currentLessonId}"]`);
    if (activeEl) activeEl.classList.add("active");
  }
}

/* ===================== RENDER: HEADER ===================== */
function renderHeader() {
  const classNameEl = $("header-class-name");
  const courseTitleEl = $("header-course-title");
  if (classNameEl) classNameEl.textContent = MOCK.header.className || "Turma";
  if (courseTitleEl) courseTitleEl.textContent = MOCK.header.courseTitle || "Curso";
  updateHeaderProgress();
}

/* ===================== LEFT NAV TOGGLE ===================== */
function bindNavToggle() {
  const btn = $("btn-toggle-nav");
  const nav = $("course-nav");
  if (!btn || !nav) return;

  btn.addEventListener("click", () => {
    nav.classList.toggle("closed");
    const icon = btn.querySelector("i");
    if (icon) {
      icon.className = nav.classList.contains("closed")
        ? "bx bx-chevron-right"
        : "bx bx-chevron-left";
    }
    adjustDrawerWidth();
  });
}

/* ===================== CURRENT LESSON RENDER ===================== */
let CURRENT = null;

function setFinishButtonForLesson(lesson) {
  const btn = $("btn-finish");
  if (!btn) return;

  const done = isCompleted(lesson.id);

  // Para quiz/tarefa: botão vira "Abrir atividade" / "Refazer"
  if (lesson.type === "QUIZ" || lesson.type === "TASK") {
    btn.classList.remove("btn-outline-success");
    btn.classList.add("btn-primary");
    btn.innerHTML = done
      ? `<i class='bx bx-refresh'></i> Refazer`
      : `<i class='bx bx-play'></i> Abrir Atividade`;

    btn.disabled = false;
    btn.onclick = () => openActivityDrawer(lesson);
    return;
  }

  // Conteúdos normais: botão conclui
  btn.classList.remove("btn-primary");
  btn.classList.add("btn-outline-success");

  btn.innerHTML = done
    ? `<i class='bx bxs-check-circle'></i> Concluída`
    : `<i class='bx bx-check'></i> Concluir Aula`;

  btn.disabled = done;
  btn.onclick = () => {
    markCompleted(lesson.id);
    afterCompletionRefresh(lesson.id);
  };
}

function setLessonHeader(lesson) {
  const lblType = $("lbl-type");
  const lblTitle = $("lbl-title");
  const lblDesc = $("lbl-desc");

  if (lblType) lblType.textContent = lesson.type.replaceAll("_", " ");
  if (lblTitle) {
    const done = isCompleted(lesson.id);
    lblTitle.innerHTML = `${escapeHtml(lesson.title)} ${done ? `<span class="badge bg-success ms-2">Concluída</span>` : ""}`;
  }

  // descrição (sem exagero de espaço)
  const descText = lesson.description || "";
  if (lblDesc) {
    if (descText.trim()) {
      lblDesc.style.display = "";
      lblDesc.innerHTML = escapeHtml(descText);
    } else {
      lblDesc.style.display = "none";
      lblDesc.innerHTML = "";
    }
  }
}

function clearLessonAreas() {
  const player = $("player-frame");
  const area = $("activity-area");
  if (player) { player.style.display = "none"; player.innerHTML = ""; }
  if (area) area.innerHTML = "";
}

function ensureCommentsContainer() {
  let el = document.getElementById("comments-section");
  if (el) return el;

  // Insere logo após activity-area (antes dos botões Anterior/Próxima)
  const area = $("activity-area");
  if (!area) return null;

  el = document.createElement("div");
  el.id = "comments-section";
  el.className = "mt-3";

  const lessonNav = document.querySelector(".lesson-nav");
  if (lessonNav && lessonNav.parentNode) {
    lessonNav.parentNode.insertBefore(el, lessonNav);
  } else {
    area.parentNode.appendChild(el);
  }
  return el;
}

function getCommentsForLesson(lessonId) {
  const base = MOCK.commentsByLesson?.[lessonId] ? JSON.parse(JSON.stringify(MOCK.commentsByLesson[lessonId])) : [];
  const extra = STATE._comments?.[lessonId] ? JSON.parse(JSON.stringify(STATE._comments[lessonId])) : [];
  return base.concat(extra);
}

function renderComments(lessonId) {
  const wrap = ensureCommentsContainer();
  if (!wrap) return;

  const comments = getCommentsForLesson(lessonId);

  wrap.innerHTML = `
    <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
      <div>
        <div class="fw-bold">Dúvidas e comentários da turma</div>
        <div class="small text-muted">Visível para toda a turma</div>
      </div>
      <button class="btn btn-outline-primary btn-sm rounded-pill" id="btn-new-comment">
        <i class='bx bx-plus'></i> Nova dúvida/comentário
      </button>
    </div>
    <div class="mt-2 d-grid gap-2" id="comments-list"></div>
  `;

  const list = document.getElementById("comments-list");
  if (!list) return;

  if (!comments.length) {
    list.innerHTML = `
      <div class="alert alert-light border mb-0">
        Ainda não há comentários nesta aula. Seja o primeiro(a).
      </div>
    `;
  } else {
    list.innerHTML = comments.map((c) => {
      const replies = (c.replies || []).map((r) => `
        <div class="border rounded-3 p-2 bg-white">
          <div class="d-flex justify-content-between">
            <div class="fw-bold small">${escapeHtml(r.author)} <span class="text-muted fw-normal">• ${escapeHtml(r.time || "")}</span></div>
          </div>
          <div class="small">${escapeHtml(r.text)}</div>
        </div>
      `).join("");

      return `
        <div class="border rounded-3 p-3 bg-white">
          <div class="d-flex justify-content-between gap-2">
            <div class="fw-bold">${escapeHtml(c.author)} <span class="text-muted fw-normal">• ${escapeHtml(c.time || "")}</span></div>
            <button class="btn btn-outline-secondary btn-sm rounded-pill" data-reply="${c.id}">
              <i class='bx bx-reply'></i> Responder
            </button>
          </div>
          <div class="mt-2">${escapeHtml(c.text)}</div>
          ${replies ? `<div class="mt-2 d-grid gap-2">${replies}</div>` : ""}
        </div>
      `;
    }).join("");
  }

  const btnNew = document.getElementById("btn-new-comment");
  if (btnNew) btnNew.addEventListener("click", () => openCommentModal({ lessonId }));

  list.querySelectorAll("[data-reply]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const parentId = btn.getAttribute("data-reply");
      openCommentModal({ lessonId, parentId });
    });
  });
}

function renderLessonContent(lesson) {
  clearLessonAreas();
  setLessonHeader(lesson);
  setFinishButtonForLesson(lesson);

  const player = $("player-frame");
  const area = $("activity-area");

  if (!area) return;

  // Conteúdo por tipo
  if (lesson.type === "VIDEO_AULA") {
    const src = toEmbedUrl(lesson.videoUrl || "");
    if (player) {
      player.style.display = "";
      player.innerHTML = `
        <iframe src="${src}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      `;
    }
    area.innerHTML = `
      <div class="alert alert-light border mb-0">
        <b>Dica:</b> ao terminar o vídeo, clique em <b>Concluir Aula</b>.
      </div>
    `;
  }

  else if (lesson.type === "PDF") {
    const src = lesson.pdfUrl || "";
    if (player) {
      player.style.display = "";
      player.innerHTML = `<iframe class="pdf-viewer" src="${src}"></iframe>`;
    }
    area.innerHTML = `
      <div class="alert alert-light border mb-0">
        Leia o material e clique em <b>Concluir Aula</b>.
      </div>
    `;
  }

  else if (lesson.type === "AUDIO") {
    area.innerHTML = `
      <div class="audio-container">
        <div class="audio-icon"><i class='bx bx-music'></i></div>
        <div class="fw-bold mb-2">${escapeHtml(lesson.title)}</div>
        <audio controls style="width:100%;">
          <source src="${lesson.audioUrl || ""}" type="audio/mpeg">
        </audio>
        <div class="small text-muted mt-2">Ao finalizar, clique em <b>Concluir Aula</b>.</div>
      </div>
    `;
  }

  else if (lesson.type === "TEXTO") {
    area.innerHTML = `
      <div class="border rounded-3 p-3 bg-white">
        ${lesson.textHtml || ""}
      </div>
    `;
  }

  else if (lesson.type === "QUIZ") {
    const done = isCompleted(lesson.id);
    area.innerHTML = `
      <div class="border rounded-3 p-3 bg-white">
        <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
          <div>
            <div class="fw-bold">Quiz</div>
            <div class="small text-muted">${escapeHtml(lesson.description || "")}</div>
          </div>
          <button class="btn btn-primary rounded-pill" id="btn-open-activity">
            <i class='bx bx-play'></i> ${done ? "Refazer" : "Iniciar"}
          </button>
        </div>
      </div>
    `;
    document.getElementById("btn-open-activity")?.addEventListener("click", () => openActivityDrawer(lesson));
  }

  else if (lesson.type === "TASK") {
    const done = isCompleted(lesson.id);
    area.innerHTML = `
      <div class="border rounded-3 p-3 bg-white">
        <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap">
          <div>
            <div class="fw-bold">Tarefa</div>
            <div class="small text-muted">${escapeHtml(lesson.description || "")}</div>
          </div>
          <button class="btn btn-primary rounded-pill" id="btn-open-activity">
            <i class='bx bx-play'></i> ${done ? "Refazer" : "Iniciar"}
          </button>
        </div>
      </div>
    `;
    document.getElementById("btn-open-activity")?.addEventListener("click", () => openActivityDrawer(lesson));
  }

  else {
    area.innerHTML = `
      <div class="alert alert-light border mb-0">
        Conteúdo em desenvolvimento.
      </div>
    `;
  }

  // Comentários sempre abaixo (inclusive para quiz/tarefa, como você pediu)
  renderComments(lesson.id);

  updatePrevNextButtons();
}

/* ===================== ACTIVE ITEM + NAV ===================== */
function setActiveLessonItem(lessonId) {
  const list = $("modules-list");
  if (!list) return;
  list.querySelectorAll(".lesson-item.active").forEach((el) => el.classList.remove("active"));
  const el = list.querySelector(`[data-lesson-id="${lessonId}"]`);
  if (el) el.classList.add("active");
}

function openLesson(lessonId) {
  const lesson = getLessonById(lessonId);
  if (!lesson) return;
  if (!isAccessible(lesson)) return;

  CURRENT = lesson;
  setCurrentLesson(lessonId);
  setActiveLessonItem(lessonId);

  // garante que a aba "Aula" está ativa ao trocar
  document.getElementById("tab-aula-btn")?.click();

  renderLessonContent(lesson);
}

function updatePrevNextButtons() {
  const prevBtn = $("btn-prev");
  const nextBtn = $("btn-next");
  if (!prevBtn || !nextBtn) return;
  if (!CURRENT) { prevBtn.disabled = true; nextBtn.disabled = true; return; }

  const idx = FLAT_LESSONS.findIndex((l) => l.id === CURRENT.id);
  const prev = idx > 0 ? FLAT_LESSONS[idx - 1] : null;
  const next = idx < FLAT_LESSONS.length - 1 ? FLAT_LESSONS[idx + 1] : null;

  prevBtn.disabled = !prev || !isAccessible(prev);
  nextBtn.disabled = !next || !isAccessible(next);

  prevBtn.onclick = () => prev && isAccessible(prev) && openLesson(prev.id);
  nextBtn.onclick = () => next && isAccessible(next) && openLesson(next.id);
}

function afterCompletionRefresh(lessonId) {
  // recalc progresso e gate
  updateHeaderProgress();
  renderModules();

  // reabre a mesma aula (atualiza badge e botão)
  openLesson(lessonId);

  // atualiza também notas (mock) pra refletir score salvo
  renderGrades();
}

/* ===================== MODULE LIST CLICK ===================== */
function bindLessonClicks() {
  const list = $("modules-list");
  if (!list) return;

  list.addEventListener("click", (e) => {
    const item = e.target.closest(".lesson-item");
    if (!item) return;
    const id = item.getAttribute("data-lesson-id");
    const lesson = getLessonById(id);
    if (!lesson) return;
    if (!isAccessible(lesson)) return;
    openLesson(id);
  });
}

/* ===================== MURAL (POST-IT + drag) ===================== */
function getMuralOrder() {
  if (Array.isArray(STATE.muralOrder) && STATE.muralOrder.length) return STATE.muralOrder;
  return MOCK.mural.map((p) => p.id);
}
function saveMuralOrder(order) {
  STATE.muralOrder = order;
  saveState(STATE);
}
function renderMural() {
  const wall = $("wall-container");
  if (!wall) return;

  const order = getMuralOrder();
  const map = new Map(MOCK.mural.map((p) => [p.id, p]));
  const posts = order.map((id) => map.get(id)).filter(Boolean);

  wall.innerHTML = "";

  let newCount = posts.filter((p) => p.isNew).length;
  const badge = $("mural-badge");
  if (badge) {
    badge.style.display = newCount ? "" : "none";
    badge.textContent = String(newCount);
  }

  posts.forEach((p) => {
    const el = document.createElement("div");
    el.className = `post-it ${p.color}`;
    el.draggable = true;
    el.dataset.id = p.id;

    el.innerHTML = `
      ${p.isNew ? `<div class="new-indicator">NOVO</div>` : ""}
      <div class="post-title">${escapeHtml(p.title)}</div>
      <div class="post-body">${escapeHtml(p.body)}</div>
      <div class="post-footer">
        <div class="post-tag">${escapeHtml(p.tag || "")}</div>
        <button class="post-btn" type="button" data-markread="${p.id}">Lido</button>
      </div>
    `;
    wall.appendChild(el);
  });

  // marcar como lido (mock)
  wall.querySelectorAll("[data-markread]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-markread");
      const post = MOCK.mural.find((x) => x.id === id);
      if (post) post.isNew = false;
      renderMural();
    });
  });

  // drag reorder
  let dragId = null;
  let placeholder = null;

  wall.addEventListener("dragstart", (e) => {
    const it = e.target.closest(".post-it");
    if (!it) return;
    dragId = it.dataset.id;
    it.style.opacity = "0.5";

    placeholder = document.createElement("div");
    placeholder.className = "postit-drop";
    wall.insertBefore(placeholder, it.nextSibling);

    e.dataTransfer.effectAllowed = "move";
  });

  wall.addEventListener("dragend", (e) => {
    const it = e.target.closest(".post-it");
    if (it) it.style.opacity = "";
    if (placeholder) placeholder.remove();
    placeholder = null;
    dragId = null;
  });

  wall.addEventListener("dragover", (e) => {
    e.preventDefault();
    const over = e.target.closest(".post-it");
    if (!over || !placeholder) return;

    const rect = over.getBoundingClientRect();
    const before = (e.clientY - rect.top) < (rect.height / 2);
    wall.insertBefore(placeholder, before ? over : over.nextSibling);
  });

  wall.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!dragId || !placeholder) return;

    const dragged = wall.querySelector(`.post-it[data-id="${dragId}"]`);
    if (!dragged) return;

    wall.insertBefore(dragged, placeholder);
    placeholder.remove();
    placeholder = null;

    // salva ordem
    const newOrder = [...wall.querySelectorAll(".post-it")].map((x) => x.dataset.id);
    saveMuralOrder(newOrder);
  });
}

/* ===================== NOTAS (alinhado) ===================== */
function renderGrades() {
  const root = $("grades-list");
  if (!root) return;

  // Atualiza notas do mock com scores reais salvos no STATE.quizScore
  const merged = MOCK.grades.map((g) => {
    if (STATE.quizScore?.[g.lessonId] != null) {
      return { ...g, score: STATE.quizScore[g.lessonId] };
    }
    if (isCompleted(g.lessonId) && (g.score === "—")) {
      // se concluiu algo que estava "—", deixa NSA como padrão (simulando avaliação pendente)
      return { ...g, score: g.score };
    }
    return g;
  });

  // agrupa por módulo
  const byModule = new Map();
  for (const g of merged) {
    if (!byModule.has(g.moduleId)) byModule.set(g.moduleId, []);
    byModule.get(g.moduleId).push(g);
  }

  let html = "";
  for (const mod of MOCK.modules) {
    const list = byModule.get(mod.id) || [];
    if (!list.length) continue;

    html += `
      <div class="mb-3">
        <div class="fw-bold mb-2">${escapeHtml(mod.title)}</div>
        <div class="table-responsive">
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th>Atividade</th>
                <th style="width:120px;" class="text-end">Valor</th>
                <th style="width:140px;" class="text-end">Pontuação</th>
              </tr>
            </thead>
            <tbody>
              ${list.map((g) => `
                <tr>
                  <td>${escapeHtml(g.title)}</td>
                  <td class="text-end">${escapeHtml(String(g.value))}</td>
                  <td class="text-end fw-bold">${escapeHtml(String(g.score))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  root.innerHTML = html || `<div class="alert alert-light border mb-0">Sem avaliações cadastradas.</div>`;
}

/* ===================== CALENDÁRIO (mock) ===================== */
function renderCalendar() {
  const root = $("calendar-list");
  if (!root) return;

  const cal = MOCK.calendar;
  const days = cal.days || [];
  const upcoming = cal.upcoming || [];

  const grid = days.map((d) => `
    <div class="border rounded-3 p-2 bg-white" style="width:52px; height:52px; display:flex; align-items:center; justify-content:center;">
      <div class="fw-bold">${d.n}</div>
    </div>
  `).join("");

  const up = upcoming.map((e) => `
    <div class="border rounded-3 p-3 bg-white d-flex gap-3 align-items-start">
      <span class="badge ${e.badgeClass}">${escapeHtml(e.badge)}</span>
      <div class="flex-grow-1">
        <div class="fw-bold">${escapeHtml(e.title)}</div>
        <div class="small text-muted">${escapeHtml(e.when)}</div>
        <div class="small">${escapeHtml(e.desc || "")}</div>
      </div>
    </div>
  `).join("");

  root.innerHTML = `
    <div class="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
      <div class="fw-bold">${escapeHtml(cal.monthLabel || "Calendário")}</div>
      <div class="small text-muted">Modelo visual (mock)</div>
    </div>

    <div class="d-flex flex-wrap gap-2 mb-3">${grid}</div>

    <div class="fw-bold mb-2">Próximos eventos</div>
    <div class="d-grid gap-2">${up || `<div class="alert alert-light border mb-0">Sem eventos próximos.</div>`}</div>
  `;
}

/* ===================== DRAWER (QUIZ/TASK) ===================== */
function adjustDrawerWidth() {
  const drawer = $("activity-drawer");
  const nav = $("course-nav");
  if (!drawer || !nav) return;

  const isMobile = window.matchMedia("(max-width: 992px)").matches;
  if (isMobile) {
    drawer.style.width = "";
    return;
  }

  const navW = Math.round(nav.getBoundingClientRect().width || 360);
  drawer.style.width = `calc(100vw - ${navW}px)`; // chega até o menu do curso
}

function openDrawer() {
  $("activity-drawer")?.classList.add("open");
  $("activity-backdrop")?.classList.add("show");
  $("activity-drawer")?.setAttribute("aria-hidden", "false");
}
function closeDrawer() {
  $("activity-drawer")?.classList.remove("open");
  $("activity-backdrop")?.classList.remove("show");
  $("activity-drawer")?.setAttribute("aria-hidden", "true");
}

function bindDrawerClose() {
  $("drawer-close")?.addEventListener("click", closeDrawer);
  $("activity-backdrop")?.addEventListener("click", closeDrawer);
}

function openActivityDrawer(lesson) {
  adjustDrawerWidth();
  openDrawer();

  const title = $("drawer-title");
  const subtitle = $("drawer-subtitle");
  const body = $("drawer-body");

  if (title) title.textContent = lesson.title || "Atividade";
  if (subtitle) subtitle.textContent = lesson.type === "QUIZ" ? "Responda uma questão por vez" : "Preencha uma etapa por vez";
  if (!body) return;

  if (lesson.type === "QUIZ") renderQuizWizard(lesson);
  else if (lesson.type === "TASK") renderTaskWizard(lesson);
  else body.innerHTML = `<div class="alert alert-light border">Atividade indisponível.</div>`;
}

function ensureLessonStep(mapObj, lessonId) {
  if (mapObj[lessonId] == null) mapObj[lessonId] = 0;
  return mapObj[lessonId];
}

function renderQuizWizard(lesson) {
  const body = $("drawer-body");
  const qz = lesson.quiz?.questions || [];
  if (!body) return;

  const step = ensureLessonStep(STATE.quizStep, lesson.id);
  const current = qz[step];

  if (!current) {
    // final
    const score = calcQuizScore(lesson);
    STATE.quizScore[lesson.id] = score;
    STATE.quizDone[lesson.id] = true;
    saveState(STATE);

    body.innerHTML = `
      <div class="border rounded-3 p-3 bg-white">
        <div class="fw-bold">Finalizado ✅</div>
        <div class="text-muted small">Pontuação (mock): <b>${score}</b> / ${lesson.points || 0}</div>
        <div class="mt-3 d-flex gap-2 justify-content-end">
          <button class="btn btn-outline-secondary rounded-pill" id="btn-quiz-review">Rever respostas</button>
          <button class="btn btn-primary rounded-pill" id="btn-quiz-done">Concluir</button>
        </div>
      </div>
    `;

    document.getElementById("btn-quiz-review")?.addEventListener("click", () => {
      STATE.quizStep[lesson.id] = 0;
      saveState(STATE);
      renderQuizWizard(lesson);
    });

    document.getElementById("btn-quiz-done")?.addEventListener("click", () => {
      markCompleted(lesson.id);
      saveState(STATE);
      closeDrawer();
      afterCompletionRefresh(lesson.id);
    });

    return;
  }

  const saved = STATE.quizAnswers?.[lesson.id]?.[step];

  body.innerHTML = `
    <div class="border rounded-3 p-3 bg-white">
      <div class="d-flex justify-content-between align-items-center">
        <div class="fw-bold">Questão ${step + 1} de ${qz.length}</div>
        <span class="badge bg-light text-dark border">Quiz</span>
      </div>

      <div class="mt-3 fw-bold">${escapeHtml(current.q)}</div>

      <div class="mt-2 d-grid gap-2">
        ${(current.options || []).map((opt, idx) => `
          <label class="border rounded-3 p-2 bg-white d-flex gap-2 align-items-center" style="cursor:pointer;">
            <input type="radio" name="quizopt" value="${idx}" ${String(saved) === String(idx) ? "checked" : ""} />
            <span>${escapeHtml(opt)}</span>
          </label>
        `).join("")}
      </div>

      <div class="mt-3 d-flex justify-content-between">
        <button class="btn btn-outline-secondary rounded-pill" id="btn-quiz-prev" ${step === 0 ? "disabled" : ""}>Voltar</button>
        <button class="btn btn-primary rounded-pill" id="btn-quiz-next">${step === qz.length - 1 ? "Finalizar" : "Próxima"}</button>
      </div>
    </div>
  `;

  document.getElementById("btn-quiz-prev")?.addEventListener("click", () => {
    STATE.quizStep[lesson.id] = Math.max(0, step - 1);
    saveState(STATE);
    renderQuizWizard(lesson);
  });

  document.getElementById("btn-quiz-next")?.addEventListener("click", () => {
    const sel = body.querySelector('input[name="quizopt"]:checked');
    if (!sel) {
      body.insertAdjacentHTML("afterbegin", `<div class="alert alert-warning border">Selecione uma opção para continuar.</div>`);
      return;
    }
    const v = Number(sel.value);
    if (!STATE.quizAnswers[lesson.id]) STATE.quizAnswers[lesson.id] = {};
    STATE.quizAnswers[lesson.id][step] = v;

    STATE.quizStep[lesson.id] = step + 1;
    saveState(STATE);
    renderQuizWizard(lesson);
  });
}

function calcQuizScore(lesson) {
  const qz = lesson.quiz?.questions || [];
  const answers = STATE.quizAnswers?.[lesson.id] || {};
  let correct = 0;
  qz.forEach((q, idx) => {
    if (answers[idx] === q.correct) correct += 1;
  });
  const pts = Number(lesson.points || 0);
  if (qz.length === 0) return 0;
  return Math.round((correct / qz.length) * pts);
}

function renderTaskWizard(lesson) {
  const body = $("drawer-body");
  const task = lesson.task || {};
  const questions = task.questions || [];
  if (!body) return;

  const step = ensureLessonStep(STATE.taskStep, lesson.id);
  const q = questions[step];

  if (!q) {
    body.innerHTML = `
      <div class="border rounded-3 p-3 bg-white">
        <div class="fw-bold">Enviado ✅ (mock)</div>
        <div class="small text-muted">A avaliação/pontuação pode ficar como <b>NSA</b> até correção.</div>
        <div class="mt-3 d-flex justify-content-end gap-2">
          <button class="btn btn-outline-secondary rounded-pill" id="btn-task-review">Rever</button>
          <button class="btn btn-primary rounded-pill" id="btn-task-done">Concluir</button>
        </div>
      </div>
    `;

    document.getElementById("btn-task-review")?.addEventListener("click", () => {
      STATE.taskStep[lesson.id] = 0;
      saveState(STATE);
      renderTaskWizard(lesson);
    });

    document.getElementById("btn-task-done")?.addEventListener("click", () => {
      markCompleted(lesson.id);
      saveState(STATE);
      closeDrawer();
      afterCompletionRefresh(lesson.id);
    });

    return;
  }

  const saved = STATE.taskAnswers?.[lesson.id]?.[step] || "";

  body.innerHTML = `
    <div class="border rounded-3 p-3 bg-white">
      <div class="d-flex justify-content-between align-items-center">
        <div class="fw-bold">Etapa ${step + 1} de ${questions.length}</div>
        <span class="badge bg-light text-dark border">Tarefa</span>
      </div>

      <div class="mt-3 fw-bold">${escapeHtml(q.label || "")}</div>
      <div class="mt-2">
        <textarea class="form-control" rows="5" id="task-answer" placeholder="${escapeHtml(q.placeholder || "")}">${escapeHtml(saved)}</textarea>
      </div>

      <div class="mt-3 d-flex justify-content-between">
        <button class="btn btn-outline-secondary rounded-pill" id="btn-task-prev" ${step === 0 ? "disabled" : ""}>Voltar</button>
        <button class="btn btn-primary rounded-pill" id="btn-task-next">${step === questions.length - 1 ? "Finalizar" : "Próxima"}</button>
      </div>
    </div>
  `;

  document.getElementById("btn-task-prev")?.addEventListener("click", () => {
    STATE.taskStep[lesson.id] = Math.max(0, step - 1);
    saveState(STATE);
    renderTaskWizard(lesson);
  });

  document.getElementById("btn-task-next")?.addEventListener("click", () => {
    const val = (document.getElementById("task-answer")?.value || "").trim();
    if (!val) {
      body.insertAdjacentHTML("afterbegin", `<div class="alert alert-warning border">Preencha a resposta para continuar.</div>`);
      return;
    }
    if (!STATE.taskAnswers[lesson.id]) STATE.taskAnswers[lesson.id] = {};
    STATE.taskAnswers[lesson.id][step] = val;

    STATE.taskStep[lesson.id] = step + 1;
    saveState(STATE);
    renderTaskWizard(lesson);
  });
}

/* ===================== MODAL: COMENTAR / RESPONDER ===================== */
function ensureCommentModal() {
  let modalEl = document.getElementById("modalComment");
  if (modalEl) return modalEl;

  modalEl = document.createElement("div");
  modalEl.className = "modal fade";
  modalEl.id = "modalComment";
  modalEl.tabIndex = -1;
  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <div class="fw-bold" id="modalCommentTitle">Comentário</div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
        </div>
        <div class="modal-body">
          <textarea class="form-control" rows="5" id="commentText" placeholder="Digite sua dúvida ou comentário..."></textarea>
          <div class="small text-muted mt-2">Este comentário será visível para toda a turma.</div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
          <button class="btn btn-primary" id="btnCommentSend">Enviar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);
  return modalEl;
}

function openCommentModal({ lessonId, parentId = null }) {
  const modalEl = ensureCommentModal();
  const title = modalEl.querySelector("#modalCommentTitle");
  const txt = modalEl.querySelector("#commentText");
  const btn = modalEl.querySelector("#btnCommentSend");

  if (title) title.textContent = parentId ? "Responder" : "Nova dúvida/comentário";
  if (txt) txt.value = "";

  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  btn.onclick = () => {
    const v = (txt.value || "").trim();
    if (!v) return;

    if (!STATE._comments[lessonId]) STATE._comments[lessonId] = [];

    if (!parentId) {
      STATE._comments[lessonId].push({
        id: `u${Date.now()}`,
        author: "Você",
        time: "agora",
        text: v,
        replies: [],
      });
    } else {
      const list = STATE._comments[lessonId];
      const parent = list.find((x) => x.id === parentId);
      if (parent) {
        if (!parent.replies) parent.replies = [];
        parent.replies.push({ id: `r${Date.now()}`, author: "Você", time: "agora", text: v });
      } else {
        // Se a dúvida original for do MOCK, cria um bloco "espelho" no STATE para permitir responder
        STATE._comments[lessonId].push({
          id: parentId,
          author: "(thread)",
          time: "",
          text: "(comentário do mural original)",
          replies: [{ id: `r${Date.now()}`, author: "Você", time: "agora", text: v }],
        });
      }
    }

    saveState(STATE);
    modal.hide();
    renderComments(lessonId);
  };
}

/* ===================== MODAL: CONTATO (Professor/Tutor) ===================== */
function ensureContactModal() {
  let modalEl = document.getElementById("modalContact");
  if (modalEl) return modalEl;

  modalEl = document.createElement("div");
  modalEl.className = "modal fade";
  modalEl.id = "modalContact";
  modalEl.tabIndex = -1;

  modalEl.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <div class="fw-bold">Contato com Professor/Tutoria</div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
        </div>
        <div class="modal-body">
          <div class="small text-muted mb-2">Escolha um destinatário:</div>
          <select class="form-select" id="contactTo"></select>

          <div class="small text-muted mt-3 mb-2">Mensagem:</div>
          <textarea class="form-control" rows="5" id="contactMsg" placeholder="Escreva sua mensagem..."></textarea>

          <div class="alert alert-light border mt-3 mb-0">
            <b>Obs.:</b> este envio é um <b>mock</b> no layout. Depois ligamos com Supabase.
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline-secondary" data-bs-dismiss="modal">Fechar</button>
          <button class="btn btn-primary" id="btnContactSend">Enviar</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modalEl);
  return modalEl;
}

function openContactModal() {
  const modalEl = ensureContactModal();
  const sel = modalEl.querySelector("#contactTo");
  const msg = modalEl.querySelector("#contactMsg");
  const btn = modalEl.querySelector("#btnContactSend");

  sel.innerHTML = MOCK.staff.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} — ${escapeHtml(s.role)}</option>`).join("");
  msg.value = "";

  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  btn.onclick = () => {
    const text = (msg.value || "").trim();
    if (!text) return;
    btn.disabled = true;
    btn.textContent = "Enviando...";
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = "Enviar";
      modal.hide();
    }, 500);
  };
}

/* ===================== INIT ===================== */
function init() {
  renderHeader();
  mountTabActions();
  bindNavToggle();
  bindDrawerClose();

  renderModules();
  bindLessonClicks();

  renderMural();
  renderGrades();
  renderCalendar();

  // Ajusta drawer (para alcançar o menu do curso)
  adjustDrawerWidth();
  window.addEventListener("resize", adjustDrawerWidth);

  // inicia na primeira acessível
  const startId = STATE.currentLessonId && getLessonById(STATE.currentLessonId) && isAccessible(getLessonById(STATE.currentLessonId))
    ? STATE.currentLessonId
    : firstAccessibleLessonId();

  if (startId) openLesson(startId);
  else updatePrevNextButtons();
}

document.addEventListener("DOMContentLoaded", init);
