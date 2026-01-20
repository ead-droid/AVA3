import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const classId = params.get('classId');

let allSubmissions = [];
let currentEnrollmentId = null;
let currentLessonId = null;
let currentLessonData = null; // Guarda estrutura da tarefa para saber os pontos máximos

document.addEventListener('DOMContentLoaded', async () => {
    if (!classId) { alert("ID da turma não fornecido."); return; }
    
    // Verifica permissão (apenas admin/professor)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (profile.role !== 'admin' && profile.role !== 'professor') {
        alert("Acesso negado.");
        window.history.back();
        return;
    }

    await loadData();
});

async function loadData() {
    // 1. Busca Estrutura do Curso (Para pegar nomes de Módulos/Seções/Aulas)
    const { data: classData } = await supabase.from('classes').select('course_id, name').eq('id', classId).single();
    document.getElementById('course-name').textContent = classData.name;

    const { data: modules } = await supabase
        .from('modules')
        .select(`
            id, title,
            sections (
                id, title,
                lessons (id, title, type, task_data, points)
            )
        `)
        .eq('course_id', classData.course_id);

    // Cria mapa de aulas: ID -> {Titulo, Modulo, Secao, Pontos, TaskItems}
    const lessonMap = {};
    modules.forEach(mod => {
        mod.sections.forEach(sec => {
            sec.lessons.forEach(l => {
                if (l.type === 'TAREFA') {
                    lessonMap[l.id] = {
                        title: l.title,
                        module: mod.title,
                        section: sec.title,
                        points: l.points,
                        items: l.task_data?.items || []
                    };
                }
            });
        });
    });

    // 2. Busca Matrículas (Alunos) e suas Notas (Grades)
    const { data: enrollments } = await supabase
        .from('class_enrollments')
        .select(`
            id,
            grades,
            profiles:user_id (name, email)
        `)
        .eq('class_id', classId);

    // 3. Processa e Unifica
    allSubmissions = [];
    enrollments.forEach(enrol => {
        const tasks = enrol.grades?.tasks || {}; // Objeto com submissões
        const scores = enrol.grades?.scores || {}; // Objeto com notas finais

        // Itera sobre as tarefas que este aluno entregou
        Object.keys(tasks).forEach(lessonId => {
            const lessonMeta = lessonMap[lessonId];
            if (!lessonMeta) return; // Tarefa deletada ou inválida

            const submission = tasks[lessonId];
            // Define status
            const isGraded = scores[lessonId] !== undefined && scores[lessonId] !== null;
            
            allSubmissions.push({
                enrollmentId: enrol.id,
                studentName: enrol.profiles?.name || 'Desconhecido',
                studentEmail: enrol.profiles?.email,
                lessonId: lessonId,
                lessonTitle: lessonMeta.title,
                moduleTitle: lessonMeta.module,
                sectionTitle: lessonMeta.section,
                submittedAt: new Date(submission.submitted_at),
                status: isGraded ? 'graded' : 'pending',
                score: scores[lessonId] || 0,
                maxPoints: lessonMeta.points,
                submissionData: submission, // Respostas, feedback atual
                taskItems: lessonMeta.items // Perguntas originais
            });
        });
    });

    // Ordena: Pendentes primeiro, depois data mais recente
    allSubmissions.sort((a, b) => {
        if (a.status === b.status) return b.submittedAt - a.submittedAt;
        return a.status === 'pending' ? -1 : 1;
    });

    updateCounters();
    renderList();
}

function updateCounters() {
    const pending = allSubmissions.filter(s => s.status === 'pending').length;
    const done = allSubmissions.filter(s => s.status === 'graded').length;
    document.getElementById('count-pending').textContent = pending;
    document.getElementById('count-done').textContent = done;
}

window.filterSubmissions = () => {
    renderList();
};

function renderList() {
    const search = document.getElementById('search-student').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status').value;
    const list = document.getElementById('submissions-list');
    
    list.innerHTML = '';

    const filtered = allSubmissions.filter(s => {
        const matchSearch = s.studentName.toLowerCase().includes(search) || s.lessonTitle.toLowerCase().includes(search);
        const matchStatus = statusFilter === 'all' || s.status === statusFilter;
        return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div class="col-12 text-center text-muted py-5">Nenhuma tarefa encontrada com esses filtros.</div>';
        return;
    }

    filtered.forEach((sub, idx) => {
        const badge = sub.status === 'pending' 
            ? '<span class="badge bg-warning text-dark">Pendente</span>' 
            : `<span class="badge bg-success">Nota: ${sub.score}/${sub.maxPoints}</span>`;

        const div = document.createElement('div');
        div.className = 'col-md-6 col-lg-4';
        div.innerHTML = `
            <div class="card card-submission h-100 bg-white" onclick="window.openCorrection(${idx})">
                <div class="card-body">
                    <div class="d-flex justify-content-between mb-2">
                        <small class="text-muted fw-bold" style="font-size:0.7rem;">${sub.moduleTitle} • ${sub.sectionTitle}</small>
                        ${badge}
                    </div>
                    <h6 class="fw-bold mb-1 text-truncate">${sub.lessonTitle}</h6>
                    <div class="d-flex align-items-center gap-2 mb-3">
                        <div class="bg-light rounded-circle d-flex align-items-center justify-content-center text-primary fw-bold" style="width:32px; height:32px;">
                            ${sub.studentName.charAt(0)}
                        </div>
                        <div>
                            <div class="small fw-bold text-dark">${sub.studentName}</div>
                            <div class="small text-muted" style="font-size:0.7rem;">Enviado em: ${sub.submittedAt.toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div class="d-grid">
                        <button class="btn btn-sm btn-outline-primary fw-bold">Corrigir / Visualizar</button>
                    </div>
                </div>
            </div>`;
        // Hack para passar o objeto correto (ja que o array filtered muda índices)
        div.querySelector('.card').onclick = () => openCorrectionModal(sub);
        list.appendChild(div);
    });
}

// === LÓGICA DO MODAL DE CORREÇÃO ===

function openCorrectionModal(sub) {
    currentEnrollmentId = sub.enrollmentId;
    currentLessonId = sub.lessonId;
    currentLessonData = sub; // Referência para salvar depois

    document.getElementById('modal-student-name').textContent = sub.studentName;
    document.getElementById('modal-task-title').textContent = sub.lessonTitle;
    document.getElementById('final-score').value = sub.score;
    document.getElementById('general-feedback').value = sub.submissionData.feedback || '';

    const container = document.getElementById('modal-answers-container');
    container.innerHTML = '';

    // Recupera pontuações e feedbacks por item
    const itemScores = sub.submissionData.item_scores || {};
    const itemFeedbacks = sub.submissionData.item_feedback || {};

    sub.taskItems.forEach((item, idx) => {
        const studentAns = sub.submissionData.answers[item.id] || 'Não respondeu';
        const currentScore = itemScores[item.id] || 0;
        const currentFeedback = itemFeedbacks[item.id] || '';

        // Renderiza visualização da resposta
        let displayAnswer = '';
        if (item.type === 'text') {
            displayAnswer = `<div class="p-3 bg-white border rounded mb-2 text-dark" style="white-space: pre-wrap;">${studentAns}</div>`;
        } else {
            displayAnswer = `<div class="p-3 bg-white border rounded mb-2">
                <i class='bx bx-file'></i> <a href="${studentAns}" target="_blank" class="fw-bold">Abrir Arquivo Enviado</a>
            </div>`;
        }

        const itemHtml = `
            <div class="card border shadow-sm">
                <div class="card-header bg-light d-flex justify-content-between">
                    <span class="fw-bold">Questão ${idx + 1}</span>
                    <span class="badge bg-secondary">Vale ${item.points} pts</span>
                </div>
                <div class="card-body">
                    <p class="mb-2 small text-muted">${item.statement}</p>
                    ${displayAnswer}
                    
                    <div class="row g-2 mt-3 pt-3 border-top bg-warning bg-opacity-10 p-2 rounded">
                        <div class="col-md-3">
                            <label class="small fw-bold">Nota</label>
                            <input type="number" class="form-control form-control-sm item-score-input" 
                                   data-id="${item.id}" max="${item.points}" value="${currentScore}" 
                                   onchange="window.calculateTotal()">
                        </div>
                        <div class="col-md-9">
                            <label class="small fw-bold">Feedback</label>
                            <input type="text" class="form-control form-control-sm item-feedback-input" 
                                   data-id="${item.id}" value="${currentFeedback}" placeholder="Comentário...">
                        </div>
                    </div>
                </div>
            </div>`;
        container.innerHTML += itemHtml;
    });

    const modal = new bootstrap.Modal(document.getElementById('modalGrading'));
    modal.show();
}

window.calculateTotal = () => {
    let total = 0;
    document.querySelectorAll('.item-score-input').forEach(inp => {
        total += parseFloat(inp.value) || 0;
    });
    document.getElementById('final-score').value = total;
};

window.saveCorrection = async () => {
    const btn = document.querySelector('#modalGrading .btn-success');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Salvando...';
    btn.disabled = true;

    try {
        const finalScore = parseFloat(document.getElementById('final-score').value) || 0;
        const generalFeedback = document.getElementById('general-feedback').value;

        // Coleta dados dos itens
        const itemScores = {};
        const itemFeedbacks = {};
        
        document.querySelectorAll('.item-score-input').forEach(inp => itemScores[inp.dataset.id] = parseFloat(inp.value));
        document.querySelectorAll('.item-feedback-input').forEach(inp => itemFeedbacks[inp.dataset.id] = inp.value);

        // 1. Busca enrollment atualizado para não sobrescrever outras coisas
        const { data: currentEnrol } = await supabase
            .from('class_enrollments')
            .select('grades')
            .eq('id', currentEnrollmentId)
            .single();

        const grades = currentEnrol.grades;
        
        // Atualiza score global
        if (!grades.scores) grades.scores = {};
        grades.scores[currentLessonId] = finalScore;

        // Atualiza detalhes da tarefa
        if (grades.tasks && grades.tasks[currentLessonId]) {
            grades.tasks[currentLessonId].item_scores = itemScores;
            grades.tasks[currentLessonId].item_feedback = itemFeedbacks;
            grades.tasks[currentLessonId].feedback = generalFeedback; // Feedback geral
            grades.tasks[currentLessonId].status = 'graded';
        }

        // 2. Salva no banco
        const { error } = await supabase
            .from('class_enrollments')
            .update({ grades: grades })
            .eq('id', currentEnrollmentId);

        if (error) throw error;

        // Sucesso
        alert("Correção salva com sucesso!");
        bootstrap.Modal.getInstance(document.getElementById('modalGrading')).hide();
        loadData(); // Recarrega lista

    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};