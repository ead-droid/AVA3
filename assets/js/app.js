// assets/js/app.js
import { supabaseHealthCheck } from './supabaseClient.js';

const statusEl = document.getElementById('status');

async function main() {
  try {
    const r = await supabaseHealthCheck();

    if (!r.ok) {
      statusEl.innerHTML = `❌ Erro no Supabase: <code>${r.error}</code>`;
      return;
    }

    statusEl.textContent = r.hasSession
      ? '✅ Supabase OK (sessão encontrada).'
      : '✅ Supabase OK (sem sessão — normal).';
  } catch (e) {
    console.error(e);
    statusEl.innerHTML = `❌ Erro inesperado: <code>${e?.message || e}</code>`;
  }
}

main();
