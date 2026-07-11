import type { ItemStateMap, PartnerProfile, RoadmapItem } from '~/lib/roadmap'

// Estado + ações do Roadmap, compartilhados via useState (SSR-safe).
export function useRoadmap() {
  const toast = useToast()

  const items = useState<RoadmapItem[]>('rm-items', () => [])
  const states = useState<ItemStateMap>('rm-states', () => ({}))
  const activeItemId = useState<string | null>('rm-active', () => null)
  const profile = useState<PartnerProfile>('rm-profile', () => 'commercial')

  const activeItem = computed(() => items.value.find(i => i.id === activeItemId.value) ?? null)

  const openItem = (id: string) => {
    activeItemId.value = id
  }
  const closeItem = () => {
    activeItemId.value = null
  }

  // TODO: interesse/beta gravavam no Supabase. Sem backend equivalente ainda,
  // mantemos só o update otimista local e avisamos que a ação é provisória.
  async function toggleInterest(id: string) {
    const current = states.value[id]
    if (!current) return
    const nextInterested = !current.interested

    states.value = {
      ...states.value,
      [id]: {
        ...current,
        interested: nextInterested,
        interestCount: current.interestCount + (nextInterested ? 1 : -1)
      }
    }
    toast.add({
      title: nextInterested ? 'Interesse marcado' : 'Interesse removido',
      description: 'Registro ainda não é persistido (migração de backend em andamento).',
      icon: 'i-lucide-info',
      color: 'neutral'
    })
  }

  async function requestBeta(id: string) {
    const current = states.value[id]
    if (!current || current.betaRequested) return

    states.value = { ...states.value, [id]: { ...current, betaRequested: true } }
    toast.add({
      title: 'Acesso ao beta solicitado',
      description: 'Registro ainda não é persistido (migração de backend em andamento).',
      icon: 'i-lucide-info',
      color: 'neutral'
    })
  }

  return {
    items,
    states,
    activeItemId,
    activeItem,
    profile,
    openItem,
    closeItem,
    toggleInterest,
    requestBeta
  }
}
