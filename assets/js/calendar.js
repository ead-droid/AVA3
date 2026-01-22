import { supabase } from './supabaseClient.js';

let currentMonth = new Date(); 
let allEvents = []; 

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  setupFilters();
  setupNavigation();
  setupViewSwitch(); 
  
  // Inicia em modo Agenda por padrão
  const btnMonth = document.getElementById('btn-view-month');
  const btnAgenda = document.getElementById('btn-view-agenda');
  const calGridArea = document.getElementById('calendar-grid');
  const calWeekdays = document.querySelector('.cal-weekdays');
  const agendaWrap = document.getElementById('agenda-wrap');

  btnAgenda?.classList.replace('btn-outline-primary', 'btn-primary');
  btnMonth?.classList.replace('btn-primary', 'btn-outline-primary');

  if(calWeekdays) calWeekdays.style.display = 'none';
  if(calGridArea) calGridArea.style.display = 'none';
  if(agendaWrap) agendaWrap.style.display = 'block';

  await loadUnifiedCalendar(session.user.id);
});

// --- LÓGICA DE TROCA DE VISÃO ---
function setupViewSwitch() {
  const btnMonth = document.getElementById('btn-view-month');
  const btnAgenda = document.getElementById('btn-view-agenda');
  const calGridArea = document.getElementById('calendar-grid');
  const calWeekdays = document.querySelector('.cal-weekdays');
  const agendaWrap = document.getElementById('agenda-wrap');

  btnMonth?.addEventListener('click', () => {
    btnMonth.classList.add('btn-primary');
    btnMonth.classList.remove('btn-outline-primary');
    btnAgenda.classList.add('btn-outline-primary');
    btnAgenda.classList.remove('btn-primary');
    if(calWeekdays) calWeekdays.style.display = 'grid';
    if(calGridArea) calGridArea.style.display = 'grid';
    if(agendaWrap) agendaWrap.style.display = 'none';
    renderInterface();
  });

  btnAgenda?.addEventListener('click', () => {
    btnAgenda.classList.add('btn-primary');
    btnAgenda.classList.remove('btn-outline-primary');
    btnMonth.classList.add('btn-outline-primary');
    btnMonth.classList.remove('btn-primary');
    if(calWeekdays) calWeekdays.style.display = 'none';
    if(calGridArea) calGridArea.style.display = 'none';
    if(agendaWrap) agendaWrap.style.display = 'block';
    renderInterface();
  });
}

// --- NAVEGAÇÃO E FILTROS ---
function setupNavigation() {
  document.getElementById('btn-prev')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderInterface();
  });
  document.getElementById('btn-next')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderInterface();
  });
  document.getElementById('btn-today')?.addEventListener('click', () => {
    currentMonth = new Date();
    renderInterface();
  });
}

function setupFilters() {
  ['filter-activities', 'filter-mural', 'filter-course'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => renderInterface());
  });
}

// --- UTILITÁRIOS ---
function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function fmtMonthShort(date) {
  return date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
}

function fmtTime(date) {
  const hasTime = !(date.getHours() === 0 && date.getMinutes() === 0);
  return hasTime ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Dia inteiro';
}

function escapeHtml(str) {
  return String(str || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

// --- CARREGAMENTO DE DADOS ---
async function loadUnifiedCalendar(userId) {
  const loader = document.getElementById('calendar-loader');
  try {
    const { data: enrollmentsRaw } = await supabase.from('class_enrollments').select('class_id,status').eq('user_id', userId);
    const BLOCKED = new Set(['canceled', 'cancelled', 'cancelado', 'inativo', 'inactive']);
    const validEnrollments = (enrollmentsRaw || []).filter(e => !BLOCKED.has(String(e.status ?? '').trim().toLowerCase()));
    const classIds = [...new Set(validEnrollments.map(e => e.class_id).filter(Boolean))];

    if (!classIds.length) {
      if(loader) loader.innerHTML = "<h6>Nenhuma matrícula ativa encontrada.</h6>";
      return;
    }

    const [resClasses, resPosts, resLessons] = await Promise.all([
      supabase.from('classes').select('*, courses(title)').in('id', classIds),
      supabase.from('class_posts').select('*').in('class_id', classIds),
      supabase.from('lessons').select('*, modules(course_id, title)').in('is_published', [true])
    ]);

    const timeline = [];
    const classMap = new Map(resClasses.data?.map(c => [c.id, c]));

    resClasses.data?.forEach(cls => {
      const courseTitle = cls.courses?.title || 'Curso';
      if (cls.start_date) timeline.push({ kind: 'course', date: safeDate(cls.start_date), title: 'Início: ' + cls.name, course: courseTitle, className: cls.name, badge: 'TURMA' });
      if (cls.end_date) timeline.push({ kind: 'course', date: safeDate(cls.end_date), title: 'Término: ' + cls.name, course: courseTitle, className: cls.name, badge: 'TURMA' });
    });

    resPosts.data?.forEach(p => {
      const d = safeDate(p.event_date) || safeDate(p.created_at);
      const cls = classMap.get(p.class_id);
      if (d) timeline.push({ kind: 'mural', date: d, title: p.title, course: cls?.courses?.title || 'Geral', className: cls?.name || 'Mural', badge: (p.type || 'AVISO').toUpperCase() });
    });

    resLessons.data?.forEach(les => {
      const courseTitle = les.modules?.title || 'Atividade'; 
      if (les.start_at) timeline.push({ kind: 'activity', date: safeDate(les.start_at), title: les.title, course: courseTitle, className: 'Atividade', badge: 'INÍCIO', points: les.points });
      if (les.end_at) timeline.push({ kind: 'activity', date: safeDate(les.end_at), title: les.title, course: courseTitle, className: 'Atividade', badge: 'PRAZO', points: les.points });
    });

    allEvents = timeline;
    if(loader) loader.style.display = 'none';
    document.getElementById('calendar-root').style.display = 'block';
    renderInterface();

  } catch (err) {
    console.error(err);
    if(loader) loader.innerHTML = `<p class="text-danger">Erro ao carregar dados.</p>`;
  }
}

// --- RENDERIZAÇÃO ---
function renderInterface() {
  const grid = document.getElementById('calendar-grid');
  const label = document.getElementById('cal-month-label');
  const agenda = document.getElementById('agenda-container');
  
  if (grid) grid.innerHTML = '';
  if (agenda) agenda.innerHTML = '';

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  if (label) label.innerText = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(currentMonth).toUpperCase();

  const showAct = document.getElementById('filter-activities')?.checked ?? true;
  const showMur = document.getElementById('filter-mural')?.checked ?? true;
  const showCou = document.getElementById('filter-course')?.checked ?? true;

  // 1. MODO MÊS COM LABELS MINIMALISTAS
  if (grid) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    for (let i = 0; i < offset; i++) grid.insertAdjacentHTML('beforeend', '<div class="cal-cell is-outside"></div>');

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = allEvents.filter(ev => {
          const evDate = ev.date.toISOString().split('T')[0];
          return evDate === dateStr && ((ev.kind==='activity'&&showAct) || (ev.kind==='mural'&&showMur) || (ev.kind==='course'&&showCou));
      });

      const isToday = new Date().toISOString().split('T')[0] === dateStr;
      
      // Gera as labels de texto em vez de pontos
      const labelsHtml = dayEvents.slice(0, 2).map(ev => {
        const color = ev.kind === 'activity' ? '#0d6efd' : ev.kind === 'mural' ? '#9a6b00' : '#146c43';
        const bgColor = ev.kind === 'activity' ? '#e7f1ff' : ev.kind === 'mural' ? '#fff9db' : '#d1e7dd';
        return `
          <div class="cal-event-label" style="
            background: ${bgColor}; 
            color: ${color}; 
            font-size: 0.6rem; 
            padding: 2px 4px; 
            border-radius: 4px; 
            margin-bottom: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            border-left: 2px solid ${color};
            font-weight: 600;
          ">
            ${escapeHtml(ev.title)}
          </div>`;
      }).join('');

      grid.insertAdjacentHTML('beforeend', `
        <div class="cal-cell ${isToday ? 'is-today' : ''}" onclick="window.openDayDetails('${dateStr}')" style="min-height: 100px; display: flex; flex-direction: column; padding: 4px;">
          <div class="cal-date d-flex justify-content-between">
            <span class="num ${isToday ? 'bg-primary text-white rounded-circle' : ''}" style="${isToday ? 'width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;' : 'font-size: 0.85rem;'}">${day}</span>
          </div>
          <div class="cal-events-container mt-1" style="flex-grow: 1; overflow: hidden;">
            ${labelsHtml}
            ${dayEvents.length > 2 ? `<div class="text-muted" style="font-size: 0.55rem; padding-left: 4px;">+${dayEvents.length - 2} mais</div>` : ''}
          </div>
        </div>`);
    }
  }

  // 2. MODO AGENDA
  if (agenda) {
    const filteredEvents = allEvents.filter(ev => (ev.kind==='activity'&&showAct) || (ev.kind==='mural'&&showMur) || (ev.kind==='course'&&showCou)).sort((a,b) => a.date - b.date);

    filteredEvents.forEach(ev => {
      const colorClass = ev.kind === 'activity' ? 'primary' : ev.kind === 'mural' ? 'warning' : 'success';
      agenda.insertAdjacentHTML('beforeend', `
        <div class="card event-card shadow-sm border-0 rounded-4 mb-3 border-start border-4 border-${colorClass}" data-kind="${ev.kind}">
          <div class="card-body p-3">
            <div class="d-flex align-items-center gap-3">
              <div class="date-badge rounded-3 text-center p-2 bg-light border" style="min-width: 65px;">
                <span class="d-block fw-bold fs-4 line-height-1 text-dark">${String(ev.date.getDate()).padStart(2,'0')}</span>
                <small class="text-uppercase fw-bold text-${colorClass}" style="font-size: 0.7rem;">${fmtMonthShort(ev.date)}</small>
              </div>
              <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-start mb-1">
                   <span class="badge bg-${colorClass} bg-opacity-10 text-${colorClass} border border-${colorClass} border-opacity-25" style="font-size: 0.65rem;">
                    <i class='bx bx-time-five'></i> ${fmtTime(ev.date)} • ${ev.badge}
                   </span>
                </div>
                <h6 class="mb-1 fw-bold text-dark">${escapeHtml(ev.title)}</h6>
                <div class="d-flex flex-wrap gap-3 mt-2">
                  <small class="text-muted"><i class='bx bx-book-open'></i> ${escapeHtml(ev.course)}</small>
                  <small class="text-muted"><i class='bx bx-group'></i> ${escapeHtml(ev.className)}</small>
                </div>
              </div>
            </div>
          </div>
        </div>`);
    });
  }
}

// --- OFF-CANVAS DETALHADO ---
window.openDayDetails = (dateStr) => {
  const container = document.getElementById('day-items');
  const label = document.getElementById('dayOffcanvasLabel');
  const events = allEvents.filter(ev => ev.date.toISOString().split('T')[0] === dateStr);
  const d = new Date(dateStr + 'T12:00:00');
  label.innerText = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  container.innerHTML = events.length ? '' : '<p class="text-muted text-center py-4">Nenhum compromisso.</p>';
  events.forEach(ev => {
    container.insertAdjacentHTML('beforeend', `
      <div class="p-3 border rounded-3 bg-light mb-2">
        <div class="d-flex justify-content-between mb-1">
          <span class="badge bg-white text-dark border small">${fmtTime(ev.date)}</span>
          <span class="badge bg-primary">${ev.badge}</span>
        </div>
        <h6 class="fw-bold mb-0">${escapeHtml(ev.title)}</h6>
        <small class="text-muted d-block mt-1"><b>Curso:</b> ${ev.course}</small>
        <small class="text-muted d-block"><b>Turma:</b> ${ev.className}</small>
      </div>`);
  });
  new bootstrap.Offcanvas(document.getElementById('dayOffcanvas')).show();
};