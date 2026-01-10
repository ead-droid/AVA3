// assets/js/app.js
import { getSessionSafe, getUserDisplayName } from './supabaseClient.js';

const userBadge = document.getElementById('userBadge');
const logsEl = document.getElementById('logs');

function log(msg) {
  if (!logsEl) return;
  logsEl.style.display = 'block';
  logsEl.textContent += msg + '\n';
}

async function main() {
  log('[APP] Carregando sessão...');
  const { session, error } = await getSessionSafe();

  if (error) {
    userBadge.textContent = '❌ Erro: ' + error;
    log('[ERR] ' + error);
    return;
  }

  if (!session) {
    // Em tese, layout.js já redireciona antes disso
    userBadge.textContent = '⚠️ Sem sessão';
    log('[WARN] Sem sessão');
    return;
  }

  const name = getUserDisplayName(session);
  userBadge.textContent = `✅ Sessão ativa: ${name}`;
  log('[OK] Sessão ativa');
}

main();
