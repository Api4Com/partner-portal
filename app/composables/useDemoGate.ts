import { isDemoUser } from '~/lib/demo/demo'

/**
 * [DEMO CRMs] `true` quando o usuário logado é uma das 3 contas demo
 * (Pipedrive / Kommo / RD Station). Gate do mock de dados e dos recursos do
 * roadmap (curtir/comentar/solicitar em localStorage). Remover com `app/lib/demo/`.
 *
 * SSR-safe: fica `false` no servidor E durante a hidratação, virando o valor real
 * só depois de montar. Sem isto, a auth SSR (que hoje não resolve o `user`) faria
 * o gate render `false` no servidor e `true` no cliente — hydration mismatch em
 * todos os elementos condicionados a ele.
 */
export function useDemoGate() {
  const { user } = useAuth()
  const mounted = ref(false)
  onMounted(() => {
    mounted.value = true
  })
  return computed(() => mounted.value && isDemoUser(user.value))
}
