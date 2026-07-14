import type { SupabaseClient } from '@supabase/supabase-js'
import { mapItem, type ItemRow, type ItemStateMap, type Reaction, type RoadmapItem } from '~/lib/roadmap'

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

/** Todos os itens (inclui rascunhos) + reações + comentários + contagem. RLS exige admin. */
export async function fetchAdminData(supabase: SupabaseClient): Promise<AdminData> {
  const [itemsRes, interestsRes, commentsRes, profilesRes, countsRes, requestsRes] = await Promise.all([
    supabase
      .from('roadmap_items')
      .select('*')
      .order('horizon', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase.from('roadmap_interests').select('item_id, user_id, reaction, created_at'),
    supabase.from('roadmap_comments').select('id, item_id, user_id, body, created_at').order('created_at', { ascending: false }),
    supabase.from('roadmap_profiles').select('id, email, company'),
    supabase.rpc('roadmap_reaction_counts'),
    supabase.from('roadmap_requests').select('id, user_id, title, description, archived, created_at').order('created_at', { ascending: false })
  ])

  const items = ((itemsRes.data as ItemRow[] | null) ?? []).map(mapItem)
  const titleOf = new Map(items.map(i => [i.id, i.title]))
  const profiles = new Map<string, { email: string, company: string }>(
    ((profilesRes.data as { id: string, email: string | null, company: string | null }[] | null) ?? [])
      .map(p => [p.id, { email: p.email ?? '—', company: p.company ?? '' }])
  )

  const reactions: AdminReaction[] = (
    (interestsRes.data as { item_id: string, user_id: string, reaction: Reaction, created_at: string }[] | null) ?? []
  ).map(r => ({
    itemId: r.item_id,
    itemTitle: titleOf.get(r.item_id) ?? r.item_id,
    email: profiles.get(r.user_id)?.email ?? '—',
    company: profiles.get(r.user_id)?.company ?? '',
    reaction: r.reaction,
    createdAt: r.created_at
  }))

  const comments: AdminComment[] = (
    (commentsRes.data as { id: string, item_id: string, user_id: string, body: string, created_at: string }[] | null) ?? []
  ).map(r => ({
    id: r.id,
    itemId: r.item_id,
    itemTitle: titleOf.get(r.item_id) ?? r.item_id,
    email: profiles.get(r.user_id)?.email ?? '—',
    company: profiles.get(r.user_id)?.company ?? '',
    body: r.body,
    createdAt: r.created_at
  }))

  const countMap = new Map<string, { likes: number, dislikes: number }>(
    ((countsRes.data as { item_id: string, likes: number, dislikes: number }[] | null) ?? [])
      .map(c => [c.item_id, { likes: Number(c.likes), dislikes: Number(c.dislikes) }])
  )
  const states: ItemStateMap = {}
  for (const item of items) {
    const c = countMap.get(item.id)
    states[item.id] = { likeCount: c?.likes ?? 0, dislikeCount: c?.dislikes ?? 0, myReaction: null }
  }

  const requests: AdminRequest[] = (
    (requestsRes.data as { id: string, user_id: string, title: string, description: string, archived: boolean, created_at: string }[] | null) ?? []
  ).map(r => ({
    id: r.id,
    email: profiles.get(r.user_id)?.email ?? '—',
    company: profiles.get(r.user_id)?.company ?? '',
    title: r.title,
    description: r.description,
    archived: r.archived,
    createdAt: r.created_at
  }))

  return { items, states, reactions, comments, requests }
}

/** Gera um slug a partir do título (igual ao server action do portal Next). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
