<script setup lang="ts">
import {
  API_KEY,
  AVATAR_PALETTE,
  buildMeta,
  CDR_LOGS,
  CONTA_PRINCIPAL,
  initials,
  STATUS_BADGE
} from '~/lib/contas'

const route = useRoute()
const id = route.params.id as string
const { byId, indexOf } = useSubcontas()

const subconta = byId(id)
// Subconta inexistente (ex.: criada em runtime e a página foi recarregada) → home.
if (!subconta) {
  await navigateTo('/')
}

const index = indexOf(id)
const meta = subconta ? buildMeta(subconta.id) : []
const chargeLabel = computed(() => {
  if (!subconta) return ''
  if (subconta.charge === 'pending') return 'Aguardando definição da subconta'
  return `${subconta.charge === 'plan' ? 'Plano · por usuário' : 'Pré-pago'} · definido pela subconta`
})

/* ----- filtros do CDR ----- */
const dateFilter = ref('')
const numberFilter = ref('')
const statusFilter = ref<'all' | 'ok' | 'fail'>('all')
const statusItems = [
  { label: 'Todos os status', value: 'all' },
  { label: 'Sucesso', value: 'ok' },
  { label: 'Falha', value: 'fail' }
]

const filteredLogs = computed(() =>
  CDR_LOGS.filter((log) => {
    const matchesDate = !dateFilter.value || log.time.toLowerCase().includes(dateFilter.value.trim().toLowerCase())
    const matchesNumber = !numberFilter.value
      || log.number.replace(/\D/g, '').includes(numberFilter.value.replace(/\D/g, ''))
      || log.number.toLowerCase().includes(numberFilter.value.trim().toLowerCase())
    const matchesStatus = statusFilter.value === 'all' || (statusFilter.value === 'ok' ? log.ok : !log.ok)
    return matchesDate && matchesNumber && matchesStatus
  })
)

/* ----- copiar API key ----- */
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
  <PortalTopbar :title="subconta?.name ?? 'Cliente'" />

  <div v-if="subconta" class="flex-1 overflow-y-auto px-7 pb-12 pt-7">
    <div class="mx-auto max-w-[1240px]">
      <!-- Header do detalhe -->
      <div class="mb-[22px] flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div
            class="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl text-lg font-bold"
            :class="AVATAR_PALETTE[index % AVATAR_PALETTE.length]"
          >
            {{ initials(subconta.name) }}
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2.5">
              <h1 class="text-2xl font-bold tracking-tight">{{ subconta.name }}</h1>
              <UBadge :color="STATUS_BADGE[subconta.status].color" variant="subtle">
                {{ STATUS_BADGE[subconta.status].label }}
              </UBadge>
            </div>
            <div class="mt-1.5 flex items-center gap-2.5 text-xs text-dimmed">
              <span class="rounded-md bg-muted px-2 py-1 font-mono text-muted">{{ subconta.id }}</span>
              <span>·</span>
              <span>Subconta de {{ CONTA_PRINCIPAL.name }}</span>
            </div>
          </div>
        </div>
        <UButton color="neutral" variant="outline" icon="i-lucide-arrow-left" to="/">
          Voltar para o Painel Geral
        </UButton>
      </div>

      <div class="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.55fr_1fr]">
        <!-- Coluna esquerda -->
        <div class="flex flex-col gap-[18px]">
          <!-- Modelo comercial -->
          <UCard>
            <div class="mb-3.5 flex items-center gap-2.5">
              <div class="grid h-[30px] w-[30px] place-items-center rounded-lg bg-brand-900 text-white">
                <UIcon name="i-lucide-credit-card" class="h-4 w-4" />
              </div>
              <h2 class="text-base font-bold tracking-tight">Modelo comercial vigente</h2>
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
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-base font-bold tracking-tight">Volumetria &amp; Observabilidade</h2>
              <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                <span class="relative flex h-2 w-2">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Tempo real
              </span>
            </div>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div class="rounded-xl border border-default bg-muted p-[15px]">
                <div class="mb-2.5 flex items-center gap-1.5 text-muted">
                  <UIcon name="i-lucide-phone" class="h-[15px] w-[15px]" />
                  <span class="text-xs font-medium">Total de chamadas</span>
                </div>
                <div class="text-2xl font-bold tracking-tight">4.280</div>
              </div>
              <div class="rounded-xl border border-default bg-muted p-[15px]">
                <div class="mb-2.5 flex items-center gap-1.5 text-muted">
                  <UIcon name="i-lucide-clock" class="h-[15px] w-[15px]" />
                  <span class="text-xs font-medium">Duração média (TMA)</span>
                </div>
                <div class="text-2xl font-bold tracking-tight">3m 42s</div>
              </div>
              <div class="rounded-xl border border-default bg-muted p-[15px]">
                <div class="mb-2.5 flex items-center gap-1.5 text-muted">
                  <UIcon name="i-lucide-users" class="h-[15px] w-[15px]" />
                  <span class="text-xs font-medium">Usuários</span>
                </div>
                <div class="text-2xl font-bold tracking-tight">
                  {{ subconta.users }}<span class="text-[13px] font-medium text-dimmed"> / webphone</span>
                </div>
              </div>
            </div>
          </UCard>

          <!-- CDR -->
          <div class="overflow-hidden rounded-2xl border border-default bg-default shadow-sm">
            <div class="border-b border-default px-5 py-4">
              <h2 class="mb-0.5 text-base font-bold tracking-tight">Logs de Chamadas (CDR) &amp; Gravações</h2>
              <p class="text-xs text-dimmed">CDR e gravações isolados desta subconta · sem acesso de irmãs ou pai</p>
              <div class="mt-3.5 flex flex-wrap items-center gap-2">
                <UInput v-model="dateFilter" placeholder="Data (ex.: 12/06)" class="w-[140px]" />
                <UInput v-model="numberFilter" placeholder="Número discado" class="w-[170px]" />
                <USelect v-model="statusFilter" :items="statusItems" class="w-[150px]" />
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr class="bg-muted/70">
                    <th class="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">Data / hora</th>
                    <th class="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">Número discado</th>
                    <th class="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">Bilhado</th>
                    <th class="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">Status API</th>
                    <th class="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">Gravação</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(log, i) in filteredLogs" :key="i" class="border-t border-default">
                    <td class="whitespace-nowrap px-5 py-2.5 font-mono text-xs text-muted">{{ log.time }}</td>
                    <td class="px-3.5 py-2.5 font-mono text-[13px] font-medium">{{ log.number }}</td>
                    <td class="px-3.5 py-2.5 font-mono text-[13px] text-muted">{{ log.dur }}</td>
                    <td class="px-3.5 py-2.5">
                      <UBadge :color="log.ok ? 'success' : 'error'" variant="subtle">{{ log.status }}</UBadge>
                    </td>
                    <td class="px-5 py-2.5">
                      <UButton
                        v-if="log.ok"
                        size="xs"
                        color="primary"
                        variant="subtle"
                        icon="i-lucide-play"
                      >
                        Ouvir
                      </UButton>
                      <span v-else class="text-[13px] text-dimmed">—</span>
                    </td>
                  </tr>
                  <tr v-if="filteredLogs.length === 0" class="border-t border-default">
                    <td colspan="5" class="px-5 py-8 text-center text-[13px] text-dimmed">
                      Nenhuma chamada encontrada com os filtros aplicados.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Coluna direita -->
        <div class="flex flex-col gap-[18px]">
          <!-- API Key -->
          <UCard>
            <div class="mb-3.5 flex items-center gap-2.5">
              <div class="grid h-[30px] w-[30px] place-items-center rounded-lg bg-brand-900 text-white">
                <UIcon name="i-lucide-key-round" class="h-4 w-4" />
              </div>
              <h2 class="text-base font-bold tracking-tight">API Key da Subconta</h2>
            </div>
            <div class="flex items-center gap-2 rounded-xl bg-brand-900 px-3.5 py-3">
              <span class="flex-1 truncate font-mono text-xs text-brand-200">{{ API_KEY }}</span>
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
              <UIcon name="i-lucide-activity" class="h-[17px] w-[17px] text-brand-700" />
              <h2 class="text-base font-bold tracking-tight">Metadados de Observabilidade</h2>
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
