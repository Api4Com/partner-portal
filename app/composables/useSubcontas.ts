import { SUBCONTAS, type Subconta } from '~/lib/contas'

/**
 * Lista de subcontas = criadas em runtime (sessão) + as fixas do mock.
 * Compartilhado via useState para a lista (Painel Geral) e o detalhe (/clientes/[id])
 * enxergarem as mesmas subcontas. As criadas somem ao recarregar (igual ao protótipo).
 */
export function useSubcontas() {
  const extra = useState<Subconta[]>('subcontas-extra', () => [])

  const all = computed<Subconta[]>(() => [...extra.value, ...SUBCONTAS])

  function add(s: Subconta) {
    extra.value = [s, ...extra.value]
  }

  function byId(id: string): Subconta | null {
    return all.value.find(s => s.id === id) ?? null
  }

  function indexOf(id: string): number {
    return all.value.findIndex(s => s.id === id)
  }

  return { extra, all, add, byId, indexOf }
}
