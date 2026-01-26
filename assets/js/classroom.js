/* ============================================================
   AVA3 • classroom.js (SUPABASE + INTELIGÊNCIA REAL)
   - Conecta ao Banco de Dados
   - Mantém Gavetas (Wizard), Mural e Layout corrigido
   ============================================================ */

import { supabase } from './supabaseClient.js';

/* ===================== ESTADO GLOBAL ===================== */
const STATE = {
  classId: null,
  enrollmentId: null,
  course: null,
  modules: [],      
  flatLessons: [],  
  user: null,
  
  // Progresso do Aluno (DB)
  progress: { 
    completed: [], 
    quizData: {}, 
    tasks: {},
    lastLessonId: null
  },

  // Mock Visual (Mantido para não quebrar UI)
  mural: [
    { id: "p1", color: "post-yellow", title: "Aviso", body: "Bem-vindo ao curso!", tag: "GERAL", isNew: true }
  ],
  calendar: {
    monthLabel: "Março 2026",
    days: Array.from({ length: 30 }, (_, i) => ({ n: i + 1, events: [] })),
    upcoming: []
  },
  
  currentLessonId: null
};

const $ = (id) => document.getElementById(id);

// Ícones (Apenas para o menu lateral)
const ICONS = {
  VIDEO_AULA: "bx-play-circle", VIDEO: "bx-play-circle",
  PDF: "bxs-file-pdf", AUDIO: "bx-music",
  TEXTO: "bx-book-open", QUIZ: "bx-trophy",
  TAREFA: "bx-edit", TASK: "bx-edit",
  MATERIAL: "bx-link", default: "bx-file",
};

/* ===================== INICIALIZAÇÃO ===================== */
document.addEventListener("DOMContentLoaded", async () => {
  await init();
});

async function init() {
  try {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      window.location.href = 'login.html';
      return;
    }
    STATE.user = session.user;

    const params = new URLSearchParams(window.location.search);
    STATE.classId = params.get('id');
    if (!STATE.classId) throw new Error("ID da turma não encontrado.");

    await Promise.all([fetchClassStructure(), fetchEnrollment()]);
    processStructure();

    renderHeader();
    renderModules(); 
    renderGrades();
    renderMural();
    renderCalendar();
    updateHeaderProgress();

    const startId = resolveStartLesson();
    if (startId) renderLesson(startId);

    setupEvents();
    setupNavToggle();

  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<div class="p-5 text-center"><h3>Erro de Carregamento</h3><p>${err.message}</p><a href="app.html" class="btn btn-primary">Voltar</a></div>`;
  }
}

/* ===================== FETCHING ===================== */

async function fetchClassStructure() {
  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select(`*, courses (*)`)
    .eq('id', STATE.classId)
    .single();

  if (classError || !classData) throw new Error("Turma não encontrada.");
  STATE.course = { ...classData.courses, className: classData.name };

  const { data: modules, error: modError } = await supabase
    .from('modules')
    .select(`*, sections (*, lessons (*))`)
    .eq('course_id', STATE.course.id)
    .order('ordem', { ascending: true });

  if (modError) throw new Error("Erro ao carregar conteúdo.");
  STATE.modules = modules || [];
}

async function fetchEnrollment() {
  const { data } = await supabase
    .from('class_enrollments')
    .select('*')
    .eq('class_id', STATE.classId)
    .eq('user_id', STATE.user.id)
    .single();

  if (data) {
    STATE.enrollmentId = data.id;
    const g = data.grades || {};
    STATE.progress.completed = g.completed || [];
    STATE.progress.quizData = g.quiz_scores || {};
    STATE.progress.tasks = g.tasks || {};
  }
}

function processStructure() {
  STATE.flatLessons = [];
  STATE.modules.forEach(mod => {
    const sections = (mod.sections || []).sort((a, b) => (a.ordem||0) - (b.ordem||0));
    sections.forEach(sec => {
      const lessons = (sec.lessons || []).sort((a, b) => (a.ordem||0) - (b.ordem||0));
      lessons.forEach(l => {
        STATE.flatLessons.push({
          ...l,
          moduleId: mod.id,
          moduleTitle: mod.title,
          sectionTitle: sec.title,
          quiz: l.quiz_data || l.quiz,
          task: l.task_data || l.task
        });
      });
    });
  });
}

/* ===================== RENDER HEADER & NAV ===================== */

function renderHeader() {
  if($("header-class-name")) $("header-class-name").textContent = STATE.course.className;
  if($("header-course-title")) $("header-course-title").textContent = STATE.course.title;
}

function renderModules() {
  const container = $("modules-list");
  if(!container) return;
  container.innerHTML = "";

  STATE.modules.forEach((mod, idx) => {
    const modLessons = STATE.flatLessons.filter(l => l.moduleId === mod.id);
    const total = modLessons.length;
    const done = modLessons.filter(l => isCompleted(l.id)).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    const headId = `head-${mod.id}`;
    const collId = `coll-${mod.id}`;
    const current = STATE.flatLessons.find(l => l.id == STATE.currentLessonId);
    const isOpen = (current && current.moduleId === mod.id) || idx === 0;

    let bodyHtml = "";
    (mod.sections || []).forEach(sec => {
      bodyHtml += `<div class="section-title px-3 py-2 bg-light border-bottom small fw-bold text-muted">${sec.title || "Seção"}</div>`;
      (sec.lessons || []).forEach(l => {
         const isDone = isCompleted(l.id);
         const locked = !isAccessible(l);
         const icon = ICONS[l.type] || ICONS.default;

         bodyHtml += `
          <div class="lesson-item d-flex align-items-center px-3 py-2 border-bottom ${isDone?'bg-light':''} ${locked?'locked':''}" 
               data-lesson-id="${l.id}"
               onclick="${locked ? '' : `window.renderLesson('${l.id}')`}">
            <i class='bx ${icon} fs-5 me-2 ${isDone ? 'text-success' : 'text-secondary'}'></i>
            <span class="text-truncate flex-grow-1 small">${l.title}</span>
            ${locked ? "<i class='bx bx-lock-alt text-muted'></i>" : (isDone ? "<i class='bx bxs-check-circle text-success'></i>" : "")}
          </div>`;
      });
    });

    container.insertAdjacentHTML("beforeend", `
      <div class="accordion-item border-0 border-bottom">
        <h2 class="accordion-header" id="${headId}">
          <button class="accordion-button ${isOpen?"":"collapsed"} py-2 shadow-none bg-white text-dark" type="button"
            data-bs-toggle="collapse" data-bs-target="#${collId}">
            <span class="text-truncate fw-bold small me-2">${mod.title}</span>
            <span class="badge bg-light text-dark border ms-auto">${pct}%</span>
          </button>
        </h2>
        <div id="${collId}" class="accordion-collapse collapse ${isOpen?"show":""}">
          <div class="accordion-body p-0">${bodyHtml}</div>
        </div>
      </div>
    `);
  });
}

/* ===================== RENDER AULA (CORE) ===================== */

window.renderLesson = function(lessonId) {
  const lesson = STATE.flatLessons.find(l => l.id == lessonId);
  if (!lesson) return;

  STATE.currentLessonId = lesson.id;
  
  // Highlight
  document.querySelectorAll(".lesson-item").forEach(el => el.classList.remove("active-lesson"));
  const activeEl = document.querySelector(`[data-lesson-id="${lessonId}"]`);
  if(activeEl) activeEl.classList.add("active-lesson");

  try { bootstrap.Tab.getOrCreateInstance($("tab-aula-btn")).show(); } catch {}

  $("lbl-type").textContent = (lesson.type || "AULA").replace("_", " ");
  $("lbl-title").textContent = lesson.title;

  // Lógica de Descrição (Evita buraco branco)
  const descEl = $("lbl-desc");
  if (lesson.description && lesson.description.trim() !== "") {
      descEl.style.display = 'block';
      descEl.innerHTML = `<div class="mb-3 text-muted small">${lesson.description}</div>`;
  } else {
      descEl.style.display = 'none';
      descEl.innerHTML = "";
      descEl.removeAttribute("style"); 
  }

  // Lógica do Botão de Concluir
  const isDone = isCompleted(lesson.id);
  const isQuiz = (lesson.type === 'QUIZ');
  const btn = $("btn-finish");
  const badge = $("lesson-status");
  
  if(isQuiz) {
    btn.style.display = "none";
    badge.style.display = "inline-flex";
    badge.textContent = isDone ? "Concluído" : "Pendente";
    badge.className = isDone ? "badge bg-success" : "badge bg-secondary";
  } else {
    badge.style.display = isDone ? "inline-flex" : "none";
    badge.textContent = "Concluída";
    badge.className = "badge bg-success";
    btn.style.display = isDone ? "none" : "inline-flex";
    btn.disabled = false;
    btn.onclick = () => markCompleted(lesson.id);
  }

  // Conteúdo
  const area = $("activity-area");
  const player = $("player-frame");
  const extras = $("lesson-extras");
  
  area.style.display = "none"; player.style.display = "none";
  area.innerHTML = ""; player.innerHTML = "";
  if(extras) extras.style.display = isQuiz ? "none" : "block"; 
  if(!isQuiz && $("commentsThread")) renderComments(lesson.id);

  const url = lesson.video_url || lesson.content_url || "";
  const type = (lesson.type || "").toUpperCase();

  // 1. VÍDEO
  if (type.includes("VIDEO")) {
    player.style.display = "block";
    const embed = toEmbedUrl(url);
    player.innerHTML = embed 
      ? `<iframe src="${embed}" class="video-frame" allowfullscreen></iframe>`
      : `<div class="bg-black text-white p-5 text-center">Vídeo sem URL válida.</div>`;
  }

  // 2. PDF
  else if (type === "PDF" || type === "MATERIAL") {
    area.style.display = "block";
    let finalUrl = url;
    if(finalUrl.includes('drive.google.com')) finalUrl = finalUrl.replace(/\/view.*/, '/preview').replace(/\/edit.*/, '/preview');
    area.innerHTML = `<iframe class="pdf-viewer" src="${finalUrl}"></iframe>`;
  }

  // 3. TEXTO
  else if (type === "TEXTO") {
    area.style.display = "block";
    descEl.style.display = 'none'; 
    area.innerHTML = `
      <div class="p-4 bg-white border rounded shadow-sm content-text">
        ${lesson.description || lesson.content || "<p class='text-muted'>Conteúdo de texto.</p>"}
      </div>`;
  }

  // 4. QUIZ (Wizard)
  else if (type === "QUIZ") {
    area.style.display = "block";
    const score = STATE.progress.quizData[lesson.id];
    const done = score !== undefined;
    area.innerHTML = `
      <div class="p-5 border rounded bg-white text-center">
        <i class='bx bx-trophy text-warning mb-3' style="font-size:3rem"></i>
        <h4>${lesson.title}</h4>
        ${done 
          ? `<div class="alert alert-success d-inline-block px-4 mt-3">Nota: <strong>${score}</strong></div>`
          : `<button class="btn btn-primary rounded-pill px-5 mt-3" onclick="window.openQuizDrawer('${lesson.id}')">Iniciar Quiz</button>`
        }
      </div>`;
  }

  // 5. TAREFA (Wizard)
  else if (type === "TAREFA" || type === "TASK") {
    area.style.display = "block";
    area.innerHTML = `
      <div class="p-5 border rounded bg-white text-center">
        <i class='bx bx-edit text-info mb-3' style="font-size:3rem"></i>
        <h4>${lesson.title}</h4>
        <button class="btn btn-primary rounded-pill px-5 mt-3" onclick="window.openTaskDrawer('${lesson.id}')">Abrir Tarefa</button>
      </div>`;
  }

  renderPrevNext();
}

/* ===================== LOGICA AUXILIAR ===================== */

function isCompleted(id) { return STATE.progress.completed.includes(id); }

function isAccessible(l) {
  const idx = STATE.flatLessons.findIndex(x => x.id === l.id);
  if (idx <= 0) return true;
  return isCompleted(STATE.flatLessons[idx - 1].id);
}

function resolveStartLesson() {
  const p = STATE.flatLessons.find(l => isAccessible(l) && !isCompleted(l.id));
  return p ? p.id : (STATE.flatLessons[0]?.id || null);
}

async function markCompleted(id) {
  if(!isCompleted(id)) {
    STATE.progress.completed.push(id);
    renderLesson(id);
    renderModules();
    updateHeaderProgress();
    
    // Salvar no DB
    if(STATE.enrollmentId) {
      const pct = Math.round((STATE.progress.completed.length / STATE.flatLessons.length)*100);
      await supabase.from('class_enrollments').update({
        grades: { completed: STATE.progress.completed, quiz_scores: STATE.progress.quizData, tasks: STATE.progress.tasks },
        progress_percent: pct
      }).eq('id', STATE.enrollmentId);
    }
  }
}

function updateHeaderProgress() {
  const total = STATE.flatLessons.length;
  const done = STATE.progress.completed.length;
  const pct = total ? Math.round((done/total)*100) : 0;
  if($("overall-progress")) $("overall-progress").style.width = `${pct}%`;
  if($("progress-text")) $("progress-text").textContent = `${pct}%`;
}

// DRAWERS (Wizard)
window.openQuizDrawer = function(lessonId) {
  const lesson = STATE.flatLessons.find(l => l.id == lessonId);
  const questions = lesson.quiz?.questions || [];
  if(!questions.length) { alert("Quiz vazio."); return; }

  openDrawer("Quiz", lesson.title, `<div id="quizWizard"></div>`);
  const root = $("quizWizard");
  let idx = 0, answers = {};

  function renderStep() {
    const q = questions[idx];
    const opts = q.options.map((o, i) => `
      <label class="d-flex gap-2 p-3 border rounded mb-2 bg-white" style="cursor:pointer">
        <input type="radio" name="qOpt" value="${i}" ${answers[idx]===i?'checked':''}>
        <span>${o.text || o}</span>
      </label>`).join('');

    root.innerHTML = `
      <div class="p-3 bg-white rounded border">
        <h5 class="mb-3">Questão ${idx+1}</h5>
        <div class="fw-bold mb-3">${q.text || q.q}</div>
        <div class="mb-4">${opts}</div>
        <button class="btn btn-primary w-100" onclick="qNext()" id="btnQNext" disabled>Próxima</button>
      </div>`;
    root.querySelectorAll('input').forEach(input => {
        input.onchange = () => { answers[idx] = parseInt(input.value); $("btnQNext").disabled = false; }
    });
  }
  
  window.qNext = () => {
    if(idx < questions.length-1) { idx++; renderStep(); }
    else {
      let hits = 0;
      questions.forEach((q, i) => { if(q.options[answers[i]]?.isCorrect || answers[i]===q.correct) hits++; });
      const score = Math.round((hits / questions.length) * (lesson.points||0) * 10) / 10;
      STATE.progress.quizData[lesson.id] = score;
      markCompleted(lesson.id);
      closeDrawer();
      alert(`Nota: ${score}`);
    }
  };
  renderStep();
}

window.openTaskDrawer = function(lessonId) {
  const lesson = STATE.flatLessons.find(l => l.id == lessonId);
  openDrawer("Tarefa", lesson.title, `
    <div class="p-3 bg-white rounded border">
      <p>${lesson.description || "Envie sua resposta."}</p>
      <textarea id="taskText" class="form-control mb-3" rows="5"></textarea>
      <button class="btn btn-primary w-100" onclick="submitTask('${lesson.id}')">Enviar</button>
    </div>`);
}

window.submitTask = function(lessonId) {
  if(!$("taskText").value.trim()) return alert("Escreva algo.");
  STATE.progress.tasks[lessonId] = { text: $("taskText").value, date: new Date() };
  markCompleted(lessonId);
  closeDrawer();
}

function openDrawer(title, sub, html) {
  $("drawer-title").textContent = title;
  $("drawer-subtitle").textContent = sub;
  $("drawer-body").innerHTML = html;
  $("activity-backdrop").classList.add("show");
  $("activity-drawer").classList.add("open");
  $("activity-drawer").setAttribute("aria-hidden", "false");
}
$("drawer-close").onclick = closeDrawer;
$("activity-backdrop").onclick = closeDrawer;

function closeDrawer() {
  $("activity-backdrop").classList.remove("show");
  $("activity-drawer").classList.remove("open");
  $("activity-drawer").setAttribute("aria-hidden", "true");
}

function renderMural(){ if($("wall-container")) $("wall-container").innerHTML = STATE.mural.map(p=>`<div class="post-it ${p.color}"><div class="post-title">${p.title}</div><div>${p.body}</div></div>`).join(''); }
function renderCal(){ if($("calendar-list")) $("calendar-list").innerHTML = "Calendário Mock"; }
function renderGrades(){ if($("grades-list")) $("grades-list").innerHTML = "Notas Mock"; }
function renderComments(id){ if($("commentsThread")) $("commentsThread").innerHTML = `<div class="text-muted small text-center">Sem comentários.</div>`; }

function renderPrevNext() {
    const prev = $("btn-prev"); const next = $("btn-next");
    const acc = STATE.flatLessons.filter(l => isAccessible(l));
    const idx = acc.findIndex(l => l.id == STATE.currentLessonId);
    prev.disabled = idx <= 0;
    next.disabled = idx < 0 || idx >= acc.length - 1;
    prev.onclick = () => renderLesson(acc[idx-1].id);
    next.onclick = () => renderLesson(acc[idx+1].id);
}
function setupEvents() { $("btn-finish").onclick = () => markCompleted(STATE.currentLessonId); }
function setupNavToggle() { 
    const btn = $("btn-toggle-nav"); 
    if(btn) btn.onclick = () => document.querySelector(".course-nav").classList.toggle("closed"); 
}
function toEmbedUrl(url) {
  if (!url) return "";
  if (url.includes("youtube.com/watch")) return url.replace("watch?v=", "embed/");
  if (url.includes("youtu.be/")) return `https://www.youtube.com/embed/${url.split("youtu.be/")[1].split("?")[0]}`;
  return url;
}