// Roadmap de dupla linguagem — tipos e metadados.
export type PartnerProfile = 'commercial' | 'technical'
export type Horizon = 'now' | 'next' | 'future'
export type ComplexityTag = 'new-api' | 'improvement' | 'breaking-change'
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type SalesAssetType = 'deck' | 'script' | 'pricing'

export interface SalesAsset { label: string, type: SalesAssetType }
export interface CommercialContent { businessValue: string, headline: string, salesKit: SalesAsset[] }
export interface ApiEndpoint { method: HttpMethod, path: string }
export interface TechnicalContent {
  impactSummary: string
  endpoints: ApiEndpoint[]
  webhooks?: string[]
  samplePayload?: string
}

export interface RoadmapItem {
  id: string
  title: string
  horizon: Horizon
  tag: ComplexityTag
  summary: string
  commercial: CommercialContent
  technical: TechnicalContent
  published: boolean
  sortOrder: number
}

export interface ItemState {
  interestCount: number
  interested: boolean
  betaRequested: boolean
}
export type ItemStateMap = Record<string, ItemState>

/* ---------------------------------------------------------------- metadados */

export interface HorizonMeta { id: Horizon, title: string, caption: string, accent: string }

export const HORIZONS: HorizonMeta[] = [
  { id: 'now', title: 'Agora', caption: 'Desenvolvimento ativo · Beta Fechado', accent: 'from-emerald-50 to-white text-emerald-700 ring-emerald-200' },
  { id: 'next', title: 'Próximo', caption: 'Prioridades validadas para o próximo ciclo', accent: 'from-brand-50 to-white text-brand-700 ring-brand-200' },
  { id: 'future', title: 'Futuro', caption: 'Visão de longo prazo · Product Discovery', accent: 'from-slate-100 to-white text-slate-600 ring-slate-200' }
]

export const TAG_META: Record<ComplexityTag, { label: string, className: string }> = {
  'new-api': { label: 'Nova API', className: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200' },
  'improvement': { label: 'Melhoria', className: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200' },
  'breaking-change': { label: 'Breaking Change', className: 'bg-rose-100 text-rose-700 ring-1 ring-inset ring-rose-300' }
}

export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  POST: 'bg-brand-50 text-brand-700 ring-brand-200',
  PUT: 'bg-amber-50 text-amber-700 ring-amber-200',
  PATCH: 'bg-amber-50 text-amber-700 ring-amber-200',
  DELETE: 'bg-rose-50 text-rose-700 ring-rose-200'
}

export const ASSET_LABEL: Record<string, string> = {
  deck: 'Pitch Deck',
  script: 'Script de Abordagem',
  pricing: 'Regras de Precificação'
}

export interface KpiMeta { id: string, label: string, value: string, icon: string }
export const KPIS: KpiMeta[] = [
  { id: 'integrations', label: 'Integrações Ativas', value: '1.284', icon: 'i-lucide-plug' },
  { id: 'beta', label: 'Recursos em Beta Disponíveis', value: '6', icon: 'i-lucide-flask-conical' },
  { id: 'uptime', label: 'Chamadas de API (30d)', value: '42,7M', icon: 'i-lucide-activity' }
]
