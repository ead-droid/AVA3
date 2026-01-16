import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', init);

async function init() {
    await checkAuth();
    await loadCoursesSelect();
    await loadClasses();
}

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) window.location.href = 'login.html';
}

async function loadCoursesSelect() {
    const select = document.getElementById('course_select');
    const { data, error } = await supabase.from('courses').select('id, title').order('title');
    if (error) return;
    select.innerHTML = '<option value="">Selecione...</option>';
    data.forEach(course => {
        const opt = document.createElement('option');
        opt.value = course.id;
        opt.textContent = course.title;
        select.appendChild(opt);
    });
}

async function loadClasses() {
    const container = document.getElementById('classes-list');
    const { data: classes, error } = await supabase.from('classes')
        .select(`*, courses (title), class_enrollments (count)`)
        .order('created_at', { ascending: false });

    if (error) { container.innerHTML = "Erro ao carregar."; return; }
    container.innerHTML = '';

    const tpl = document.getElementById('tpl-class-card');
    const fmt = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '--/--';

    classes.forEach(cls => {
        const clone = tpl.content.cloneNode(true);
        const count = cls.class_enrollments?.[0]?.count || 0;
        
        clone.querySelector('.class-course-name').textContent = cls.courses?.title || 'Curso';
        clone.querySelector('.class-name').textContent = cls.name;
        clone.querySelector('.class-count').textContent = count;
        
        // Exibição de Datas (Inscrição vs Aula)
        clone.querySelector('.class-deadline-info').textContent = fmt(cls.enrollment_deadline);
        
        const statusBadge = clone.querySelector('.class-status-badge');
        if (cls.status === 'rascunho') {
            statusBadge.className = "badge bg-warning text-dark";
            statusBadge.textContent = "Rascunho";
        } else if (cls.is_hidden) {
            statusBadge.className = "badge bg-secondary";
            statusBadge.textContent = "Oculta (Ativa)";
        } else {
            statusBadge.className = "badge bg-success";
            statusBadge.textContent = "Publicada";
        }

        clone.querySelector('.btn-edit').onclick = () => editClass(cls);
        clone.querySelector('.btn-delete').onclick = () => deleteClass(cls.id);
        clone.querySelector('.btn-dashboard').onclick = () => window.location.href = `class-dashboard.html?id=${cls.id}`;

        container.appendChild(clone);
    });
}

window.openClassModal = function() {
    document.getElementById('formClass').reset();
    document.getElementById('class_id').value = '';
    new bootstrap.Modal(document.getElementById('modalClass')).show();
};

window.editClass = function(cls) {
    document.getElementById('class_id').value = cls.id;
    document.getElementById('course_select').value = cls.course_id;
    document.getElementById('class_name').value = cls.name;
    document.getElementById('class_code').value = cls.code || '';
    document.getElementById('max_students').value = cls.max_students || '';
    document.getElementById('requires_approval').checked = cls.requires_approval;
    document.getElementById('class_status').value = cls.status || 'rascunho';
    document.getElementById('is_hidden').checked = cls.is_hidden || false;
    document.getElementById('enrollment_open').checked = cls.enrollment_open !== false;

    const dFmt = (d) => d ? d.split('T')[0] : '';
    document.getElementById('start_date').value = dFmt(cls.start_date);
    document.getElementById('end_date').value = dFmt(cls.end_date);
    document.getElementById('enrollment_start').value = dFmt(cls.enrollment_start);
    document.getElementById('enrollment_deadline').value = dFmt(cls.enrollment_deadline);

    new bootstrap.Modal(document.getElementById('modalClass')).show();
};

document.getElementById('formClass').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('class_id').value;
    const data = {
        course_id: document.getElementById('course_select').value,
        name: document.getElementById('class_name').value,
        status: document.getElementById('class_status').value,
        is_hidden: document.getElementById('is_hidden').checked,
        enrollment_open: document.getElementById('enrollment_open').checked,
        enrollment_start: document.getElementById('enrollment_start').value || null,
        enrollment_deadline: document.getElementById('enrollment_deadline').value || null,
        start_date: document.getElementById('start_date').value || null,
        end_date: document.getElementById('end_date').value || null,
        max_students: document.getElementById('max_students').value ? parseInt(document.getElementById('max_students').value) : null,
        requires_approval: document.getElementById('requires_approval').checked
    };

    const { error } = id 
        ? await supabase.from('classes').update(data).eq('id', id)
        : await supabase.from('classes').insert(data);

    if (error) alert(error.message);
    else {
        bootstrap.Modal.getInstance(document.getElementById('modalClass')).hide();
        loadClasses();
    }
});