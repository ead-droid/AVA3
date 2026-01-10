// assets/js/login.js
import { supabase } from './supabaseClient.js';

const msg = document.getElementById('msg');
const btn = document.getElementById('btnLogin');

function setMsg(text, isError = false) {
  msg.textContent = text;
  msg.style.color = isError ? '#b00020' : '#111';
}

function goToApp() {
  // resolve certo no GitHub Pages mesmo com /AVA3/
  const url = new URL('../../app.html', window.location.href);
  window.location.href = url.href;
}

async function checkSessionAndRedirect() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    setMsg(`Erro ao ler sessão: ${error.message}`, true);
    return;
  }
  if (data?.session?.user) {
    setMsg('Sessão encontrada. Entrando...');
    goToApp();
  }
}

async function doLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    setMsg('Informe e-mail e senha.', true);
    return;
  }

  btn.disabled = true;
  setMsg('Entrando...');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setMsg(`Falha no login: ${error.message}`, true);
    btn.disabled = false;
    return;
  }

  setMsg(`Login OK: ${data?.user?.email || 'usuário'}. Redirecionando...`);
  setTimeout(goToApp, 400);
}

// 1) Se já tiver sessão, manda pro app
checkSessionAndRedirect();

// 2) clique no botão
btn.addEventListener('click', doLogin);

// 3) Enter no campo senha
document.getElementById('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});
