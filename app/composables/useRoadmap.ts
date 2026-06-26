import type { CommentMap, ItemStateMap, PartnerProfile, Reaction, RoadmapComment, RoadmapItem } from '~/lib/roadmap'

/**
 * Estado + ações do Roadmap, compartilhados via useState (SSR-safe).
 * A reação (Gostei / Não gostei) vai direto ao Supabase (RLS), com update otimista.
 */
export function useRoadmap() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const toast = useToast()

  const items = useState<RoadmapItem[]>('rm-items', () => [])
  const states = useState<ItemStateMap>('rm-states', () => ({}))
  const myComments = useState<CommentMap>('rm-comments', () => ({}))
  const activeItemId = useState<string | null>('rm-active', () => null)
  const profile = useState<PartnerProfile>('rm-profile', () => 'commercial')
  const pending = useState<boolean>('rm-pending', () => false)

  const activeItem = computed(() => items.value.find(i => i.id === activeItemId.value) ?? null)

  const openItem = (id: string) => { activeItemId.value = id }
  const closeItem = () => { activeItemId.value = null }

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
      const db = supabase as any
      if (next === null) {
        // RLS já limita a exclusão à linha do próprio usuário.
        const { error } = await db.from('roadmap_interests').delete().eq('item_id', id)
        if (error) throw error
      } else {
        // user_id vem do default auth.uid() no banco.
        const { error } = await db
          .from('roadmap_interests')
          .upsert({ item_id: id, reaction: next }, { onConflict: 'item_id,user_id' })
        if (error) throw error
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
      const db = supabase as any
      // user_id vem do default auth.uid() no banco.
      const { data, error } = await db
        .from('roadmap_comments')
        .insert({ item_id: itemId, body: text })
        .select('id, item_id, body, created_at, updated_at')
        .single()
      if (error) throw error
      const comment: RoadmapComment = {
        id: data.id,
        itemId: data.item_id,
        body: data.body,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
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
      const db = supabase as any
      const { data, error } = await db
        .from('roadmap_comments')
        .update({ body: text })
        .eq('id', commentId)
        .select('updated_at')
        .single()
      if (error) throw error
      myComments.value = {
        ...myComments.value,
        [itemId]: (myComments.value[itemId] ?? []).map(c =>
          c.id === commentId ? { ...c, body: text, updatedAt: data.updated_at } : c
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
      const db = supabase as any
      const { error } = await db.from('roadmap_comments').delete().eq('id', commentId)
      if (error) throw error
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
    profile,
    pending,
    openItem,
    closeItem,
    react,
    addComment,
    editComment,
    deleteComment
  }
}
