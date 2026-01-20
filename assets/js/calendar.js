import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verifica sessão
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    await loadStudentCalendar(session.user.id);
});

async function loadStudentCalendar(userId) {
    const container = document.getElementById('events-container');
    const loader = document.getElementById('calendar-loader');

    try {
        // 2. Busca as turmas (classes) onde o aluno está matriculado
        const { data: enrollments, error: enrollError } = await supabase
            .from('class_enrollments')
            .select('class_id')
            .eq('user_id', userId)
            .eq('status', 'active');

        if (enrollError) throw enrollError;

        if (!enrollments || enrollments.length === 0) {
            loader.style.display = 'none';
            container.innerHTML = `
                <div class="alert alert-info text-center p-5 rounded-4">
                    <i class='bx bx-info-circle fs-1'></i>
                    <h4 class="mt-3">Nenhuma matrícula ativa</h4>
                    <p>Você ainda não possui eventos pois não está matriculado em turmas ativas.</p>
                    <a href="index.html" class="btn btn-primary">Ver Turmas Disponíveis</a>
                </div>`;
            return;
        }

        const classIds = enrollments.map(e => e.class_id);

        // 3. Busca eventos vinculados a essas turmas (Tabela: class_events)
        const { data: events, error: eventError } = await supabase
            .from('class_events')
            .select(`
                *,
                classes (
                    name,
                    courses (title)
                )
            `)
            .in('class_id', classIds)
            .order('event_date', { ascending: true });

        if (eventError) throw eventError;

        loader.style.display = 'none';

        if (!events || events.length === 0) {
            container.innerHTML = `<p class="text-center text-muted p-5">Nenhum evento agendado para suas turmas no momento.</p>`;
            return;
        }

        // 4. Renderiza os cartões de eventos
        events.forEach(ev => {
            const date = new Date(ev.event_date);
            const dia = date.getDate();
            const mes = date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
            const hora = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const html = `
                <div class="card event-card shadow-sm border-0 rounded-3 overflow-hidden">
                    <div class="card-body d-flex align-items-center p-3 gap-3">
                        <div class="date-badge rounded text-center p-2">
                            <span class="d-block fw-bold fs-4 line-height-1">${dia}</span>
                            <small class="text-uppercase text-primary fw-bold" style="font-size: 0.7rem;">${mes}</small>
                        </div>
                        <div class="flex-grow-1">
                            <div class="badge bg-light text-primary border mb-1" style="font-size: 0.65rem;">
                                <i class='bx bx-book-alt'></i> ${ev.classes?.courses?.title || 'Curso'}
                            </div>
                            <h6 class="mb-0 fw-bold text-dark">${ev.title}</h6>
                            <small class="text-muted"><i class='bx bx-time-five'></i> ${hora} • Turma: ${ev.classes?.name}</small>
                        </div>
                        <div class="ms-auto text-end">
                             <span class="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3">${ev.type || 'EVENTO'}</span>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });

    } catch (err) {
        console.error("Erro ao carregar calendário:", err);
        loader.innerHTML = `<p class="text-danger">Erro ao carregar eventos. Verifique se a tabela 'class_events' existe no seu banco de dados.</p>`;
    }
}