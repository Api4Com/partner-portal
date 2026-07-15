<script setup lang="ts">
import { avatarTint, fmt, initials } from '~/lib/contas'
import { CAUSE_BADGE, fmtCallDate, fmtDuration, type HangupCause } from '~/lib/relatorio'

/* ----- contrato do BFF ----- */
interface Subaccount { id: string, name: string, users: number, minutes: number }
interface BffCall {
  id: string
  subaccountId: string | null
  subaccountName: string | null
  userId: string | null
  userName: string | null
  date: string | null
  durationSeconds: number
  number: string | null
  cause: 'answered' | 'no_answer' | 'busy' | 'failed' | 'canceled'
  recordingUrl: string | null
}
interface CallsPage { data: BffCall[], total: number, page: number, pageSize: number, pages: number }
interface Summary {
  subaccounts: number
  usersTotal: number
  active7d: number
  inactive: number
  volumeMinutes: number
  answerRate: number
  callsInPeriod: number
}
interface SubUser { id: string, name: string, email: string, role: string, active: boolean, lastCall: string | null }

/** Linha da tabela: chamada real ou usuário sem ligação no período (cause null). */
interface ReportRow {
  id: string
  subId: string | null
  subName: string | null
  userId: string | null
  userName: string | null
  date: string
  duration: number
  number: string
  cause: HangupCause | null
  recording: string | null
}

// O BFF devolve a causa em inglês; o badge da UI usa os rótulos PT.
const CAUSE_EN_PT: Record<BffCall['cause'], HangupCause> = {
  answered: 'atendida',
  no_answer: 'sem_resposta',
  busy: 'ocupado',
  failed: 'falha',
  canceled: 'cancelada'
}

const { bffFetch } = useAuth()
const toast = useToast()
const DAY = 86400000
const PAGE_SIZE = 15
// Teto do fetch de usuários "sem chamada" por subconta e do export (evita loop/rows
// infinitos). Se um dia estourar, avisamos em vez de truncar em silêncio.
const USERS_FETCH_LIMIT = 1000
const EXPORT_MAX_PAGES = 100
const EXPORT_PAGE_SIZE = 500

/* ----- filtros (mesma UX do mock; persistidos na URL) ----- */
type Periodo = 'all' | 'today' | '7d' | '30d' | 'month' | 'custom'
const periodo = ref<Periodo>('30d')
const subSelection = ref<string[]>([]) // vazio = todas
const search = ref('')
const customStart = ref('')
const customEnd = ref('')
const includeNoCalls = ref(false)
const page = ref(1)
const sortKey = ref<'date' | 'duration' | 'user'>('date')
const sortDir = ref<'asc' | 'desc'>('desc')

const periodoItems: { label: string, value: Periodo }[] = [
  { label: 'Qualquer data', value: 'all' },
  { label: 'Hoje', value: 'today' },
  { label: 'Últimos 7 dias', value: '7d' },
  { label: 'Últimos 30 dias', value: '30d' },
  { label: 'Este mês', value: 'month' },
  { label: 'Personalizado', value: 'custom' }
]

watch(periodo, (v) => {
  if (v !== 'custom') {
    customStart.value = ''
    customEnd.value = ''
  }
})

const customRangeInvalid = computed(() =>
  periodo.value === 'custom'
  && !!customStart.value
  && !!customEnd.value
  && customStart.value > customEnd.value
)

/** Período personalizado ainda sem as duas datas: nada a buscar. */
const customRangePending = computed(() =>
  periodo.value === 'custom' && (!customStart.value || !customEnd.value)
)

/**
 * Só busca quando o filtro descreve um período de fato. Em "Personalizado" sem
 * as duas datas (ou com intervalo invertido) o `range` seria `{}` — igual a
 * "Qualquer data" — e a tela mostraria tudo em vez de esperar o usuário.
 */
const filtersReady = computed(() => !customRangePending.value && !customRangeInvalid.value)

/**
 * Período selecionado → { from, to } ISO para a query do BFF.
 * Todos os presets são ancorados em fronteira de dia (meia-noite), igual ao
 * dashboard do api4com — senão a janela "anda" com a hora do clique e o total
 * muda a cada load. `to` é o INÍCIO do dia seguinte, não `23:59:59`: o pbx usa
 * `started_at < to` (fronteira aberta à direita), então `amanhã 00:00` inclui o
 * dia inteiro sem perder o último segundo nem contar em dobro na virada.
 */
const startOfDay = (d: Date) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
const startOfTomorrow = () => {
  const x = startOfDay(new Date())
  x.setDate(x.getDate() + 1)
  return x
}
const range = computed<{ from?: string, to?: string }>(() => {
  const now = new Date()
  const iso = (d: Date) => d.toISOString()
  const to = iso(startOfTomorrow())
  switch (periodo.value) {
    case 'all':
      return {}
    case 'today':
      return { from: iso(startOfDay(now)), to }
    case '7d':
      return { from: iso(new Date(startOfDay(now).getTime() - 7 * DAY)), to }
    case '30d':
      return { from: iso(new Date(startOfDay(now).getTime() - 30 * DAY)), to }
    case 'month':
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to }
    case 'custom': {
      if (customRangeInvalid.value) return {}
      const r: { from?: string, to?: string } = {}
      if (customStart.value) r.from = new Date(`${customStart.value}T00:00:00`).toISOString()
      // `to` no início do dia seguinte ao "fim" escolhido (fronteira aberta à direita).
      if (customEnd.value) {
        const end = new Date(`${customEnd.value}T00:00:00`)
        end.setDate(end.getDate() + 1)
        r.to = end.toISOString()
      }
      return r
    }
  }
  return {}
})

/* ----- subcontas (dropdown + escopo) ----- */
const subaccounts = ref<Subaccount[]>([])
const subItems = computed(() => subaccounts.value.map(s => ({ label: s.name, value: s.id })))
const nameById = computed(() => new Map(subaccounts.value.map(s => [s.id, s.name])))
const selectedSet = computed(() => new Set(subSelection.value))
const scopeSubs = computed(() =>
  selectedSet.value.size === 0 ? subaccounts.value : subaccounts.value.filter(s => selectedSet.value.has(s.id))
)
const showSubName = computed(() => scopeSubs.value.length > 1)

/* ----- estado dos dados ----- */
const summary = ref<Summary | null>(null)
const callsResp = ref<CallsPage | null>(null)
const noCallRows = ref<ReportRow[]>([])
const loading = ref(false)
const exporting = ref(false)
const errorMsg = ref('')

// Sequências por loader: filtros mudam rápido e as respostas voltam fora de ordem.
// Cada chamada captura seu número; só a mais recente escreve no estado (as antigas
// são descartadas), evitando que uma resposta obsoleta sobrescreva a atual.
let callsSeq = 0
let summarySeq = 0
let noCallsSeq = 0

/** Monta a query comum (escopo + período). */
function baseQuery(extra: Record<string, unknown> = {}): Record<string, unknown> {
  const q: Record<string, unknown> = { ...extra }
  if (subSelection.value.length) q.subaccountId = subSelection.value
  if (range.value.from) q.from = range.value.from
  if (range.value.to) q.to = range.value.to
  return q
}

function toRow(c: BffCall): ReportRow {
  return {
    id: c.id,
    subId: c.subaccountId,
    subName: c.subaccountName,
    userId: c.userId,
    userName: c.userName,
    date: c.date ?? '',
    duration: c.durationSeconds,
    number: c.number ?? '',
    cause: CAUSE_EN_PT[c.cause] ?? 'falha',
    recording: c.recordingUrl
  }
}

async function loadSubaccounts() {
  try {
    subaccounts.value = await bffFetch<Subaccount[]>('/subaccounts')
  } catch {
    subaccounts.value = []
  }
}

async function loadSummary() {
  const seq = ++summarySeq
  if (!filtersReady.value) {
    summary.value = null
    return
  }
  try {
    const resp = await bffFetch<Summary>('/reports/summary', { query: baseQuery() })
    if (seq === summarySeq) summary.value = resp
  } catch {
    if (seq === summarySeq) summary.value = null
  }
}

async function loadCalls() {
  const seq = ++callsSeq
  errorMsg.value = ''
  if (!filtersReady.value) {
    callsResp.value = null
    loading.value = false
    return
  }
  loading.value = true
  try {
    const resp = await bffFetch<CallsPage>('/calls', {
      query: baseQuery({
        q: search.value.trim() || undefined,
        sort: sortKey.value,
        order: sortDir.value,
        page: page.value,
        pageSize: PAGE_SIZE
      })
    })
    if (seq !== callsSeq) return // resposta obsoleta: um load mais novo já está em andamento
    callsResp.value = resp
  } catch {
    if (seq !== callsSeq) return
    errorMsg.value = 'Falha ao carregar as chamadas.'
    callsResp.value = null
  } finally {
    if (seq === callsSeq) loading.value = false
  }
}

/**
 * Usuários do escopo sem chamada no período (toggle). Passa `from/to` ao
 * endpoint → o `lastCall` vem recortado pelo período, então "sem chamada no
 * período" = `lastCall` ausente (exato, inclusive com `to` no passado).
 */
async function loadNoCalls() {
  if (!includeNoCalls.value || !filtersReady.value) {
    noCallRows.value = []
    noCallsSeq++ // invalida respostas em voo
    return
  }
  const seq = ++noCallsSeq
  // Busca ignora acento e caixa nos dois sentidos ("te" acha "Tétheu" e vice-versa).
  const q = normalizeSearch(search.value.trim())
  const rows: ReportRow[] = []
  for (const s of scopeSubs.value) {
    let users: SubUser[] = []
    try {
      const r = await bffFetch<{ data: SubUser[] }>(`/subaccounts/${s.id}/users`, { query: { limit: USERS_FETCH_LIMIT, ...range.value } })
      users = r.data ?? []
      // Sem contrato de paginação neste endpoint: se vier no teto, pode haver mais
      // usuários não listados — avisa em vez de esconder a truncagem.
      if (users.length >= USERS_FETCH_LIMIT) {
        console.warn(`[relatorio] subconta ${s.id}: lista de usuários pode estar truncada em ${USERS_FETCH_LIMIT}.`)
      }
    } catch {
      users = []
    }
    for (const u of users) {
      if (u.lastCall) continue // teve chamada NO PERÍODO
      if (q && !matchesSearch(u.name, q) && !matchesSearch(s.name, q)) continue
      rows.push({
        id: `nocall-${s.id}-${u.id}`,
        subId: s.id,
        subName: s.name,
        // userId = id do usuário (mesmo espaço de BffCall.userId) para o tint do
        // avatar ficar consistente entre linhas de chamada e "sem ligação".
        userId: u.id,
        userName: u.name,
        date: '',
        duration: 0,
        number: '',
        cause: null,
        recording: null
      })
    }
  }
  if (seq === noCallsSeq) noCallRows.value = rows
}

/* ----- derivados para o template ----- */
const emptyStateMessage = computed(() => {
  if (customRangePending.value) return 'Escolha a data inicial e a data final para ver as chamadas do período.'
  if (customRangeInvalid.value) return 'Corrija o intervalo: a data inicial deve ser anterior à data final.'
  if (loading.value) return 'Carregando…'
  return errorMsg.value || 'Nenhuma chamada encontrada com os filtros aplicados.'
})

const total = computed(() => callsResp.value?.total ?? 0)
const totalPages = computed(() => callsResp.value?.pages ?? 1)
const mappedCalls = computed(() => (callsResp.value?.data ?? []).map(toRow))
// Linhas "sem ligação" aparecem ao fim da última página.
const pagedCalls = computed<ReportRow[]>(() => {
  const base = mappedCalls.value
  const isLast = page.value >= totalPages.value
  return includeNoCalls.value && isLast ? [...base, ...noCallRows.value] : base
})

/* ----- ordenação (server-side) ----- */
function toggleSort(key: 'date' | 'duration' | 'user') {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'date' ? 'desc' : 'asc'
  }
  page.value = 1
  loadCalls()
}

function sortIcon(key: 'date' | 'duration' | 'user'): string {
  if (sortKey.value !== key) return 'i-lucide-chevrons-up-down'
  return sortDir.value === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'
}

/* ----- KPIs (do /reports/summary) ----- */
const kpis = computed(() => {
  const s = summary.value
  const subCount = selectedSet.value.size === 0 ? (s?.subaccounts ?? scopeSubs.value.length) : scopeSubs.value.length
  const usersTotal = s?.usersTotal ?? 0
  const active = s?.active7d ?? 0
  const inactive = s?.inactive ?? 0
  return [
    { label: 'Subcontas', icon: 'i-lucide-building-2', iconClass: 'bg-primary/10 text-primary', value: String(subCount), sub: selectedSet.value.size === 0 ? 'na sua base' : 'selecionada(s)' },
    { label: 'Usuários', icon: 'i-lucide-users', iconClass: 'bg-purple-50 text-purple-600', value: fmt(usersTotal), sub: 'cadastrados' },
    { label: 'Ativos (7d)', icon: 'i-lucide-phone-call', iconClass: 'bg-emerald-50 text-emerald-600', value: `${active} de ${usersTotal}`, sub: inactive > 0 ? `${inactive} sem ligar há +7 dias` : 'todos ligaram nos últimos 7 dias' },
    { label: 'Volume', icon: 'i-lucide-activity', iconClass: 'bg-primary/10 text-primary', value: fmt(s?.volumeMinutes ?? 0), sub: 'minutos no período' },
    { label: 'Taxa de atendimento', icon: 'i-lucide-phone-incoming', iconClass: 'bg-amber-50 text-amber-600', value: `${s?.answerRate ?? 0}%`, sub: `${s?.callsInPeriod ?? 0} chamadas no período` }
  ]
})

/* ----- carregamento + reatividade (client-side; token no cookie) ----- */
onMounted(async () => {
  await loadSubaccounts()
  await Promise.all([loadSummary(), loadCalls(), loadNoCalls()])
})

watch([periodo, subSelection, customStart, customEnd], () => {
  page.value = 1
  loadSummary()
  loadCalls()
  loadNoCalls()
}, { deep: true })

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadCalls()
    loadNoCalls()
  }, 350)
})

watch(includeNoCalls, () => loadNoCalls())

/* ----- filtros: chips + limpar ----- */
const hasActiveFilters = computed(() =>
  periodo.value !== '30d' || subSelection.value.length > 0 || search.value.trim() !== ''
)
function clearFilters() {
  periodo.value = '30d'
  subSelection.value = []
  search.value = ''
  customStart.value = ''
  customEnd.value = ''
}

const activeFilterCount = computed(() => (periodo.value !== '30d' ? 1 : 0))

function periodoChipLabel(): string {
  if (periodo.value === 'custom') {
    const f = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('pt-BR')
    return `${customStart.value ? f(customStart.value) : '…'} – ${customEnd.value ? f(customEnd.value) : '…'}`
  }
  return periodoItems.find(i => i.value === periodo.value)?.label ?? ''
}

const activeFilterChips = computed(() => {
  const chips: { key: string, label: string, clear: () => void }[] = []
  if (periodo.value !== '30d') {
    chips.push({
      key: 'periodo',
      label: `Período: ${periodoChipLabel()}`,
      clear: () => {
        periodo.value = '30d'
      }
    })
  }
  for (const id of subSelection.value) {
    chips.push({
      key: `sub:${id}`,
      label: nameById.value.get(id) ?? id,
      clear: () => { subSelection.value = subSelection.value.filter(x => x !== id) }
    })
  }
  return chips
})

/* ----- persistência dos filtros na URL ----- */
const route = useRoute()
const router = useRouter()
{
  const q = route.query
  if (typeof q.q === 'string') search.value = q.q
  if (['all', 'today', '7d', '30d', 'month', 'custom'].includes(q.periodo as string)) periodo.value = q.periodo as Periodo
  if (typeof q.sub === 'string' && q.sub) subSelection.value = q.sub.split(',')
  if (typeof q.de === 'string') customStart.value = q.de
  if (typeof q.ate === 'string') customEnd.value = q.ate
}
watch([search, periodo, subSelection, customStart, customEnd], () => {
  const query: Record<string, string> = {}
  if (search.value.trim()) query.q = search.value.trim()
  if (periodo.value !== '30d') query.periodo = periodo.value
  if (subSelection.value.length) query.sub = subSelection.value.join(',')
  if (periodo.value === 'custom' && customStart.value) query.de = customStart.value
  if (periodo.value === 'custom' && customEnd.value) query.ate = customEnd.value
  router.replace({ query })
}, { deep: true })

/* ----- exportar CSV (busca todas as páginas do filtro atual) ----- */
function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`
}

async function exportCsv() {
  if (exporting.value || total.value === 0) return
  exporting.value = true
  try {
    const rows: ReportRow[] = []
    let p = 1
    let pages = 1
    let truncated = false
    do {
      const r = await bffFetch<CallsPage>('/calls', {
        query: baseQuery({ q: search.value.trim() || undefined, sort: sortKey.value, order: sortDir.value, page: p, pageSize: EXPORT_PAGE_SIZE })
      })
      rows.push(...(r.data ?? []).map(toRow))
      pages = r.pages || 1
      p++
      // Teto de páginas: não trava o browser num export gigante. Se atingir, avisa.
      if (p > EXPORT_MAX_PAGES && p <= pages) {
        truncated = true
        break
      }
    } while (p <= pages)
    rows.push(...noCallRows.value)

    const headers = ['Usuário', 'Subconta', 'Data da ligação', 'Duração (s)', 'Número discado', 'Causa do desligamento', 'Link da gravação']
    const lines = rows.map(c => [
      c.userName ?? '',
      c.subName ?? '',
      c.date ? fmtCallDate(c.date) : 'Sem ligação',
      c.duration || '',
      c.number,
      c.cause ? CAUSE_BADGE[c.cause].label : 'Sem ligação',
      c.recording ?? ''
    ].map(csvCell).join(';'))

    const csv = [headers.map(csvCell).join(';'), ...lines].join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    const scope = subSelection.value.length === 0
      ? 'todas'
      : subSelection.value.length === 1 ? subSelection.value[0]!.toLowerCase() : `${subSelection.value.length}-subcontas`
    a.href = url
    a.download = `relatorio-chamadas-${scope}-${stamp}.csv`
    a.click()
    URL.revokeObjectURL(url)

    if (truncated) {
      toast.add({
        title: 'Exportação parcial',
        description: `Foram exportadas as primeiras ${EXPORT_MAX_PAGES * EXPORT_PAGE_SIZE} chamadas. Refine o filtro para exportar o restante.`,
        icon: 'i-lucide-triangle-alert',
        color: 'warning'
      })
    }
  } catch {
    toast.add({ title: 'Falha ao exportar', description: 'Não foi possível gerar o CSV. Tente novamente.', icon: 'i-lucide-triangle-alert', color: 'error' })
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <PortalTopbar title="Relatórios" />

  <div class="flex-1 overflow-y-auto px-7 pb-12 pt-7">
    <div class="mx-auto max-w-[1240px]">
      <!-- Cabeçalho -->
      <div class="mb-[22px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="mb-1.5 text-xs font-semibold tracking-wide text-primary">
            Portal do Parceiro
          </p>
          <h1 class="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Relatório de chamadas
          </h1>
          <p class="text-sm text-muted">
            Detalhamento de chamadas por subconta · KPIs e listagem com exportação
          </p>
        </div>
        <div class="flex flex-col items-stretch gap-2">
          <UButton
            icon="i-lucide-download"
            color="neutral"
            variant="outline"
            :disabled="total === 0 || exporting"
            :loading="exporting"
            @click="exportCsv"
          >
            {{ exporting ? 'Exportando…' : 'Exportar CSV' }}
          </UButton>
          <UButton
            icon="i-lucide-plug-zap"
            color="primary"
            variant="soft"
            disabled
          >
            Acessar via MCP
            <UBadge
              color="primary"
              variant="solid"
              size="xs"
              class="ml-1"
            >
              Em breve
            </UBadge>
          </UButton>
        </div>
      </div>

      <!-- Filtros (mesmo molde do detalhe da subconta) -->
      <UCard
        class="mb-4"
        :ui="{ body: 'p-4' }"
      >
        <div class="flex flex-wrap items-center gap-2.5">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Buscar por usuário, número ou subconta"
            class="min-w-[200px] flex-1 sm:w-[280px] sm:flex-none"
          />
          <USelectMenu
            v-model="subSelection"
            :items="subItems"
            value-key="value"
            multiple
            icon="i-lucide-building-2"
            placeholder="Todas as subcontas"
            :search-input="{ placeholder: 'Buscar subconta…' }"
            :ui="{ trailingIcon: 'shrink-0' }"
            class="w-[240px]"
          >
            <template #default>
              <span
                v-if="subSelection.length === 0"
                class="text-dimmed"
              >Todas as subcontas</span>
              <span
                v-else-if="subSelection.length === 1"
                class="truncate"
              >{{ nameById.get(subSelection[0]!) ?? subSelection[0] }}</span>
              <span v-else>{{ subSelection.length }} subcontas</span>
            </template>
          </USelectMenu>
          <UPopover>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-list-filter"
              trailing-icon="i-lucide-chevron-down"
            >
              Filtrar
              <UBadge
                v-if="activeFilterCount"
                color="primary"
                variant="solid"
                size="sm"
                class="ml-0.5"
              >
                {{ activeFilterCount }}
              </UBadge>
            </UButton>
            <template #content>
              <div class="w-[300px] p-3.5">
                <div class="mb-3 flex items-center justify-between">
                  <span class="text-[11px] font-semibold uppercase tracking-wider text-dimmed">Filtrar chamadas</span>
                  <UButton
                    v-if="activeFilterCount"
                    color="neutral"
                    variant="link"
                    size="xs"
                    class="-mr-2"
                    @click="clearFilters"
                  >
                    Limpar tudo
                  </UButton>
                </div>

                <PortalFilterPills
                  v-model="periodo"
                  label="Período"
                  :items="periodoItems"
                  :class="periodo === 'custom' ? 'mb-2.5' : ''"
                />
                <div
                  v-if="periodo === 'custom'"
                  class="space-y-2"
                >
                  <div class="flex items-center gap-2">
                    <UInput
                      v-model="customStart"
                      type="date"
                      :max="customEnd || undefined"
                      size="sm"
                      class="flex-1"
                      aria-label="Data inicial"
                    />
                    <span class="text-xs text-dimmed">até</span>
                    <UInput
                      v-model="customEnd"
                      type="date"
                      :min="customStart || undefined"
                      size="sm"
                      class="flex-1"
                      aria-label="Data final"
                    />
                  </div>
                  <p
                    v-if="customRangeInvalid"
                    class="inline-flex items-center gap-1.5 text-xs font-medium text-error"
                  >
                    <UIcon
                      name="i-lucide-triangle-alert"
                      class="h-3.5 w-3.5"
                    />
                    A data inicial deve ser anterior à data final.
                  </p>
                </div>
              </div>
            </template>
          </UPopover>
          <div class="flex-1" />
          <USwitch
            v-model="includeNoCalls"
            label="Incluir sem chamadas"
            size="sm"
          />
        </div>
        <PortalFilterChips
          :chips="activeFilterChips"
          class="mt-3"
          @clear-all="clearFilters"
        />
      </UCard>

      <!-- KPIs -->
      <div class="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <UCard
          v-for="k in kpis"
          :key="k.label"
          :ui="{ body: 'p-5' }"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-[13px] font-semibold text-muted">{{ k.label }}</span>
            <div
              class="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
              :class="k.iconClass"
            >
              <UIcon
                :name="k.icon"
                class="h-[18px] w-[18px]"
              />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-bold tracking-tight">
              {{ k.value }}
            </div>
            <div class="mt-2 text-xs text-dimmed">
              {{ k.sub }}
            </div>
          </div>
        </UCard>
      </div>

      <!-- Tabela -->
      <UCard :ui="{ body: 'p-0' }">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-bold tracking-tight">
                Detalhamento de chamadas
              </h2>
              <p class="text-xs text-dimmed">
                Chamadas no período e subcontas selecionados
              </p>
            </div>
            <span class="text-xs text-dimmed">
              <span class="font-semibold text-muted">{{ total }}</span> chamada{{ total === 1 ? '' : 's' }}<template v-if="noCallRows.length"> · {{ noCallRows.length }} sem ligação</template>
            </span>
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[900px] border-collapse">
            <caption class="sr-only">
              Detalhamento de chamadas com usuário, data, duração, número discado, causa de desligamento e gravação
            </caption>
            <thead>
              <tr class="bg-muted/50">
                <th
                  scope="col"
                  class="px-[22px] py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed"
                >
                  <button
                    type="button"
                    class="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase tracking-wider transition-colors hover:text-default"
                    :class="sortKey === 'user' ? 'text-default' : ''"
                    @click="toggleSort('user')"
                  >
                    Usuário
                    <UIcon
                      :name="sortIcon('user')"
                      class="h-3.5 w-3.5"
                    />
                  </button>
                </th>
                <th
                  scope="col"
                  class="px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed"
                >
                  <button
                    type="button"
                    class="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase tracking-wider transition-colors hover:text-default"
                    :class="sortKey === 'date' ? 'text-default' : ''"
                    @click="toggleSort('date')"
                  >
                    Data da ligação
                    <UIcon
                      :name="sortIcon('date')"
                      class="h-3.5 w-3.5"
                    />
                  </button>
                </th>
                <th
                  scope="col"
                  class="px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed"
                >
                  <button
                    type="button"
                    class="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase tracking-wider transition-colors hover:text-default"
                    :class="sortKey === 'duration' ? 'text-default' : ''"
                    @click="toggleSort('duration')"
                  >
                    Duração
                    <UIcon
                      :name="sortIcon('duration')"
                      class="h-3.5 w-3.5"
                    />
                  </button>
                </th>
                <th
                  scope="col"
                  class="px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed"
                >
                  Número discado
                </th>
                <th
                  scope="col"
                  class="px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed"
                >
                  Causa do desligamento
                </th>
                <th
                  scope="col"
                  class="px-3.5 py-3 pr-[22px] text-right text-[11px] font-semibold uppercase tracking-wider text-dimmed"
                >
                  Gravação
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="c in pagedCalls"
                :key="c.id"
                class="border-t border-default hover:bg-muted/40"
                :class="{ 'opacity-60': !c.date }"
              >
                <td class="py-3 pl-[22px] pr-3.5">
                  <div class="flex items-center gap-2.5">
                    <div
                      class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold"
                      :class="avatarTint(c.userId ?? '')"
                    >
                      {{ initials(c.userName ?? '') }}
                    </div>
                    <div class="min-w-0">
                      <div class="truncate text-[13px] font-semibold">
                        {{ c.userName }}
                      </div>
                      <div
                        v-if="showSubName"
                        class="truncate text-[11px] text-dimmed"
                      >
                        {{ c.subName }}
                      </div>
                    </div>
                  </div>
                </td>
                <td
                  class="whitespace-nowrap px-3.5 py-3 text-[13px]"
                  :class="c.date ? 'text-muted' : 'text-dimmed'"
                >
                  {{ c.date ? fmtCallDate(c.date) : '—' }}
                </td>
                <td
                  class="px-3.5 py-3 text-[13px]"
                  :class="c.duration ? 'font-semibold' : 'text-dimmed'"
                >
                  {{ fmtDuration(c.duration) }}
                </td>
                <td class="px-3.5 py-3">
                  <span class="font-mono text-[13px] text-muted">{{ c.number || '—' }}</span>
                </td>
                <td class="px-3.5 py-3">
                  <UBadge
                    v-if="c.cause"
                    :color="CAUSE_BADGE[c.cause].color"
                    variant="subtle"
                  >
                    {{ CAUSE_BADGE[c.cause].label }}
                  </UBadge>
                  <UBadge
                    v-else
                    color="neutral"
                    variant="subtle"
                  >
                    Sem ligação
                  </UBadge>
                </td>
                <td class="py-3 pl-3.5 pr-[22px] text-right">
                  <UButton
                    v-if="c.recording"
                    :to="c.recording"
                    target="_blank"
                    color="neutral"
                    variant="outline"
                    size="xs"
                    icon="i-lucide-play"
                  >
                    Ouvir
                  </UButton>
                  <span
                    v-else
                    class="text-xs text-dimmed"
                  >—</span>
                </td>
              </tr>
              <tr
                v-if="pagedCalls.length === 0"
                class="border-t border-default"
              >
                <td
                  colspan="6"
                  class="px-[22px] py-12 text-center"
                >
                  <p class="text-[13px] text-dimmed">
                    {{ emptyStateMessage }}
                  </p>
                  <UButton
                    v-if="hasActiveFilters && !loading && filtersReady"
                    class="mt-2.5"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    icon="i-lucide-x"
                    @click="clearFilters"
                  >
                    Limpar filtros
                  </UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <template #footer>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <span class="text-xs text-dimmed">
              Página {{ page }} de {{ totalPages }}
            </span>
            <UPagination
              v-if="totalPages > 1"
              v-model:page="page"
              :total="total"
              :items-per-page="PAGE_SIZE"
              :sibling-count="1"
              size="sm"
              @update:page="() => loadCalls()"
            />
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
