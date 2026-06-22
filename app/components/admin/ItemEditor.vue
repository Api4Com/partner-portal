<script setup lang="ts">
import { slugify } from '~/lib/admin'
import type {
  ApiEndpoint,
  ComplexityTag,
  Horizon,
  HttpMethod,
  RoadmapItem,
  SalesAsset,
  SalesAssetType
} from '~/lib/roadmap'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ item: RoadmapItem | null }>()
const emit = defineEmits<{ saved: [] }>()

const supabase = useSupabaseClient()
const toast = useToast()

const horizonItems = [
  { label: 'Agora', value: 'now' },
  { label: 'Próximo', value: 'next' },
  { label: 'Futuro', value: 'future' }
]
const tagItems = [
  { label: 'Nova API', value: 'new-api' },
  { label: 'Melhoria', value: 'improvement' },
  { label: 'Breaking Change', value: 'breaking-change' }
]
const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

/* -------- (de)serializadores texto <-> estruturas -------- */
function salesKitToText(kit: SalesAsset[]) {
  return kit.map(a => `${a.label} | ${a.type}`).join('\n')
}
function textToSalesKit(text: string): SalesAsset[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map((l) => {
    const [label, type] = l.split('|').map(s => s.trim())
    const t = (['deck', 'script', 'pricing'] as SalesAssetType[]).includes(type as SalesAssetType)
      ? (type as SalesAssetType)
      : 'deck'
    return { label: label ?? l, type: t }
  })
}
function endpointsToText(eps: ApiEndpoint[]) {
  return eps.map(e => `${e.method} ${e.path}`).join('\n')
}
function textToEndpoints(text: string): ApiEndpoint[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map((l) => {
    const [method, ...rest] = l.split(/\s+/)
    const m = METHODS.includes(method?.toUpperCase() as HttpMethod) ? (method.toUpperCase() as HttpMethod) : 'GET'
    return { method: m, path: rest.join(' ') || '/' }
  })
}
function listToText(list?: string[]) {
  return (list ?? []).join('\n')
}
function textToList(text: string) {
  return text.split('\n').map(l => l.trim()).filter(Boolean)
}

const form = reactive({
  title: '',
  horizon: 'now' as Horizon,
  tag: 'new-api' as ComplexityTag,
  summary: '',
  published: true,
  sortOrder: 0,
  headline: '',
  businessValue: '',
  salesKit: '',
  impactSummary: '',
  endpoints: '',
  webhooks: '',
  samplePayload: ''
})

function resetForm() {
  const it = props.item
  form.title = it?.title ?? ''
  form.horizon = it?.horizon ?? 'now'
  form.tag = it?.tag ?? 'new-api'
  form.summary = it?.summary ?? ''
  form.published = it?.published ?? true
  form.sortOrder = it?.sortOrder ?? 0
  form.headline = it?.commercial.headline ?? ''
  form.businessValue = it?.commercial.businessValue ?? ''
  form.salesKit = salesKitToText(it?.commercial.salesKit ?? [])
  form.impactSummary = it?.technical.impactSummary ?? ''
  form.endpoints = endpointsToText(it?.technical.endpoints ?? [])
  form.webhooks = listToText(it?.technical.webhooks)
  form.samplePayload = it?.technical.samplePayload ?? ''
  error.value = null
}

watch(open, (v) => { if (v) resetForm() }, { immediate: true })

const saving = ref(false)
const error = ref<string | null>(null)

async function save() {
  error.value = null
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
    tag: form.tag,
    summary: form.summary.trim(),
    published: form.published,
    sort_order: Number(form.sortOrder) || 0,
    commercial: {
      headline: form.headline,
      businessValue: form.businessValue,
      salesKit: textToSalesKit(form.salesKit)
    },
    technical: {
      impactSummary: form.impactSummary,
      endpoints: textToEndpoints(form.endpoints),
      webhooks: textToList(form.webhooks),
      samplePayload: form.samplePayload.trim() || undefined
    }
  }
  const { error: err } = await (supabase as any).from('roadmap_items').upsert(row, { onConflict: 'id' })
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

const monoUi = { base: 'font-mono text-xs' }
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
          <UInput v-model="form.title" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Horizonte">
            <USelect v-model="form.horizon" :items="horizonItems" class="w-full" />
          </UFormField>
          <UFormField label="Tag de complexidade">
            <USelect v-model="form.tag" :items="tagItems" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Resumo (linha do card)">
          <UTextarea v-model="form.summary" :rows="2" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 items-end gap-4">
          <UFormField label="Ordem na coluna">
            <UInput v-model="form.sortOrder" type="number" class="w-full" />
          </UFormField>
          <UCheckbox v-model="form.published" label="Publicado (visível aos parceiros)" class="pb-2.5" />
        </div>

        <div class="flex items-center gap-3 pt-2">
          <span class="text-xs font-bold uppercase tracking-wider text-primary">Aba Comercial</span>
          <span class="h-px flex-1 bg-default" />
        </div>
        <UFormField label="Headline (valor de negócio)">
          <UInput v-model="form.headline" class="w-full" />
        </UFormField>
        <UFormField label="Valor de negócio (parágrafo)">
          <UTextarea v-model="form.businessValue" :rows="4" class="w-full" />
        </UFormField>
        <UFormField label="Kit de vendas — um por linha: rótulo | tipo (deck/script/pricing)">
          <UTextarea v-model="form.salesKit" :rows="3" :ui="monoUi" class="w-full" />
        </UFormField>

        <div class="flex items-center gap-3 pt-2">
          <span class="text-xs font-bold uppercase tracking-wider text-primary">Aba Técnica</span>
          <span class="h-px flex-1 bg-default" />
        </div>
        <UFormField label="Impacto técnico (parágrafo)">
          <UTextarea v-model="form.impactSummary" :rows="3" class="w-full" />
        </UFormField>
        <UFormField label="Endpoints — um por linha: MÉTODO /caminho">
          <UTextarea v-model="form.endpoints" :rows="3" :ui="monoUi" class="w-full" />
        </UFormField>
        <UFormField label="Webhooks — um por linha">
          <UTextarea v-model="form.webhooks" :rows="2" :ui="monoUi" class="w-full" />
        </UFormField>
        <UFormField label="Payload de exemplo (opcional)">
          <UTextarea v-model="form.samplePayload" :rows="5" :ui="monoUi" class="w-full" />
        </UFormField>

        <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-triangle-alert" />
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton icon="i-lucide-save" :loading="saving" @click="save">Salvar</UButton>
      </div>
    </template>
  </USlideover>
</template>
