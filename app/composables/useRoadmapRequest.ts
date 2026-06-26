/**
 * Envio de demandas pelo parceiro a partir do Roadmap.
 * Fluxo simples: o parceiro só envia (RLS permite insert da própria linha,
 * sem leitura de volta). A demanda fica visível apenas no espaço admin.
 */
export function useRoadmapRequest() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const toast = useToast()

  const sending = useState<boolean>('rm-request-sending', () => false)

  async function submitRequest(title: string, description: string): Promise<boolean> {
    const t = title.trim()
    const d = description.trim()
    if (!t || !d || !user.value) return false

    sending.value = true
    try {
      const db = supabase as any
      // user_id vem do default auth.uid() no banco. Sem .select(): o parceiro
      // não tem permissão de leitura nessa tabela (apenas envio).
      const { error } = await db.from('roadmap_requests').insert({ title: t, description: d })
      if (error) throw error
      toast.add({
        title: 'Demanda enviada!',
        description: 'Nosso time vai avaliar sua sugestão. Obrigado por contribuir.',
        color: 'success',
        icon: 'i-lucide-circle-check'
      })
      return true
    } catch {
      toast.add({
        title: 'Não foi possível enviar sua demanda',
        description: 'Tente novamente em instantes.',
        color: 'error',
        icon: 'i-lucide-triangle-alert'
      })
      return false
    } finally {
      sending.value = false
    }
  }

  return { sending, submitRequest }
}
