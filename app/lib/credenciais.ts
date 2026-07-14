// Credenciais de API do parceiro (`p4c_…`) — o que a INTEGRAÇÃO dele usa para falar
// com o BFF sem um humano no meio. Contrato: `/credentials` do bff-portal, que faz o
// proxy para `/partner/keys` do core (o `partnerId` sai da sessão, nunca do corpo).

type BadgeColor = 'primary' | 'success' | 'warning' | 'error' | 'neutral'

export type CredencialStatus = 'ACTIVE' | 'REVOKED'

/** A chave como ela pode ser LIDA. Nunca traz o segredo, nem o hash dele. */
export interface Credencial {
  publicId: string
  keyId: string
  name: string
  scopes: string[]
  status: CredencialStatus
  lastUsedAt?: string
  createdAt?: string
}

/**
 * A emissão é a **única** resposta que carrega o segredo, e uma vez só: nenhum outro
 * endpoint o devolve. Por isso ele nunca entra em `useState` — vive no componente que
 * o exibe e morre com ele.
 */
export interface CredencialEmitida extends Credencial {
  secret: string
}

export const CREDENCIAL_STATUS_BADGE: Record<CredencialStatus, { label: string, color: BadgeColor }> = {
  ACTIVE: { label: 'Ativa', color: 'success' },
  REVOKED: { label: 'Revogada', color: 'neutral' }
}

/**
 * Os 5 escopos que a parceria concede. O core recorta `scopes ∩ capabilities`, então
 * oferecer os outros (MANAGE_CREDITS, LINK_ACCOUNTS…) só renderia uma chave SEM o que
 * foi marcado — o parceiro escolheria um poder que nunca chega, e descobriria isso
 * num 403 em produção.
 */
export const ESCOPOS = [
  {
    value: 'CREATE_CHILD_ACCOUNT',
    label: 'Criar subcontas',
    description: 'Abrir contas novas sob a sua hierarquia. Exige Idempotency-Key em toda criação.'
  },
  {
    value: 'VIEW_CONSUMPTION',
    label: 'Ver consumo',
    description: 'Minutos e volume de chamadas das subcontas.'
  },
  {
    value: 'VIEW_CREDITS',
    label: 'Ver créditos',
    description: 'Saldo das subcontas. Não permite movimentar.'
  },
  {
    value: 'VIEW_PLANS',
    label: 'Ver planos',
    description: 'Plano contratado por cada subconta.'
  },
  {
    value: 'VIEW_CALL_REPORTS',
    label: 'Ver relatórios de chamadas',
    description: 'Relatórios agregados. Não inclui detalhe de chamada nem gravação.'
  }
] as const

export type Escopo = typeof ESCOPOS[number]['value']

const ESCOPO_LABEL = new Map<string, string>(ESCOPOS.map(e => [e.value, e.label]))

/** Um escopo que o front não conhece ainda aparece cru — melhor do que sumir da tela. */
export function escopoLabel(value: string): string {
  return ESCOPO_LABEL.get(value) ?? value
}

export function fmtCredencialData(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })
}

/** Chave nunca usada é chave que dá para revogar sem medo — o texto diz isso. */
export function fmtUltimoUso(iso?: string): string {
  if (!iso) return 'Nunca usada'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}
