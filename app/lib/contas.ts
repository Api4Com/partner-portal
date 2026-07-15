/**
 * Mock da feature "Hierarquia de Contas" — cenário Parceiro CRM · Individual.
 * Cada subconta (cliente) tem saldo próprio e compra direto da API4COM; a Conta
 * Principal apenas provisiona e acompanha (read-only). Tudo estático.
 */

import { fmtCallDateTime } from '../utils/callTime'

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

/* ------------------------------------------------- Usuários da subconta (mock) */

export type UsuarioRole = 'admin' | 'usuario'

export interface Usuario {
  id: string
  name: string
  email: string
  role: UsuarioRole
  active: boolean
  /** Última ligação realizada (ISO). Vazio = nunca ligou. */
  lastCall: string
}

export const ROLE_BADGE: Record<UsuarioRole, { label: string, color: BadgeColor }> = {
  admin: { label: 'Admin', color: 'primary' },
  usuario: { label: 'Usuário', color: 'neutral' }
}

/** Formata a última ligação (ISO) para pt-BR; vazio → "Nunca ligou". */
export function fmtLastCall(iso: string): string {
  if (!iso) return 'Nunca ligou'
  return fmtCallDateTime(iso) // mesma formatação (UTC) da tela de Relatórios
}

const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elaine', 'Felipe', 'Gabriela', 'Hugo', 'Isabela', 'João', 'Karina', 'Lucas', 'Marina', 'Nelson', 'Olívia', 'Paulo', 'Renata', 'Sérgio', 'Tatiana', 'Vitor']
const SOBRENOMES = ['Almeida', 'Barbosa', 'Cardoso', 'Dias', 'Esteves', 'Ferreira', 'Gomes', 'Henrique', 'Lima', 'Moraes', 'Nunes', 'Oliveira', 'Pereira', 'Queiroz', 'Ribeiro', 'Santos', 'Teixeira', 'Vasconcelos']

/** Hash determinístico simples (FNV-1a) — evita Math.random no SSR. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function slug(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '.')
}

/** Tint de avatar est\u00e1vel derivado de uma chave (id/nome) \u2014 n\u00e3o muda ao filtrar/ordenar. */
export function avatarTint(key: string): string {
  return AVATAR_PALETTE[hash(key) % AVATAR_PALETTE.length]!
}

/** Gera a lista de usuários de uma subconta de forma determinística (id + índice). */
export function buildUsuarios(sub: Subconta): Usuario[] {
  const domain = slug(sub.name).replace(/\./g, '') + '.com.br'
  return Array.from({ length: sub.users }, (_, i) => {
    const seed = hash(`${sub.id}:${i}`)
    const first = NOMES[seed % NOMES.length]!
    const last = SOBRENOMES[(seed >>> 5) % SOBRENOMES.length]!
    const name = `${first} ${last}`
    const active = (seed % 9) !== 0
    // Última ligação determinística: inativos tendem a ter ligado há mais tempo.
    const daysAgo = (seed % 40) + (active ? 0 : 25)
    const minsAgo = (seed >>> 9) % 1440
    const lastCall = new Date(Date.now() - daysAgo * 86400000 - minsAgo * 60000).toISOString()
    return {
      id: `USR-${(seed % 0xffff).toString(16).toUpperCase().padStart(4, '0')}`,
      name,
      email: `${slug(first)}.${slug(last)}@${domain}`,
      role: i === 0 ? 'admin' : 'usuario',
      active,
      lastCall
    }
  })
}

/** Gera um id de usuário fictício (usado pelo modal de novo usuário). */
export function newUsuarioId(): string {
  return 'USR-' + Math.random().toString(16).slice(2, 6).toUpperCase()
}

/* ------------------------------------------------ Detalhe da subconta (mock) */

export interface MetaRow { k: string, v: string }

/** API key fictícia (escopo limitado à subconta). */
export const API_KEY = 'pk_live_4c0m_a1B2c3D4e5F6g7H8i9J0kLmN'

/** Metadados de observabilidade derivados do id da subconta. */
export function buildMeta(id: string): MetaRow[] {
  const tenant = id.toLowerCase()
  return [
    { k: 'tenant_id', v: tenant },
    { k: 'log_stream', v: `p4c.calls.${tenant}` },
    { k: 'region', v: 'br-sao-1' },
    { k: 'webhook_events', v: 'call.start, call.end' },
    { k: 'trace_namespace', v: 'voice/webphone' }
  ]
}

/** Gera um id de subconta fictício (usado pelo wizard). */
export function newSubcontaId(): string {
  return 'SUB-' + Math.random().toString(16).slice(2, 8).toUpperCase()
}
