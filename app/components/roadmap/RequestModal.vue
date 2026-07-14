<script setup lang="ts">
const open = defineModel<boolean>('open', { required: true })

const { sending, submitRequest } = useRoadmapRequest()

const form = reactive({ title: '', description: '' })
const error = ref<string | null>(null)

function resetForm() {
  form.title = ''
  form.description = ''
  error.value = null
}

watch(open, (v) => {
  if (v) resetForm()
})

async function submit() {
  error.value = null
  if (!form.title.trim() || !form.description.trim()) {
    error.value = 'Preencha o título e a descrição da demanda.'
    return
  }
  const ok = await submitRequest(form.title, form.description)
  if (ok) open.value = false
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Solicitar uma demanda"
    description="Conte o que faria diferença pra você. Sua sugestão vai direto para o nosso time de produto."
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="space-y-5">
        <UFormField
          label="Título da demanda"
          required
        >
          <UInput
            v-model="form.title"
            placeholder="Ex: Relatório de chamadas por período"
            maxlength="120"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Descreva sua necessidade"
          required
        >
          <UTextarea
            v-model="form.description"
            :rows="6"
            autoresize
            placeholder="O que você precisa, qual problema isso resolve e como você imagina que funcionaria…"
            class="w-full"
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
          icon="i-lucide-send"
          :loading="sending"
          :disabled="!form.title.trim() || !form.description.trim()"
          @click="submit"
        >
          Enviar demanda
        </UButton>
      </div>
    </template>
  </USlideover>
</template>
