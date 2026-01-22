import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const lessonId = params.get('id');

// --- ESTADO GLOBAL ---
let quizData = {
    settings: { mode: 'manual', drawCount: 5, externalSource: 'current', shuffle: true },
    questions: []
};
let lessonInfo = null;
let globalQuestionsBank = [];
let hasUnsavedChanges = false; // <--- O GUARDIÃO (Controla se há mudanças)

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    if (!lessonId) { alert("ID da aula não encontrado."); return; }
    
    // 1. ATIVA A PROTEÇÃO AO FECHAR A ABA
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = ''; // Padrão do navegador para exibir o alerta
        }
    });

    await checkAuth();
    await loadLessonData();
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

// --- FUNÇÃO PARA MARCAR QUE HOUVE MUDANÇA ---
window.markUnsaved = function() {
    if (!hasUnsavedChanges) {
        hasUnsavedChanges = true;
        // Opcional: Efeito visual no botão salvar para chamar atenção
        const btns = document.querySelectorAll('.btn-success');
        btns.forEach(b => {
            b.classList.remove('btn-success');
            b.classList.add('btn-warning', 'text-dark');
            b.innerHTML = "<i class='bx bx-save'></i> SALVAR (Pendente)";
        });
    }
};

// --- CARREGAMENTO DE DADOS ---
async function loadLessonData() {
    const { data: lesson, error } = await supabase.from('lessons').select('*').eq('id', lessonId).single();
    
    if (error || !lesson) { alert("Erro ao carregar aula."); return; }
    
    lessonInfo = lesson;
    document.getElementById('quiz-title').textContent = lesson.title;
    document.getElementById('quiz-points').textContent = (lesson.points || 0) + ' pts';

    // Hierarquia (Blindada contra falhas)
    let hierarchyText = "...";
    let courseIdBack = params.get('courseId');
    try {
        if (lesson.section_id) {
            const { data: section } = await supabase.from('sections').select('module_id').eq('id', lesson.section_id).single();
            if(section) {
                 const { data: mod } = await supabase.from('modules').select('title, course_id').eq('id', section.module_id).single();
                 if(mod) {
                     const { data: course } = await supabase.from('courses').select('id, title').eq('id', mod.course_id).single();
                     if(course) {
                         hierarchyText = `${course.title} > ${mod.title}`;
                         if(!courseIdBack) courseIdBack = course.id;
                     }
                 }
            }
        } else if (lesson.module_id) {
             const { data: mod } = await supabase.from('modules').select('title, course_id').eq('id', lesson.module_id).single();
             if(mod) {
                 const { data: course } = await supabase.from('courses').select('id, title').eq('id', mod.course_id).single();
                 if(course) {
                     hierarchyText = `${course.title} > ${mod.title}`;
                     if(!courseIdBack) courseIdBack = course.id;
                 }
             }
        }
    } catch(e) {}

    document.getElementById('quiz-hierarchy').textContent = hierarchyText;
    
    // Botão Voltar com Proteção
    document.getElementById('btn-back').onclick = () => {
        if(hasUnsavedChanges && !confirm("⚠️ Você tem alterações não salvas!\n\nSe sair agora, perderá o que fez. Deseja sair mesmo assim?")) return;
        
        if (courseIdBack) window.location.href = `course-editor.html?id=${courseIdBack}`;
        else window.history.back();
    };

    // Dados do Quiz
    if (lesson.quiz_data) {
        if (Array.isArray(lesson.quiz_data)) {
            quizData.questions = lesson.quiz_data;
        } else {
            quizData = lesson.quiz_data;
            if(!quizData.settings) quizData.settings = { mode: 'manual', drawCount: 5 };
            if(!quizData.questions) quizData.questions = [];
        }
    }

    // Preenche Inputs
    const set = quizData.settings || {};
    if(document.getElementById('quiz-mode')) document.getElementById('quiz-mode').value = set.mode || 'manual';
    if(document.getElementById('draw-count')) document.getElementById('draw-count').value = set.drawCount || 5;
    if(document.getElementById('external-bank-source')) document.getElementById('external-bank-source').value = set.externalSource || 'current';

    updateSettingsUI();
    renderQuestions();
    updatePointsDisplay();
    
    // Reseta flag pois acabamos de carregar do banco
    resetSaveStatus();
}

function resetSaveStatus() {
    hasUnsavedChanges = false;
    const btns = document.querySelectorAll('.btn-warning'); // Botões que estavam amarelos
    btns.forEach(b => {
        b.classList.remove('btn-warning', 'text-dark');
        b.classList.add('btn-success', 'text-white');
        b.innerHTML = "<i class='bx bx-save'></i> Salvar";
    });
}

// --- LÓGICA DE UI ---
window.updateSettings = function() {
    markUnsaved(); // Marcou mudança
    quizData.settings.mode = document.getElementById('quiz-mode').value;
    quizData.settings.externalSource = document.getElementById('external-bank-source').value;
    updateSettingsUI();
    updatePointsDisplay();
};

function updateSettingsUI() {
    const isBank = quizData.settings.mode === 'bank';
    const bankPanel = document.getElementById('bank-settings');
    const alertBank = document.getElementById('alert-bank');
    const alertFixed = document.getElementById('alert-fixed');

    if(bankPanel) bankPanel.style.display = isBank ? 'flex' : 'none';
    if(alertBank) alertBank.style.display = isBank ? 'block' : 'none';
    if(alertFixed) alertFixed.style.display = isBank ? 'none' : 'block';
}

window.updatePointsDisplay = function() {
    const countInput = document.getElementById('draw-count');
    if(countInput) quizData.settings.drawCount = parseInt(countInput.value) || 1;

    const totalPoints = lessonInfo?.points || 0;
    const totalQuestions = quizData.questions.length;
    let applied = totalQuestions;
    
    if (quizData.settings.mode === 'bank') {
        applied = quizData.settings.drawCount;
        if(applied > totalQuestions) applied = totalQuestions;
    }

    const val = applied > 0 ? (totalPoints / applied).toFixed(2) : 0;
    document.getElementById('points-per-question').textContent = `${val} pts`;
    document.getElementById('count-total').textContent = totalQuestions;
    document.getElementById('count-applied').textContent = applied;
};

// --- RENDERIZAÇÃO (VIGIADA) ---
window.renderQuestions = function() {
    const container = document.getElementById('questions-list');
    container.innerHTML = '';
    const tplQ = document.getElementById('tpl-question');
    const tplO = document.getElementById('tpl-option');

    quizData.questions.forEach((q, qIdx) => {
        const qClone = tplQ.content.cloneNode(true);
        qClone.querySelector('.question-label').textContent = `#${qIdx + 1}`;
        
        const txt = qClone.querySelector('.question-text');
        txt.value = q.text || '';
        // VIGILÂNCIA: Se digitar, marca não salvo
        txt.oninput = (e) => { quizData.questions[qIdx].text = e.target.value; markUnsaved(); };

        const feed = qClone.querySelector('.question-feedback');
        feed.value = q.feedback || '';
        feed.oninput = (e) => { quizData.questions[qIdx].feedback = e.target.value; markUnsaved(); };
        
        qClone.querySelector('.btn-delete').onclick = () => {
            if(confirm("Remover esta questão?")) { 
                quizData.questions.splice(qIdx, 1); 
                markUnsaved(); 
                renderQuestions(); 
            }
        };

        const optsDiv = qClone.querySelector('.options-container');
        qClone.querySelector('.btn-add-opt').onclick = () => addOption(qIdx);

        q.options.forEach((opt, oIdx) => {
            const oClone = tplO.content.cloneNode(true);
            const check = oClone.querySelector('.correct-indicator');
            if (opt.isCorrect) check.classList.add('active');
            
            check.onclick = () => {
                quizData.questions[qIdx].options.forEach((o, i) => o.isCorrect = (i === oIdx));
                markUnsaved();
                renderQuestions();
            };

            const inp = oClone.querySelector('.option-input');
            inp.value = opt.text || '';
            // VIGILÂNCIA NA OPÇÃO TAMBÉM
            inp.oninput = (e) => { quizData.questions[qIdx].options[oIdx].text = e.target.value; markUnsaved(); };

            oClone.querySelector('.btn-remove-opt').onclick = () => {
                quizData.questions[qIdx].options.splice(oIdx, 1);
                markUnsaved(); 
                renderQuestions();
            };
            optsDiv.appendChild(oClone);
        });
        container.appendChild(qClone);
    });
    updatePointsDisplay();
};

window.addQuestion = function() {
    quizData.questions.push({
        id: Date.now(), text: "", feedback: "",
        options: [{text:"", isCorrect:false}, {text:"", isCorrect:false}]
    });
    markUnsaved(); // Marcou mudança
    renderQuestions();
    setTimeout(() => window.scrollTo({top: document.body.scrollHeight, behavior:'smooth'}), 200);
};

window.addOption = function(qIdx) {
    quizData.questions[qIdx].options.push({text:"", isCorrect:false});
    markUnsaved(); 
    renderQuestions();
};

// --- SALVAR (RESETANDO A PROTEÇÃO) ---
window.saveQuiz = async function() {
    if(!lessonId) { alert("ID perdido. Atualize a página."); return; }

    // Pega todos os botões de salvar (Topo e Fundo)
    const btns = document.querySelectorAll('.btn-warning, .btn-success');
    btns.forEach(b => { b.innerHTML = "Salvando..."; b.disabled = true; });

    try {
        const modeEl = document.getElementById('quiz-mode');
        const countEl = document.getElementById('draw-count');
        const srcEl = document.getElementById('external-bank-source');
        if(modeEl) quizData.settings.mode = modeEl.value;
        if(countEl) quizData.settings.drawCount = parseInt(countEl.value) || 5;
        if(srcEl) quizData.settings.externalSource = srcEl.value;

        const { error } = await supabase
            .from('lessons')
            .update({ quiz_data: quizData })
            .eq('id', lessonId);

        if(error) throw error;
        
        resetSaveStatus(); // <<< SUCESSO! AGORA PODE SAIR SE QUISER
        alert("✅ Quiz salvo com sucesso!");

    } catch (err) {
        console.error(err);
        alert("Erro ao salvar: " + err.message);
        // Volta estado de erro/pendente nos botões
        btns.forEach(b => { b.disabled = false; b.innerHTML = "Tentar Novamente"; });
    }
};

// --- IMPORTADOR GIFT ---
window.modalImportGIFT = function() { new bootstrap.Modal(document.getElementById('modalGIFT')).show(); };
window.processGIFT = function() {
    const text = document.getElementById('gift-input').value;
    if (!text.trim()) return;
    const blocks = text.replace(/\/\/.*$/gm, '').split(/\n\s*\n/).filter(b => b.trim().length > 0);
    let count = 0;
    blocks.forEach(block => {
        let qText = block.trim();
        let titleMatch = qText.match(/^::(.*?)::/);
        if(titleMatch) qText = qText.replace(titleMatch[0], '').trim();
        let answerMatch = qText.match(/\{(.*?)\}/s);
        if(answerMatch) {
            let options = [];
            let ansContent = answerMatch[1];
            qText = qText.replace(answerMatch[0], '').trim();
            let regex = /([=~])([^#=~]+)(?:#([^=~]+))?/g;
            let m;
            while ((m = regex.exec(ansContent)) !== null) {
                options.push({ text: m[2].trim(), isCorrect: m[1] === '=', feedback: m[3] ? m[3].trim() : '' });
            }
            if(options.length) { quizData.questions.push({ id: Date.now()+Math.random(), text: qText, options }); count++; }
        }
    });
    
    if(count > 0) markUnsaved(); // Marcou mudança

    alert(`${count} importadas.`);
    bootstrap.Modal.getInstance(document.getElementById('modalGIFT')).hide();
    document.getElementById('gift-input').value = '';
    renderQuestions();
};

// --- BANCO GLOBAL ---
window.openQuestionBank = async function() {
    new bootstrap.Modal(document.getElementById('modalBank')).show();
    const list = document.getElementById('bank-list');
    list.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
    
    const { data: lessons, error } = await supabase.from('lessons').select('id, title, quiz_data').not('quiz_data', 'is', null).neq('id', lessonId);
    
    if (error) { list.innerHTML = 'Erro ao buscar.'; return; }
    
    globalQuestionsBank = [];
    const sources = new Set();
    lessons.forEach(l => {
        let qs = [];
        if (Array.isArray(l.quiz_data)) qs = l.quiz_data;
        else if (l.quiz_data?.questions) qs = l.quiz_data.questions;
        if (qs && qs.length) {
            sources.add(l.title);
            qs.forEach(q => globalQuestionsBank.push({ source: l.title, data: q }));
        }
    });

    const select = document.getElementById('bank-source-filter');
    select.innerHTML = '<option value="">Todas</option>';
    sources.forEach(s => select.innerHTML += `<option value="${s}">${s}</option>`);
    renderBankList(globalQuestionsBank);
};

window.renderBankList = function(items) {
    const list = document.getElementById('bank-list');
    list.innerHTML = '';
    if(!items.length) { list.innerHTML = '<div class="alert alert-warning">Vazio.</div>'; return; }
    items.forEach((item, idx) => {
        const q = item.data;
        const div = document.createElement('div');
        div.className = 'card p-3 shadow-sm border-0 bank-item-row mb-2';
        div.dataset.source = item.source;
        div.dataset.text = (q.text || '').toLowerCase();
        div.innerHTML = `<div class="d-flex gap-3 align-items-start"><div class="form-check pt-1"><input class="form-check-input bank-chk" type="checkbox" value="${idx}" style="transform: scale(1.3);"></div><div class="flex-grow-1"><div class="d-flex justify-content-between mb-1"><span class="badge bg-light text-dark border">${item.source}</span><span class="badge bg-secondary">${q.options?.length||0} opts</span></div><p class="mb-0 fw-bold">${q.text}</p></div></div>`;
        list.appendChild(div);
    });
    document.querySelectorAll('.bank-chk').forEach(c => c.addEventListener('change', () => {
        document.getElementById('bank-selected-count').innerText = document.querySelectorAll('.bank-chk:checked').length;
    }));
};

window.filterBank = function() {
    const txt = document.getElementById('bank-search').value.toLowerCase();
    const src = document.getElementById('bank-source-filter').value;
    document.querySelectorAll('.bank-item-row').forEach(r => {
        const matchTxt = r.dataset.text.includes(txt);
        const matchSrc = src === "" || r.dataset.source === src;
        r.style.display = (matchTxt && matchSrc) ? 'block' : 'none';
    });
};

window.importFromBank = function() {
    const chks = document.querySelectorAll('.bank-chk:checked');
    let count = 0;
    chks.forEach(c => {
        const item = globalQuestionsBank[c.value];
        if(item) {
            const clone = JSON.parse(JSON.stringify(item.data));
            clone.id = Date.now() + Math.random();
            quizData.questions.push(clone);
            count++;
        }
    });
    if(count > 0) {
        markUnsaved(); // Marcou mudança
        alert(`${count} importadas!`);
        bootstrap.Modal.getInstance(document.getElementById('modalBank')).hide();
        renderQuestions();
    }
};