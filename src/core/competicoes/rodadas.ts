import type { Rng } from '../rng'
import type { Sigla } from './tipos'

export interface Confronto {
  casa: Sigla
  visitante: Sigla
}

/**
 * Tabela de todos contra todos (método do círculo). `turnos` repete o turno invertendo o
 * mando. Com número ímpar de times, um folga por rodada. A ordem dos times é sorteada.
 */
export function todosContraTodos(times: readonly Sigla[], turnos: number, rng: Rng): Confronto[][] {
  if (times.length < 2) return []
  const lista: (Sigla | null)[] = rng.embaralhar(times)
  if (lista.length % 2 === 1) lista.push(null)
  const n = lista.length
  const fixo = lista[0]
  let roda = lista.slice(1)
  const turno: Confronto[][] = []
  for (let r = 0; r < n - 1; r++) {
    const atual = [fixo, ...roda]
    const rodada: Confronto[] = []
    for (let k = 0; k < n / 2; k++) {
      const a = atual[k]!
      const b = atual[n - 1 - k]!
      if (a === null || b === null) continue
      // Alterna o mando do time fixo por rodada e dos demais pela posição no par.
      const inverte = k === 0 ? r % 2 === 1 : k % 2 === 1
      rodada.push(inverte ? { casa: b, visitante: a } : { casa: a, visitante: b })
    }
    turno.push(rodada)
    roda = [roda[roda.length - 1]!, ...roda.slice(0, -1)]
  }
  const todas: Confronto[][] = []
  for (let t = 0; t < turnos; t++) {
    for (const rodada of turno) todas.push(t % 2 === 0 ? rodada : rodada.map((c) => ({ casa: c.visitante, visitante: c.casa })))
  }
  return todas
}

/** Quantas rodadas o todos contra todos tem, sem gerar. */
export function quantidadeRodadas(times: number, turnos: number): number {
  if (times < 2) return 0
  return (times % 2 === 0 ? times - 1 : times) * turnos
}
