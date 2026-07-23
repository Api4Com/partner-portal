/**
 * Resolve se o usuário atual é admin do roadmap via BFF (`GET /roadmap/me/is-admin`).
 * A decisão é a mesma allowlist que barra as rotas de admin — uma fonte só.
 * Compartilhado (key 'is-admin') entre a sidebar e a página /admin.
 */
export function useIsAdmin() {
  const { user, bffFetch } = useAuth()

  return useAsyncData('is-admin', async () => {
    if (!user.value) return false
    try {
      // skipDemo: is-admin é resolvido de verdade também em conta demo (como era no
      // Supabase). Sem isto o `demoFetch` estouraria "rota não mockada". [DEMO CRMs]
      const { isAdmin } = await bffFetch<{ isAdmin: boolean }>('/roadmap/me/is-admin', { skipDemo: true })
      return isAdmin
    } catch {
      return false
    }
  }, {
    // Resolve no cliente (sessão garantida) e reavalia quando o usuário entra/sai —
    // evita cachear `false` quando o SSR roda antes da sessão existir.
    server: false,
    default: () => false,
    watch: [user]
  })
}
