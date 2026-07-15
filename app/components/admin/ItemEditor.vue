<script setup lang="ts">
import { slugify } from '~/lib/admin'
import type { FileLink, Horizon, RoadmapItem } from '~/lib/roadmap'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ item: RoadmapItem | null }>()
const emit = defineEmits<{ saved: [] }>()

const supabase = useSupabaseClient()
const toast = useToast()

const horizonItems = [
  { label: 'Em desenvolvimento agora', value: 'now' },
  { label: 'No radar', value: 'radar' }
]
const visibilityItems = [
  { label: 'Visível', value: true },
  { label: 'Não visível', value: false }
]

const form = reactive({
  title: '',
  horizon: 'now' as Horizon,
  summary: '',
  published: true,
  headline: '',
  businessValue: '',
  commercialFiles: [] as FileLink[],
  impactSummary: '',
  technicalFiles: [] as FileLink[]
})

// Pasta-base para os uploads deste item (estável enquanto o editor está aberto).
const uploadPrefix = ref('')

function resetForm() {
  const it = props.item
  form.title = it?.title ?? ''
  form.horizon = it?.horizon ?? 'now'
  form.summary = it?.summary ?? ''
  form.published = it?.published ?? true
  form.headline = it?.commercial.headline ?? ''
  form.businessValue = it?.commercial.businessValue ?? ''
  form.commercialFiles = [...(it?.commercial.files ?? [])]
  form.impactSummary = it?.technical.impactSummary ?? ''
  form.technicalFiles = [...(it?.technical.files ?? [])]
  uploadPrefix.value = it?.id || crypto.randomUUID()
  error.value = null
}

watch(open, (v) => {
  if (v) resetForm()
}, { immediate: true })

const saving = ref(false)
const error = ref<string | null>(null)

async function save() {
  error.value = null
  if (!supabase) {
    error.value = 'Backend do roadmap não configurado.'
    return
  }
  if (!form.title.trim()) {
    error.value = 'Informe um título.'
    return
  }
  const id = props.item?.id || slugify(form.title)
  if (!id) {
    error.value = 'Título inválido para gerar o identificador.'
    return
  }
  saving.value = true
  const row = {
    id,
    title: form.title.trim(),
    horizon: form.horizon,
    summary: form.summary.trim(),
    published: form.published,
    commercial: {
      headline: form.headline,
      businessValue: form.businessValue,
      files: form.commercialFiles
    },
    technical: {
      impactSummary: form.impactSummary,
      files: form.technicalFiles
    }
  }
  const { error: err } = await supabase.from('roadmap_items').upsert(row, { onConflict: 'id' })
  saving.value = false
  if (err) {
    error.value = err.message
    return
  }
  toast.add({
    title: props.item ? 'Item atualizado!' : 'Item criado!',
    color: 'success',
    icon: 'i-lucide-circle-check'
  })
  emit('saved')
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="item ? 'Editar item' : 'Novo item do roadmap'"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div class="space-y-5">
        <UFormField label="Título">
          <UInput
            v-model="form.title"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Horizonte">
            <USelect
              v-model="form.horizon"
              :items="horizonItems"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Visibilidade">
            <USelect
              v-model="form.published"
              :items="visibilityItems"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Resumo (linha do card)">
          <UTextarea
            v-model="form.summary"
            :rows="2"
            class="w-full"
          />
        </UFormField>

        <div class="flex items-center gap-3 pt-2">
          <span class="text-xs font-bold uppercase tracking-wider text-primary">Aba Comercial</span>
          <span class="h-px flex-1 bg-default" />
        </div>
        <UFormField label="Headline (valor de negócio)">
          <UInput
            v-model="form.headline"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Valor de negócio (parágrafo)">
          <UTextarea
            v-model="form.businessValue"
            :rows="4"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Kit de vendas — arquivos vinculados">
          <AdminFileLinkEditor
            v-model="form.commercialFiles"
            :prefix="`${uploadPrefix}/commercial`"
          />
        </UFormField>

        <div class="flex items-center gap-3 pt-2">
          <span class="text-xs font-bold uppercase tracking-wider text-primary">Aba Técnica</span>
          <span class="h-px flex-1 bg-default" />
        </div>
        <UFormField label="Impacto técnico (parágrafo)">
          <UTextarea
            v-model="form.impactSummary"
            :rows="3"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Documentação técnica — arquivos vinculados">
          <AdminFileLinkEditor
            v-model="form.technicalFiles"
            :prefix="`${uploadPrefix}/technical`"
          />
        </UFormField>

        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
          icon="i-lucide-triangle-alert"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          @click="open = false"
        >
          Cancelar
        </UButton>
        <UButton
          icon="i-lucide-save"
          :loading="saving"
          @click="save"
        >
          Salvar
        </UButton>
      </div>
    </template>
  </USlideover>
</template>
