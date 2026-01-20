import { supabase } from './supabaseClient.js';

const $ = (id) => document.getElementById(id);

/**
 * Resolve URLs SEM quebrar quando o site estiver em subpasta
 * Ex.: https://dominio.com/AVA3/login.html -> page('app.html') = https://dominio.com/AVA3/app.html
 */
function page(filename) {
  return new URL(`./${filename}`, window.location.href).toString();
}

/**
 * Sanitiza o "next" para evitar valores estranhos.
 * Mantém simples: só aceita arquivos .html (com ou sem subpasta relativa).
 */
function getNext() {
  const params = new URLSearchParams(window.location.search);
  const raw = (params.get('next') || '').trim();
  if (!raw) return null;

  // bloqueia protocolos
  if (raw.includes('://') || raw.startsWith('//')) return null;

  // aceita algo como "app.html" ou "pasta/app.html"
  if (!/^[a-zA-Z0-9/_-]+\.html$/.test(raw)) return null;

  return raw;
}

const DEFAULT_AFTER_LOGIN = 'app.html';
const AFTER_LOGIN = getNext() || DEFAULT_AFTER_LOGIN;

/**
 * Se a pessoa já está logada (ex.: acabou de confirmar o e-mail e voltou com tokens),
 * manda direto para o app.
 */
(async function autoRedirectIfSession() {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session?.user) return;

    // Fallback: se profile.name estiver errado (igual ao email), corrige a partir do user_metadata
    await ensureProfileName(session.user);

    window.location.assign(page(AFTER_LOGIN));
  } catch (_) {
    // silencioso: não quebra tela de login
  }
})();

/**
 * Garante que profiles.name não fique igual ao email (fallback extra no front).
 * Isso ajuda a corrigir usuários antigos mesmo antes do backfill.
 */
async function ensureProfileName(user) {
  const meta = user?.user_metadata || {};
  const desired =
    (meta.full_name || meta.name || meta.nome || meta.display_name || '').trim();

  if (!desired) return;

  // lê o profile atual
  const { data: prof, error: selErr } = await supabase
    .from('profiles')
    .select('name,email')
    .eq('id', user.id)
    .maybeSingle();

  if (selErr || !prof) return;

  const currentName = (prof.name || '').trim();
  const currentEmail = (prof.email || user.email || '').trim();

  // só corrige se estiver vazio ou igual ao email
  if (!currentName || (currentEmail && currentName === currentEmail)) {
    await supabase.from('profiles').update({ name: desired }).eq('id', user.id);
  }
}

// --- LOGIN ---
$('form-login')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg();

  const email = $('login-email').value.trim();
  const password = $('login-pass').value;
  const btn = $('btn-login-submit');

  btn.disabled = true;
  btn.innerText = 'Entrando...';

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    btn.disabled = false;
    btn.innerText = 'Entrar';
    return showMsg('error', 'Erro: ' + error.message);
  }

  // fallback extra para corrigir name no profile após login
  if (data?.user) {
    await ensureProfileName(data.user);
  }

  showMsg('success', 'Login realizado! Redirecionando...');
  setTimeout(() => {
    window.location.assign(page(AFTER_LOGIN));
  }, 600);
});

// --- CADASTRO ---
$('form-signup')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg();

  const name = $('signup-name').value.trim();
  const email = $('signup-email').value.trim();
  const password = $('signup-pass').value;
  const btn = $('btn-signup-submit');

  if (name.length < 3) return showMsg('error', 'Digite seu nome completo.');

  btn.disabled = true;
  btn.innerText = 'Criando conta...';

  /**
   * ✅ IMPORTANTE:
   * O redirect do e-mail volta para o login.html (que existe),
   * e o autoRedirectIfSession() manda para app.html depois da confirmação.
   */
  const emailRedirectToUrl = new URL(page('login.html'));
  emailRedirectToUrl.searchParams.set('next', AFTER_LOGIN);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: emailRedirectToUrl.toString(),
    },
  });

  if (error) {
    btn.disabled = false;
    btn.innerText = 'Cadastrar';
    return showMsg('error', error.message);
  }

  // Se a confirmação de e-mail estiver DESLIGADA, já entra com sessão e dá para corrigir profile agora
  if (data?.session && data?.user) {
    await supabase.from('profiles').update({ name: name }).eq('id', data.user.id);
    window.location.assign(page(AFTER_LOGIN));
    return;
  }

  btn.disabled = false;
  btn.innerText = 'Cadastrar';
  showMsg('success', '✅ Conta criada! Verifique seu e-mail (inclusive SPAM) para confirmar o acesso.');
  e.target.reset();
});

// --- ESQUECI SENHA ---
$('act-forgot')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('section-login').style.display = 'none';
  document.getElementById('section-forgot').style.display = 'block';
});

$('form-forgot')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('forgot-email').value.trim();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: page('reset.html'),
  });

  if (error) showMsg('error', error.message);
  else showMsg('success', 'Link enviado para o e-mail.');
});

// Helper
function showMsg(type, text) {
  const el = $('msg');
  if (!type) {
    el.className = 'alert d-none';
    return;
  }
  el.className = `alert alert-${type}`;
  el.innerText = text;
  el.classList.remove('d-none');
}
