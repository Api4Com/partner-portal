<script setup lang="ts">
interface CreatedSubaccount { id: string, name: string, users: number, minutes: number, status: 'active' | 'inactive' }

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [s: CreatedSubaccount] }>()

const { user, bffFetch } = useAuth()
const { executeRecaptcha } = useRecaptcha()

const partnerName = computed(() => user.value?.name || 'a conta principal')

const STEPS = ['Identidade', 'Cobrança', 'Consumo']
const step = ref(1)

/* ----- campos (Modelo A) ----- */
const name = ref('')
const identification = ref('')
const adminName = ref('')
const adminEmail = ref('')
const phone = ref('')
const password = ref('')

const submitting = ref(false)
const errorMsg = ref('')

/* ----- documento: tipo INFERIDO pelo tamanho (não pedimos ao usuário).
   CPF = 11 dígitos; CNPJ = 14 ALFANUMÉRICOS (novo formato 2026) ----- */
const docClean = computed(() => identification.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())
const docType = computed<'CPF' | 'CNPJ' | null>(() => {
  const v = docClean.value
  if (v.length === 11 && /^\d{11}$/.test(v)) return 'CPF'
  if (v.length === 14 && /^[A-Z0-9]{14}$/.test(v)) return 'CNPJ'
  return null
})
const docOk = computed(() => docType.value !== null)
const emailOk = computed(() => /.+@.+\..+/.test(adminEmail.value.trim()))
const phoneOk = computed(() => phone.value.replace(/\D/g, '').length >= 10)

const step1Valid = computed(() =>
  name.value.trim().length >= 2
  && docOk.value
  && adminName.value.trim().length >= 2
  && emailOk.value
  && phoneOk.value
  && password.value.length >= 6
)

const primaryLabel = computed(() => (step.value < 3 ? 'Próximo' : 'Criar Subconta'))

watch(open, (v) => {
  if (v) {
    step.value = 1
    name.value = ''
    identification.value = ''
    adminName.value = ''
    adminEmail.value = ''
    phone.value = ''
    password.value = ''
    errorMsg.value = ''
    submitting.value = false
  }
})

function readError(err: unknown): string {
  const e = err as { data?: { message?: string, key?: string }, message?: string }
  const code = e?.data?.key
  if (typeof code === 'string' && code.startsWith('RECAPTCHA')) {
    return 'Falha na verificação anti-robô. Recarregue a página e tente novamente.'
  }
  return e?.data?.message || e?.message || 'Não foi possível criar a subconta. Tente novamente.'
}

async function submit() {
  if (submitting.value) return
  submitting.value = true
  errorMsg.value = ''
  try {
    const recaptchaToken = await executeRecaptcha('signup')
    const created = await bffFetch<CreatedSubaccount>('/subaccounts', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        identification: docClean.value,
        identificationType: docType.value,
        adminName: adminName.value.trim(),
        adminEmail: adminEmail.value.trim(),
        phone: phone.value.replace(/\D/g, ''),
        password: password.value,
        recaptchaToken
      }
    })
    emit('created', created)
    open.value = false
  } catch (err) {
    errorMsg.value = readError(err)
  } finally {
    submitting.value = false
  }
}

function next() {
  if (step.value === 1 && !step1Valid.value) return
  if (step.value < 3) {
    step.value += 1
  } else {
    submit()
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
            <div class="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <UIcon name="i-lucide-user-plus" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-bold tracking-tight">Nova Subconta</h2>
              <p class="mt-0.5 text-xs text-dimmed">
                Subconta gerida por {{ partnerName }} · saldo próprio e independente.
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
              :class="step >= i + 1 ? 'bg-primary text-inverted' : 'bg-muted text-dimmed'"
            >
              <UIcon v-if="step > i + 1" name="i-lucide-check" class="h-3.5 w-3.5" />
              <template v-else>{{ i + 1 }}</template>
            </div>
            <span
              class="whitespace-nowrap text-xs font-semibold"
              :class="step >= i + 1 ? 'text-default' : 'text-dimmed'"
            >{{ label }}</span>
            <div v-if="i < STEPS.length - 1" class="mx-1.5 h-0.5 flex-1 rounded" :class="step > i + 1 ? 'bg-primary' : 'bg-muted'" />
          </div>
        </div>

        <!-- Body -->
        <div class="min-h-[320px] flex-1 overflow-y-auto px-6 py-[22px]">
          <!-- Passo 1: Identidade + admin -->
          <div v-if="step === 1" class="flex flex-col gap-4">
            <UFormField label="Nome da Subconta">
              <UInput v-model="name" placeholder="Ex: Clínica Sorriso" size="lg" class="w-full" autofocus />
            </UFormField>
            <UFormField label="Documento (CPF ou CNPJ)" :help="docType ? `Detectado: ${docType}` : 'Informe CPF (11 dígitos) ou CNPJ (14)'">
              <UInput
                v-model="identification"
                placeholder="CPF ou CNPJ"
                size="lg"
                class="w-full"
                :color="identification && !docOk ? 'error' : undefined"
              />
            </UFormField>

            <div class="border-t border-default pt-4">
              <p class="mb-3 text-[13px] font-semibold text-muted">Administrador da subconta</p>
              <div class="flex flex-col gap-4">
                <UFormField label="Nome do administrador">
                  <UInput v-model="adminName" placeholder="Ex: Maria Silva" size="lg" class="w-full" />
                </UFormField>
                <div class="flex flex-col gap-4 sm:flex-row">
                  <UFormField label="E-mail" class="flex-1">
                    <UInput v-model="adminEmail" type="email" placeholder="admin@cliente.com.br" size="lg" class="w-full" />
                  </UFormField>
                  <UFormField label="Telefone" class="flex-1">
                    <UInput v-model="phone" placeholder="(11) 99999-9999" size="lg" class="w-full" />
                  </UFormField>
                </div>
                <UFormField label="Senha inicial" help="O administrador poderá alterá-la depois no painel.">
                  <UInput v-model="password" type="password" placeholder="Mínimo 6 caracteres" size="lg" class="w-full" />
                </UFormField>
              </div>
            </div>
          </div>

          <!-- Passo 2: Cobrança (informativo — protótipo, a validar com PM) -->
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
                  provisiona o acesso e acompanha a escolha de forma read-only no painel.
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2.5 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3.5 py-3">
              <div class="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <UIcon name="i-lucide-credit-card" class="h-4 w-4" />
              </div>
              <div>
                <div class="text-[11px] font-semibold uppercase tracking-wider text-dimmed">Modelo selecionado</div>
                <div class="text-[13px] font-bold">Cobrança definida pela subconta · individual na subconta</div>
              </div>
            </div>
          </div>

          <!-- Passo 3: Consumo / Revisão -->
          <div v-else class="flex flex-col gap-[18px]">
            <div class="rounded-xl border border-default bg-muted p-4">
              <div class="mb-1.5 flex items-center gap-2.5">
                <UIcon name="i-lucide-credit-card" class="h-[17px] w-[17px] text-primary" />
                <div class="text-[13px] font-bold">Saldo próprio e independente</div>
              </div>
              <div class="flex items-start gap-2.5 rounded-lg border border-default bg-default px-3.5 py-2.5">
                <UIcon name="i-lucide-info" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span class="text-xs leading-snug text-muted">
                  A própria subconta escolhe pré-pago ou plano e faz a primeira compra ao acessar o painel.
                  A conta principal não define cobrança nem crédito inicial — apenas acompanha (read-only).
                </span>
              </div>
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
                  <span class="text-xs font-medium text-muted">Documento</span>
                  <span class="text-right text-[13px] font-semibold">{{ docType ? `${docType} · ${docClean}` : '—' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span class="text-xs font-medium text-muted">Administrador</span>
                  <span class="text-right text-[13px] font-semibold">{{ adminName.trim() || '—' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span class="text-xs font-medium text-muted">E-mail admin</span>
                  <span class="text-right text-[13px] font-semibold">{{ adminEmail.trim() || '—' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span class="text-xs font-medium text-muted">Telefone</span>
                  <span class="text-right text-[13px] font-semibold">{{ phone.trim() || '—' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span class="text-xs font-medium text-muted">Como se cobra</span>
                  <span class="text-right text-[13px] font-semibold">Definido pela subconta</span>
                </div>
              </div>
            </div>

            <div v-if="errorMsg" class="flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 px-3.5 py-2.5 text-[13px] text-error">
              <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
              <span>{{ errorMsg }}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex shrink-0 items-center justify-between gap-2.5 border-t border-default bg-muted px-6 py-4">
          <UButton v-if="step > 1" color="neutral" variant="outline" icon="i-lucide-arrow-left" :disabled="submitting" @click="step -= 1">
            Voltar
          </UButton>
          <span v-else />
          <div class="flex gap-2.5">
            <UButton color="neutral" variant="ghost" :disabled="submitting" @click="open = false">Cancelar</UButton>
            <UButton
              :disabled="(step === 1 && !step1Valid) || submitting"
              :loading="submitting && step === 3"
              @click="next"
            >
              {{ primaryLabel }}
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
