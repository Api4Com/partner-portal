<script setup lang="ts" generic="T extends string">
/**
 * Grupo de "pills" de filtro (seleção única) — usado dentro do popover "Filtrar".
 * Extraído do detalhe da subconta para reaproveitar em telas com o mesmo molde.
 */
defineProps<{
  label: string
  items: { label: string, value: T }[]
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div>
    <p class="mb-1.5 text-xs font-semibold text-muted">{{ label }}</p>
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="opt in items"
        :key="opt.value"
        type="button"
        class="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
        :class="model === opt.value ? 'border-primary bg-primary text-inverted' : 'border-default bg-default text-muted hover:bg-muted'"
        @click="model = opt.value"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
