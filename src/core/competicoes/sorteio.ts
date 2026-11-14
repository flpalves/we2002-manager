import type { Rng } from '../rng'
import type { Sigla } from './tipos'

/**
 * Sorteio dos grupos. Com potes: o ranking (melhor → pior) é cortado em `tamanho` potes de
 * `quantidade` times e cada grupo recebe um time de cada pote. Evita dois times do mesmo
 * país no grupo quando dá (busca com retrocesso); se não der, aceita.
 */
export function sortearGrupos(
  ranking: readonly Sigla[],
  quantidade: number,
  tamanho: number,
  modo: 'potes' | 'livre',
  rng: Rng,
  paisDe: (t: Sigla) => string = () => '',
): Sigla[][] {
  if (ranking.length !== quantidade * tamanho) {
    throw new Error(`Sorteio de ${quantidade} grupos de ${tamanho} precisa de ${quantidade * tamanho} times (tem ${ranking.length})`)
  }
  const potes: Sigla[][] =
    modo === 'potes'
      ? Array.from({ length: tamanho }, (_, k) => rng.embaralhar(ranking.slice(k * quantidade, (k + 1) * quantidade)))
      : chunk(rng.embaralhar(ranking), quantidade)

  const grupos: Sigla[][] = Array.from({ length: quantidade }, () => [])
  const conflito = (g: Sigla[], t: Sigla) => paisDe(t) !== '' && g.some((x) => paisDe(x) === paisDe(t))

  // Para cada pote, distribui um time por grupo; tenta sem conflito de país primeiro.
  for (const pote of potes) {
    const distribuicao = distribuir(pote, grupos, conflito) ?? pote.map((t, i) => [i, t] as const)
    for (const [g, t] of distribuicao) grupos[g]!.push(t)
  }
  return grupos
}

function chunk<T>(lista: readonly T[], partes: number): T[][] {
  const tam = lista.length / partes
  return Array.from({ length: tam }, (_, k) => lista.slice(k * partes, (k + 1) * partes))
}

/** Atribui cada time do pote a um grupo distinto sem conflito; `null` se impossível. */
function distribuir(pote: Sigla[], grupos: Sigla[][], conflito: (g: Sigla[], t: Sigla) => boolean): (readonly [number, Sigla])[] | null {
  const usado = new Array(grupos.length).fill(false)
  const saida: [number, Sigla][] = []
  const tentar = (i: number): boolean => {
    if (i === pote.length) return true
    const t = pote[i]!
    for (let g = 0; g < grupos.length; g++) {
      if (usado[g] || conflito(grupos[g]!, t)) continue
      usado[g] = true
      saida.push([g, t])
      if (tentar(i + 1)) return true
      saida.pop()
      usado[g] = false
    }
    return false
  }
  return tentar(0) ? saida : null
}

/**
 * Sorteio dos estrangeiros de cada temporada: `vagas[pais]` times do pool daquele país.
 * O resultado segue a ordem dos países em `vagas`.
 */
export function sortearEstrangeiros(pool: Readonly<Record<string, readonly Sigla[]>>, vagas: Readonly<Record<string, number>>, rng: Rng): Sigla[] {
  const saida: Sigla[] = []
  for (const [pais, n] of Object.entries(vagas)) {
    const disponiveis = pool[pais] ?? []
    if (disponiveis.length < n) throw new Error(`${pais}: ${n} vaga(s) e só ${disponiveis.length} time(s) no pool`)
    saida.push(...rng.embaralhar(disponiveis).slice(0, n))
  }
  return saida
}
