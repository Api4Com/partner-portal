<script setup lang="ts">
const { user, logout: signOut } = useAuth()

// Itens ainda não portados ficam desabilitados até virarem telas.
const operacao = [
  { label: 'Painel Geral', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Roadmap', icon: 'i-lucide-map', to: '/roadmap' },
  { label: 'Relatórios', icon: 'i-lucide-chart-column', to: '/relatorio' }
]
const plataforma = [
  { label: 'Playbook', icon: 'i-lucide-cable', disabled: true }
]
const adminItems = [{ label: 'Admin', icon: 'i-lucide-shield', to: '/admin' }]

const { data: isAdmin } = useIsAdmin()

const userLabel = computed(() => {
  if (user.value?.name) return user.value.name
  if (user.value?.email) return user.value.email
  return 'Parceiro'
})

// Iniciais do usuário logado, derivadas do nome ou do e-mail.
const userInitials = computed(() => {
  const name = user.value?.name?.trim()
  const src = name ? name : (user.value?.email ?? '')
  const parts = src.replace(/[@._-]/g, ' ').split(/\s+/).filter(Boolean)
  const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
  return initials ? initials : 'P'
})

// Produtos do workspace API4COM acessíveis pelo launcher (clique no logo).
// Itens externos abrem em nova aba; o "Portal de Parceiros" (current) é rota interna.
const WORKSPACE_APPS = [
  { label: 'Portal do Usuário', description: 'Conta, extensões e configurações', href: 'https://app.api4com.com', icon: 'i-lucide-users' },
  { label: 'Webphone', description: 'Faça e receba chamadas no navegador', href: 'https://chromewebstore.google.com/detail/webphone-api4com/ccahjcilejbllkkgngikflblpgojjdaa', icon: 'i-lucide-headphones' },
  { label: 'Portal de Parceiros', description: 'Você está aqui', href: '/', icon: 'i-lucide-layout-grid', current: true }
]
const launcherOpen = ref(false)

async function logout() {
  await signOut()
  await navigateTo('/login')
}
</script>

<template>
  <aside class="flex h-screen w-[250px] shrink-0 flex-col border-r border-default bg-default">
    <!-- Marca + launcher de produtos do workspace -->
    <div class="border-b border-default px-[18px] py-5">
      <UPopover
        v-model:open="launcherOpen"
        :ui="{ content: 'p-0' }"
      >
        <button
          type="button"
          class="group flex w-full items-center gap-3 rounded-xl text-left"
          aria-haspopup="menu"
          title="Acessar produtos API4COM"
        >
          <div class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-900/30">
            <UIcon
              name="i-lucide-radio"
              class="h-5 w-5"
            />
          </div>
          <div class="min-w-0 flex-1 leading-tight">
            <div class="font-bold tracking-tight">
              API4COM
            </div>
            <div class="text-[11px] text-muted">
              Portal de Parceiros
            </div>
          </div>
          <UIcon
            name="i-lucide-chevron-down"
            class="h-4 w-4 shrink-0 text-dimmed transition-transform"
            :class="launcherOpen ? 'rotate-180' : ''"
          />
        </button>

        <template #content>
          <div class="w-[222px] py-1">
            <p class="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-dimmed">
              Workspace API4COM
            </p>
            <template
              v-for="app in WORKSPACE_APPS"
              :key="app.label"
            >
              <NuxtLink
                v-if="app.current"
                :to="app.href"
                class="flex items-center gap-2.5 bg-primary/5 px-3 py-2 transition-colors hover:bg-muted"
                @click="launcherOpen = false"
              >
                <div class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <UIcon
                    :name="app.icon"
                    class="h-[17px] w-[17px]"
                  />
                </div>
                <div class="min-w-0 flex-1 leading-tight">
                  <div class="truncate text-[13px] font-semibold">{{ app.label }}</div>
                  <div class="truncate text-[11px] text-dimmed">{{ app.description }}</div>
                </div>
              </NuxtLink>
              <a
                v-else
                :href="app.href"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-muted"
                @click="launcherOpen = false"
              >
                <div class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <UIcon
                    :name="app.icon"
                    class="h-[17px] w-[17px]"
                  />
                </div>
                <div class="min-w-0 flex-1 leading-tight">
                  <div class="truncate text-[13px] font-semibold">{{ app.label }}</div>
                  <div class="truncate text-[11px] text-dimmed">{{ app.description }}</div>
                </div>
              </a>
            </template>
          </div>
        </template>
      </UPopover>
    </div>

    <!-- Navegação -->
    <nav class="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3.5">
      <p class="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-dimmed">
        Operação
      </p>
      <UNavigationMenu
        orientation="vertical"
        :items="operacao"
      />

      <p class="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-dimmed">
        Plataforma
      </p>
      <UNavigationMenu
        orientation="vertical"
        :items="plataforma"
      />

      <template v-if="isAdmin">
        <p class="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-dimmed">
          Administração
        </p>
        <UNavigationMenu
          orientation="vertical"
          :items="adminItems"
        />
      </template>
    </nav>

    <!-- Usuário -->
    <div class="flex items-center gap-2.5 border-t border-default p-3">
      <div class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-900 text-[13px] font-semibold text-white">
        {{ userInitials }}
      </div>
      <div class="min-w-0 flex-1 leading-tight">
        <div class="truncate text-[13px] font-semibold">
          {{ userLabel }}
        </div>
        <div class="truncate text-[11px] font-medium text-primary">
          {{ isAdmin ? 'Admin' : 'Parceiro' }}
        </div>
      </div>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-log-out"
        aria-label="Sair"
        @click="logout"
      />
    </div>
  </aside>
</template>
