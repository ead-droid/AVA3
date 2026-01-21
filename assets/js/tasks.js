import { supabase } from './supabaseClient.js';

let allTasks = [];
let allAdmins = [];
// Lista de páginas padrão
const defaultPages = [
    "index.html", "login.html", "app.html", "profile.html", 
    "classroom.html", "grading.html", "admin.html", 
    "class-manager.html", "tasks.html", "Outros"
];

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
    if (!['admin', 'gerente', 'professor'].includes(profile.role)) {
        alert("Acesso restrito.");
        window.location.href = 'index.html';
        return;
    }

    await loadAdmins();
    await loadTasks();
});

async function loadAdmins() {
    const { data } = await supabase.from('profiles').select('id, name').in('role', ['admin', 'gerente', 'professor']);
    if (data) {
        allAdmins = data;
        const select = document.getElementById('task-assignee');
        select.innerHTML = '<option value="">Ninguém</option>';
        data.forEach(u => select.innerHTML += `<option value="${u.id}">${u.name}</option>`);
    }
}

async function loadTasks() {
    const { data, error } = await supabase.from('system_tasks').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    allTasks = data;
    populatePageSelect();
    renderBoard();
}

function populatePageSelect() {
    const select = document.getElementById('task-page');
    // Junta páginas padrão com as que já foram cadastradas no banco
    const existingPages = allTasks.map(t => t.page_ref);
    const uniquePages = [...new Set([...defaultPages, ...existingPages])].sort();

    select.innerHTML = '<option value="" disabled selected>Selecione...</option>';
    uniquePages.forEach(p => select.innerHTML += `<option value="${p}">${p}</option>`);
    select.innerHTML += '<option value="new">+ Nova Página...</option>';
}

function renderBoard() {
    const statuses = ['ideas', 'todo', 'doing', 'review', 'done'];

    // Limpa
    statuses.forEach(s => {
        const list = document.getElementById(`list-${s}`);
        const count = document.getElementById(`count-${s}`);
        if(list) list.innerHTML = '';
        if(count) count.textContent = '0';
    });

    // Popula
    allTasks.forEach(task => {
        // Fallback se o status for inválido
        const status = statuses.includes(task.status) ? task.status : 'todo';
        const col = document.getElementById(`list-${status}`);
        if(col) col.appendChild(createCardHTML(task));
    });

    // Conta
    statuses.forEach(s => {
        const el = document.getElementById(`count-${s}`);
        if(el) el.textContent = allTasks.filter(t => t.status === s).length;
    });
}

function createCardHTML(task) {
    const assignee = allAdmins.find(a => a.id === task.assigned_to);
    const initials = assignee ? assignee.name.substring(0,2).toUpperCase() : '?';
    const dateStr = task.request_date ? new Date(task.request_date).toLocaleDateString('pt-BR') : '';

    const el = document.createElement('div');
    el.className = `kanban-card priority-${task.priority}`;
    el.draggable = true;
    el.dataset.id = task.id;
    
    el.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData("text/plain", task.id);
        el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));

    el.innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-2">
            <span class="card-tag">${task.page_ref}</span>
            <button class="btn btn-sm btn-link p-0 text-muted" onclick="window.openTaskModal(${task.id})"><i class='bx bx-edit-alt'></i></button>
        </div>
        <div class="card-desc">${task.description}</div>
        <div class="card-footer">
            <div class="d-flex align-items-center gap-2">
                ${task.assigned_to ? `<div class="card-avatar" title="${assignee.name}">${initials}</div>` : ''}
                ${dateStr ? `<small class="text-muted" style="font-size:0.7rem"><i class='bx bx-calendar'></i> ${dateStr}</small>` : ''}
            </div>
            <button class="btn btn-sm text-danger p-0" onclick="window.deleteTask(${task.id})"><i class='bx bx-trash'></i></button>
        </div>
    `;
    return el;
}

// === INTERAÇÃO ===

window.toggleNewPageInput = () => {
    const input = document.getElementById('new-page-input');
    const select = document.getElementById('task-page');
    if (input.style.display === 'none') {
        input.style.display = 'block';
        input.focus();
        select.value = "";
    } else {
        input.style.display = 'none';
        input.value = '';
    }
};

window.checkNewPage = (select) => {
    if(select.value === 'new') {
        window.toggleNewPageInput();
        select.value = "";
    }
};

window.openTaskModal = (id = null) => {
    const form = document.getElementById('form-task');
    form.reset();
    document.getElementById('new-page-input').style.display = 'none';
    
    if (id) {
        const task = allTasks.find(t => t.id === id);
        if(!task) return;
        document.getElementById('modalTitle').textContent = "Editar Tarefa";
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-desc').value = task.description;
        document.getElementById('task-priority').value = task.priority;
        document.getElementById('task-assignee').value = task.assigned_to || "";
        document.getElementById('task-date').value = task.request_date || "";
        
        // Define página
        const pageSelect = document.getElementById('task-page');
        const exists = [...pageSelect.options].some(o => o.value === task.page_ref);
        if(exists) pageSelect.value = task.page_ref;
        else {
            window.toggleNewPageInput();
            document.getElementById('new-page-input').value = task.page_ref;
        }
    } else {
        document.getElementById('modalTitle').textContent = "Nova Tarefa";
        document.getElementById('task-id').value = "";
        document.getElementById('task-date').valueAsDate = new Date();
    }
    new bootstrap.Modal(document.getElementById('modalTask')).show();
};

window.saveTask = async () => {
    const id = document.getElementById('task-id').value;
    const desc = document.getElementById('task-desc').value;
    const assignee = document.getElementById('task-assignee').value || null;
    const priority = document.getElementById('task-priority').value;
    const date = document.getElementById('task-date').value;
    
    let page = document.getElementById('task-page').value;
    const newPageVal = document.getElementById('new-page-input').value;
    if (document.getElementById('new-page-input').style.display !== 'none' && newPageVal) {
        page = newPageVal;
    }

    if (!page || !desc) { alert("Preencha página e descrição."); return; }

    const taskObj = {
        page_ref: page, description: desc, assigned_to: assignee,
        priority: priority, request_date: date
    };

    let error;
    if (id) {
        const { error: err } = await supabase.from('system_tasks').update(taskObj).eq('id', id);
        error = err;
    } else {
        taskObj.status = 'todo'; // Padrão para novo
        const { error: err } = await supabase.from('system_tasks').insert([taskObj]);
        error = err;
    }

    if (error) { alert('Erro: ' + error.message); } 
    else {
        bootstrap.Modal.getInstance(document.getElementById('modalTask')).hide();
        loadTasks();
    }
};

window.deleteTask = async (id) => {
    if(!confirm("Excluir?")) return;
    const { error } = await supabase.from('system_tasks').delete().eq('id', id);
    if(error) alert("Erro ao excluir"); else loadTasks();
};

window.allowDrop = (ev) => ev.preventDefault();
window.drop = async (ev, newStatus) => {
    ev.preventDefault();
    const taskId = ev.dataTransfer.getData("text/plain");
    const t = allTasks.find(x => x.id == taskId);
    if(t) { 
        t.status = newStatus; 
        renderBoard();
        await supabase.from('system_tasks').update({ status: newStatus }).eq('id', taskId);
    }
};