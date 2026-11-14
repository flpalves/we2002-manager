import type { Regras } from '../config/padroes'
import { ATRIBUTOS, type Atributos } from '@shared/esquemas/pacote'

/** Diferença entre o nível bruto do WE (0-7) e o número exibido no jogo (12-19). */
export const BASE_EXIBICAO_WE = 12

type TabelaConversao = Regras['jogadores']['conversao_we']

/** Atributo do manager (1-20) → nível bruto do WE (0-7). */
export function paraNivelWe(valor: number, tabela: TabelaConversao): number {
  const v = Math.min(20, Math.max(1, Math.round(valor)))
  const nivel = tabela.limites.findIndex((limite) => v <= limite)
  return nivel === -1 ? tabela.limites.length - 1 : nivel
}

/** Atributo do manager (1-20) → número que o WE mostra (12-19). */
export function paraExibicaoWe(valor: number, tabela: TabelaConversao): number {
  return paraNivelWe(valor, tabela) + BASE_EXIBICAO_WE
}

/**
 * Número exibido pelo WE (12-19) → atributo do manager (1-20): valor central da faixa
 * que vira aquele nível, arredondado para baixo (decisão 16). Ida e volta preservam o nível.
 */
export function deExibicaoWe(exibido: number, tabela: TabelaConversao): number {
  const nivel = Math.min(tabela.limites.length - 1, Math.max(0, Math.round(exibido) - BASE_EXIBICAO_WE))
  const ate = tabela.limites[nivel] as number
  const de = nivel === 0 ? 1 : (tabela.limites[nivel - 1] as number) + 1
  return Math.floor((de + ate) / 2)
}

/** "Geral" exibido: média ponderada pelos pesos da posição (média simples sem pesos), arredondada. */
export function geral(atributos: Atributos, posicao: string, regras: Regras): number {
  const pesos = regras.jogadores.pesos_geral[posicao]
  let soma = 0
  let total = 0
  for (const a of ATRIBUTOS) {
    const p = pesos ? (pesos[a] ?? 0) : 1
    soma += atributos[a] * p
    total += p
  }
  return total > 0 ? Math.round(soma / total) : 0
}
