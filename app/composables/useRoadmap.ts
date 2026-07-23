import type { CommentMap, ItemStateMap, Reaction, RoadmapComment, RoadmapItem } from '~/lib/roadmap'

/**
 * Estado + ações do Roadmap, compartilhados via useState (SSR-safe).
 * Reações e comentários vão ao BFF (`bffFetch`), com update otimista.
 */
export function useRoadmap() {
  const { user, bffFetch } = useAuth()
  const toast = useToast()

  const items = useState<RoadmapItem[]>('rm-items', () => [])
  const states = useState<ItemStateMap>('rm-states', () => ({}))
  const myComments = useState<CommentMap>('rm-comments', () => ({}))
  const activeItemId = useState<string | null>('rm-active', () => null)
  const pending = useState<boolean>('rm-pending', () => false)

  const activeItem = computed(() => items.value.find(i => i.id === activeItemId.value) ?? null)

  const openItem = (id: string) => {
    activeItemId.value = id
  }
  const closeItem = () => {
    activeItemId.value = null
  }

  /**
   * Aplica/alterna a reação do usuário. Clicar na reação já ativa a remove.
   */
  async function react(id: string, reaction: Reaction) {
    const current = states.value[id]
    if (!current || !user.value) return

    const prev = current.myReaction
    const next: Reaction | null = prev === reaction ? null : reaction

    // Atualização otimista das contagens.
    let likeCount = current.likeCount
    let dislikeCount = current.dislikeCount
    if (prev === 'like') likeCount -= 1
    if (prev === 'dislike') dislikeCount -= 1
    if (next === 'like') likeCount += 1
    if (next === 'dislike') dislikeCount += 1

    states.value = {
      ...states.value,
      [id]: { likeCount, dislikeCount, myReaction: next }
    }

    pending.value = true
    try {
      // O toggle é do BFF/engagement: remover = DELETE; aplicar/trocar = PUT. O
      // `userId` sai do header (`x-user-uuid`), nunca do body.
      if (next === null) {
        await bffFetch(`/roadmap/items/${id}/reaction`, { method: 'DELETE', skipDemo: true })
      } else {
        await bffFetch(`/roadmap/items/${id}/reaction`, { method: 'PUT', body: { reaction: next }, skipDemo: true })
      }
    } catch {
      states.value = { ...states.value, [id]: current }
      toast.add({ title: 'Não foi possível registrar seu voto', color: 'error', icon: 'i-lucide-triangle-alert' })
    } finally {
      pending.value = false
    }
  }

  /** Adiciona um comentário do usuário (pode ter vários por item). */
  async function addComment(itemId: string, body: string) {
    const text = body.trim()
    if (!text || !user.value) return

    pending.value = true
    try {
      // O BFF devolve o comentário já no formato do front (id/itemId/body/timestamps).
      const comment = await bffFetch<RoadmapComment>(`/roadmap/items/${itemId}/comments`, {
        method: 'POST',
        body: { body: text },
        skipDemo: true
      })
      myComments.value = {
        ...myComments.value,
        [itemId]: [...(myComments.value[itemId] ?? []), comment]
      }
    } catch {
      toast.add({ title: 'Não foi possível comentar', color: 'error', icon: 'i-lucide-triangle-alert' })
    } finally {
      pending.value = false
    }
  }

  /** Edita um comentário do próprio usuário. */
  async function editComment(itemId: string, commentId: string, body: string) {
    const text = body.trim()
    if (!text) return

    pending.value = true
    try {
      // O engagement barra editar comentário de outro `userId` (403).
      const updated = await bffFetch<RoadmapComment>(`/roadmap/items/${itemId}/comments/${commentId}`, {
        method: 'PATCH',
        body: { body: text },
        skipDemo: true
      })
      myComments.value = {
        ...myComments.value,
        [itemId]: (myComments.value[itemId] ?? []).map(c =>
          c.id === commentId ? { ...c, body: text, updatedAt: updated.updatedAt } : c
        )
      }
    } catch {
      toast.add({ title: 'Não foi possível editar', color: 'error', icon: 'i-lucide-triangle-alert' })
    } finally {
      pending.value = false
    }
  }

  /** Exclui um comentário do próprio usuário. */
  async function deleteComment(itemId: string, commentId: string) {
    pending.value = true
    try {
      await bffFetch(`/roadmap/items/${itemId}/comments/${commentId}`, { method: 'DELETE', skipDemo: true })
      myComments.value = {
        ...myComments.value,
        [itemId]: (myComments.value[itemId] ?? []).filter(c => c.id !== commentId)
      }
    } catch {
      toast.add({ title: 'Não foi possível excluir', color: 'error', icon: 'i-lucide-triangle-alert' })
    } finally {
      pending.value = false
    }
  }

  return {
    items,
    states,
    myComments,
    activeItemId,
    activeItem,
    pending,
    openItem,
    closeItem,
    react,
    addComment,
    editComment,
    deleteComment
  }
}
