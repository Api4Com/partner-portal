/**
 * Autenticação via bff-portal (proxy fino). Todo tráfego passa pelo BFF, que
 * repassa ao pbxapi (LoopBack) — o portal NUNCA fala direto com o pbxapi.
 * Os paths são repassados 1:1 pelo BFF:
 * - login: POST /users/login  { email, password } -> { id, ttl, created }
 * - signup: POST /accounts/signup { name, organization_name, email, password, phone }
 * - o token (id) vai no header `Authorization` (sem "Bearer") em toda request
 * - usuário atual: GET /users/me
 *
 * O token é guardado em cookie (SSR-safe) para o middleware conseguir ler.
 */
export interface PbxUser {
  uuid: string
  name?: string
  email: string
  phone?: string
  role?: string
  status?: string
}

export interface SignupPayload {
  name: string
  organizationName: string
  email: string
  password: string
  phone: string
}

export function useAuth() {
  const token = useCookie<string | null>('pbx_token', {
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14 // 14 dias, igual ao ttl do pbxapi
  })
  const user = useState<PbxUser | null>('auth-user', () => null)
  const base = useRuntimeConfig().public.bffBase

  function api<T>(path: string, opts: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    return $fetch<T>(path, {
      baseURL: base,
      headers: token.value ? { Authorization: token.value } : {},
      ...opts
    })
  }

  async function login(email: string, password: string) {
    const tk = await api<{ id: string }>('/users/login', {
      method: 'POST',
      body: { email, password }
    })
    token.value = tk.id
    await fetchUser()
  }

  // pbxapi não auto-loga no cadastro: devolve 201 e exige verificação de e-mail.
  async function signup(payload: SignupPayload) {
    return api<{ status: number, message: string }>('/accounts/signup', {
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

  async function fetchUser(): Promise<PbxUser | null> {
    if (!token.value) {
      user.value = null
      return null
    }
    try {
      user.value = await api<PbxUser>('/users/me')
    } catch {
      // token inválido/expirado
      token.value = null
      user.value = null
    }
    return user.value
  }

  async function logout() {
    try {
      await api('/users/logout', { method: 'POST', body: { access_token: token.value } })
    } catch {
      // ignora erro de logout — limpa local de qualquer forma
    }
    token.value = null
    user.value = null
  }

  return { token, user, login, signup, fetchUser, logout }
}
