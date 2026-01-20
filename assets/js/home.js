import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    loadAvailableClasses(userId);
});

async function loadAvailableClasses(userId) {
    const container = document.getElementById('classes-container');
    
    // Loader minimalista
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
            <i class='bx bx-loader-alt bx-spin' style="font-size: 2rem; color: #555;"></i>
        </div>`;

    // 1. BUSCA (Mantendo a lógica correta de filtros)
    const { data: classes, error } = await supabase
        .from('classes')
        .select(`
            *,
            courses (title, image_url, carga_horaria_horas),
            class_enrollments (user_id, status)
        `)
        .eq('is_hidden', false)
        .in('status', ['published', 'publicado']) 
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #999;">Indisponível no momento.</div>';
        return;
    }

    container.innerHTML = '';

    if (!classes || classes.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px;">
                <i class='bx bx-ghost' style="font-size: 2rem; color: #ccc;"></i>
                <p class="mt-3 text-muted small">Nenhuma turma aberta.</p>
            </div>`;
        return;
    }

    const fmt = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : null;
    const now = new Date();

    classes.forEach(cls => {
        // Datas
        const start = cls.start_date ? new Date(cls.start_date) : null;
        const end = cls.end_date ? new Date(cls.end_date) : null;
        const enrollStart = cls.enrollment_start ? new Date(cls.enrollment_start) : null;
        const enrollDeadline = cls.enrollment_deadline ? new Date(cls.enrollment_deadline) : null;
        
        const courseTitle = cls.courses?.title || 'Curso';
        const imgUrl = cls.courses?.image_url;

        // --- DEFINIÇÃO DO TEXTO DO STATUS ---
        let badgeText = "";
        let isConcluded = false;

        if (end && now > end) {
            badgeText = "Concluído";
            isConcluded = true;
        } else if (start && now >= start) {
            badgeText = "Em Andamento";
        } else if (cls.enrollment_open) {
            if ((enrollStart && now < enrollStart) || (enrollDeadline && now > enrollDeadline)) {
                badgeText = "Inscrições Encerradas";
            } else {
                badgeText = "Inscrições Abertas";
            }
        } else {
            badgeText = "Em Breve";
        }

        // --- BOTÃO (Lógica mantida, visual limpo) ---
        let userStatus = null;
        if (userId && cls.class_enrollments?.length) {
            const en = cls.class_enrollments.find(e => e.user_id === userId);
            if(en) userStatus = en.status;
        }

        let btn = '';
        const canEnroll = (badgeText === "Inscrições Abertas");

        // Botões com cores sólidas mas design clean
        if (!userId) {
            btn = `<button onclick="location.href='login.html'" class="btn-enroll"><i class='bx bx-log-in'></i> Entrar</button>`;
        } 
        else if (userStatus === 'active') {
            btn = `<button onclick="location.href='classroom.html?id=${cls.id}'" class="btn-enroll btn-access" style="background-color: #198754; color: white; border:none;">Acessar Sala</button>`;
        } 
        else if (userStatus === 'pending') {
            btn = `<button disabled class="btn-enroll" style="background:#ffc107; color:#333; opacity:1; cursor:default;">Aguardando</button>`;
        } 
        else if (isConcluded) {
            btn = `<button disabled class="btn-enroll" style="background:#6c757d; cursor:not-allowed;">Encerrado</button>`;
        }
        else if (canEnroll) {
            if (cls.requires_approval) {
                btn = `<button onclick="enroll('${cls.id}', true)" class="btn-enroll"><i class='bx bx-user'></i> Solicitar Vaga</button>`;
            } else {
                btn = `<button onclick="enroll('${cls.id}', false)" class="btn-enroll">Matricular-se</button>`;
            }
        } 
        else {
            btn = `<button disabled class="btn-enroll" style="background:#e9ecef; color:#999; cursor:not-allowed;">Indisponível</button>`;
        }

        // --- IMAGEM DE FUNDO ---
        let headerStyle = "";
        let headerContent = "<i class='bx bx-book-reader'></i>"; // Ícone padrão cinza
        
        if (imgUrl) {
            headerStyle = `background-image: url('${imgUrl}'); background-size: cover; background-position: center;`;
            headerContent = ""; 
        }

        // --- HTML DO CARD (Design Limpo) ---
        // Badge: Fundo preto com 50% de transparência para qualquer situação. Texto branco puro. Sem ícones.
        const html = `
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
                            Início: ${fmt(cls.start_date) || 'A definir'}
                        </div>
                        ${fmt(enrollDeadline) ? `<div style="font-size: 0.85rem; color: #d63384;">Até: ${fmt(enrollDeadline)}</div>` : ''}
                    </div>
                    
                    <div class="card-footer">${btn}</div>
                </div>
            </article>`;
        
        container.insertAdjacentHTML('beforeend', html);
    });
}

window.enroll = async (classId, requiresApproval) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return location.href = 'login.html';
    
    const btn = document.activeElement;
    const oldText = btn ? btn.innerHTML : '';
    if(btn) { btn.innerHTML = '...'; btn.disabled = true; }

    const status = requiresApproval ? 'pending' : 'active';

    const { error } = await supabase.from('class_enrollments').insert({
        class_id: classId, user_id: session.user.id, status: status, grades: { completed: [], scores: {} }
    });

    if (error) { 
        if (error.code === '23505') alert("Você já solicitou matrícula.");
        else alert(error.message);
        if(btn) { btn.innerHTML = oldText; btn.disabled = false; }
    } else { 
        if(requiresApproval) alert("Solicitação enviada!");
        else alert("Matrícula realizada!");
        location.reload(); 
    }
};