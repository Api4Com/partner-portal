/**
 * ============================================================================
 * CAMADA DE DEMO — TEMPORÁRIA (remover depois da apresentação dos 3 CRMs).
 * ============================================================================
 *
 * O LOGIN é REAL (BFF/pbx). O que é mockado são só os DADOS: quando o usuário logado
 * é UMA DAS 3 CONTAS DEMO (Pipedrive / Kommo / RD Station), o portal serve os dados de
 * `demo-data.json` em vez de bater nos endpoints de dados do BFF. Qualquer outra conta
 * segue o fluxo normal (BFF) — o mock e o mascaramento NÃO afetam mais ninguém.
 *
 * Detecção pela IDENTIDADE do usuário logado (chave estável = `uuid`; e-mail é atalho
 * local). O `META` abaixo (pequeno) fica no bundle para a detecção ser síncrona; os
 * DADOS pesados (`demo-data.json`, ~12 MB) são carregados via import DINÂMICO — só
 * entram no navegador quando uma conta demo faz a 1ª requisição de dados.
 *
 * Os dados são REAIS de produção (volume/KPIs), com a PII da pessoa MASCARADA
 * (nome/e-mail/telefone/gravação) — a empresa/subconta permanece visível (Regra 3).
 *
 * Para remover: apague `app/lib/demo/` e reverta o hook `[DEMO CRMs]` em `useAuth.ts`
 * e o gate no roadmap.
 */
import type { PbxUser } from '~/composables/useAuth'

/* ------------------------------------------------------------------ tipos */

export interface DemoUser {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  lastCall: string | null
  currentCrm: string
}

export interface DemoSubaccount {
  id: string
  name: string
  minutes: number
  status: 'active' | 'inactive'
  currentCrm: string
  /** Agregados REAIS (a summary soma isto; a lista de chamadas é só amostra). */
  callsTotal: number
  answered: number
  talkSeconds: number
  lastCall: string | null
  users: DemoUser[]
}

export interface DemoCall {
  id: string
  subaccountId: string
  subaccountName: string
  userId: string
  userName: string
  date: string
  durationSeconds: number
  number: string
  cause: 'answered' | 'no_answer' | 'busy' | 'failed' | 'canceled'
  recordingUrl: string | null
  crm: string
}

export interface DemoAccount {
  crm: string
  subaccounts: DemoSubaccount[]
  calls: DemoCall[]
}

/* ------------------------------------------------- META (detecção, bundled) */

interface DemoMeta {
  crm: string
  crmLabel: string
  orgId: string
  /** uuid do usuário no ambiente LOCAL. */
  userUuid: string
  /** uuids extras (ex.: a conta demo em PRODUÇÃO). Chave estável de detecção. */
  aliasUuids: string[]
  email: string
}

const META: DemoMeta[] = [
  { crm: 'pipedrive', crmLabel: 'Pipedrive', orgId: 'd095f865-2f78-4789-9367-dfe14695a50d', userUuid: 'cf50d379-10dd-439d-9228-b83743647c2d', aliasUuids: ['bdc51d09-6d56-40d7-a475-29b600ef2c44'], email: 'pipedrive@demo.api4com.com' },
  { crm: 'kommo', crmLabel: 'Kommo', orgId: '38f50e4a-606a-48bd-bd7b-c14346cf4a37', userUuid: '3b4fd209-fba2-439e-b9c5-5875d4450392', aliasUuids: ['89ab7cc6-4ee2-4358-81bb-f51c06815bee'], email: 'kommo@demo.api4com.com' },
  { crm: 'rdstation-crm', crmLabel: 'RD Station CRM', orgId: 'd69ba721-c81f-48f0-a98c-a48e270cfa61', userUuid: '1f5e8579-b611-4f51-957e-b9c935e92484', aliasUuids: ['8da42b5e-57c8-4a78-8dc8-7b763cb1ae8a'], email: 'rdstation@demo.api4com.com' }
]

/** orgIds das contas demo — referência. */
export const DEMO_ORG_IDS: string[] = META.map(m => m.orgId)
/** E-mails das contas demo — referência. */
export const DEMO_EMAILS: string[] = META.map(m => m.email.toLowerCase())

/** Fim da janela dos dados (16/07/2026). Ancora o "ativo nos últimos 7 dias". */
const DEMO_WINDOW_END = Date.parse('2026-07-17T00:00:00Z')

/* --------------------------------------------------------------- detecção */

function metaForUser(user: PbxUser | null | undefined): DemoMeta | null {
  if (!user) return null
  const email = (user.email || '').trim().toLowerCase()
  // Chave estável = uuid do usuário (local OU o da conta demo em produção). O e-mail
  // é só atalho para o ambiente local (em prod ele pode mudar).
  return (
    META.find(m => m.userUuid === user.uuid || m.aliasUuids.includes(user.uuid))
    ?? META.find(m => m.email.toLowerCase() === email)
    ?? null
  )
}

/** O usuário logado é uma das 3 contas demo? (gate do mock de dados e do roadmap.) */
export function isDemoUser(user: PbxUser | null | undefined): boolean {
  return metaForUser(user) !== null
}

/* ------------------------------------------------- dados pesados (lazy) */

let dataCache: Map<string, DemoAccount> | null = null

async function loadData(): Promise<Map<string, DemoAccount>> {
  if (!dataCache) {
    const mod = await import('./demo-data.json')
    const json = ((mod as { default?: unknown }).default ?? mod) as { accounts: DemoAccount[] }
    dataCache = new Map(json.accounts.map(a => [a.crm, a]))
  }
  return dataCache
}

/* --------------------------------------------------------------- fetch */

type Query = Record<string, unknown> | undefined

function asArray(v: unknown): string[] {
  if (v == null) return []
  return Array.isArray(v) ? v.map(String) : [String(v)]
}

function inRange(iso: string, from?: string, to?: string): boolean {
  const t = Date.parse(iso)
  if (from && t < Date.parse(from)) return false
  if (to && t >= Date.parse(to)) return false
  return true
}

/** Normaliza p/ busca: sem acento, minúsculo. */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function scopedSubs(account: DemoAccount, subaccountId: unknown): DemoSubaccount[] {
  const ids = asArray(subaccountId)
  if (!ids.length) return account.subaccounts
  const set = new Set(ids)
  return account.subaccounts.filter(s => set.has(s.id))
}

function subaccountsResponse(account: DemoAccount) {
  return account.subaccounts.map(s => ({
    id: s.id,
    name: s.name,
    users: s.users.length,
    minutes: s.minutes,
    status: s.status,
    currentCrm: s.currentCrm
  }))
}

/**
 * KPIs a partir dos AGREGADOS reais por subconta (não da amostra de chamadas — a lista
 * é só uma fração). `from/to` não recortam os agregados (que são da janela inteira);
 * o escopo por subconta (interseção) é respeitado.
 */
function summaryResponse(account: DemoAccount, q: Query) {
  const subs = scopedSubs(account, q?.subaccountId)
  const users = subs.flatMap(s => s.users)
  const usersTotal = users.length

  const callsInPeriod = subs.reduce((n, s) => n + (s.callsTotal || 0), 0)
  const answeredTotal = subs.reduce((n, s) => n + (s.answered || 0), 0)
  const talkSeconds = subs.reduce((n, s) => n + (s.talkSeconds || 0), 0)
  const volumeMinutes = Math.round(talkSeconds / 60)
  const answerRate = callsInPeriod ? Math.round((answeredTotal / callsInPeriod) * 100) : 0
  const avgHandlingTimeSeconds = answeredTotal ? Math.round(talkSeconds / answeredTotal) : 0

  // Ativos = usuários com chamada nos últimos 7 dias da janela dos dados.
  const weekAgo = DEMO_WINDOW_END - 7 * 86400000
  const active7d = users.filter(u => u.lastCall && Date.parse(u.lastCall) >= weekAgo).length
  const inactive = Math.max(0, usersTotal - active7d)

  return {
    subaccounts: subs.length,
    usersTotal,
    active7d,
    inactive,
    volumeMinutes,
    answerRate,
    callsInPeriod,
    avgHandlingTimeSeconds
  }
}

function callsResponse(account: DemoAccount, q: Query) {
  const from = q?.from as string | undefined
  const to = q?.to as string | undefined
  const subs = scopedSubs(account, q?.subaccountId)
  const subIds = new Set(subs.map(s => s.id))
  const search = norm(String(q?.q ?? '').trim())
  const sort = (q?.sort as string) || 'date'
  const order = (q?.order as string) === 'asc' ? 1 : -1
  const page = Math.max(1, Number(q?.page ?? 1))
  const pageSize = Math.max(1, Number(q?.pageSize ?? 15))

  let rows = account.calls.filter(c => subIds.has(c.subaccountId) && inRange(c.date, from, to))
  if (search) {
    rows = rows.filter(c =>
      norm(c.userName).includes(search)
      || norm(c.number).includes(search)
      || norm(c.subaccountName).includes(search)
    )
  }

  rows = [...rows].sort((a, b) => {
    const cmp = sort === 'duration'
      ? a.durationSeconds - b.durationSeconds
      : sort === 'user'
        ? norm(a.userName).localeCompare(norm(b.userName))
        : Date.parse(a.date) - Date.parse(b.date)
    return cmp * order
  })

  const total = rows.length
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const data = rows.slice(start, start + pageSize).map(c => ({
    id: c.id,
    subaccountId: c.subaccountId,
    subaccountName: c.subaccountName,
    userId: c.userId,
    userName: c.userName,
    date: c.date,
    durationSeconds: c.durationSeconds,
    number: c.number,
    cause: c.cause,
    recordingUrl: c.recordingUrl
  }))

  return { data, total, page, pageSize, pages }
}

function subUsersResponse(account: DemoAccount, subId: string, q: Query) {
  const sub = account.subaccounts.find(s => s.id === subId)
  const limit = Number(q?.limit ?? 1000)
  const offset = Number(q?.offset ?? 0)
  if (!sub) return { data: [], total: 0, limit, offset }

  // lastCall já vem pronto (sintetizado, escopado à janela dos dados).
  const all = sub.users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    currentCrm: u.currentCrm,
    lastCall: u.lastCall ?? null
  }))

  return { data: all.slice(offset, offset + limit), total: all.length, limit, offset }
}

/**
 * Resolve uma chamada de DADOS do BFF localmente, a partir do JSON de demo (lazy).
 * `user` resolve qual conta demo; `path` é a rota do BFF; `opts.query` traz os filtros.
 */
export async function demoFetch<T>(user: PbxUser | null | undefined, path: string, opts: { query?: Query, method?: string, body?: unknown } = {}): Promise<T> {
  const meta = metaForUser(user)
  if (!meta) throw new Error('[demo] usuário não é uma conta demo')
  const account = (await loadData()).get(meta.crm)
  if (!account) throw new Error(`[demo] dados não encontrados para o CRM ${meta.crm}`)

  const q = opts.query
  const method = (opts.method || 'GET').toUpperCase()

  // /subaccounts/:id/users
  const usersMatch = path.match(/^\/subaccounts\/([^/]+)\/users$/)
  if (usersMatch) return subUsersResponse(account, decodeURIComponent(usersMatch[1]!), q) as T

  if (path === '/subaccounts' && method === 'GET') return subaccountsResponse(account) as T
  if (path === '/reports/summary') return summaryResponse(account, q) as T
  if (path === '/calls') return callsResponse(account, q) as T

  // Credenciais de API: a demo não expõe chaves.
  if (path === '/credentials' && method === 'GET') return [] as T

  // Criar subconta (wizard): eco simples pra não quebrar o fluxo.
  if (path === '/subaccounts' && method === 'POST') {
    const body = (opts.body ?? {}) as { name?: string }
    return { id: `demo-new-${Date.now()}`, name: body.name ?? 'Nova subconta', users: 0, minutes: 0, status: 'inactive' } as T
  }

  throw new Error(`[demo] rota não mockada: ${method} ${path}`)
}
