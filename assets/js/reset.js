import { supabase } from "./supabaseClient.js";

const $ = (id) => document.getElementById(id);
const form = $("form-reset");
const msg = $("msg");
const btn = $("btn-reset");

// Mostra mensagens simples
function showMsg(type, text) {
  msg.className = `alert alert-${type}`;
  msg.innerText = text;
  msg.classList.remove("d-none");
}

// Ao carregar, verificar se há sessão temporária (token do link)
window.addEventListener("load", async () => {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data?.session) {
    showMsg("error", "Sessão inválida ou expirada. Solicite novo link de redefinição.");
    form.style.display = "none";
    return;
  }

  showMsg("success", "Sessão validada! Você pode redefinir sua senha abaixo.");
});

// Submeter nova senha
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showMsg();
  btn.disabled = true;
  btn.innerText = "Atualizando...";

  const newPassword = $("new-pass").value.trim();

  if (newPassword.length < 6) {
    showMsg("error", "A senha deve ter pelo menos 6 caracteres.");
    btn.disabled = false;
    btn.innerText = "Atualizar Senha";
    return;
  }

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    showMsg("error", "Erro: " + error.message);
    btn.disabled = false;
    btn.innerText = "Atualizar Senha";
    return;
  }

  showMsg("success", "✅ Senha redefinida com sucesso! Redirecionando para o login...");
  setTimeout(() => {
    window.location.assign("login.html");
  }, 1500);
});
