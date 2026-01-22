import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const lessonId = params.get('id');

let taskData = { instructions: "", items: [] };
let hasUnsavedChanges = false; // Controle de proteção

document.addEventListener('DOMContentLoaded', async () => {
    if (!lessonId) { alert("ID inválido"); return; }
    
    // Proteção ao fechar aba
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    await checkAuth();
    await loadLessonData();
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

// --- CONTROLE DE MUDANÇAS ---
window.markUnsaved = function() {
    if (!hasUnsavedChanges) {
        hasUnsavedChanges = true;
        const btns = [document.getElementById('btn-save-top'), document.getElementById('btn-save-bottom')];
        btns.forEach(b => {
            if(b) {
                b.classList.remove('btn-success');
                b.classList.add('btn-warning', 'text-dark');
                b.innerHTML = "<i class='bx bx-save'></i> SALVAR (Pendente)";
            }
        });
    }
};

function resetSaveStatus() {
    hasUnsavedChanges = false;
    const btns = [document.getElementById('btn-save-top'), document.getElementById('btn-save-bottom')];
    btns.forEach(b => {
        if(b) {
            b.classList.remove('btn-warning', 'text-dark');
            b.classList.add('btn-success', 'text-white');
            b.innerHTML = "<i class='bx bx-save'></i> Salvar";
        }
    });
}

// --- CARREGAMENTO ---
async function loadLessonData() {
    const { data: lesson, error } = await supabase.from('lessons').select('*').eq('id', lessonId).single();
    if (error || !lesson) { alert("Erro ao carregar dados."); return; }

    document.getElementById('task-title').textContent = lesson.title;

    // Hierarquia (Blindada)
    let hierarchyText = "...";
    let courseIdBack = params.get('courseId');
    try {
        if (lesson.section_id) {
            const { data: sec } = await supabase.from('sections').select('module_id').eq('id', lesson.section_id).single();
            if(sec) {
                const { data: mod } = await supabase.from('modules').select('title, course_id').eq('id', sec.module_id).single();
                if(mod) {
                    const { data: c } = await supabase.from('courses').select('id, title').eq('id', mod.course_id).single();
                    if(c) {
                        hierarchyText = `${c.title} > ${mod.title}`;
                        if(!courseIdBack) courseIdBack = c.id;
                    }
                }
            }
        } else if (lesson.module_id) {
            const { data: mod } = await supabase.from('modules').select('title, course_id').eq('id', lesson.module_id).single();
            if (mod) {
                const { data: course } = await supabase.from('courses').select('id, title').eq('id', mod.course_id).single();
                if (course) {
                    hierarchyText = `${course.title} > ${mod.title}`;
                    if(!courseIdBack) courseIdBack = course.id;
                }
            }
        }
    } catch(e) {}
    document.getElementById('task-hierarchy').textContent = hierarchyText;

    // Carrega Dados da Tarefa
    if (lesson.task_data) {
        taskData = lesson.task_data;
        document.getElementById('task-instructions').value = taskData.instructions || '';
    }
    
    renderTasks();
    resetSaveStatus(); // Limpa status pós-load

    // Listeners
    document.getElementById('task-instructions').addEventListener('input', (e) => {
        taskData.instructions = e.target.value;
        markUnsaved();
    });

    document.getElementById('btn-back').onclick = () => {
        if(hasUnsavedChanges && !confirm("⚠️ Alterações não salvas! Deseja sair?")) return;
        if(courseIdBack) window.location.href = `course-editor.html?id=${courseIdBack}`;
        else window.history.back();
    };
}

// --- LÓGICA DA TAREFA ---

window.addTaskItem = function(type) {
    syncEditors(); // Salva o estado atual dos editores abertos
    taskData.items.push({ 
        id: Date.now(), 
        type: type, 
        statement: "", 
        points: 0, 
        resource_link: "" 
    });
    markUnsaved();
    renderTasks();
    // Scroll suave para o novo item
    setTimeout(() => window.scrollTo({top: document.body.scrollHeight, behavior:'smooth'}), 200);
};

window.removeTaskItem = function(id) {
    if(confirm("Remover este item?")) { 
        syncEditors(); 
        taskData.items = taskData.items.filter(i => i.id !== id); 
        markUnsaved();
        renderTasks(); 
    }
};

// Renderização
function renderTasks() {
    const list = document.getElementById('task-list');
    list.innerHTML = '';
    document.getElementById('items-count').textContent = taskData.items.length + ' itens';
    
    const tpl = document.getElementById('tpl-task-item');
    taskData.items.forEach((item, i) => {
        const clone = tpl.content.cloneNode(true);
        clone.querySelector('.item-number').textContent = '#' + (i+1);
        
        const label = clone.querySelector('.item-type-label');
        const card = clone.querySelector('.task-item-card');
        const preview = clone.querySelector('.preview-area');

        // Configuração Visual por Tipo
        if(item.type === 'text') { 
            card.classList.add('border-type-text');
            label.textContent = 'DISSERTATIVA';
            label.className += ' text-primary';
            preview.innerHTML = '<textarea class="form-control" disabled rows="2" placeholder="O aluno digitará a resposta aqui..."></textarea>';
        } else {
            // TIPO LINK
            card.classList.add('border-type-link');
            label.textContent = 'ENVIO DE LINK'; // Texto atualizado
            label.className += ' text-info';
            preview.innerHTML = '<div class="input-group"><span class="input-group-text bg-white"><i class="bx bx-link"></i></span><input class="form-control" disabled placeholder="O aluno colará o link aqui (Drive, Docs, etc)..."></div>';
        }

        // Inputs
        const pts = clone.querySelector('.item-points');
        pts.value = item.points;
        pts.addEventListener('input', (e) => { 
            item.points = e.target.value; 
            updateTotal(); 
            markUnsaved(); 
        });

        const res = clone.querySelector('.item-resource');
        res.value = item.resource_link || '';
        res.addEventListener('input', (e) => { 
            item.resource_link = e.target.value; 
            markUnsaved(); 
        });

        // Editor Rico (Toolbar)
        const editor = clone.querySelector('.rich-content');
        editor.innerHTML = item.statement;
        // Listener de digitação no editor
        editor.addEventListener('input', () => markUnsaved());
        
        const toolbar = clone.querySelector('.rich-toolbar');
        setupRichToolbar(toolbar, editor, item);

        // Ações
        clone.querySelector('.btn-delete').onclick = () => window.removeTaskItem(item.id);
        
        const up = clone.querySelector('.btn-move-up');
        const down = clone.querySelector('.btn-move-down');
        
        if(i === 0) up.disabled = true; 
        else up.onclick = () => moveItem(i, -1);
        
        if(i === taskData.items.length - 1) down.disabled = true; 
        else down.onclick = () => moveItem(i, 1);

        list.appendChild(clone);
    });
    updateTotal();
}

function moveItem(i, dir) {
    syncEditors();
    [taskData.items[i], taskData.items[i+dir]] = [taskData.items[i+dir], taskData.items[i]];
    markUnsaved();
    renderTasks();
}

// Configura a toolbar de cada item
function setupRichToolbar(tb, ed, item) {
    // Botões simples
    tb.querySelectorAll('.rich-btn[data-cmd]').forEach(b => {
        b.onclick = (e) => {
            e.preventDefault();
            const cmd = b.dataset.cmd;
            
            if (cmd === 'createLink') {
                const u = prompt('URL do Link:'); 
                if(u) document.execCommand('createLink', false, u);
            } else {
                document.execCommand(cmd, false, null);
            }
            item.statement = ed.innerHTML;
            markUnsaved();
        }
    });

    // Inputs de Cor
    tb.querySelectorAll('input[type="color"]').forEach(inp => {
        inp.onchange = (e) => {
            document.execCommand(inp.dataset.cmd, false, e.target.value);
            item.statement = ed.innerHTML;
            markUnsaved();
        };
    });
}

function syncEditors() {
    // Sincroniza o HTML dos editores visuais para o objeto de dados antes de re-renderizar
    const editors = document.querySelectorAll('.rich-content');
    editors.forEach((ed, i) => {
        if(taskData.items[i]) taskData.items[i].statement = ed.innerHTML;
    });
}

function updateTotal() {
    const t = taskData.items.reduce((acc, i) => acc + (parseFloat(i.points)||0), 0);
    document.getElementById('total-points-display').textContent = t;
}

// --- SALVAR ---
window.saveTask = async function() {
    syncEditors();
    
    const btns = [document.getElementById('btn-save-top'), document.getElementById('btn-save-bottom')];
    btns.forEach(b => { if(b) { b.innerHTML = 'Salvando...'; b.disabled = true; } });
    
    try {
        const total = taskData.items.reduce((acc, i) => acc + (parseFloat(i.points)||0), 0);
        
        const { error } = await supabase
            .from('lessons')
            .update({ task_data: taskData, points: total })
            .eq('id', lessonId);
            
        if(error) throw error;
        
        resetSaveStatus();
        alert("✅ Atividade salva com sucesso!");
        
    } catch(err) {
        console.error(err);
        alert("Erro ao salvar: " + err.message);
        btns.forEach(b => { if(b) { b.disabled = false; b.innerHTML = 'Tentar Novamente'; } });
    }
};