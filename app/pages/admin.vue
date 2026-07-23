<script setup lang="ts">
import { fetchAdminData } from '~/lib/admin'

const { user, bffFetch } = useAuth()
// Mesma allowlist que barra as rotas de admin no BFF — fonte única do gate.
const { data: isAdmin, status: adminStatus } = useIsAdmin()

// Resolve no cliente (sessão garantida) — evita falso "não-admin" quando o SSR roda sem sessão.
const { data, status } = useAsyncData('admin', async () => {
  if (!user.value || !isAdmin.value) return null
  return await fetchAdminData(bffFetch)
}, { server: false, lazy: true, default: () => null, watch: [user, isAdmin] })

// Redireciona pelo GATE, não pelo `data`: o `isAdmin` começa `false` e só resolve
// depois: olhar `!data` expulsaria um admin real no primeiro tick.
watchEffect(() => {
  if (import.meta.client && adminStatus.value === 'success' && user.value && !isAdmin.value) {
    navigateTo('/')
  }
})
</script>

<template>
  <AdminDashboard
    v-if="data"
    :data="data"
    :user-email="user?.email ?? ''"
  />
  <div
    v-else-if="status === 'pending'"
    class="grid flex-1 place-items-center text-sm text-muted"
  >
    <span class="inline-flex items-center gap-2">
      <UIcon
        name="i-lucide-loader-circle"
        class="h-4 w-4 animate-spin"
      /> Carregando painel…
    </span>
  </div>
</template>
