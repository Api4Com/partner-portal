<script setup lang="ts">
import { HORIZONS, type PartnerProfile } from '~/lib/roadmap'

const {
  activeItem,
  activeItemId,
  closeItem,
  states,
  react
} = useRoadmap()

const tab = ref<PartnerProfile>('commercial')

// Ao abrir um item, volta para a aba Comercial.
watch(activeItemId, (id) => {
  if (id) tab.value = 'commercial'
})

const open = computed({
  get: () => activeItemId.value !== null,
  set: (v: boolean) => {
    if (!v) closeItem()
  }
})

const state = computed(() => (activeItem.value ? states.value[activeItem.value.id] : undefined))
const myReaction = computed(() => state.value?.myReaction ?? null)
const likeCount = computed(() => state.value?.likeCount ?? 0)
const dislikeCount = computed(() => state.value?.dislikeCount ?? 0)
const horizon = computed(() => HORIZONS.find(h => h.id === activeItem.value?.horizon))

// Força o download (Content-Disposition: attachment) em vez de abrir inline.
function downloadUrl(url: string) {
  return url + (url.includes('?') ? '&' : '?') + 'download'
}

function vote(reaction: 'like' | 'dislike') {
  if (activeItem.value) react(activeItem.value.id, reaction)
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="activeItem?.title"
    :description="activeItem?.summary"
  >
    <template #body>
      <div
        v-if="activeItem"
        class="space-y-5"
      >
        <!-- Horizonte + abas -->
        <div class="flex flex-wrap items-center gap-2">
          <span
            v-if="horizon"
            class="rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
            :class="horizon.id === 'now'
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              : 'bg-amber-50 text-amber-700 ring-amber-200'"
          >
            {{ horizon.title }}
          </span>
        </div>

        <div class="flex rounded-xl border border-default bg-muted p-1">
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="tab === 'commercial' ? 'bg-primary text-inverted shadow-sm' : 'text-muted hover:text-default'"
            @click="tab = 'commercial'"
          >
            <UIcon
              name="i-lucide-briefcase"
              class="h-4 w-4"
            /> Comercial
          </button>
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="tab === 'technical' ? 'bg-primary text-inverted shadow-sm' : 'text-muted hover:text-default'"
            @click="tab = 'technical'"
          >
            <UIcon
              name="i-lucide-code-2"
              class="h-4 w-4"
            /> Técnico
          </button>
        </div>

        <!-- Comercial -->
        <div
          v-if="tab === 'commercial'"
          class="space-y-6"
        >
          <section>
            <div class="mb-2.5 flex items-center gap-2">
              <UIcon
                name="i-lucide-trending-up"
                class="h-4 w-4 text-primary"
              />
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
                Valor de Negócio
              </h4>
            </div>
            <p
              v-if="activeItem.commercial.headline"
              class="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm font-medium leading-relaxed text-brand-900"
            >
              {{ activeItem.commercial.headline }}
            </p>
            <p
              v-if="activeItem.commercial.businessValue"
              class="mt-3 text-sm leading-relaxed text-muted"
            >
              {{ activeItem.commercial.businessValue }}
            </p>
          </section>

          <section v-if="activeItem.commercial.files.length">
            <div class="mb-2.5 flex items-center gap-2">
              <UIcon
                name="i-lucide-download"
                class="h-4 w-4 text-primary"
              />
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
                Kit de Vendas
              </h4>
            </div>
            <div class="space-y-2">
              <a
                v-for="(f, idx) in activeItem.commercial.files"
                :key="idx"
                :href="downloadUrl(f.url)"
                :download="f.label"
                class="group flex w-full items-center justify-between rounded-xl border border-default bg-default p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <span class="flex items-center gap-3">
                  <span class="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
                    <UIcon
                      name="i-lucide-file-text"
                      class="h-4 w-4"
                    />
                  </span>
                  <span class="text-sm font-medium">{{ f.label }}</span>
                </span>
                <UIcon
                  name="i-lucide-download"
                  class="h-4 w-4 text-dimmed transition-colors group-hover:text-brand-600"
                />
              </a>
            </div>
          </section>
        </div>

        <!-- Técnico -->
        <div
          v-else
          class="space-y-6"
        >
          <section v-if="activeItem.technical.impactSummary">
            <div class="mb-2.5 flex items-center gap-2">
              <UIcon
                name="i-lucide-zap"
                class="h-4 w-4 text-primary"
              />
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
                Impacto Técnico
              </h4>
            </div>
            <p class="text-sm leading-relaxed text-muted">
              {{ activeItem.technical.impactSummary }}
            </p>
          </section>

          <section v-if="activeItem.technical.files.length">
            <div class="mb-2.5 flex items-center gap-2">
              <UIcon
                name="i-lucide-file-code-2"
                class="h-4 w-4 text-primary"
              />
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
                Documentação Técnica
              </h4>
            </div>
            <div class="space-y-2">
              <a
                v-for="(f, idx) in activeItem.technical.files"
                :key="idx"
                :href="downloadUrl(f.url)"
                :download="f.label"
                class="group flex w-full items-center justify-between rounded-xl border border-default bg-default p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <span class="flex items-center gap-3">
                  <span class="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
                    <UIcon
                      name="i-lucide-paperclip"
                      class="h-4 w-4"
                    />
                  </span>
                  <span class="text-sm font-medium">{{ f.label }}</span>
                </span>
                <UIcon
                  name="i-lucide-download"
                  class="h-4 w-4 text-dimmed transition-colors group-hover:text-brand-600"
                />
              </a>
            </div>
          </section>
        </div>

        <!-- Comentários (sempre visível, independente da aba) -->
        <div class="border-t border-default pt-5">
          <RoadmapComments :item-id="activeItem.id" />
        </div>
      </div>
    </template>

    <template #footer>
      <div
        v-if="activeItem"
        class="flex w-full gap-2"
      >
        <UButton
          block
          size="lg"
          class="flex-1"
          :color="myReaction === 'like' ? 'success' : 'neutral'"
          :variant="myReaction === 'like' ? 'solid' : 'subtle'"
          icon="i-lucide-thumbs-up"
          @click="vote('like')"
        >
          Gostei · {{ likeCount }}
        </UButton>
        <UButton
          block
          size="lg"
          class="flex-1"
          :color="myReaction === 'dislike' ? 'error' : 'neutral'"
          :variant="myReaction === 'dislike' ? 'solid' : 'subtle'"
          icon="i-lucide-thumbs-down"
          @click="vote('dislike')"
        >
          Não gostei · {{ dislikeCount }}
        </UButton>
      </div>
    </template>
  </USlideover>
</template>
