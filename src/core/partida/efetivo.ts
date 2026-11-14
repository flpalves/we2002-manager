import type { Regras } from '../config/padroes'
import type { Atributos, Posicao } from '@shared/esquemas/pacote'
import { SETOR, type Setor } from './formacoes'
import type { JogadorPartida } from './tipos'

/** Atributo efetivo e notas por setor/papel (04-motor-partida, "Força por setor"). */

export function fatorPosicao(j: Pick<JogadorPartida, 'posicao' | 'posicaoSecundaria'>, papel: Posicao, regras: Regras): number {
  const f = regras.motor.fator_posicao
  if (j.posicao === papel) return f.natural
  if (j.posicaoSecundaria === papel) return f.secundaria
  // Goleiro na linha ou jogador de linha no gol.
  if (papel === 'GK' || j.posicao === 'GK') return f.goleiro_fora
  if (SETOR[j.posicao] === SETOR[papel]) return f.mesmo_setor
  return f.fora
}

export function fatorCondicao(condicao: number, regras: Regras): number {
  const m = regras.motor
  if (condicao >= m.condicao_limite) return 1
  return 1 - m.condicao_reducao_max * ((m.condicao_limite - Math.max(0, condicao)) / m.condicao_limite)
}

export function fatorMoral(moral: number, regras: Regras): number {
  return 1 + regras.motor.moral_amplitude * ((moral - 50) / 50)
}

/** Média ponderada dos atributos de um setor (escala 1-20). */
export function notaSetor(a: Atributos, setor: Setor, regras: Regras): number {
  const pesos = regras.motor.pesos_setor[setor]
  let soma = 0
  let total = 0
  for (const [attr, p] of Object.entries(pesos)) {
    soma += (a[attr as keyof Atributos] ?? 0) * p
    total += p
  }
  return total > 0 ? soma / total : 0
}

/** Nota do jogador num papel, sem condição e moral (qualidade "de ficha" na vaga). */
export function notaBasePapel(j: Pick<JogadorPartida, 'posicao' | 'posicaoSecundaria' | 'atributos'>, papel: Posicao, regras: Regras): number {
  const contrib = regras.motor.contribuicao[papel] ?? {}
  let soma = 0
  let total = 0
  for (const [setor, c] of Object.entries(contrib) as [Setor, number][]) {
    soma += c * notaSetor(j.atributos, setor, regras)
    total += c
  }
  return (total > 0 ? soma / total : 0) * fatorPosicao(j, papel, regras)
}

/** Nota usada pela IA de técnico antes do jogo: inclui condição e moral. */
export function notaPapel(j: JogadorPartida, papel: Posicao, regras: Regras): number {
  return notaBasePapel(j, papel, regras) * fatorCondicao(j.condicao, regras) * fatorMoral(j.moral, regras)
}
