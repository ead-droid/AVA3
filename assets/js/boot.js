// assets/js/boot.js
(() => {
  try {
    // 1) Trava transições/animações durante o boot (evita "piscar")
    document.documentElement.classList.add("is-booting");
    window.addEventListener(
      "load",
      () => document.documentElement.classList.remove("is-booting"),
      { once: true }
    );

    // 2) Aplica estado do sidebar BEM cedo
    const SIDEBAR_STATE_KEY = "ava3.sidebarCollapsed";
    const isClassroom =
      location.pathname.endsWith("classroom.html") ||
      location.href.includes("classroom.html");

    const collapsed = isClassroom
      ? true
      : localStorage.getItem(SIDEBAR_STATE_KEY) === "1";

    document.documentElement.classList.toggle("sidebar-collapsed", collapsed);

    const syncBodyCollapsed = () => {
      if (!document.body) return;
      document.body.classList.toggle(
        "sidebar-collapsed",
        document.documentElement.classList.contains("sidebar-collapsed")
      );
    };

    // 3) Hidratação imediata do chrome via cache (sessionStorage)
    // IMPORTANTE: deve bater com a versão do chrome.js
    // (no seu chrome.js atual, o VER está como 'v5')
    const VER = "v5";
    const KEYS = {
      header: `ava3.chrome.${VER}.header`,
      sidebar: `ava3.chrome.${VER}.sidebar`,
      footer: `ava3.chrome.${VER}.footer`,
    };

    const hydrateIfPossible = () => {
      const headerEl = document.getElementById("site-header");
      const sidebarEl = document.getElementById("site-sidebar");
      const footerEl = document.getElementById("site-footer");

      // Só tenta hidratar se existir algum slot no DOM
      if (!headerEl && !sidebarEl && !footerEl) return false;

      const headerHTML = sessionStorage.getItem(KEYS.header) || "";
      const sidebarHTML = sessionStorage.getItem(KEYS.sidebar) || "";
      const footerHTML = sessionStorage.getItem(KEYS.footer) || "";

      // Se não tem cache, não tem o que hidratar
      if (!headerHTML && !sidebarHTML && !footerHTML) return false;

      if (headerEl && headerHTML && headerEl.innerHTML.trim() === "")
        headerEl.innerHTML = headerHTML;

      if (sidebarEl && sidebarHTML && sidebarEl.innerHTML.trim() === "")
        sidebarEl.innerHTML = sidebarHTML;

      if (footerEl && footerHTML && footerEl.innerHTML.trim() === "")
        footerEl.innerHTML = footerHTML;

      syncBodyCollapsed();
      return true;
    };

    // Tenta agora (se o DOM já estiver pronto)
    if (document.readyState !== "loading") {
      hydrateIfPossible();
      syncBodyCollapsed();
    }

    // Tenta no DOMContentLoaded (caso o script esteja no <head>)
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        hydrateIfPossible();
        syncBodyCollapsed();

        // Extra: tenta mais 1 vez depois de um tiquinho (caso algum slot seja inserido depois)
        setTimeout(() => {
          hydrateIfPossible();
          syncBodyCollapsed();
        }, 50);
      },
      { once: true }
    );
  } catch (err) {
    console.warn("[boot.js] falha silenciosa:", err);
  }
})();
