/**
 * Resolve se o usuário atual é admin.
 *
 * TODO: o gating de admin vivia no Supabase (RPC `roadmap_is_admin`). Com a saída
 * do Supabase, ainda não há fonte para isso — por ora retorna sempre false.
 * Reimplementar quando houver endpoint de permissão (ex: role do /users/me).
 */
export function useIsAdmin() {
  return useAsyncData('is-admin', async () => false)
}
