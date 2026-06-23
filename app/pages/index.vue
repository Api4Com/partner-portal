<script setup lang="ts">
import {
  CONTA_PRINCIPAL,
  fmt,
  initials,
  AVATAR_PALETTE,
  STATUS_BADGE,
  type Subconta,
  type SubcontaStatus
} from '~/lib/contas'
import { buildCalls } from '~/lib/relatorio'

const toast = useToast()
const { all, add } = useSubcontas()

const search = ref('')
const statusFilter = ref<SubcontaStatus | 'all'>('all')
const wizardOpen = ref(false)

const statusItems = [
  { label: 'Todos os status', value: 'all' },
  { label: 'Ativo', value: 'ativo' },
  { label: 'Bloqueado', value: 'bloqueado' },
  { label: 'Inativo', value: 'inativo' }
]

const DAY = 86400000
const allCalls = computed(() => all.value.flatMap(buildCalls))

const total = computed(() => all.value.length)
const totalMinutes = computed(() => all.value.reduce((sum, x) => sum + x.minutes, 0))
const maxMin = computed(() => Math.max(...all.value.map(s => s.minutes), 1))

// Subcontas que ligaram nos últimos 7 dias (distintas no histórico de chamadas).
const ligando7d = computed(() => {
  const cutoff = Date.now() - 7 * DAY
  const ids = new Set<string>()
  for (const c of allCalls.value) {
    if (new Date(c.date).getTime() >= cutoff) ids.add(c.subId)
  }
  return ids.size
})
const semLigar7d = computed(() => Math.max(0, total.value - ligando7d.value))

// Taxa de atendimento das chamadas dos últimos 30 dias (todas as subcontas).
const taxaAtend30d = computed(() => {
  const cutoff = Date.now() - 30 * DAY
  const calls = allCalls.value.filter(c => new Date(c.date).getTime() >= cutoff)
  if (!calls.length) return 0
  return Math.round((calls.filter(c => c.cause === 'atendida').length / calls.length) * 100)
})

const rows = computed(() => {
  const q = search.value.trim().toLowerCase()
  return all.value.filter((s) => {
    const matchesName = !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    const matchesStatus = statusFilter.value === 'all' || s.status === statusFilter.value
    return matchesName && matchesStatus
  })
})

const kpis = computed(() => [
  { label: 'Subcontas', icon: 'i-lucide-building-2', iconClass: 'bg-primary/10 text-primary', value: String(total.value), sub: 'subcontas na sua base' },
  {
    label: 'Ligando (últimos 7 dias)',
    icon: 'i-lucide-phone-call',
    iconClass: 'bg-emerald-50 text-emerald-600',
    value: `${ligando7d.value} de ${total.value}`,
    sub: semLigar7d.value > 0 ? `${semLigar7d.value} sem ligar nos últimos 7 dias` : 'todas ligaram nos últimos 7 dias'
  },
  { label: 'Volume do Mês', icon: 'i-lucide-activity', iconClass: 'bg-primary/10 text-primary', value: fmt(totalMinutes.value), sub: 'minutos · todas as subcontas' },
  { label: 'Taxa de atendimento', icon: 'i-lucide-phone-incoming', iconClass: 'bg-amber-50 text-amber-600', value: `${taxaAtend30d.value}%`, sub: 'chamadas atendidas · últimos 30 dias' }
])

// Cor da barra de volumetria conforme o status da subconta.
function barClass(status: SubcontaStatus) {
  return status === 'bloqueado' ? 'bg-error' : status === 'inativo' ? 'bg-neutral-300' : 'bg-primary'
}

function onCreated(s: Subconta) {
  add(s)
  toast.add({ title: 'Subconta criada', description: s.name, icon: 'i-lucide-circle-check', color: 'success' })
}
</script>

<template>
  <PortalTopbar title="Painel Geral" />

  <div class="flex-1 overflow-y-auto px-7 pb-12 pt-7">
    <div class="mx-auto max-w-[1240px]">
      <!-- Cabeçalho -->
      <div class="mb-[22px]">
        <p class="mb-1.5 text-xs font-semibold tracking-wide text-primary">Portal do Parceiro</p>
        <h1 class="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Bem-vindo de volta, {{ CONTA_PRINCIPAL.name }}
        </h1>
        <p class="text-sm text-muted">Painel da conta principal · gestão de subcontas</p>
      </div>

      <!-- KPIs -->
      <div class="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <UCard v-for="k in kpis" :key="k.label" :ui="{ body: 'p-5' }">
          <div class="flex items-center justify-between">
            <span class="text-[13px] font-semibold text-muted">{{ k.label }}</span>
            <div class="grid h-9 w-9 place-items-center rounded-lg" :class="k.iconClass">
              <UIcon :name="k.icon" class="h-[18px] w-[18px]" />
            </div>
          </div>
          <div class="mt-3">
            <div class="text-3xl font-bold tracking-tight">{{ k.value }}</div>
            <div class="mt-2 text-xs text-dimmed">{{ k.sub }}</div>
          </div>
        </UCard>
      </div>

      <!-- Tabela -->
      <UCard :ui="{ body: 'p-0' }">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-bold tracking-tight">Gerenciamento de Subcontas</h2>
              <p class="text-xs text-dimmed">Provisione e acompanhe o consumo de cada subconta</p>
            </div>
            <div class="flex flex-wrap items-center gap-2.5">
              <UInput v-model="search" icon="i-lucide-search" placeholder="Buscar por nome…" class="w-[190px]" />
              <USelect v-model="statusFilter" :items="statusItems" class="w-[160px]" />
              <UButton icon="i-lucide-plus" @click="wizardOpen = true">Nova Subconta</UButton>
            </div>
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] border-collapse">
            <thead>
              <tr class="bg-muted/50">
                <th class="px-[22px] py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">Nome da Subconta</th>
                <th class="px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">ID</th>
                <th class="px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">Volumetria (mês)</th>
                <th class="px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">Status</th>
                <th class="px-3.5 py-3 pr-[22px] text-right text-[11px] font-semibold uppercase tracking-wider text-dimmed">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(s, i) in rows" :key="s.id" class="border-t border-default hover:bg-muted/40">
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
                  <span class="rounded-md bg-muted px-2 py-1 font-mono text-xs text-muted">{{ s.id }}</span>
                </td>
                <td class="px-3.5 py-3.5">
                  <div class="min-w-[130px]">
                    <div class="mb-1.5 text-[13px] font-semibold">{{ fmt(s.minutes) }} min</div>
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
                  <UBadge :color="STATUS_BADGE[s.status].color" variant="subtle">
                    {{ STATUS_BADGE[s.status].label }}
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
              <tr v-if="rows.length === 0" class="border-t border-default">
                <td colspan="5" class="px-[22px] py-10 text-center text-sm text-dimmed">
                  Nenhuma subconta encontrada com os filtros aplicados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <template #footer>
          <div class="flex items-center justify-between text-xs text-dimmed">
            <span>Mostrando {{ rows.length }} subcontas</span>
            <div class="flex gap-1.5">
              <UButton color="neutral" variant="outline" size="xs" disabled>Anterior</UButton>
              <UButton color="neutral" variant="outline" size="xs">Próximo</UButton>
            </div>
          </div>
        </template>
      </UCard>
    </div>
  </div>

  <ContasNovaSubcontaWizard v-model:open="wizardOpen" @created="onCreated" />
</template>
