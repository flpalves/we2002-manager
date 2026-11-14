import type { Regras } from '../config/padroes'
import type { Atributos } from '@shared/esquemas/pacote'
import { geral } from './conversao'

/** Quantos jogadores entram na conta da força do elenco (titulares + reservas imediatos). */
export const JOGADORES_NA_FORCA = 16

/**
 * Força do elenco (escala 1-20): média do geral dos melhores. Usada para o ranking dos
 * potes/mando quando ainda não há campanha, e pelo simulador provisório.
 */
export function forcaDoElenco(jogadores: readonly { atributos: Atributos; posicao: string }[], regras: Regras): number {
  if (jogadores.length === 0) return 1
  const gerais = jogadores.map((j) => geral(j.atributos, j.posicao, regras)).sort((a, b) => b - a)
  const melhores = gerais.slice(0, JOGADORES_NA_FORCA)
  return melhores.reduce((a, b) => a + b, 0) / melhores.length
}
