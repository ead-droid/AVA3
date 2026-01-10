// assets/js/login.js
import { supabase } from './supabaseClient.js';

const form = document.getElementById('formLogin');
const msg = document.getElementById('msg');
const btn = document.getElementById('btnLogin');

function safeReturnTo() {
  const u = new URL(window.location.href);
  const returnTo = u.searchParams.get('returnTo');

  // Só aceita redireciono para dentro do mesmo site
  if (!returnTo) return './app.html';

  try {
    const candidate = new URL(returnTo, window.location.origin);
    if (candidate.origin !== window.location.origin) return './app.html';
    return candidate.pathname + candidate.search;
  } catch {
    return './app.html';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  btn.disabled = true;

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    msg.textContent = '❌ ' + error.message;
    btn.disabled = false;
    return;
  }

  // ✅ logou -> vai para app (ou returnTo)
  window.location.assign(safeReturnTo());
});
