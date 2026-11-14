/**
 * Navegação espacial: dado o elemento focado e uma direção, escolhe o próximo elemento
 * focável. Função pura sobre retângulos, para poder ser testada sem DOM.
 */

export type Direcao = 'cima' | 'baixo' | 'esquerda' | 'direita'

export interface Retangulo {
  x: number
  y: number
  largura: number
  altura: number
}

export interface Candidato<T> {
  item: T
  ret: Retangulo
}

/** Peso da distância perpendicular: prefere seguir "em linha" a pular na diagonal. */
const PESO_PERPENDICULAR = 3

function centro(r: Retangulo): { cx: number; cy: number } {
  return { cx: r.x + r.largura / 2, cy: r.y + r.altura / 2 }
}

/** Distância entre dois intervalos [a1, a2] e [b1, b2] (0 se se sobrepõem). */
function folga(a1: number, a2: number, b1: number, b2: number): number {
  if (b2 < a1) return a1 - b2
  if (b1 > a2) return b1 - a2
  return 0
}

export function pontuar(origem: Retangulo, alvo: Retangulo, dir: Direcao): number | null {
  const o = centro(origem)
  const a = centro(alvo)
  const horizontal = dir === 'esquerda' || dir === 'direita'
  const sinal = dir === 'direita' || dir === 'baixo' ? 1 : -1

  // O alvo precisa estar de fato do lado pedido.
  const avancoCentro = horizontal ? (a.cx - o.cx) * sinal : (a.cy - o.cy) * sinal
  if (avancoCentro <= 1) return null

  let primaria: number
  if (horizontal) {
    primaria = sinal > 0 ? alvo.x - (origem.x + origem.largura) : origem.x - (alvo.x + alvo.largura)
  } else {
    primaria = sinal > 0 ? alvo.y - (origem.y + origem.altura) : origem.y - (alvo.y + alvo.altura)
  }
  primaria = Math.max(0, primaria)

  const perpendicular = horizontal
    ? folga(origem.y, origem.y + origem.altura, alvo.y, alvo.y + alvo.altura)
    : folga(origem.x, origem.x + origem.largura, alvo.x, alvo.x + alvo.largura)
  const desalinhamento = horizontal ? Math.abs(a.cy - o.cy) : Math.abs(a.cx - o.cx)

  return primaria + perpendicular * PESO_PERPENDICULAR + desalinhamento * 0.05
}

export function proximoFoco<T>(origem: Retangulo, candidatos: readonly Candidato<T>[], dir: Direcao): T | null {
  let melhor: T | null = null
  let melhorPontos = Infinity
  for (const c of candidatos) {
    if (c.ret.largura <= 0 && c.ret.altura <= 0) continue
    const p = pontuar(origem, c.ret, dir)
    if (p !== null && p < melhorPontos) {
      melhorPontos = p
      melhor = c.item
    }
  }
  return melhor
}
