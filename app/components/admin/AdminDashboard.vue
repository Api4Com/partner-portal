<script setup lang="ts">
import { HORIZONS, type RoadmapItem } from '~/lib/roadmap'
import { fmtDate, type AdminData, type AdminRequest } from '~/lib/admin'

const props = defineProps<{ data: AdminData, userEmail: string }>()

const { bffFetch } = useAuth()
const toast = useToast()

/** Mensagem de erro do BFF (ou uma genérica) para o toast. */
function errMessage(err: unknown): string {
  const e = err as { data?: { message?: string }, message?: string }
  return e?.data?.message ?? e?.message ?? 'Tente novamente em instantes.'
}

type Tab = 'roadmap' | 'feedback' | 'requests'
const tab = ref<Tab>('roadmap')

// Demandas enviadas pelos parceiros.
const pendingRequests = computed(() => props.data.requests.filter(r => !r.archived))

const editorOpen = ref(false)
const editing = ref<RoadmapItem | null>(null)

// Drawer de engajamento por item.
const feedbackOpen = ref(false)
const feedbackItem = ref<RoadmapItem | null>(null)

const totalLikes = computed(() => props.data.reactions.filter(r => r.reaction === 'like').length)
const totalDislikes = computed(() => props.data.reactions.filter(r => r.reaction === 'dislike').length)
const publishedCount = computed(() => props.data.items.filter(i => i.published).length)

const tabs = computed<{ id: Tab, label: string, icon: string }[]>(() => [
  { id: 'roadmap', label: 'Roadmap', icon: 'i-lucide-layout-grid' },
  { id: 'feedback', label: `Feedback (${props.data.reactions.length + props.data.comments.length})`, icon: 'i-lucide-message-square-text' },
  { id: 'requests', label: `Solicitação (${pendingRequests.value.length})`, icon: 'i-lucide-lightbulb' }
])

// Feed global cronológico: reações + comentários de todos os itens.
type FeedEntry
  = | { kind: 'comment', id: string, itemTitle: string, email: string, company: string, body: string, createdAt: string }
    | { kind: 'reaction', id: string, itemTitle: string, email: string, company: string, reaction: 'like' | 'dislike', createdAt: string }

const feed = computed<FeedEntry[]>(() => {
  const comments: FeedEntry[] = props.data.comments.map(c => ({
    kind: 'comment', id: c.id, itemTitle: c.itemTitle, email: c.email, company: c.company, body: c.body, createdAt: c.createdAt
  }))
  const reactions: FeedEntry[] = props.data.reactions.map((r, idx) => ({
    kind: 'reaction', id: `r-${idx}`, itemTitle: r.itemTitle, email: r.email, company: r.company, reaction: r.reaction, createdAt: r.createdAt
  }))
  return [...comments, ...reactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})

function columnItems(h: string) {
  return props.data.items.filter(i => i.horizon === h)
}

function commentCountOf(itemId: string) {
  return props.data.comments.filter(c => c.itemId === itemId).length
}
function reactionsOf(itemId: string) {
  return props.data.reactions.filter(r => r.itemId === itemId)
}
function commentsOf(itemId: string) {
  return props.data.comments.filter(c => c.itemId === itemId)
}

function openFeedback(item: RoadmapItem) {
  feedbackItem.value = item
  feedbackOpen.value = true
}

async function refresh() {
  await refreshNuxtData('admin')
}

async function togglePublish(item: RoadmapItem) {
  try {
    await bffFetch(`/roadmap/items/${item.id}`, {
      method: 'PATCH',
      body: { published: !item.published },
      skipDemo: true
    })
  } catch (err) {
    return toast.add({ title: 'Erro', description: errMessage(err), color: 'error', icon: 'i-lucide-triangle-alert' })
  }
  toast.add({ title: item.published ? 'Ocultado.' : 'Visível agora.', color: 'success', icon: 'i-lucide-circle-check' })
  await refresh()
}

async function removeItem(item: RoadmapItem) {
  if (!window.confirm(`Excluir "${item.title}"? Isso remove também as reações vinculadas.`)) return
  try {
    await bffFetch(`/roadmap/items/${item.id}`, { method: 'DELETE', skipDemo: true })
  } catch (err) {
    return toast.add({ title: 'Erro', description: errMessage(err), color: 'error', icon: 'i-lucide-triangle-alert' })
  }
  toast.add({ title: 'Item excluído.', color: 'success', icon: 'i-lucide-circle-check' })
  await refresh()
}

async function toggleArchive(req: AdminRequest) {
  try {
    await bffFetch(`/roadmap/requests/${req.id}`, {
      method: 'PATCH',
      body: { archived: !req.archived },
      skipDemo: true
    })
  } catch (err) {
    return toast.add({ title: 'Erro', description: errMessage(err), color: 'error', icon: 'i-lucide-triangle-alert' })
  }
  toast.add({ title: req.archived ? 'Demanda reativada.' : 'Demanda arquivada.', color: 'success', icon: 'i-lucide-circle-check' })
  await refresh()
}

async function removeRequest(req: AdminRequest) {
  if (!window.confirm(`Excluir a demanda "${req.title}"? Esta ação não pode ser desfeita.`)) return
  try {
    await bffFetch(`/roadmap/requests/${req.id}`, { method: 'DELETE', skipDemo: true })
  } catch (err) {
    return toast.add({ title: 'Erro', description: errMessage(err), color: 'error', icon: 'i-lucide-triangle-alert' })
  }
  toast.add({ title: 'Demanda excluída.', color: 'success', icon: 'i-lucide-circle-check' })
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
          <UIcon
            name="i-lucide-layout-grid"
            class="h-5 w-5 text-muted"
          />
          <p class="mt-3 text-2xl font-bold">
            {{ data.items.length }}
          </p>
          <p class="text-xs text-muted">
            Itens no roadmap
          </p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <UIcon
            name="i-lucide-eye"
            class="h-5 w-5 text-muted"
          />
          <p class="mt-3 text-2xl font-bold">
            {{ publishedCount }}
          </p>
          <p class="text-xs text-muted">
            Visíveis
          </p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <UIcon
            name="i-lucide-thumbs-up"
            class="h-5 w-5 text-emerald-600"
          />
          <p class="mt-3 text-2xl font-bold">
            {{ totalLikes }}
          </p>
          <p class="text-xs text-muted">
            Gostaram
          </p>
        </UCard>
        <UCard :ui="{ body: 'p-4' }">
          <UIcon
            name="i-lucide-thumbs-down"
            class="h-5 w-5 text-rose-600"
          />
          <p class="mt-3 text-2xl font-bold">
            {{ totalDislikes }}
          </p>
          <p class="text-xs text-muted">
            Não gostaram
          </p>
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
          <UIcon
            :name="t.icon"
            class="h-4 w-4"
          />
          {{ t.label }}
        </button>
      </div>

      <!-- ROADMAP -->
      <div
        v-if="tab === 'roadmap'"
        class="space-y-4"
      >
        <div class="flex justify-end">
          <UButton
            icon="i-lucide-plus"
            @click="openCreate"
          >
            Novo item
          </UButton>
        </div>

        <div
          v-for="h in HORIZONS"
          :key="h.id"
          class="overflow-hidden rounded-2xl border border-default bg-default"
        >
          <div class="border-b border-default px-4 py-3">
            <h3 class="text-sm font-semibold">
              {{ h.title }} <span class="text-xs font-normal text-dimmed">· {{ columnItems(h.id).length }}</span>
            </h3>
          </div>
          <ul class="divide-y divide-default">
            <li
              v-for="item in columnItems(h.id)"
              :key="item.id"
              class="flex items-center gap-3 px-4 py-3"
            >
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                title="Ver engajamento"
                @click="openFeedback(item)"
              >
                <p class="truncate text-sm font-medium hover:text-primary">
                  {{ item.title }}
                </p>
                <p class="truncate text-xs text-dimmed">
                  {{ item.summary }}
                </p>
              </button>
              <button
                type="button"
                class="hidden items-center gap-3 text-xs text-muted transition-colors hover:text-default sm:flex"
                title="Ver engajamento"
                @click="openFeedback(item)"
              >
                <span class="inline-flex items-center gap-1 text-emerald-600">
                  <UIcon
                    name="i-lucide-thumbs-up"
                    class="h-3.5 w-3.5"
                  /> {{ data.states[item.id]?.likeCount ?? 0 }}
                </span>
                <span class="inline-flex items-center gap-1 text-rose-600">
                  <UIcon
                    name="i-lucide-thumbs-down"
                    class="h-3.5 w-3.5"
                  /> {{ data.states[item.id]?.dislikeCount ?? 0 }}
                </span>
                <span
                  class="inline-flex items-center gap-1"
                  :class="commentCountOf(item.id) ? 'text-primary' : ''"
                >
                  <UIcon
                    name="i-lucide-message-square"
                    class="h-3.5 w-3.5"
                  /> {{ commentCountOf(item.id) }}
                </span>
              </button>
              <UBadge
                v-if="!item.published"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                não visível
              </UBadge>
              <UButton
                icon="i-lucide-message-square-text"
                color="neutral"
                variant="ghost"
                size="sm"
                title="Ver engajamento"
                @click="openFeedback(item)"
              />
              <UButton
                :icon="item.published ? 'i-lucide-eye' : 'i-lucide-eye-off'"
                color="neutral"
                variant="ghost"
                size="sm"
                :title="item.published ? 'Ocultar' : 'Tornar visível'"
                @click="togglePublish(item)"
              />
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                title="Editar"
                @click="openEdit(item)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                title="Excluir"
                @click="removeItem(item)"
              />
            </li>
            <li
              v-if="columnItems(h.id).length === 0"
              class="px-4 py-6 text-center text-xs text-dimmed"
            >
              Sem itens.
            </li>
          </ul>
        </div>
      </div>

      <!-- FEEDBACK (feed global: reações + comentários) -->
      <div
        v-else-if="tab === 'feedback'"
        class="overflow-hidden rounded-2xl border border-default bg-default"
      >
        <p
          v-if="feed.length === 0"
          class="px-4 py-8 text-center text-sm text-dimmed"
        >
          Nenhuma reação ou comentário ainda.
        </p>
        <ul
          v-else
          class="divide-y divide-default"
        >
          <li
            v-for="entry in feed"
            :key="entry.kind + entry.id"
            class="flex items-start gap-3 px-4 py-3"
          >
            <span
              class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg"
              :class="entry.kind === 'comment'
                ? 'bg-brand-50 text-brand-600'
                : entry.reaction === 'like' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'"
            >
              <UIcon
                :name="entry.kind === 'comment'
                  ? 'i-lucide-message-square'
                  : entry.reaction === 'like' ? 'i-lucide-thumbs-up' : 'i-lucide-thumbs-down'"
                class="h-4 w-4"
              />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm">
                <span class="font-medium">{{ entry.email }}</span>
                <span
                  v-if="entry.company"
                  class="text-dimmed"
                > · {{ entry.company }}</span>
                <span class="text-muted">
                  {{ entry.kind === 'comment' ? ' comentou em ' : entry.reaction === 'like' ? ' curtiu ' : ' não curtiu ' }}
                </span>
                <span class="font-medium">{{ entry.itemTitle }}</span>
              </p>
              <p
                v-if="entry.kind === 'comment'"
                class="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted"
              >
                {{ entry.body }}
              </p>
            </div>
            <span class="shrink-0 text-xs text-dimmed">{{ fmtDate(entry.createdAt) }}</span>
          </li>
        </ul>
      </div>

      <!-- DEMANDAS (solicitações enviadas pelos parceiros) -->
      <div
        v-else
        class="space-y-3"
      >
        <p
          v-if="data.requests.length === 0"
          class="rounded-2xl border border-default bg-default px-4 py-8 text-center text-sm text-dimmed"
        >
          Nenhuma demanda recebida ainda.
        </p>
        <div
          v-for="req in data.requests"
          :key="req.id"
          class="rounded-2xl border border-default bg-default p-4"
          :class="req.archived ? 'opacity-60' : ''"
        >
          <div class="flex items-start gap-3">
            <span class="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
              <UIcon
                name="i-lucide-lightbulb"
                class="h-4.5 w-4.5"
              />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-semibold">
                  {{ req.title }}
                </h3>
                <UBadge
                  v-if="req.archived"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                >
                  arquivada
                </UBadge>
              </div>
              <p class="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {{ req.description }}
              </p>
              <p class="mt-2 text-xs text-dimmed">
                <span class="font-medium text-muted">{{ req.email }}</span>
                <span v-if="req.company"> · {{ req.company }}</span>
                <span> · {{ fmtDate(req.createdAt) }}</span>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <UButton
                :icon="req.archived ? 'i-lucide-archive-restore' : 'i-lucide-archive'"
                color="neutral"
                variant="ghost"
                size="sm"
                :title="req.archived ? 'Reativar' : 'Arquivar'"
                @click="toggleArchive(req)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                title="Excluir"
                @click="removeRequest(req)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <AdminItemEditor
    v-model:open="editorOpen"
    :item="editing"
    @saved="onSaved"
  />
  <AdminFeedbackDrawer
    v-model:open="feedbackOpen"
    :item="feedbackItem"
    :reactions="feedbackItem ? reactionsOf(feedbackItem.id) : []"
    :comments="feedbackItem ? commentsOf(feedbackItem.id) : []"
    :like-count="feedbackItem ? (data.states[feedbackItem.id]?.likeCount ?? 0) : 0"
    :dislike-count="feedbackItem ? (data.states[feedbackItem.id]?.dislikeCount ?? 0) : 0"
    @changed="refresh"
  />
</template>
