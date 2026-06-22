<script setup lang="ts">
import { CONTA_PRINCIPAL, fmt } from '~/lib/contas'

interface Message { id: number, role: 'user' | 'agent', content: string }
interface Suggestion { icon: string, label: string, prompt: string }

const { all } = useSubcontas()

const CLIENTES = computed(() => all.value.length)
const USUARIOS = computed(() => all.value.reduce((s, x) => s + x.users, 0))
const MINUTOS = computed(() => all.value.reduce((s, x) => s + x.minutes, 0))
const ATIVAS = computed(() => all.value.filter(s => s.status === 'ativo').length)
const INATIVAS = computed(() => CLIENTES.value - ATIVAS.value)
const TOP_CLIENTE = computed(() => all.value.reduce((a, b) => (b.minutes > a.minutes ? b : a)))

const SUGGESTIONS: Suggestion[] = [
  { icon: 'i-lucide-activity', label: 'O que está acontecendo com meus clientes?', prompt: 'O que está acontecendo com meus clientes?' },
  { icon: 'i-lucide-users', label: 'Quem são meus clientes?', prompt: 'Quem são meus clientes?' },
  { icon: 'i-lucide-phone-call', label: 'Quanto eles estão ligando?', prompt: 'Quanto meus clientes estão ligando?' },
  { icon: 'i-lucide-gauge', label: 'Mediana de paciência do cliente', prompt: 'Qual a mediana de paciência dos meus clientes?' },
  { icon: 'i-lucide-user-plus', label: 'Criar uma conta vinculada', prompt: 'Quero criar uma conta vinculada à minha conta' },
  { icon: 'i-lucide-phone', label: 'Disparar uma chamada', prompt: 'Dispare uma chamada de teste' }
]

/** Resposta simulada (mock) por palavra-chave, ancorada nos dados. Sem IA/MCP real. */
function respondTo(text: string): string {
  const t = text.toLowerCase()
  const has = (...keys: string[]) => keys.some(k => t.includes(k))

  // Ações
  if (has('encerrar', 'encerre', 'desligar', 'finalizar chamada', 'finalizar a chamada')) {
    return 'Encerrei a chamada em andamento no ramal padrão.\n\nDuração: 02:14 · status: completada (simulado). A gravação já fica disponível no CDR do cliente.'
  }
  if (has('disparar', 'dispare', 'discar', 'disque', 'fazer uma chamada', 'faça uma chamada', 'ligue para', 'ligar para', 'chamada de teste')) {
    return 'Iniciei uma chamada de teste para +55 11 98765-4321 pelo ramal padrão.\n\nStatus: tocando… (simulado). Posso encerrar quando quiser — é só pedir “encerrar chamada”.'
  }
  if (has('conta vinculada', 'vincular conta', 'vincular uma conta', 'nova conta', 'criar conta', 'criar uma conta')) {
    return 'Bora criar uma conta vinculada à sua (simulado).\n\nMe diga:\n• Nome do cliente\n• E-mail do administrador\n\nEu provisiono a subconta com saldo próprio e disparo o convite de acesso ao painel.'
  }
  if (has('editar usuário', 'editar usuario', 'alterar usuário', 'alterar usuario', 'atualizar usuário', 'editar ramal')) {
    return 'Posso editar um usuário (simulado).\n\nMe passe o cliente e o ramal/usuário, e o que muda: nome, e-mail, permissões ou status (ativar/desativar).'
  }
  if (has('criar usuário', 'criar usuario', 'novo usuário', 'novo usuario', 'adicionar usuário', 'criar ramal', 'novo ramal')) {
    return 'Posso criar um usuário/ramal (simulado).\n\nEm qual cliente, e com qual nome e e-mail? Já deixo o webphone habilitado e envio o convite de acesso.'
  }

  // Informações
  if (has('paciência', 'paciencia', 'mediana', 'espera na fila', 'tempo de espera', 'abandono')) {
    return 'Mediana de paciência (simulado):\n• Cliente final: 27s na fila antes de desistir\n• Atendimento dos usuários: resposta em 12s na mediana\n• Taxa de abandono: 8%\n\nMaior abandono hoje: Mundo Pet Express — vale revisar a régua de atendimento.'
  }
  if (has('acontecendo', 'panorama', 'resumo geral', 'visão geral', 'visao geral', 'como estão meus clientes', 'como estao meus clientes')) {
    return `Panorama da sua base (${CONTA_PRINCIPAL.name}):\n• ${CLIENTES.value} clientes — ${ATIVAS.value} ligando, ${INATIVAS.value} sem atividade há +30 dias\n• ${USUARIOS.value} usuários ativos no total\n• ${fmt(MINUTOS.value)} minutos no mês corrente\n• Destaque: ${TOP_CLIENTE.value.name} concentra ${fmt(TOP_CLIENTE.value.minutes)} min\n\nQuer que eu abra o detalhe de algum cliente?`
  }
  if (has('ligando', 'quanto liga', 'estão ligando', 'estao ligando', 'atividade', 'volume de chamada')) {
    return `Atividade de chamadas (simulado):\n• ${ATIVAS.value} de ${CLIENTES.value} clientes estão ligando ativamente\n• ${INATIVAS.value} sem chamadas há +30 dias\n• ${fmt(MINUTOS.value)} minutos no mês\n• Mais ativo: ${TOP_CLIENTE.value.name} (${fmt(TOP_CLIENTE.value.minutes)} min)`
  }
  if (has('quem são', 'quem sao', 'quais clientes', 'quais são os clientes', 'listar clientes')) {
    const nomes = all.value.map(s => `• ${s.name} — ${s.users} usuários`).join('\n')
    return `Seus ${CLIENTES.value} clientes:\n${nomes}\n\nÉ só pedir o detalhe de qualquer um para ver consumo, ramais e gravações.`
  }
  if (has('quantos clientes', 'número de clientes', 'numero de clientes', 'total de clientes')) {
    return `Você tem ${CLIENTES.value} clientes vinculados à sua conta (${ATIVAS.value} ativos, ${INATIVAS.value} sem atividade recente).`
  }
  if (has('quantos usuários', 'quantos usuarios', 'total de usuários', 'total de usuarios', 'número de usuários')) {
    const top = [...all.value].sort((a, b) => b.users - a.users).slice(0, 3).map(s => `• ${s.name} — ${s.users}`).join('\n')
    return `Somando todos os clientes, são ${USUARIOS.value} usuários ativos. Maiores:\n${top}`
  }
  if (has('saldo', 'consumo', 'gasto', 'minuto', 'fatur')) {
    return `Consumo consolidado:\n• ${CLIENTES.value} clientes, ${USUARIOS.value} usuários\n• ${fmt(MINUTOS.value)} minutos no mês\n\nNo modelo individual, cada cliente tem saldo próprio e compra direto da API4COM — eu acompanho o consumo de forma read-only.`
  }
  if (has('relatório', 'relatorio', 'report', 'desempenho')) {
    return 'Relatório de chamadas de hoje (simulado):\n• 312 chamadas — 87% atendidas\n• TMA 3m42s\n• 41 falhas (busy/no-answer)\n\nPosso detalhar por cliente quando a integração estiver ativa.'
  }
  if (has('gravação', 'gravacao', 'áudio', 'audio', 'transcri', 'sentimento')) {
    return 'Analisei a última gravação (simulado):\n• Duração 4m12s · sentimento positivo\n• Resumo: cliente pediu 2ª via de boleto; resolvido na ligação.\n\nCom a integração ativa, trago transcrição completa e nota de qualidade.'
  }

  return 'Posso te ajudar a entender e operar sua base de clientes na API4COM. Por exemplo:\n• O que está acontecendo com seus clientes (clientes, usuários, atividade)\n• Mediana de paciência e qualidade do atendimento\n• Criar conta vinculada, criar ou editar usuários\n• Disparar ou encerrar chamadas\n\nÉ só pedir — nesta versão as respostas são simuladas.'
}

const messages = ref<Message[]>([])
const input = ref('')
const typing = ref(false)
const nextId = ref(1)
const endRef = ref<HTMLElement | null>(null)
let replyTimer: ReturnType<typeof setTimeout> | undefined

const empty = computed(() => messages.value.length === 0)

watch([messages, typing], async () => {
  await nextTick()
  endRef.value?.scrollIntoView({ behavior: 'smooth' })
}, { deep: true })

function send(text: string) {
  const content = text.trim()
  if (!content || typing.value) return
  messages.value.push({ id: nextId.value++, role: 'user', content })
  input.value = ''
  typing.value = true
  replyTimer = setTimeout(() => {
    messages.value.push({ id: nextId.value++, role: 'agent', content: respondTo(content) })
    typing.value = false
  }, 750)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send(input.value)
  }
}

onBeforeUnmount(() => clearTimeout(replyTimer))
</script>

<template>
  <PortalTopbar title="Agente API4COM">
    <template #right>
      <UBadge color="primary" variant="subtle">Beta</UBadge>
    </template>
  </PortalTopbar>

  <div class="flex min-h-0 flex-1 flex-col">
    <!-- Conversa / estado vazio -->
    <div class="flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-3xl px-6 py-7">
        <!-- Estado vazio -->
        <div v-if="empty" class="flex flex-col items-center pt-8 text-center">
          <div class="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-900/25">
            <UIcon name="i-lucide-sparkles" class="h-7 w-7" />
          </div>
          <h1 class="mt-4 text-2xl font-bold tracking-tight">Olá, {{ CONTA_PRINCIPAL.name }} 👋</h1>
          <p class="mt-2 max-w-md text-sm leading-relaxed text-muted">
            Sou o <strong class="text-default">Agente API4COM</strong>. Peça informações ou execute ações
            da sua operação em linguagem natural — chamadas, saldo, relatórios, ramais e gravações.
          </p>

          <div class="mt-7 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              v-for="s in SUGGESTIONS"
              :key="s.label"
              type="button"
              class="flex items-center gap-3 rounded-xl border border-default bg-default px-3.5 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/50"
              @click="send(s.prompt)"
            >
              <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <UIcon :name="s.icon" class="h-[17px] w-[17px]" />
              </span>
              <span class="text-[13px] font-medium">{{ s.label }}</span>
            </button>
          </div>
        </div>

        <!-- Mensagens -->
        <div v-else class="flex flex-col gap-4">
          <div v-for="m in messages" :key="m.id">
            <div v-if="m.role === 'user'" class="flex justify-end">
              <div class="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-inverted">
                {{ m.content }}
              </div>
            </div>
            <div v-else class="flex items-start gap-2.5">
              <div class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
                <UIcon name="i-lucide-sparkles" class="h-4 w-4" />
              </div>
              <div class="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-md border border-default bg-default px-4 py-2.5 text-sm leading-relaxed shadow-sm">
                {{ m.content }}
              </div>
            </div>
          </div>

          <!-- Digitando -->
          <div v-if="typing" class="flex items-start gap-2.5">
            <div class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
              <UIcon name="i-lucide-sparkles" class="h-4 w-4" />
            </div>
            <div class="flex items-center gap-1 rounded-2xl rounded-tl-md border border-default bg-default px-4 py-3.5 shadow-sm">
              <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style="animation-delay:0ms" />
              <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style="animation-delay:150ms" />
              <span class="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style="animation-delay:300ms" />
            </div>
          </div>

          <div ref="endRef" />
        </div>
      </div>
    </div>

    <!-- Composer -->
    <div class="shrink-0 border-t border-default bg-default/85 backdrop-blur">
      <div class="mx-auto w-full max-w-3xl px-6 py-4">
        <div class="flex items-end gap-2 rounded-2xl border border-default bg-default px-3 py-2 shadow-sm focus-within:border-brand-400">
          <textarea
            v-model="input"
            rows="1"
            placeholder="Peça uma ação ou informação…"
            class="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-dimmed"
            @keydown="onKeydown"
          />
          <UButton
            icon="i-lucide-send"
            :disabled="!input.trim() || typing"
            aria-label="Enviar"
            @click="send(input)"
          />
        </div>
        <p class="mt-2 text-center text-[11px] text-dimmed">
          Beta · respostas simuladas — a integração real com a plataforma vem a seguir.
        </p>
      </div>
    </div>
  </div>
</template>
