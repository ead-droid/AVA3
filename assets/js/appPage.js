// assets/js/appPage.js
import { supabase } from './supabaseClient.js';

const userLine = document.getElementById('userLine');
const statusEl = document.getElementById('status');
const btnLogout = document.getElementById('btnLogout');

function goToLogin() {
  // resolve certo no GitHub Pages mesmo com /AVA3/
  const url = new URL('./login.html', window.location.href);
  window.location.href = url.href;
}

async function loadSessionOrRedirect() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error(error);
      statusEl.innerHTML = `❌ Erro ao ler sessão: <code>${error.message}</code>`;
      return;
    }

    const user = data?.session?.user;

    if (!user) {
      // sem sessão → volta pro login
      goToLogin();
      return;
    }

    // sessão ok
    userLine.textContent = `Logado como: ${user.email}`;
    statusEl.innerHTML =
      `✅ Sessão ativa.<br>` +
      `User ID: <code>${user.id}</code><br>` +
      `Último login: <code>${new Date(
        user.last_sign_in_at || Date.now()
      ).toLocaleString()}</code>`;
  } catch (e) {
    console.error(e);
    statusEl.innerHTML = `❌ Erro inesperado: <code>${e?.message || e}</code>`;
  }
}

async function doLogout() {
  btnLogout.disabled = true;
  statusEl.textContent = 'Saindo...';

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error(error);
    statusEl.innerHTML = `❌ Erro ao sair: <code>${error.message}</code>`;
    btnLogout.disabled = false;
    return;
  }

  goToLogin();
}

btnLogout.addEventListener('click', doLogout);

// Protege a página
loadSessionOrRedirect();
