<script setup lang="ts">
defineProps<{
  title?: string
  /** Trilha de navegação; o último item é a página atual (sem link). */
  breadcrumbs?: { label: string, to?: string }[]
}>()
</script>

<template>
  <header class="z-10 flex h-[62px] shrink-0 items-center justify-between gap-4 border-b border-default bg-default/85 px-7 backdrop-blur">
    <nav
      v-if="breadcrumbs?.length"
      class="flex items-center gap-1.5 text-sm"
    >
      <template
        v-for="(b, i) in breadcrumbs"
        :key="i"
      >
        <NuxtLink
          v-if="b.to"
          :to="b.to"
          class="font-medium text-muted transition-colors hover:text-default"
        >{{ b.label }}</NuxtLink>
        <span
          v-else
          class="font-semibold text-default"
        >{{ b.label }}</span>
        <UIcon
          v-if="i < breadcrumbs.length - 1"
          name="i-lucide-chevron-right"
          class="h-4 w-4 shrink-0 text-dimmed"
        />
      </template>
    </nav>
    <div
      v-else
      class="text-sm font-semibold"
    >
      {{ title }}
    </div>
    <div class="flex items-center gap-3">
      <slot name="right" />
    </div>
  </header>
</template>
