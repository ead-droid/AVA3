// assets/js/admin.js
import { supabase } from './supabaseClient.js';

const grid = document.getElementById('coursesGrid');
const q = document.getElementById('q');
const msg = document.getElementById('msg');
const countBadge = document.getElementById('countBadge');

const btnNew = document.getElementById('btnNew');
const dlg = document.getElementById('courseDialog');
const btnCloseDlg = document.getElementById('btnCloseDlg');
const btnCancel = document.getElementById('btnCancel');

const form = document.getElementById('courseForm');
const courseId = document.getElementById('courseId');
const titleEl = document.getElementById('title');
const slugEl = document.getElementById('slug');
const chEl = document.getElementById('ch');
const descEl = document.getElementById('description');

const dlgTitle = document.getElementById('dlgTitle');
const dlgSubtitle = document.getElementById('dlgSubtitle');
const btnSave = document.getElementById('btnSave');

let allCourses = [];

function showMsg(html, kind = 'card') {
  msg.className = kind === 'error' ? 'card msg' : 'card msg';
  msg.innerHTML = html;
  msg.style.display = 'block';
}

function hideMsg() {
  msg.style.display = 'none';
  msg.innerHTML = '';
}

function normalize(str) {
  return (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(title) {
  const s = normalize(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
  return s || 'curso';
}

function safeText(x, fallback = '') {
  return (x ?? fallback).toString();
}

function render(list) {
  grid.innerHTML = '';

  countBadge.textContent = `${list.length} curso${
    list.length === 1 ? '' : 's'
  }`;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="card">
        <div class="badge"><i class="bx bx-info-circle"></i> Nenhum curso</div>
        <p class="muted" style="margin-top:10px">
          Clique em <b>Novo curso</b> para cadastrar o primeiro.
        </p>
      </div>
    `;
    return;
  }

  for (const c of list) {
    const title = safeText(c.title || c.nome || 'Sem título');
    const slug = safeText(c.slug || '');
    const desc = safeText(c.description || c.descricao || '').trim();
    const createdAt = c.created_at
      ? new Date(c.created_at).toLocaleString()
      : '';

    const status = safeText(c.status || '').trim();

    const el = document.createElement('article');
    el.className = 'card';
    el.innerHTML = `
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
        <div style="min-width:0;">
          <h2 class="h2" style="margin:0; font-size:16px; line-height:1.25; word-break:break-word;">${title}</h2>
          <div class="muted" style="margin-top:6px; font-size:12px;">
            ${
              slug
                ? `<span class="badge" style="margin-right:8px;">${slug}</span>`
                : ''
            }
            ${status ? `<span class="badge">${status}</span>` : ''}
          </div>
        </div>
      </div>

      ${
        desc
          ? `<p class="muted" style="margin-top:10px; white-space:pre-wrap;">${desc}</p>`
          : `<p class="muted" style="margin-top:10px;">(sem descrição)</p>`
      }

      ${
        createdAt
          ? `<div class="hint" style="margin-top:10px;">Criado em: ${createdAt}</div>`
          : ''
      }

      <div class="hr"></div>

      <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
        <button class="btn" data-act="edit" data-id="${
          c.id
        }"><i class="bx bx-edit"></i> Editar</button>
        <button class="btn ghost" data-act="del" data-id="${
          c.id
        }"><i class="bx bx-trash"></i> Excluir</button>
      </div>
    `;

    grid.appendChild(el);
  }
}

function applyFilter() {
  const term = normalize(q.value);
  if (!term) {
    render(allCourses);
    return;
  }

  const filtered = allCourses.filter((c) => {
    const t = normalize(c.title || c.nome || '');
    const s = normalize(c.slug || '');
    return t.includes(term) || s.includes(term);
  });

  render(filtered);
}

async function loadCourses() {
  hideMsg();

  // select('*') para não quebrar se o schema tiver mais/menos colunas
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showMsg(
      `❌ Erro ao carregar cursos: <code>${error.message}</code><br/><span class="muted">Se isso acontecer mesmo logada como admin, é RLS/policy.</span>`,
      'error'
    );
    allCourses = [];
    render(allCourses);
    return;
  }

  allCourses = Array.isArray(data) ? data : [];
  applyFilter();
}

function openNew() {
  courseId.value = '';
  titleEl.value = '';
  slugEl.value = '';
  chEl.value = '';
  descEl.value = '';

  dlgTitle.textContent = 'Novo curso';
  dlgSubtitle.textContent = 'Preencha os campos e salve.';
  btnSave.disabled = false;
  hideMsg();

  dlg.showModal();
}

function openEdit(course) {
  courseId.value = course.id || '';
  titleEl.value = course.title || '';
  slugEl.value = course.slug || '';
  chEl.value = course.carga_horaria_horas ?? course.ch_total ?? '';
  descEl.value = course.description || '';

  dlgTitle.textContent = 'Editar curso';
  dlgSubtitle.textContent = 'Ajuste os campos e salve.';
  btnSave.disabled = false;
  hideMsg();

  dlg.showModal();
}

async function saveCourse() {
  btnSave.disabled = true;

  const id = courseId.value.trim();
  const title = titleEl.value.trim();
  let slug = slugEl.value.trim();
  const description = descEl.value.trim();
  const ch = chEl.value !== '' ? Number(chEl.value) : null;

  if (!title) {
    btnSave.disabled = false;
    alert('Informe o título.');
    return;
  }

  if (!slug) slug = slugify(title);

  // payload “flexível”: só envia colunas opcionais se existir valor
  // (se sua tabela não tiver ch/description, isso pode dar erro; se der, removemos depois)
  const payload = { title, slug };
  if (description) payload.description = description;
  if (Number.isFinite(ch) && ch !== null) payload.carga_horaria_horas = ch;

  try {
    let res;

    if (!id) {
      res = await supabase.from('courses').insert(payload).select('*').single();
    } else {
      res = await supabase
        .from('courses')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
    }

    if (res.error) {
      showMsg(`❌ Falha ao salvar: <code>${res.error.message}</code>`, 'error');
      btnSave.disabled = false;
      return;
    }

    dlg.close();
    await loadCourses();
  } finally {
    btnSave.disabled = false;
  }
}

async function deleteCourse(id) {
  const ok = confirm('Excluir este curso? Essa ação não pode ser desfeita.');
  if (!ok) return;

  const { error } = await supabase.from('courses').delete().eq('id', id);

  if (error) {
    showMsg(`❌ Falha ao excluir: <code>${error.message}</code>`, 'error');
    return;
  }

  await loadCourses();
}

function bindEvents() {
  q.addEventListener('input', applyFilter);

  btnNew.addEventListener('click', openNew);

  btnCloseDlg.addEventListener('click', () => dlg.close());
  btnCancel.addEventListener('click', () => dlg.close());

  // auto-slug (sem travar se a pessoa quiser escrever manualmente)
  titleEl.addEventListener('input', () => {
    if (slugEl.value.trim()) return;
    slugEl.value = slugify(titleEl.value);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveCourse();
  });

  grid.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;

    const course = allCourses.find((x) => x.id === id);

    if (act === 'edit' && course) openEdit(course);
    if (act === 'del' && id) await deleteCourse(id);
  });
}

async function main() {
  bindEvents();
  await loadCourses();
}

main();
