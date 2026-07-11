<script setup lang="ts">
import {
  ASSET_LABEL,
  HORIZONS,
  METHOD_COLORS,
  TAG_META,
  type PartnerProfile
} from '~/lib/roadmap'

const {
  activeItem,
  activeItemId,
  closeItem,
  profile,
  states,
  toggleInterest,
  requestBeta
} = useRoadmap()

const tab = ref<PartnerProfile>(profile.value)

// Ao abrir um item, alinha a aba inicial com o perfil ativo.
watch(activeItemId, (id) => {
  if (id) tab.value = profile.value
})

const open = computed({
  get: () => activeItemId.value !== null,
  set: (v: boolean) => {
    if (!v) closeItem()
  }
})

const state = computed(() => (activeItem.value ? states.value[activeItem.value.id] : undefined))
const interested = computed(() => state.value?.interested ?? false)
const betaRequested = computed(() => state.value?.betaRequested ?? false)
const horizon = computed(() => HORIZONS.find(h => h.id === activeItem.value?.horizon))
const tag = computed(() => (activeItem.value ? TAG_META[activeItem.value.tag] : null))

const toast = useToast()

function handleInterest() {
  if (activeItem.value) toggleInterest(activeItem.value.id)
}
function handleBeta() {
  if (activeItem.value && !betaRequested.value) requestBeta(activeItem.value.id)
}
function fakeDownload(label: string) {
  toast.add({ title: 'Download iniciado (simulado)', description: label, icon: 'i-lucide-download' })
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="activeItem?.title"
    :description="activeItem?.summary"
  >
    <template #body>
      <div
        v-if="activeItem"
        class="space-y-5"
      >
        <!-- Tags + abas -->
        <div class="flex flex-wrap items-center gap-2">
          <span
            v-if="tag"
            class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold"
            :class="tag.className"
          >
            {{ tag.label }}
          </span>
          <span
            v-if="horizon"
            class="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-inset ring-default"
          >
            {{ horizon.title }}
          </span>
        </div>

        <div class="flex rounded-xl border border-default bg-muted p-1">
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="tab === 'commercial' ? 'bg-primary text-inverted shadow-sm' : 'text-muted hover:text-default'"
            @click="tab = 'commercial'"
          >
            <UIcon
              name="i-lucide-briefcase"
              class="h-4 w-4"
            /> Comercial
          </button>
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors"
            :class="tab === 'technical' ? 'bg-primary text-inverted shadow-sm' : 'text-muted hover:text-default'"
            @click="tab = 'technical'"
          >
            <UIcon
              name="i-lucide-code-2"
              class="h-4 w-4"
            /> Técnico
          </button>
        </div>

        <!-- Comercial -->
        <div
          v-if="tab === 'commercial'"
          class="space-y-6"
        >
          <section>
            <div class="mb-2.5 flex items-center gap-2">
              <UIcon
                name="i-lucide-trending-up"
                class="h-4 w-4 text-primary"
              />
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
                Valor de Negócio
              </h4>
            </div>
            <p class="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm font-medium leading-relaxed text-brand-900">
              {{ activeItem.commercial.headline }}
            </p>
            <p class="mt-3 text-sm leading-relaxed text-muted">
              {{ activeItem.commercial.businessValue }}
            </p>
          </section>

          <section>
            <div class="mb-2.5 flex items-center gap-2">
              <UIcon
                name="i-lucide-download"
                class="h-4 w-4 text-primary"
              />
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
                Kit de Vendas
              </h4>
            </div>
            <div class="space-y-2">
              <button
                v-for="(asset, idx) in activeItem.commercial.salesKit"
                :key="idx"
                type="button"
                class="group flex w-full items-center justify-between rounded-xl border border-default bg-default p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
                @click="fakeDownload(asset.label)"
              >
                <span class="flex items-center gap-3">
                  <span class="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
                    <UIcon
                      :name="asset.type === 'pricing' ? 'i-lucide-tag' : 'i-lucide-file-text'"
                      class="h-4 w-4"
                    />
                  </span>
                  <span>
                    <span class="block text-sm font-medium">{{ asset.label }}</span>
                    <span class="block text-[11px] text-dimmed">{{ ASSET_LABEL[asset.type] }}</span>
                  </span>
                </span>
                <UIcon
                  name="i-lucide-download"
                  class="h-4 w-4 text-dimmed transition-colors group-hover:text-brand-600"
                />
              </button>
            </div>
          </section>
        </div>

        <!-- Técnico -->
        <div
          v-else
          class="space-y-6"
        >
          <section>
            <div class="mb-2.5 flex items-center gap-2">
              <UIcon
                name="i-lucide-zap"
                class="h-4 w-4 text-primary"
              />
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
                Impacto Técnico
              </h4>
            </div>
            <p class="text-sm leading-relaxed text-muted">
              {{ activeItem.technical.impactSummary }}
            </p>
          </section>

          <section>
            <div class="mb-2.5 flex items-center gap-2">
              <UIcon
                name="i-lucide-code-2"
                class="h-4 w-4 text-primary"
              />
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
                Endpoints Envolvidos
              </h4>
            </div>
            <div class="space-y-2">
              <div
                v-for="(ep, idx) in activeItem.technical.endpoints"
                :key="idx"
                class="flex items-center gap-3 rounded-lg border border-default bg-muted px-3 py-2"
              >
                <span
                  class="inline-flex w-14 justify-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide ring-1 ring-inset"
                  :class="METHOD_COLORS[ep.method]"
                >
                  {{ ep.method }}
                </span>
                <code class="font-mono text-xs">{{ ep.path }}</code>
              </div>
            </div>
          </section>

          <section v-if="activeItem.technical.webhooks && activeItem.technical.webhooks.length">
            <div class="mb-2.5 flex items-center gap-2">
              <UIcon
                name="i-lucide-webhook"
                class="h-4 w-4 text-primary"
              />
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
                Eventos de Webhook
              </h4>
            </div>
            <div class="flex flex-wrap gap-2">
              <code
                v-for="wh in activeItem.technical.webhooks"
                :key="wh"
                class="rounded-md bg-emerald-50 px-2 py-1 font-mono text-[11px] text-emerald-700 ring-1 ring-inset ring-emerald-200"
              >{{ wh }}</code>
            </div>
          </section>

          <section v-if="activeItem.technical.samplePayload">
            <div class="mb-2.5 flex items-center gap-2">
              <UIcon
                name="i-lucide-file-text"
                class="h-4 w-4 text-primary"
              />
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
                Exemplo de Payload
              </h4>
            </div>
            <pre class="overflow-x-auto rounded-xl border border-default bg-muted p-4 font-mono text-[11px] leading-relaxed">{{ activeItem.technical.samplePayload }}</pre>
          </section>
        </div>
      </div>
    </template>

    <template #footer>
      <div
        v-if="activeItem"
        class="w-full"
      >
        <UButton
          v-if="tab === 'commercial'"
          block
          size="lg"
          :color="interested ? 'success' : 'primary'"
          :variant="interested ? 'subtle' : 'solid'"
          :icon="interested ? 'i-lucide-circle-check' : 'i-lucide-users'"
          @click="handleInterest"
        >
          {{ interested ? `Interesse registrado · ${state?.interestCount} no total` : 'Tenho um cliente interessado' }}
        </UButton>
        <UButton
          v-else
          block
          size="lg"
          :color="betaRequested ? 'success' : 'primary'"
          :variant="betaRequested ? 'subtle' : 'solid'"
          :disabled="betaRequested"
          :icon="betaRequested ? 'i-lucide-circle-check' : 'i-lucide-flask-conical'"
          @click="handleBeta"
        >
          {{ betaRequested ? 'Acesso Solicitado' : 'Participar do Beta' }}
        </UButton>
      </div>
    </template>
  </USlideover>
</template>
