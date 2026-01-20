// assets/js/signup.js
import { supabase } from './supabaseClient.js';

const form = document.getElementById('formSignup');
const msg = document.getElementById('msg');
const btn = document.getElementById('btnSignup');

function page(filename) {
  return new URL(`./${filename}`, window.location.href).toString();
}

const DEFAULT_AFTER_LOGIN = 'app.html';

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  btn.disabled = true;

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const emailRedirectToUrl = new URL(page('login.html'));
  emailRedirectToUrl.searchParams.set('next', DEFAULT_AFTER_LOGIN);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: emailRedirectToUrl.toString(),
    },
  });

  if (error) {
    msg.textContent = '❌ ' + error.message;
    btn.disabled = false;
    return;
  }

  const hasSession = !!data?.session;

  if (hasSession) {
    window.location.assign(page(DEFAULT_AFTER_LOGIN));
    return;
  }

  msg.textContent =
    '✅ Conta criada! Verifique seu e-mail para confirmar e depois você será redirecionado ao sistema.';
  btn.disabled = false;
});
