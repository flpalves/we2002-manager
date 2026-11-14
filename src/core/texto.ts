/** Utilidades de texto do domínio (nomes para o WE, identificadores). */

/** Tira acentos e tudo que não é ASCII imprimível. */
export function paraAscii(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '')
}

export function ehAsciiImprimivel(texto: string): boolean {
  return /^[\x20-\x7e]*$/.test(texto)
}

/** "Léo Ortiz" → "leo-ortiz". */
export function slug(texto: string): string {
  return paraAscii(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
