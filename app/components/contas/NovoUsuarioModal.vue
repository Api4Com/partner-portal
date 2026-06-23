<script setup lang="ts">
import { newUsuarioId, type Usuario, type UsuarioRole } from '~/lib/contas'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [u: Usuario] }>()

const name = ref('')
const email = ref('')
const role = ref<UsuarioRole>('usuario')
const active = ref(true)

const roleItems = [
  { label: 'Usuário', value: 'usuario' },
  { label: 'Admin', value: 'admin' }
]

const nameOk = computed(() => name.value.trim().length > 0)

watch(open, (v) => {
  if (v) {
    name.value = ''
    email.value = ''
    role.value = 'usuario'
    active.value = true
  }
})

function create() {
  if (!nameOk.value) return
  emit('created', {
    id: newUsuarioId(),
    name: name.value.trim(),
    email: email.value.trim() || `${name.value.trim().toLowerCase().replace(/\s+/g, '.')}@subconta.com.br`,
    role: role.value,
    active: active.value,
    lastCall: ''
  })
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-[520px]' }">
    <template #content>
      <div class="flex max-h-[90vh] flex-col">
        <!-- Header -->
        <div class="flex shrink-0 items-start justify-between gap-3 border-b border-default px-6 pb-4 pt-5">
          <div class="flex items-center gap-3">
            <div class="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <UIcon name="i-lucide-user-plus" class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-bold tracking-tight">Adicionar usuário</h2>
              <p class="mt-0.5 text-xs text-dimmed">
                Novo acesso de webphone isolado nesta subconta.
              </p>
            </div>
          </div>
          <UButton color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Fechar" @click="open = false" />
        </div>

        <!-- Body -->
        <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-[22px]">
          <UFormField label="Nome do usuário">
            <UInput v-model="name" placeholder="Ex: Ana Ribeiro" size="lg" class="w-full" autofocus />
          </UFormField>
          <UFormField label="E-mail · opcional">
            <UInput v-model="email" placeholder="ana.ribeiro@cliente.com.br" size="lg" class="w-full" />
          </UFormField>
          <UFormField label="Tipo de acesso">
            <USelect v-model="role" :items="roleItems" size="lg" class="w-full" />
          </UFormField>
          <USwitch
            v-model="active"
            label="Usuário ativo"
            description="Usuários desativados não conseguem acessar o webphone da subconta."
          />
        </div>

        <!-- Footer -->
        <div class="flex shrink-0 items-center justify-end gap-2.5 border-t border-default bg-muted px-6 py-4">
          <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
          <UButton :disabled="!nameOk" @click="create">Adicionar usuário</UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
