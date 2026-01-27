import { supabase } from './supabaseClient.js';

let CURRENT_USER_ID = null;

/**
 * Evita bug de timezone quando a coluna vem como DATE (YYYY-MM-DD).
 * - DATE: cria Date local (sem “voltar 1 dia”)
 * - TIMESTAMP/TZ: new Date(value)
 */
function toDateSafe(value) {
  if (!value) return null;

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const fmtBR = (value) => {
  const d = toDateSafe(value);
  return d ? d.toLocaleDateString('pt-BR') : null;
};

function renderLoader(container) {
  container.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
      <i class='bx bx-loader-alt bx-spin' style="font-size: 2rem; color: #555;"></i>
    </div>`;
}

function renderEmpty(container) {
  container.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
      <i class='bx bx-ghost' style="font-size: 2rem; color: #ccc;"></i>
      <p class="mt-3 text-muted small">Nenhuma turma disponível.</p>
    </div>`;
}

function renderError(container) {
  container.innerHTML =
    '<div style="grid-column: 1/-1; text-align: center; color: #999;">Indisponível no momento.</div>';
}

function computeBadge(cls, now) {
  const start = toDateSafe(cls.start_date);
  const end = toDateSafe(cls.end_date);

  const enrollStart = toDateSafe(cls.enrollment_start);
  const enrollDeadline = toDateSafe(cls.enrollment_deadline);

  let badgeText = 'Em Breve';
  let isConcluded = false;
  let canEnroll = false;

  // 1) Datas do curso (prioridade)
  if (end && now > end) {
    badgeText = 'Concluído';
    isConcluded = true;
    return { badgeText, isConcluded, canEnroll, enrollDeadline };
  }

  if (start && now >= start) {
    badgeText = 'Em Andamento';
    return { badgeText, isConcluded, canEnroll, enrollDeadline };
  }

  // 2) Janela de inscrição (quando enrollment_open = true)
  if (cls.enrollment_open) {
    if (enrollStart && now < enrollStart) {
      badgeText = 'Inscrições em breve';
      canEnroll = false;
    } else if (enrollDeadline && now > enrollDeadline) {
      badgeText = 'Inscrições encerradas';
      canEnroll = false;
    } else {
      badgeText = 'Inscrições abertas';
      canEnroll = true;
    }
    return { badgeText, isConcluded, canEnroll, enrollDeadline };
  }

  // 3) Default
  return { badgeText, isConcluded, canEnroll, enrollDeadline };
}

function buildButtonHTML({ userId, userStatus, clsId, canEnroll, isConcluded, requiresApproval }) {
  if (!userId) {
    return `<button type="button" data-action="login" class="btn-enroll">
      <i class='bx bx-log-in'></i> Entrar
    </button>`;
  }

  if (userStatus === 'active') {
    return `<button type="button" data-action="access" data-class-id="${clsId}"
      class="btn-enroll btn-access"
      style="background-color: #198754; color: white; border:none;">
      Acessar Sala
    </button>`;
  }

  if (userStatus === 'pending') {
    return `<button type="button" disabled class="btn-enroll"
      style="background:#ffc107; color:#333; opacity:1; cursor:default;">
      Aguardando
    </button>`;
  }

  if (isConcluded) {
    return `<button type="button" disabled class="btn-enroll"
      style="background:#6c757d; cursor:not-allowed;">
      Encerrado
    </button>`;
  }

  if (canEnroll) {
    if (requiresApproval) {
      return `<button type="button" data-action="enroll" data-class-id="${clsId}" data-approval="1" class="btn-enroll">
        <i class='bx bx-user'></i> Solicitar Vaga
      </button>`;
    }
    return `<button type="button" data-action="enroll" data-class-id="${clsId}" data-approval="0" class="btn-enroll">
      Matricular-se
    </button>`;
  }

  return `<button type="button" disabled class="btn-enroll"
    style="background:#e9ecef; color:#999; cursor:not-allowed;">
    Indisponível
  </button>`;
}

function buildCardHTML(cls, userId, enrollmentMap) {
  const now = new Date();

  const courseTitle = cls.courses?.title || 'Curso';
  const imgUrl = cls.courses?.image_url;

  const { badgeText, isConcluded, canEnroll, enrollDeadline } = computeBadge(cls, now);
  const userStatus = userId ? (enrollmentMap.get(cls.id) || null) : null;

  const btn = buildButtonHTML({
    userId,
    userStatus,
    clsId: cls.id,
    canEnroll,
    isConcluded,
    requiresApproval: !!cls.requires_approval,
  });

  let headerStyle = "";
  let headerContent = "<i class='bx bx-book-reader'></i>";
  if (imgUrl) {
    headerStyle = `background-image: url('${imgUrl}'); background-size: cover; background-position: center;`;
    headerContent = "";
  }

  return `
    <article class="course-card" style="position: relative;">
      <div style="position: absolute; top: 15px; right: 15px; z-index: 5;">
        <span style="
          background-color: rgba(0, 0, 0, 0.6);
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 500;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          backdrop-filter: blur(2px);">
          ${badgeText}
        </span>
      </div>

      <div class="card-header-img" style="${headerStyle}">
        ${headerContent}
      </div>

      <div class="card-body">
        <div class="badge-course">${cls.name}</div>
        <h3 class="card-title">${courseTitle}</h3>

        <div class="card-meta">
          <div class="mb-2" style="font-size: 0.85rem; color: #666;">
            Início: ${fmtBR(cls.start_date) || 'A definir'}
          </div>
          ${fmtBR(enrollDeadline) ? `<div style="font-size: 0.85rem; color: #d63384;">Até: ${fmtBR(enrollDeadline)}</div>` : ''}
        </div>

        <div class="card-footer">${btn}</div>
      </div>
    </article>`;
}

async function fetchClasses() {
  // Mantém compatibilidade TEMPORÁRIA com banco inconsistente (published/publicado)
  const { data, error } = await supabase
    .from('classes')
    .select(`
      id, name, start_date, end_date, enrollment_open, enrollment_start, enrollment_deadline, requires_approval, created_at,
      courses (title, image_url, carga_horaria_horas)
    `)
    .eq('is_hidden', false)
    .in('status', ['published', 'publicado'])
    .order('created_at', { ascending: false });

  return { data: data || [], error };
}

async function fetchMyEnrollmentsMap(userId) {
  const map = new Map();
  if (!userId) return map;

  const { data, error } = await supabase
    .from('class_enrollments')
    .select('class_id, status')
    .eq('user_id', userId);

  if (error) {
    console.warn('[HOME] erro ao buscar enrollments do usuário:', error.message);
    return map;
  }

  (data || []).forEach((row) => map.set(row.class_id, row.status));
  return map;
}

async function loadAvailableClasses(userId) {
  const container = document.getElementById('classes-container');
  if (!container) return;

  renderLoader(container);

  const [{ data: classes, error }, enrollmentMap] = await Promise.all([
    fetchClasses(),
    fetchMyEnrollmentsMap(userId),
  ]);

  if (error) {
    renderError(container);
    return;
  }

  container.innerHTML = '';

  if (!classes.length) {
    renderEmpty(container);
    return;
  }

  classes.forEach((cls) => {
    container.insertAdjacentHTML('beforeend', buildCardHTML(cls, userId, enrollmentMap));
  });

  // Delegação de eventos (sem window.enroll)
  container.onclick = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');

    if (action === 'login') {
      location.href = 'login.html';
      return;
    }

    if (action === 'access') {
      const classId = btn.getAttribute('data-class-id');
      location.href = `classroom.html?id=${classId}`;
      return;
    }

    if (action === 'enroll') {
      const classId = btn.getAttribute('data-class-id');
      const requiresApproval = btn.getAttribute('data-approval') === '1';
      await enrollClass(classId, requiresApproval, btn);
    }
  };
}

async function enrollClass(classId, requiresApproval, btn) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = 'login.html';
    return;
  }

  const oldText = btn.innerHTML;
  btn.innerHTML = '...';
  btn.disabled = true;

  const status = requiresApproval ? 'pending' : 'active';

  // ✅ CORREÇÃO DO SEU ERRO:
  // Não existe coluna "grades" no class_enrollments -> inserir só o que existe
  const { error } = await supabase
    .from('class_enrollments')
    .insert({
      class_id: classId,
      user_id: session.user.id,
      status
    });

  if (error) {
    btn.innerHTML = oldText;
    btn.disabled = false;

    if (error.code === '23505') {
      alert('Você já solicitou matrícula nessa turma.');
      return;
    }

    // Se você ativar RLS depois, aqui vai cair quando estiver fora da janela
    const msg = (error.message || '').toLowerCase();
    if (error.code === '42501' || msg.includes('row-level security') || msg.includes('rls')) {
      alert('Matrícula não permitida: inscrições não estão abertas (ou turma indisponível).');
      return;
    }

    alert(error.message || 'Não foi possível concluir a matrícula.');
    return;
  }

  alert(requiresApproval ? 'Solicitação enviada!' : 'Matrícula realizada!');
  await loadAvailableClasses(CURRENT_USER_ID); // ✅ sem reload
}

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  CURRENT_USER_ID = session?.user?.id || null;

  await loadAvailableClasses(CURRENT_USER_ID);

  // Mantém seu redirecionamento de perfil
  document.addEventListener('click', (e) => {
    const isProfileClick =
      e.target.closest('#header-name') ||
      e.target.closest('#header-avatar-initials') ||
      e.target.closest('.profile-header-card');

    if (isProfileClick) window.location.href = 'profile.html';
  });

  // Cursor “mãozinha”
  const style = document.createElement('style');
  style.innerHTML = `
    #header-name, #header-avatar-initials, .profile-header-card { 
      cursor: pointer !important; 
    }
  `;
  document.head.appendChild(style);
});
