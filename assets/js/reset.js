import { supabase } from './supabaseClient.js';

const msgEl = document.getElementById('msg');
const form = document.getElementById('reset-form');

function setMsg(type, html) {
  msgEl.className = `alert alert-${type}`;
  msgEl.innerHTML = html;
  msgEl.classList.remove('d-none');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const p1 = document.getElementById('new-pass').value;
  const p2 = document.getElementById('new-pass2').value;

  if (p1 !== p2) {
    setMsg('danger', '❌ As senhas não conferem.');
    return;
  }

  try {
    const { error } = await supabase.auth.updateUser({ password: p1 });

    if (error) {
      setMsg('danger', `❌ Falha ao atualizar senha: <b>${error.message}</b>`);
      return;
    }

    setMsg(
      'success',
      '✅ Senha atualizada! Agora você pode entrar com a nova senha.'
    );

    // Opcional: sai e volta pro login
    await supabase.auth.signOut();
    setTimeout(() => {
      const url = new URL('./login.html', window.location.href);
      window.location.assign(url.toString());
    }, 900);
  } catch (err) {
    setMsg('danger', `❌ Erro inesperado: <b>${err?.message || err}</b>`);
  }
});
