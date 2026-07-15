<script setup lang="ts">
import type { RoadmapItem } from '~/lib/roadmap'

const props = defineProps<{ item: RoadmapItem }>()

const { states, myComments, openItem, react } = useRoadmap()

const state = computed(() => states.value[props.item.id])
const likeCount = computed(() => state.value?.likeCount ?? 0)
const dislikeCount = computed(() => state.value?.dislikeCount ?? 0)
const myReaction = computed(() => state.value?.myReaction ?? null)
const myCommentCount = computed(() => myComments.value[props.item.id]?.length ?? 0)

// Itens do radar ganham cara de "rascunho" (borda tracejada, tom lavado):
// comunica visualmente que é possibilidade, não compromisso.
const isRadar = computed(() => props.item.horizon !== 'now')
const shellClass = computed(() =>
  isRadar.value
    ? 'border-dashed border-amber-200 bg-amber-50/30 shadow-none hover:border-amber-400 dark:border-violet-400/20 dark:bg-violet-400/5 dark:hover:border-violet-400/50'
    : 'border-default bg-default shadow-sm hover:border-brand-300 hover:shadow-lg'
)
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="group w-full cursor-pointer rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    :class="shellClass"
    @click="openItem(item.id)"
    @keydown.enter.prevent="openItem(item.id)"
    @keydown.space.prevent="openItem(item.id)"
  >
    <div class="flex items-start justify-between gap-2">
      <h3 class="text-sm font-semibold leading-snug">
        {{ item.title }}
      </h3>
      <UIcon
        name="i-lucide-arrow-up-right"
        class="h-4 w-4 shrink-0 text-dimmed transition-colors group-hover:text-brand-500"
      />
    </div>

    <p class="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted">
      {{ item.commercial.headline }}
    </p>

    <div class="mt-3 flex items-center justify-between border-t border-default pt-3">
      <!-- Reagir sem abrir o item -->
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors"
          :class="myReaction === 'like'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-default text-muted hover:border-emerald-200 hover:text-emerald-700'"
          :aria-pressed="myReaction === 'like'"
          title="Gostei"
          @click.stop="react(item.id, 'like')"
        >
          <UIcon
            name="i-lucide-thumbs-up"
            class="h-3.5 w-3.5"
          />
          {{ likeCount }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors"
          :class="myReaction === 'dislike'
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-default text-muted hover:border-rose-200 hover:text-rose-700'"
          :aria-pressed="myReaction === 'dislike'"
          title="Não gostei"
          @click.stop="react(item.id, 'dislike')"
        >
          <UIcon
            name="i-lucide-thumbs-down"
            class="h-3.5 w-3.5"
          />
          {{ dislikeCount }}
        </button>
        <span
          v-if="myCommentCount"
          class="inline-flex items-center gap-1 text-xs font-medium text-muted"
          :title="`Você comentou ${myCommentCount} ${myCommentCount === 1 ? 'vez' : 'vezes'}`"
        >
          <UIcon
            name="i-lucide-message-square"
            class="h-3.5 w-3.5"
          />
          {{ myCommentCount }}
        </span>
      </div>

      <span class="inline-flex items-center gap-1 text-xs font-medium text-primary">
        Ver detalhes <UIcon
          name="i-lucide-arrow-up-right"
          class="h-3.5 w-3.5"
        />
      </span>
    </div>
  </div>
</template>
