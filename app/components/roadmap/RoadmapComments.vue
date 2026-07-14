<script setup lang="ts">
const props = defineProps<{ itemId: string }>()

const { myComments, pending, addComment, editComment, deleteComment } = useRoadmap()

const comments = computed(() => myComments.value[props.itemId] ?? [])

const draft = ref('')
const editingId = ref<string | null>(null)
const editDraft = ref('')

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function submit() {
  const body = draft.value
  if (!body.trim()) return
  await addComment(props.itemId, body)
  draft.value = ''
}

function startEdit(id: string, body: string) {
  editingId.value = id
  editDraft.value = body
}
function cancelEdit() {
  editingId.value = null
  editDraft.value = ''
}
async function saveEdit(id: string) {
  await editComment(props.itemId, id, editDraft.value)
  cancelEdit()
}
async function remove(id: string) {
  if (!window.confirm('Excluir este comentário?')) return
  await deleteComment(props.itemId, id)
}
</script>

<template>
  <section>
    <div class="mb-2.5 flex items-center gap-2">
      <UIcon
        name="i-lucide-message-square"
        class="h-4 w-4 text-primary"
      />
      <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
        Meus comentários
      </h4>
    </div>

    <div
      v-if="comments.length"
      class="mb-3 space-y-2"
    >
      <div
        v-for="c in comments"
        :key="c.id"
        class="rounded-xl border border-default bg-muted/40 p-3"
      >
        <template v-if="editingId === c.id">
          <UTextarea
            v-model="editDraft"
            :rows="3"
            autoresize
            class="w-full"
          />
          <div class="mt-2 flex justify-end gap-2">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              @click="cancelEdit"
            >
              Cancelar
            </UButton>
            <UButton
              size="xs"
              :loading="pending"
              icon="i-lucide-check"
              @click="saveEdit(c.id)"
            >
              Salvar
            </UButton>
          </div>
        </template>
        <template v-else>
          <p class="whitespace-pre-wrap text-sm leading-relaxed">
            {{ c.body }}
          </p>
          <div class="mt-2 flex items-center justify-between">
            <span class="text-[11px] text-dimmed">
              {{ fmt(c.createdAt) }}
              <span v-if="c.updatedAt !== c.createdAt"> · editado</span>
            </span>
            <div class="flex items-center gap-1">
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-pencil"
                title="Editar"
                @click="startEdit(c.id, c.body)"
              />
              <UButton
                size="xs"
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                title="Excluir"
                @click="remove(c.id)"
              />
            </div>
          </div>
        </template>
      </div>
    </div>

    <UTextarea
      v-model="draft"
      :rows="2"
      autoresize
      placeholder="Escreva um comentário…"
      class="w-full"
    />
    <div class="mt-2 flex justify-end">
      <UButton
        size="sm"
        icon="i-lucide-send"
        :loading="pending"
        :disabled="!draft.trim()"
        @click="submit"
      >
        Comentar
      </UButton>
    </div>
  </section>
</template>
