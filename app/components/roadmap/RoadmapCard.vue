<script setup lang="ts">
import { TAG_META, type RoadmapItem } from '~/lib/roadmap'

const props = defineProps<{ item: RoadmapItem }>()

const { profile, states, openItem } = useRoadmap()

const state = computed(() => states.value[props.item.id])
const interested = computed(() => state.value?.interested ?? false)
const betaRequested = computed(() => state.value?.betaRequested ?? false)
const interestCount = computed(() => state.value?.interestCount ?? 0)
const tag = computed(() => TAG_META[props.item.tag])
</script>

<template>
  <button
    type="button"
    class="group w-full rounded-2xl border border-default bg-default p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg focus:outline-none"
    @click="openItem(item.id)"
  >
    <div class="flex items-start justify-between gap-2">
      <span
        class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold"
        :class="tag.className"
      >
        <UIcon
          v-if="item.tag === 'breaking-change'"
          name="i-lucide-triangle-alert"
          class="h-3 w-3"
        />
        {{ tag.label }}
      </span>
      <UIcon
        name="i-lucide-arrow-up-right"
        class="h-4 w-4 shrink-0 text-dimmed transition-colors group-hover:text-brand-500"
      />
    </div>

    <h3 class="mt-2.5 text-sm font-semibold leading-snug">
      {{ item.title }}
    </h3>

    <p class="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted">
      {{ profile === 'commercial' ? item.commercial.headline : item.technical.impactSummary }}
    </p>

    <div class="mt-3 flex items-center justify-between border-t border-default pt-3">
      <span
        v-if="profile === 'commercial'"
        class="inline-flex items-center gap-1.5 text-xs font-medium"
        :class="interested ? 'text-emerald-600' : 'text-muted'"
      >
        <UIcon
          name="i-lucide-users"
          class="h-3.5 w-3.5"
        />
        {{ interestCount }} interessados
      </span>
      <span
        v-else
        class="inline-flex items-center gap-1.5 text-xs font-medium text-muted"
      >
        <UIcon
          name="i-lucide-code-2"
          class="h-3.5 w-3.5"
        />
        {{ item.technical.endpoints.length }} endpoint{{ item.technical.endpoints.length > 1 ? 's' : '' }}
      </span>

      <template v-if="profile === 'commercial'">
        <span
          v-if="interested"
          class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"
        >
          <UIcon
            name="i-lucide-circle-check"
            class="h-3.5 w-3.5"
          /> Lead marcado
        </span>
        <span
          v-else
          class="inline-flex items-center gap-1 text-xs font-medium text-primary"
        >
          <UIcon
            name="i-lucide-trending-up"
            class="h-3.5 w-3.5"
          /> Ver valor
        </span>
      </template>
      <template v-else>
        <span
          v-if="betaRequested"
          class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"
        >
          <UIcon
            name="i-lucide-circle-check"
            class="h-3.5 w-3.5"
          /> Beta solicitado
        </span>
        <span
          v-else
          class="text-xs font-medium text-primary"
        >Ver detalhes</span>
      </template>
    </div>
  </button>
</template>
