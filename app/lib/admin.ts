import { mapItem, type ItemRow, type ItemStateMap, type RoadmapItem } from '~/lib/roadmap'

export interface AdminInterest {
  itemId: string
  itemTitle: string
  email: string
  company: string
  createdAt: string
}

export interface AdminBeta {
  id: string
  itemId: string
  itemTitle: string
  email: string
  company: string
  status: 'requested' | 'approved' | 'rejected'
  createdAt: string
}

export interface AdminData {
  items: RoadmapItem[]
  states: ItemStateMap
  interests: AdminInterest[]
  betas: AdminBeta[]
}

/** Todos os itens (inclui rascunhos) + leads + betas + contagem. RLS exige admin. */
export async function fetchAdminData(supabase: any): Promise<AdminData> {
  const [itemsRes, interestsRes, betasRes, profilesRes, countsRes] = await Promise.all([
    supabase
      .from('roadmap_items')
      .select('*')
      .order('horizon', { ascending: true })
      .order('sort_order', { ascending: true }),
    supabase.from('roadmap_interests').select('item_id, user_id, created_at'),
    supabase.from('roadmap_beta_requests').select('id, item_id, user_id, status, created_at'),
    supabase.from('roadmap_profiles').select('id, email, company'),
    supabase.rpc('roadmap_interest_counts')
  ])

  const items = ((itemsRes.data as ItemRow[] | null) ?? []).map(mapItem)
  const titleOf = new Map(items.map(i => [i.id, i.title]))
  const profiles = new Map<string, { email: string, company: string }>(
    ((profilesRes.data as { id: string, email: string | null, company: string | null }[] | null) ?? [])
      .map(p => [p.id, { email: p.email ?? '—', company: p.company ?? '' }])
  )

  const interests: AdminInterest[] = (
    (interestsRes.data as { item_id: string, user_id: string, created_at: string }[] | null) ?? []
  ).map(r => ({
    itemId: r.item_id,
    itemTitle: titleOf.get(r.item_id) ?? r.item_id,
    email: profiles.get(r.user_id)?.email ?? '—',
    company: profiles.get(r.user_id)?.company ?? '',
    createdAt: r.created_at
  }))

  const betas: AdminBeta[] = (
    (betasRes.data as { id: string, item_id: string, user_id: string, status: AdminBeta['status'], created_at: string }[] | null) ?? []
  ).map(r => ({
    id: r.id,
    itemId: r.item_id,
    itemTitle: titleOf.get(r.item_id) ?? r.item_id,
    email: profiles.get(r.user_id)?.email ?? '—',
    company: profiles.get(r.user_id)?.company ?? '',
    status: r.status,
    createdAt: r.created_at
  }))

  const countMap = new Map<string, number>(
    ((countsRes.data as { item_id: string, total: number }[] | null) ?? []).map(c => [c.item_id, Number(c.total)])
  )
  const states: ItemStateMap = {}
  for (const item of items) {
    states[item.id] = { interestCount: countMap.get(item.id) ?? 0, interested: false, betaRequested: false }
  }

  return { items, states, interests, betas }
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
