<script setup lang="ts">
import type { ConteudoTipo } from '~/lib/conteudos'
import { CONTEUDOS, TIPO_META } from '~/lib/conteudos'

const requestOpen = ref(false)

const search = ref('')
const tipoFilter = ref<ConteudoTipo | 'todos'>('todos')

const featured = computed(() => CONTEUDOS.find(c => c.featured) ?? null)

// Demais conteúdos (fora o destaque), sujeitos a busca + filtro de tipo.
const rest = computed(() => {
  const q = search.value.trim().toLowerCase()
  return CONTEUDOS.filter(c => !c.featured).filter((c) => {
    const okTipo = tipoFilter.value === 'todos' || c.tipo === tipoFilter.value
    const okBusca
      = !q
        || c.title.toLowerCase().includes(q)
        || c.description.toLowerCase().includes(q)
        || (c.tags ?? []).some(t => t.toLowerCase().includes(q))
    return okTipo && okBusca
  })
})

// Barra de busca/filtro só aparece quando há biblioteca suficiente pra justificar.
const showToolbar = computed(() => CONTEUDOS.filter(c => !c.featured).length > 3)

const tipoChips = computed(() => [
  { value: 'todos' as const, label: 'Todos' },
  ...(Object.keys(TIPO_META) as ConteudoTipo[]).map(value => ({ value, label: TIPO_META[value].label }))
])
</script>

<template>
  <PortalTopbar title="Conteúdos" />

  <div class="flex-1 overflow-y-auto px-7 pb-12 pt-7">
    <div class="mx-auto max-w-[1240px] space-y-8">
      <!-- Cabeçalho -->
      <section class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex flex-col gap-1">
          <p class="text-xs font-semibold tracking-wide text-primary">
            Portal do Parceiro
          </p>
          <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
            Conteúdos
          </h1>
          <p class="max-w-2xl text-sm text-muted">
            Estudos, dados e materiais que a API4COM produz pra te ajudar a vender mais e argumentar melhor. Novidades entram por aqui.
          </p>
        </div>

        <UButton
          icon="i-lucide-lightbulb"
          size="lg"
          class="shrink-0"
          @click="requestOpen = true"
        >
          Solicitar um estudo
        </UButton>
      </section>

      <!-- Destaque -->
      <section v-if="featured">
        <ConteudosCard
          :conteudo="featured"
          featured
        />
      </section>

      <!-- Biblioteca -->
      <section
        v-if="rest.length || showToolbar"
        class="space-y-4"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="text-lg font-semibold">
            Biblioteca
          </h2>

          <div
            v-if="showToolbar"
            class="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <UInput
              v-model="search"
              icon="i-lucide-search"
              placeholder="Buscar conteúdo…"
              class="w-full sm:w-64"
            />
            <div class="flex flex-wrap gap-1.5">
              <UButton
                v-for="chip in tipoChips"
                :key="chip.value"
                size="xs"
                :color="tipoFilter === chip.value ? 'primary' : 'neutral'"
                :variant="tipoFilter === chip.value ? 'solid' : 'soft'"
                @click="tipoFilter = chip.value"
              >
                {{ chip.label }}
              </UButton>
            </div>
          </div>
        </div>

        <div
          v-if="rest.length"
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <ConteudosCard
            v-for="c in rest"
            :key="c.id"
            :conteudo="c"
          />
        </div>

        <div
          v-else
          class="rounded-2xl border border-dashed border-default py-12 text-center"
        >
          <UIcon
            name="i-lucide-search-x"
            class="mx-auto h-8 w-8 text-dimmed"
          />
          <p class="mt-2 text-sm text-muted">
            Nenhum conteúdo encontrado com esses filtros.
          </p>
        </div>
      </section>

      <!-- Chamada pra solicitar conteúdo -->
      <section class="overflow-hidden rounded-2xl border border-default bg-muted/40 p-6 sm:p-8">
        <div class="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-start gap-4">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UIcon
                name="i-lucide-message-circle-question"
                class="h-6 w-6"
              />
            </div>
            <div>
              <h2 class="text-lg font-semibold">
                Ficou com uma pergunta ou hipótese?
              </h2>
              <p class="mt-1 max-w-xl text-sm text-muted">
                Quando surgir uma dúvida ou algo que você gostaria de comprovar com dados, solicite o estudo aqui. Sua sugestão ajuda a pautar os próximos conteúdos da API4COM.
              </p>
            </div>
          </div>
          <UButton
            icon="i-lucide-lightbulb"
            size="lg"
            class="shrink-0"
            @click="requestOpen = true"
          >
            Solicitar um estudo
          </UButton>
        </div>
      </section>
    </div>
  </div>

  <ConteudosSolicitar v-model:open="requestOpen" />
</template>
