import type { ItemStateMap, PartnerProfile, RoadmapItem } from '~/lib/roadmap'

/**
 * Estado + ações do Roadmap, compartilhados via useState (SSR-safe).
 * Mutações de interesse/beta vão direto ao Supabase (RLS), com update otimista.
 */
export function useRoadmap() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const toast = useToast()

  const items = useState<RoadmapItem[]>('rm-items', () => [])
  const states = useState<ItemStateMap>('rm-states', () => ({}))
  const activeItemId = useState<string | null>('rm-active', () => null)
  const profile = useState<PartnerProfile>('rm-profile', () => 'commercial')
  const pending = useState<boolean>('rm-pending', () => false)

  const activeItem = computed(() => items.value.find(i => i.id === activeItemId.value) ?? null)

  const openItem = (id: string) => { activeItemId.value = id }
  const closeItem = () => { activeItemId.value = null }

  async function toggleInterest(id: string) {
    const current = states.value[id]
    if (!current || !user.value) return
    const nextInterested = !current.interested

    states.value = {
      ...states.value,
      [id]: {
        ...current,
        interested: nextInterested,
        interestCount: current.interestCount + (nextInterested ? 1 : -1)
      }
    }
    pending.value = true
    try {
      const db = supabase as any
      if (nextInterested) {
        const { error } = await db.from('roadmap_interests').insert({ item_id: id, user_id: user.value.id })
        if (error) throw error
        toast.add({
          title: 'Lead registrado!',
          description: 'Seu interesse foi sinalizado ao time de produto.',
          icon: 'i-lucide-circle-check',
          color: 'success'
        })
      } else {
        const { error } = await db.from('roadmap_interests').delete().eq('item_id', id).eq('user_id', user.value.id)
        if (error) throw error
      }
    } catch {
      states.value = { ...states.value, [id]: current }
      toast.add({ title: 'Não foi possível registrar', color: 'error', icon: 'i-lucide-triangle-alert' })
    } finally {
      pending.value = false
    }
  }

  async function requestBeta(id: string) {
    const current = states.value[id]
    if (!current || current.betaRequested || !user.value) return

    states.value = { ...states.value, [id]: { ...current, betaRequested: true } }
    pending.value = true
    try {
      const db = supabase as any
      const { error } = await db
        .from('roadmap_beta_requests')
        .upsert({ item_id: id, user_id: user.value.id }, { onConflict: 'item_id,user_id', ignoreDuplicates: true })
      if (error) throw error
      toast.add({
        title: 'Acesso ao beta solicitado',
        description: 'Nossa equipe entrará em contato.',
        icon: 'i-lucide-circle-check',
        color: 'success'
      })
    } catch {
      states.value = { ...states.value, [id]: { ...current, betaRequested: false } }
      toast.add({ title: 'Não foi possível solicitar', color: 'error', icon: 'i-lucide-triangle-alert' })
    } finally {
      pending.value = false
    }
  }

  return {
    items,
    states,
    activeItemId,
    activeItem,
    profile,
    pending,
    openItem,
    closeItem,
    toggleInterest,
    requestBeta
  }
}
