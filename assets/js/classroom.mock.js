// assets/js/classroom.mock.js
// Mock 100% visual: sem Supabase, sem login, sem redirects.

const $ = (id) => document.getElementById(id);

const ICONS = {
  VIDEO_AULA: "bx-play-circle",
  PDF: "bxs-file-pdf",
  QUIZ: "bx-trophy",
  AUDIO: "bx-headphone",
  TASK: "bx-edit",
  default: "bx-file",
};

const DEMO = {
  className: "Turma 2026/1 • Noite",
  courseTitle: "Auxiliar de Almoxarifado",
  modules: [
    {
      title: "Módulo 1 — Boas-vindas e organização do curso",
      sections: [
        {
          title: "Seção 1.1 — Introdução",
          lessons: [
            {
              id: 1,
              type: "VIDEO_AULA",
              title: "1. Boas-vindas e apresentação",
              description:
                "Nesta aula de abertura, você vai entender a proposta do curso, a organização por módulos, como funciona a conclusão de aulas e onde encontrar materiais e avisos.",
              video_url: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
            },
            {
              id: 2,
              type: "PDF",
              title: "2. Guia do estudante (PDF)",
              description: "Documento de apoio (mock) para visualizar o layout.",
              content_url: "#",
            },
            {
              id: 3,
              type: "QUIZ",
              title: "3. Quiz diagnóstico",
              description: "Exemplo de quiz para testar a gaveta de atividade.",
              points: 10,
            },
          ],
        },
        {
          title: "Seção 1.2 — Rotina e avaliações",
          lessons: [
            {
              id: 4,
              type: "TASK",
              title: "4. Tarefa: Plano de estudos",
              description:
                "Exemplo de tarefa (mock). Depois entra envio/feedback real.",
              points: 20,
            },
            {
              id: 5,
              type: "VIDEO_AULA",
              title: "5. Aula bloqueada (mock)",
              description:
                "Aqui simulamos uma aula bloqueada só para enxergar o estado visual.",
              locked: true,
              video_url: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
            },
          ],
        },
      ],
    },
    {
      title: "Módulo 2 — Recebimento e expedição",
      sections: [
        {
          title: "Seção 2.1 — Conceitos",
          lessons: [
            {
              id: 6,
              type: "VIDEO_AULA",
              title: "1. Conferência e documentação",
              description:
                "Conteúdo de exemplo para ver o player e a área de atividade.",
              video_url: "https://www.youtube.com/watch?v=ysz5S6PUM-U",
            },
            {
              id: 7,
              type: "AUDIO",
              title: "2. Áudio: revisão rápida",
              description:
                "Exemplo de layout do player de áudio (mock).",
              audio_url: "#",
            },
          ],
        },
      ],
    },
  ],
  wallPosts: [
    {
      color: "post-yellow",
      isNew: true,
      title: "Boas-vindas!",
      body: "Leia o Guia do Estudante antes de iniciar o Módulo 2.",
      tag: "AVISO • 02/02",
      action: "Abrir",
    },
    {
      color: "post-blue",
      isNew: false,
      title: "Aula ao vivo",
      body: "Segunda, terça e quarta • 18h às 20h (mock).",
      tag: "EVENTO • 05/02",
      action: "Ver link",
    },
    {
      color: "post-green",
      isNew: false,
      title: "Material extra",
      body: "Checklist de recebimento e expedição (PDF) disponível no Módulo 2.",
      tag: "MATERIAL",
      action: "Abrir",
    },
  ],
  grades: [
    { mod: "Módulo 1", sec: "1.1", name: "Quiz diagnóstico", value: 10, score: 7, status: "Concluído" },
    { mod: "Módulo 1", sec: "1.2", name: "Tarefa: Plano de estudos", value: 20, score: "NSA", status: "Pendente" },
    { mod: "Módulo 2", sec: "2.1", name: "Quiz: Conferência", value: 15, score: "—", status: "Não iniciado" },
  ],
  calendar: [
    { title: "Aula ao vivo (mock)", when: "05/02/2026 • 18:00–20:00", badge: "Encontro", text: "Tema: organização do curso e dúvidas iniciais." },
    { title: "Prazo do Quiz diagnóstico", when: "07/02/2026 • até 23:59", badge: "Prazo", text: "Responder o quiz do Módulo 1." },
  ],
};

// estado mock
let flatLessons = [];
let currentIndex = -1;
const completed = new Set([2]); // marca uma como concluída só pra enxergar o estado

document.addEventListener("DOMContentLoaded", () => {
  // Cabeçalho
  $("header-class-name").textContent = DEMO.className;
  $("header-course-title").textContent = DEMO.courseTitle;

  // Render UI
  renderModules();
  renderMural();
  renderGrades();
  renderCalendar();

  // Eventos
  wireCourseNavToggle();
  wireDrawer();
  wirePrevNext();
  wireFinish();

  // abre primeira aula disponível
  const firstOpen = flatLessons.find(l => !l.locked) || flatLessons[0];
  if (firstOpen) openLessonById(firstOpen.id);
});

function renderModules() {
  const container = $("modules-list");
  container.innerHTML = "";
  flatLessons = [];

  DEMO.modules.forEach((mod, mIdx) => {
    const modId = `m-${mIdx + 1}`;
    const headId = `${modId}-head`;
    const collapseId = `${modId}-collapse`;

    const item = document.createElement("div");
    item.className = "accordion-item";
    item.innerHTML = `
      <h2 class="accordion-header" id="${headId}">
        <button class="accordion-button ${mIdx === 0 ? "" : "collapsed"}" type="button"
                data-bs-toggle="collapse" data-bs-target="#${collapseId}"
                aria-expanded="${mIdx === 0 ? "true" : "false"}">
          ${escapeHtml(mod.title)}
        </button>
      </h2>
      <div id="${collapseId}" class="accordion-collapse collapse ${mIdx === 0 ? "show" : ""}" aria-labelledby="${headId}">
        <div class="accordion-body p-0" data-mod="${mIdx}"></div>
      </div>
    `;
    container.appendChild(item);

    const body = item.querySelector(".accordion-body");

    mod.sections.forEach((sec, sIdx) => {
      const secTitle = document.createElement("div");
      secTitle.className = "section-title";
      secTitle.textContent = sec.title;
      body.appendChild(secTitle);

      sec.lessons.forEach((lesson) => {
        flatLessons.push({ ...lesson, _mod: mIdx, _sec: sIdx });

        const isDone = completed.has(lesson.id);
        const icon = ICONS[lesson.type] || ICONS.default;

        const row = document.createElement("div");
        row.className = `lesson-item ${isDone ? "completed" : ""} ${lesson.locked ? "locked" : ""}`;
        row.dataset.lessonId = String(lesson.id);
        row.innerHTML = `
          <i class='bx ${icon} fs-5'></i>
          <span class="text-truncate flex-grow-1">${escapeHtml(lesson.title)}</span>
          ${isDone ? "<i class='bx bxs-check-circle text-success'></i>" : ""}
        `;
        body.appendChild(row);
      });
    });
  });

  // Clique nas aulas (delegação)
  container.addEventListener("click", (e) => {
    const item = e.target.closest(".lesson-item");
    if (!item) return;
    if (item.classList.contains("locked")) return;
    openLessonById(Number(item.dataset.lessonId));
  });

  updateProgress();
}

function openLessonById(id) {
  const idx = flatLessons.findIndex((l) => l.id === id);
  if (idx < 0) return;
  currentIndex = idx;
  const lesson = flatLessons[currentIndex];
  renderLesson(lesson);
  updatePrevNext();
  updateFinishButton();
}

function renderLesson(lesson) {
  // ativa no menu
  document.querySelectorAll(".lesson-item").forEach((el) => el.classList.remove("active"));
  document.querySelector(`.lesson-item[data-lesson-id="${lesson.id}"]`)?.classList.add("active");

  // texto
  $("lbl-type").textContent = lesson.type.replaceAll("_", " ");
  $("lbl-title").textContent = lesson.title;

  const desc = $("lbl-desc");
  desc.style.display = "block";
  desc.innerHTML = `<p class="m-0">${escapeHtml(lesson.description || "")}</p>`;

  const player = $("player-frame");
  const area = $("activity-area");
  const btnDrawer = $("btn-open-drawer");

  // reset
  player.style.display = "none";
  player.innerHTML = "";
  area.innerHTML = "";
  btnDrawer.style.display = "none";

  if (lesson.type === "VIDEO_AULA" && lesson.video_url) {
    player.style.display = "block";
    player.innerHTML = `<iframe src="${getEmbedUrl(lesson.video_url)}" title="Vídeo" allowfullscreen></iframe>`;

    area.innerHTML = `
      <div class="row g-3">
        <div class="col-lg-6">
          <div class="p-3 border rounded-3 bg-light">
            <div class="fw-bold mb-1">Material complementar</div>
            <div class="text-muted small mb-3">Arquivo de apoio (mock)</div>
            <button class="btn btn-outline-primary w-100">
              <i class='bx bxs-file-pdf'></i> Abrir PDF (exemplo)
            </button>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="p-3 border rounded-3 bg-light">
            <div class="fw-bold mb-1">Checklist rápido</div>
            <div class="text-muted small mb-2">O que fazer nesta aula</div>
            <ul class="m-0 small">
              <li>Assistir ao vídeo completo</li>
              <li>Ler o material de apoio</li>
              <li>Marcar como concluído</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  if (lesson.type === "PDF") {
    area.innerHTML = `
      <div class="p-3 border rounded-3 bg-light">
        <div class="fw-bold mb-1">Leitura (PDF)</div>
        <div class="text-muted small mb-3">Botão de exemplo — depois entra o link real.</div>
        <a class="btn btn-outline-primary w-100 py-3" href="${lesson.content_url || "#"}" target="_blank">
          <i class='bx bxs-file-pdf'></i> Abrir Material em PDF
        </a>
      </div>
    `;
  }

  if (lesson.type === "AUDIO") {
    area.innerHTML = `
      <div class="audio-container">
        <div class="audio-icon"><i class='bx bx-headphone'></i></div>
        <div class="fw-bold mb-1">Áudio (mock)</div>
        <div class="text-muted small mb-3">Depois entra player real/URL.</div>
        <audio controls style="width:100%">
          <source src="" type="audio/mpeg">
        </audio>
      </div>
    `;
  }

  if (lesson.type === "QUIZ" || lesson.type === "TASK") {
    area.innerHTML = `
      <div class="p-3 border rounded-3 bg-light">
        <div class="fw-bold mb-1">${lesson.type === "QUIZ" ? "Quiz (mock)" : "Tarefa (mock)"}</div>
        <div class="text-muted small mb-3">
          Aqui ainda não tem banco, então a atividade fica na gaveta só para testar layout.
        </div>
        <button class="btn btn-primary rounded-pill" id="btn-open-drawer-inner">
          <i class='bx bx-layer-plus'></i> Abrir gaveta
        </button>
      </div>
    `;

    btnDrawer.style.display = "inline-flex";

    // botão interno (renderizado agora)
    area.querySelector("#btn-open-drawer-inner")?.addEventListener("click", () => openDrawer(lesson));
    btnDrawer.onclick = () => openDrawer(lesson);
  }

  // fallback
  if (!area.innerHTML) {
    area.innerHTML = `
      <div class="empty-state">
        <i class='bx bx-file'></i>
        <div class="fw-bold">Conteúdo de exemplo</div>
        <div class="text-muted small">Tipo: ${escapeHtml(lesson.type)}</div>
      </div>
    `;
  }
}

function wireCourseNavToggle() {
  const nav = $("course-nav");
  const btn = $("btn-toggle-nav");
  const icon = $("navIcon");
  const layout = document.querySelector(".classroom-layout");

  btn?.addEventListener("click", () => {
    const closed = nav.classList.toggle("closed");
    // só para bater o olho no layout; CSS continua sendo o oficial
    layout.style.gridTemplateColumns = closed ? "76px 1fr" : "360px 1fr";
    icon.className = closed ? "bx bx-chevron-right" : "bx bx-chevron-left";
  });
}

function wirePrevNext() {
  $("btn-prev")?.addEventListener("click", () => {
    if (currentIndex <= 0) return;
    const prev = findPrevIndex(currentIndex);
    if (prev >= 0) openLessonById(flatLessons[prev].id);
  });

  $("btn-next")?.addEventListener("click", () => {
    if (currentIndex < 0) return;
    const next = findNextIndex(currentIndex);
    if (next >= 0) openLessonById(flatLessons[next].id);
  });
}

function findPrevIndex(from) {
  for (let i = from - 1; i >= 0; i--) {
    if (!flatLessons[i].locked) return i;
  }
  return -1;
}

function findNextIndex(from) {
  for (let i = from + 1; i < flatLessons.length; i++) {
    if (!flatLessons[i].locked) return i;
  }
  return -1;
}

function updatePrevNext() {
  const prevBtn = $("btn-prev");
  const nextBtn = $("btn-next");
  prevBtn.disabled = findPrevIndex(currentIndex) < 0;
  nextBtn.disabled = findNextIndex(currentIndex) < 0;
}

function wireFinish() {
  $("btn-finish")?.addEventListener("click", () => {
    if (currentIndex < 0) return;
    const lesson = flatLessons[currentIndex];
    completed.add(lesson.id);
    renderModules();         // atualiza ícone/check
    openLessonById(lesson.id); // mantém selecionado
    updateProgress();
  });
}

function updateFinishButton() {
  const btn = $("btn-finish");
  if (!btn || currentIndex < 0) return;

  const lesson = flatLessons[currentIndex];
  const isDone = completed.has(lesson.id);

  if (isDone) {
    btn.innerHTML = "<i class='bx bx-check'></i> Concluído";
    btn.classList.remove("btn-outline-success");
    btn.classList.add("btn-success");
  } else {
    btn.innerHTML = "<i class='bx bx-check'></i> Concluir Aula";
    btn.classList.remove("btn-success");
    btn.classList.add("btn-outline-success");
  }
}

function updateProgress() {
  const total = flatLessons.filter(l => !l.locked).length || 1;
  const done = [...completed].filter(id => flatLessons.some(l => l.id === id && !l.locked)).length;
  const pct = Math.round((done / total) * 100);

  $("overall-progress").style.width = `${pct}%`;
  $("progress-text").textContent = `${pct}%`;
}

function renderMural() {
  const container = $("wall-container");
  container.innerHTML = "";

  // badge do mural
  const badge = $("mural-badge");
  const newCount = DEMO.wallPosts.filter(p => p.isNew).length;
  if (newCount > 0) {
    badge.style.display = "inline-block";
    badge.textContent = String(newCount);
  } else {
    badge.style.display = "none";
  }

  DEMO.wallPosts.forEach((p) => {
    const div = document.createElement("div");
    div.className = `post-it ${p.color}`;
    div.innerHTML = `
      ${p.isNew ? `<div class="new-indicator">NOVO</div>` : ""}
      <div class="post-title">${escapeHtml(p.title)}</div>
      <div class="post-body">${escapeHtml(p.body)}</div>
      <div class="post-footer">
        <span class="post-tag">${escapeHtml(p.tag)}</span>
        <button class="post-btn" type="button">${escapeHtml(p.action)}</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderGrades() {
  const box = $("grades-list");
  box.innerHTML = `
    <div class="d-flex align-items-center justify-content-between mb-2">
      <div class="fw-bold">Notas e Pontuações</div>
      <div class="small text-muted">Mock (sem regras reais ainda)</div>
    </div>

    <div class="table-responsive">
      <table class="table table-sm align-middle">
        <thead>
          <tr class="text-muted">
            <th>Módulo</th>
            <th>Seção</th>
            <th>Atividade</th>
            <th class="text-end">Valor</th>
            <th class="text-end">Sua pontuação</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          ${DEMO.grades.map(g => `
            <tr>
              <td>${escapeHtml(g.mod)}</td>
              <td>${escapeHtml(g.sec)}</td>
              <td>${escapeHtml(g.name)}</td>
              <td class="text-end">${escapeHtml(String(g.value))}</td>
              <td class="text-end">${escapeHtml(String(g.score))}</td>
              <td>${renderStatusBadge(g.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderCalendar() {
  const box = $("calendar-list");
  box.className = "d-grid gap-2";
  box.innerHTML = DEMO.calendar.map(ev => `
    <div class="p-3 border rounded-3 bg-light">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <div class="fw-bold">${escapeHtml(ev.title)}</div>
          <div class="small text-muted">${escapeHtml(ev.when)}</div>
        </div>
        <span class="badge bg-primary">${escapeHtml(ev.badge)}</span>
      </div>
      <div class="small mt-2">${escapeHtml(ev.text)}</div>
    </div>
  `).join("");
}

function wireDrawer() {
  const closeBtn = $("drawer-close");
  const backdrop = $("activity-backdrop");

  closeBtn?.addEventListener("click", closeDrawer);
  backdrop?.addEventListener("click", closeDrawer);
}

function openDrawer(lesson) {
  $("drawer-title").textContent = lesson.type === "QUIZ" ? "Quiz (mock)" : "Tarefa (mock)";
  $("drawer-subtitle").textContent = "Somente visual — sem banco ainda";
  $("drawer-body").innerHTML = `
    <div class="p-3 border rounded-3 bg-white">
      <div class="fw-bold mb-2">${escapeHtml(lesson.title)}</div>
      <div class="text-muted small mb-3">
        Depois a gente conecta isso ao Supabase (tentativas, nota, conclusão, etc.).
      </div>

      <div class="mb-2 fw-bold">Exemplo de pergunta</div>
      <div class="d-grid gap-2">
        <button class="btn btn-outline-secondary text-start">A) Alternativa 1</button>
        <button class="btn btn-outline-secondary text-start">B) Alternativa 2</button>
        <button class="btn btn-outline-secondary text-start">C) Alternativa 3</button>
      </div>

      <div class="d-flex justify-content-end gap-2 mt-3">
        <button class="btn btn-light border" type="button" id="drawer-close-inner">Fechar</button>
        <button class="btn btn-primary" type="button">Confirmar (mock)</button>
      </div>
    </div>
  `;

  $("drawer-body").querySelector("#drawer-close-inner")?.addEventListener("click", closeDrawer);

  $("activity-drawer").classList.add("open");
  $("activity-backdrop").classList.add("show");
  $("activity-drawer").setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  $("activity-drawer").classList.remove("open");
  $("activity-backdrop").classList.remove("show");
  $("activity-drawer").setAttribute("aria-hidden", "true");
}

function getEmbedUrl(url) {
  try {
    if (!url) return "";
    // youtube watch -> embed
    if (url.includes("watch?v=")) return url.replace("watch?v=", "embed/");
    // share youtu.be
    if (url.includes("youtu.be/")) {
      const id = url.split("youtu.be/")[1].split(/[?&]/)[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    return url;
  } catch {
    return url;
  }
}

function renderStatusBadge(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("concl")) return `<span class="badge bg-success">Concluído</span>`;
  if (s.includes("pend")) return `<span class="badge bg-secondary">Pendente</span>`;
  return `<span class="badge bg-light text-dark border">${escapeHtml(status)}</span>`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
