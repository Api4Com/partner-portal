<script setup lang="ts">
import { fmt, initials, AVATAR_PALETTE, STATUS_BADGE } from '~/lib/contas'

/* ----- contrato do BFF ----- */
type SubStatus = 'active' | 'inactive'
interface Subaccount { id: string, name: string, users: number, minutes: number, status: SubStatus }

// BFF: active/inactive (inferido por chamadas nos últimos 7d) → badge PT do protótipo.
const ptStatus = (s: SubStatus): 'ativo' | 'inativo' => (s === 'active' ? 'ativo' : 'inativo')
function barClass(s: SubStatus) {
  return s === 'inactive' ? 'bg-neutral-300' : 'bg-primary'
}
interface Summary {
  subaccounts: number
  usersTotal: number
  active7d: number
  inactive: number
  volumeMinutes: number
  answerRate: number
  callsInPeriod: number
}

const toast = useToast()
const { user, bffFetch } = useAuth()
const DAY = 86400000

const search = ref('')
// Status inferido pelo backend (ativa = chamada nos últimos 7 dias).
const statusFilter = ref<'all' | SubStatus>('all')
const statusItems = [
  { label: 'Todos os status', value: 'all' },
  { label: 'Ativo', value: 'active' },
  { label: 'Inativo', value: 'inactive' }
]
const wizardOpen = ref(false)

/* ----- dados do BFF ----- */
const subaccounts = ref<Subaccount[]>([])
const summary = ref<Summary | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const from = new Date(Date.now() - 30 * DAY).toISOString()
    const [subs, sum] = await Promise.all([
      bffFetch<Subaccount[]>('/subaccounts'),
      bffFetch<Summary>('/reports/summary', { query: { from } }).catch(() => null)
    ])
    subaccounts.value = subs ?? []
    summary.value = sum
  } catch {
    subaccounts.value = []
    summary.value = null
  } finally {
    loading.value = false
  }
}
onMounted(load)

const partnerName = computed(() => user.value?.name || 'Parceiro')

const totalMinutes = computed(() => subaccounts.value.reduce((sum, x) => sum + (x.minutes || 0), 0))
const maxMin = computed(() => Math.max(...subaccounts.value.map(s => s.minutes), 1))

const rows = computed(() => {
  // Busca ignora acento e caixa nos dois sentidos ("te" acha "Tétheu" e vice-versa).
  const q = normalizeSearch(search.value.trim())
  return subaccounts.value.filter(s =>
    (!q || matchesSearch(s.name, q) || matchesSearch(s.id, q))
    && (statusFilter.value === 'all' || s.status === statusFilter.value)
  )
})

const kpis = computed(() => {
  const s = summary.value
  const usersTotal = s?.usersTotal ?? 0
  const active = s?.active7d ?? 0
  const inactive = s?.inactive ?? Math.max(0, usersTotal - active)
  return [
    { label: 'Subcontas', icon: 'i-lucide-building-2', iconClass: 'bg-primary/10 text-primary', value: String(subaccounts.value.length), sub: 'subcontas na sua base' },
    {
      label: 'Ligando (últimos 7 dias)',
      icon: 'i-lucide-phone-call',
      iconClass: 'bg-emerald-50 text-emerald-600',
      value: `${active} de ${usersTotal}`,
      sub: inactive > 0 ? `${inactive} sem ligar nos últimos 7 dias` : 'todos ligaram nos últimos 7 dias'
    },
    { label: 'Volume', icon: 'i-lucide-activity', iconClass: 'bg-primary/10 text-primary', value: fmt(totalMinutes.value), sub: 'minutos · últimos 30 dias' },
    { label: 'Taxa de atendimento', icon: 'i-lucide-phone-incoming', iconClass: 'bg-amber-50 text-amber-600', value: `${s?.answerRate ?? 0}%`, sub: 'chamadas atendidas · últimos 30 dias' }
  ]
})

async function onCreated(s: Subaccount) {
  toast.add({ title: 'Subconta criada', description: s.name, icon: 'i-lucide-circle-check', color: 'success' })
  // O escopo das subcontas é derivado no BFF a cada request: basta recarregar
  // a lista para a nova subconta aparecer.
  await load()
}
</script>

<template>
  <PortalTopbar title="Painel Geral" />

  <div class="flex-1 overflow-y-auto px-7 pb-12 pt-7">
    <div class="mx-auto max-w-[1240px]">
      <!-- Cabeçalho -->
      <div class="mb-[22px]">
        <p class="mb-1.5 text-xs font-semibold tracking-wide text-primary">
          Portal do Parceiro
        </p>
        <h1 class="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Bem-vindo de volta, {{ partnerName }}
        </h1>
        <p class="text-sm text-muted">
          Painel da conta principal · gestão de subcontas
        </p>
      </div>

      <!-- KPIs -->
      <div class="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <UCard
          v-for="k in kpis"
          :key="k.label"
          :ui="{ body: 'p-5' }"
        >
          <div class="flex items-center justify-between">
            <span class="text-[13px] font-semibold text-muted">{{ k.label }}</span>
            <div
              class="grid h-9 w-9 place-items-center rounded-lg"
              :class="k.iconClass"
            >
              <UIcon
                :name="k.icon"
                class="h-[18px] w-[18px]"
              />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-3xl font-bold tracking-tight">
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
                Gerenciamento de Subcontas
              </h2>
              <p class="text-xs text-dimmed">
                Provisione e acompanhe o consumo de cada subconta
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2.5">
              <UInput
                v-model="search"
                icon="i-lucide-search"
                placeholder="Buscar por nome…"
                class="w-[190px]"
              />
              <USelect
                v-model="statusFilter"
                :items="statusItems"
                class="w-[170px]"
              />
              <UButton
                icon="i-lucide-plus"
                @click="wizardOpen = true"
              >
                Nova Subconta
              </UButton>
            </div>
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] border-collapse">
            <thead>
              <tr class="bg-muted/50">
                <th class="px-[22px] py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">
                  Nome da Subconta
                </th>
                <th class="px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">
                  Volumetria (30 dias)
                </th>
                <th class="px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">
                  <span class="inline-flex items-center gap-1">
                    Status
                    <UTooltip text="Ativo: teve chamadas nos últimos 7 dias.">
                      <UIcon
                        name="i-lucide-info"
                        class="h-3.5 w-3.5 cursor-help text-dimmed"
                        tabindex="0"
                        aria-label="Ativo: teve chamadas nos últimos 7 dias."
                      />
                    </UTooltip>
                  </span>
                </th>
                <th class="px-3.5 py-3 pr-[22px] text-right text-[11px] font-semibold uppercase tracking-wider text-dimmed">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(s, i) in rows"
                :key="s.id"
                class="border-t border-default hover:bg-muted/40"
              >
                <td class="py-3.5 pl-[22px] pr-3.5">
                  <div class="flex items-center gap-3">
                    <div
                      class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold"
                      :class="AVATAR_PALETTE[i % AVATAR_PALETTE.length]"
                    >
                      {{ initials(s.name) }}
                    </div>
                    <span class="text-[13px] font-semibold">{{ s.name }}</span>
                  </div>
                </td>
                <td class="px-3.5 py-3.5">
                  <div class="min-w-[130px]">
                    <div class="mb-1.5 text-[13px] font-semibold">
                      {{ fmt(s.minutes) }} min
                    </div>
                    <div class="h-[5px] overflow-hidden rounded-full bg-muted">
                      <div
                        class="h-full rounded-full"
                        :class="barClass(s.status)"
                        :style="{ width: Math.max(6, Math.round((s.minutes / maxMin) * 100)) + '%' }"
                      />
                    </div>
                  </div>
                </td>
                <td class="px-3.5 py-3.5">
                  <UBadge
                    :color="STATUS_BADGE[ptStatus(s.status)].color"
                    variant="subtle"
                  >
                    {{ STATUS_BADGE[ptStatus(s.status)].label }}
                  </UBadge>
                </td>
                <td class="py-3.5 pl-3.5 pr-[22px] text-right">
                  <UButton
                    color="neutral"
                    variant="outline"
                    size="xs"
                    trailing-icon="i-lucide-arrow-right"
                    :to="`/clientes/${s.id}`"
                  >
                    Gerenciar
                  </UButton>
                </td>
              </tr>
              <tr
                v-if="rows.length === 0"
                class="border-t border-default"
              >
                <td
                  colspan="4"
                  class="px-[22px] py-10 text-center text-sm text-dimmed"
                >
                  {{ loading ? 'Carregando…' : 'Nenhuma subconta encontrada com os filtros aplicados.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <template #footer>
          <div class="flex items-center justify-between text-xs text-dimmed">
            <span>Mostrando {{ rows.length }} subconta{{ rows.length === 1 ? '' : 's' }}</span>
            <div class="flex gap-1.5">
              <UButton
                color="neutral"
                variant="outline"
                size="xs"
                disabled
              >
                Anterior
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                size="xs"
                disabled
              >
                Próximo
              </UButton>
            </div>
          </div>
        </template>
      </UCard>
    </div>
  </div>

  <ContasNovaSubcontaWizard
    v-model:open="wizardOpen"
    @created="onCreated"
  />
</template>
