/**
 * Roadmap de dupla linguagem — tipos, metadados e leitura do Supabase.
 * Lê do MESMO banco do portal Next (tabelas roadmap_* + RPCs com RLS).
 */

export type PartnerProfile = 'commercial' | 'technical'
export type Horizon = 'now' | 'radar'

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

export interface HorizonMeta { id: Horizon, title: string, caption: string, accent: string }

export const HORIZONS: HorizonMeta[] = [
  { id: 'now', title: 'Em desenvolvimento agora', caption: 'O que o time já está construindo', accent: 'from-emerald-50 to-white text-emerald-700 ring-emerald-200' },
  { id: 'radar', title: 'No radar', caption: 'Um espaço aberto pra explorar possibilidades', accent: 'from-amber-50 to-white text-amber-700 ring-amber-200' }
]

export interface KpiMeta { id: string, label: string, value: string, icon: string }
export const KPIS: KpiMeta[] = [
  { id: 'integrations', label: 'Integrações Ativas', value: '1.284', icon: 'i-lucide-plug' },
  { id: 'beta', label: 'Recursos em Beta Disponíveis', value: '6', icon: 'i-lucide-flask-conical' },
  { id: 'uptime', label: 'Chamadas de API (30d)', value: '42,7M', icon: 'i-lucide-activity' }
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
