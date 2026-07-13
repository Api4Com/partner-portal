// Login/logout passam pelo bff-portal → pbxapi. O access token é um token OPACO
// de sessão do pbx (não é JWT: não tem claims, não dá para decodificar e não há
// refresh). O usuário atual vem de GET /users/me; o escopo das subcontas é
// derivado no BFF a cada request.
export interface PbxUser {
  uuid: string
  name?: string
  email: string
  phone?: string
  role?: string
  status?: string
  organizationId?: string
}

// POST /users/login → sessão opaca do pbx (403 = conta não é parceira).
interface LoginResponse {
  accessToken: string
  ttl?: number
  created?: string
}

export function useAuth() {
  const cookieOpts = {
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    // Em produção o token só trafega por HTTPS; em dev (http://localhost) `secure`
    // impediria o cookie de ser gravado.
    secure: !import.meta.dev
  }
  const accessToken = useCookie<string | null>('access_token', cookieOpts)
  const user = useState<PbxUser | null>('auth-user', () => null)

  const bffBase = useRuntimeConfig().public.bffBase

  function clearSession() {
    accessToken.value = null
    user.value = null
  }

  async function login(email: string, password: string) {
    const { accessToken: token } = await $fetch<LoginResponse>('/users/login', {
      baseURL: bffBase,
      method: 'POST',
      body: { email, password }
    })
    accessToken.value = token
    await fetchUser()
  }

  // Única fonte do usuário logado: GET /users/me com o Bearer da sessão.
  async function fetchUser(): Promise<PbxUser | null> {
    if (!accessToken.value) {
      user.value = null
      return null
    }
    try {
      user.value = await $fetch<PbxUser>('/users/me', {
        baseURL: bffBase,
        headers: { Authorization: `Bearer ${accessToken.value}` }
      })
    } catch {
      // Token inválido/expirado: sem refresh, a sessão simplesmente cai.
      clearSession()
    }
    return user.value
  }

  async function logout() {
    try {
      await $fetch('/users/logout', {
        baseURL: bffBase,
        method: 'POST',
        headers: accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {}
      })
    } catch {
      // ignorado: o logout local abaixo é o que importa para o cliente.
    }
    clearSession()
  }

  // Em 401 a sessão acabou (não há refresh): limpa e manda para o /login.
  async function bffFetch<T>(path: string, opts: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    try {
      // O cast é necessário: `$fetch<T>` devolve `TypedInternalResponse<…, T>`, que o
      // TS não consegue provar ser `T` quando `T` é um genérico do chamador (ele pode
      // ser instanciado com qualquer coisa). Aqui as rotas são do BFF, não do Nitro —
      // não há tipagem interna a inferir, então `T` é o contrato de fato.
      return await $fetch<T>(path, {
        baseURL: bffBase,
        ...opts,
        headers: {
          ...(opts.headers as Record<string, string> | undefined),
          ...(accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {})
        }
      }) as T
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 401) {
        clearSession()
        await navigateTo('/login')
      }
      throw err
    }
  }

  return { token: accessToken, user, login, fetchUser, logout, bffFetch }
}
