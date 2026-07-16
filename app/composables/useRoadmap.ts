import type { CommentMap, ItemStateMap, Reaction, RoadmapComment, RoadmapItem } from '~/lib/roadmap'
// [DEMO CRMs] persistência local das interações para as contas demo. Remover com app/lib/demo/.
import { makeComment, saveComments, saveReaction } from '~/lib/demo/demo-roadmap'

/**
 * Estado + ações do Roadmap, compartilhados via useState (SSR-safe).
 * A reação (Gostei / Não gostei) vai direto ao Supabase (RLS), com update otimista.
 */
export function useRoadmap() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const toast = useToast()
  // [DEMO CRMs] nas contas demo as interações vão pro localStorage (não pro Supabase).
  const demoEnabled = useDemoGate()
  const demoEmail = () => user.value?.email ?? ''

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
    // [DEMO CRMs] contas demo não têm Supabase — basta o estado e o localStorage.
    if (!current || !user.value || (!supabase && !demoEnabled.value)) return

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

    // [DEMO CRMs] persiste a reação no localStorage e encerra (sem Supabase).
    if (demoEnabled.value) {
      saveReaction(demoEmail(), id, next)
      return
    }

    // Fora do demo, o guard inicial já garantiu supabase != null — reestreita p/ o TS.
    if (!supabase) return

    pending.value = true
    try {
      if (next === null) {
        // RLS já limita a exclusão à linha do próprio usuário.
        const { error } = await supabase.from('roadmap_interests').delete().eq('item_id', id)
        if (error) throw error
      } else {
        // user_id vem do default auth.uid() no banco.
        const { error } = await supabase
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
    if (!text || !user.value || (!supabase && !demoEnabled.value)) return

    // [DEMO CRMs] comentário local (localStorage), sem Supabase.
    if (demoEnabled.value) {
      const comment = makeComment(itemId, text)
      const next = { ...myComments.value, [itemId]: [...(myComments.value[itemId] ?? []), comment] }
      myComments.value = next
      saveComments(demoEmail(), next)
      return
    }

    // Fora do demo, o guard inicial já garantiu supabase != null — reestreita p/ o TS.
    if (!supabase) return

    pending.value = true
    try {
      // user_id vem do default auth.uid() no banco.
      const { data, error } = await supabase
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
    if (!text || (!supabase && !demoEnabled.value)) return

    // [DEMO CRMs] edição local.
    if (demoEnabled.value) {
      const next = {
        ...myComments.value,
        [itemId]: (myComments.value[itemId] ?? []).map(c =>
          c.id === commentId ? { ...c, body: text, updatedAt: new Date().toISOString() } : c
        )
      }
      myComments.value = next
      saveComments(demoEmail(), next)
      return
    }

    // Fora do demo, o guard inicial já garantiu supabase != null — reestreita p/ o TS.
    if (!supabase) return

    pending.value = true
    try {
      const { data, error } = await supabase
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
    if (!supabase && !demoEnabled.value) return

    // [DEMO CRMs] exclusão local.
    if (demoEnabled.value) {
      const next = {
        ...myComments.value,
        [itemId]: (myComments.value[itemId] ?? []).filter(c => c.id !== commentId)
      }
      myComments.value = next
      saveComments(demoEmail(), next)
      return
    }

    // Fora do demo, o guard inicial já garantiu supabase != null — reestreita p/ o TS.
    if (!supabase) return

    pending.value = true
    try {
      const { error } = await supabase.from('roadmap_comments').delete().eq('id', commentId)
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
    pending,
    openItem,
    closeItem,
    react,
    addComment,
    editComment,
    deleteComment
  }
}
