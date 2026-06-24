<script setup lang="ts">
import { KPIS, type PartnerProfile } from '~/lib/roadmap'

const { items, states, profile } = useRoadmap()

// TODO: itens do roadmap vinham do Supabase (fetchRoadmapData). Sem backend
// equivalente ainda, a lista fica vazia até migrarmos a fonte de dados.
watchEffect(() => {
  items.value = []
  states.value = {}
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

// Camada do que já está em desenvolvimento.
const nowItems = computed(() => items.value.filter(i => i.horizon === 'now'))
// Caixa de ideias no radar: "próximo" + "futuro" juntos, sem ordem de prioridade.
const radarItems = computed(() => items.value.filter(i => i.horizon !== 'now'))
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

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <UCard v-for="kpi in KPIS" :key="kpi.id" :ui="{ body: 'p-5' }">
            <div class="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
              <UIcon :name="kpi.icon" class="h-5 w-5" />
            </div>
            <p class="mt-4 text-2xl font-bold tracking-tight">{{ kpi.value }}</p>
            <p class="mt-0.5 text-xs font-medium text-muted">{{ kpi.label }}</p>
          </UCard>
        </div>
      </section>

      <!-- Camada 1: o que já está sendo construído -->
      <section class="space-y-4">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="relative flex h-2.5 w-2.5">
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <h2 class="text-lg font-semibold">Em desenvolvimento agora</h2>
            <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              {{ nowItems.length }}
            </span>
          </div>
          <p class="text-sm text-muted">O que o time já está construindo · Beta Fechado.</p>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <RoadmapCard v-for="item in nowItems" :key="item.id" :item="item" />
        </div>
        <p v-if="nowItems.length === 0" class="rounded-2xl border border-dashed border-default px-4 py-10 text-center text-xs text-dimmed">
          Nada em desenvolvimento ativo no momento.
        </p>
      </section>

      <!-- Camada 2: caixa de ideias no radar -->
      <section class="space-y-4">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-lightbulb" class="h-5 w-5 text-amber-500" />
            <h2 class="text-lg font-semibold">No radar</h2>
            <span class="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted ring-1 ring-inset ring-default">
              {{ radarItems.length }}
            </span>
          </div>
          <p class="max-w-2xl text-sm text-muted">
            Ideias que estamos explorando. Sem ordem de prioridade, data ou promessa de entrega — é o que está no nosso radar e pode (ou não) virar produto.
          </p>
        </div>

        <div class="rounded-2xl border border-dashed border-default bg-muted/40 p-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <RoadmapCard v-for="item in radarItems" :key="item.id" :item="item" />
          </div>
          <p v-if="radarItems.length === 0" class="px-2 py-8 text-center text-xs text-dimmed">
            Nenhuma ideia no radar por enquanto.
          </p>
        </div>
      </section>
    </div>
  </div>

  <RoadmapDrawer />
</template>
