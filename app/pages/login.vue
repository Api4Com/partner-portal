<script setup lang="ts">
definePageMeta({ layout: false })

const { login, signup } = useAuth()

type Mode = 'login' | 'signup'
const mode = ref<Mode>('login')
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const confirmSent = ref(false)

const state = reactive({
  fullName: '',
  company: '',
  email: '',
  password: '',
  phone: ''
})

// Extrai a mensagem de erro do pbxapi (LoopBack: { error: { message, code } }).
function translateError(e: unknown): string {
  const data = (e as { data?: { error?: { message?: string, code?: string } } })?.data?.error
  const code = data?.code
  if (code === 'LOGIN_FAILED' || /login failed/i.test(data?.message || '')) return 'E-mail ou senha incorretos.'
  if (code === 'LOGIN_FAILED_EMAIL_NOT_VERIFIED') return 'Confirme seu e-mail antes de entrar.'
  if (code === 'EMAIL_NOT_FOUND') return 'E-mail não encontrado.'
  return data?.message || (e instanceof Error ? e.message : 'Erro inesperado.')
}

async function onSubmit() {
  errorMsg.value = null
  loading.value = true
  try {
    if (mode.value === 'login') {
      await login(state.email, state.password)
      await navigateTo('/')
    } else {
      await signup({
        name: state.fullName,
        organizationName: state.company,
        email: state.email,
        password: state.password,
        phone: state.phone.replace(/\D/g, '')
      })
      confirmSent.value = true
    }
  } catch (e) {
    errorMsg.value = translateError(e)
  } finally {
    loading.value = false
  }
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'signup' : 'login'
  errorMsg.value = null
}

// Destaques do painel de marca
const HIGHLIGHTS = [
  'Painel de subcontas, usuários e consumo',
  'Relatórios de chamadas com export e gravações',
  'Roadmap e acesso antecipado aos betas'
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
      typeTimer = setTimeout(() => { deleting = true; step() }, 1600)
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

onBeforeUnmount(() => { if (typeTimer) clearTimeout(typeTimer) })
</script>

<template>
  <div class="grid min-h-screen lg:grid-cols-2">
    <!-- Painel de marca -->
    <div class="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 p-10 text-white lg:flex">
      <div class="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-brand-500/25 blur-3xl" />

      <div class="relative flex items-center gap-3">
        <div class="grid h-10 w-10 place-items-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15">
          <UIcon name="i-lucide-radio" class="h-5 w-5" />
        </div>
        <div class="leading-tight">
          <p class="font-semibold tracking-tight">API4COM</p>
          <p class="text-xs text-brand-200">Portal de Parceiros</p>
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
          <li v-for="t in HIGHLIGHTS" :key="t" class="flex items-center gap-2.5">
            <UIcon name="i-lucide-circle-check" class="h-4 w-4 shrink-0 text-brand-400" />
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
        <template v-if="confirmSent">
          <div class="space-y-3 rounded-2xl border border-default bg-elevated/50 p-6 text-center">
            <UIcon name="i-lucide-circle-check" class="mx-auto h-9 w-9 text-success" />
            <h2 class="text-lg font-bold">Confirme seu e-mail</h2>
            <p class="text-sm text-muted">
              Enviamos um link de confirmação para <strong>{{ state.email }}</strong>. Após confirmar,
              volte e faça login.
            </p>
            <UButton variant="link" @click="confirmSent = false; mode = 'login'">
              Voltar para o login
            </UButton>
          </div>
        </template>

        <template v-else>
          <h2 class="text-2xl font-bold tracking-tight">
            {{ mode === 'login' ? 'Acesse o portal' : 'Crie sua conta' }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ mode === 'login'
              ? 'Entre para gerenciar suas subcontas e acompanhar a plataforma.'
              : 'Cadastre-se como parceiro para gerenciar suas subcontas e acessar a plataforma.' }}
          </p>

          <UForm :state="state" class="mt-6 space-y-3" @submit="onSubmit">
            <template v-if="mode === 'signup'">
              <UFormField name="fullName">
                <UInput v-model="state.fullName" icon="i-lucide-user" placeholder="Seu nome" size="lg" class="w-full" required />
              </UFormField>
              <UFormField name="company">
                <UInput v-model="state.company" icon="i-lucide-building-2" placeholder="Empresa / Revenda" size="lg" class="w-full" required />
              </UFormField>
              <UFormField name="phone">
                <UInput v-model="state.phone" type="tel" icon="i-lucide-phone" placeholder="Telefone com DDD" size="lg" class="w-full" required />
              </UFormField>
            </template>

            <UFormField name="email">
              <UInput v-model="state.email" type="email" icon="i-lucide-mail" placeholder="E-mail" size="lg" class="w-full" required />
            </UFormField>
            <UFormField name="password">
              <UInput v-model="state.password" type="password" icon="i-lucide-lock" placeholder="Senha" size="lg" class="w-full" required />
            </UFormField>

            <UAlert v-if="errorMsg" color="error" variant="subtle" :title="errorMsg" icon="i-lucide-triangle-alert" />

            <UButton type="submit" :loading="loading" block size="lg" icon="i-lucide-briefcase">
              {{ mode === 'login' ? 'Entrar' : 'Criar conta' }}
            </UButton>
          </UForm>

          <p class="mt-6 text-center text-sm text-muted">
            {{ mode === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?' }}
            <UButton variant="link" class="px-1" @click="toggleMode">
              {{ mode === 'login' ? 'Cadastre-se' : 'Faça login' }}
            </UButton>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
