import { supabase } from "./supabaseClient.js";

/**
 * CONTACT.JS - Versão Corrigida e Integrada
 */

const $ = (id) => document.getElementById(id);

const els = {
  // Elementos do Formulário (IDs sincronizados com contact.html)
  form: $("formContact"),
  name: $("contact_name"),
  email: $("contact_email"),
  subject: $("contact_subject"),
  message: $("contact_message"),
  btnSend: $("btnSendMsg"), // Alterado de btnSendContact para btnSendMsg conforme seu HTML
  loader: $("config-loader"),

  // Canais de Atendimento
  addr: $("site_address"),
  emailSup: $("site_email_support"),
  emailCom: $("site_email_commercial"),
  whatsapp: $("site_whatsapp_link"),
  map: $("site_map"),

  // Histórico
  btnRefresh: $("btnRefreshTickets"),
  ticketsLoading: $("tickets_loading"),
  ticketsEmpty: $("tickets_empty"),
  ticketsList: $("tickets_accordion")
};

// --- FUNÇÕES DE INTERFACE ---

function hideLoader() {
  if (els.loader) {
    els.loader.classList.add("d-none"); // Remove o "carregando" da tela
  }
}

function makeTicketStatusPill(status) {
  const s = (status || "aberto").toLowerCase();
  let cls = "bg-secondary text-white";
  if (s === "aberto") cls = "bg-primary text-white";
  else if (s === "respondido") cls = "bg-success text-white";
  else if (s === "em_andamento") cls = "bg-warning text-dark";
  return `<span class="badge rounded-pill ${cls}" style="font-size: 0.7rem;">${s.toUpperCase()}</span>`;
}

// --- LÓGICA DE DADOS ---

async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

async function loadMe(session) {
  const u = session.user;
  const { data: profile } = await supabase.from('profiles').select('name').eq('id', u.id).maybeSingle();
  if (els.name) els.name.value = profile?.name || u.user_metadata?.full_name || "";
  if (els.email) els.email.value = u.email || "";
}

async function loadSiteConfig() {
  try {
    const { data, error } = await supabase
      .from("site_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      if (els.addr) els.addr.textContent = data.address || "Endereço não informado";
      if (els.emailSup) els.emailSup.textContent = data.email_support || "---";
      if (els.emailCom) els.emailCom.textContent = data.email_commercial || "---";
      
      if (els.whatsapp && data.whatsapp) {
        const nums = data.whatsapp.replace(/\D/g, "");
        els.whatsapp.href = `https://wa.me/55${nums}`;
        els.whatsapp.innerHTML = `<span class="text-dark fw-bold">${data.whatsapp}</span>`;
      }

      if (els.map && data.map_url) {
        els.map.src = data.map_url;
      }
    }
  } catch (err) {
    console.error("Erro ao carregar canais:", err);
  } finally {
    hideLoader(); // Garante que o spinner suma mesmo se houver erro
  }
}

async function insertMessage(session) {
  const payload = {
    user_id: session.user.id,
    name: els.name.value,
    email: els.email.value,
    subject: els.subject.value,
    message: els.message.value.trim(),
    status: "aberto"
  };

  if (!payload.message) {
    alert("Por favor, descreva sua solicitação.");
    return;
  }

  const btn = els.btnSend;
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Enviando...`;

  try {
    const { error } = await supabase.from("contact_messages").insert(payload);
    if (error) throw error;

    alert("Mensagem enviada com sucesso!");
    els.message.value = "";
    await loadMyTickets(session);
  } catch (err) {
    alert("Erro ao enviar: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function loadMyTickets(session) {
  if (els.ticketsLoading) els.ticketsLoading.style.display = "block";
  if (els.ticketsEmpty) els.ticketsEmpty.style.display = "none";
  if (els.ticketsList) els.ticketsList.innerHTML = "";

  try {
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (els.ticketsLoading) els.ticketsLoading.style.display = "none";

    if (!data || data.length === 0) {
      if (els.ticketsEmpty) els.ticketsEmpty.style.display = "block";
      return;
    }

    data.forEach((t, index) => {
      const dateStr = new Date(t.created_at).toLocaleDateString('pt-BR');
      const collapseId = `ticket${index}`;
      
      const replyHtml = t.admin_reply 
        ? `<div class="mt-3 p-3 bg-primary bg-opacity-10 border border-primary rounded">
             <strong class="text-primary d-block mb-1 small text-uppercase">Resposta do Suporte:</strong>
             <div class="text-dark">${t.admin_reply}</div>
           </div>`
        : `<div class="mt-2 text-muted small fst-italic">Aguardando resposta...</div>`;

      const item = document.createElement("div");
      item.className = "accordion-item border rounded mb-2 overflow-hidden shadow-sm";
      item.innerHTML = `
        <h2 class="accordion-header">
          <button class="accordion-button collapsed bg-white" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
            <div class="d-flex w-100 justify-content-between align-items-center pe-3">
              <div>
                <div class="fw-bold text-dark">${t.subject}</div>
                <small class="text-muted">${dateStr}</small>
              </div>
              ${makeTicketStatusPill(t.status)}
            </div>
          </button>
        </h2>
        <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#tickets_accordion">
          <div class="accordion-body bg-light">
            <div class="p-3 bg-white border rounded">
              <small class="text-uppercase fw-bold text-muted d-block mb-1" style="font-size:0.7rem;">Sua Mensagem</small>
              ${t.message}
            </div>
            ${replyHtml}
          </div>
        </div>
      `;
      els.ticketsList.appendChild(item);
    });
  } catch (err) {
    console.error("Erro ao carregar histórico:", err);
  }
}

// --- INICIALIZAÇÃO ---

async function boot() {
  const session = await requireSession();
  if (!session) return;

  await loadMe(session);
  await loadSiteConfig();
  await loadMyTickets(session);

  if (els.form) {
    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      insertMessage(session);
    });
  }

  if (els.btnRefresh) {
    els.btnRefresh.onclick = () => loadMyTickets(session);
  }
}

boot();