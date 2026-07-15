<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'pt-BR' },
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    { rel: 'apple-touch-icon', href: '/icon.png' }
  ]
})

useSeoMeta({
  title: 'API4COM · Portal de Parceiros',
  description: 'Programa de Parceiros API4COM — roadmap, clientes e operação.'
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
