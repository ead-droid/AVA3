// assets/js/boot.js
(() => {
  try {
    // 1) Trava transições/animações durante o boot (evita "piscar")
    document.documentElement.classList.add('is-booting');
    window.addEventListener('load', () => {
      document.documentElement.classList.remove('is-booting');
    });

    // 2) Aplica estado do sidebar BEM cedo
    const collapsed = localStorage.getItem('ava3.sidebarCollapsed') === '1';
    if (collapsed) {
      document.documentElement.classList.add('sidebar-collapsed');
    }

    // 3) Hidratação imediata do chrome via cache (sessionStorage)
    const VER = 'v1';
    const KEYS = {
      header: `ava3.chrome.${VER}.header`,
      sidebar: `ava3.chrome.${VER}.sidebar`,
      footer: `ava3.chrome.${VER}.footer`,
    };

    const hydrateIfPossible = () => {
      const headerEl = document.getElementById('site-header');
      const sidebarEl = document.getElementById('site-sidebar');
      const footerEl = document.getElementById('site-footer');

      // Só tenta hidratar se pelo menos header/sidebar existirem no DOM
      if (!headerEl && !sidebarEl && !footerEl) return false;

      const headerHTML = sessionStorage.getItem(KEYS.header) || '';
      const sidebarHTML = sessionStorage.getItem(KEYS.sidebar) || '';
      const footerHTML = sessionStorage.getItem(KEYS.footer) || '';

      // Se não tem cache, não tem o que hidratar
      if (!headerHTML && !sidebarHTML && !footerHTML) return false;

      if (headerEl && headerHTML && headerEl.innerHTML.trim() === '') headerEl.innerHTML = headerHTML;
      if (sidebarEl && sidebarHTML && sidebarEl.innerHTML.trim() === '') sidebarEl.innerHTML = sidebarHTML;
      if (footerEl && footerHTML && footerEl.innerHTML.trim() === '') footerEl.innerHTML = footerHTML;

      // garante classes no body também (se seu CSS antigo usa body.sidebar-collapsed)
      document.body?.classList.toggle('sidebar-collapsed', document.documentElement.classList.contains('sidebar-collapsed'));

      return true;
    };

    // Tenta agora (caso o DOM já exista)
    if (hydrateIfPossible()) return;

    // Cas
