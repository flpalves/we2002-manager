/** Utilidades de cor da interface (contraste WCAG para o texto sobre a cor do clube). */

export function hexParaRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace(/^#/, '')
  const completo = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(completo)) throw new Error(`Cor inválida: ${hex}`)
  return [0, 2, 4].map((i) => parseInt(completo.slice(i, i + 2), 16)) as [number, number, number]
}

function luminancia(hex: string): number {
  const [r, g, b] = hexParaRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contraste(a: string, b: string): number {
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Texto sobre a cor do clube: branco se der 4.5:1, senão quase preto. */
export function corSobreClube(clube: string): '#ffffff' | '#111111' {
  return contraste(clube, '#ffffff') >= 4.5 ? '#ffffff' : '#111111'
}
