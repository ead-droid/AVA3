// assets/js/layout.js
import {
  supabase,
  getSessionSafe,
  getUserDisplayName,
} from './supabaseClient.js';

const headerEl = document.getElementById('site-header');
const footerEl = document.getElementById('site-footer');

function urlTo(file) {
  // relativo -> funciona dentro de /AVA3/
  return new URL(`./${file}`, window.location.href).toString();
}

function pageKey() {
  return document.body?.dataset?.page || '';
}

function renderFooter() {
  if (!footerEl) return;
  const year = new Date().getFullYear();

  footerEl.innerHTML = `
    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="small">© ${year} • AVA</div>
        <div class="small muted">Ambiente Virtual • SECITECI</div>
      </div>
    </footer>
  `;
}

function renderHeader(session) {
  if (!headerEl) return;

  const active = pageKey();
  const isLogged = !!session;
  const displayName = isLogged ? getUserDisplayName(session) : '';

  const links = [
    { key: 'home', label: 'Home', href: urlTo('index.html') }, // ✅ sempre aparece (logado e deslogado)
  ];

  if (isLogged) {
    links.push({ key: 'app', label: 'Minha área', href: urlTo('app.html') });
  } else {
    links.push({ key: 'login', label: 'Entrar', href: urlTo('login.html') });
    links.push({
      key: 'signup',
      label: 'Criar conta',
      href: urlTo('signup.html'),
    });
  }

  const navHtml = links
    .map(
      (l) => `
    <a class="nav-link ${active === l.key ? 'is-active' : ''}" href="${l.href}">
      ${l.label}
    </a>
  `
    )
    .join('');

  const rightHtml = isLogged
    ? `
      <div class="nav-right">
        <span class="nav-user" title="${displayName}">${displayName}</span>
        <button class="btn btn-ghost" id="btn-logout" type="button">Sair</button>
      </div>
    `
    : `
      <div class="nav-right">
        <a class="btn btn-primary" href="${urlTo('login.html')}">Acessar</a>
      </div>
    `;

  headerEl.innerHTML = `
    <header class="site-header">
      <div class="container header-inner">
        <a class="brand" href="${urlTo('index.html')}">
          <span class="brand-dot"></span>
          <span>AVA</span>
        </a>

        <nav class="nav">${navHtml}</nav>
        ${rightHtml}
      </div>
    </header>
  `;

  const btn = document.getElementById('btn-logout');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      await supabase.auth.signOut();
      window.location.assign(urlTo('index.html'));
    });
  }
}

async function protectIfRequired(session) {
  const requires = document.body?.dataset?.auth === 'required';
  if (!requires) return;

  if (!session) {
    const login = new URL(urlTo('login.html'));
    // volta para a página atual depois do login
    login.searchParams.set(
      'returnTo',
      window.location.pathname + window.location.search
    );
    window.location.assign(login.toString());
  }
}

async function main() {
  renderFooter();

  const { session } = await getSessionSafe();

  // protege páginas internas
  await protectIfRequired(session);

  // renderiza menu conforme sessão
  renderHeader(session);

  // se logar/deslogar em outra aba, atualiza menu
  supabase.auth.onAuthStateChange((_evt, newSession) => {
    renderHeader(newSession);
  });
}

main();
