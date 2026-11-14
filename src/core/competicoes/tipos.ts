/** Tipos do motor de competições e do calendário (docs/spec/03-competicoes-calendario.md). */
import type { DetalhePartida } from '../partida/tipos'

export type Sigla = string

export interface Cartoes {
  amarelos: number
  vermelhos: number
}

/** Placar de uma partida. Gols incluem a prorrogação, quando houve. */
export interface Resultado {
  golsCasa: number
  golsVisitante: number
  prorrogacao?: boolean
  penaltisCasa?: number
  penaltisVisitante?: number
  cartoesCasa?: Cartoes
  cartoesVisitante?: Cartoes
  /** Detalhe do motor (autores, cartões, substituições, minutos). Ausente em resultado manual. */
  detalhe?: DetalhePartida
}

export interface Partida {
  id: string
  edicao: string
  fase: string
  grupo: string | null
  /** Rodada dentro da fase (0, 1, ...). No mata-mata, rodada = etapa da chave. */
  rodada: number
  /** Mata-mata: id do confronto (ida e volta têm o mesmo). */
  confronto: string | null
  /** Mata-mata: 1 = ida (ou jogo único), 2 = volta. */
  jogo: number
  casa: Sigla
  visitante: Sigla
  /** Índice do passo no calendário. */
  passo: number
  resultado: Resultado | null
}

/** Uma data do calendário com, no máximo, um jogo por time. */
export interface Passo {
  indice: number
  /** Dia implícito desde o início da temporada (0 = 1º dia da semana 1). */
  dia: number
  semana: number
  tipo: TipoData
}

export type TipoData = 'meio' | 'fds'
