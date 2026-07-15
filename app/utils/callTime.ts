// A API de telefonia entrega o horário da ligação 3h ATRÁS do valor que deve ser
// exibido (ex.: chega 06:00, o correto na tela é 09:00). Não é fuso: é um deslocamento
// fixo do dado. Somamos 3h no próprio instante — assim a virada de meia-noite avança
// a data automaticamente (23:30 → 02:30 do dia seguinte).
//
// Formatamos com `timeZone: 'UTC'` de propósito: isso NÃO é conversão de fuso, é só
// para o +3 que acabamos de somar aparecer literal, sem o runtime (navegador/SSR)
// aplicar um segundo deslocamento por cima.
const CALL_DISPLAY_OFFSET_MS = 3 * 60 * 60 * 1000

/** Horário da ligação (ISO) → pt-BR (dd/mm/aaaa hh:mm), já com o +3h da API aplicado. */
export function fmtCallDateTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return iso
  return new Date(t + CALL_DISPLAY_OFFSET_MS).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC'
  })
}
