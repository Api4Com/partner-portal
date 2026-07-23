<script setup lang="ts">
import { fetchRoadmapFromBff, whatsappUrl } from '~/lib/roadmap'

// Garante o usuário no cliente (F5): a auth SSR não resolve, e o middleware global
// não re-roda na carga inicial — sem isto o `user` ficaria null.
const { user: authUser, fetchUser, bffFetch } = useAuth()
const { items, states, myComments } = useRoadmap()

// Lê itens publicados + estado do usuário. A auth SSR não resolve o usuário, então
// no servidor isto volta vazio e o Nuxt cacheia esse vazio — por isso REBUSCAMOS no
// cliente (`refresh()` no onMounted), senão o roadmap "some" no F5.
const { data, refresh } = await useAsyncData('roadmap', async () => {
  if (!authUser.value) return { items: [], states: {}, comments: {} }
  return await fetchRoadmapFromBff(bffFetch)
})

// No F5 a auth SSR não resolve o usuário, então o `useAsyncData` volta vazio e o
// Nuxt cacheia isso. Ao montar no cliente: garante o usuário e REBUSCA os itens —
// senão o roadmap aparece vazio ao recarregar.
onMounted(async () => {
  if (!authUser.value) await fetchUser()
  await refresh()
})

watchEffect(() => {
  if (!data.value) return
  items.value = data.value.items
  states.value = data.value.states
  myComments.value = data.value.comments
})

// Camada do que já está em desenvolvimento.
const nowItems = computed(() => items.value.filter(i => i.horizon === 'now'))
// Caixa de ideias no radar: "próximo" + "futuro" juntos, sem ordem de prioridade.
const radarItems = computed(() => items.value.filter(i => i.horizon !== 'now'))

// Modal de "Solicitar demanda" (POST /roadmap/requests via BFF).
// Fora delas, o botão continua sendo o link direto pro WhatsApp (ver template).
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
            <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
              Construindo junto com você
            </h1>
            <p class="max-w-2xl text-sm text-muted">
              Este é um espaço aberto pra explorar possibilidades junto com você. Veja o que está no radar, acompanhe o que já está sendo construído e fale com a gente pra sugerir o que falta.
            </p>
          </div>

          <!-- Abre o formulário de solicitação (POST /roadmap/requests via BFF). -->
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
        <div class="rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-6 dark:border-violet-400/25 dark:bg-violet-400/5">
          <div class="mb-4 flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-radar"
                class="h-5 w-5 text-amber-500 dark:text-violet-400"
              />
              <h2 class="text-lg font-semibold">
                No radar
              </h2>
              <span class="rounded-full bg-amber-100/70 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20">
                {{ radarItems.length }}
              </span>
              <span class="ml-1 text-[11px] font-medium uppercase tracking-wide text-amber-600/80 dark:text-violet-400/70">
                Backlog de possibilidades
              </span>
            </div>
            <p class="max-w-2xl text-sm text-muted">
              Um espaço aberto pra explorar possibilidades junto com você.
            </p>
            <!-- Selo de não-compromisso -->
            <div class="flex items-start gap-2 rounded-lg bg-amber-100/50 px-3 py-2 text-xs leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-200/70 dark:bg-violet-400/10 dark:text-violet-200/90 dark:ring-violet-400/20">
              <UIcon
                name="i-lucide-info"
                class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-violet-400"
              />
              <span>
                Estar aqui <strong class="font-semibold">não garante desenvolvimento</strong> — é onde avaliamos ideias antes de decidir o que priorizar.
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <RoadmapCard
              v-for="item in radarItems"
              :key="item.id"
              :item="item"
            />
          </div>
          <p
            v-if="radarItems.length === 0"
            class="px-2 py-8 text-center text-xs text-dimmed"
          >
            Nenhuma ideia no radar por enquanto.
          </p>

          <!-- Escalonamento de urgência: baixo destaque, contato direto -->
          <div class="mt-5 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 border-t border-amber-200/60 pt-4 text-center text-xs text-muted dark:border-violet-400/15">
            <span>Alguma dessas ideias é crítica pra você ou seus clientes?</span>
            <a
              :href="whatsappUrl()"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 font-semibold text-amber-700 underline-offset-2 hover:text-amber-800 hover:underline dark:text-violet-300 dark:hover:text-violet-200"
            >
              <UIcon
                name="i-lucide-message-circle"
                class="h-3.5 w-3.5"
              />
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
              <h2 class="text-lg font-semibold">
                Em desenvolvimento agora
              </h2>
              <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {{ nowItems.length }}
              </span>
            </div>
            <p class="text-sm text-muted">
              O que o time já está construindo.
            </p>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RoadmapCard
              v-for="item in nowItems"
              :key="item.id"
              :item="item"
            />
          </div>
          <p
            v-if="nowItems.length === 0"
            class="px-2 py-8 text-center text-xs text-dimmed"
          >
            Nada em desenvolvimento ativo no momento.
          </p>
        </div>
      </section>
    </div>
  </div>

  <RoadmapDrawer />
  <!-- Formulário de solicitação de demanda (todos os parceiros). -->
  <RoadmapRequestModal
    v-model:open="requestOpen"
  />
</template>
