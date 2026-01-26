import { supabase } from './supabaseClient.js';

let currentUser = null;
let cvData = null;

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await loadProfile();
    await loadCV();
    await loadCertificates();
});

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
    currentUser = session.user;
}

// =========================================================
// 1. CARREGAMENTO DE DADOS
// =========================================================

async function loadProfile() {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if(profile) {
        // Preenche formulário
        if(document.getElementById('prof_name')) document.getElementById('prof_name').value = profile.name || '';
        if(document.getElementById('prof_email')) document.getElementById('prof_email').value = profile.email || currentUser.email;
        
        // Preenche cabeçalho do site
        if(document.getElementById('header-name')) document.getElementById('header-name').textContent = profile.name || 'Usuário';
        if(document.getElementById('header-email')) document.getElementById('header-email').textContent = profile.email || '---';
        if(document.getElementById('header-role')) document.getElementById('header-role').textContent = (profile.role || 'Estudante').toUpperCase();
        
        const initials = (profile.name || 'U').substring(0,2).toUpperCase();
        if(document.getElementById('header-avatar-initials')) document.getElementById('header-avatar-initials').textContent = initials;
    }
}

async function loadCV() {
    const { data } = await supabase.from('user_cvs').select('*').eq('user_id', currentUser.id).maybeSingle();
    
    cvData = data || {}; 

    // Preenche inputs simples
    if(document.getElementById('cv_title')) document.getElementById('cv_title').value = cvData.title || '';
    if(document.getElementById('cv_bio')) document.getElementById('cv_bio').value = cvData.bio || '';
    if(document.getElementById('cv_phone')) document.getElementById('cv_phone').value = cvData.phone || '';
    if(document.getElementById('cv_linkedin')) document.getElementById('cv_linkedin').value = cvData.linkedin_url || '';
    if(document.getElementById('cv_portfolio')) document.getElementById('cv_portfolio').value = cvData.portfolio_url || '';
    if(document.getElementById('cv_skills')) document.getElementById('cv_skills').value = (cvData.skills || []).join(', ');

    // Preenche Experiência
    const expContainer = document.getElementById('experience-list');
    if(expContainer) {
        expContainer.innerHTML = '';
        (cvData.experience || []).forEach(item => addExperienceField(item));
    }

    // Preenche Educação Externa
    const eduContainer = document.getElementById('education-list');
    if(eduContainer) {
        eduContainer.innerHTML = '';
        (cvData.external_education || []).forEach(item => addEducationField(item));
    }

    // Preenche Idiomas
    const langContainer = document.getElementById('languages-list');
    if (langContainer) {
        langContainer.innerHTML = '';
        (cvData.languages || []).forEach(item => {
            const tpl = document.getElementById('tpl-language-item');
            const clone = tpl.content.cloneNode(true);
            clone.querySelector('.lang-name').value = item.name || '';
            clone.querySelector('.lang-level').value = item.level || 'Básico';
            langContainer.appendChild(clone);
        });
    }
}

async function loadCertificates() {
    const container = document.getElementById('certificates-grid');
    const { data: certs, error } = await supabase
        .from('class_enrollments')
        .select(`*, classes (name, courses (title, total_hours))`)
        .eq('user_id', currentUser.id)
        .eq('status', 'completed');

    if(error || !certs || certs.length === 0) {
        if(container) container.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="bx bx-certification fs-1"></i><p>Nenhum certificado disponível ainda.</p></div>';
        return;
    }

    if(container) container.innerHTML = '';
    
    // Lista de impressão (no HTML, id="print-ava3-list")
    const printList = document.getElementById('print-ava3-list'); 
    if(printList) printList.innerHTML = '';

    certs.forEach(c => {
        // Card na tela (UI normal)
        if(container) {
            const html = `
                <div class="col-md-6 col-lg-4">
                    <div class="card h-100 border-0 shadow-sm certificate-card">
                        <div class="card-body text-center p-4">
                            <div class="mb-3 text-warning display-4"><i class='bx bxs-certification'></i></div>
                            <h6 class="fw-bold mb-1">${c.classes?.courses?.title}</h6>
                            <p class="text-muted small mb-3">Concluído em ${new Date(c.updated_at).toLocaleDateString()}</p>
                            <span class="badge bg-success bg-opacity-10 text-success border border-success mb-3">
                                <i class='bx bx-check'></i> Autenticado
                            </span>
                        </div>
                    </div>
                </div>`;
            container.insertAdjacentHTML('beforeend', html);
        }

        // Item na lista de impressão (para o PDF)
        if(printList) {
            const li = document.createElement('li');
            // Formatação: Nome do Curso (Horas • Ano)
            li.innerHTML = `<strong>${c.classes?.courses?.title}</strong> <span style="font-size: 0.9em; opacity: 0.8;">(${c.classes?.courses?.total_hours || 0}h • ${new Date(c.updated_at).getFullYear()})</span>`;
            printList.appendChild(li);
        }
    });
}

// =========================================================
// 2. FUNÇÕES DE UI (ADICIONAR CAMPOS)
// =========================================================

window.addExperienceField = function(data = {}) {
    const tpl = document.getElementById('tpl-experience-item');
    const clone = tpl.content.cloneNode(true);
    clone.querySelector('.exp-company').value = data.company || '';
    clone.querySelector('.exp-role').value = data.role || '';
    clone.querySelector('.exp-period').value = data.start || ''; 
    clone.querySelector('.exp-desc').value = data.description || '';
    document.getElementById('experience-list').appendChild(clone);
};

window.addEducationField = function(data = {}) {
    const tpl = document.getElementById('tpl-education-item');
    const clone = tpl.content.cloneNode(true);
    clone.querySelector('.edu-school').value = data.institution || '';
    clone.querySelector('.edu-degree').value = data.degree || '';
    clone.querySelector('.edu-year').value = data.year || '';
    document.getElementById('education-list').appendChild(clone);
};

window.addLanguageField = function() {
    const list = document.getElementById('languages-list');
    const template = document.getElementById('tpl-language-item');
    if (list && template) {
        const clone = template.content.cloneNode(true);
        list.appendChild(clone);
    }
};

// =========================================================
// 3. SALVAR DADOS
// =========================================================

document.getElementById('formProfile').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('prof_name').value;
    const { error } = await supabase.from('profiles').update({ name }).eq('id', currentUser.id);
    if(error) alert("Erro ao salvar: " + error.message);
    else {
        alert("Perfil atualizado!");
        location.reload();
    }
});

document.getElementById('formCV').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const experience = [];
    document.querySelectorAll('#experience-list .experience-item').forEach(el => {
        experience.push({
            company: el.querySelector('.exp-company').value,
            role: el.querySelector('.exp-role').value,
            start: el.querySelector('.exp-period').value,
            description: el.querySelector('.exp-desc').value
        });
    });

    const education = [];
    document.querySelectorAll('#education-list .education-item').forEach(el => {
        education.push({
            institution: el.querySelector('.edu-school').value,
            degree: el.querySelector('.edu-degree').value,
            year: el.querySelector('.edu-year').value
        });
    });

    const languages = [];
    document.querySelectorAll('#languages-list .language-item').forEach(el => {
        languages.push({
            name: el.querySelector('.lang-name').value,
            level: el.querySelector('.lang-level').value
        });
    });

    const cvPayload = {
        user_id: currentUser.id,
        title: document.getElementById('cv_title').value,
        bio: document.getElementById('cv_bio').value,
        phone: document.getElementById('cv_phone').value,
        linkedin_url: document.getElementById('cv_linkedin').value,
        portfolio_url: document.getElementById('cv_portfolio').value,
        skills: document.getElementById('cv_skills').value.split(',').map(s => s.trim()).filter(s => s),
        experience,
        external_education: education,
        languages, 
        updated_at: new Date()
    };

    const { error } = await supabase.from('user_cvs').upsert(cvPayload);

    if(error) alert("Erro ao salvar CV: " + error.message);
    else alert("Currículo salvo com sucesso!");
});

// =========================================================
// 4. GERAR PDF (LÓGICA INTELIGENTE: ESCONDE SEÇÕES E ÍCONES VAZIOS)
// =========================================================

// Helper para pegar valor seguro de input
function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

// Helper para preencher texto na área de impressão
function setPrintText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// Helper para mostrar/ocultar SEÇÃO inteira (ex: Idiomas, Experiência)
function toggleSection(sectionId, shouldShow) {
    const el = document.getElementById(sectionId);
    if (el) {
        el.style.display = shouldShow ? 'block' : 'none';
    }
}

// Helper NOVO: Mostra/Oculta um ITEM de contato (ex: LinkedIn + Ícone)
function toggleContactItem(wrapperId, textId, value) {
    const wrapper = document.getElementById(wrapperId);
    const textSpan = document.getElementById(textId);
    
    // Se tiver valor e não for só espaços em branco
    if (value && value.trim() !== '') {
        if(wrapper) wrapper.style.display = 'block'; // Mostra o bloco (ícone + texto)
        if(textSpan) textSpan.innerText = value;     // Atualiza o texto
    } else {
        if(wrapper) wrapper.style.display = 'none';  // Esconde o wrapper inteiro
    }
}

window.generatePDF = function() {
    console.log("Iniciando geração de PDF (Layout Dinâmico com Ocultação de Ícones)...");

    // --- CABEÇALHO (Sempre visível) ---
    setPrintText('print-name', getVal('prof_name') || "NOME DO USUÁRIO");
    setPrintText('print-title', getVal('cv_title') || "CARGO / TÍTULO");

    // --- SIDEBAR: Contato (Usando a nova função toggleContactItem) ---
    toggleContactItem('print-wrap-phone', 'print-phone', getVal('cv_phone'));
    toggleContactItem('print-wrap-email', 'print-email', getVal('prof_email'));
    toggleContactItem('print-wrap-linkedin', 'print-linkedin', getVal('cv_linkedin'));
    toggleContactItem('print-wrap-portfolio', 'print-portfolio', getVal('cv_portfolio'));
    
    // --- SIDEBAR: Habilidades ---
    const skillsVal = getVal('cv_skills');
    setPrintText('print-skills-text', skillsVal);
    // Se não tiver habilidades, esconde a seção inteira (título + texto)
    toggleSection('print-sec-skills', skillsVal.trim() !== '');

    // --- SIDEBAR: Idiomas ---
    const printLangList = document.getElementById('print-languages-list');
    const langItems = document.querySelectorAll('#languages-list .language-item');
    
    if (printLangList) printLangList.innerHTML = '';
    
    let hasLanguages = false;
    langItems.forEach(item => {
        const name = item.querySelector('.lang-name').value;
        const level = item.querySelector('.lang-level').value;
        if(name) {
            hasLanguages = true;
            const li = document.createElement('li');
            li.innerHTML = `<strong>${name}</strong> <span style="opacity:0.8; font-size:0.9em">(${level})</span>`;
            printLangList.appendChild(li);
        }
    });
    
    // Esconde seção de idiomas se não houver nenhum
    toggleSection('print-sec-languages', hasLanguages);


    // --- CONTEÚDO PRINCIPAL: Resumo ---
    const bioVal = getVal('cv_bio');
    setPrintText('print-summary', bioVal);
    toggleSection('print-sec-summary', bioVal.trim() !== '');


    // --- CONTEÚDO PRINCIPAL: Experiência Profissional ---
    const printExpList = document.getElementById('print-experience-list');
    const expItems = document.querySelectorAll('#experience-list .experience-item');
    
    if (printExpList) printExpList.innerHTML = '';
    
    let hasExperience = false;
    expItems.forEach(item => {
        const company = item.querySelector('.exp-company').value;
        const role = item.querySelector('.exp-role').value;
        const period = item.querySelector('.exp-period').value;
        const desc = item.querySelector('.exp-desc').value;

        if(company || role) {
            hasExperience = true;
            const div = document.createElement('div');
            div.className = 'cv-item';
            div.innerHTML = `
                <div class="cv-item-header">
                    <span class="cv-item-title">${company}</span>
                    <span class="cv-item-date">${period}</span>
                </div>
                <div class="cv-item-subtitle">${role}</div>
                <div class="cv-item-desc">${desc}</div>
            `;
            printExpList.appendChild(div);
        }
    });

    toggleSection('print-sec-experience', hasExperience);


    // --- CONTEÚDO PRINCIPAL: Formação Acadêmica & Cursos ---
    const printEduList = document.getElementById('print-education-list');
    const eduItems = document.querySelectorAll('#education-list .education-item');
    
    // Verifica se já existem certificados carregados na lista (pela função loadCertificates)
    const ava3CertsCount = document.getElementById('print-ava3-list')?.children.length || 0;

    if (printEduList) printEduList.innerHTML = '';
    
    let hasExternalEducation = false;

    // Popula Educação Externa
    eduItems.forEach(item => {
        const school = item.querySelector('.edu-school').value;
        const degree = item.querySelector('.edu-degree').value;
        const year = item.querySelector('.edu-year').value;

        if(school || degree) {
            hasExternalEducation = true;
            const div = document.createElement('div');
            div.className = 'cv-item';
            div.innerHTML = `
                <div class="cv-item-header">
                    <span class="cv-item-title">${school}</span>
                    <span class="cv-item-date">${year}</span>
                </div>
                <div class="cv-item-subtitle">${degree}</div>
            `;
            printEduList.appendChild(div);
        }
    });

    // A seção "Formação Acadêmica" deve aparecer se tiver educação externa OU certificados internos
    const showEducationSection = hasExternalEducation || (ava3CertsCount > 0);
    toggleSection('print-sec-education', showEducationSection);
    
    // O sub-bloco "Cursos e Certificações Extras" só aparece se tiver certificados do AVA3
    toggleSection('print-ava3-certs-area', (ava3CertsCount > 0));


    // --- DISPARAR IMPRESSÃO ---
    setTimeout(() => { 
        window.print(); 
    }, 500);
};

window.logout = async () => {
    await supabase.auth.signOut();
    location.href = 'login.html';
};