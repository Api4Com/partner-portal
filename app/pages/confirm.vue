<script setup lang="ts">
definePageMeta({ layout: false })

// Página de callback do Supabase (confirmação de e-mail / magic link).
const user = useSupabaseUser()

watch(user, () => {
  if (user.value) navigateTo('/')
}, { immediate: true })
</script>

<template>
  <div class="grid min-h-screen place-items-center bg-default">
    <div class="flex items-center gap-3 text-muted">
      <UIcon name="i-lucide-loader-circle" class="h-5 w-5 animate-spin" />
      Confirmando seu acesso…
    </div>
  </div>
</template>
