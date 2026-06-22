<script setup lang="ts">
import { fetchAdminData } from '~/lib/admin'

const supabase = useSupabaseClient()
const user = useSupabaseUser()

// Busca dados de admin; retorna null se o usuário não for admin (gating).
const { data } = await useAsyncData('admin', async () => {
  if (!user.value) return null
  const { data: ok } = await (supabase as any).rpc('roadmap_is_admin')
  if (ok !== true) return null
  return await fetchAdminData(supabase)
})

// Não-admin (ou sem dados) é redirecionado para a home.
if (!data.value) {
  await navigateTo('/')
}
</script>

<template>
  <AdminDashboard v-if="data" :data="data" :user-email="user?.email ?? ''" />
</template>
