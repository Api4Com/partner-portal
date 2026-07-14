import type { Credencial, CredencialEmitida } from '~/lib/credenciais'

// Mensagens do BFF que valem repassar ao usuário como estão. As demais viram um texto
// genérico: erro de infra não deve virar jargão na tela.
function mensagemDoErro(err: unknown, fallback: string): string {
  const e = err as { data?: { message?: string | string[] } }
  const msg = e?.data?.message
  if (Array.isArray(msg)) return msg[0] ?? fallback
  return msg ?? fallback
}

/**
 * As credenciais do próprio parceiro. Tudo passa pelo BFF, que resolve o `partnerId`
 * a partir da sessão — não existe (e não pode existir) um `partnerId` no corpo.
 *
 * A LISTA é estado compartilhado (`useState`) para que o modal de emissão e a página
 * enxerguem a mesma coisa. O SEGREDO não: ele é só o retorno de `issue()`, vive no
 * componente que o exibe e morre com ele. Guardá-lo em estado seria dar a um XSS uma
 * segunda chance de lê-lo.
 */
export function useCredenciais() {
  const { bffFetch } = useAuth()

  const items = useState<Credencial[]>('credenciais', () => [])
  const loading = useState<boolean>('credenciais-loading', () => false)
  const error = useState<string | null>('credenciais-error', () => null)

  // Ativas primeiro: a revogada só interessa como histórico.
  const ordered = computed<Credencial[]>(() =>
    [...items.value].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    })
  )

  async function load() {
    loading.value = true
    error.value = null
    try {
      items.value = await bffFetch<Credencial[]>('/credentials')
    } catch (err) {
      error.value = mensagemDoErro(err, 'Não foi possível carregar as credenciais.')
      items.value = []
    } finally {
      loading.value = false
    }
  }

  /** Emite. O `secret` do retorno é a única vez que ele existe — quem chamou tem que exibi-lo. */
  async function issue(name: string, scopes: string[]): Promise<CredencialEmitida> {
    const issued = await bffFetch<CredencialEmitida>('/credentials', {
      method: 'POST',
      // Escopos vazios = tudo o que a parceria concede. Mandar `[]` seria pedir uma
      // chave que não pode nada; o BFF trata ausente e vazio de formas diferentes.
      body: { name, ...(scopes.length ? { scopes } : {}) }
    })

    const { secret: _secret, ...semSegredo } = issued
    items.value = [semSegredo, ...items.value]

    return issued
  }

  /** Revoga. Vale no request seguinte — o core não cacheia o verify. Resposta é 204. */
  async function revoke(publicId: string): Promise<void> {
    // 204 sem corpo: não há nada para tipar no retorno.
    await bffFetch<unknown>(`/credentials/${publicId}/revoke`, { method: 'POST' })
    items.value = items.value.map(c =>
      c.publicId === publicId ? { ...c, status: 'REVOKED' as const } : c
    )
  }

  return { items: ordered, loading, error, load, issue, revoke, mensagemDoErro }
}
