import { supabase, getCurrentUser } from './supabase-client.js';

async function loadDashboard() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'login.html'; // Redireciona se não logado
    return;
  }

  // Busca matrículas conectando com Turmas e Cursos
  // Relacionamento: class_enrollments -> classes -> courses
  const { data: enrollments, error } = await supabase
    .from('class_enrollments')
    .select(`
      id,
      progress_percent,
      classes (
        id,
        name,
        courses (
          id,
          title,
          description,
          image_url
        )
      )
    `)
    .eq('user_id', user.id);

  if (error) {
    console.error('Erro ao carregar cursos:', error);
    return;
  }

  renderCourses(enrollments);
}

function renderCourses(enrollments) {
  const container = document.getElementById('courses-container'); // Seu ID no HTML
  container.innerHTML = '';

  enrollments.forEach(item => {
    const turma = item.classes;
    const curso = turma.courses;
    
    // Calcula progresso visual
    const progress = item.progress_percent || 0;

    // Cria o card (adaptar ao seu HTML existente)
    const cardHtml = `
      <div class="col-md-4 mb-4">
        <div class="card h-100 shadow-sm course-card" onclick="openClassroom(${turma.id})">
          <img src="${curso.image_url || 'assets/img/default-course.jpg'}" class="card-img-top" alt="${curso.title}">
          <div class="card-body">
            <h5 class="card-title text-truncate">${curso.title}</h5>
            <p class="card-text small text-muted">${turma.name}</p>
            
            <div class="progress mt-3" style="height: 6px;">
              <div class="progress-bar bg-primary" role="progressbar" style="width: ${progress}%"></div>
            </div>
            <div class="d-flex justify-content-between mt-2 small">
              <span class="text-muted">${progress}% concluído</span>
            </div>
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', cardHtml);
  });
}

// Função para abrir a sala de aula passando o ID da turma
window.openClassroom = (classId) => {
  // Salva o ID para a próxima página usar
  localStorage.setItem('currentClassId', classId);
  window.location.href = 'classroom.html';
};

// Iniciar
document.addEventListener('DOMContentLoaded', loadDashboard);