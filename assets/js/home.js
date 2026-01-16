import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    loadAvailableClasses(userId);
});

async function loadAvailableClasses(userId) {
    const container = document.getElementById('classes-container');
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px;"><i class="bx bx-loader-alt bx-spin" style="font-size: 2rem; color: #0b57d0;"></i></div>';

    const { data: classes, error } = await supabase
        .from('classes')
        .select(`*, courses(title), class_enrollments(user_id, status)`)
        .eq('status', 'publicado')
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });

    if (error) { container.innerHTML = 'Erro ao carregar.'; return; }
    container.innerHTML = '';

    const fmt = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : null;

    classes.forEach(cls => {
        const now = new Date();
        const enrollStart = cls.enrollment_start ? new Date(cls.enrollment_start) : null;
        const enrollDeadline = cls.enrollment_deadline ? new Date(cls.enrollment_deadline) : null;
        const courseTitle = cls.courses?.title || 'Curso Geral';

        let userStatus = null;
        if (userId && cls.class_enrollments) {
            const enroll = cls.class_enrollments.find(e => e.user_id === userId);
            if (enroll) userStatus = enroll.status;
        }

        let canEnroll = true;
        let lockMsg = "";
        if (!cls.enrollment_open) { canEnroll = false; lockMsg = "Inscrições Fechadas"; }
        else if (enrollStart && now < enrollStart) { canEnroll = false; lockMsg = `Abre em ${fmt(enrollStart)}`; }
        else if (enrollDeadline && now > enrollDeadline) { canEnroll = false; lockMsg = "Prazo Expirado"; }

        let btn = '';
        if (!userId) btn = `<button onclick="location.href='login.html'" class="btn-enroll"><i class='bx bx-log-in'></i> Entrar</button>`;
        else if (userStatus === 'active') btn = `<button onclick="location.href='classroom.html?id=${cls.id}'" class="btn-enroll btn-access"><i class='bx bx-play'></i> Acessar Aula</button>`;
        else if (userStatus === 'pending') btn = `<button disabled class="btn-enroll" style="background:#f59e0b; opacity:0.7;"><i class='bx bx-time'></i> Aguardando</button>`;
        else if (!canEnroll) btn = `<button disabled class="btn-enroll" style="background:#64748b; cursor:not-allowed;"><i class='bx bx-lock-alt'></i> ${lockMsg}</button>`;
        else btn = `<button onclick="enroll('${cls.id}', ${cls.requires_approval})" class="btn-enroll"><i class='bx bx-plus'></i> Matricular-se</button>`;

        const html = `
            <article class="course-card">
                <div class="card-header-img"><i class='bx bx-book-reader'></i></div>
                <div class="card-body">
                    <div class="badge-course">${cls.name}</div>
                    <h3 class="card-title">${courseTitle}</h3>
                    <div class="card-meta">
                        <div class="mb-2"><i class='bx bx-calendar'></i> <strong>Aulas começam:</strong> ${fmt(cls.start_date) || 'Imediato'}</div>
                        ${fmt(enrollDeadline) ? `<div class="text-danger small"><i class='bx bx-timer'></i> <strong>Inscrições até:</strong> ${fmt(enrollDeadline)}</div>` : ''}
                    </div>
                    <div class="card-footer">${btn}</div>
                </div>
            </article>`;
        container.insertAdjacentHTML('beforeend', html);
    });
}

window.enroll = async (classId, approval) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return location.href = 'login.html';
    const btn = document.activeElement;
    if(btn) { btn.innerHTML = '...'; btn.disabled = true; }
    const { error } = await supabase.from('class_enrollments').insert({
        class_id: classId, user_id: session.user.id, status: approval ? 'pending' : 'active', grades: { completed: [], scores: {} }
    });
    if (error) { alert(error.message); if(btn) btn.disabled = false; }
    else { location.reload(); }
};