// Formatamos com `timeZone: 'UTC'` de propósito: o instante vem no fuso correto e a
// gente só quer exibi-lo literal, sem o runtime (navegador/SSR) aplicar um deslocamento
// de fuso por cima.

/** Horário da ligação (ISO) → pt-BR (dd/mm/aaaa hh:mm). */
export function fmtCallDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC'
  })
}
