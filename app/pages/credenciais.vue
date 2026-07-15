<script setup lang="ts">
import {
  CREDENCIAL_STATUS_BADGE,
  escopoLabel,
  fmtCredencialData,
  fmtUltimoUso,
  type Credencial
} from '~/lib/credenciais'

// As credenciais que a INTEGRAÇÃO do parceiro usa (`p4c_…`) — distintas da sessão do
// portal. Emitir e revogar exigem sessão humana: uma credencial não gerencia
// credenciais (senão uma chave vazada emitiria outra e revogar deixaria de resolver).
const { items, loading, error, load, revoke, mensagemDoErro } = useCredenciais()
const toast = useToast()

const novaOpen = ref(false)

// Revogação é irreversível e derruba a integração no request seguinte: confirma.
const revogando = ref<Credencial | null>(null)
const revogandoLoading = ref(false)

async function confirmarRevogacao() {
  const alvo = revogando.value
  if (!alvo || revogandoLoading.value) return
  revogandoLoading.value = true
  try {
    await revoke(alvo.publicId)
    revogando.value = null
    toast.add({
      title: 'Credencial revogada',
      description: `“${alvo.name}” para de funcionar no próximo request.`,
      icon: 'i-lucide-shield-off',
      color: 'success'
    })
  } catch (err) {
    toast.add({
      title: 'Não foi possível revogar',
      description: mensagemDoErro(err, 'Tente novamente em instantes.'),
      icon: 'i-lucide-triangle-alert',
      color: 'error'
    })
  } finally {
    revogandoLoading.value = false
  }
}

// O token está no cookie: buscar no cliente evita um round-trip de SSR sem sessão.
onMounted(load)
</script>

<template>
  <PortalTopbar title="Credenciais" />

  <div class="flex-1 overflow-y-auto px-7 pb-12 pt-7">
    <div class="mx-auto max-w-[1240px]">
      <div class="mb-[22px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="mb-1.5 text-xs font-semibold tracking-wide text-primary">
            Portal do Parceiro
          </p>
          <h1 class="mb-1 text-2xl font-bold tracking-tight sm:text-3xl">
            Credenciais de API
          </h1>
          <p class="text-sm text-muted">
            Chaves que a sua integração usa para criar subcontas e ler dados sem passar por este portal.
          </p>
        </div>
        <UButton
          icon="i-lucide-plus"
          @click="novaOpen = true"
        >
          Nova credencial
        </UButton>
      </div>

      <UCard :ui="{ body: 'p-0' }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-[15px] font-semibold">
                Suas chaves
              </h2>
              <p class="mt-0.5 text-xs text-muted">
                O segredo só aparece na emissão. Para rotacionar: emita a nova, troque na
                integração e só então revogue a antiga.
              </p>
            </div>
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="loading"
              aria-label="Recarregar"
              @click="load"
            />
          </div>
        </template>

        <div
          v-if="loading && !items.length"
          class="px-6 py-14 text-center text-sm text-muted"
        >
          Carregando credenciais…
        </div>

        <div
          v-else-if="error"
          class="px-6 py-14 text-center"
        >
          <UIcon
            name="i-lucide-triangle-alert"
            class="mx-auto mb-3 h-8 w-8 text-error"
          />
          <p class="mb-4 text-sm text-muted">
            {{ error }}
          </p>
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            @click="load"
          >
            Tentar de novo
          </UButton>
        </div>

        <div
          v-else-if="!items.length"
          class="px-6 py-14 text-center"
        >
          <div class="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
            <UIcon
              name="i-lucide-key-round"
              class="h-6 w-6"
            />
          </div>
          <h3 class="mb-1 text-[15px] font-semibold">
            Nenhuma credencial ainda
          </h3>
          <p class="mx-auto mb-5 max-w-[420px] text-sm text-muted">
            Emita uma para que o seu sistema abra subcontas e consulte consumo pela API,
            sem um humano no meio.
          </p>
          <UButton
            icon="i-lucide-plus"
            @click="novaOpen = true"
          >
            Nova credencial
          </UButton>
        </div>

        <div
          v-else
          class="overflow-x-auto"
        >
          <table class="w-full min-w-[880px] border-collapse">
            <thead class="bg-muted/50">
              <tr class="border-b border-default text-left text-[11px] font-semibold uppercase tracking-wider text-dimmed">
                <th class="px-6 py-3">
                  Nome
                </th>
                <th class="px-6 py-3">
                  Permissões
                </th>
                <th class="px-6 py-3">
                  Status
                </th>
                <th class="px-6 py-3">
                  Último uso
                </th>
                <th class="px-6 py-3">
                  Criada em
                </th>
                <th class="px-6 py-3 text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="c in items"
                :key="c.publicId"
                class="border-b border-default last:border-0"
                :class="c.status === 'REVOKED' ? 'opacity-60' : ''"
              >
                <td class="px-6 py-4">
                  <div class="text-[13px] font-semibold">
                    {{ c.name }}
                  </div>
                  <div class="mt-0.5 font-mono text-[11px] text-dimmed">
                    {{ c.keyId }}
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div
                    v-if="c.scopes.length"
                    class="flex flex-wrap gap-1"
                  >
                    <UBadge
                      v-for="s in c.scopes"
                      :key="s"
                      color="neutral"
                      variant="subtle"
                      size="sm"
                    >
                      {{ escopoLabel(s) }}
                    </UBadge>
                  </div>
                  <span
                    v-else
                    class="text-[13px] text-dimmed"
                  >
                    Tudo o que a parceria concede
                  </span>
                </td>
                <td class="px-6 py-4">
                  <UBadge
                    :color="CREDENCIAL_STATUS_BADGE[c.status].color"
                    variant="subtle"
                  >
                    {{ CREDENCIAL_STATUS_BADGE[c.status].label }}
                  </UBadge>
                </td>
                <td class="px-6 py-4 text-[13px] text-muted">
                  {{ fmtUltimoUso(c.lastUsedAt) }}
                </td>
                <td class="px-6 py-4 text-[13px] text-muted">
                  {{ fmtCredencialData(c.createdAt) }}
                </td>
                <td class="px-6 py-4 text-right">
                  <UButton
                    v-if="c.status === 'ACTIVE'"
                    color="error"
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-shield-off"
                    @click="revogando = c"
                  >
                    Revogar
                  </UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>
  </div>

  <CredenciaisNovaCredencialModal v-model:open="novaOpen" />

  <!-- Confirmação de revogação: vale no request seguinte, e não há como desfazer. -->
  <UModal
    :open="!!revogando"
    :ui="{ content: 'sm:max-w-[480px]' }"
    @update:open="(v: boolean) => { if (!v) revogando = null }"
  >
    <template #content>
      <div class="flex flex-col">
        <div class="flex items-start gap-3 border-b border-default px-6 pb-4 pt-5">
          <div class="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl bg-error/10 text-error">
            <UIcon
              name="i-lucide-shield-off"
              class="h-5 w-5"
            />
          </div>
          <div>
            <h2 class="text-lg font-bold tracking-tight">
              Revogar “{{ revogando?.name }}”?
            </h2>
            <p class="mt-0.5 text-xs text-dimmed">
              Chave <span class="font-mono">{{ revogando?.keyId }}</span>
            </p>
          </div>
        </div>

        <div class="px-6 py-[22px] text-[13px] leading-relaxed">
          <p>
            Toda integração que usa esta chave passa a receber
            <span class="font-semibold">401</span> já no próximo request — não há período
            de carência. E não dá para desfazer: só emitir uma nova.
          </p>
          <p class="mt-3 text-muted">
            Se a intenção é rotacionar, emita a nova e troque na integração
            <span class="font-semibold">antes</span> de revogar esta.
          </p>
        </div>

        <div class="flex items-center justify-end gap-2.5 border-t border-default bg-muted px-6 py-4">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="revogandoLoading"
            @click="revogando = null"
          >
            Cancelar
          </UButton>
          <UButton
            color="error"
            :loading="revogandoLoading"
            @click="confirmarRevogacao"
          >
            Revogar credencial
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
