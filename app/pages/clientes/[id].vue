<script setup lang="ts">
import {
  API_KEY,
  avatarTint,
  buildMeta,
  fmt,
  fmtLastCall,
  initials,
  ROLE_BADGE,
  STATUS_BADGE,
  type Usuario,
  type UsuarioRole
} from '~/lib/contas'

// Chave de API e Metadados de Observabilidade estão OCULTOS por ora: os dois cards
// ainda são alimentados por mock (`API_KEY`/`buildMeta` em `lib/contas.ts`) — o BFF
// não expõe esses dados. O código fica no lugar, pronto para religar quando houver
// endpoint real; basta virar esta flag para `true`.
const SHOW_APIKEY_E_METADADOS = false

// Escrita de usuários da subconta (adicionar, trocar tipo de acesso, ativar/desativar)
// está DESABILITADA: o BFF ainda não expõe endpoints de escrita, então essas ações são
// otimistas e LOCAIS — mudam a tela, não mudam nada de verdade e somem no reload. Pior
// que não ter: passam a impressão de que a alteração foi aplicada.
// A UI e os handlers ficam no lugar; virar para `true` quando o BFF expuser a escrita.
const ENABLE_ESCRITA_USUARIOS = false

/* ----- contrato do BFF ----- */
interface BffSubaccount { id: string, name: string, users: number, minutes: number, status: 'active' | 'inactive' }
interface BffSubUser { id: string, name: string, email: string, role: string, active: boolean, lastCall: string | null }
interface Summary { subaccounts: number, usersTotal: number, active7d: number, inactive: number, volumeMinutes: number, answerRate: number, callsInPeriod: number }

const toast = useToast()
const route = useRoute()
const id = route.params.id as string
const { user, bffFetch } = useAuth()
const DAY = 86400000

/* ----- dados reais (BFF) ----- */
const loading = ref(true)
const subconta = ref<BffSubaccount | null>(null)
const usuarios = ref<Usuario[]>([])
const summary = ref<Summary | null>(null)
const novoUsuarioOpen = ref(false)

// Subconta e usuário do BFF vêm em inglês; a UI reaproveita os tipos/badges do mock.
const statusBadge = computed(() => (subconta.value?.status === 'active' ? STATUS_BADGE.ativo : STATUS_BADGE.inativo))
const partnerName = computed(() => user.value?.name || 'a conta principal')
const meta = buildMeta(id)
// Sem campo de cobrança no BFF: a subconta é quem define pré-pago/plano.
const chargeLabel = 'Definido pela subconta'

function mapUser(u: BffSubUser): Usuario {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role === 'admin' ? 'admin' : 'usuario',
    active: u.active,
    lastCall: u.lastCall ?? ''
  }
}

// Volumetria a partir do /reports/summary escopado nesta subconta (últimos 30 dias).
const totalCalls = computed(() => (summary.value ? fmt(summary.value.callsInPeriod) : '—'))
const tma = computed(() => {
  const s = summary.value
  if (!s || !s.callsInPeriod) return '—'
  const secs = Math.round((s.volumeMinutes * 60) / s.callsInPeriod)
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
})

async function loadDetail() {
  loading.value = true
  try {
    const from = new Date(Date.now() - 30 * DAY).toISOString()
    const [subs, usersResp, sum] = await Promise.all([
      bffFetch<BffSubaccount[]>('/subaccounts'),
      bffFetch<{ data: BffSubUser[] }>(`/subaccounts/${id}/users`).catch(() => ({ data: [] as BffSubUser[] })),
      bffFetch<Summary>('/reports/summary', { query: { subaccountId: id, from } }).catch(() => null)
    ])
    subconta.value = subs.find(s => s.id === id) ?? null
    usuarios.value = (usersResp.data ?? []).map(mapUser)
    summary.value = sum
  } catch {
    subconta.value = null
  } finally {
    loading.value = false
  }
  // Subconta fora do escopo do parceiro (ou id inexistente) → volta pro painel.
  if (!subconta.value) await navigateTo('/')
}
onMounted(loadDetail)

const search = ref('')
const roleFilter = ref<'all' | UsuarioRole>('all')
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const dateFilter = ref<'all' | 'today' | '7d' | '30d' | 'month' | 'never' | 'custom'>('all')
const customStart = ref('')
const customEnd = ref('')

// Limpa o intervalo personalizado ao sair de "Personalizado" (evita filtro fantasma).
watch(dateFilter, (v) => {
  if (v !== 'custom') {
    customStart.value = ''
    customEnd.value = ''
  }
})

// Intervalo inválido: início depois do fim (ambos preenchidos).
const customRangeInvalid = computed(() =>
  dateFilter.value === 'custom'
  && !!customStart.value
  && !!customEnd.value
  && customStart.value > customEnd.value
)

type RoleFilter = 'all' | UsuarioRole
type StatusFilter = 'all' | 'active' | 'inactive'
type DateFilter = 'all' | 'today' | '7d' | '30d' | 'month' | 'never' | 'custom'

const roleFilterItems: { label: string, value: RoleFilter }[] = [
  { label: 'Todos os acessos', value: 'all' },
  { label: 'Admin', value: 'admin' },
  { label: 'Usuário', value: 'usuario' }
]
const statusFilterItems: { label: string, value: StatusFilter }[] = [
  { label: 'Todos os status', value: 'all' },
  { label: 'Ativo', value: 'active' },
  { label: 'Desativado', value: 'inactive' }
]
const dateFilterItems: { label: string, value: DateFilter }[] = [
  { label: 'Qualquer data', value: 'all' },
  { label: 'Hoje', value: 'today' },
  { label: 'Últimos 7 dias', value: '7d' },
  { label: 'Últimos 30 dias', value: '30d' },
  { label: 'Este mês', value: 'month' },
  { label: 'Nunca ligou', value: 'never' },
  { label: 'Personalizado', value: 'custom' }
]

function withinLastCall(iso: string): boolean {
  if (dateFilter.value === 'all') return true
  if (dateFilter.value === 'never') return !iso
  if (!iso) return false // nunca ligou: fora de qualquer filtro de período
  const t = new Date(iso).getTime()
  if (dateFilter.value === 'custom') {
    if (customRangeInvalid.value) return false
    if (customStart.value && t < new Date(`${customStart.value}T00:00:00`).getTime()) return false
    if (customEnd.value && t > new Date(`${customEnd.value}T23:59:59`).getTime()) return false
    return true
  }
  if (dateFilter.value === 'month') {
    const now = new Date()
    return t >= new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  }
  const diff = Date.now() - t
  if (dateFilter.value === 'today') return diff < DAY
  if (dateFilter.value === '7d') return diff < 7 * DAY
  return diff < 30 * DAY
}

const hasActiveFilters = computed(() =>
  search.value.trim() !== ''
  || roleFilter.value !== 'all'
  || statusFilter.value !== 'all'
  || dateFilter.value !== 'all'
)

function clearFilters() {
  search.value = ''
  roleFilter.value = 'all'
  statusFilter.value = 'all'
  dateFilter.value = 'all'
  customStart.value = ''
  customEnd.value = ''
}

// Nº de condições ativas (sem contar a busca) — usado no botão "Filtrar".
const activeFilterCount = computed(() =>
  (roleFilter.value !== 'all' ? 1 : 0)
  + (statusFilter.value !== 'all' ? 1 : 0)
  + (dateFilter.value !== 'all' ? 1 : 0)
)

function dateChipLabel(): string {
  if (dateFilter.value === 'custom') {
    const fmt = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('pt-BR')
    return `${customStart.value ? fmt(customStart.value) : '…'} – ${customEnd.value ? fmt(customEnd.value) : '…'}`
  }
  return dateFilterItems.find(i => i.value === dateFilter.value)?.label ?? ''
}

// Condições ativas como chips removíveis (estilo Pipedrive).
const activeFilterChips = computed(() => {
  const chips: { key: string, label: string, clear: () => void }[] = []
  if (roleFilter.value !== 'all') {
    chips.push({
      key: 'role',
      label: `Acesso: ${roleFilterItems.find(i => i.value === roleFilter.value)?.label}`,
      clear: () => {
        roleFilter.value = 'all'
      }
    })
  }
  if (statusFilter.value !== 'all') {
    chips.push({
      key: 'status',
      label: `Status: ${statusFilterItems.find(i => i.value === statusFilter.value)?.label}`,
      clear: () => {
        statusFilter.value = 'all'
      }
    })
  }
  if (dateFilter.value !== 'all') {
    chips.push({
      key: 'date',
      label: `Ligação: ${dateChipLabel()}`,
      clear: () => {
        dateFilter.value = 'all'
      }
    })
  }
  return chips
})

/* ----- persistência dos filtros na URL (compartilhável / sobrevive a reload) ----- */
const router = useRouter()
{
  const q = route.query
  if (typeof q.q === 'string') search.value = q.q
  if (q.acesso === 'admin' || q.acesso === 'usuario') roleFilter.value = q.acesso
  if (q.status === 'active' || q.status === 'inactive') statusFilter.value = q.status
  if (['today', '7d', '30d', 'month', 'never', 'custom'].includes(q.periodo as string)) {
    dateFilter.value = q.periodo as typeof dateFilter.value
  }
  if (typeof q.de === 'string') customStart.value = q.de
  if (typeof q.ate === 'string') customEnd.value = q.ate
}
watch([search, roleFilter, statusFilter, dateFilter, customStart, customEnd], () => {
  const query: Record<string, string> = {}
  if (search.value.trim()) query.q = search.value.trim()
  if (roleFilter.value !== 'all') query.acesso = roleFilter.value
  if (statusFilter.value !== 'all') query.status = statusFilter.value
  if (dateFilter.value !== 'all') query.periodo = dateFilter.value
  if (dateFilter.value === 'custom' && customStart.value) query.de = customStart.value
  if (dateFilter.value === 'custom' && customEnd.value) query.ate = customEnd.value
  router.replace({ query })
})

const filteredUsuarios = computed(() => {
  const q = normalizeSearch(search.value.trim())
  return usuarios.value.filter((u) => {
    // Busca ignora acento e caixa nos dois sentidos ("te" acha "Tétheu" e vice-versa).
    const okSearch = !q || matchesSearch(u.name, q) || matchesSearch(u.email, q)
    const okRole = roleFilter.value === 'all' || u.role === roleFilter.value
    const okStatus = statusFilter.value === 'all'
      || (statusFilter.value === 'active' ? u.active : !u.active)
    return okSearch && okRole && okStatus && withinLastCall(u.lastCall)
  })
})

/* ----- ordenação ----- */
type SortKey = 'name' | 'lastCall'
const sortKey = ref<SortKey | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function sortIcon(key: SortKey): string {
  if (sortKey.value !== key) return 'i-lucide-chevrons-up-down'
  return sortDir.value === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'
}

// Usuários que ligaram nos últimos 30 dias (para o KPI).
const callers30d = computed(() =>
  usuarios.value.filter(u => u.lastCall && Date.now() - new Date(u.lastCall).getTime() < 30 * DAY).length
)

const displayUsuarios = computed(() => {
  const arr = [...filteredUsuarios.value]
  if (!sortKey.value) return arr
  const dir = sortDir.value === 'asc' ? 1 : -1
  return arr.sort((a, b) => {
    if (sortKey.value === 'name') return a.name.localeCompare(b.name, 'pt-BR') * dir
    // "Nunca ligou" (vazio) vai sempre para o fim, independente da direção.
    if (!a.lastCall) return 1
    if (!b.lastCall) return -1
    return (new Date(a.lastCall).getTime() - new Date(b.lastCall).getTime()) * dir
  })
})

/* ----- paginação ----- */
const PAGE_SIZE = 10
const page = ref(1)
const pagedUsuarios = computed(() =>
  displayUsuarios.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)
)
// Volta para a 1ª página quando o conjunto filtrado/ordenado encolhe ou muda.
watch(() => displayUsuarios.value.length, () => {
  page.value = 1
})

const roleItems = [
  { label: 'Usuário', value: 'usuario' },
  { label: 'Admin', value: 'admin' }
]

// Mutações de usuário são otimistas e locais (sessão): o BFF ainda não expõe
// endpoints de escrita de usuários da subconta. Somem ao recarregar.
function setUserRole(userId: string, role: UsuarioRole) {
  usuarios.value = usuarios.value.map(x => (x.id === userId ? { ...x, role } : x))
}

function onUsuarioCriado(u: Usuario) {
  usuarios.value = [u, ...usuarios.value]
  // Garante que o novo usuário fique visível (não escondido por um filtro ativo).
  if (hasActiveFilters.value) clearFilters()
  toast.add({ title: 'Usuário adicionado', description: u.name, icon: 'i-lucide-user-plus', color: 'success' })
}

function onRoleChange(userId: string, role: UsuarioRole) {
  const u = usuarios.value.find(x => x.id === userId)
  if (!u || u.role === role) return
  const prev = u.role
  setUserRole(userId, role)
  toast.add({
    title: 'Tipo de acesso alterado',
    description: `${u.name} agora é ${ROLE_BADGE[role].label}`,
    icon: 'i-lucide-shield-check',
    color: 'success',
    actions: [{ label: 'Desfazer', icon: 'i-lucide-undo-2', onClick: () => setUserRole(userId, prev) }]
  })
}

function onToggleActive(u: Usuario) {
  const nowActive = !u.active // u referencia o estado anterior (mutação é imutável)
  usuarios.value = usuarios.value.map(x => (x.id === u.id ? { ...x, active: nowActive } : x))
  toast.add({
    title: nowActive ? 'Usuário ativado' : 'Usuário desativado',
    description: u.name,
    icon: nowActive ? 'i-lucide-user-check' : 'i-lucide-user-x',
    color: nowActive ? 'success' : 'neutral',
    actions: [{ label: 'Desfazer', icon: 'i-lucide-undo-2', onClick: () => { usuarios.value = usuarios.value.map(x => (x.id === u.id ? { ...x, active: !nowActive } : x)) } }]
  })
}

/* ----- API key: mascarar/revelar/copiar (inativo enquanto SHOW_APIKEY_E_METADADOS = false) ----- */
const revealed = ref(false)
const maskedKey = computed(() =>
  revealed.value ? API_KEY : `${API_KEY.slice(0, 8)}${'•'.repeat(18)}${API_KEY.slice(-4)}`
)
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined
async function copyKey() {
  try {
    await navigator.clipboard.writeText(API_KEY)
  } catch {
    /* clipboard pode falhar fora de contexto seguro */
  }
  copied.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copied.value = false), 1600)
}
onBeforeUnmount(() => clearTimeout(copyTimer))
</script>

<template>
  <PortalTopbar :breadcrumbs="[{ label: 'Painel Geral', to: '/' }, { label: subconta?.name ?? 'Cliente' }]" />

  <div
    v-if="loading"
    class="flex flex-1 items-center justify-center py-24 text-sm text-dimmed"
  >
    <UIcon
      name="i-lucide-loader-circle"
      class="mr-2 h-4 w-4 animate-spin"
    />
    Carregando subconta…
  </div>

  <div
    v-else-if="subconta"
    class="flex-1 overflow-y-auto px-7 pb-12 pt-7"
  >
    <div class="mx-auto max-w-[1240px]">
      <!-- Header do detalhe -->
      <div class="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div
            class="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl text-lg font-bold"
            :class="avatarTint(subconta.id)"
          >
            {{ initials(subconta.name) }}
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2.5">
              <h1 class="text-2xl font-bold tracking-tight">
                {{ subconta.name }}
              </h1>
              <UBadge
                :color="statusBadge.color"
                variant="subtle"
              >
                {{ statusBadge.label }}
              </UBadge>
            </div>
            <div class="mt-1.5 flex items-center gap-2.5 text-xs text-dimmed">
              <span class="rounded-md bg-muted px-2 py-1 font-mono text-muted">{{ subconta.id }}</span>
              <span>·</span>
              <span>Subconta de {{ partnerName }}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        class="grid grid-cols-1 items-start gap-[18px]"
        :class="SHOW_APIKEY_E_METADADOS ? 'lg:grid-cols-[1.55fr_1fr]' : ''"
      >
        <!-- Coluna esquerda (única enquanto a coluna direita está oculta) -->
        <div class="flex flex-col gap-[18px]">
          <!-- Modelo comercial -->
          <UCard>
            <div class="mb-3.5 flex items-center gap-2.5">
              <div class="grid h-[30px] w-[30px] place-items-center rounded-lg bg-brand-900 text-white">
                <UIcon
                  name="i-lucide-credit-card"
                  class="h-4 w-4"
                />
              </div>
              <h2 class="text-base font-bold tracking-tight">
                Modelo comercial vigente
              </h2>
            </div>
            <div class="overflow-hidden rounded-xl border border-default">
              <div class="flex items-center justify-between gap-3 border-b border-default bg-muted px-3.5 py-3">
                <span class="text-xs font-medium text-muted">Como se cobra</span>
                <span class="text-right text-[13px] font-semibold">{{ chargeLabel }}</span>
              </div>
              <div class="flex items-center justify-between gap-3 bg-muted px-3.5 py-3">
                <span class="text-xs font-medium text-muted">De quem se cobra</span>
                <span class="text-right text-[13px] font-semibold">Individual na subconta</span>
              </div>
            </div>
          </UCard>

          <!-- Volumetria -->
          <UCard>
            <div class="mb-4">
              <h2 class="text-base font-bold tracking-tight">
                Volumetria &amp; Observabilidade
              </h2>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div class="rounded-xl border border-default bg-muted p-[15px]">
                <div class="mb-2.5 flex items-center gap-1.5 text-muted">
                  <UIcon
                    name="i-lucide-phone"
                    class="h-[15px] w-[15px]"
                  />
                  <span class="text-xs font-medium">Total de chamadas (30d)</span>
                </div>
                <div class="text-2xl font-bold tracking-tight">
                  {{ totalCalls }}
                </div>
              </div>
              <div class="rounded-xl border border-default bg-muted p-[15px]">
                <div class="mb-2.5 flex items-center gap-1.5 text-muted">
                  <UIcon
                    name="i-lucide-clock"
                    class="h-[15px] w-[15px]"
                  />
                  <span class="text-xs font-medium">Duração média (TMA)</span>
                </div>
                <div class="text-2xl font-bold tracking-tight">
                  {{ tma }}
                </div>
              </div>
              <div class="rounded-xl border border-default bg-muted p-[15px]">
                <div class="mb-2.5 flex items-center gap-1.5 text-muted">
                  <UIcon
                    name="i-lucide-users"
                    class="h-[15px] w-[15px]"
                  />
                  <span class="text-xs font-medium">Usuários</span>
                </div>
                <div class="text-2xl font-bold tracking-tight">
                  {{ usuarios.length }}
                </div>
                <div class="mt-0.5 text-[11px] font-medium text-dimmed">
                  <span class="text-emerald-600">{{ callers30d }}</span> ligaram nos últimos 30 dias
                </div>
              </div>
            </div>
          </UCard>

          <!-- Usuários da subconta -->
          <div class="overflow-hidden rounded-2xl border border-default bg-default shadow-sm">
            <div class="border-b border-default px-5 py-4">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 class="mb-0.5 text-base font-bold tracking-tight">
                    Usuários da subconta
                  </h2>
                  <p class="text-xs text-dimmed">
                    Acesso isolado desta subconta · sem acesso de irmãs ou pai
                  </p>
                </div>
                <UButton
                  v-if="ENABLE_ESCRITA_USUARIOS"
                  icon="i-lucide-user-plus"
                  @click="novoUsuarioOpen = true"
                >
                  Adicionar usuário
                </UButton>
              </div>
              <div class="mt-3.5 flex flex-wrap items-center gap-2">
                <UInput
                  v-model="search"
                  icon="i-lucide-search"
                  placeholder="Buscar por nome ou e-mail"
                  class="min-w-[200px] flex-1 sm:w-[280px] sm:flex-none"
                />
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
                        <span class="text-[11px] font-semibold uppercase tracking-wider text-dimmed">Filtrar usuários</span>
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
                        v-model="roleFilter"
                        label="Tipo de acesso"
                        :items="roleFilterItems"
                        class="mb-3"
                      />

                      <PortalFilterPills
                        v-model="statusFilter"
                        label="Status"
                        :items="statusFilterItems"
                        class="mb-3"
                      />

                      <PortalFilterPills
                        v-model="dateFilter"
                        label="Última ligação"
                        :items="dateFilterItems"
                      />
                      <div
                        v-if="dateFilter === 'custom'"
                        class="mt-2.5 space-y-2"
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
              </div>

              <PortalFilterChips
                :chips="activeFilterChips"
                class="mt-2.5"
                @clear-all="clearFilters"
              />

              <p class="mt-2.5 text-xs text-dimmed">
                Mostrando <span class="font-semibold text-muted">{{ displayUsuarios.length }}</span> de {{ usuarios.length }} usuário{{ usuarios.length === 1 ? '' : 's' }}
              </p>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[560px] border-collapse">
                <caption class="sr-only">
                  Usuários da subconta com tipo de acesso, última ligação e status
                </caption>
                <thead>
                  <tr class="sticky top-0 z-10 bg-muted">
                    <th
                      scope="col"
                      class="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed"
                    >
                      <button
                        type="button"
                        class="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase tracking-wider transition-colors hover:text-default"
                        :class="sortKey === 'name' ? 'text-default' : ''"
                        @click="toggleSort('name')"
                      >
                        Usuário
                        <UIcon
                          :name="sortIcon('name')"
                          class="h-3.5 w-3.5"
                        />
                      </button>
                    </th>
                    <th
                      scope="col"
                      class="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed"
                    >
                      Tipo de acesso
                    </th>
                    <th
                      scope="col"
                      class="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed"
                    >
                      <button
                        type="button"
                        class="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 uppercase tracking-wider transition-colors hover:text-default"
                        :class="sortKey === 'lastCall' ? 'text-default' : ''"
                        @click="toggleSort('lastCall')"
                      >
                        Última ligação
                        <UIcon
                          :name="sortIcon('lastCall')"
                          class="h-3.5 w-3.5"
                        />
                      </button>
                    </th>
                    <th
                      scope="col"
                      class="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed"
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="u in pagedUsuarios"
                    :key="u.id"
                    class="border-t border-default transition-opacity"
                    :class="{ 'opacity-50': !u.active }"
                  >
                    <td class="px-5 py-2.5">
                      <div class="flex items-center gap-2.5">
                        <div
                          class="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg text-xs font-bold"
                          :class="avatarTint(u.id)"
                        >
                          {{ initials(u.name) }}
                        </div>
                        <div class="min-w-0">
                          <div
                            class="truncate text-[13px] font-semibold"
                            :title="u.name"
                          >
                            {{ u.name }}
                          </div>
                          <div
                            class="truncate font-mono text-[11px] text-dimmed"
                            :title="u.email"
                          >
                            {{ u.email }}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="px-3.5 py-2.5">
                      <!-- Sem escrita: o select SAI (nada de controle morto na tela);
                           o papel continua visível como badge só-leitura. -->
                      <USelect
                        v-if="ENABLE_ESCRITA_USUARIOS"
                        :model-value="u.role"
                        :items="roleItems"
                        size="sm"
                        class="w-[130px]"
                        @update:model-value="onRoleChange(u.id, $event as UsuarioRole)"
                      />
                      <UBadge
                        v-else
                        :color="ROLE_BADGE[u.role].color"
                        variant="subtle"
                      >
                        {{ ROLE_BADGE[u.role].label }}
                      </UBadge>
                    </td>
                    <td class="px-3.5 py-2.5">
                      <span
                        class="whitespace-nowrap text-[13px]"
                        :class="u.lastCall ? 'text-muted' : 'text-dimmed italic'"
                      >{{ fmtLastCall(u.lastCall) }}</span>
                    </td>
                    <td class="px-5 py-2.5">
                      <div class="flex items-center gap-2.5">
                        <!-- Só o toggle sai quando a escrita está desabilitada; a label
                             de status continua, pois é informação legítima do usuário. -->
                        <USwitch
                          v-if="ENABLE_ESCRITA_USUARIOS"
                          :model-value="u.active"
                          :aria-label="u.active ? `Desativar ${u.name}` : `Ativar ${u.name}`"
                          @update:model-value="onToggleActive(u)"
                        />
                        <span
                          class="text-[13px] font-medium"
                          :class="u.active ? 'text-emerald-600' : 'text-dimmed'"
                        >{{ u.active ? 'Ativo' : 'Desativado' }}</span>
                      </div>
                    </td>
                  </tr>
                  <tr
                    v-if="displayUsuarios.length === 0"
                    class="border-t border-default"
                  >
                    <td
                      colspan="4"
                      class="px-5 py-10 text-center"
                    >
                      <p class="text-[13px] text-dimmed">
                        {{ usuarios.length === 0 ? 'Nenhum usuário nesta subconta.' : 'Nenhum usuário corresponde aos filtros aplicados.' }}
                      </p>
                      <UButton
                        v-if="usuarios.length > 0 && hasActiveFilters"
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
            <div
              v-if="displayUsuarios.length > PAGE_SIZE"
              class="flex flex-wrap items-center justify-between gap-3 border-t border-default px-5 py-3"
            >
              <span class="text-xs text-dimmed">
                Página {{ page }} de {{ Math.ceil(displayUsuarios.length / PAGE_SIZE) }}
              </span>
              <UPagination
                v-model:page="page"
                :total="displayUsuarios.length"
                :items-per-page="PAGE_SIZE"
                :sibling-count="1"
                size="sm"
              />
            </div>
          </div>
          <ContasNovoUsuarioModal
            v-model:open="novoUsuarioOpen"
            @created="onUsuarioCriado"
          />
        </div>

        <!-- Coluna direita — OCULTA (mock, sem endpoint no BFF). Ver SHOW_APIKEY_E_METADADOS. -->
        <div
          v-if="SHOW_APIKEY_E_METADADOS"
          class="flex flex-col gap-[18px]"
        >
          <!-- API Key -->
          <UCard>
            <div class="mb-3.5 flex items-center gap-2.5">
              <div class="grid h-[30px] w-[30px] place-items-center rounded-lg bg-brand-900 text-white">
                <UIcon
                  name="i-lucide-key-round"
                  class="h-4 w-4"
                />
              </div>
              <h2 class="text-base font-bold tracking-tight">
                API Key da Subconta
              </h2>
            </div>
            <div class="flex items-center gap-2 rounded-xl bg-brand-900 px-3.5 py-3">
              <span class="flex-1 truncate font-mono text-xs text-brand-200">{{ maskedKey }}</span>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                :icon="revealed ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="revealed ? 'Ocultar chave' : 'Revelar chave'"
                @click="revealed = !revealed"
              />
              <UButton
                size="xs"
                color="neutral"
                variant="solid"
                :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
                @click="copyKey"
              >
                {{ copied ? 'Copiado!' : 'Copiar' }}
              </UButton>
            </div>
            <p class="mt-3 text-[11px] leading-relaxed text-dimmed">
              Usada para integrações. Escopo limitado a esta subconta.
            </p>
          </UCard>

          <!-- Metadados -->
          <UCard>
            <div class="mb-1.5 flex items-center gap-2.5">
              <UIcon
                name="i-lucide-activity"
                class="h-[17px] w-[17px] text-brand-700"
              />
              <h2 class="text-base font-bold tracking-tight">
                Metadados de Observabilidade
              </h2>
            </div>
            <p class="mb-3.5 text-[11px] leading-relaxed text-dimmed">
              Referência para a engenharia mapear logs de integração e tracing.
            </p>
            <div class="overflow-hidden rounded-xl border border-default">
              <div
                v-for="m in meta"
                :key="m.k"
                class="flex items-center justify-between gap-3 bg-muted px-3.5 py-2.5"
              >
                <span class="text-xs font-medium text-muted">{{ m.k }}</span>
                <span class="truncate font-mono text-xs text-brand-700">{{ m.v }}</span>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>
