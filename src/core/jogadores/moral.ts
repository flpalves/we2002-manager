import type { Regras } from '../config/padroes'

/** Moral 0-100 (spec 05). Tempo de jogo não afeta a moral na v1. */

const limitar = (v: number) => Math.max(0, Math.min(100, v))

export type ResultadoTime = 'V' | 'E' | 'D'

export interface DesempenhoPartida {
  resultado: ResultadoTime
  gols: number
  assistencias: number
  /** Clássico ou final: o efeito do resultado dobra. */
  jogoGrande: boolean
}

/** Moral depois de uma partida do time (vale para todo o elenco; gols e assistências para quem fez). */
export function moralAposPartida(moral: number, d: DesempenhoPartida, regras: Regras): number {
  const m = regras.moral
  const base = d.resultado === 'V' ? m.vitoria : d.resultado === 'E' ? m.empate : m.derrota
  const efeito = base * (d.jogoGrande ? m.fator_jogo_grande : 1) + d.gols * m.gol + d.assistencias * m.assistencia
  return limitar(moral + efeito)
}

/** Uma semana sem nada: volta para o padrão devagar. */
export function moralSemanal(moral: number, regras: Regras): number {
  const { padrao, retorno_semanal } = regras.moral
  if (moral > padrao) return Math.max(padrao, moral - retorno_semanal)
  if (moral < padrao) return Math.min(padrao, moral + retorno_semanal)
  return moral
}

/** Efeito direto (contrato, notícia): soma e limita a 0-100. */
export function ajustarMoral(moral: number, delta: number): number {
  return limitar(moral + delta)
}
