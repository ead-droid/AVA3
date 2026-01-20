import { supabase } from "./supabaseClient.js";

/**
 * CONTACT.JS - Versão Corrigida (Alinhada com contact.html)
 */

const $ = (id) => document.getElementById(id);

const els = {
  // Elementos do Formulário (IDs revisados conforme contact.html)
  form: $("formContact"),
  name: $("contact_name"),
  email: $("contact_email"),
  subject: $("contact_subject"),
  message: $("contact_message"),
  btnSend: $("btnSendContact"),
  alert: $("contactAlert"),

  // Canais de Atendimento (IDs revisados)
  addr: $("site_address"),
  emailSup: $("site_email_support"),
  emailCom: $("site_email_commercial"),
  whatsapp: $("site_whatsapp"),
  map: $("site_map"),

  // Meus Atendimentos (IDs revisados)
  btnRefresh: $("btnRefreshTickets"),
  ticketsLoading: $("tickets_loading"),
  ticketsEmpty: $("tickets_empty"),
  ticketsList: $("tickets_accordion"),
  ticketsAlert: $("tickets_alert")
};

// --- FUNÇÕES AUXILIARES ---

function safeText(el, value, fallback = "—") {
  if (!el) return;
  el.textContent = (value && String(value).trim()) ? String(value) : fallback;
}

function safeHrefEmail(el, value) {
  if (!el) return;
  const v = (value || "").trim();
  el.textContent = v || "—";
  el.href = v ? `mailto:${v}` : "#";
}

function makeTicketStatusPill(status) {
  const s = (status || "aberto").toLowerCase();
  let cls = "bg-secondary text-white";
  let label = s.toUpperCase();

  if (s === "aberto") { cls = "bg-primary text-white"; label = "ABERTO"; }
  else if (s === "respondido") { cls = "bg-success text-white"; label = "RESPONDIDO"; }
  else if (s === "em_andamento" || s === "em análise") { cls = "bg-warning text-dark"; label = "EM ANÁLISE"; }
  else if (s === "fechado" || s === "encerrado") { cls = "bg-secondary text-white"; label = "FECHADO"; }

  return `<span class="badge rounded-pill ${cls}" style="font-size: 0.7rem;">${label}</span>`;
}

// --- LÓGICA PRINCIPAL ---

async function requireSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

async function loadMe(session) {
  const u = session.user;
  // Tenta pegar nome do perfil primeiro
  const { data: profile } = await supabase.from('profiles').select('name').eq('id', u.id).maybeSingle();
  
  const nm = profile?.name || u.user_metadata?.full_name || "";
  const em = u.email || "";

  if (els.name) els.name.value = nm;
  if (els.email) els.email.value = em;
}

async function loadSiteConfig() {
  try {
    // Busca na tabela site_config
    const { data, error } = await supabase
      .from("site_config")
      .select("address, email_support, email_commercial, whatsapp, map_url")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    // Preenche Endereço e Emails
    safeText(els.addr, data?.address, "Endereço não configurado");
    safeHrefEmail(els.emailSup, data?.email_support);
    safeHrefEmail(els.emailCom, data?.email_commercial);

    // Preenche WhatsApp
    if (els.whatsapp) {
        if (data?.whatsapp) {
            els.whatsapp.textContent = data.whatsapp;
            const nums = data.whatsapp.replace(/\D/g, "");
            els.whatsapp.href = `https://wa.me/55${nums}`;
            els.whatsapp.target = "_blank";
        } else {
            els.whatsapp.textContent = "—";
            els.whatsapp.href = "#";
        }
    }

    // Preenche Mapa
    if (els.map) {
        let src = (data?.map_url || "").trim();
        // Limpeza básica se o usuário colou o iframe inteiro no admin
        if (src.includes("<iframe") || src.includes("src=")) {
            const m = src.match(/src\s*=\s*"([^"]+)"/i);
            src = m ? m[1] : "";
        }
        els.map.src = src || "about:blank";
    }

  } catch (err) {
    console.warn("Erro ao carregar canais:", err);
    safeText(els.addr, "Erro ao carregar dados.");
  }
}

async function insertMessage(session) {
  const payload = {
    user_id: session.user.id,
    name: (els.name?.value || "").trim(),
    email: (els.email?.value || "").trim(),
    subject: (els.subject?.value || "Outros").trim(),
    message: (els.message?.value || "").trim(),
    status: "aberto",
  };

  if (!payload.message) {
    alert("Por favor, digite sua mensagem.");
    return;
  }

  const btn = els.btnSend;
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Enviando...`;

  try {
    const { error } = await supabase.from("contact_messages").insert(payload);
    if (error) throw error;

    alert("Mensagem enviada com sucesso! Acompanhe a resposta abaixo.");
    if (els.message) els.message.value = ""; // Limpa campo
    await loadMyTickets(session); // Atualiza lista imediatamente

  } catch (err) {
    console.error(err);
    alert("Erro ao enviar: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

async function loadMyTickets(session) {
  if (els.ticketsLoading) els.ticketsLoading.classList.remove("d-none"); // Mostra loading
  if (els.ticketsEmpty) els.ticketsEmpty.style.display = "none";
  if (els.ticketsList) els.ticketsList.innerHTML = "";

  try {
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*") 
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Esconde loading
    if (els.ticketsLoading) els.ticketsLoading.classList.add("d-none");

    if (!data || data.length === 0) {
      if (els.ticketsEmpty) els.ticketsEmpty.style.display = "block";
      return;
    }

    // Renderiza cada ticket
    data.forEach((t, index) => {
        const dateStr = new Date(t.created_at).toLocaleDateString('pt-BR');
        
        // Verifica se tem resposta do admin
        const replyHtml = t.admin_reply 
            ? `<div class="mt-3 p-3 bg-primary bg-opacity-10 border border-primary rounded">
                 <strong class="text-primary d-block mb-1 text-uppercase small"><i class='bx bx-support'></i> Resposta do Suporte:</strong>
                 <span class="text-dark" style="white-space: pre-wrap;">${t.admin_reply}</span>
               </div>`
            : `<div class="mt-2 text-muted small fst-italic"><i class='bx bx-time'></i> Aguardando resposta da equipe...</div>`;

        const collapseId = `ticketCollapse${index}`;
        const headingId = `ticketHeading${index}`;
        
        const item = document.createElement("div");
        item.className = "accordion-item border mb-2 rounded overflow-hidden shadow-sm";
        item.innerHTML = `
            <h2 class="accordion-header" id="${headingId}">
                <button class="accordion-button collapsed bg-white py-3" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false" aria-controls="${collapseId}">
                    <div class="d-flex w-100 justify-content-between align-items-center pe-3">
                        <div>
                            <div class="fw-bold text-dark">${t.subject || 'Sem Assunto'}</div>
                            <small class="text-muted">${dateStr}</small>
                        </div>
                        ${makeTicketStatusPill(t.status)}
                    </div>
                </button>
            </h2>
            <div id="${collapseId}" class="accordion-collapse collapse" aria-labelledby="${headingId}" data-bs-parent="#tickets_accordion">
                <div class="accordion-body bg-light">
                    <div class="p-3 bg-white border rounded mb-2">
                        <strong class="d-block text-muted small text-uppercase mb-1">Sua Mensagem:</strong>
                        <div style="white-space: pre-wrap;">${t.message}</div>
                    </div>
                    ${replyHtml}
                </div>
            </div>
        `;
        els.ticketsList.appendChild(item);
    });

  } catch (err) {
    console.warn("Erro ao listar tickets:", err);
    if (els.ticketsLoading) els.ticketsLoading.classList.add("d-none");
  }
}

// --- BOOT ---
async function boot() {
  const session = await requireSession();
  if (!session) return;

  // Carrega tudo em paralelo para ser mais rápido
  await Promise.all([
      loadMe(session),
      loadSiteConfig(),
      loadMyTickets(session)
  ]);

  // Listeners
  if (els.form) {
    els.form.addEventListener("submit", (e) => {
      e.preventDefault();
      insertMessage(session);
    });
  }

  if (els.btnRefresh) {
    els.btnRefresh.addEventListener("click", () => {
      loadMyTickets(session);
    });
  }
}

boot();