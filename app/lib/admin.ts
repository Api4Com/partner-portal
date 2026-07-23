import { splitItemViews, type ItemStateMap, type Reaction, type RoadmapItem, type RoadmapItemView } from '~/lib/roadmap'

export interface AdminReaction {
  itemId: string
  itemTitle: string
  email: string
  company: string
  reaction: Reaction
  createdAt: string
}

export interface AdminComment {
  id: string
  itemId: string
  itemTitle: string
  email: string
  company: string
  body: string
  createdAt: string
}

export interface AdminRequest {
  id: string
  email: string
  company: string
  title: string
  description: string
  archived: boolean
  createdAt: string
}

export interface AdminData {
  items: RoadmapItem[]
  states: ItemStateMap
  reactions: AdminReaction[]
  comments: AdminComment[]
  requests: AdminRequest[]
}

/** Assinatura mínima do `bffFetch` do `useAuth` (evita acoplar o tipo inteiro). */
type BffFetch = <T>(path: string, opts?: { skipDemo?: boolean }) => Promise<T>

/**
 * Payload de `GET /roadmap/admin/overview`. O BFF já resolve `email`/`company`
 * (via core) e o `itemTitle`, então reações/comentários/demandas chegam prontos —
 * o que antes eram 5 queries no Supabase (+ join manual de perfis) virou uma
 * chamada. `states` não vem: é derivado dos counts que cada item carrega.
 */
interface AdminOverview {
  items: RoadmapItemView[]
  reactions: AdminReaction[]
  comments: AdminComment[]
  requests: AdminRequest[]
}

/** Todos os itens (inclui rascunhos) + engajamento. O gate de admin é do BFF. */
export async function fetchAdminData(bffFetch: BffFetch): Promise<AdminData> {
  const overview = await bffFetch<AdminOverview>('/roadmap/admin/overview', { skipDemo: true })

  const { items, states } = splitItemViews(overview?.items)

  return {
    items,
    states,
    reactions: overview?.reactions ?? [],
    comments: overview?.comments ?? [],
    requests: overview?.requests ?? []
  }
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
