import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const lessonId = params.get('id');

let isCodeView = false;
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
    setupToolbar();
    setupChangeDetection();
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

// --- MARCAR MUDANÇAS ---
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

function setupChangeDetection() {
    // Detecta digitação no editor visual
    document.getElementById('editor-area').addEventListener('input', markUnsaved);
    // Detecta digitação no editor de código
    document.getElementById('code-area').addEventListener('input', markUnsaved);
}

// --- CARREGAMENTO ---
async function loadLessonData() {
    const { data: lesson, error } = await supabase.from('lessons').select('*').eq('id', lessonId).single();
    if (error) { alert("Erro ao carregar."); return; }

    document.getElementById('lesson-title').textContent = lesson.title;

    // Hierarquia (Blindada)
    let hierarchyHTML = "Editando conteúdo";
    let courseIdBack = params.get('courseId');
    try {
        if (lesson.module_id) {
            const { data: mod } = await supabase.from('modules').select('id, title, course_id').eq('id', lesson.module_id).single();
            if (mod) {
                const { data: course } = await supabase.from('courses').select('id, title').eq('id', mod.course_id).single();
                if(course) {
                    hierarchyHTML = `${course.title} <i class='bx bx-chevron-right'></i> ${mod.title}`;
                    if(!courseIdBack) courseIdBack = course.id;
                }
            }
        } else if (lesson.section_id) {
             // Caso tenha seção, faz a busca em cascata (Seção > Módulo > Curso)
             const { data: sec } = await supabase.from('sections').select('module_id').eq('id', lesson.section_id).single();
             if(sec) {
                 const { data: mod } = await supabase.from('modules').select('course_id, title').eq('id', sec.module_id).single();
                 if(mod) {
                     const { data: c } = await supabase.from('courses').select('id, title').eq('id', mod.course_id).single();
                     if(c) {
                         hierarchyHTML = `${c.title} <i class='bx bx-chevron-right'></i> ${mod.title}`;
                         if(!courseIdBack) courseIdBack = c.id;
                     }
                 }
             }
        }
    } catch(e) {}

    document.getElementById('lesson-hierarchy').innerHTML = hierarchyHTML;
    
    // Conteúdo Inicial
    const content = lesson.description || "<p>Comece a escrever...</p>";
    document.getElementById('editor-area').innerHTML = content;
    document.getElementById('code-area').value = content;

    // Botão Voltar
    document.getElementById('btn-back').onclick = () => {
        if(hasUnsavedChanges && !confirm("⚠️ Alterações não salvas! Deseja sair e perder tudo?")) return;
        
        if (courseIdBack) window.location.href = `course-editor.html?id=${courseIdBack}`;
        else window.history.back();
    };

    resetSaveStatus();
}

// --- EDITOR & TOOLBAR ---

function setupToolbar() {
    document.querySelectorAll('.rich-btn[data-cmd]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // Se estiver no modo código, bloqueia comandos visuais
            if(isCodeView) { alert("Volte para o modo visual para usar os botões."); return; }
            
            document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
            markUnsaved();
        });
    });
}

// Função para executar comandos com valor (Cores, etc)
window.execCmd = (cmd, val) => {
    if(isCodeView) return;
    document.execCommand(cmd, false, val);
    markUnsaved();
};

window.formatBlock = (tag) => {
    if(isCodeView) return;
    document.execCommand('formatBlock', false, tag);
    markUnsaved();
};

window.insertLink = () => { 
    if(isCodeView) return;
    const url = prompt("URL do Link:"); 
    if(url) { document.execCommand('createLink', false, url); markUnsaved(); }
};

window.insertImage = () => { 
    if(isCodeView) return;
    const url = prompt("URL da Imagem:"); 
    if(url) { document.execCommand('insertImage', false, url); markUnsaved(); }
};

window.insertVideo = () => {
    if(isCodeView) return;
    const url = prompt("URL do YouTube:");
    if(url) {
        let embed = url;
        if(url.includes('youtu')) {
             const vidId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
             embed = `<div class="ratio ratio-16x9 my-3"><iframe src="https://www.youtube.com/embed/${vidId}" frameborder="0" allowfullscreen></iframe></div>`;
        }
        document.execCommand('insertHTML', false, embed + "<br>");
        markUnsaved();
    }
};

// --- MODO CÓDIGO (HTML) ---
window.toggleCodeView = () => {
    const editor = document.getElementById('editor-area');
    const code = document.getElementById('code-area');
    const btn = document.getElementById('btn-code-view');
    const toolbar = document.getElementById('toolbar');

    if (isCodeView) {
        // Voltar para Visual (Code -> Editor)
        editor.innerHTML = code.value;
        code.style.display = 'none';
        editor.style.display = 'block';
        
        btn.classList.remove('btn-dark');
        btn.classList.add('btn-outline-dark');
        toolbar.style.opacity = '1';
        toolbar.style.pointerEvents = 'auto'; // Reabilita toolbar
        
        isCodeView = false;
    } else {
        // Ir para Código (Editor -> Code)
        code.value = editor.innerHTML;
        editor.style.display = 'none';
        code.style.display = 'block';
        
        btn.classList.remove('btn-outline-dark');
        btn.classList.add('btn-dark');
        toolbar.style.opacity = '0.5';
        toolbar.style.pointerEvents = 'none'; // Desabilita toolbar visual
        
        isCodeView = true;
    }
};

// --- SALVAR ---
window.saveContent = async () => {
    const btns = [document.getElementById('btn-save-top'), document.getElementById('btn-save-bottom')];
    btns.forEach(b => { if(b) { b.innerHTML = 'Salvando...'; b.disabled = true; } });
    
    // 1. Sincroniza o conteúdo correto
    let htmlContent = "";
    if (isCodeView) {
        htmlContent = document.getElementById('code-area').value;
        // Atualiza o visual também para ficar síncrono
        document.getElementById('editor-area').innerHTML = htmlContent; 
    } else {
        htmlContent = document.getElementById('editor-area').innerHTML;
    }

    try {
        const { error } = await supabase
            .from('lessons')
            .update({ description: htmlContent })
            .eq('id', lessonId);

        if (error) throw error;
        
        resetSaveStatus(); // Sucesso
        alert("✅ Conteúdo salvo com sucesso!");

    } catch(err) {
        console.error(err);
        alert("Erro ao salvar: " + err.message);
        btns.forEach(b => { if(b) { b.disabled = false; b.innerHTML = 'Tentar Novamente'; } });
    }
};