/**
 * Biblioteca de conteúdos da API4COM para os parceiros (estudos, artigos, guias).
 *
 * Mock-first: hoje os itens vivem neste arquivo. Quando houver endpoint no
 * partner-portal-bff (ex.: `GET /contents`), troque `CONTEUDOS` por um
 * `fetchConteudos()` — a UI (card + página) consome só o tipo `Conteudo`.
 */

export type ConteudoTipo = 'estudo' | 'artigo' | 'guia' | 'webinar'

export interface ConteudoStat {
  value: string
  label: string
}

export interface Conteudo {
  id: string
  /** slug estável (usado como key; útil se um dia virar rota interna). */
  slug: string
  tipo: ConteudoTipo
  /** Rótulo do formato exibido na capa (ex.: "Estudo interativo"). Cai no label do tipo. */
  format?: string
  title: string
  /** Resumo curto — mantenha enxuto pra caber no card sem estourar. */
  description: string
  /** Link do conteúdo. Externo por enquanto (abre em nova aba). */
  url: string
  /** Autores/assinatura do conteúdo. */
  authors?: string[]
  /** Etiquetas de tema (aparecem como badges discretos). */
  tags?: string[]
  /** Legenda acima dos números (ex.: posicionamento/autoridade). */
  statsCaption?: string
  /** Destaques numéricos — dão "cara de dado" ao card em destaque. */
  stats?: ConteudoStat[]
  /** Item de vitrine: ganha o card grande no topo da página. */
  featured?: boolean
}

/** Metadados de apresentação por tipo (label + cor do badge + ícone). */
export const TIPO_META: Record<ConteudoTipo, { label: string, color: string, icon: string }> = {
  estudo: { label: 'Estudo', color: 'primary', icon: 'i-lucide-chart-column' },
  artigo: { label: 'Artigo', color: 'neutral', icon: 'i-lucide-newspaper' },
  guia: { label: 'Guia', color: 'success', icon: 'i-lucide-compass' },
  webinar: { label: 'Webinar', color: 'warning', icon: 'i-lucide-video' }
}

/**
 * Conteúdos publicados. O primeiro é o estudo interativo de atendimento
 * (57,7 mi de chamadas em 24 meses) hospedado no blog da API4COM.
 */
export const CONTEUDOS: Conteudo[] = [
  {
    id: 'ninguem-atende-telefone',
    slug: 'ninguem-atende-telefone',
    tipo: 'estudo',
    format: 'Estudo interativo',
    title: 'Será mesmo que ninguém mais atende o telefone?',
    description:
      'Todo mundo diz que ninguém atende mais o telefone. Será? Um estudo interativo pra você explorar os dados e tirar a sua própria conclusão.',
    url: 'https://www.api4com.com/blog/ninguem-atende-telefone',
    authors: ['André Denófrio', 'Ricardo Fadel', 'Kessi Mendes'],
    tags: ['Dados', 'Vendas', 'Telefonia'],
    statsCaption: 'A força de quem entende de vender por telefone',
    stats: [
      { value: '+111 mi', label: 'ligações no histórico' },
      { value: '+1 mi', label: 'horas de conversa' },
      { value: '+2.100', label: 'clientes ativos' },
      { value: '+22', label: 'CRMs integrados' }
    ],
    featured: true
  }
]
