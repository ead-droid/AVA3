/**
 * Gerenciador de Atividades (Quiz e Tarefas)
 * Responsável por renderizar e controlar o estado das interações.
 */

let currentQuizState = {
    data: null,
    currentIndex: 0,
    answers: {},
    lessonId: null,
    points: 0,
    onComplete: null // Callback para chamar quando terminar
};

export const ActivityManager = {
    
    // Função principal chamada pelo classroom.js
    renderActivity: (lesson, containerId, onCompleteCallback) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = ''; // Limpa área

        if (lesson.type === 'QUIZ') {
            _initQuiz(lesson, container, onCompleteCallback);
        } else if (lesson.type === 'TAREFA') {
            _renderTask(lesson, container, onCompleteCallback);
        }
    },

    // Permite que o classroom.js mostre o resultado se o aluno já tiver feito
    renderResult: (lesson, containerId, score) => {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="activity-container">
                <div class="activity-body text-center">
                    <h3 class="text-success"><i class='bx bx-check-circle'></i> Atividade Concluída</h3>
                    <div class="quiz-score-display">${score} / ${lesson.points}</div>
                    <p class="text-muted">Você já finalizou esta atividade.</p>
                </div>
            </div>`;
    }
};

/* ================= LÓGICA INTERNA DO QUIZ ================= */

function _initQuiz(lesson, container, onComplete) {
    // Configura estado inicial
    currentQuizState = {
        data: lesson.quiz_data || { questions: [] },
        currentIndex: -1, // -1 para mostrar tela de "Iniciar"
        answers: {},
        lessonId: lesson.id,
        points: lesson.points || 0,
        onComplete: onComplete
    };

    // Anexa funções ao window para o HTML string funcionar (método legado mas eficaz)
    window.actNextStep = _nextQuizStep;
    window.actSelectOpt = _selectOption;
    window.actStartQuiz = _startQuiz;

    _renderQuizStep(container);
}

function _renderQuizStep(container) {
    const { data, currentIndex, answers } = currentQuizState;
    
    // 1. Tela de Início
    if (currentIndex === -1) {
        container.innerHTML = `
            <div class="activity-container">
                <div class="activity-header">
                    <h4><i class='bx bx-trophy text-warning'></i> Quiz: Valendo Nota</h4>
                </div>
                <div class="activity-body text-center">
                    <p class="mb-4">Este quiz contém <strong>${data.questions.length} questões</strong>.<br>Responda com atenção para liberar sua pontuação.</p>
                    <button class="btn btn-primary btn-lg rounded-pill px-5" onclick="window.actStartQuiz()">
                        Começar Agora
                    </button>
                </div>
            </div>`;
        return;
    }

    // 2. Renderiza Pergunta Atual
    const q = data.questions[currentIndex];
    const total = data.questions.length;
    
    // Gera HTML das opções
    const optionsHtml = q.options.map((opt, i) => {
        const isSelected = answers[currentIndex] === i;
        const text = typeof opt === 'object' ? opt.text : opt; // Suporta string ou objeto
        return `
            <div class="quiz-option-card ${isSelected ? 'selected' : ''}" onclick="window.actSelectOpt(${i})">
                <input type="radio" name="q_opt" ${isSelected ? 'checked' : ''}>
                <span>${text}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="activity-container">
            <div class="activity-header d-flex justify-content-between align-items-center">
                <span class="badge bg-light text-dark border">Questão ${currentIndex + 1} de ${total}</span>
                <small class="text-muted">Valendo ${currentQuizState.points} pts</small>
            </div>
            <div class="activity-body">
                <div class="quiz-question-text">${q.text}</div>
                <div class="quiz-options-list">
                    ${optionsHtml}
                </div>
                <div class="quiz-actions">
                    <button class="btn btn-primary px-4 rounded-pill" id="btn-quiz-next" onclick="window.actNextStep()">
                        ${currentIndex === total - 1 ? 'Finalizar <i class="bx bx-check"></i>' : 'Próxima <i class="bx bx-chevron-right"></i>'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

function _startQuiz() {
    currentQuizState.currentIndex = 0;
    _renderQuizStep(document.getElementById('activity-area'));
}

function _selectOption(index) {
    currentQuizState.answers[currentQuizState.currentIndex] = index;
    // Re-renderiza para atualizar estilo visual (classe selected)
    _renderQuizStep(document.getElementById('activity-area'));
}

function _nextQuizStep() {
    const { data, currentIndex, answers } = currentQuizState;
    
    // Validação: obrigar selecionar
    if (answers[currentIndex] === undefined) {
        alert("Por favor, selecione uma alternativa.");
        return;
    }

    if (currentIndex < data.questions.length - 1) {
        currentQuizState.currentIndex++;
        _renderQuizStep(document.getElementById('activity-area'));
    } else {
        _finishQuiz();
    }
}

function _finishQuiz() {
    // Calcula nota
    let correctCount = 0;
    const { data, answers, points } = currentQuizState;
    
    data.questions.forEach((q, i) => {
        const selectedIdx = answers[i];
        // Verifica se a opção selecionada tem flag isCorrect ou se bate com um gabarito externo (simplificado aqui)
        if (q.options[selectedIdx] && q.options[selectedIdx].isCorrect) {
            correctCount++;
        }
    });

    // Regra de 3 simples para nota
    const finalScore = points > 0 ? (correctCount / data.questions.length) * points : 0;
    const formattedScore = parseFloat(finalScore.toFixed(1));

    // Renderiza tela final
    const container = document.getElementById('activity-area');
    container.innerHTML = `
        <div class="activity-container">
            <div class="activity-body text-center">
                <div class="spinner-border text-primary mb-3" role="status"></div>
                <h4>Calculando resultados...</h4>
            </div>
        </div>
    `;

    // Chama o callback do classroom.js para salvar no banco
    if (currentQuizState.onComplete) {
        currentQuizState.onComplete(formattedScore);
    }
}

/* ================= LÓGICA DA TAREFA ================= */

function _renderTask(lesson, container, onComplete) {
    // Anexa função de envio fake
    window.actSubmitTask = () => {
        const btn = document.getElementById('btn-task-submit');
        btn.innerHTML = `<div class="spinner-border spinner-border-sm"></div> Enviando...`;
        
        setTimeout(() => {
            // Tarefa geralmente não gera nota automática, mas marca como feito
            if(onComplete) onComplete(null); // null score = pendente de correção ou apenas concluído
        }, 1500);
    };

    container.innerHTML = `
        <div class="activity-container">
            <div class="activity-header">
                <h5><i class='bx bx-task text-primary'></i> Envio de Tarefa</h5>
            </div>
            <div class="activity-body task-box">
                <p class="text-muted mb-4">${lesson.description || 'Siga as instruções da aula e envie seu arquivo abaixo.'}</p>
                
                <div class="task-upload-area">
                    <i class='bx bx-cloud-upload task-icon'></i>
                    <h5>Clique para selecionar o arquivo</h5>
                    <p class="small text-muted">PDF, DOCX ou JPG (Máx 10MB)</p>
                </div>

                <div class="form-floating mb-3 text-start">
                    <textarea class="form-control" placeholder="Comentários" style="height: 100px"></textarea>
                    <label>Adicionar comentário (opcional)</label>
                </div>

                <button id="btn-task-submit" class="btn btn-success btn-lg rounded-pill px-5" onclick="window.actSubmitTask()">
                    Enviar Atividade
                </button>
            </div>
        </div>
    `;
}