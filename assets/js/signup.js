// assets/js/signup.js
import { supabase } from './supabaseClient.js';

const form = document.getElementById('formSignup');
const msg = document.getElementById('msg');
const btn = document.getElementById('btnSignup');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  btn.disabled = true;

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name, // ✅ isso alimenta o nome no menu
      },
    },
  });

  if (error) {
    msg.textContent = '❌ ' + error.message;
    btn.disabled = false;
    return;
  }

  // Pode depender da configuração do Supabase:
  // - Se Email confirmation estiver ON, talvez precise confirmar.
  // - Se estiver OFF, já entra direto.
  const hasSession = !!data?.session;

  if (hasSession) {
    window.location.assign('./app.html');
    return;
  }

  msg.textContent =
    '✅ Conta criada! Verifique seu e-mail para confirmar (se a confirmação estiver ativa) e depois faça login.';
  btn.disabled = false;
});
