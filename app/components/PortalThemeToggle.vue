<script setup lang="ts">
// Alterna claro/escuro manualmente. `colorMode.preference` é persistido pelo
// @nuxtjs/color-mode, então a escolha sobrevive ao reload e aos próximos acessos.
withDefaults(defineProps<{
  // Mostra tooltip lateral (útil quando a sidebar está recolhida).
  tooltip?: boolean
}>(), { tooltip: false })

const colorMode = useColorMode()

const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (v: boolean) => {
    colorMode.preference = v ? 'dark' : 'light'
  }
})
</script>

<template>
  <!-- ClientOnly: o tema só é conhecido no cliente; evita mismatch de hidratação no ícone. -->
  <ClientOnly>
    <UTooltip
      :text="isDark ? 'Tema claro' : 'Tema escuro'"
      :content="{ side: 'right' }"
      :disabled="!tooltip"
    >
      <UButton
        color="neutral"
        variant="ghost"
        :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
        :aria-label="isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'"
        @click="isDark = !isDark"
      />
    </UTooltip>
    <template #fallback>
      <div class="h-8 w-8 shrink-0" />
    </template>
  </ClientOnly>
</template>
