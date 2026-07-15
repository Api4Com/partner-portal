<script setup lang="ts">
import type { CredencialEmitida, Escopo } from '~/lib/credenciais'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [c: CredencialEmitida] }>()

const { issue, mensagemDoErro } = useCredenciais()
const toast = useToast()

const name = ref('')
// Por enquanto só "Criar subcontas" (CREATE_CHILD_ACCOUNT) está em uso; o seletor de
// permissões está oculto e o escopo fica chumbado. Para reabrir a escolha, restaurar o
// bloco "Permissões" no template (ver ESCOPOS/toggleScope no histórico) e voltar `scopes`
// a um ref editável.
const scopes = ref<Escopo[]>(['CREATE_CHILD_ACCOUNT'])
const submitting = ref(false)
const erro = ref<string | null>(null)

// O segredo emitido. Enquanto ele existir, o modal muda de cara: some o formulário e
// não há como fechar sem confirmar que foi guardado.
const emitida = ref<CredencialEmitida | null>(null)

const nameOk = computed(() => name.value.trim().length > 0)

watch(open, (v) => {
  if (!v) return
  name.value = ''
  scopes.value = ['CREATE_CHILD_ACCOUNT']
  erro.value = null
  emitida.value = null
  copiado.value = false
})

async function submit() {
  if (!nameOk.value || submitting.value) return
  submitting.value = true
  erro.value = null
  try {
    const c = await issue(name.value.trim(), scopes.value)
    emitida.value = c
    emit('created', c)
  } catch (err) {
    erro.value = mensagemDoErro(err, 'Não foi possível emitir a credencial.')
  } finally {
    submitting.value = false
  }
}

const copiado = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

async function copiarSegredo() {
  if (!emitida.value) return
  try {
    await navigator.clipboard.writeText(emitida.value.secret)
  } catch {
    // `navigator.clipboard` não existe fora de contexto seguro (http). O segredo está
    // na tela e pode ser copiado à mão — avisar é melhor do que fingir que copiou.
    toast.add({
      title: 'Não foi possível copiar',
      description: 'Selecione o texto e copie manualmente.',
      icon: 'i-lucide-triangle-alert',
      color: 'warning'
    })
    return
  }
  copiado.value = true
  clearTimeout(copyTimer)
  copyTimer = setTimeout(() => (copiado.value = false), 1600)
}

onBeforeUnmount(() => clearTimeout(copyTimer))
</script>

<template>
  <UModal
    v-model:open="open"
    :dismissible="!emitida"
    :close="!emitida"
    :ui="{ content: 'sm:max-w-[560px]' }"
  >
    <template #content>
      <div class="flex max-h-[90vh] flex-col">
        <!-- Header -->
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-default px-6 pb-4 pt-5">
          <div class="flex items-center gap-3">
            <div
              class="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl"
              :class="emitida ? 'bg-success/10 text-success' : 'bg-brand-50 text-brand-700'"
            >
              <UIcon
                :name="emitida ? 'i-lucide-shield-check' : 'i-lucide-key-round'"
                class="h-5 w-5"
              />
            </div>
            <div>
              <h2 class="text-lg font-bold tracking-tight">
                {{ emitida ? 'Credencial criada' : 'Nova credencial' }}
              </h2>
              <p class="mt-0.5 text-xs text-dimmed">
                {{ emitida
                  ? 'Copie o segredo agora — ele não aparece de novo.'
                  : 'Uma chave de API para a sua integração falar com a API4COM.' }}
              </p>
            </div>
          </div>
          <UButton
            v-if="!emitida"
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            aria-label="Fechar"
            @click="open = false"
          />
        </div>

        <!-- Body: o segredo, uma única vez -->
        <div
          v-if="emitida"
          class="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-[22px]"
        >
          <div class="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
            <UIcon
              name="i-lucide-triangle-alert"
              class="mt-0.5 h-4 w-4 shrink-0 text-warning"
            />
            <p class="text-[13px] leading-relaxed">
              <span class="font-semibold">Este segredo aparece uma única vez.</span>
              Nenhuma outra tela e nenhum outro endpoint o devolve. Se você perdê-lo,
              o caminho é emitir outra credencial e revogar esta.
            </p>
          </div>

          <UFormField label="Segredo">
            <div class="flex items-stretch gap-2">
              <code class="min-w-0 flex-1 break-all rounded-lg border border-default bg-muted px-3 py-2.5 font-mono text-[12px] leading-relaxed">{{ emitida.secret }}</code>
              <UButton
                :icon="copiado ? 'i-lucide-check' : 'i-lucide-copy'"
                :color="copiado ? 'success' : 'neutral'"
                variant="outline"
                :aria-label="copiado ? 'Copiado' : 'Copiar segredo'"
                @click="copiarSegredo"
              />
            </div>
          </UFormField>

          <dl class="grid grid-cols-2 gap-3 text-[13px]">
            <div>
              <dt class="text-xs text-dimmed">
                Nome
              </dt>
              <dd class="mt-0.5 font-medium">
                {{ emitida.name }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-dimmed">
                Identificador público
              </dt>
              <dd class="mt-0.5 font-mono text-[12px]">
                {{ emitida.keyId }}
              </dd>
            </div>
          </dl>

          <p class="text-xs leading-relaxed text-muted">
            Use a chave inteira no header
            <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">Authorization: Bearer …</code>.
            Em toda criação de subconta, mande também
            <code class="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">Idempotency-Key</code>
            — e repita o mesmo valor no retry: é o que faz a tentativa repetida devolver
            a conta já criada em vez de abrir outra.
          </p>
        </div>

        <!-- Body: formulário -->
        <div
          v-else
          class="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-[22px]"
        >
          <UFormField
            label="Nome"
            description="Para você reconhecer a chave depois. Ex.: “integração ERP”."
          >
            <UInput
              v-model="name"
              placeholder="Integração ERP"
              size="lg"
              class="w-full"
              maxlength="60"
              autofocus
              @keyup.enter="submit"
            />
          </UFormField>

          <p
            v-if="erro"
            class="flex items-start gap-2 text-[13px] text-error"
          >
            <UIcon
              name="i-lucide-triangle-alert"
              class="mt-0.5 h-4 w-4 shrink-0"
            />
            {{ erro }}
          </p>
        </div>

        <!-- Footer -->
        <div class="flex shrink-0 items-center justify-end gap-2.5 border-t border-default bg-muted px-6 py-4">
          <template v-if="emitida">
            <UButton @click="open = false">
              Já guardei o segredo
            </UButton>
          </template>
          <template v-else>
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="submitting"
              @click="open = false"
            >
              Cancelar
            </UButton>
            <UButton
              :disabled="!nameOk"
              :loading="submitting"
              @click="submit"
            >
              Emitir credencial
            </UButton>
          </template>
        </div>
      </div>
    </template>
  </UModal>
</template>
