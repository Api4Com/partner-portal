// Login/logout passam pelo bff-portal → pbxapi. O access token é um token OPACO
// de sessão do pbx (não é JWT: não tem claims, não dá para decodificar e não há
// refresh). O usuário atual vem de GET /users/me; o escopo das subcontas é
// derivado no BFF a cada request.
import { isDemoUser, demoFetch } from '~/lib/demo/demo' // [DEMO CRMs] remover com app/lib/demo/

export interface PbxUser {
  uuid: string
  name?: string
  email: string
  phone?: string
  role?: string
  status?: string
  organizationId?: string
  /** CRM atual do usuário no pbx (pipedrive/kommo/rdstation-crm). [DEMO CRMs] */
  currentCrm?: string | null
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

  // No SSR o BFF é alcançado pelo hostname da rede interna; no browser, pela URL
  // pública. Usar a pública no servidor dá ECONNREFUSED dentro do docker.
  const config = useRuntimeConfig()
  const bffBase = import.meta.server && config.bffInternalBase
    ? config.bffInternalBase
    : config.public.bffBase

  function clearSession() {
    accessToken.value = null
    user.value = null
  }

  // Só 401/403 significam "a sessão/conta não vale mais". Erro de rede, timeout ou
  // 5xx do BFF são falhas TRANSITÓRIAS: derrubar a sessão nesses casos desloga o
  // usuário por um soluço de infra (era o que acontecia no refresh, via SSR).
  function isAuthFailure(err: unknown): boolean {
    const e = err as { response?: { status?: number }, statusCode?: number }
    const status = e?.response?.status ?? e?.statusCode
    return status === 401 || status === 403
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
    } catch (err) {
      // Token inválido/expirado ou conta sem acesso: sem refresh, a sessão cai.
      // Falha transitória (rede/5xx): PRESERVA o token — a próxima navegação tenta
      // de novo. Limpar aqui deslogaria por um blip do BFF.
      if (isAuthFailure(err)) clearSession()
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

  // Nem todo 403 é fatal para a sessão, e a distinção importa:
  //
  // - 403 do PartnerGuard ("Acesso restrito a contas parceiras"): a CONTA não é (ou
  //   deixou de ser) parceira — ex.: parceiro desativado enquanto logado. Toda rota
  //   passa a responder isso; manter o usuário "logado" só renderiza telas quebradas.
  //   → derruba a sessão.
  // - 403 de RECURSO (ex.: `GET /subaccounts/:id/users` nega PII de usuários ao papel
  //   PARTNER, por design): a sessão está VÁLIDA, só aquele dado é proibido. Derrubar
  //   a sessão aqui deslogaria o parceiro ao abrir o detalhe da subconta.
  //   → repassa o erro; quem chamou já sabe tolerar (lista vazia).
  const PARTNER_GUARD_403 = 'Acesso restrito a contas parceiras'

  // Em 401 a sessão acabou (não há refresh): limpa e manda para o /login.
  async function bffFetch<T>(path: string, opts: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    // [DEMO CRMs] Contas demo (Pipedrive/Kommo/RD Station) leem os DADOS do
    // arquivo JSON local em vez do BFF. Login/fetchUser continuam reais; só os
    // endpoints de dados são resolvidos aqui. Remover junto com `app/lib/demo/`.
    if (isDemoUser(user.value)) {
      return demoFetch<T>(user.value, path, {
        query: (opts.query ?? undefined) as Record<string, unknown> | undefined,
        method: opts.method as string | undefined,
        body: (opts as { body?: unknown }).body
      })
    }

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
      const e = err as {
        response?: { status?: number }
        statusCode?: number
        data?: { message?: string }
      }
      const httpStatus = e?.response?.status ?? e?.statusCode
      const isDeactivatedPartner
        = httpStatus === 403 && e?.data?.message === PARTNER_GUARD_403

      if (httpStatus === 401 || isDeactivatedPartner) {
        clearSession()
        await navigateTo('/login')
      }
      throw err
    }
  }

  return { token: accessToken, user, login, fetchUser, logout, bffFetch }
}
