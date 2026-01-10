// assets/js/home.js
import { getSessionSafe } from './supabaseClient.js';

const badge = document.getElementById('statusBadge');
const logsEl = document.getElementById('logs');

function log(msg) {
  if (!logsEl) return;
  logsEl.style.display = 'block';
  logsEl.textContent += msg + '\n';
}

async function main() {
  log('[HOME] Iniciando...');
  const { session, error } = await getSessionSafe();

  if (error) {
    badge.textContent = '❌ Erro na sessão';
    log('[ERR] ' + error);
    return;
  }

  if (session) {
    badge.textContent = '✅ Logado(a)';
    log('[OK] Sessão ativa');
  } else {
    badge.textContent = '✅ Público (sem login)';
    log('[OK] Sem sessão (normal)');
  }
}

main();
