<script setup lang="ts">
import { avatarTint, buildUsuarios, fmt, initials } from '~/lib/contas'
import {
  buildCalls,
  CAUSE_BADGE,
  fmtCallDate,
  fmtDuration,
  type CallRecord,
  type HangupCause
} from '~/lib/relatorio'

/**
 * Linha da tabela: uma chamada real (CallRecord) ou um usuário sem nenhuma
 * chamada no recorte (cause = null, date vazio) quando o toggle está ligado.
 */
type ReportRow = Omit<CallRecord, 'cause'> & { cause: HangupCause | null }

const { all } = useSubcontas()

/* ----- dataset de chamadas (regenera só quando a lista de subcontas muda) ----- */
const allCalls = computed(() => all.value.flatMap(buildCalls))

const DAY = 86400000

/* ----- filtros: período + subconta (+ busca auxiliar) ----- */
type Periodo = 'all' | 'today' | '7d' | '30d' | 'month' | 'custom'

const periodo = ref<Periodo>('30d')
// Subcontas selecionadas (ids). Vazio = todas.
const subSelection = ref<string[]>([])
const search = ref('')
const customStart = ref('')
const customEnd = ref('')
// Acrescenta linhas dos usuários do escopo que não ligaram no período.
const includeNoCalls = ref(false)

const periodoItems: { label: string, value: Periodo }[] = [
  { label: 'Qualquer data', value: 'all' },
  { label: 'Hoje', value: 'today' },
  { label: 'Últimos 7 dias', value: '7d' },
  { label: 'Últimos 30 dias', value: '30d' },
  { label: 'Este mês', value: 'month' },
  { label: 'Personalizado', value: 'custom' }
]

const subItems = computed(() => all.value.map(s => ({ label: s.name, value: s.id })))

// Limpa o intervalo ao sair de "Personalizado".
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

/** Uma chamada cai dentro do período selecionado? */
function withinPeriodo(iso: string): boolean {
  if (periodo.value === 'all') return true
  const t = new Date(iso).getTime()
  if (periodo.value === 'custom') {
    if (customRangeInvalid.value) return false
    if (customStart.value && t < new Date(`${customStart.value}T00:00:00`).getTime()) return false
    if (customEnd.value && t > new Date(`${customEnd.value}T23:59:59`).getTime()) return false
    return true
  }
  if (periodo.value === 'month') {
    const now = new Date()
    return t >= new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  }
  const diff = Date.now() - t
  if (periodo.value === 'today') return diff < DAY
  return periodo.value === '7d' ? diff < 7 * DAY : diff < 30 * DAY
}

/* ----- recortes em cascata: subconta → período → busca ----- */
// Seleção vazia = todas as subcontas.
const selectedSet = computed(() => new Set(subSelection.value))

const scopeSubs = computed(() =>
  selectedSet.value.size === 0 ? all.value : all.value.filter(s => selectedSet.value.has(s.id))
)

// Mostra o nome da subconta na linha quando o escopo cobre mais de uma.
const showSubName = computed(() => scopeSubs.value.length > 1)

// Chamadas das subcontas no escopo (sem período) — base das KPIs de "ativos 7d".
const scopeCalls = computed(() => {
  if (selectedSet.value.size === 0) return allCalls.value
  return allCalls.value.filter(c => selectedSet.value.has(c.subId))
})

// Respeita período + subconta (KPIs de volume/atendimento e a tabela usam isto).
const periodCalls = computed(() => scopeCalls.value.filter(c => withinPeriodo(c.date)))

// Busca auxiliar (usuário ou número) — refina só a tabela exibida.
const filteredCalls = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return periodCalls.value
  return periodCalls.value.filter(c =>
    c.userName.toLowerCase().includes(q)
    || c.number.toLowerCase().includes(q)
    || c.subName.toLowerCase().includes(q)
  )
})

// Usuários do escopo sem nenhuma chamada no período (toggle "incluir sem chamadas").
const noCallRows = computed<ReportRow[]>(() => {
  if (!includeNoCalls.value) return []
  const withCalls = new Set(periodCalls.value.map(c => c.userId))
  const q = search.value.trim().toLowerCase()
  const rows: ReportRow[] = []
  for (const s of scopeSubs.value) {
    for (const u of buildUsuarios(s)) {
      if (withCalls.has(u.id)) continue
      if (q && !u.name.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) continue
      rows.push({
        id: `nocall-${s.id}-${u.id}`,
        subId: s.id,
        subName: s.name,
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
  return rows
})

/* ----- KPIs ----- */
const totalUsers = computed(() => scopeSubs.value.reduce((sum, s) => sum + s.users, 0))

// Usuários que ligaram nos últimos 7 dias (inativo = sem ligar há +7 dias).
const ativos7d = computed(() => {
  const cutoff = Date.now() - 7 * DAY
  const ids = new Set<string>()
  for (const c of scopeCalls.value) {
    if (new Date(c.date).getTime() >= cutoff) ids.add(c.userId)
  }
  return ids.size
})
const inativos = computed(() => Math.max(0, totalUsers.value - ativos7d.value))

const volumeMin = computed(() =>
  Math.round(periodCalls.value.reduce((sum, c) => sum + c.duration, 0) / 60)
)

const taxaAtend = computed(() => {
  const total = periodCalls.value.length
  if (!total) return 0
  const atendidas = periodCalls.value.filter(c => c.cause === 'atendida').length
  return Math.round((atendidas / total) * 100)
})

const kpis = computed(() => [
  { label: 'Subcontas', icon: 'i-lucide-building-2', iconClass: 'bg-primary/10 text-primary', value: String(scopeSubs.value.length), sub: selectedSet.value.size === 0 ? 'na sua base' : 'selecionada(s)' },
  { label: 'Usuários', icon: 'i-lucide-users', iconClass: 'bg-purple-50 text-purple-600', value: fmt(totalUsers.value), sub: 'cadastrados' },
  { label: 'Ativos (7d)', icon: 'i-lucide-phone-call', iconClass: 'bg-emerald-50 text-emerald-600', value: `${ativos7d.value} de ${totalUsers.value}`, sub: inativos.value > 0 ? `${inativos.value} sem ligar há +7 dias` : 'todos ligaram nos últimos 7 dias' },
  { label: 'Volume', icon: 'i-lucide-activity', iconClass: 'bg-primary/10 text-primary', value: fmt(volumeMin.value), sub: 'minutos no período' },
  { label: 'Taxa de atendimento', icon: 'i-lucide-phone-incoming', iconClass: 'bg-amber-50 text-amber-600', value: `${taxaAtend.value}%`, sub: `${periodCalls.value.length} chamadas no período` }
])

/* ----- ordenação ----- */
type SortKey = 'date' | 'duration' | 'user'
const sortKey = ref<SortKey>('date')
const sortDir = ref<'asc' | 'desc'>('desc')

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'date' ? 'desc' : 'asc'
  }
}

function sortIcon(key: SortKey): string {
  if (sortKey.value !== key) return 'i-lucide-chevrons-up-down'
  return sortDir.value === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'
}

const displayCalls = computed<ReportRow[]>(() => {
  const arr: ReportRow[] = [...filteredCalls.value, ...noCallRows.value]
  const dir = sortDir.value === 'asc' ? 1 : -1
  return arr.sort((a, b) => {
    if (sortKey.value === 'user') return a.userName.localeCompare(b.userName, 'pt-BR') * dir
    // Linhas "sem ligação" (sem data) vão sempre para o fim.
    if (!a.date && !b.date) return a.userName.localeCompare(b.userName, 'pt-BR')
    if (!a.date) return 1
    if (!b.date) return -1
    if (sortKey.value === 'duration') return (a.duration - b.duration) * dir
    return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir
  })
})

/* ----- paginação ----- */
const PAGE_SIZE = 15
const page = ref(1)
const pagedCalls = computed(() =>
  displayCalls.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)
)
watch(() => displayCalls.value.length, () => { page.value = 1 })

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

/* ----- chips de filtros ativos + contador do popover (estilo detalhe) ----- */
// Badge do botão "Filtrar" conta só o que está dentro do popover (período).
const activeFilterCount = computed(() => (periodo.value !== '30d' ? 1 : 0))

function periodoChipLabel(): string {
  if (periodo.value === 'custom') {
    const f = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('pt-BR')
    return `${customStart.value ? f(customStart.value) : '…'} – ${customEnd.value ? f(customEnd.value) : '…'}`
  }
  return periodoItems.find(i => i.value === periodo.value)?.label ?? ''
}

const nameById = computed(() => new Map(all.value.map(s => [s.id, s.name])))

const activeFilterChips = computed(() => {
  const chips: { key: string, label: string, clear: () => void }[] = []
  if (periodo.value !== '30d') {
    chips.push({ key: 'periodo', label: `Período: ${periodoChipLabel()}`, clear: () => { periodo.value = '30d' } })
  }
  // Um chip por subconta selecionada (remove só aquela).
  for (const id of subSelection.value) {
    chips.push({
      key: `sub:${id}`,
      label: nameById.value.get(id) ?? id,
      clear: () => { subSelection.value = subSelection.value.filter(x => x !== id) }
    })
  }
  return chips
})

/* ----- persistência dos filtros na URL (compartilhável / sobrevive a reload) ----- */
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

/* ----- exportar CSV (lado do cliente, separador ; para Excel pt-BR) ----- */
function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`
}

function exportCsv() {
  const headers = ['Usuário', 'Subconta', 'Data da ligação', 'Duração (s)', 'Número discado', 'Causa do desligamento', 'Link da gravação']
  const lines = displayCalls.value.map(c => [
    c.userName,
    c.subName,
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
}
</script>

<template>
  <PortalTopbar title="Relatórios" />

  <div class="flex-1 overflow-y-auto px-7 pb-12 pt-7">
    <div class="mx-auto max-w-[1240px]">
      <!-- Cabeçalho -->
      <div class="mb-[22px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">Relatório de chamadas</h1>
          <p class="text-sm text-muted">Detalhamento de chamadas por subconta · KPIs e listagem com exportação</p>
        </div>
        <div class="flex flex-col items-stretch gap-2">
          <UButton icon="i-lucide-download" color="neutral" variant="outline" :disabled="displayCalls.length === 0" @click="exportCsv">
            Exportar CSV
          </UButton>
          <UButton icon="i-lucide-plug-zap" color="primary" variant="soft" disabled>
            Acessar via MCP
            <UBadge color="primary" variant="solid" size="xs" class="ml-1">Em breve</UBadge>
          </UButton>
        </div>
      </div>

      <!-- Filtros (mesmo molde do detalhe da subconta) -->
      <UCard class="mb-4" :ui="{ body: 'p-4' }">
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
              <span v-if="subSelection.length === 0" class="text-dimmed">Todas as subcontas</span>
              <span v-else-if="subSelection.length === 1" class="truncate">{{ nameById.get(subSelection[0]!) ?? subSelection[0] }}</span>
              <span v-else>{{ subSelection.length }} subcontas</span>
            </template>
          </USelectMenu>
          <UPopover>
            <UButton color="neutral" variant="outline" icon="i-lucide-list-filter" trailing-icon="i-lucide-chevron-down">
              Filtrar
              <UBadge v-if="activeFilterCount" color="primary" variant="solid" size="sm" class="ml-0.5">
                {{ activeFilterCount }}
              </UBadge>
            </UButton>
            <template #content>
              <div class="w-[300px] p-3.5">
                <div class="mb-3 flex items-center justify-between">
                  <span class="text-[11px] font-semibold uppercase tracking-wider text-dimmed">Filtrar chamadas</span>
                  <UButton v-if="activeFilterCount" color="neutral" variant="link" size="xs" class="-mr-2" @click="clearFilters">
                    Limpar tudo
                  </UButton>
                </div>

                <PortalFilterPills
                  v-model="periodo"
                  label="Período"
                  :items="periodoItems"
                  :class="periodo === 'custom' ? 'mb-2.5' : ''"
                />
                <div v-if="periodo === 'custom'" class="space-y-2">
                  <div class="flex items-center gap-2">
                    <UInput v-model="customStart" type="date" :max="customEnd || undefined" size="sm" class="flex-1" aria-label="Data inicial" />
                    <span class="text-xs text-dimmed">até</span>
                    <UInput v-model="customEnd" type="date" :min="customStart || undefined" size="sm" class="flex-1" aria-label="Data final" />
                  </div>
                  <p v-if="customRangeInvalid" class="inline-flex items-center gap-1.5 text-xs font-medium text-error">
                    <UIcon name="i-lucide-triangle-alert" class="h-3.5 w-3.5" />
                    A data inicial deve ser anterior à data final.
                  </p>
                </div>
              </div>
            </template>
          </UPopover>
          <div class="flex-1" />
          <USwitch v-model="includeNoCalls" label="Incluir sem chamadas" size="sm" />
        </div>
        <PortalFilterChips :chips="activeFilterChips" class="mt-3" @clear-all="clearFilters" />
      </UCard>

      <!-- KPIs -->
      <div class="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <UCard v-for="k in kpis" :key="k.label" :ui="{ body: 'p-5' }">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[13px] font-semibold text-muted">{{ k.label }}</span>
            <div class="grid h-9 w-9 shrink-0 place-items-center rounded-lg" :class="k.iconClass">
              <UIcon :name="k.icon" class="h-[18px] w-[18px]" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-bold tracking-tight">{{ k.value }}</div>
            <div class="mt-2 text-xs text-dimmed">{{ k.sub }}</div>
          </div>
        </UCard>
      </div>

      <!-- Tabela -->
      <UCard :ui="{ body: 'p-0' }">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-bold tracking-tight">Detalhamento de chamadas</h2>
              <p class="text-xs text-dimmed">Chamadas no período e subcontas selecionados</p>
            </div>
            <span class="text-xs text-dimmed">
              <span class="font-semibold text-muted">{{ filteredCalls.length }}</span> chamada{{ filteredCalls.length === 1 ? '' : 's' }}<template v-if="noCallRows.length"> · {{ noCallRows.length }} sem ligação</template>
            </span>
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[900px] border-collapse">
            <caption class="sr-only">Detalhamento de chamadas com usuário, data, duração, número discado, causa de desligamento e gravação</caption>
            <thead>
              <tr class="bg-muted/50">
                <th scope="col" class="px-[22px] py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">
                  <button type="button" class="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase tracking-wider transition-colors hover:text-default" :class="sortKey === 'user' ? 'text-default' : ''" @click="toggleSort('user')">
                    Usuário
                    <UIcon :name="sortIcon('user')" class="h-3.5 w-3.5" />
                  </button>
                </th>
                <th scope="col" class="px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">
                  <button type="button" class="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase tracking-wider transition-colors hover:text-default" :class="sortKey === 'date' ? 'text-default' : ''" @click="toggleSort('date')">
                    Data da ligação
                    <UIcon :name="sortIcon('date')" class="h-3.5 w-3.5" />
                  </button>
                </th>
                <th scope="col" class="px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">
                  <button type="button" class="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase tracking-wider transition-colors hover:text-default" :class="sortKey === 'duration' ? 'text-default' : ''" @click="toggleSort('duration')">
                    Duração
                    <UIcon :name="sortIcon('duration')" class="h-3.5 w-3.5" />
                  </button>
                </th>
                <th scope="col" class="px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">Número discado</th>
                <th scope="col" class="px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">Causa do desligamento</th>
                <th scope="col" class="px-3.5 py-3 pr-[22px] text-right text-[11px] font-semibold uppercase tracking-wider text-dimmed">Gravação</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in pagedCalls" :key="c.id" class="border-t border-default hover:bg-muted/40" :class="{ 'opacity-60': !c.date }">
                <td class="py-3 pl-[22px] pr-3.5">
                  <div class="flex items-center gap-2.5">
                    <div class="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-bold" :class="avatarTint(c.userId)">
                      {{ initials(c.userName) }}
                    </div>
                    <div class="min-w-0">
                      <div class="truncate text-[13px] font-semibold">{{ c.userName }}</div>
                      <div v-if="showSubName" class="truncate text-[11px] text-dimmed">{{ c.subName }}</div>
                    </div>
                  </div>
                </td>
                <td class="whitespace-nowrap px-3.5 py-3 text-[13px]" :class="c.date ? 'text-muted' : 'text-dimmed'">{{ c.date ? fmtCallDate(c.date) : '—' }}</td>
                <td class="px-3.5 py-3 text-[13px]" :class="c.duration ? 'font-semibold' : 'text-dimmed'">{{ fmtDuration(c.duration) }}</td>
                <td class="px-3.5 py-3">
                  <span class="font-mono text-[13px] text-muted">{{ c.number || '—' }}</span>
                </td>
                <td class="px-3.5 py-3">
                  <UBadge v-if="c.cause" :color="CAUSE_BADGE[c.cause].color" variant="subtle">{{ CAUSE_BADGE[c.cause].label }}</UBadge>
                  <UBadge v-else color="neutral" variant="subtle">Sem ligação</UBadge>
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
                  <span v-else class="text-xs text-dimmed">—</span>
                </td>
              </tr>
              <tr v-if="displayCalls.length === 0" class="border-t border-default">
                <td colspan="6" class="px-[22px] py-12 text-center">
                  <p class="text-[13px] text-dimmed">Nenhuma chamada encontrada com os filtros aplicados.</p>
                  <UButton v-if="hasActiveFilters" class="mt-2.5" color="neutral" variant="outline" size="sm" icon="i-lucide-x" @click="clearFilters">
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
              Página {{ page }} de {{ Math.max(1, Math.ceil(displayCalls.length / PAGE_SIZE)) }}
            </span>
            <UPagination
              v-if="displayCalls.length > PAGE_SIZE"
              v-model:page="page"
              :total="displayCalls.length"
              :items-per-page="PAGE_SIZE"
              :sibling-count="1"
              size="sm"
            />
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
