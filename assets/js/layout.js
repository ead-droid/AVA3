// assets/js/layout.js
import { supabase } from './supabaseClient.js';

const headerEl = document.getElementById('site-header');
const footerEl = document.getElementById('site-footer');

function urlTo(filename) {
  // sempre relativo -> funciona no GitHub Pages (/AVA3/)
  return new URL(`./${filename}`, window.location.href).toString();
}

function getActivePage() {
  return document.body?.dataset?.page || '';
}

function renderFooter() {
  if (!footerEl) return;
  const year = new Date().getFullYear();
  footerEl.innerHTML = `
    <footer class="site-footer">
      <div class="container footer-inner">
        <small>© ${year} • AVA</small>
        <small class="muted">Educação a Distância • SECITECI</small>
      </div>
    </footer>
  `;
}

function renderHeader({ session }) {
  if (!headerEl) return;

  const active = getActivePage();
  const isLogged = !!session;

  // links base
  const links = [{ label: 'Home', href: urlTo('index.html'), key: 'home' }];

  // links condicionais
  if (isLogged) {
    links.push({ label: 'Minha área', href: urlTo('app.html'), key: 'app' });
  } else {
    links.push({ label: 'Entrar', href: urlTo('login.html'), key: 'login' });
    links.push({
      label: 'Criar conta',
      href: urlTo('signup.html'),
      key: 'signup',
    });
  }

  const navLinksHtml = links
    .map(
      (l) => `
        <a class="nav-link ${active === l.key ? 'is-active' : ''}" href="${
        l.href
      }">
          ${l.label}
        </a>
      `
    )
    .join('');

  const rightHtml = isLogged
    ? `
      <div class="nav-right">
        <span class="nav-user">${session?.user?.email || ''}</span>
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
          <strong>AVA</strong>
        </a>

        <nav class="nav">
          ${navLinksHtml}
        </nav>

        ${rightHtml}
      </div>
    </header>
  `;

  // logout
  const btn = document.getElementById('btn-logout');
  if (btn) {
    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true;
        await supabase.auth.signOut();
      } finally {
        window.location.assign(urlTo('index.html'));
      }
    });
  }
}

async function protectIfNeeded(session) {
  const requiresAuth = document.body?.dataset?.auth === 'required';
  if (!requiresAuth) return;

  if (!session) {
    // manda pro login e mantém um returnTo simples
    const loginUrl = new URL(urlTo('login.html'));
    loginUrl.searchParams.set(
      'returnTo',
      window.location.pathname + window.location.search
    );
    window.location.assign(loginUrl.toString());
  }
}

async function main() {
  renderFooter();

  // pega sessão
  const { data } = await supabase.auth.getSession();
  const session = data?.session || null;

  // protege páginas internas
  await protectIfNeeded(session);

  // renderiza menu com base na sessão
  renderHeader({ session });

  // se a sessão mudar em outra aba, atualiza
  supabase.auth.onAuthStateChange((_event, _session) => {
    renderHeader({ session: _session });
  });
}

main();
