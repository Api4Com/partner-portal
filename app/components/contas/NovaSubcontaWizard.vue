<script setup lang="ts">
import { CONTA_PRINCIPAL, newSubcontaId, type Subconta } from '~/lib/contas'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [s: Subconta] }>()

const STEPS = ['Identidade', 'Cobrança', 'Consumo']

const step = ref(1)
const name = ref('')
const email = ref('')
const invite = ref(true)

const nameOk = computed(() => name.value.trim().length > 0)
const primaryLabel = computed(() => (step.value < 3 ? 'Próximo' : 'Criar Subconta'))

watch(open, (v) => {
  if (v) {
    step.value = 1
    name.value = ''
    email.value = ''
    invite.value = true
  }
})

function next() {
  if (step.value === 1 && !nameOk.value) return
  if (step.value < 3) {
    step.value += 1
  } else {
    // No modelo individual a subconta nasce sem cobrança definida ("A definir").
    emit('created', {
      name: name.value.trim(),
      id: newSubcontaId(),
      minutes: 0,
      users: 0,
      status: 'ativo',
      charge: 'pending'
    })
    open.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-[600px]' }">
    <template #content>
      <div class="flex max-h-[90vh] flex-col">
        <!-- Header -->
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-default px-6 pb-4 pt-5">
          <div class="flex items-center gap-3">
            <div class="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <UIcon name="i-lucide-user-plus" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-bold tracking-tight">Nova Subconta</h2>
              <p class="mt-0.5 text-xs text-dimmed">
                Subconta autônoma de {{ CONTA_PRINCIPAL.name }} · saldo próprio e independente.
              </p>
            </div>
          </div>
          <UButton color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Fechar" @click="open = false" />
        </div>

        <!-- Stepper -->
        <div class="flex shrink-0 items-center border-b border-default px-6 py-3.5">
          <div v-for="(label, i) in STEPS" :key="label" class="flex min-w-0 flex-1 items-center gap-2">
            <div
              class="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full text-xs font-bold"
              :class="step > i + 1 || step === i + 1 ? 'bg-primary text-inverted' : 'bg-muted text-dimmed'"
            >
              <UIcon v-if="step > i + 1" name="i-lucide-check" class="h-3.5 w-3.5" />
              <template v-else>{{ i + 1 }}</template>
            </div>
            <span
              class="whitespace-nowrap text-xs font-semibold"
              :class="step > i + 1 || step === i + 1 ? 'text-default' : 'text-dimmed'"
            >{{ label }}</span>
            <div v-if="i < STEPS.length - 1" class="mx-1.5 h-0.5 flex-1 rounded" :class="step > i + 1 ? 'bg-primary' : 'bg-muted'" />
          </div>
        </div>

        <!-- Body -->
        <div class="min-h-[300px] flex-1 overflow-y-auto px-6 py-[22px]">
          <!-- Passo 1 -->
          <div v-if="step === 1" class="flex flex-col gap-4">
            <UFormField label="Nome da Subconta">
              <UInput v-model="name" placeholder="Ex: Clínica Sorriso" size="lg" class="w-full" autofocus />
            </UFormField>
            <UFormField label="E-mail do administrador · opcional">
              <UInput v-model="email" placeholder="admin@cliente.com.br" size="lg" class="w-full" />
            </UFormField>
            <USwitch
              v-model="invite"
              label="Enviar convite de acesso"
              description="O administrador recebe um e-mail para definir a senha do painel."
            />
          </div>

          <!-- Passo 2 -->
          <div v-else-if="step === 2" class="flex flex-col gap-5">
            <div>
              <p class="mb-2 text-[13px] font-semibold text-default">De quem se cobra · onde fica o saldo</p>
              <div class="flex items-start gap-3 rounded-xl border-[1.5px] border-primary/40 bg-primary/5 p-[15px]">
                <span class="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-[5px] border-primary" />
                <div>
                  <div class="mb-0.5 text-[13px] font-semibold">Individual na subconta</div>
                  <div class="text-[11px] leading-snug text-muted">
                    O cliente final compra crédito ou plano direto da API4COM, com saldo próprio e independente.
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-start gap-2.5 rounded-xl border border-default bg-muted p-3.5">
              <div class="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-primary text-inverted">
                <UIcon name="i-lucide-wallet" class="h-4 w-4" />
              </div>
              <div>
                <div class="mb-0.5 text-[13px] font-bold">Como se cobra é definido pela subconta</div>
                <div class="text-[11px] leading-snug text-muted">
                  A própria subconta escolhe pré-pago ou plano ao comprar direto da API4COM. Você apenas
                  provisiona o acesso e acompanha de forma read-only no painel.
                </div>
              </div>
            </div>
          </div>

          <!-- Passo 3 -->
          <div v-else class="flex flex-col gap-[18px]">
            <div class="rounded-xl border border-default bg-muted p-4">
              <div class="mb-1.5 flex items-center gap-2.5">
                <UIcon name="i-lucide-credit-card" class="h-[17px] w-[17px] text-primary" />
                <div class="text-[13px] font-bold">Saldo próprio e independente</div>
              </div>
              <p class="text-xs leading-relaxed text-muted">
                Esta subconta compra direto da API4COM, com saldo próprio. A Conta Principal não define
                cobrança nem crédito inicial — apenas acompanha (read-only).
              </p>
            </div>

            <div class="overflow-hidden rounded-xl border border-default">
              <div class="border-b border-default bg-muted px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-dimmed">
                Revisão
              </div>
              <div class="divide-y divide-default">
                <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span class="text-xs font-medium text-muted">Nome</span>
                  <span class="text-right text-[13px] font-semibold">{{ name.trim() || '—' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span class="text-xs font-medium text-muted">E-mail admin</span>
                  <span class="text-right text-[13px] font-semibold">{{ email.trim() || '—' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span class="text-xs font-medium text-muted">Cobrança</span>
                  <span class="text-right text-[13px] font-semibold">Definido pela subconta</span>
                </div>
                <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span class="text-xs font-medium text-muted">Convite</span>
                  <span class="text-right text-[13px] font-semibold">{{ invite ? 'Enviar e-mail de acesso' : 'Não enviar' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex shrink-0 items-center justify-between gap-2.5 border-t border-default bg-muted px-6 py-4">
          <UButton v-if="step > 1" color="neutral" variant="outline" icon="i-lucide-arrow-left" @click="step -= 1">
            Voltar
          </UButton>
          <span v-else />
          <div class="flex gap-2.5">
            <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
            <UButton :disabled="step === 1 && !nameOk" @click="next">{{ primaryLabel }}</UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
