// Importando o cliente Supabase
import { supabase } from './supabaseClient.js';

let classId = '';  // ID da turma, será passado pela URL
let currentUser = { id: 'user-id-placeholder' };  // Placeholder para o usuário logado, substitua pelo ID real

// Função para carregar os dados assim que o DOM for carregado
document.addEventListener('DOMContentLoaded', () => {
    // Pegando o parâmetro `id` da URL
    classId = new URLSearchParams(window.location.search).get('id');
    
    // Verifica se `classId` não está vazio
    if (!classId) {
        console.error('ID da turma não encontrado na URL.');
        return;
    }

    // Carregar os dados da turma e do curso
    loadClassroomData();
});

// Função para carregar os dados da turma e do curso
async function loadClassroomData() {
    try {
        // 1. Carregar os dados da turma
        const { data: classData, error: classError } = await supabase
            .from('classes')
            .select('id, name, course_id')
            .eq('id', classId)
            .single();  // Pega os dados da turma com o `classId`
        
        if (classError) {
            console.error('Erro ao carregar a turma:', classError);
            return;
        }

        // 2. Carregar os dados do curso associado à turma
        const { data: courseData, error: courseError } = await supabase
            .from('courses')
            .select('title, description, image_url')
            .eq('id', classData.course_id)
            .single();  // Pega os dados do curso relacionado à turma
        
        if (courseError) {
            console.error('Erro ao carregar o curso:', courseError);
            return;
        }

        // 3. Atualizando a interface com os dados da turma e do curso
        document.getElementById('header-class-name').textContent = classData.name;
        document.getElementById('header-course-title').textContent = courseData.title;
        document.getElementById('course-title').textContent = courseData.title;
        document.getElementById('course-description').textContent = courseData.description;
        document.getElementById('course-image').src = courseData.image_url;

        // 4. Carregar os módulos, seções e lições do curso
        loadModules(classData.course_id);
    } catch (error) {
        console.error('Erro ao carregar os dados da turma ou curso:', error);
    }
}

// Função para carregar os módulos, seções e lições do curso
async function loadModules(courseId) {
    try {
        // 1. Carregar os módulos do curso
        const { data: modules, error: modulesError } = await supabase
            .from('modules')
            .select('id, title, ordem, sections(id, title, ordem, lessons(id, title, type, content_url))')
            .eq('course_id', courseId)
            .order('ordem', { ascending: true });  // Ordena os módulos pela ordem
        
        if (modulesError) {
            console.error('Erro ao carregar módulos:', modulesError);
            return;
        }

        // 2. Renderizar os módulos, seções e lições na interface
        const modulesContainer = document.getElementById('modules-list');
        modules.forEach(module => {
            const moduleElement = document.createElement('div');
            moduleElement.classList.add('module');
            moduleElement.innerHTML = `
                <h3>${module.title}</h3>
                <div class="sections-container">
                    ${module.sections.map(section => `
                        <div class="section">
                            <h4>${section.title}</h4>
                            <div class="lessons-container">
                                ${section.lessons.map(lesson => `
                                    <div class="lesson" data-id="${lesson.id}">
                                        <h5>${lesson.title}</h5>
                                        <button onclick="markAsCompleted(${lesson.id})">Marcar como Concluída</button>
                                    </div>`).join('')}
                            </div>
                        </div>`).join('')}
                </div>
            `;
            modulesContainer.appendChild(moduleElement);
        });
    } catch (error) {
        console.error('Erro ao carregar os módulos e lições:', error);
    }
}

// Função para marcar lições como concluídas
async function markAsCompleted(lessonId) {
    try {
        // 1. Carregar a matrícula do aluno na turma
        const { data: enrollmentData, error: enrollmentError } = await supabase
            .from('class_enrollments')
            .select('id, grades')
            .eq('class_id', classId)
            .eq('user_id', currentUser.id)
            .single();  // Obtém a matrícula do aluno na turma

        if (enrollmentError) {
            console.error('Erro ao carregar a matrícula:', enrollmentError);
            return;
        }

        // 2. Verifica se a lição já foi concluída
        let grades = enrollmentData.grades || { completed: [], scores: {} };
        if (!grades.completed.includes(lessonId)) {
            grades.completed.push(lessonId);
            await updateGrades(enrollmentData.id, grades);
            console.log('Lição concluída com sucesso!');
        } else {
            console.log('Esta lição já foi concluída!');
        }
    } catch (error) {
        console.error('Erro ao marcar lição como concluída:', error);
    }
}

// Função para atualizar as notas e o progresso do aluno
async function updateGrades(enrollmentId, grades) {
    try {
        const { error } = await supabase
            .from('class_enrollments')
            .update({ grades })
            .eq('id', enrollmentId);

        if (error) {
            console.error('Erro ao atualizar as notas:', error);
        } else {
            console.log('Notas atualizadas com sucesso!');
        }
    } catch (error) {
        console.error('Erro ao atualizar o progresso:', error);
    }
}

// Função para carregar o progresso do aluno
async function loadProgress() {
    try {
        // Carregar o progresso do aluno
        const { data: enrollmentData, error: enrollmentError } = await supabase
            .from('class_enrollments')
            .select('grades')
            .eq('class_id', classId)
            .eq('user_id', currentUser.id)
            .single();  // Obtém a matrícula do aluno na turma

        if (enrollmentError) {
            console.error('Erro ao carregar progresso:', enrollmentError);
            return;
        }

        // 1. Calcular o percentual de progresso
        const grades = enrollmentData.grades || { completed: [], scores: {} };
        const progressPercent = (grades.completed.length / totalLessons) * 100;  // Total de lições completadas
        document.getElementById('overall-progress').style.width = `${progressPercent}%`;
        document.getElementById('progress-text').textContent = `${progressPercent}%`;

        // 2. Exibir as notas de cada lição
        const scoresContainer = document.getElementById('grades-list');
        for (const lessonId of grades.completed) {
            const score = grades.scores[lessonId] || 'N/A';  // Caso não tenha nota, exibe 'N/A'
            const scoreElement = document.createElement('div');
            scoreElement.classList.add('score');
            scoreElement.innerHTML = `
                <h6>Lição ${lessonId}</h6>
                <p>Nota: ${score}</p>
            `;
            scoresContainer.appendChild(scoreElement);
        }
    } catch (error) {
        console.error('Erro ao carregar o progresso do aluno:', error);
    }
}
