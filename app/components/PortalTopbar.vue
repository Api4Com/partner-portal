<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <header class="z-10 flex h-[62px] shrink-0 items-center justify-between gap-4 border-b border-default bg-default/85 px-7 backdrop-blur">
    <div class="text-sm font-semibold">{{ title }}</div>
    <div class="flex items-center gap-3">
      <slot name="right" />
    </div>
  </header>
</template>
