<script setup lang="ts">
import { fetchRoadmapData } from '~/lib/roadmap'

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

      <!-- Camada 1: caixa de ideias no radar -->
      <section>
        <div class="rounded-2xl border border-default bg-default p-6 shadow-sm ring-1 ring-amber-100">
          <div class="mb-5 flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-lightbulb" class="h-5 w-5 text-amber-500" />
              <h2 class="text-lg font-semibold">No radar</h2>
              <span class="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                {{ radarItems.length }}
              </span>
            </div>
            <p class="max-w-2xl text-sm text-muted">
              Um espaço aberto pra explorar possibilidades
            </p>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <RoadmapCard v-for="item in radarItems" :key="item.id" :item="item" />
          </div>
          <p v-if="radarItems.length === 0" class="px-2 py-8 text-center text-xs text-dimmed">
            Nenhuma ideia no radar por enquanto.
          </p>
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
