<script setup lang="ts">
/**
 * Chips removíveis das condições de filtro ativas (estilo Pipedrive).
 * Cada chip carrega seu próprio `clear()`; o botão final emite `clearAll`.
 * Extraído do detalhe da subconta para reaproveitar no relatório.
 */
defineProps<{
  chips: { key: string, label: string, clear: () => void }[]
}>()

defineEmits<{ clearAll: [] }>()
</script>

<template>
  <div v-if="chips.length" class="flex flex-wrap items-center gap-1.5">
    <span
      v-for="chip in chips"
      :key="chip.key"
      class="inline-flex items-center gap-1 rounded-full border border-default bg-muted py-1 pl-2.5 pr-1 text-xs font-medium text-muted"
    >
      {{ chip.label }}
      <button
        type="button"
        class="grid h-4 w-4 place-items-center rounded-full transition-colors hover:bg-default"
        :aria-label="`Remover filtro ${chip.label}`"
        @click="chip.clear()"
      >
        <UIcon name="i-lucide-x" class="h-3 w-3" />
      </button>
    </span>
    <UButton color="neutral" variant="link" size="xs" @click="$emit('clearAll')">
      Limpar tudo
    </UButton>
  </div>
</template>
