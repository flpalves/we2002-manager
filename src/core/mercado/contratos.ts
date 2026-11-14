import type { Regras } from '../config/padroes'
import type { Rng } from '../rng'
import { importanciaNoTime } from './valor'

/** Contratos que terminam na virada (03-competicoes, item 3). */

export interface ContratoAcabando {
  id: string
  idade: number
  geral: number
}

/**
 * A CPU renova ou libera quem tem contrato acabando: titulares quase sempre ficam,
 * encostados quase sempre saem; veteranos têm a chance reduzida.
 * @param geraisDoTime gerais de todo o elenco (para saber o lugar do jogador)
 */
export function cpuRenova(j: ContratoAcabando, geraisDoTime: readonly number[], regras: Regras, rng: Rng): boolean {
  const v = regras.virada
  let chance = v.renovacao_cpu[importanciaNoTime(j.geral, geraisDoTime, regras)]
  if (j.idade >= v.idade_veterano) chance *= v.fator_veterano
  return rng.chance(chance)
}
