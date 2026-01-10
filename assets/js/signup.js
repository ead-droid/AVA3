// assets/js/signup.js
import { supabase } from './supabaseClient.js';
import { goTo } from './router.js';

const form = document.getElementById('form-signup');
const nameEl = document.getElementById('full_name');
const emailEl = document.getElementById('email');
const passEl = document.getElementById('password');
const msgEl = document.getElementById('msg');
const btn = document.getElementById('btn-signup');

function setMsg(text, type = 'info') {
  msgEl.className = `msg ${type}`;
  msgEl.textContent = text || '';
}

async function boot() {
  // Se já tem sessão, não precisa ficar no cadastro
  const { data } = await supabase.auth.getSession();
  if (data?.session) goTo('app.html');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('');

  const full_name = (nameEl.value || '').trim();
  const email = (emailEl.value || '').trim();
  const password = passEl.value || '';

  if (!full_name) {
    setMsg('Informe seu nome completo.', 'err');
    return;
  }
  if (!email || !password) {
    setMsg('Preencha e-mail e senha.', 'err');
    return;
  }
  if (password.length < 8) {
    setMsg('A senha precisa ter pelo menos 8 caracteres.', 'err');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Criando...';

  try {
    // 1) cria o usuário no Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // coloca nome no metadata (não depende do banco)
        data: { full_name },
      },
    });

    if (error) {
      setMsg(`Erro: ${error.message}`, 'err');
      return;
    }

    // 2) Se o Supabase exigir confirmação de e-mail, session vem null.
    //    Neste caso, avisa e manda pro login.
    const session = data?.session;

    if (!session) {
      setMsg(
        'Conta criada! Agora confirme seu e-mail (verifique a caixa de entrada e spam). Depois volte e faça login.',
        'ok'
      );
      // Não redireciona automático para não confundir
      return;
    }

    // 3) Se já logou automaticamente, vai pro app
    setMsg('Conta criada! Indo para o App...', 'ok');
    goTo('app.html');
  } catch (err) {
    console.error(err);
    setMsg(`Erro inesperado: ${err?.message || err}`, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Criar conta';
  }
});

boot();
