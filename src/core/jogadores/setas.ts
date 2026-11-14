import type { Regras } from '../config/padroes'
import { paraNivelWe } from './conversao'

/** Setas de condição do WE e redução de atributos por condição baixa (spec 05). */

export type Seta = 'otima' | 'boa' | 'normal' | 'ruim' | 'pessima'

export function pontuacaoSeta(condicao: number, moral: number, regras: Regras): number {
  const p = regras.setas.peso_condicao
  return p * condicao + (1 - p) * moral
}

export function seta(condicao: number, moral: number, regras: Regras): Seta {
  const s = regras.setas
  const pts = pontuacaoSeta(condicao, moral, regras)
  if (pts >= s.otima) return 'otima'
  if (pts >= s.boa) return 'boa'
  if (pts >= s.normal) return 'normal'
  if (pts >= s.ruim) return 'ruim'
  return 'pessima'
}

/** Quantos níveis do WE a condição tira de todos os atributos injetados. */
export function reducaoPorCondicao(condicao: number, regras: Regras): number {
  return regras.setas.reducao_we.find((r) => condicao < r.abaixo_de)?.niveis ?? 0
}

/** Atributo 1-20 → nível do WE (0-7) já com a redução por condição, sem passar de 0. */
export function nivelWeNaPartida(valor: number, condicao: number, regras: Regras): number {
  return Math.max(0, paraNivelWe(valor, regras.jogadores.conversao_we) - reducaoPorCondicao(condicao, regras))
}
