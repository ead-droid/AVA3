import { supabase } from './supabaseClient.js';

const params = new URLSearchParams(window.location.search);
const lessonId = params.get('id');

let isCodeView = false;

document.addEventListener('DOMContentLoaded', async () => {
    if (!lessonId) { alert("ID inválido"); return; }
    await checkAuth();
    await loadLessonData();
    setupToolbar();
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

async function loadLessonData() {
    const { data, error } = await supabase
        .from('lessons')
        .select(`*, modules(id, title, courses(id, title))`)
        .eq('id', lessonId)
        .single();

    if (error) { alert("Erro ao carregar."); return; }

    document.getElementById('lesson-title').textContent = data.title;
    const cName = data.modules?.courses?.title || 'Curso';
    const mName = data.modules?.title || 'Módulo';
    document.getElementById('lesson-hierarchy').innerHTML = `${cName} <i class='bx bx-chevron-right'></i> ${mName}`;

    // Carrega o conteúdo HTML salvo no campo 'description' ou 'content_url' (se usado como data URI)
    // Vamos usar o campo 'description' para armazenar o HTML do artigo, pois ele suporta TEXT longo
    document.getElementById('editor-area').innerHTML = data.description || "<p>Comece a escrever...</p>";

    // Botão Voltar
    document.getElementById('btn-back').onclick = () => {
        if (data.modules?.courses?.id) window.location.href = `course-editor.html?id=${data.modules.courses.id}`;
        else window.history.back();
    };
}

// --- BARRA DE FERRAMENTAS ---
function setupToolbar() {
    document.querySelectorAll('.toolbar-btn[data-cmd]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const cmd = btn.dataset.cmd;
            const val = btn.dataset.val || null;
            document.execCommand(cmd, false, val);
            highlightActive();
        });
    });
}

// Realça botões ativos
function highlightActive() {
    document.querySelectorAll('.toolbar-btn[data-cmd]').forEach(btn => {
        if (document.queryCommandState(btn.dataset.cmd)) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

// Inserir Link
window.insertLink = () => {
    const url = prompt("Digite a URL do link:");
    if (url) document.execCommand('createLink', false, url);
};

// Inserir Imagem
window.insertImage = () => {
    const url = prompt("Cole a URL da imagem (ou arraste para o editor se suportado):");
    if (url) document.execCommand('insertImage', false, url);
};

// Alternar Código Fonte (HTML)
window.toggleCodeView = () => {
    const editor = document.getElementById('editor-area');
    const code = document.getElementById('code-area');
    
    if (isCodeView) {
        // Voltar para Visual
        editor.innerHTML = code.value;
        code.style.display = 'none';
        editor.style.display = 'block';
        isCodeView = false;
    } else {
        // Ir para Código
        code.value = editor.innerHTML;
        editor.style.display = 'none';
        code.style.display = 'block';
        isCodeView = true;
    }
};

// --- SALVAR ---
window.saveContent = async () => {
    const btn = document.getElementById('btn-save');
    const originalText = btn.innerHTML;
    
    // Sincroniza se estiver no modo código
    if (isCodeView) window.toggleCodeView();

    const htmlContent = document.getElementById('editor-area').innerHTML;

    btn.disabled = true;
    btn.innerHTML = 'Salvando...';

    // Salva no campo 'description'
    const { error } = await supabase
        .from('lessons')
        .update({ description: htmlContent })
        .eq('id', lessonId);

    btn.disabled = false;
    btn.innerHTML = originalText;

    if (error) alert("Erro: " + error.message);
    else alert("Artigo salvo com sucesso!");
};