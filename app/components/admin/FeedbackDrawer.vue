<script setup lang="ts">
import type { AdminComment, AdminReaction } from '~/lib/admin'
import type { RoadmapItem } from '~/lib/roadmap'

const open = defineModel<boolean>('open', { required: true })
defineProps<{
  item: RoadmapItem | null
  reactions: AdminReaction[]
  comments: AdminComment[]
  likeCount: number
  dislikeCount: number
}>()
const emit = defineEmits<{ changed: [] }>()

const supabase = useSupabaseClient()
const toast = useToast()

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function removeComment(c: AdminComment) {
  if (!supabase) return
  if (!window.confirm('Excluir este comentário do parceiro?')) return
  const { error } = await supabase.from('roadmap_comments').delete().eq('id', c.id)
  if (error) return toast.add({ title: 'Erro', description: error.message, color: 'error', icon: 'i-lucide-triangle-alert' })
  toast.add({ title: 'Comentário excluído.', color: 'success', icon: 'i-lucide-circle-check' })
  emit('changed')
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="item?.title"
    :description="item?.summary"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #body>
      <div
        v-if="item"
        class="space-y-6"
      >
        <!-- Resumo de reações -->
        <section>
          <h4 class="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
            Reações
          </h4>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl border border-default bg-default p-4">
              <UIcon
                name="i-lucide-thumbs-up"
                class="h-5 w-5 text-emerald-600"
              />
              <p class="mt-2 text-2xl font-bold">
                {{ likeCount }}
              </p>
              <p class="text-xs text-muted">
                Gostaram
              </p>
            </div>
            <div class="rounded-xl border border-default bg-default p-4">
              <UIcon
                name="i-lucide-thumbs-down"
                class="h-5 w-5 text-rose-600"
              />
              <p class="mt-2 text-2xl font-bold">
                {{ dislikeCount }}
              </p>
              <p class="text-xs text-muted">
                Não gostaram
              </p>
            </div>
          </div>

          <ul
            v-if="reactions.length"
            class="mt-3 divide-y divide-default rounded-xl border border-default"
          >
            <li
              v-for="(r, idx) in reactions"
              :key="idx"
              class="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">
                  {{ r.email }}
                </p>
                <p
                  v-if="r.company"
                  class="truncate text-xs text-dimmed"
                >
                  {{ r.company }}
                </p>
              </div>
              <div class="flex items-center gap-2 text-xs text-dimmed">
                <span>{{ fmt(r.createdAt) }}</span>
                <UIcon
                  :name="r.reaction === 'like' ? 'i-lucide-thumbs-up' : 'i-lucide-thumbs-down'"
                  :class="r.reaction === 'like' ? 'text-emerald-600' : 'text-rose-600'"
                  class="h-4 w-4"
                />
              </div>
            </li>
          </ul>
        </section>

        <!-- Comentários -->
        <section>
          <h4 class="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
            Comentários ({{ comments.length }})
          </h4>
          <p
            v-if="comments.length === 0"
            class="rounded-xl border border-dashed border-default px-3 py-6 text-center text-xs text-dimmed"
          >
            Nenhum comentário neste item.
          </p>
          <div
            v-else
            class="space-y-2"
          >
            <div
              v-for="c in comments"
              :key="c.id"
              class="rounded-xl border border-default bg-default p-3"
            >
              <div class="mb-1.5 flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">
                    {{ c.email }}
                  </p>
                  <p
                    v-if="c.company"
                    class="truncate text-xs text-dimmed"
                  >
                    {{ c.company }}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <span class="text-xs text-dimmed">{{ fmt(c.createdAt) }}</span>
                  <UButton
                    icon="i-lucide-trash-2"
                    color="error"
                    variant="ghost"
                    size="xs"
                    title="Excluir"
                    @click="removeComment(c)"
                  />
                </div>
              </div>
              <p class="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {{ c.body }}
              </p>
            </div>
          </div>
        </section>
      </div>
    </template>
  </USlideover>
</template>
