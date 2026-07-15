/**
 * Normaliza texto para BUSCA: sem acento e sem caixa.
 *
 * A busca tem que ser simétrica nos dois sentidos — quem digita "te" precisa achar
 * "Tétheu", e quem digita "tétheu" precisa achar "tetheu". Isso só funciona se o
 * MESMO normalizador for aplicado no termo buscado E no campo comparado.
 *
 * `NFD` decompõe "é" em "e" + acento combinante; o range ̀-ͯ (Combining
 * Diacritical Marks) remove o acento e sobra o "e" puro. `ç` → `c` pelo mesmo caminho.
 */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** `haystack` contém `needle`, ignorando acento e caixa. `needle` já normalizado. */
export function matchesSearch(haystack: string, normalizedNeedle: string): boolean {
  return normalizeSearch(haystack).includes(normalizedNeedle)
}
