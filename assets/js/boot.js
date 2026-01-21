// assets/js/boot.js
(() => {
  // Versão do cache (troque para v2 se quiser "resetar" o cache do chrome)
  const CHROME_CACHE_VER = 'v1';

  const HEADER_KEY  = `ava3.chrome.header.${CHROME_CACHE_VER}`;
  const SIDEBAR_KEY = `ava3.chrome.sidebar.${CHROME_CACHE_VER}`;
  const FOOTER_KEY  = `ava3.chrome.footer.${CHROME_CACHE_VER}`;

  const SIDEBAR_STATE_KEY = 'ava3.sidebarCollapsed';
  const THEME_KEY = 'ava3.theme';

  const html = document.documentElement;

  // 1) Desliga transições durante o "boot" para não dar flicker
  html.classList.add('chrome-booting');

  // 2) Aplica estado do sidebar (recolhido/aberto) o mais cedo possível
  try {
    const collapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === '1';
    html.classList.toggle('sidebar-collapsed', collapsed);
  } catch {}

  // 3) Aplica tema salvo cedo (se você usa theme-dark)
  try {
    const theme = localStorage.getItem(THEME_KEY);
    html.classList.toggle('theme-dark', theme === 'dark');
  } catch {}

  // 4) Lê cache do chrome (sessionStorage persiste entre páginas na mesma aba)
  let cache = { header: '', sidebar: '', footer: '' };
  try {
    cache.header  = sessionStorage.getItem(HEADER_KEY)  || '';
    cache.sidebar = sessionStorage.getItem(SIDEBAR_KEY) || '';
    cache.footer  = sessionStorage.getItem(FOOTER_KEY)  || '';
  } catch {}

  // Disponibiliza para o chrome.js também
  window.__AVA3_CHROME_CACHE__ = cache;

  // 5) Injeta assim que os slots existirem (sem esperar fetch)
  function injectIfEmpty() {
    const headerEl = document.getElementById('site-header');
    const sidebarEl = document.getElementById('site-sidebar');
    const footerEl = document.getElementById('site-footer');

    let injected = false;

    if (headerEl && !headerEl.innerHTML.trim() && cache.header) {
      headerEl.innerHTML = cache.header;
      injected = true;
    }
    if (sidebarEl && !sidebarEl.innerHTML.trim() && cache.sidebar) {
      sidebarEl.innerHTML = cache.sidebar;
      injected = true;
    }
    if (footerEl && !footerEl.innerHTML.trim() && cache.footer) {
      footerEl.innerHTML = cache.footer;
      injected = true;
    }

    // Compatibilidade: alguns CSS antigos usam body.sidebar-collapsed
    if (document.body) {
      document.body.classList.toggle('sidebar-collapsed', html.classList.contains('sidebar-collapsed'));
    }

    return injected;
  }

  // Tenta injetar já
  injectIfEmpty();

  // Observa a árvore porque o <body> ainda pode não ter sido parseado
  const mo = new MutationObserver(() => {
    const ok = injectIfEmpty();
    if (ok) {
      // Se já injetou header+sidebar, pode parar
      const h = document.getElementById('site-header');
      const s = document.getElementById('site-sidebar');
      if (h?.innerHTML.trim() && s?.innerHTML.trim()) {
        try { mo.disconnect(); } catch {}
      }
    }
  });

  mo.observe(html, { childList: true, subtree: true });

  // O chrome.js vai avisar quando terminar para reativar transições
  document.addEventListener('ava3:chrome-ready', () => {
    html.classList.remove('chrome-booting');
    try { mo.disconnect(); } catch {}
  }, { once: true });

  // Failsafe: não deixa "booting" preso se algo der errado
  setTimeout(() => html.classList.remove('chrome-booting'), 2000);
})();
