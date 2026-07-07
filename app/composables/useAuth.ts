// Login/signup passam pelo bff-portal → pbxapi; pós-login o portal fala direto
// com o Core. O usuário atual vem das claims do access JWT (não há /users/me).
export interface AccountContext {
  currentCustomerId?: string
  parentCustomerId?: string | null
  accountType?: 'parent' | 'child' | 'standalone'
  allowedCustomerIds?: string[]
}

export interface PbxUser {
  uuid: string
  name?: string
  email: string
  role?: string
  organizationId?: string
  accountContext?: AccountContext
}

export interface SignupPayload {
  name: string
  organizationName: string
  email: string
  password: string
  phone: string
}

// O refresh token não é mais manipulado pelo JS: o BFF o guarda num cookie
// httpOnly (setado no login) e o lê em POST /auth/refresh. O front só recebe/usa
// o access token. Por isso o login/refresh retornam apenas `{ accessToken }`.
interface AccessTokenResponse {
  accessToken: string
}

interface AccessClaims {
  sub?: string
  email?: string
  name?: string
  role?: string
  organizationId?: string
  accountContext?: AccountContext
  exp?: number
}

function decodeJwt(token: string): AccessClaims | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      Array.prototype.map
        .call(atob(b64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

function isExpired(token: string): boolean {
  const claims = decodeJwt(token)
  if (!claims || typeof claims.exp !== 'number') return true
  const clockSkewMs = 5000
  return Date.now() >= claims.exp * 1000 - clockSkewMs
}

export function useAuth() {
  const cookieOpts = { sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 7 }
  const accessToken = useCookie<string | null>('access_token', cookieOpts)
  const user = useState<PbxUser | null>('auth-user', () => null)

  const config = useRuntimeConfig().public
  const bffBase = config.bffBase
  const coreBase = config.coreBase

  function setAccessToken(token: string) {
    accessToken.value = token
  }

  function clearSession() {
    accessToken.value = null
    user.value = null
  }

  function hydrateFromToken() {
    const claims = accessToken.value ? decodeJwt(accessToken.value) : null
    if (!claims || !claims.sub || !claims.email) {
      user.value = null
      return
    }
    user.value = {
      uuid: claims.sub,
      email: claims.email,
      name: claims.name,
      role: claims.role,
      organizationId: claims.organizationId,
      accountContext: claims.accountContext
    }
  }

  async function login(email: string, password: string) {
    // `credentials: 'include'` para que o Set-Cookie httpOnly do refresh (emitido
    // pelo BFF) seja armazenado pelo browser. O front só lê/guarda o access.
    const { accessToken: token } = await $fetch<AccessTokenResponse>('/users/login', {
      baseURL: bffBase,
      method: 'POST',
      credentials: 'include',
      body: { email, password }
    })
    setAccessToken(token)
    hydrateFromToken()
  }

  // pbxapi não auto-loga no cadastro: exige verificação de e-mail antes do login.
  async function signup(payload: SignupPayload) {
    return $fetch<{ status: number, message: string }>('/accounts/signup', {
      baseURL: bffBase,
      method: 'POST',
      body: {
        name: payload.name,
        organization_name: payload.organizationName,
        email: payload.email,
        password: payload.password,
        phone: payload.phone
      }
    })
  }

  async function refresh(): Promise<boolean> {
    // O refresh token vive num cookie httpOnly gerenciado pelo BFF; o JS não o
    // acessa. `credentials: 'include'` faz o browser enviá-lo automaticamente.
    // A renovação passa pelo BFF (não mais direto no Core) e devolve só o access.
    try {
      const { accessToken: token } = await $fetch<AccessTokenResponse>('/auth/refresh', {
        baseURL: bffBase,
        method: 'POST',
        credentials: 'include'
      })
      setAccessToken(token)
      hydrateFromToken()
      return true
    } catch {
      clearSession()
      return false
    }
  }

  async function fetchUser(): Promise<PbxUser | null> {
    if (!accessToken.value) {
      user.value = null
      return null
    }
    if (isExpired(accessToken.value)) {
      const ok = await refresh()
      if (!ok) return null
    } else {
      hydrateFromToken()
    }
    return user.value
  }

  async function logout() {
    // Pede ao BFF para expirar o cookie httpOnly do refresh (best-effort);
    // `credentials: 'include'` envia o cookie para que o BFF possa limpá-lo.
    // Revogação real é por tokenVersion no Core; aqui garantimos a sessão local.
    try {
      await $fetch('/users/logout', {
        baseURL: bffBase,
        method: 'POST',
        credentials: 'include',
        headers: accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {}
      })
    } catch {
      // ignorado: o logout local abaixo é o que importa para o cliente.
    }
    clearSession()
  }

  // Em 401 tenta refresh uma vez antes de propagar o erro.
  async function authedFetch<T>(base: string, path: string, opts: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    if (accessToken.value && isExpired(accessToken.value)) await refresh()
    const run = () => $fetch<T>(path, {
      baseURL: base,
      ...opts,
      headers: {
        ...(opts.headers as Record<string, string> | undefined),
        ...(accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {})
      }
    })
    try {
      return await run()
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 401 && await refresh()) {
        return await run()
      }
      throw err
    }
  }

  // Bearer JWT do Core direto no Core.
  function coreFetch<T>(path: string, opts: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    return authedFetch<T>(coreBase, path, opts)
  }

  // Bearer JWT do Core no BFF (subaccounts/calls/reports — escopo via accountContext).
  // `credentials: 'include'` acompanha o cookie httpOnly de sessão quando o BFF precisar.
  function bffFetch<T>(path: string, opts: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    return authedFetch<T>(bffBase, path, { credentials: 'include', ...opts })
  }

  return { token: accessToken, user, login, signup, fetchUser, refresh, logout, coreFetch, bffFetch }
}
