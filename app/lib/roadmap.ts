/**
 * Roadmap de dupla linguagem — tipos, metadados e leitura (via BFF).
 */

export type PartnerProfile = 'commercial' | 'technical'
export type Horizon = 'now' | 'radar'

/** WhatsApp do gerente de parcerias (formato E.164, com DDI 55). */
export const PARTNERSHIPS_WHATSAPP = '554833328518'

/** Monta o link wa.me, opcionalmente com mensagem pré-preenchida. */
export function whatsappUrl(text?: string): string {
  const base = `https://wa.me/${PARTNERSHIPS_WHATSAPP}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

/** Arquivo anexado (upload no Storage) com um rótulo exibido ao parceiro. */
export interface FileLink { label: string, url: string, path: string }

export interface CommercialContent { businessValue: string, headline: string, files: FileLink[] }
export interface TechnicalContent { impactSummary: string, files: FileLink[] }

export interface RoadmapItem {
  id: string
  title: string
  horizon: Horizon
  summary: string
  commercial: CommercialContent
  technical: TechnicalContent
  published: boolean
  sortOrder: number
}

export type Reaction = 'like' | 'dislike'

export interface ItemState {
  likeCount: number
  dislikeCount: number
  myReaction: Reaction | null
}
export type ItemStateMap = Record<string, ItemState>

/** Comentário do parceiro (vê só os próprios; admin vê todos). */
export interface RoadmapComment {
  id: string
  itemId: string
  body: string
  createdAt: string
  updatedAt: string
}
/** Comentários do próprio usuário, agrupados por item. */
export type CommentMap = Record<string, RoadmapComment[]>

/* ---------------------------------------------------------------- metadados */

export interface HorizonMeta { id: Horizon, title: string }

export const HORIZONS: HorizonMeta[] = [
  { id: 'now', title: 'Em desenvolvimento agora' },
  { id: 'radar', title: 'No radar' }
]

/* ------------------------------------------------------------ leitura (BFF) */

/**
 * Item do roadmap como o BFF/engagement-service devolve (camelCase, já com o estado
 * de interação do usuário logado). Espelha o contrato do partner-portal-bff
 * (`integration/engagement-service/engagement.types.ts`).
 */
export interface RoadmapItemView {
  id: string
  title: string
  horizon: Horizon
  tag?: string
  summary: string
  commercial: CommercialContent
  technical: TechnicalContent
  published: boolean
  sortOrder: number
  likeCount: number
  dislikeCount: number
  myReaction: Reaction | null
  myComments: RoadmapComment[]
  createdAt: string
  updatedAt: string
}

/** Assinatura mínima do `bffFetch` do `useAuth` (evita acoplar o tipo inteiro). */
type BffFetch = <T>(path: string, opts?: { skipDemo?: boolean }) => Promise<T>

/**
 * Quebra as views do BFF nas três estruturas que a UI consome. Usado pelos dois
 * caminhos: o do parceiro (`fetchRoadmapFromBff`) e o do admin (`fetchAdminData`),
 * que recebe os itens dentro do overview.
 */
export function splitItemViews(
  views: RoadmapItemView[] | null | undefined
): { items: RoadmapItem[], states: ItemStateMap, comments: CommentMap } {
  const items: RoadmapItem[] = []
  const states: ItemStateMap = {}
  const comments: CommentMap = {}

  for (const v of views ?? []) {
    items.push({
      id: v.id,
      title: v.title,
      horizon: v.horizon,
      summary: v.summary,
      commercial: v.commercial,
      technical: v.technical,
      published: v.published,
      sortOrder: v.sortOrder
    })
    states[v.id] = {
      likeCount: v.likeCount,
      dislikeCount: v.dislikeCount,
      myReaction: v.myReaction
    }
    comments[v.id] = v.myComments ?? []
  }

  return { items, states, comments }
}

/**
 * Lê os itens publicados + estado do usuário pelo BFF (Modelo B). `skipDemo`
 * garante itens reais também nas contas demo.
 */
export async function fetchRoadmapFromBff(
  bffFetch: BffFetch
): Promise<{ items: RoadmapItem[], states: ItemStateMap, comments: CommentMap }> {
  return splitItemViews(
    await bffFetch<RoadmapItemView[]>('/roadmap/items', { skipDemo: true })
  )
}
