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
        .select(`
            *,
            courses (title, description),
            class_enrollments (user_id, status)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        container.innerHTML = '<p style="text-align:center; color: red;">Erro ao carregar turmas.</p>';
        return;
    }

    container.innerHTML = '';

    if (!classes || classes.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #666; grid-column: 1/-1;">Nenhuma turma disponível no momento.</p>';
        return;
    }

    classes.forEach(cls => {
        const courseTitle = cls.courses?.title || 'Curso Geral';
        
        let enrollmentStatus = null;
        if (userId && cls.class_enrollments) {
            const enrollment = cls.class_enrollments.find(e => e.user_id === userId);
            if (enrollment) enrollmentStatus = enrollment.status;
        }

        let btnHtml = '';
        if (!userId) {
            btnHtml = `<button onclick="window.location.href='login.html'" class="btn-enroll"><i class='bx bx-log-in'></i> Entrar para Inscrever-se</button>`;
        } else if (enrollmentStatus === 'active') {
            // LINK CORRIGIDO AQUI TAMBÉM
            btnHtml = `<button onclick="window.location.href='classroom.html?id=${cls.id}'" class="btn-enroll" style="background-color: #10b981;"><i class='bx bx-play-circle'></i> Acessar Aula</button>`;
        } else if (enrollmentStatus === 'pending') {
            btnHtml = `<button disabled class="btn-enroll" style="background-color: #f59e0b; cursor: default;"><i class='bx bx-time'></i> Aguardando Aprovação</button>`;
        } else {
            btnHtml = `<button onclick="enrollInClass('${cls.id}', ${cls.requires_approval})" class="btn-enroll"><i class='bx bx-user-plus'></i> Matricular-se</button>`;
        }

        const startDate = cls.start_date ? new Date(cls.start_date).toLocaleDateString('pt-BR') : 'Imediato';

        const html = `
            <article class="course-card">
                <div class="card-header-img">
                    <i class='bx bx-book-reader'></i>
                </div>
                <div class="card-body">
                    <div class="badge-course">${courseTitle}</div>
                    <h3 class="card-title">${cls.name}</h3>
                    
                    <div class="card-meta">
                        <div><i class='bx bx-calendar'></i> Início: ${startDate}</div>
                        ${cls.max_students ? `<div><i class='bx bx-group'></i> Vagas limitadas</div>` : ''}
                    </div>

                    <div class="card-footer">
                        ${btnHtml}
                    </div>
                </div>
            </article>
        `;
        
        container.insertAdjacentHTML('beforeend', html);
    });
}

window.enrollInClass = async (classId, requiresApproval) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    const status = requiresApproval ? 'pending' : 'active';
    const btn = document.activeElement;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Processando...';
    btn.disabled = true;

    const { error } = await supabase
        .from('class_enrollments')
        .insert({
            class_id: classId,
            user_id: session.user.id,
            status: status,
            progress_percent: 0
        });

    if (error) {
        alert("Erro: " + error.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    } else {
        if (requiresApproval) {
            alert("Solicitação enviada! Aguarde a aprovação.");
            window.location.reload();
        } else {
            window.location.href = `classroom.html?id=${classId}`;
        }
    }
};