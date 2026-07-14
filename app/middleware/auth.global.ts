const PUBLIC_ROUTES = ['/login']

export default defineNuxtRouteMiddleware(async (to) => {
  const { token, user, fetchUser } = useAuth()
  const isPublic = PUBLIC_ROUTES.includes(to.path)

  if (!token.value) {
    return isPublic ? undefined : navigateTo('/login')
  }

  if (!user.value) {
    await fetchUser()
    if (!token.value && !isPublic) return navigateTo('/login')
  }

  if (isPublic && token.value && user.value) {
    return navigateTo('/')
  }
})
