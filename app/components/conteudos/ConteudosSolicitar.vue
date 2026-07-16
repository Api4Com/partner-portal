<script setup lang="ts">
import type { ConteudoTipo } from '~/lib/conteudos'
import { TIPO_META } from '~/lib/conteudos'

const open = defineModel<boolean>('open', { required: true })

const toast = useToast()

const tipoOptions = (Object.keys(TIPO_META) as ConteudoTipo[]).map(value => ({
  value,
  label: TIPO_META[value].label
}))

const form = reactive({ tema: '', pergunta: '', tipo: 'estudo' as ConteudoTipo })
const error = ref<string | null>(null)
const sending = ref(false)

function resetForm() {
  form.tema = ''
  form.pergunta = ''
  form.tipo = 'estudo'
  error.value = null
}

watch(open, (v) => {
  if (v) resetForm()
})

async function submit() {
  error.value = null
  if (!form.tema.trim() || !form.pergunta.trim()) {
    error.value = 'Conte o tema e a pergunta/hipótese que você quer investigar.'
    return
  }
  sending.value = true
  // TODO(bff): persistir a solicitação (ex.: POST /contents/requests).
  // Por enquanto apenas simulamos o envio pra validar o fluxo.
  await new Promise(resolve => setTimeout(resolve, 700))
  sending.value = false
  open.value = false
  toast.add({
    title: 'Solicitação enviada!',
    description: 'Obrigado! Sua sugestão vai ajudar a pautar os próximos estudos da API4COM.',
    icon: 'i-lucide-check-circle',
    color: 'success'
  })
}
</script>

<template>
  <USlideover
    v-model:open="open"
    title="Solicitar um estudo"
    description="Tem uma pergunta ou hipótese sobre vendas, telefonia ou performance? Diga o que você gostaria de ver — nosso time avalia cada sugestão pra pautar os próximos conteúdos."
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="space-y-5">
        <UFormField
          label="Tipo de conteúdo"
        >
          <USelectMenu
            v-model="form.tipo"
            :items="tipoOptions"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Sobre o que você quer um estudo?"
          required
        >
          <UInput
            v-model="form.tema"
            placeholder="Ex: melhor horário para ligar por segmento"
            maxlength="120"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Qual a sua pergunta ou hipótese?"
          required
        >
          <UTextarea
            v-model="form.pergunta"
            :rows="6"
            autoresize
            placeholder="O que você suspeita, o que gostaria de comprovar e por que isso importa pra sua operação…"
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
          :disabled="!form.tema.trim() || !form.pergunta.trim()"
          @click="submit"
        >
          Enviar solicitação
        </UButton>
      </div>
    </template>
  </USlideover>
</template>
