<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'pt-BR' },
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }]
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
