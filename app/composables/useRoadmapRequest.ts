import { addRequest } from '~/lib/demo/demo-roadmap' // [DEMO CRMs] remover com app/lib/demo/

/**
 * Envio de demandas pelo parceiro a partir do Roadmap.
 * Fluxo simples: o parceiro só envia (RLS permite insert da própria linha,
 * sem leitura de volta). A demanda fica visível apenas no espaço admin.
 */
export function useRoadmapRequest() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const toast = useToast()
  // [DEMO CRMs] nas contas demo a demanda é salva em localStorage.
  const demoEnabled = useDemoGate()

  const sending = useState<boolean>('rm-request-sending', () => false)

  async function submitRequest(title: string, description: string): Promise<boolean> {
    const t = title.trim()
    const d = description.trim()
    if (!t || !d || !user.value || (!supabase && !demoEnabled.value)) return false

    // [DEMO CRMs] persiste a demanda localmente e avisa sucesso (sem Supabase).
    if (demoEnabled.value) {
      addRequest(user.value.email, t, d)
      toast.add({
        title: 'Demanda enviada!',
        description: 'Nosso time vai avaliar sua sugestão. Obrigado por contribuir.',
        color: 'success',
        icon: 'i-lucide-circle-check'
      })
      return true
    }

    // Fora do demo, o guard inicial já garantiu supabase != null — reestreita p/ o TS.
    if (!supabase) return false

    sending.value = true
    try {
      // user_id vem do default auth.uid() no banco. Sem .select(): o parceiro
      // não tem permissão de leitura nessa tabela (apenas envio).
      const { error } = await supabase.from('roadmap_requests').insert({ title: t, description: d })
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
