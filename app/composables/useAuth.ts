// Login/signup passam pelo partner-portal-bff → pbxapi; pós-login o portal fala direto
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

// Status HTTP de um erro do ofetch (FetchError expõe em `.response.status`/`.status`).
function errStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status
    ?? (err as { status?: number })?.status
}

// Renovação em vôo compartilhada: fetches paralelos que caem em 401 reusam o mesmo
// POST /auth/refresh em vez de dispararem vários (com rotação de cookie, múltiplos
// refreshes concorrentes matam a sessão no meio do load). Escopo de módulo → só no
// client (o refresh é pulado no SSR).
let refreshInflight: Promise<boolean> | null = null

export function useAuth() {
  const cookieOpts = {
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    // Em produção o JWT só trafega por HTTPS; em dev (http://localhost) `secure`
    // impediria o cookie de ser gravado.
    secure: !import.meta.dev
  }
  const accessToken = useCookie<string | null>('access_token', cookieOpts)
  const user = useState<PbxUser | null>('auth-user', () => null)

  const { executeRecaptcha } = useRecaptcha()

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
    // reCAPTCHA v3: o BFF em `enforce` rejeita o cadastro sem token (RECAPTCHA_MISSING).
    // Em `observe`/sem chave, executeRecaptcha resolve null e o cadastro segue.
    const recaptchaToken = await executeRecaptcha('signup')
    return $fetch<{ status: number, message: string }>('/accounts/signup', {
      baseURL: bffBase,
      method: 'POST',
      body: {
        name: payload.name,
        organization_name: payload.organizationName,
        email: payload.email,
        password: payload.password,
        phone: payload.phone,
        recaptchaToken
      }
    })
  }

  async function refresh(): Promise<boolean> {
    // No SSR o $fetch server-side não encaminha o cookie httpOnly do refresh, então
    // qualquer tentativa daria 401 e derrubaria uma sessão válida. Pula no servidor
    // (retorna false SEM limpar) e deixa o client renovar de verdade.
    if (import.meta.server) return false
    // Memoiza a renovação em vôo: chamadas concorrentes reusam a mesma promise.
    if (refreshInflight) return refreshInflight

    refreshInflight = (async () => {
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
      } catch (err) {
        // Só derruba a sessão quando o refresh é de fato recusado (401/403 = token
        // inválido/expirado). Rede, 5xx, CORS e timeout NÃO limpam — o access token
        // atual segue valendo e uma nova tentativa pode funcionar.
        const status = errStatus(err)
        if (status === 401 || status === 403) clearSession()
        return false
      }
    })()

    try {
      return await refreshInflight
    } finally {
      refreshInflight = null
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
    // $fetch<T> devolve TypedInternalResponse<…, T>, que o TS não reduz a T num
    // contexto genérico — cast explícito para o tipo pedido pelo chamador.
    const run = () => $fetch<T>(path, {
      baseURL: base,
      ...opts,
      headers: {
        ...(opts.headers as Record<string, string> | undefined),
        ...(accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {})
      }
    }) as Promise<T>
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
