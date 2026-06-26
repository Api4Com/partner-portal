<script setup lang="ts">
import { fetchAdminData } from '~/lib/admin'

const supabase = useSupabaseClient()
const user = useSupabaseUser()

// Resolve no cliente (sessão garantida) — evita falso "não-admin" quando o SSR roda sem sessão.
const { data, status } = useAsyncData('admin', async () => {
  if (!user.value) return null
  const { data: ok } = await (supabase as any).rpc('roadmap_is_admin')
  if (ok !== true) return null
  return await fetchAdminData(supabase)
}, { server: false, lazy: true, default: () => null, watch: [user] })

// Redireciona só depois de resolver e confirmar que não é admin.
watchEffect(() => {
  if (import.meta.client && status.value === 'success' && user.value && !data.value) {
    navigateTo('/')
  }
})
</script>

<template>
  <AdminDashboard v-if="data" :data="data" :user-email="user?.email ?? ''" />
  <div v-else-if="status === 'pending'" class="grid flex-1 place-items-center text-sm text-muted">
    <span class="inline-flex items-center gap-2">
      <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin" /> Carregando painel…
    </span>
  </div>
</template>
