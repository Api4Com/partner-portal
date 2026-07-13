// TODO: gating de admin vivia no Supabase. Sem fonte equivalente ainda, retorna
// sempre false; reimplementar via `role` do usuário de GET /users/me (useAuth).
export function useIsAdmin() {
  return useAsyncData('is-admin', async () => false)
}
