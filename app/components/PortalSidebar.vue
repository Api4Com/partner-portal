<script setup lang="ts">
import { CONTA_PRINCIPAL } from '~/lib/contas'

const supabase = useSupabaseClient()
const user = useSupabaseUser()

// Itens ainda não portados ficam desabilitados até virarem telas.
const operacao = [
  { label: 'Painel Geral', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Agente API4COM', icon: 'i-lucide-sparkles', to: '/agente' },
  { label: 'Roadmap', icon: 'i-lucide-map', to: '/roadmap' },
  { label: 'Faturamento', icon: 'i-lucide-receipt', disabled: true },
  { label: 'Relatórios & CDR', icon: 'i-lucide-chart-column', disabled: true }
]
const plataforma = [
  { label: 'Playbook', icon: 'i-lucide-cable', disabled: true },
  { label: 'Configurações', icon: 'i-lucide-settings', disabled: true }
]
const adminItems = [{ label: 'Admin', icon: 'i-lucide-shield', to: '/admin' }]

const { data: isAdmin } = useIsAdmin()

const userLabel = computed(
  () => (user.value?.user_metadata?.full_name as string) || user.value?.email || 'Parceiro'
)

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <aside class="flex h-screen w-[250px] shrink-0 flex-col border-r border-default bg-default">
    <!-- Marca -->
    <div class="flex items-center gap-3 border-b border-default px-[18px] py-5">
      <div class="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-900/30">
        <UIcon name="i-lucide-phone" class="h-5 w-5" />
      </div>
      <div class="leading-tight">
        <div class="font-bold tracking-tight">API4COM</div>
        <div class="text-[11px] text-muted">Portal de Parceiros</div>
      </div>
    </div>

    <!-- Navegação -->
    <nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3.5">
      <p class="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-dimmed">
        Operação
      </p>
      <UNavigationMenu orientation="vertical" :items="operacao" />

      <p class="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-dimmed">
        Plataforma
      </p>
      <UNavigationMenu orientation="vertical" :items="plataforma" />

      <template v-if="isAdmin">
        <p class="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-dimmed">
          Administração
        </p>
        <UNavigationMenu orientation="vertical" :items="adminItems" />
      </template>
    </nav>

    <!-- Usuário -->
    <div class="flex items-center gap-2.5 border-t border-default p-3">
      <div class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-900 text-[13px] font-semibold text-white">
        {{ CONTA_PRINCIPAL.initials }}
      </div>
      <div class="min-w-0 flex-1 leading-tight">
        <div class="truncate text-[13px] font-semibold">{{ userLabel }}</div>
        <div class="truncate text-[11px] font-medium text-primary">Parceiro</div>
      </div>
      <UButton color="neutral" variant="ghost" icon="i-lucide-log-out" aria-label="Sair" @click="logout" />
    </div>
  </aside>
</template>
