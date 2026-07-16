/**
 * [DEMO CRMs] Interações do roadmap para as contas demo — TEMPORÁRIO (remover com `app/lib/demo/`).
 *
 * Os ITENS do roadmap continuam vindo do Supabase (fonte real, como em qualquer conta).
 * O que muda para as 3 contas demo: as INTERAÇÕES (curtir / comentar / solicitar demanda)
 * NÃO vão pro Supabase — são persistidas em localStorage, por conta (chaveado por e-mail),
 * e sobrepostas por cima dos itens carregados do Supabase. Fora das contas demo, nada disto
 * roda: o roadmap segue lendo e gravando no Supabase normalmente.
 */
import type { CommentMap, ItemStateMap, Reaction, RoadmapComment } from '~/lib/roadmap'

/* ------------------------------------------------------- localStorage */

const PREFIX = 'portal:demo-roadmap'
const canStore = () => typeof window !== 'undefined' && !!window.localStorage

function read<T>(key: string, fallback: T): T {
  if (!canStore()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown): void {
  if (!canStore()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota/serialização — silencioso (é demo). */
  }
}

const reactionsKey = (email: string) => `${PREFIX}:${email.toLowerCase()}:reactions`
const commentsKey = (email: string) => `${PREFIX}:${email.toLowerCase()}:comments`
const requestsKey = (email: string) => `${PREFIX}:${email.toLowerCase()}:requests`

export type DemoReactions = Record<string, Reaction>
export interface DemoRequest { id: string, title: string, description: string, createdAt: string }

export function loadReactions(email: string): DemoReactions {
  return read<DemoReactions>(reactionsKey(email), {})
}
export function saveReaction(email: string, itemId: string, reaction: Reaction | null): void {
  const all = loadReactions(email)
  if (reaction === null) delete all[itemId]
  else all[itemId] = reaction
  write(reactionsKey(email), all)
}

export function loadComments(email: string): CommentMap {
  return read<CommentMap>(commentsKey(email), {})
}
export function saveComments(email: string, map: CommentMap): void {
  write(commentsKey(email), map)
}

export function loadRequests(email: string): DemoRequest[] {
  return read<DemoRequest[]>(requestsKey(email), [])
}
export function addRequest(email: string, title: string, description: string): DemoRequest {
  const list = loadRequests(email)
  const req: DemoRequest = {
    id: `req-${Date.now()}`,
    title,
    description,
    createdAt: new Date().toISOString(),
  }
  write(requestsKey(email), [req, ...list])
  return req
}

/* --------------------------------------------------- overlay nas contas demo */

/**
 * Sobrepõe as interações locais (localStorage) por cima do que veio do Supabase:
 * - a REAÇÃO do usuário demo (que nunca foi ao Supabase) entra como `myReaction`
 *   e soma +1 na contagem-base correspondente (otimista);
 * - os COMENTÁRIOS do usuário demo vêm inteiros do localStorage.
 * As contagens-base (likeCount/dislikeCount) continuam sendo as do Supabase.
 */
export function overlayDemoInteractions(
  email: string,
  states: ItemStateMap,
  _comments: CommentMap,
): { states: ItemStateMap, comments: CommentMap } {
  const myReactions = loadReactions(email)
  const nextStates: ItemStateMap = {}
  for (const [itemId, base] of Object.entries(states)) {
    const mine = myReactions[itemId] ?? null
    nextStates[itemId] = {
      likeCount: base.likeCount + (mine === 'like' ? 1 : 0),
      dislikeCount: base.dislikeCount + (mine === 'dislike' ? 1 : 0),
      myReaction: mine,
    }
  }
  return { states: nextStates, comments: loadComments(email) }
}

/** Novo comentário local (id + timestamps), no formato do roadmap. */
export function makeComment(itemId: string, body: string): RoadmapComment {
  const now = new Date().toISOString()
  return { id: `c-${Date.now()}`, itemId, body, createdAt: now, updatedAt: now }
}
