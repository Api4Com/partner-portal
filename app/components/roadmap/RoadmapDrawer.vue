<script setup lang="ts">
import { HORIZONS, type PartnerProfile, whatsappUrl } from '~/lib/roadmap'

const {
  activeItem,
  activeItemId,
  closeItem,
  states,
  react
} = useRoadmap()
// [DEMO CRMs] reações/comentários só aparecem para as contas demo.
const demoEnabled = useDemoGate()

const isRadar = computed(() => activeItem.value?.horizon !== 'now')

// Contato direto com o gerente de parcerias, já mencionando o item aberto.
const escalateHref = computed(() =>
  whatsappUrl(activeItem.value ? `Olá! Queria falar sobre a ideia "${activeItem.value.title}" do roadmap.` : undefined)
)

const tab = ref<PartnerProfile>('commercial')

// Ao abrir um item, volta para a aba Comercial.
watch(activeItemId, (id) => {
  if (id) tab.value = 'commercial'
})

const open = computed({
  get: () => activeItemId.value !== null,
  set: (v: boolean) => {
    if (!v) closeItem()
  }
})

const horizon = computed(() => HORIZONS.find(h => h.id === activeItem.value?.horizon))

// Força o download (Content-Disposition: attachment) em vez de abrir inline.
function downloadUrl(url: string) {
  return url + (url.includes('?') ? '&' : '?') + 'download'
}

// [DEMO CRMs] Reações (gostei/não gostei) — só nas contas demo.
const state = computed(() => (activeItem.value ? states.value[activeItem.value.id] : undefined))
const myReaction = computed(() => state.value?.myReaction ?? null)
const likeCount = computed(() => state.value?.likeCount ?? 0)
const dislikeCount = computed(() => state.value?.dislikeCount ?? 0)
function vote(reaction: 'like' | 'dislike') {
  if (activeItem.value) react(activeItem.value.id, reaction)
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
        <!-- Horizonte -->
        <div class="flex flex-wrap items-center gap-2">
          <span
            v-if="horizon"
            class="rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
            :class="horizon.id === 'now'
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20'
              : 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20'"
          >
            {{ horizon.title }}
          </span>
          <span
            v-if="isRadar"
            class="text-[11px] font-medium text-amber-600/90 dark:text-violet-400/80"
          >
            Em avaliação · ainda não é um compromisso de entrega
          </span>
        </div>

        <!-- [DESATIVADO — será recolocado] Seletor de abas Comercial/Técnico (aba Técnico removida):
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
        -->

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
            <p
              v-if="activeItem.commercial.headline"
              class="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm font-medium leading-relaxed text-brand-900"
            >
              {{ activeItem.commercial.headline }}
            </p>
            <p
              v-if="activeItem.commercial.businessValue"
              class="mt-3 text-sm leading-relaxed text-muted"
            >
              {{ activeItem.commercial.businessValue }}
            </p>
          </section>

          <section v-if="activeItem.commercial.files.length">
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
              <a
                v-for="(f, idx) in activeItem.commercial.files"
                :key="idx"
                :href="downloadUrl(f.url)"
                :download="f.label"
                class="group flex w-full items-center justify-between rounded-xl border border-default bg-default p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <span class="flex items-center gap-3">
                  <span class="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
                    <UIcon
                      name="i-lucide-file-text"
                      class="h-4 w-4"
                    />
                  </span>
                  <span class="text-sm font-medium">{{ f.label }}</span>
                </span>
                <UIcon
                  name="i-lucide-download"
                  class="h-4 w-4 text-dimmed transition-colors group-hover:text-brand-600"
                />
              </a>
            </div>
          </section>
        </div>

        <!-- [DESATIVADO — será recolocado] Conteúdo da aba Técnico:
        <div
          v-else
          class="space-y-6"
        >
          <section v-if="activeItem.technical.impactSummary">
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

          <section v-if="activeItem.technical.files.length">
            <div class="mb-2.5 flex items-center gap-2">
              <UIcon
                name="i-lucide-file-code-2"
                class="h-4 w-4 text-primary"
              />
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted">
                Documentação Técnica
              </h4>
            </div>
            <div class="space-y-2">
              <a
                v-for="(f, idx) in activeItem.technical.files"
                :key="idx"
                :href="downloadUrl(f.url)"
                :download="f.label"
                class="group flex w-full items-center justify-between rounded-xl border border-default bg-default p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
              >
                <span class="flex items-center gap-3">
                  <span class="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
                    <UIcon
                      name="i-lucide-paperclip"
                      class="h-4 w-4"
                    />
                  </span>
                  <span class="text-sm font-medium">{{ f.label }}</span>
                </span>
                <UIcon
                  name="i-lucide-download"
                  class="h-4 w-4 text-dimmed transition-colors group-hover:text-brand-600"
                />
              </a>
            </div>
          </section>
        </div>
        -->

        <!-- Escalonamento de prioridade (só radar): baixo destaque, contextual -->
        <div
          v-if="isRadar"
          class="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 dark:border-violet-400/25 dark:bg-violet-400/5"
        >
          <p class="text-sm font-medium text-amber-900 dark:text-violet-200">
            Você ou seus clientes precisam muito disso?
          </p>
          <p class="mt-0.5 text-xs leading-relaxed text-amber-800/80 dark:text-violet-200/70">
            Nos conte o contexto. Demanda real de clientes é o que mais pesa quando decidimos o que priorizar.
          </p>
          <a
            :href="escalateHref"
            target="_blank"
            rel="noopener"
            class="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 underline-offset-2 hover:text-amber-800 hover:underline dark:text-violet-300 dark:hover:text-violet-200"
          >
            <UIcon
              name="i-lucide-message-circle"
              class="h-3.5 w-3.5"
            />
            Fale com a gente sobre esta ideia
            <UIcon
              name="i-lucide-arrow-right"
              class="h-3.5 w-3.5"
            />
          </a>
        </div>

        <!-- [DEMO CRMs] Comentários (só contas demo, sempre visível). -->
        <div
          v-if="demoEnabled"
          class="border-t border-default pt-5"
        >
          <RoadmapComments :item-id="activeItem.id" />
        </div>
      </div>
    </template>

    <!-- [DEMO CRMs] Rodapé com Gostei / Não gostei — só nas contas demo. -->
    <template
      v-if="demoEnabled"
      #footer
    >
      <div
        v-if="activeItem"
        class="flex w-full gap-2"
      >
        <UButton
          block
          size="lg"
          class="flex-1"
          :color="myReaction === 'like' ? 'success' : 'neutral'"
          :variant="myReaction === 'like' ? 'solid' : 'subtle'"
          icon="i-lucide-thumbs-up"
          @click="vote('like')"
        >
          Gostei · {{ likeCount }}
        </UButton>
        <UButton
          block
          size="lg"
          class="flex-1"
          :color="myReaction === 'dislike' ? 'error' : 'neutral'"
          :variant="myReaction === 'dislike' ? 'solid' : 'subtle'"
          icon="i-lucide-thumbs-down"
          @click="vote('dislike')"
        >
          Não gostei · {{ dislikeCount }}
        </UButton>
      </div>
    </template>
  </USlideover>
</template>
