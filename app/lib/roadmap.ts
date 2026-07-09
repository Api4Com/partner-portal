/**
 * Roadmap de dupla linguagem — tipos, metadados e leitura do Supabase.
 * Lê do MESMO banco do portal Next (tabelas roadmap_* + RPCs com RLS).
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

/* ---------------------------------------------------------------- leitura */

export interface ItemRow {
  id: string
  title: string
  horizon: Horizon
  summary: string
  commercial: Partial<CommercialContent> | null
  technical: Partial<TechnicalContent> | null
  published: boolean
  sort_order: number
}

export function mapItem(r: ItemRow): RoadmapItem {
  return {
    id: r.id,
    title: r.title,
    horizon: r.horizon,
    summary: r.summary,
    commercial: {
      headline: r.commercial?.headline ?? '',
      businessValue: r.commercial?.businessValue ?? '',
      files: r.commercial?.files ?? []
    },
    technical: {
      impactSummary: r.technical?.impactSummary ?? '',
      files: r.technical?.files ?? []
    },
    published: r.published,
    sortOrder: r.sort_order
  }
}

/**
 * Itens publicados + estado de interação do usuário.
 * `supabase` tipado como `any` enquanto não geramos database.types.ts.
 */
export async function fetchRoadmapData(
  supabase: any,
  userId: string
): Promise<{ items: RoadmapItem[], states: ItemStateMap, comments: CommentMap }> {
  const [{ data: itemsRaw }, { data: counts }, { data: myReactions }, { data: myComments }] = await Promise.all([
    supabase
      .from('roadmap_items')
      .select('*')
      .eq('published', true)
      .order('horizon', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase.rpc('roadmap_reaction_counts'),
    supabase.from('roadmap_interests').select('item_id, reaction').eq('user_id', userId),
    supabase
      .from('roadmap_comments')
      .select('id, item_id, body, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
  ])

  const countMap = new Map<string, { likes: number, dislikes: number }>(
    ((counts ?? []) as { item_id: string, likes: number, dislikes: number }[])
      .map(c => [c.item_id, { likes: Number(c.likes), dislikes: Number(c.dislikes) }])
  )
  const myReactionMap = new Map<string, Reaction>(
    ((myReactions ?? []) as { item_id: string, reaction: Reaction }[]).map(r => [r.item_id, r.reaction])
  )

  const items = ((itemsRaw as ItemRow[] | null) ?? []).map(mapItem)
  const states: ItemStateMap = {}
  for (const item of items) {
    const c = countMap.get(item.id)
    states[item.id] = {
      likeCount: c?.likes ?? 0,
      dislikeCount: c?.dislikes ?? 0,
      myReaction: myReactionMap.get(item.id) ?? null
    }
  }

  const comments: CommentMap = {}
  for (const row of (myComments ?? []) as { id: string, item_id: string, body: string, created_at: string, updated_at: string }[]) {
    ;(comments[row.item_id] ??= []).push({
      id: row.id,
      itemId: row.item_id,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    })
  }

  return { items, states, comments }
}
