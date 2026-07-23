/**
 * Envio de demandas pelo parceiro a partir do Roadmap.
 * Fluxo simples: o parceiro só envia (POST /roadmap/requests). A demanda fica
 * visível apenas no espaço admin. O `userId` sai do header (`x-user-uuid`).
 */
export function useRoadmapRequest() {
  const { user, bffFetch } = useAuth()
  const toast = useToast()

  const sending = useState<boolean>('rm-request-sending', () => false)

  async function submitRequest(title: string, description: string): Promise<boolean> {
    const t = title.trim()
    const d = description.trim()
    if (!t || !d || !user.value) return false

    sending.value = true
    try {
      await bffFetch('/roadmap/requests', { method: 'POST', body: { title: t, description: d }, skipDemo: true })
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
