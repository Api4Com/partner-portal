/**
 * Mock da feature "Hierarquia de Contas" — cenário Parceiro CRM · Individual.
 * Cada subconta (cliente) tem saldo próprio e compra direto da API4COM; a Conta
 * Principal apenas provisiona e acompanha (read-only). Tudo estático.
 */

export type SubcontaStatus = 'ativo' | 'bloqueado' | 'inativo'
export type SubcontaCharge = 'prepaid' | 'plan' | 'pending'

export interface Subconta {
  name: string
  id: string
  /** Volume de minutos no mês corrente. */
  minutes: number
  /** Usuários (agentes/ramais webphone) na subconta. */
  users: number
  status: SubcontaStatus
  charge: SubcontaCharge
}

export interface ContaPrincipal {
  name: string
  role: string
  initials: string
}

export const CONTA_PRINCIPAL: ContaPrincipal = {
  name: 'Voice CRM',
  role: 'Parceiro Whitelabel',
  initials: 'VC'
}

export const SUBCONTAS: Subconta[] = [
  { name: 'Logística Trans BR', id: 'SUB-9D4F61', minutes: 21340, users: 18, status: 'ativo', charge: 'prepaid' },
  { name: 'Construtora Horizonte', id: 'SUB-C8E2A5', minutes: 15770, users: 12, status: 'ativo', charge: 'plan' },
  { name: 'Transportes Aurora', id: 'SUB-4A7B2E', minutes: 9120, users: 9, status: 'ativo', charge: 'prepaid' },
  { name: 'Rede Bela Vida', id: 'SUB-1E5C90', minutes: 280, users: 3, status: 'ativo', charge: 'pending' },
  { name: 'Mundo Pet Express', id: 'SUB-7B2F48', minutes: 640, users: 5, status: 'inativo', charge: 'prepaid' }
]

export function fmt(n: number): string {
  return n.toLocaleString('pt-BR')
}

export function initials(name: string): string {
  const w = name.replace(/[·+.]/g, ' ').split(/\s+/).filter(Boolean)
  return ((w[0]?.[0] ?? '') + (w[1]?.[0] ?? '')).toUpperCase()
}

/** Tints de avatar ciclados por índice. */
export const AVATAR_PALETTE = [
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-purple-100 text-purple-700',
  'bg-cyan-100 text-cyan-700',
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-lime-100 text-lime-700'
]

type BadgeColor = 'primary' | 'success' | 'warning' | 'error' | 'neutral'

export const STATUS_BADGE: Record<SubcontaStatus, { label: string, color: BadgeColor }> = {
  ativo: { label: 'Ativo', color: 'success' },
  bloqueado: { label: 'Bloqueado', color: 'error' },
  inativo: { label: 'Inativo', color: 'neutral' }
}

export const CHARGE_BADGE: Record<SubcontaCharge, { label: string, color: BadgeColor }> = {
  prepaid: { label: 'Pré-pago', color: 'success' },
  plan: { label: 'Plano · usuário', color: 'primary' },
  pending: { label: 'A definir', color: 'warning' }
}

/* ------------------------------------------------ Detalhe da subconta (mock) */

export interface CdrLog {
  time: string
  number: string
  dur: string
  status: string
  /** Sucesso (200) tem gravação; falhas não. */
  ok: boolean
}

export interface MetaRow { k: string, v: string }

/** API key fictícia (escopo limitado à subconta). */
export const API_KEY = 'pk_live_4c0m_a1B2c3D4e5F6g7H8i9J0kLmN'

/** Logs de chamada (CDR) de exemplo — isolados por subconta. */
export const CDR_LOGS: CdrLog[] = [
  { time: '12/06 14:32', number: '+55 11 98765-4321', dur: '04:12', status: 'Sucesso · 200', ok: true },
  { time: '12/06 14:28', number: '+55 21 99812-3344', dur: '01:58', status: 'Sucesso · 200', ok: true },
  { time: '12/06 14:15', number: '+55 11 91234-5678', dur: '00:00', status: 'Falha · 486 Busy', ok: false },
  { time: '12/06 13:59', number: '+55 31 98877-1122', dur: '06:45', status: 'Sucesso · 200', ok: true },
  { time: '12/06 13:47', number: '+55 11 95566-7788', dur: '00:14', status: 'Falha · 404', ok: false }
]

/** Metadados de observabilidade derivados do id da subconta. */
export function buildMeta(id: string): MetaRow[] {
  const tenant = id.toLowerCase()
  return [
    { k: 'tenant_id', v: tenant },
    { k: 'log_stream', v: `p4c.cdr.${tenant}` },
    { k: 'region', v: 'br-sao-1' },
    { k: 'webhook_events', v: 'call.start, call.end' },
    { k: 'trace_namespace', v: 'voice/webphone' }
  ]
}

/** Gera um id de subconta fictício (usado pelo wizard). */
export function newSubcontaId(): string {
  return 'SUB-' + Math.random().toString(16).slice(2, 8).toUpperCase()
}
