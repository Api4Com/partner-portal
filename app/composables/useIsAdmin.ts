/**
 * Resolve se o usuário atual é admin via RPC `roadmap_is_admin`.
 * Compartilhado (key 'is-admin') entre a sidebar e a página /admin.
 */
export function useIsAdmin() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()

  return useAsyncData('is-admin', async () => {
    if (!user.value) return false
    const { data } = await (supabase as any).rpc('roadmap_is_admin')
    return data === true
  }, {
    // Resolve no cliente (sessão garantida) e reavalia quando o usuário entra/sai —
    // evita cachear `false` quando o SSR roda antes da sessão existir.
    server: false,
    default: () => false,
    watch: [user]
  })
}
