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

interface TokenPair {
  accessToken: string
  refreshToken: string
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
  const refreshToken = useCookie<string | null>('refresh_token', cookieOpts)
  const user = useState<PbxUser | null>('auth-user', () => null)

  const config = useRuntimeConfig().public
  const bffBase = config.bffBase
  const coreBase = config.coreBase

  function setTokens(tokens: TokenPair) {
    accessToken.value = tokens.accessToken
    refreshToken.value = tokens.refreshToken
  }

  function clearSession() {
    accessToken.value = null
    refreshToken.value = null
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
    const tokens = await $fetch<TokenPair>('/users/login', {
      baseURL: bffBase,
      method: 'POST',
      body: { email, password }
    })
    setTokens(tokens)
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
    if (!refreshToken.value) {
      clearSession()
      return false
    }
    try {
      const tokens = await $fetch<TokenPair>('/auth/refresh', {
        baseURL: coreBase,
        method: 'POST',
        body: { refreshToken: refreshToken.value }
      })
      setTokens(tokens)
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
    // Revogação real é por tokenVersion no Core; aqui limpamos a sessão local.
    clearSession()
  }

  // Em 401 tenta refresh uma vez antes de propagar o erro.
  async function coreFetch<T>(path: string, opts: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    if (accessToken.value && isExpired(accessToken.value)) await refresh()
    const run = () => $fetch<T>(path, {
      baseURL: coreBase,
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

  return { token: accessToken, refreshToken, user, login, signup, fetchUser, refresh, logout, coreFetch }
}
