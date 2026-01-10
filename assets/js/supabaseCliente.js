// assets/js/supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// ✅ Cliente único do Supabase (front-end / GitHub Pages)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true, // mantém logado (localStorage)
    autoRefreshToken: true, // renova token automaticamente
    detectSessionInUrl: true, // captura sessão quando voltar de login por link/oauth
  },
});

// (Opcional) ajuda no debug pelo Console do navegador:
window.supabase = supabase;

/**
 * Healthcheck simples (não depende de tabelas)
 * - Se retornar ok:true, significa que o client foi criado e o auth responde.
 */
export async function supabaseHealthcheck() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;

    return {
      ok: true,
      hasSession: !!data?.session,
      user: data?.session?.user
        ? {
            id: data.session.user.id,
            email: data.session.user.email,
          }
        : null,
    };
  } catch (e) {
    return { ok: false, message: e?.message || String(e) };
  }
}
