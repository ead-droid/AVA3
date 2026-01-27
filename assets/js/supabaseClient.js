// assets/js/supabaseClient.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
            autoRefreshToken: true,
                detectSessionInUrl: true,
                  },
})

/**
 * Health check simples para o front:
 * - valida que o client consegue conversar com o Supabase Auth
 * - NÃO depende de permissões de tabelas (RLS) para funcionar em página pública
 */
export async function supabaseHealthCheck() {
  try {
    const { error } = await supabase.auth.getSession();
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function getSessionSafe() {
  const { data, error } = await supabase.auth.getSession();
  if (error) return { session: null, error: error.message };
  return { session: data?.session || null, error: null };
}

export function getUserDisplayName(session) {
  if (!session?.user) return '';
  const u = session.user;

  // tenta nome primeiro (mais interessante)
  const meta = u.user_metadata || {};
  const name =
    meta.full_name || meta.name || meta.nome || meta.display_name || '';

  return name && String(name).trim() ? String(name).trim() : u.email || '';
}
