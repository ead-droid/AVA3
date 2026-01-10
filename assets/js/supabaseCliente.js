// assets/js/supabaseClient.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// vem do seu config.js (que fica público no GitHub Pages)
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '⚠️ SUPABASE_URL ou SUPABASE_ANON_KEY não estão preenchidos no assets/js/config.js'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // útil caso você use login por link/OAuth depois
  },
});

/**
 * Teste simples: verifica se a lib está OK e se o auth responde.
 * Não depende de tabelas/RLS ainda.
 */
export async function supabaseHealthCheck() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    return {
      ok: true,
      hasSession: !!data?.session,
      user: data?.session?.user?.email || null,
    };
  } catch (e) {
    return {
      ok: false,
      error: e?.message || String(e),
    };
  }
}
