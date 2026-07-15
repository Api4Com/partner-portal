/**
 * Mock de registros de chamadas para a tela de Relatórios.
 * Gera chamadas determinísticas por subconta/usuário (sem Math.random no SSR),
 * no mesmo espírito de buildUsuarios() em ~/lib/contas. Tudo estático/protótipo.
 */

import { buildUsuarios, type Subconta } from './contas'
import { fmtCallDateTime } from '../utils/callTime'

export type HangupCause = 'atendida' | 'sem_resposta' | 'ocupado' | 'falha' | 'cancelada'

export interface CallRecord {
  id: string
  subId: string
  subName: string
  userId: string
  userName: string
  /** Data/hora da ligação (ISO). */
  date: string
  /** Duração em segundos (0 = não atendida). */
  duration: number
  /** Número discado (E.164 formatado). */
  number: string
  cause: HangupCause
  /** Link da gravação (apenas chamadas atendidas). */
  recording: string | null
}

type BadgeColor = 'primary' | 'success' | 'warning' | 'error' | 'neutral'

export const CAUSE_BADGE: Record<HangupCause, { label: string, color: BadgeColor }> = {
  atendida: { label: 'Atendida', color: 'success' },
  sem_resposta: { label: 'Sem resposta', color: 'warning' },
  ocupado: { label: 'Ocupado', color: 'warning' },
  cancelada: { label: 'Cancelada', color: 'neutral' },
  falha: { label: 'Falha', color: 'error' }
}

const DAY = 86400000
const DDD = ['11', '21', '31', '41', '48', '51', '61', '62', '71', '81', '85', '19', '27', '92']

/** Hash determinístico simples (FNV-1a) — evita Math.random no SSR. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Duração em segundos → "3m 42s" (ou "—" quando não atendida). */
export function fmtDuration(sec: number): string {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

/** Data da ligação (ISO) → pt-BR com hora (já com o +3h da API — ver callTime). */
export function fmtCallDate(iso: string): string {
  return fmtCallDateTime(iso)
}

/** Gera o histórico de chamadas de uma subconta de forma determinística (subId + usuário + índice). */
export function buildCalls(sub: Subconta): CallRecord[] {
  const users = buildUsuarios(sub)
  const now = Date.now()
  const out: CallRecord[] = []

  for (const u of users) {
    const seed = hash(`${sub.id}:${u.id}:calls`)
    // Ativos ligam bastante (6–31); inativos quase nada (0–3) e há mais tempo.
    const count = u.active ? 6 + (seed % 26) : seed % 4

    for (let c = 0; c < count; c++) {
      const cs = hash(`${u.id}:${c}:call`)
      const maxDaysAgo = u.active ? 28 : 60
      const daysAgo = cs % maxDaysAgo
      const minsInDay = (cs >>> 7) % 1440
      const date = new Date(now - daysAgo * DAY - minsInDay * 60000).toISOString()

      // Distribuição de causas (~68% atendidas).
      const r = (cs >>> 3) % 100
      const cause: HangupCause
        = r < 68
          ? 'atendida'
          : r < 80
            ? 'sem_resposta'
            : r < 88
              ? 'ocupado'
              : r < 95
                ? 'cancelada'
                : 'falha'

      const answered = cause === 'atendida'
      const duration = answered ? 20 + ((cs >>> 11) % 580) : 0
      const ddd = DDD[(cs >>> 5) % DDD.length]!
      const rest = ((cs >>> 2) % 100000000).toString().padStart(8, '0')
      const number = `+55 ${ddd} 9${rest.slice(0, 4)}-${rest.slice(4, 8)}`
      const id = `REC-${(hash(`${u.id}:${c}`) % 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`

      out.push({
        id,
        subId: sub.id,
        subName: sub.name,
        userId: u.id,
        userName: u.name,
        date,
        duration,
        number,
        cause,
        recording: answered ? `https://rec.api4.com/${sub.id.toLowerCase()}/${id.toLowerCase()}.mp3` : null
      })
    }
  }

  return out
}
