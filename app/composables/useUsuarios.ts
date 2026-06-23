import { buildUsuarios, type Subconta, type Usuario, type UsuarioRole } from '~/lib/contas'

/**
 * Usuários por subconta (estado de sessão). Cada subconta é inicializada sob demanda
 * a partir de buildUsuarios(); mutações (add/role/ativar) persistem só durante a sessão
 * e somem ao recarregar — mesmo comportamento de protótipo de useSubcontas().
 */
export function useUsuarios() {
  const bySub = useState<Record<string, Usuario[]>>('usuarios-by-sub', () => ({}))

  /** Lista reativa dos usuários de uma subconta (inicializa na primeira leitura). */
  function list(sub: Subconta): ComputedRef<Usuario[]> {
    if (!bySub.value[sub.id]) {
      bySub.value = { ...bySub.value, [sub.id]: buildUsuarios(sub) }
    }
    return computed(() => bySub.value[sub.id] ?? [])
  }

  function add(subId: string, u: Usuario) {
    bySub.value = { ...bySub.value, [subId]: [u, ...(bySub.value[subId] ?? [])] }
  }

  function setRole(subId: string, userId: string, role: UsuarioRole) {
    const arr = bySub.value[subId]
    if (!arr) return
    bySub.value = { ...bySub.value, [subId]: arr.map(u => (u.id === userId ? { ...u, role } : u)) }
  }

  function toggleActive(subId: string, userId: string) {
    const arr = bySub.value[subId]
    if (!arr) return
    bySub.value = { ...bySub.value, [subId]: arr.map(u => (u.id === userId ? { ...u, active: !u.active } : u)) }
  }

  return { list, add, setRole, toggleActive }
}
