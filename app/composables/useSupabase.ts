import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// O Supabase deixou de ser um módulo Nuxt e virou apenas a FONTE DE DADOS do
// roadmap/admin (itens, reações, comentários, Storage). A diferença importa:
//
// - o módulo `@nuxtjs/supabase` registrava um plugin GLOBAL que instancia o client
//   no boot. Sem as envs, esse plugin estoura (`supabaseUrl is required`) e derruba
//   o portal INTEIRO — login, relatório, clientes. Aqui o client é preguiçoso: se as
//   envs não existirem, `useSupabaseClient()` devolve null e só o roadmap degrada.
// - o módulo também instalava um middleware que redireciona para /login quem não tem
//   sessão Supabase. Como agora ninguém tem (o login é do pbx), ele brigaria com o
//   `middleware/auth.global.ts`.
//
// Autenticação é do pbx. Este client fala com o Supabase como `anon`.
let client: SupabaseClient | null = null

/** Client do roadmap. `null` quando SUPABASE_URL/KEY não estão configuradas. */
export function useSupabaseClient(): SupabaseClient | null {
  const { supabaseUrl, supabaseKey } = useRuntimeConfig().public
  if (!supabaseUrl || !supabaseKey) return null

  client ??= createClient(supabaseUrl, supabaseKey, {
    // Sem sessão Supabase: nada de persistir/renovar token no browser.
    auth: { persistSession: false, autoRefreshToken: false }
  })
  return client
}

/** Identidade usada pelo roadmap. Hoje é o usuário do pbx (`GET /users/me`). */
export function useSupabaseUser() {
  const { user } = useAuth()
  return computed(() => (user.value ? { id: user.value.uuid, email: user.value.email } : null))
}
