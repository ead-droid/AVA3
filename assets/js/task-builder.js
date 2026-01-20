import { supabase } from './supabaseClient.js';
const params = new URLSearchParams(window.location.search);
const lessonId = params.get('id');
let taskData = { instructions: "", items: [] };

window.addTaskItem = function(type) {
    syncEditors();
    taskData.items.push({ id: Date.now(), type, statement: "", points: 0, resource_link: "" });
    renderTasks();
};

window.removeTaskItem = function(id) {
    if(confirm("Remover?")) { syncEditors(); taskData.items = taskData.items.filter(i => i.id !== id); renderTasks(); }
};

window.saveTask = async function() {
    syncEditors();
    const btn = document.getElementById('btn-save');
    btn.innerHTML = 'Salvando...'; btn.disabled = true;
    
    const total = taskData.items.reduce((acc, i) => acc + (parseFloat(i.points)||0), 0);
    const { error } = await supabase.from('lessons').update({ task_data: taskData, points: total }).eq('id', lessonId);
    
    btn.innerHTML = '<i class="bx bx-save me-1"></i> Salvar'; btn.disabled = false;
    if(error) alert(error.message); else alert("Salvo!");
};

function renderTasks() {
    const list = document.getElementById('task-list');
    list.innerHTML = '';
    document.getElementById('items-count').textContent = taskData.items.length + ' itens';
    
    const tpl = document.getElementById('tpl-task-item');
    taskData.items.forEach((item, i) => {
        const clone = tpl.content.cloneNode(true);
        clone.querySelector('.item-number').textContent = '#' + (i+1);
        
        if(item.type==='text') { 
            clone.querySelector('.task-item-card').classList.add('border-type-text');
            clone.querySelector('.item-type-label').textContent = 'DISSERTATIVA';
            clone.querySelector('.preview-area').innerHTML = '<textarea class="form-control" disabled placeholder="Resposta do aluno..."></textarea>';
        } else {
            clone.querySelector('.task-item-card').classList.add('border-type-link');
            clone.querySelector('.item-type-label').textContent = 'ARQUIVO';
            clone.querySelector('.preview-area').innerHTML = '<input class="form-control" disabled placeholder="Link do arquivo...">';
        }

        const pts = clone.querySelector('.item-points');
        pts.value = item.points;
        pts.oninput = (e) => { item.points = e.target.value; updateTotal(); };

        const res = clone.querySelector('.item-resource');
        res.value = item.resource_link || '';
        res.oninput = (e) => item.resource_link = e.target.value;

        const editor = clone.querySelector('.rich-content');
        editor.innerHTML = item.statement;
        
        // Toolbar actions
        const toolbar = clone.querySelector('.rich-toolbar');
        setupRichToolbar(toolbar, editor, item);

        clone.querySelector('.btn-delete').onclick = () => window.removeTaskItem(item.id);
        
        // Move Up/Down
        const up = clone.querySelector('.btn-move-up');
        const down = clone.querySelector('.btn-move-down');
        if(i===0) up.disabled = true; else up.onclick = () => moveItem(i, -1);
        if(i===taskData.items.length-1) down.disabled = true; else down.onclick = () => moveItem(i, 1);

        list.appendChild(clone);
    });
    updateTotal();
}

function moveItem(i, dir) {
    syncEditors();
    [taskData.items[i], taskData.items[i+dir]] = [taskData.items[i+dir], taskData.items[i]];
    renderTasks();
}

function setupRichToolbar(tb, ed, item) {
    tb.querySelectorAll('.rich-btn[data-cmd]').forEach(b => {
        b.onclick = (e) => {
            e.preventDefault();
            if(b.dataset.cmd === 'createLink') {
                const u = prompt('URL:'); if(u) document.execCommand('createLink', false, u);
            } else {
                document.execCommand(b.dataset.cmd, false, null);
            }
            item.statement = ed.innerHTML;
        }
    });
    ed.oninput = () => item.statement = ed.innerHTML;
}

function syncEditors() {
    document.querySelectorAll('.rich-content').forEach((ed, i) => {
        if(taskData.items[i]) taskData.items[i].statement = ed.innerHTML;
    });
}

function updateTotal() {
    const t = taskData.items.reduce((acc, i) => acc + (parseFloat(i.points)||0), 0);
    document.getElementById('total-points-display').textContent = t;
}

// Init
document.addEventListener('DOMContentLoaded', async () => {
    const { data } = await supabase.from('lessons').select('*, modules(id, title, courses(title))').eq('id', lessonId).single();
    if(data) {
        document.getElementById('task-title').textContent = data.title;
        document.getElementById('task-hierarchy').textContent = `${data.modules.courses.title} > ${data.modules.title}`;
        if(data.task_data) {
            taskData = data.task_data;
            document.getElementById('task-instructions').value = taskData.instructions || '';
        }
        renderTasks();
        
        document.getElementById('btn-back').onclick = () => window.location.href = `course-editor.html?id=${data.modules.courses.id}`;
        document.getElementById('task-instructions').oninput = (e) => taskData.instructions = e.target.value;
    }
});