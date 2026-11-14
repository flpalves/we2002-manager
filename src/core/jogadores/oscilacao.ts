import type { Regras } from '../config/padroes'
import type { Rng } from '../rng'
import { ATRIBUTOS, type Atributo, type Atributos, type Posicao } from '@shared/esquemas/pacote'
import type { MudancaAtributo } from './treino'

/**
 * Oscilação semanal (09): a cada semana, entre `fracao_min` e `fracao_max` de todos os
 * jogadores da carreira (qualquer idade, qualquer clube) sofrem uma variação de
 * `delta_min` a `delta_max` pontos num atributo sorteado. Metade sobe, metade desce; com
 * quantidade ímpar, o sinal do que sobra é sorteado. Não respeita o potencial (é ruído do
 * futebol, não evolução), só os limites 1-20.
 */

export interface JogadorOscilacao {
  id: string
  posicao: Posicao
  atributos: Atributos
}

/** Quantos jogadores oscilam nesta semana, dado o total. */
export function quantidadeOscilacao(total: number, regras: Regras, rng: Rng): number {
  const o = regras.oscilacao
  if (!o.ativa || total <= 0) return 0
  const fracao = o.fracao_min + rng.proximo() * Math.max(0, o.fracao_max - o.fracao_min)
  return Math.min(total, Math.round(total * fracao))
}

/** Atributos que podem andar na direção pedida (REFLE. só para goleiro, como no resto do núcleo). */
function candidatos(j: JogadorOscilacao, sinal: 1 | -1): Atributo[] {
  return ATRIBUTOS.filter((a) => (a !== 'RES' || j.posicao === 'GK') && (sinal > 0 ? j.atributos[a] < 20 : j.atributos[a] > 1))
}

/**
 * Sorteia e aplica a oscilação da semana. Altera `atributos` dos jogadores escolhidos e
 * devolve as mudanças (motivo `oscilacao`). A ordem da lista de entrada não importa: os
 * jogadores são ordenados por id antes do sorteio, para a mesma semente dar o mesmo resultado.
 */
export function oscilacaoSemanal(jogadores: readonly JogadorOscilacao[], regras: Regras, rng: Rng): MudancaAtributo[] {
  const o = regras.oscilacao
  const qtd = quantidadeOscilacao(jogadores.length, regras, rng)
  if (!qtd) return []
  const metade = Math.floor(qtd / 2)
  const positivos = metade + (qtd % 2 === 1 && rng.chance(0.5) ? 1 : 0)
  const ordenados = [...jogadores].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const escolhidos = rng.embaralhar(ordenados).slice(0, qtd)

  const mudancas: MudancaAtributo[] = []
  escolhidos.forEach((j, i) => {
    const sinal: 1 | -1 = i < positivos ? 1 : -1
    const lista = candidatos(j, sinal)
    if (!lista.length) return
    const atributo = rng.escolher(lista)
    const tamanho = rng.inteiro(o.delta_min, o.delta_max)
    const antes = j.atributos[atributo]
    const depois = Math.max(1, Math.min(20, antes + sinal * tamanho))
    j.atributos[atributo] = depois
    mudancas.push({ jogador: j.id, atributo, delta: depois - antes, motivo: 'oscilacao' })
  })
  return mudancas
}
