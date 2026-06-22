<script setup lang="ts">
import { HORIZONS, KPIS, fetchRoadmapData, type Horizon, type PartnerProfile } from '~/lib/roadmap'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { items, states, profile } = useRoadmap()

// Lê itens publicados + estado do usuário (SSR).
const { data } = await useAsyncData('roadmap', async () => {
  if (!user.value) return { items: [], states: {} }
  return await fetchRoadmapData(supabase, user.value.id)
})

watchEffect(() => {
  if (data.value) {
    items.value = data.value.items
    states.value = data.value.states
  }
})

const profiles: { id: PartnerProfile, label: string, hint: string, icon: string }[] = [
  { id: 'commercial', label: 'Comercial / Vendas', hint: 'Vendas', icon: 'i-lucide-briefcase' },
  { id: 'technical', label: 'Técnico / Dev', hint: 'Dev', icon: 'i-lucide-code-2' }
]

const dashDescription = computed(() =>
  profile.value === 'commercial'
    ? 'Cada recurso da plataforma traduzido em argumento de venda: entenda o valor para o cliente e tenha os materiais para fechar negócio.'
    : 'Acompanhe endpoints, webhooks e mudanças de contrato de API antes de chegarem à produção. Solicite acesso a betas direto daqui.'
)

function columnItems(h: Horizon) {
  return items.value.filter(i => i.horizon === h)
}
</script>

<template>
  <PortalTopbar title="Roadmap">
    <template #right>
      <div class="flex rounded-xl border border-default bg-muted p-1">
        <button
          v-for="p in profiles"
          :key="p.id"
          type="button"
          :aria-pressed="profile === p.id"
          class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          :class="profile === p.id ? 'bg-primary text-inverted shadow-sm' : 'text-muted hover:text-default'"
          @click="profile = p.id"
        >
          <UIcon :name="p.icon" class="h-4 w-4" />
          <span class="hidden md:inline">{{ p.label }}</span>
          <span class="md:hidden">{{ p.hint }}</span>
        </button>
      </div>
    </template>
  </PortalTopbar>

  <div class="flex-1 overflow-y-auto px-7 pb-12 pt-7">
    <div class="mx-auto max-w-[1240px] space-y-8">
      <!-- Dashboard -->
      <section class="space-y-5">
        <div class="flex flex-col gap-1">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-primary">Visão Unificada</p>
          <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Portal de Roadmap para Parceiros</h1>
          <p class="max-w-2xl text-sm text-muted">{{ dashDescription }}</p>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <UCard v-for="kpi in KPIS" :key="kpi.id" :ui="{ body: 'p-5' }">
            <div class="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
              <UIcon :name="kpi.icon" class="h-5 w-5" />
            </div>
            <p class="mt-4 text-2xl font-bold tracking-tight">{{ kpi.value }}</p>
            <p class="mt-0.5 text-xs font-medium text-muted">{{ kpi.label }}</p>
          </UCard>
        </div>
      </section>

      <!-- Quadro -->
      <section class="space-y-4">
        <div class="flex items-baseline justify-between">
          <h2 class="text-lg font-semibold">Quadro do Roadmap</h2>
          <p class="text-xs text-dimmed">Horizontes de entrega</p>
        </div>

        <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div
            v-for="h in HORIZONS"
            :key="h.id"
            class="flex flex-col rounded-2xl border border-default bg-muted/60 p-3"
          >
            <div class="mb-3 rounded-xl bg-gradient-to-b px-3 py-2.5 ring-1 ring-inset" :class="h.accent">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-slate-900">{{ h.title }}</h3>
                <span class="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm">
                  {{ columnItems(h.id).length }}
                </span>
              </div>
              <p class="mt-0.5 text-[11px] font-medium opacity-90">{{ h.caption }}</p>
            </div>

            <div class="flex flex-1 flex-col gap-3">
              <RoadmapCard v-for="item in columnItems(h.id)" :key="item.id" :item="item" />
              <p v-if="columnItems(h.id).length === 0" class="px-2 py-8 text-center text-xs text-dimmed">
                Nenhum item neste horizonte.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>

  <RoadmapDrawer />
</template>
