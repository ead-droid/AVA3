import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const courseId = params.get('id');

let dadosCurso = { id: null, titulo: "", modulos: [] };

document.addEventListener('DOMContentLoaded', async () => {
    if (!courseId) { alert("ID não fornecido."); window.location.href = 'admin.html'; return; }
    await checkAuth();
    await loadCourseData(); 
    loadLinkedClasses(); 
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

async function loadCourseData() {
    const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).single();
    dadosCurso.id = course.id;
    dadosCurso.titulo = course.title || course.titulo;
    
    document.getElementById('header-title').innerText = dadosCurso.titulo;
    document.getElementById('course-id-badge').innerText = `ID: ${course.id}`;
    document.getElementById('edit_title').value = dadosCurso.titulo;
    document.getElementById('edit_status').value = course.status || 'draft';
    document.getElementById('edit_desc').value = course.description || '';

    // Busca com Ordenação
    const { data: modules } = await supabase.from('modules').select(`*, sections (*, lessons (*))`).eq('course_id', courseId).order('ordem', { ascending: true });

    if (modules) {
        modules.forEach(mod => {
            if (mod.sections) {
                mod.sections.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
                mod.sections.forEach(sec => {
                    if (sec.lessons) sec.lessons.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
                });
            }
        });
        dadosCurso.modulos = modules;
    }
    renderizarGrade();
}

// === CARREGAR TURMAS (ATUALIZADO) ===
async function loadLinkedClasses() {
    const tbody = document.getElementById('linked-classes-list');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></td></tr>';

    // Busca turmas vinculadas e contagem de alunos
    const { data: classes, error } = await supabase
        .from('classes')
        .select(`*, class_enrollments (count)`)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

    tbody.innerHTML = '';

    if (error || !classes || classes.length === 0) {
        document.getElementById('classes-empty').style.display = 'block';
        return;
    }
    document.getElementById('classes-empty').style.display = 'none';

    classes.forEach(cls => {
        const count = cls.class_enrollments?.[0]?.count || 0;
        const start = cls.start_date ? new Date(cls.start_date).toLocaleDateString() : 'A definir';
        
        // Exibição do Código: Se nulo, mostra "Automático"
        const displayCode = cls.code ? cls.code : '<span class="badge bg-secondary bg-opacity-25 text-secondary border font-monospace small">Automático</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4">
                <div class="fw-bold text-dark">${cls.name}</div>
            </td>
            <td>
                <span class="fw-bold text-dark">${displayCode}</span>
            </td>
            <td><i class='bx bx-user'></i> ${count}</td>
            <td class="text-muted small">${start}</td>
            <td class="text-end pe-4">
                <div class="btn-group">
                    <a href="classroom.html?id=${cls.id}" class="btn btn-sm btn-outline-secondary fw-bold" title="Entrar na Sala">
                        <i class='bx bx-chalkboard'></i> Sala
                    </a>
                    <a href="class-dashboard.html?id=${cls.id}" class="btn btn-sm btn-primary fw-bold" title="Painel da Turma">
                        Gerenciar
                    </a>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderizarGrade() {
    const container = document.getElementById('modules-list');
    container.innerHTML = '';
    
    if (!dadosCurso.modulos.length) {
        document.getElementById('modules-empty').style.display = 'block';
        return;
    }
    document.getElementById('modules-empty').style.display = 'none';

    const tplModule = document.getElementById('tpl-module');
    const tplSection = document.getElementById('tpl-section');
    const tplLesson = document.getElementById('tpl-lesson');

    dadosCurso.modulos.forEach(mod => {
        const modClone = tplModule.content.cloneNode(true);
        modClone.querySelector('.mod-badge').innerText = `#${mod.ordem}`;
        modClone.querySelector('.mod-title').innerText = mod.title;
        const collapseId = `collapse-mod-${mod.id}`;
        modClone.querySelector('.module-header').setAttribute('data-bs-target', `#${collapseId}`);
        modClone.querySelector('.mod-collapse').id = collapseId;

        modClone.querySelector('.btn-edit').onclick = (e) => { e.stopPropagation(); editarModulo(mod); };
        modClone.querySelector('.btn-del').onclick = (e) => { e.stopPropagation(); excluirGenerico('modules', mod.id); };
        modClone.querySelector('.btn-add-sec').onclick = (e) => { abrirModalSecao(mod.id, (mod.sections?.length||0)+1, e); };

        const secoesContainer = modClone.querySelector('.sections-container');

        if (mod.sections) {
            mod.sections.forEach(sec => {
                const secClone = tplSection.content.cloneNode(true);
                secClone.querySelector('.sec-title').innerText = sec.title;
                secClone.querySelector('.sec-badge').innerText = sec.ordem;
                secClone.querySelector('.btn-add-content').onclick = () => abrirModalConteudo(mod.id, sec.id, (sec.lessons?.length||0)+1);
                secClone.querySelector('.btn-edit').onclick = () => editarSecao(sec);
                secClone.querySelector('.btn-del').onclick = () => excluirGenerico('sections', sec.id);

                const contentContainer = secClone.querySelector('.content-container');

                if (sec.lessons) {
                    sec.lessons.forEach(cont => {
                        const lessonClone = tplLesson.content.cloneNode(true);
                        const tipo = (cont.type || 'TEXTO').toUpperCase();
                        
                        let iconClass = 'ic-doc', iconName = 'bx-file';
                        if (tipo === 'VIDEO_AULA') { iconClass = 'ic-video'; iconName = 'bx-play'; }
                        else if (tipo === 'QUIZ') { iconClass = 'ic-quiz'; iconName = 'bx-trophy'; }
                        else if (tipo === 'TAREFA') { iconClass = 'ic-task'; iconName = 'bx-task'; }
                        else if (tipo === 'TEXTO') { iconClass = 'ic-text'; iconName = 'bx-paragraph'; }
                        
                        lessonClone.querySelector('.icon-circle').className = `icon-circle ${iconClass}`;
                        lessonClone.querySelector('.icon-circle').innerHTML = `<i class='bx ${iconName}'></i>`;
                        lessonClone.querySelector('.lesson-title').innerText = cont.title;
                        lessonClone.querySelector('.lesson-type').innerText = tipo;
                        lessonClone.querySelector('.lesson-order').innerText = cont.ordem;

                        // Preview
                        lessonClone.querySelector('.lesson-click-area').onclick = () => verPreview(cont);
                        lessonClone.querySelector('.btn-preview').onclick = () => verPreview(cont);

                        // BOTÕES ESPECÍFICOS NA LISTA
                        const actionArea = lessonClone.querySelector('.actions-area');
                        
                        if (tipo === 'QUIZ') {
                            const btn = document.getElementById('tpl-btn-quiz').content.cloneNode(true);
                            btn.querySelector('a').href = `quiz-builder.html?id=${cont.id}`;
                            actionArea.prepend(btn);
                        } else if (tipo === 'TAREFA') {
                            const btn = document.getElementById('tpl-btn-task').content.cloneNode(true);
                            btn.querySelector('a').href = `task-builder.html?id=${cont.id}`;
                            actionArea.prepend(btn);
                        } else if (tipo === 'TEXTO') {
                            const btn = document.getElementById('tpl-btn-text').content.cloneNode(true);
                            btn.querySelector('a').href = `text-builder.html?id=${cont.id}`;
                            actionArea.prepend(btn);
                        }

                        lessonClone.querySelector('.btn-edit').onclick = () => editarConteudo(cont, mod.id, sec.id);
                        lessonClone.querySelector('.btn-del').onclick = () => excluirGenerico('lessons', cont.id);
                        contentContainer.appendChild(lessonClone);
                    });
                }
                secoesContainer.appendChild(secClone);
            });
        }
        container.appendChild(modClone);
    });
}

window.verPreview = function(item) {
    if (!item) return;
    const tipo = (item.type || 'TEXTO').toUpperCase();
    
    document.getElementById('previewHeader').innerText = item.title;
    document.getElementById('previewType').innerText = tipo;
    const previewContent = document.getElementById('previewContent');
    const actionsDiv = document.getElementById('preview-actions');
    actionsDiv.innerHTML = ''; 

    if (tipo === 'TEXTO') {
        previewContent.innerHTML = `<div class="bg-white p-4 w-100 h-100 overflow-auto text-start" style="border-radius:8px;">${item.description || '<p class="text-muted">Sem conteúdo escrito.</p>'}</div>`;
        actionsDiv.innerHTML = `<a href="text-builder.html?id=${item.id}" target="_blank" class="btn btn-sm btn-info text-white fw-bold"><i class='bx bx-edit-alt'></i> Editar Artigo</a>`;
    }
    else if (tipo === 'QUIZ') {
        previewContent.innerHTML = `<div class="text-center p-5"><i class='bx bx-trophy fs-1 text-warning'></i><h5>Quiz</h5><p class="text-muted">Visualização de perguntas no botão acima.</p></div>`;
        actionsDiv.innerHTML = `<a href="quiz-builder.html?id=${item.id}" target="_blank" class="btn btn-sm btn-warning fw-bold"><i class='bx bx-wrench'></i> Configurar</a>`;
    }
    else if (tipo === 'TAREFA') {
        previewContent.innerHTML = `<div class="text-center p-5"><i class='bx bx-task fs-1 text-success'></i><h5>Tarefa</h5><p class="text-muted">Configure o enunciado no botão acima.</p></div>`;
        actionsDiv.innerHTML = `<a href="task-builder.html?id=${item.id}" target="_blank" class="btn btn-sm btn-success fw-bold text-white"><i class='bx bx-edit'></i> Configurar</a>`;
    }
    else if (item.content_url) {
        let url = item.content_url;
        if(url.includes('youtube.com/watch')) url = url.replace('watch?v=', 'embed/');
        else if(url.includes('youtu.be/')) url = url.replace('youtu.be/', 'youtube.com/embed/');
        if(url.includes('drive.google.com')) url = url.replace(/\/view.*/, '/preview').replace(/\/edit.*/, '/preview');

        previewContent.innerHTML = `<iframe src="${url}" width="100%" height="100%" style="min-height:600px; border:0; width:100%; border-radius:8px;" allowfullscreen></iframe>`;
        actionsDiv.innerHTML = `<a href="${item.content_url}" target="_blank" class="btn btn-sm btn-outline-primary"><i class='bx bx-link-external'></i> Abrir Externo</a>`;
    } else {
        previewContent.innerHTML = `<div class="text-center text-muted p-5">Sem conteúdo vinculado.</div>`;
    }

    new bootstrap.Offcanvas(document.getElementById('drawerPreview')).show();
};

window.openModuleModal = () => { document.getElementById('formModule').reset(); document.getElementById('mod_id').value = ''; document.getElementById('mod_order').value = (dadosCurso.modulos.length + 1); new bootstrap.Modal(document.getElementById('modalModule')).show(); };
window.editarModulo = (mod) => { document.getElementById('mod_id').value = mod.id; document.getElementById('mod_title').value = mod.title; document.getElementById('mod_order').value = mod.ordem; new bootstrap.Modal(document.getElementById('modalModule')).show(); };
document.getElementById('formModule').addEventListener('submit', async (e) => { e.preventDefault(); const id = document.getElementById('mod_id').value; const data = { course_id: parseInt(courseId), title: document.getElementById('mod_title').value, ordem: parseInt(document.getElementById('mod_order').value)||1 }; let error; if(id) ({error} = await supabase.from('modules').update(data).eq('id',id)); else ({error} = await supabase.from('modules').insert(data)); if(error) alert(error.message); else { bootstrap.Modal.getInstance(document.getElementById('modalModule')).hide(); loadCourseData(); }});

window.abrirModalSecao = (mId, next, e) => { if(e) e.stopPropagation(); document.getElementById('formSection').reset(); document.getElementById('sec_id').value = ''; document.getElementById('sec_module_id').value = mId; document.getElementById('sec_order').value = next; new bootstrap.Modal(document.getElementById('modalSection')).show(); };
window.editarSecao = (sec) => { document.getElementById('sec_id').value = sec.id; document.getElementById('sec_module_id').value = sec.module_id; document.getElementById('sec_title').value = sec.title; document.getElementById('sec_order').value = sec.ordem; new bootstrap.Modal(document.getElementById('modalSection')).show(); };
document.getElementById('formSection').addEventListener('submit', async (e) => { e.preventDefault(); const id = document.getElementById('sec_id').value; const data = { module_id: parseInt(document.getElementById('sec_module_id').value), title: document.getElementById('sec_title').value, ordem: parseInt(document.getElementById('sec_order').value)||1 }; let error; if(id) ({error} = await supabase.from('sections').update(data).eq('id',id)); else ({error} = await supabase.from('sections').insert(data)); if(error) alert(error.message); else { bootstrap.Modal.getInstance(document.getElementById('modalSection')).hide(); loadCourseData(); }});

window.abrirModalConteudo = (mId, sId, next) => { document.getElementById('formLesson').reset(); document.getElementById('les_id').value = ''; document.getElementById('les_module_id').value = mId; document.getElementById('les_section_id').value = sId; document.getElementById('les_order').value = next; document.getElementById('les_published').checked = true; document.getElementById('les_required').checked = true; new bootstrap.Modal(document.getElementById('modalLesson')).show(); };
window.editarConteudo = (item, mId, sId) => { document.getElementById('les_id').value = item.id; document.getElementById('les_module_id').value = mId; document.getElementById('les_section_id').value = sId; document.getElementById('les_title').value = item.title; document.getElementById('les_type').value = item.type; document.getElementById('les_url').value = item.content_url||''; document.getElementById('les_points').value = item.points||0; document.getElementById('les_order').value = item.ordem; document.getElementById('les_desc').value = item.description||''; document.getElementById('les_published').checked = item.is_published!==false; document.getElementById('les_required').checked = item.is_required!==false; new bootstrap.Modal(document.getElementById('modalLesson')).show(); };
document.getElementById('formLesson').addEventListener('submit', async (e) => { e.preventDefault(); const id = document.getElementById('les_id').value; const data = { module_id: parseInt(document.getElementById('les_module_id').value), section_id: parseInt(document.getElementById('les_section_id').value), title: document.getElementById('les_title').value, type: document.getElementById('les_type').value, content_url: document.getElementById('les_url').value||null, points: parseFloat(document.getElementById('les_points').value)||0, description: document.getElementById('les_desc').value||null, ordem: parseInt(document.getElementById('les_order').value)||1, is_published: document.getElementById('les_published').checked, is_required: document.getElementById('les_required').checked }; let error; if(id) ({error} = await supabase.from('lessons').update(data).eq('id',id)); else ({error} = await supabase.from('lessons').insert(data)); if(error) alert(error.message); else { bootstrap.Modal.getInstance(document.getElementById('modalLesson')).hide(); loadCourseData(); }});

window.excluirGenerico = async (table, id) => { if(!confirm('Excluir?')) return; const { error } = await supabase.from(table).delete().eq('id', id); if(error) alert(error.message); else loadCourseData(); };