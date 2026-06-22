<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const user = useSupabaseUser()

type Mode = 'login' | 'signup'
const mode = ref<Mode>('login')
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const confirmSent = ref(false)

const state = reactive({
  fullName: '',
  company: '',
  email: '',
  password: ''
})

// Se já estiver logado, sai do login.
watchEffect(() => {
  if (user.value) navigateTo('/')
})

function translateError(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/already registered/i.test(msg)) return 'Este e-mail já está cadastrado.'
  if (/password should be at least/i.test(msg)) return 'A senha deve ter ao menos 6 caracteres.'
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar.'
  return msg
}

async function onSubmit() {
  errorMsg.value = null
  loading.value = true
  try {
    if (mode.value === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: state.email,
        password: state.password
      })
      if (error) throw error
      await navigateTo('/')
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: state.email,
        password: state.password,
        options: { data: { full_name: state.fullName, company: state.company } }
      })
      if (error) throw error
      if (!data.session) confirmSent.value = true
      else await navigateTo('/')
    }
  } catch (e) {
    errorMsg.value = translateError(e instanceof Error ? e.message : 'Erro inesperado.')
  } finally {
    loading.value = false
  }
}

function toggleMode() {
  mode.value = mode.value === 'login' ? 'signup' : 'login'
  errorMsg.value = null
}
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
          <p class="text-xs text-brand-200">Programa de Parceiros</p>
        </div>
      </div>

      <div class="relative space-y-4">
        <span class="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-100 ring-1 ring-inset ring-white/15">
          Voz e IA para os seus clientes
        </span>
        <h1 class="text-3xl font-bold leading-tight tracking-tight">
          Você integra,<br>a gente cuida da comunicação.
        </h1>
        <p class="max-w-md leading-relaxed text-brand-100/80">
          Acompanhe a evolução da plataforma em dupla linguagem — o valor comercial para vender e o
          detalhe técnico para integrar.
        </p>
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
              ? 'Entre para ver o roadmap e acompanhar seus interesses.'
              : 'Cadastre-se como parceiro para acessar o roadmap.' }}
          </p>

          <UForm :state="state" class="mt-6 space-y-3" @submit="onSubmit">
            <template v-if="mode === 'signup'">
              <UFormField name="fullName">
                <UInput v-model="state.fullName" icon="i-lucide-user" placeholder="Seu nome" size="lg" class="w-full" required />
              </UFormField>
              <UFormField name="company">
                <UInput v-model="state.company" icon="i-lucide-building-2" placeholder="Empresa / Revenda" size="lg" class="w-full" />
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
