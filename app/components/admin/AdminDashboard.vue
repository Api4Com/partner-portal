<script setup lang="ts">
import { HORIZONS, TAG_META, type RoadmapItem } from '~/lib/roadmap'
import { fmtDate, type AdminBeta, type AdminData } from '~/lib/admin'

const props = defineProps<{ data: AdminData, userEmail: string }>()

const supabase = useSupabaseClient()
const toast = useToast()

type Tab = 'roadmap' | 'leads' | 'betas'
const tab = ref<Tab>('roadmap')

const editorOpen = ref(false)
const editing = ref<RoadmapItem | null>(null)

const totalInterest = computed(() => props.data.interests.length)
const pendingBetas = computed(() => props.data.betas.filter(b => b.status === 'requested').length)
const publishedCount = computed(() => props.data.items.filter(i => i.published).length)

const tabs: { id: Tab, label: string, icon: string }[] = [
  { id: 'roadmap', label: 'Roadmap', icon: 'i-lucide-layout-grid' },
  { id: 'leads', label: `Interesses (${props.data.interests.length})`, icon: 'i-lucide-users' },
  { id: 'betas', label: `Betas (${props.data.betas.length})`, icon: 'i-lucide-flask-conical' }
]

const BETA_STATUS: Record<AdminBeta['status'], { label: string, color: 'warning' | 'success' | 'error' }> = {
  requested: { label: 'Solicitado', color: 'warning' },
  approved: { label: 'Aprovado', color: 'success' },
  rejected: { label: 'Rejeitado', color: 'error' }
}
const betaStatusItems = [
  { label: 'Solicitado', value: 'requested' },
  { label: 'Aprovado', value: 'approved' },
  { label: 'Rejeitado', value: 'rejected' }
]

function columnItems(h: string) {
  return props.data.items.filter(i => i.horizon === h)
}

async function refresh() {
  await refreshNuxtData('admin')
}

async function togglePublish(item: RoadmapItem) {
  const { error } = await (supabase as any).from('roadmap_items').update({ published: !item.published }).eq('id', item.id)
  if (error) return toast.add({ title: 'Erro', description: error.message, color: 'error', icon: 'i-lucide-triangle-alert' })
  toast.add({ title: item.published ? 'Despublicado.' : 'Publicado.', color: 'success', icon: 'i-lucide-circle-check' })
  await refresh()
}

async function removeItem(item: RoadmapItem) {
  if (!window.confirm(`Excluir "${item.title}"? Isso remove também os interesses e betas vinculados.`)) return
  const { error } = await (supabase as any).from('roadmap_items').delete().eq('id', item.id)
  if (error) return toast.add({ title: 'Erro', description: error.message, color: 'error', icon: 'i-lucide-triangle-alert' })
  toast.add({ title: 'Item excluído.', color: 'success', icon: 'i-lucide-circle-check' })
  await refresh()
}

async function changeBeta(beta: AdminBeta, status: AdminBeta['status']) {
  const { error } = await (supabase as any).from('roadmap_beta_requests').update({ status }).eq('id', beta.id)
  if (error) return toast.add({ title: 'Erro', description: error.message, color: 'error', icon: 'i-lucide-triangle-alert' })
  toast.add({ title: 'Status atualizado.', color: 'success', icon: 'i-lucide-circle-check' })
  await refresh()
}

function openCreate() {
  editing.value = null
  editorOpen.value = true
}
function openEdit(item: RoadmapItem) {
  editing.value = item
  editorOpen.value = true
}
async function onSaved() {
  editorOpen.value = false
  await refresh()
}
</script>

<template>
  <PortalTopbar title="Painel Administrativo">
    <template #right>
      <span class="hidden text-xs text-muted sm:block">{{ userEmail }}</span>
    </template>
  </PortalTopbar>

  <div class="flex-1 overflow-y-auto px-7 pb-12 pt-7">
    <div class="mx-auto max-w-[1240px] space-y-6">
      <!-- KPIs -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <UCard :ui="{ body: 'p-4' }">
          <UIcon name="i-lucide-layout-grid" class="h-5 w-5 text-muted" />
          <p class="mt-3 text-2xl font-bold">{{ data.items.length }}</p>
          <p class="text-xs text-muted">Itens no roadmap</p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <UIcon name="i-lucide-eye" class="h-5 w-5 text-muted" />
          <p class="mt-3 text-2xl font-bold">{{ publishedCount }}</p>
          <p class="text-xs text-muted">Publicados</p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <UIcon name="i-lucide-users" class="h-5 w-5 text-primary" />
          <p class="mt-3 text-2xl font-bold">{{ totalInterest }}</p>
          <p class="text-xs text-muted">Interesses (leads)</p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <UIcon name="i-lucide-flask-conical" class="h-5 w-5 text-primary" />
          <p class="mt-3 text-2xl font-bold">{{ pendingBetas }}</p>
          <p class="text-xs text-muted">Betas pendentes</p>
        </UCard>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 rounded-xl border border-default bg-default p-1">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
          :class="tab === t.id ? 'bg-primary text-inverted' : 'text-muted hover:text-default'"
          @click="tab = t.id"
        >
          <UIcon :name="t.icon" class="h-4 w-4" />
          {{ t.label }}
        </button>
      </div>

      <!-- ROADMAP -->
      <div v-if="tab === 'roadmap'" class="space-y-4">
        <div class="flex justify-end">
          <UButton icon="i-lucide-plus" @click="openCreate">Novo item</UButton>
        </div>

        <div v-for="h in HORIZONS" :key="h.id" class="overflow-hidden rounded-2xl border border-default bg-default">
          <div class="border-b border-default px-4 py-3">
            <h3 class="text-sm font-semibold">
              {{ h.title }} <span class="text-xs font-normal text-dimmed">· {{ columnItems(h.id).length }}</span>
            </h3>
          </div>
          <ul class="divide-y divide-default">
            <li v-for="item in columnItems(h.id)" :key="item.id" class="flex items-center gap-3 px-4 py-3">
              <span class="rounded-md px-2 py-0.5 text-[11px] font-semibold" :class="TAG_META[item.tag].className">
                {{ TAG_META[item.tag].label }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ item.title }}</p>
                <p class="truncate text-xs text-dimmed">{{ item.summary }}</p>
              </div>
              <span class="hidden items-center gap-1 text-xs text-muted sm:flex">
                <UIcon name="i-lucide-users" class="h-3.5 w-3.5" /> {{ data.states[item.id]?.interestCount ?? 0 }}
              </span>
              <UBadge v-if="!item.published" color="neutral" variant="subtle" size="sm">rascunho</UBadge>
              <UButton
                :icon="item.published ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                color="neutral"
                variant="ghost"
                size="sm"
                :title="item.published ? 'Despublicar' : 'Publicar'"
                @click="togglePublish(item)"
              />
              <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" title="Editar" @click="openEdit(item)" />
              <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="sm" title="Excluir" @click="removeItem(item)" />
            </li>
            <li v-if="columnItems(h.id).length === 0" class="px-4 py-6 text-center text-xs text-dimmed">Sem itens.</li>
          </ul>
        </div>
      </div>

      <!-- LEADS -->
      <div v-else-if="tab === 'leads'" class="overflow-hidden rounded-2xl border border-default bg-default">
        <p v-if="data.interests.length === 0" class="px-4 py-8 text-center text-sm text-dimmed">
          Nenhum interesse registrado ainda.
        </p>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b border-default text-left text-xs font-semibold uppercase tracking-wider text-dimmed">
              <th class="px-4 py-3">Recurso</th>
              <th class="px-4 py-3">Empresa</th>
              <th class="px-4 py-3">E-mail</th>
              <th class="px-4 py-3">Quando</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="(i, idx) in data.interests" :key="idx">
              <td class="px-4 py-3 font-medium">{{ i.itemTitle }}</td>
              <td class="px-4 py-3 text-muted">{{ i.company || '—' }}</td>
              <td class="px-4 py-3 text-muted">{{ i.email }}</td>
              <td class="px-4 py-3 text-muted">{{ fmtDate(i.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- BETAS -->
      <div v-else class="overflow-hidden rounded-2xl border border-default bg-default">
        <p v-if="data.betas.length === 0" class="px-4 py-8 text-center text-sm text-dimmed">
          Nenhum pedido de beta ainda.
        </p>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b border-default text-left text-xs font-semibold uppercase tracking-wider text-dimmed">
              <th class="px-4 py-3">Recurso</th>
              <th class="px-4 py-3">Parceiro</th>
              <th class="px-4 py-3">Quando</th>
              <th class="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="b in data.betas" :key="b.id">
              <td class="px-4 py-3 font-medium">{{ b.itemTitle }}</td>
              <td class="px-4 py-3 text-muted">
                <div>{{ b.email }}</div>
                <div v-if="b.company" class="text-xs text-dimmed">{{ b.company }}</div>
              </td>
              <td class="px-4 py-3 text-muted">{{ fmtDate(b.createdAt) }}</td>
              <td class="px-4 py-3">
                <USelect
                  :model-value="b.status"
                  :items="betaStatusItems"
                  size="sm"
                  class="w-36"
                  @update:model-value="changeBeta(b, $event as AdminBeta['status'])"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <AdminItemEditor v-model:open="editorOpen" :item="editing" @saved="onSaved" />
</template>
