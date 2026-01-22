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

// 1. CARREGA DADOS BÁSICOS (PROFILE)
async function loadProfile() {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single();
    if(profile) {
        document.getElementById('prof_name').value = profile.name || '';
        document.getElementById('prof_email').value = profile.email || currentUser.email;
        
        document.getElementById('header-name').textContent = profile.name || 'Usuário';
        document.getElementById('header-email').textContent = profile.email || '---';
        document.getElementById('header-role').textContent = (profile.role || 'Estudante').toUpperCase();
        
        const initials = (profile.name || 'U').substring(0,2).toUpperCase();
        document.getElementById('header-avatar-initials').textContent = initials;
    }
}

// 2. CARREGA E POPULA O CV
async function loadCV() {
    const { data } = await supabase.from('user_cvs').select('*').eq('user_id', currentUser.id).maybeSingle();
    
    cvData = data || {}; 

    document.getElementById('cv_title').value = cvData.title || '';
    document.getElementById('cv_bio').value = cvData.bio || '';
    document.getElementById('cv_phone').value = cvData.phone || '';
    document.getElementById('cv_linkedin').value = cvData.linkedin_url || '';
    document.getElementById('cv_portfolio').value = cvData.portfolio_url || '';
    document.getElementById('cv_skills').value = (cvData.skills || []).join(', ');

    const expContainer = document.getElementById('experience-list');
    expContainer.innerHTML = '';
    (cvData.experience || []).forEach(item => addExperienceField(item));

    const eduContainer = document.getElementById('education-list');
    eduContainer.innerHTML = '';
    (cvData.external_education || []).forEach(item => addEducationField(item));

    // NOVA LÓGICA: Carrega os Idiomas do banco para a tela
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

// 3. CARREGA CERTIFICADOS
async function loadCertificates() {
    const container = document.getElementById('certificates-grid');
    const { data: certs, error } = await supabase
        .from('class_enrollments')
        .select(`*, classes (name, courses (title, total_hours))`)
        .eq('user_id', currentUser.id)
        .eq('status', 'completed');

    if(error || !certs || certs.length === 0) {
        container.innerHTML = '<div class="col-12 text-center text-muted py-5"><i class="bx bx-certification fs-1"></i><p>Nenhum certificado disponível ainda.</p></div>';
        return;
    }

    container.innerHTML = '';
    const printList = document.getElementById('ava3-certs-list');
    printList.innerHTML = '';

    certs.forEach(c => {
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

        const li = document.createElement('li');
        li.innerHTML = `<strong>${c.classes?.courses?.title}</strong> <span>${c.classes?.courses?.total_hours || 0}h • ${new Date(c.updated_at).getFullYear()}</span>`;
        printList.appendChild(li);
    });
}

// --- FUNÇÕES DE FORMULÁRIO DINÂMICO ---

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

// --- SALVAMENTO ---

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

// --- GERAR PDF (IMPRESSÃO) ---

window.generatePDF = function() {
    // 1. Dados Principais
    document.getElementById('print-name').innerText = document.getElementById('prof_name')?.value.toUpperCase() || '';
    document.getElementById('print-title').innerText = document.getElementById('cv_title')?.value.toUpperCase() || '';
    document.getElementById('print-summary').innerText = document.getElementById('cv_bio')?.value || '';

    // 2. Sidebar (Contato e Competências)
    document.getElementById('print-contact-custom').innerHTML = `
        <p><b>E-MAIL:</b><br>${document.getElementById('prof_email')?.value || ''}</p>
        <p><b>TELEFONE:</b><br>${document.getElementById('cv_phone')?.value || 'Não informado'}</p>
        <p><b>ENDEREÇO:</b><br>Cuiabá - MT</p>`;

    const skills = document.getElementById('cv_skills')?.value || '';
    document.getElementById('print-skills-custom').innerHTML = skills ? skills.split(',').map(s => `<p>${s.trim()}</p>`).join('') : '';

    // 3. Idiomas no PDF
    const printLangArea = document.getElementById('print-languages-custom');
    if (printLangArea) {
        printLangArea.innerHTML = ''; 
        document.querySelectorAll('.language-item').forEach(item => {
            const name = item.querySelector('.lang-name')?.value;
            const level = item.querySelector('.lang-level')?.value;
            if (name) printLangArea.innerHTML += `<p><b>${name}:</b> ${level}</p>`;
        });
    }

    // 4. Educação no PDF
    const printEduList = document.getElementById('print-education-list');
    printEduList.innerHTML = '';
    document.querySelectorAll('.education-item').forEach(item => {
        const school = item.querySelector('.edu-school')?.value;
        const degree = item.querySelector('.edu-degree')?.value;
        const year = item.querySelector('.edu-year')?.value;
        if (school || degree) {
            printEduList.innerHTML += `
                <div class="item-cv-print">
                    <b>${degree.toUpperCase()}</b>
                    <span>${school} | Conclusão: ${year}</span>
                </div>`;
        }
    });

    // 5. Impressão
    setTimeout(() => { window.print(); }, 500);
};

window.logout = async () => {
    await supabase.auth.signOut();
    location.href = 'login.html';
};