<script setup lang="ts">
import { fetchRoadmapData, whatsappUrl } from '~/lib/roadmap'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { items, states, myComments } = useRoadmap()

// Lê itens publicados + estado do usuário (SSR).
const { data } = await useAsyncData('roadmap', async () => {
  if (!user.value) return { items: [], states: {}, comments: {} }
  return await fetchRoadmapData(supabase, user.value.id)
})

watchEffect(() => {
  if (data.value) {
    items.value = data.value.items
    states.value = data.value.states
    myComments.value = data.value.comments
  }
})

// Camada do que já está em desenvolvimento.
const nowItems = computed(() => items.value.filter(i => i.horizon === 'now'))
// Caixa de ideias no radar: "próximo" + "futuro" juntos, sem ordem de prioridade.
const radarItems = computed(() => items.value.filter(i => i.horizon !== 'now'))

// Modal de "Solicitar demanda".
const requestOpen = ref(false)
</script>

<template>
  <PortalTopbar title="Roadmap" />

  <div class="flex-1 overflow-y-auto px-7 pb-12 pt-7">
    <div class="mx-auto max-w-[1240px] space-y-8">
      <!-- Dashboard -->
      <section class="space-y-5">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex flex-col gap-1">
            <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">Construindo junto com você</h1>
            <p class="max-w-2xl text-sm text-muted">Este é um espaço aberto pra explorar possibilidades junto com você. Vote nas ideias que importam, sugira o que está faltando e ajude a moldar pra onde o produto pode crescer.</p>
          </div>
          <UButton
            icon="i-lucide-lightbulb"
            size="lg"
            class="shrink-0"
            @click="requestOpen = true"
          >
            Solicitar demanda
          </UButton>
        </div>
      </section>

      <!-- Camada 1: caixa de ideias no radar (exploratória, sem compromisso de entrega) -->
      <section>
        <div class="rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-6">
          <div class="mb-4 flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-radar" class="h-5 w-5 text-amber-500" />
              <h2 class="text-lg font-semibold">No radar</h2>
              <span class="rounded-full bg-amber-100/70 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                {{ radarItems.length }}
              </span>
              <span class="ml-1 text-[11px] font-medium uppercase tracking-wide text-amber-600/80">
                Backlog de possibilidades
              </span>
            </div>
            <p class="max-w-2xl text-sm text-muted">
              Um espaço aberto pra explorar possibilidades junto com você.
            </p>
            <!-- Selo de não-compromisso + enquadramento do voto -->
            <div class="flex items-start gap-2 rounded-lg bg-amber-100/50 px-3 py-2 text-xs leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-200/70">
              <UIcon name="i-lucide-info" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              <span>
                Estar aqui <strong class="font-semibold">não garante desenvolvimento</strong> — é onde avaliamos ideias antes de decidir.
                <strong class="font-semibold">Seus votos</strong> ajudam a definir o que priorizamos primeiro.
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <RoadmapCard v-for="item in radarItems" :key="item.id" :item="item" />
          </div>
          <p v-if="radarItems.length === 0" class="px-2 py-8 text-center text-xs text-dimmed">
            Nenhuma ideia no radar por enquanto.
          </p>

          <!-- Escalonamento de urgência: baixo destaque, contato direto -->
          <div class="mt-5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 border-t border-amber-200/60 pt-4 text-center text-xs text-muted">
            <span>Alguma dessas ideias é crítica pra você ou seus clientes?</span>
            <a
              :href="whatsappUrl()"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 font-semibold text-amber-700 underline-offset-2 hover:text-amber-800 hover:underline"
            >
              <UIcon name="i-lucide-message-circle" class="h-3.5 w-3.5" />
              Fale com a gente
            </a>
          </div>
        </div>
      </section>

      <!-- Camada 2: o que já está sendo construído -->
      <section>
        <div class="rounded-2xl border border-default bg-default p-6 shadow-sm ring-1 ring-emerald-100">
          <div class="mb-5 flex flex-col gap-1">
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
            <p class="text-sm text-muted">O que o time já está construindo.</p>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RoadmapCard v-for="item in nowItems" :key="item.id" :item="item" />
          </div>
          <p v-if="nowItems.length === 0" class="px-2 py-8 text-center text-xs text-dimmed">
            Nada em desenvolvimento ativo no momento.
          </p>
        </div>
      </section>
    </div>
  </div>

  <RoadmapDrawer />
  <RoadmapRequestModal v-model:open="requestOpen" />
</template>
