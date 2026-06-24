/**
 * Proteção global de rotas via token do pbxapi (substitui o middleware do
 * @nuxtjs/supabase). Rotas públicas não exigem token; nas demais, sem token
 * redireciona pro /login. Carrega o usuário se ainda não estiver em memória.
 */
const PUBLIC_ROUTES = ['/login']

export default defineNuxtRouteMiddleware(async (to) => {
  const { token, user, fetchUser } = useAuth()
  const isPublic = PUBLIC_ROUTES.includes(to.path)

  if (!token.value) {
    return isPublic ? undefined : navigateTo('/login')
  }

  // Tem token: garante o usuário carregado (valida o token de quebra).
  if (!user.value) {
    await fetchUser()
    if (!token.value && !isPublic) return navigateTo('/login')
  }

  // Já logado tentando ir pro login → manda pra home.
  if (isPublic && token.value && user.value) {
    return navigateTo('/')
  }
})
