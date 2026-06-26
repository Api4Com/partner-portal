<script setup lang="ts">
import type { FileLink } from '~/lib/roadmap'

const props = defineProps<{ prefix: string }>()
const model = defineModel<FileLink[]>({ required: true })

const BUCKET = 'roadmap-assets'
const supabase = useSupabaseClient()
const toast = useToast()

const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function pick() {
  fileInput.value?.click()
}

function safeName(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-')
}

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  if (!files.length) return
  uploading.value = true
  try {
    for (const file of files) {
      const path = `${props.prefix}/${crypto.randomUUID()}-${safeName(file.name)}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
      if (error) {
        toast.add({ title: 'Falha no upload', description: `${file.name}: ${error.message}`, color: 'error', icon: 'i-lucide-triangle-alert' })
        continue
      }
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      model.value = [...model.value, { label: file.name, url, path }]
    }
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function remove(idx: number) {
  const f = model.value[idx]
  model.value = model.value.filter((_, i) => i !== idx)
  if (f?.path) await supabase.storage.from(BUCKET).remove([f.path]).catch(() => {})
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="model.length" class="space-y-2">
      <div
        v-for="(f, idx) in model"
        :key="f.path"
        class="flex items-center gap-2 rounded-xl border border-default bg-default p-2"
      >
        <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
          <UIcon name="i-lucide-paperclip" class="h-4 w-4" />
        </span>
        <UInput v-model="f.label" placeholder="Texto exibido para este arquivo" class="flex-1" />
        <UButton
          :to="f.url"
          target="_blank"
          icon="i-lucide-external-link"
          color="neutral"
          variant="ghost"
          size="sm"
          title="Abrir arquivo"
        />
        <UButton icon="i-lucide-x" color="error" variant="ghost" size="sm" title="Remover" @click="remove(idx)" />
      </div>
    </div>
    <p v-else class="rounded-xl border border-dashed border-default px-3 py-4 text-center text-xs text-dimmed">
      Nenhum arquivo vinculado.
    </p>

    <input ref="fileInput" type="file" multiple class="hidden" @change="onFiles">
    <UButton
      icon="i-lucide-upload"
      color="neutral"
      variant="subtle"
      size="sm"
      :loading="uploading"
      @click="pick"
    >
      {{ uploading ? 'Enviando…' : 'Vincular arquivo' }}
    </UButton>
  </div>
</template>
