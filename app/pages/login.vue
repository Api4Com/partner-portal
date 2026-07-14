<script setup lang="ts">
definePageMeta({ layout: false })

const { login } = useAuth()

const loading = ref(false)
const errorMsg = ref<string | null>(null)
const showPassword = ref(false)

// Limites de tamanho (também aplicados como `maxlength` nos inputs). E-mail segue
// o limite prático do RFC 5321 (254); a senha tem um teto defensivo para evitar
// payloads absurdos — o backend é a validação canônica, isto é só a 1ª barreira.
const EMAIL_MAX = 254
const PASSWORD_MAX = 128

const state = reactive({
  email: '',
  password: ''
})

// Mensagem de erro do BFF/pbxapi (LoopBack: { error: { message, code } }).
function translateError(e: unknown): string {
  const status = e as { statusCode?: number, status?: number, response?: { status?: number } }
  const httpStatus = status?.statusCode ?? status?.status ?? status?.response?.status
  // O BFF responde 403 quando a conta existe mas não é parceira.
  if (httpStatus === 403) {
    return 'Esta conta não tem acesso ao Portal de Parceiros.'
  }
  // 401 = credenciais inválidas (e-mail ou senha incorretos).
  if (httpStatus === 401) {
    return 'E-mail ou senha incorretos.'
  }
  const error = (e as { data?: { error?: { message?: string, code?: string } } })?.data?.error
  if (error?.code === 'LOGIN_FAILED') return 'E-mail ou senha incorretos.'
  if (error?.code === 'LOGIN_FAILED_EMAIL_NOT_VERIFIED') return 'Confirme seu e-mail antes de entrar.'
  if (error?.code === 'EMAIL_NOT_FOUND') return 'E-mail não encontrado.'
  if (error?.message) return error.message
  if (e instanceof Error) return e.message
  return 'Erro inesperado.'
}

async function onSubmit() {
  // Guarda contra cliques rápidos: ignora submissões enquanto uma está em voo.
  if (loading.value) return
  errorMsg.value = null
  loading.value = true
  try {
    await login(state.email, state.password)
    await navigateTo('/')
  } catch (e) {
    errorMsg.value = translateError(e)
  } finally {
    loading.value = false
  }
}

// Não há cadastro por este portal: o BFF removeu o `POST /accounts/signup`, e a conta
// parceira nasce pelo signup normal do api4com-portal + habilitação pelo time interno.
// O formulário de cadastro (e o reCAPTCHA que o alimentava) saiu junto — mantê-lo seria
// oferecer um caminho que responde 404.

// Destaques do painel de marca
const HIGHLIGHTS = [
  'Painel de subcontas, usuários e consumo',
  'Relatórios de chamadas com export e gravações',
  'Roadmap de produto: vote e comente as próximas entregas'
]

// Animação "typewriter" no logotipo API4COM — troca a terminação "COM".
const COM_WORDS = ['COMUNICAÇÃO INTELIGENTE', 'COMERCIAL', 'COMPROMISSO', 'COMUNIDADE', 'YOU']
const typed = ref('')
let typeTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  let wordIndex = 0
  let deleting = false
  function step() {
    const word = COM_WORDS[wordIndex]!
    if (!deleting && typed.value === word) {
      typeTimer = setTimeout(() => {
        deleting = true
        step()
      }, 1600)
      return
    }
    if (deleting && typed.value === '') {
      deleting = false
      wordIndex = (wordIndex + 1) % COM_WORDS.length
      typeTimer = setTimeout(step, 200)
      return
    }
    const w = COM_WORDS[wordIndex]!
    typed.value = deleting ? w.slice(0, typed.value.length - 1) : w.slice(0, typed.value.length + 1)
    typeTimer = setTimeout(step, deleting ? 45 : 85)
  }
  step()
})

onBeforeUnmount(() => {
  if (typeTimer) clearTimeout(typeTimer)
})
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-2">
    <!-- Painel de marca -->
    <div class="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 p-10 text-white lg:flex">
      <div class="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-brand-500/25 blur-3xl" />

      <div class="relative flex items-center gap-3">
        <div class="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15">
          <UIcon
            name="i-lucide-radio"
            class="h-5 w-5"
          />
        </div>
        <div class="leading-tight">
          <p class="font-semibold tracking-tight">
            API4COM
          </p>
          <p class="text-xs text-brand-200">
            Portal de Parceiros
          </p>
        </div>
      </div>

      <div class="relative space-y-5">
        <span class="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-100 ring-1 ring-inset ring-white/15">
          Voz e IA para os seus clientes
        </span>
        <h1 class="text-3xl font-bold leading-tight tracking-tight">
          Você integra,<br>a gente cuida da comunicação.
        </h1>

        <p class="font-mono text-2xl font-bold tracking-tight">
          <span class="text-white">API4</span><span class="text-brand-400">{{ typed }}</span><span class="ml-0.5 animate-pulse text-brand-400">|</span>
        </p>

        <p class="max-w-md leading-relaxed text-brand-100/80">
          Sua central de parceria com a API4COM: gerencie subcontas, acompanhe chamadas e consumo em
          <strong class="text-white">tempo real</strong> e acompanhe o roadmap — tudo num só portal.
        </p>

        <ul class="space-y-2.5 pt-1 text-sm text-brand-50">
          <li
            v-for="t in HIGHLIGHTS"
            :key="t"
            class="flex items-center gap-2.5"
          >
            <UIcon
              name="i-lucide-circle-check"
              class="h-4 w-4 shrink-0 text-brand-400"
            />
            {{ t }}
          </li>
        </ul>
      </div>

      <p class="relative text-[11px] font-medium text-brand-200/70">
        +5M de minutos/mês · +22 integrações · suporte humano
      </p>
    </div>

    <!-- Formulário -->
    <div class="flex items-center justify-center bg-default p-6">
      <div class="w-full max-w-sm">
        <h2 class="text-2xl font-bold tracking-tight">
          Acesse o portal
        </h2>
        <p class="mt-1 text-sm text-muted">
          Entre para gerenciar suas subcontas e acompanhar a plataforma.
        </p>

        <UForm
          :state="state"
          class="mt-6 space-y-3"
          @submit="onSubmit"
        >
          <UFormField name="email">
            <UInput
              v-model="state.email"
              type="email"
              icon="i-lucide-mail"
              placeholder="E-mail"
              size="lg"
              class="w-full"
              :maxlength="EMAIL_MAX"
              autocomplete="email"
              required
            />
          </UFormField>
          <UFormField name="password">
            <UInput
              v-model="state.password"
              :type="showPassword ? 'text' : 'password'"
              icon="i-lucide-lock"
              placeholder="Senha"
              size="lg"
              class="w-full"
              :ui="{ trailing: 'pe-1' }"
              :maxlength="PASSWORD_MAX"
              autocomplete="current-password"
              required
            >
              <template #trailing>
                <UButton
                  color="neutral"
                  variant="link"
                  size="sm"
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
                  :aria-pressed="showPassword"
                  tabindex="-1"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>
          </UFormField>

          <UAlert
            v-if="errorMsg"
            color="error"
            variant="subtle"
            :title="errorMsg"
            icon="i-lucide-triangle-alert"
          />

          <UButton
            type="submit"
            :loading="loading"
            :disabled="loading"
            block
            size="lg"
            icon="i-lucide-briefcase"
          >
            Entrar
          </UButton>
        </UForm>
      </div>
    </div>
  </div>
</template>
