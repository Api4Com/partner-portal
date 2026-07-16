<script setup lang="ts">
import type { Conteudo } from '~/lib/conteudos'
import { TIPO_META } from '~/lib/conteudos'

const props = defineProps<{ conteudo: Conteudo, featured?: boolean }>()

const meta = computed(() => TIPO_META[props.conteudo.tipo])
const authorsLabel = computed(() => (props.conteudo.authors ?? []).join(' · '))
</script>

<template>
  <a
    v-if="featured"
    :href="conteudo.url"
    target="_blank"
    rel="noopener"
    class="group flex flex-col overflow-hidden rounded-2xl border border-default bg-default shadow-sm transition-all duration-200 hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:flex-row"
  >
    <!-- Capa: sem imagem do estudo → painel de marca com ícone do tipo.
         Gradiente via style inline (as CSS vars da paleta) pra não depender das
         utilities de gradient do Tailwind v4. -->
    <div
      class="relative flex shrink-0 flex-col items-center justify-center gap-3 overflow-hidden px-6 py-7 text-center sm:w-48"
      style="background-image: linear-gradient(145deg, var(--color-brand-600) 0%, var(--color-brand-900) 100%)"
    >
      <!-- brilhos decorativos pra dar profundidade -->
      <div class="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
      <div class="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-brand-400/25 blur-2xl" />

      <div class="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-inset ring-white/20 backdrop-blur">
        <UIcon
          :name="meta.icon"
          class="h-7 w-7 text-white"
        />
      </div>
      <div class="relative">
        <p class="text-sm font-semibold text-white">
          {{ conteudo.format ?? meta.label }}
        </p>
        <p class="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
          API4COM
        </p>
      </div>
    </div>

    <div class="flex flex-1 flex-col p-5 sm:p-6">
      <div class="mb-2 flex flex-wrap items-center gap-1.5">
        <UBadge
          :color="meta.color"
          variant="subtle"
          size="sm"
        >
          {{ meta.label }}
        </UBadge>
        <UBadge
          v-for="tag in conteudo.tags"
          :key="tag"
          color="neutral"
          variant="soft"
          size="sm"
        >
          {{ tag }}
        </UBadge>
      </div>

      <h3 class="text-lg font-bold tracking-tight sm:text-xl">
        {{ conteudo.title }}
      </h3>
      <p class="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">
        {{ conteudo.description }}
      </p>

      <div
        v-if="conteudo.stats?.length"
        class="mt-4 border-t border-default pt-4"
      >
        <p
          v-if="conteudo.statsCaption"
          class="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-dimmed"
        >
          {{ conteudo.statsCaption }}
        </p>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div
            v-for="stat in conteudo.stats"
            :key="stat.label"
          >
            <dt class="text-base font-bold text-primary sm:text-lg">
              {{ stat.value }}
            </dt>
            <dd class="mt-0.5 text-[11px] leading-snug text-dimmed">
              {{ stat.label }}
            </dd>
          </div>
        </dl>
      </div>

      <div class="mt-4 flex items-center">
        <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          Ler o estudo
          <UIcon
            name="i-lucide-arrow-up-right"
            class="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </span>
      </div>
    </div>
  </a>

  <!-- Card compacto (grade) -->
  <a
    v-else
    :href="conteudo.url"
    target="_blank"
    rel="noopener"
    class="group flex h-full flex-col rounded-2xl border border-default bg-default p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
  >
    <div class="mb-3 flex items-start justify-between gap-2">
      <UBadge
        :color="meta.color"
        variant="subtle"
        size="sm"
      >
        {{ meta.label }}
      </UBadge>
      <UIcon
        name="i-lucide-arrow-up-right"
        class="h-4 w-4 shrink-0 text-dimmed transition-colors group-hover:text-brand-500"
      />
    </div>

    <h3 class="text-base font-semibold leading-snug">
      {{ conteudo.title }}
    </h3>
    <p class="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted">
      {{ conteudo.description }}
    </p>

    <div class="mt-auto flex items-center justify-between gap-2 pt-4">
      <span
        v-if="authorsLabel"
        class="truncate text-xs text-dimmed"
      >
        {{ authorsLabel }}
      </span>
      <span class="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
        Ler <UIcon
          name="i-lucide-arrow-up-right"
          class="h-3.5 w-3.5"
        />
      </span>
    </div>
  </a>
</template>
