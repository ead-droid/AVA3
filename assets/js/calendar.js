import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  setupFilters();
  await loadUnifiedCalendar(session.user.id);
});

function setupFilters() {
  const ids = ['filter-activities', 'filter-mural', 'filter-course'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      document.querySelectorAll('[data-kind]').forEach(card => {
        const kind = card.getAttribute('data-kind');
        const showActivities = document.getElementById('filter-activities')?.checked ?? true;
        const showMural = document.getElementById('filter-mural')?.checked ?? true;
        const showCourse = document.getElementById('filter-course')?.checked ?? true;

        const visible =
          (kind === 'activity' && showActivities) ||
          (kind === 'mural' && showMural) ||
          (kind === 'course' && showCourse);

        card.style.display = visible ? '' : 'none';
      });
    });
  });
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDayLabel(date) {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
}

function fmtMonthShort(date) {
  return date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
}

function hasExplicitTime(date) {
  return !(date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0);
}

function fmtTime(date) {
  if (!hasExplicitTime(date)) return 'Dia inteiro';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function sortKey(kind, subtype) {
  const base = { course: 10, activity: 20, mural: 30 }[kind] ?? 99;
  const sub = (subtype === 'start') ? 0 : (subtype === 'end') ? 1 : 5;
  return base * 10 + sub;
}

async function loadUnifiedCalendar(userId) {
  const container = document.getElementById('events-container');
  const loader = document.getElementById('calendar-loader');

  try {
    // 1) matrículas do usuário (NÃO filtre por status no banco; normalize no JS)
    const { data: enrollmentsRaw, error: enrollError } = await supabase
      .from('class_enrollments')
      .select('class_id,status')
      .eq('user_id', userId);

    if (enrollError) throw enrollError;

    const enrollments = enrollmentsRaw || [];

    // Normalização de status:
    // - sua UI exibe "Ativo", então o banco pode ter 'ativo' (pt) ou 'active' (en)
    // - para não "sumir" matrícula por divergência, só bloqueamos status claramente inativos/cancelados
    const BLOCKED = new Set(['canceled', 'cancelled', 'cancelado', 'inativo', 'inactive', 'revoked', 'removed']);
    const validEnrollments = enrollments.filter(e => {
      const s = String(e.status ?? '').trim().toLowerCase();
      if (!s) return true;          // se não há status, considera válido
      return !BLOCKED.has(s);       // bloqueia apenas os inativos/cancelados
    });

    if (!validEnrollments.length) {
      loader.style.display = 'none';
      const statuses = [...new Set(enrollments.map(e => String(e.status ?? '(null)')))].join(', ');
      container.innerHTML = `
        <div class="alert alert-info text-center p-5 rounded-4">
          <i class='bx bx-info-circle fs-1'></i>
          <h4 class="mt-3">Nenhuma matrícula válida encontrada</h4>
          <p>O sistema encontrou matrículas, mas todas parecem estar com status inativo/cancelado.</p>
          <div class="small text-muted">Status encontrados: ${escapeHtml(statuses || '—')}</div>
        </div>`;
      return;
    }

    const classIds = [...new Set(validEnrollments.map(e => e.class_id).filter(Boolean))];

    // 2) carrega turmas + curso (datas da turma)
    const { data: classes, error: classError } = await supabase
      .from('classes')
      .select(`
        id,
        name,
        course_id,
        start_date,
        end_date,
        enrollment_start,
        enrollment_deadline,
        courses ( title )
      `)
      .in('id', classIds);

    if (classError) throw classError;

    const courseInfo = new Map(); // course_id -> { title, classNames[] }
    (classes || []).forEach(cls => {
      const courseId = cls.course_id;
      if (!courseId) return;
      const title = cls.courses?.title || 'Curso';
      const prev = courseInfo.get(courseId) || { title, classNames: [] };
      if (!prev.classNames.includes(cls.name)) prev.classNames.push(cls.name);
      if (!prev.title || prev.title === 'Curso') prev.title = title;
      courseInfo.set(courseId, prev);
    });

    const courseIds = [...new Set((classes || []).map(c => c.course_id).filter(Boolean))];

    // 3) mural
    const { data: posts, error: postError } = await supabase
      .from('class_posts')
      .select('id,class_id,type,title,content,event_date,created_at,resource_url')
      .in('class_id', classIds)
      .order('event_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (postError) throw postError;

    // 4) atividades com data (lessons.start_at/end_at)
    let modules = [];
    let sections = [];
    let lessons = [];
    let lessonsDatesSupported = true;

    if (courseIds.length) {
      const { data: mods, error: modError } = await supabase
        .from('modules')
        .select('id,course_id,title,ordem')
        .in('course_id', courseIds)
        .order('ordem', { ascending: true });

      if (modError) throw modError;
      modules = mods || [];

      const moduleIds = modules.map(m => m.id);

      if (moduleIds.length) {
        const { data: secs, error: secError } = await supabase
          .from('sections')
          .select('id,module_id,title,ordem')
          .in('module_id', moduleIds)
          .order('ordem', { ascending: true });

        if (secError) throw secError;
        sections = secs || [];

        try {
          const { data: les, error: lesError } = await supabase
            .from('lessons')
            .select('id,module_id,section_id,title,type,points,ordem,is_published,start_at,end_at')
            .in('module_id', moduleIds)
            .eq('is_published', true)
            .or('start_at.not.is.null,end_at.not.is.null')
            .order('start_at', { ascending: true })
            .order('end_at', { ascending: true });

          if (lesError) throw lesError;
          lessons = les || [];
        } catch (err) {
          lessonsDatesSupported = false;
          lessons = [];
          console.warn('Calendário: start_at/end_at indisponível (coluna não existe ou RLS).', err);
        }
      }
    }

    // 5) timeline unificada
    const timeline = [];

    // 5.1) início / término da turma (+ janelas de matrícula)
    (classes || []).forEach(cls => {
      const courseTitle = cls.courses?.title || 'Curso';

      const start = safeDate(cls.start_date);
      if (start) timeline.push({
        kind: 'course', subtype: 'start', date: start,
        title: 'Início da turma',
        subtitle: `${courseTitle} • Turma: ${cls.name}`,
        badge: 'TURMA',
      });

      const end = safeDate(cls.end_date);
      if (end) timeline.push({
        kind: 'course', subtype: 'end', date: end,
        title: 'Término da turma',
        subtitle: `${courseTitle} • Turma: ${cls.name}`,
        badge: 'TURMA',
      });

      const enrollStart = safeDate(cls.enrollment_start);
      if (enrollStart) timeline.push({
        kind: 'course', subtype: 'enroll-start', date: enrollStart,
        title: 'Matrícula aberta',
        subtitle: `${courseTitle} • Turma: ${cls.name}`,
        badge: 'MATRÍCULA',
      });

      const enrollDeadline = safeDate(cls.enrollment_deadline);
      if (enrollDeadline) timeline.push({
        kind: 'course', subtype: 'enroll-deadline', date: enrollDeadline,
        title: 'Prazo final de matrícula',
        subtitle: `${courseTitle} • Turma: ${cls.name}`,
        badge: 'MATRÍCULA',
      });
    });

    // 5.2) mural
    (posts || []).forEach(p => {
      const when = safeDate(p.event_date) || safeDate(p.created_at);
      if (!when) return;

      const cls = (classes || []).find(c => c.id === p.class_id);
      const courseTitle = cls?.courses?.title || 'Curso';

      const type = (p.type || 'AVISO').toUpperCase();
      const isEvent = type === 'EVENTO' && !!p.event_date;

      timeline.push({
        kind: 'mural',
        subtype: isEvent ? 'event' : 'post',
        date: when,
        title: p.title || (isEvent ? 'Evento' : 'Post no mural'),
        subtitle: `${courseTitle} • Turma: ${cls?.name || ''}`.trim(),
        badge: type,
        extra: p.resource_url ? { label: 'Recurso', url: p.resource_url } : null,
      });
    });

    // 5.3) atividades
    const moduleById = new Map(modules.map(m => [m.id, m]));
    const sectionById = new Map(sections.map(s => [s.id, s]));

    if (lessonsDatesSupported) {
      lessons.forEach(les => {
        const mod = moduleById.get(les.module_id);
        const sec = sectionById.get(les.section_id);
        const courseId = mod?.course_id;
        const info = courseId ? courseInfo.get(courseId) : null;

        const courseTitle = info?.title || 'Curso';
        const classNames = info?.classNames?.length ? `Turmas: ${info.classNames.join(', ')}` : '';

        const baseSubtitleParts = [
          courseTitle,
          classNames,
          mod?.title ? `Módulo: ${mod.title}` : null,
          sec?.title ? `Seção: ${sec.title}` : null
        ].filter(Boolean);

        const baseSubtitle = baseSubtitleParts.join(' • ');
        const type = (les.type || 'ATIVIDADE').toUpperCase();

        const startAt = safeDate(les.start_at);
        if (startAt) timeline.push({
          kind: 'activity', subtype: 'start', date: startAt,
          title: `${les.title}`,
          subtitle: baseSubtitle,
          badge: `${type} • INÍCIO`,
          points: les.points ?? null
        });

        const endAt = safeDate(les.end_at);
        if (endAt) timeline.push({
          kind: 'activity', subtype: 'end', date: endAt,
          title: `${les.title}`,
          subtitle: baseSubtitle,
          badge: `${type} • PRAZO`,
          points: les.points ?? null
        });
      });
    }

    loader.style.display = 'none';
    container.innerHTML = '';

    if (!timeline.length) {
      container.innerHTML = `
        <div class="text-center text-muted p-5">
          <i class='bx bx-calendar-x fs-1'></i>
          <h5 class="mt-3">Nenhum item com data encontrado</h5>
          <p class="mb-0">Confirme se existem datas configuradas em turmas, mural ou atividades.</p>
        </div>`;
      return;
    }

    timeline.sort((a, b) => {
      const ta = a.date.getTime();
      const tb = b.date.getTime();
      if (ta !== tb) return ta - tb;
      return sortKey(a.kind, a.subtype) - sortKey(b.kind, b.subtype);
    });

    if (!lessonsDatesSupported) {
      container.insertAdjacentHTML('beforeend', `
        <div class="alert alert-warning rounded-4">
          <div class="d-flex gap-3 align-items-start">
            <i class='bx bx-error-circle fs-3'></i>
            <div>
              <h6 class="mb-1">Atividades com data ainda não estão habilitadas</h6>
              <div class="small">
                A tabela <code>lessons</code> precisa permitir leitura das colunas <code>start_at</code>/<code>end_at</code>
                (e o editor precisa salvar esses campos). Mesmo assim, o calendário já exibe <b>mural</b> e <b>datas da turma</b>.
              </div>
            </div>
          </div>
        </div>
      `);
    }

    let lastDayKey = '';
    timeline.forEach(ev => {
      const d = ev.date;
      const dayKey = d.toISOString().slice(0, 10);

      if (dayKey !== lastDayKey) {
        lastDayKey = dayKey;
        container.insertAdjacentHTML('beforeend', `
          <div class="day-divider py-2 mt-2 rounded-3 border">
            <div class="px-3 small text-muted text-capitalize">
              <i class='bx bx-calendar'></i> ${fmtDayLabel(d)}
            </div>
          </div>
        `);
      }

      const dia = String(d.getDate()).padStart(2, '0');
      const mes = fmtMonthShort(d);
      const hora = fmtTime(d);

      const icon = ev.kind === 'activity'
        ? (String(ev.badge || '').includes('QUIZ') ? 'bx bx-question-mark' : 'bx bx-task')
        : ev.kind === 'mural'
          ? 'bx bx-message-rounded-dots'
          : 'bx bx-flag';

      const badgeClass = ev.kind === 'activity'
        ? 'bg-primary bg-opacity-10 text-primary'
        : ev.kind === 'mural'
          ? 'bg-warning bg-opacity-10 text-warning'
          : 'bg-success bg-opacity-10 text-success';

      const rightBadge = ev.badge
        ? `<span class="badge ${badgeClass} rounded-pill px-3">${escapeHtml(ev.badge)}</span>`
        : '';

      const points = (ev.points !== null && ev.points !== undefined)
        ? `<div class="small text-muted mt-1"><i class='bx bx-trophy'></i> Pontos: ${escapeHtml(ev.points)}</div>`
        : '';

      const resource = ev.extra?.url
        ? `<div class="mt-1"><a class="small" href="${ev.extra.url}" target="_blank" rel="noopener">Abrir recurso</a></div>`
        : '';

      const html = `
        <div class="card event-card shadow-sm border-0 rounded-3 overflow-hidden" data-kind="${ev.kind}">
          <div class="card-body d-flex align-items-center p-3 gap-3">
            <div class="date-badge rounded text-center p-2">
              <span class="d-block fw-bold fs-4 line-height-1">${dia}</span>
              <small class="text-uppercase text-primary fw-bold" style="font-size: 0.7rem;">${mes}</small>
            </div>

            <div class="flex-grow-1">
              <div class="badge bg-light text-primary border mb-1" style="font-size: 0.65rem;">
                <i class='${icon}'></i> ${escapeHtml(hora)}
              </div>
              <h6 class="mb-0 fw-bold text-dark">${escapeHtml(ev.title || '')}</h6>
              <small class="text-muted">${escapeHtml(ev.subtitle || '')}</small>
              ${points}
              ${resource}
            </div>

            <div class="ms-auto text-end">
              ${rightBadge}
            </div>
          </div>
        </div>
      `;

      container.insertAdjacentHTML('beforeend', html);
    });

    // aplica filtro atual (se existir)
    document.getElementById('filter-activities')?.dispatchEvent(new Event('change'));

  } catch (err) {
    console.error('Erro ao carregar calendário:', err);
    if (loader) loader.innerHTML = `<p class="text-danger">Erro ao carregar calendário. Verifique RLS e a estrutura das tabelas.</p>`;
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
