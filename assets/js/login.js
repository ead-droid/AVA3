import { supabase } from './supabaseClient.js';

const $ = (id) => document.getElementById(id);

const msgEl = $('msg');

const viewLogin = $('view-login');
const viewSignup = $('view-signup');
const forgotBox = $('forgot-box');

const tabs = document.querySelectorAll('[data-view]');
const loginForm = $('login-form');
const signupForm = $('signup-form');
const forgotForm = $('forgot-form');

function setMsg(type, html) {
  msgEl.className = `alert alert-${type}`;
  msgEl.innerHTML = html;
  msgEl.classList.remove('d-none');
}

function clearMsg() {
  msgEl.classList.add('d-none');
  msgEl.innerHTML = '';
}

function showView(name) {
  clearMsg();
  forgotBox.classList.add('d-none');

  if (name === 'signup') {
    viewLogin.classList.add('d-none');
    viewSignup.classList.remove('d-none');
  } else {
    viewSignup.classList.add('d-none');
    viewLogin.classList.remove('d-none');
  }

  // marca aba ativa
  tabs.forEach((b) => {
    if (b.getAttribute('data-view') === name) b.classList.add('active');
    else b.classList.remove('active');
  });
}

function togglePass(inputId, btnId) {
  const input = $(inputId);
  const btn = $(btnId);
  const icon = btn.querySelector('i');

  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  icon.className = isPass ? 'bi bi-eye-slash' : 'bi bi-eye';
}

function goTo(filename) {
  const url = new URL(`./${filename}`, window.location.href);
  window.location.assign(url.toString());
}

async function autoRedirectIfLogged() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return;
  if (data?.session) goTo('app.html');
}

// Eventos das abas
tabs.forEach((b) => {
  b.addEventListener('click', (e) => {
    e.preventDefault();
    const v = b.getAttribute('data-view');
    if (v === 'login' || v === 'signup') showView(v);
  });
});

// Mostrar/ocultar senha
$('btn-toggle-pass-login').addEventListener('click', () =>
  togglePass('login-pass', 'btn-toggle-pass-login')
);
$('btn-toggle-pass-signup').addEventListener('click', () =>
  togglePass('signup-pass', 'btn-toggle-pass-signup')
);

// Login com e-mail/senha
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg();

  const email = $('login-email').value.trim();
  const password = $('login-pass').value;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMsg('danger', `❌ Não foi possível entrar: <b>${error.message}</b>`);
      return;
    }

    // ok -> app
    setMsg('success', `✅ Login realizado! Redirecionando...`);
    setTimeout(() => goTo('app.html'), 500);
  } catch (err) {
    setMsg('danger', `❌ Erro inesperado: <b>${err?.message || err}</b>`);
  }
});

// Cadastro
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg();

  const fullName = $('signup-name').value.trim();
  const email = $('signup-email').value.trim();
  const password = $('signup-pass').value;

  try {
    const redirectTo = new URL('./app.html', window.location.href).toString();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      setMsg(
        'danger',
        `❌ Não foi possível cadastrar: <b>${error.message}</b>`
      );
      return;
    }

    // Se confirmação por e-mail estiver ligada, não terá sessão ainda
    setMsg(
      'success',
      `✅ Cadastro enviado! <br/>
       <small>Se o Supabase estiver com confirmação por e-mail ativa, verifique sua caixa de entrada e SPAM para confirmar.</small>`
    );

    // volta pro login
    showView('login');
    $('login-email').value = email;
    $('login-pass').focus();
  } catch (err) {
    setMsg('danger', `❌ Erro inesperado: <b>${err?.message || err}</b>`);
  }
});

// Esqueci a senha (mostrar caixa)
$('link-forgot').addEventListener('click', (e) => {
  e.preventDefault();
  forgotBox.classList.toggle('d-none');
  $('forgot-email').value = $('login-email').value.trim();
  $('forgot-email').focus();
});

// Enviar link de recuperação
forgotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMsg();

  const email = $('forgot-email').value.trim();

  try {
    // Página que vai receber o link e permitir trocar a senha:
    const redirectTo = new URL('./reset.html', window.location.href).toString();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setMsg('danger', `❌ Falha ao enviar link: <b>${error.message}</b>`);
      return;
    }

    setMsg(
      'success',
      `✅ Link enviado! <small>Verifique sua caixa de entrada e SPAM. Ao clicar, você será levado para a tela de redefinir senha.</small>`
    );
  } catch (err) {
    setMsg('danger', `❌ Erro inesperado: <b>${err?.message || err}</b>`);
  }
});

// OAuth Google
$('btn-google').addEventListener('click', async () => {
  clearMsg();
  try {
    const redirectTo = new URL('./app.html', window.location.href).toString();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    if (error) {
      setMsg(
        'danger',
        `❌ Google não disponível agora: <b>${error.message}</b><br/>
         <small>Verifique se o provedor Google está habilitado no Supabase e se o Redirect URL está cadastrado.</small>`
      );
    }
  } catch (err) {
    setMsg('danger', `❌ Erro inesperado: <b>${err?.message || err}</b>`);
  }
});

// Início
showView('login');
autoRedirectIfLogged();
