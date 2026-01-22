import { supabase } from './supabaseClient.js';

let allTasks = [];
let allAdmins = [];
let pendingImageFile = null; // Armazena a imagem colada temporariamente

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

    setupPasteListener(); // Ativa o Ctrl+V
    await loadAdmins();
    await loadTasks();
});

// === IMAGENS: LÓGICA DE COLAR E PREVIEW ===

function setupPasteListener() {
    const textarea = document.getElementById('task-desc');
    if (!textarea) return;

    textarea.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf("image") === 0) {
                const file = item.getAsFile();
                handleImageSelect(file);
                e.preventDefault(); // Evita colar o nome do arquivo como texto
            }
        }
    });
}

function handleImageSelect(file) {
    pendingImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById('image-preview');
        const container = document.getElementById('image-preview-container');
        if(img && container) {
            img.src = e.target.result;
            container.style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
}

window.clearImage = () => {
    pendingImageFile = null;
    const img = document.getElementById('image-preview');
    const container = document.getElementById('image-preview-container');
    if(img && container) {
        img.src = "";
        container.style.display = 'none';
    }
};

window.viewImage = (url) => {
    const imgModal = document.getElementById('full-image-view');
    const modalEl = document.getElementById('modalImage');
    if(imgModal && modalEl) {
        imgModal.src = url;
        new bootstrap.Modal(modalEl).show();
    }
};

// === CARREGAMENTO DE DADOS ===

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
    const existingPages = allTasks.map(t => t.page_ref);
    const uniquePages = [...new Set([...defaultPages, ...existingPages])].sort();

    select.innerHTML = '<option value="" disabled selected>Selecione...</option>';
    uniquePages.forEach(p => select.innerHTML += `<option value="${p}">${p}</option>`);
    select.innerHTML += '<option value="new">+ Nova Página...</option>';
}

// === RENDERIZAÇÃO DO BOARD ===

function renderBoard() {
    const statuses = ['ideas', 'todo', 'doing', 'review', 'done'];

    // Limpa colunas
    statuses.forEach(s => {
        const list = document.getElementById(`list-${s}`);
        const count = document.getElementById(`count-${s}`);
        if(list) list.innerHTML = '';
        if(count) count.textContent = '0';
    });

    // Popula colunas
    allTasks.forEach(task => {
        const status = statuses.includes(task.status) ? task.status : 'todo';
        const col = document.getElementById(`list-${status}`);
        if(col) col.appendChild(createCardHTML(task));
    });

    // Atualiza contadores
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

    // HTML da Imagem (Thumbnail)
    let imgHtml = '';
    if (task.image_url) {
        imgHtml = `
            <div class="mb-2 position-relative group">
                <img src="${task.image_url}" class="img-fluid rounded border cursor-pointer task-thumb" onclick="window.viewImage('${task.image_url}')" style="object-fit:cover; height:100px; width:100%;">
                <div class="small text-muted text-center mt-1" style="font-size:0.7rem"><i class='bx bx-image'></i> Anexo</div>
            </div>`;
    }

    el.innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-2">
            <span class="card-tag">${task.page_ref}</span>
            <button class="btn btn-sm btn-link p-0 text-muted" onclick="window.openTaskModal(${task.id})"><i class='bx bx-edit-alt'></i></button>
        </div>
        ${imgHtml}
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

// === INTERAÇÃO DO MODAL E SALVAMENTO ===

window.toggleNewPageInput = () => {
    const input = document.getElementById('new-page-input');
    const select = document.getElementById('task-page');
    if (input.style.display === 'none') {
        input.style.display = 'block'; input.focus(); select.value = "";
    } else {
        input.style.display = 'none'; input.value = '';
    }
};

window.checkNewPage = (select) => {
    if(select.value === 'new') { window.toggleNewPageInput(); select.value = ""; }
};

window.openTaskModal = (id = null) => {
    const form = document.getElementById('form-task');
    form.reset();
    window.clearImage(); 
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
        
        const pageSelect = document.getElementById('task-page');
        const exists = [...pageSelect.options].some(o => o.value === task.page_ref);
        if(exists) pageSelect.value = task.page_ref;
        else { window.toggleNewPageInput(); document.getElementById('new-page-input').value = task.page_ref; }

        // Se tem imagem, mostra no preview
        if (task.image_url) {
            const img = document.getElementById('image-preview');
            const container = document.getElementById('image-preview-container');
            if(img && container) {
                img.src = task.image_url;
                container.style.display = 'block';
            }
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
    if (document.getElementById('new-page-input').style.display !== 'none' && newPageVal) { page = newPageVal; }

    if (!page || !desc) { alert("Preencha página e descrição."); return; }

    // --- UPLOAD DA IMAGEM ---
    let imageUrl = null;

    // Se é edição, tenta manter a imagem antiga a menos que o usuário tenha removido
    if (id) {
        const existing = allTasks.find(t => t.id == id);
        const container = document.getElementById('image-preview-container');
        // Se tinha imagem E o container de preview ainda está visível, mantém
        if (existing && existing.image_url && container.style.display !== 'none') {
            imageUrl = existing.image_url;
        }
    }

    if (pendingImageFile) {
        console.log("Iniciando upload para bucket: task-images");
        const fileName = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
        
        const { data, error: uploadError } = await supabase.storage
            .from('task-images')
            .upload(fileName, pendingImageFile, { cacheControl: '3600', upsert: false });
        
        if (uploadError) {
            console.error("Erro upload:", uploadError);
            alert("Erro ao subir imagem (verifique permissões): " + uploadError.message);
            return;
        }
        
        const { data: urlData } = supabase.storage.from('task-images').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
    }

    // --- SALVAR NO BANCO ---
    const taskObj = {
        page_ref: page, description: desc, assigned_to: assignee,
        priority: priority, request_date: date, image_url: imageUrl
    };

    let error;
    if (id) {
        const { error: err } = await supabase.from('system_tasks').update(taskObj).eq('id', id);
        error = err;
    } else {
        taskObj.status = 'todo';
        const { error: err } = await supabase.from('system_tasks').insert([taskObj]);
        error = err;
    }

    if (error) { alert('Erro ao salvar tarefa: ' + error.message); } 
    else {
        bootstrap.Modal.getInstance(document.getElementById('modalTask')).hide();
        loadTasks();
    }
};

// === EXCLUIR E MOVER ===

async function removeImageFromStorage(url) {
    if (!url) return;
    try {
        const path = url.split('/task-images/')[1];
        if (path) {
            console.log("Removendo imagem:", path);
            await supabase.storage.from('task-images').remove([path]);
        }
    } catch (e) { console.error("Erro ao deletar arquivo", e); }
}

window.deleteTask = async (id) => {
    if(!confirm("Excluir esta tarefa?")) return;
    
    // Deleta imagem antes
    const task = allTasks.find(t => t.id == id);
    if(task && task.image_url) await removeImageFromStorage(task.image_url);

    const { error } = await supabase.from('system_tasks').delete().eq('id', id);
    if(error) alert("Erro ao excluir"); else loadTasks();
};

window.allowDrop = (ev) => ev.preventDefault();

window.drop = async (ev, newStatus) => {
    ev.preventDefault();
    const taskId = ev.dataTransfer.getData("text/plain");
    const task = allTasks.find(x => x.id == taskId);
    
    if(task) { 
        // SE FOR PARA CONCLUÍDO (DONE): Apaga a imagem do storage e limpa o link no banco
        if (newStatus === 'done' && task.image_url) {
            await removeImageFromStorage(task.image_url);
            
            // Atualiza localmente e no banco para remover a referência
            task.image_url = null;
            await supabase.from('system_tasks').update({ status: newStatus, image_url: null }).eq('id', taskId);
        } else {
            // Apenas move
            await supabase.from('system_tasks').update({ status: newStatus }).eq('id', taskId);
        }

        task.status = newStatus; 
        renderBoard();
    }
};