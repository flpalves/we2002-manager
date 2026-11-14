import type { Atributos, Posicao } from '@shared/esquemas/pacote'

/** Jogador como o motor e a IA de técnico enxergam. */
export interface JogadorPartida {
  id: string
  nome: string
  posicao: Posicao
  posicaoSecundaria: Posicao | null
  atributos: Atributos
  /** 0-100, antes do jogo. */
  condicao: number
  /** 0-100. */
  moral: number
  /** 1-20 (oculta). */
  resistencia: number
  idade: number
  camisa: number
}

export interface Escalacao {
  formacao: string
  /** 11, na ordem das vagas da formação (0 = goleiro). */
  titulares: JogadorPartida[]
  /** Até 12. */
  reservas: JogadorPartida[]
  /** Titulares da escalação ideal que a IA poupou neste jogo (rodízio). */
  poupados?: string[]
}

export interface TimePartida {
  sigla: string
  escalacao: Escalacao
  /** 0-100. */
  entrosamento: number
  /** Multiplica a chance de lesão (foco do treino: Físico 1,3 · Descanso 0,5). */
  fatorLesao?: number
}

export type Lado = 'casa' | 'visitante'

export type EventoPartida =
  | { tipo: 'gol'; minuto: number; acrescimo: number; lado: Lado; jogador: string; assistencia: string | null; cabeca: boolean }
  | { tipo: 'amarelo' | 'vermelho'; minuto: number; acrescimo: number; lado: Lado; jogador: string; segundoAmarelo: boolean }
  | { tipo: 'lesao'; minuto: number; acrescimo: number; lado: Lado; jogador: string; gravidade: 'leve' | 'media' | 'grave'; semanas: number }
  | { tipo: 'substituicao'; minuto: number; acrescimo: number; lado: Lado; sai: string; entra: string; motivo: 'lesao' | 'cansaco' | 'cartao' | 'tatica' }

/** Participação de cada jogador que entrou em campo. */
export interface Participacao {
  jogador: string
  lado: Lado
  titular: boolean
  /** Papel da vaga que ocupou (a primeira, para quem entrou). */
  posicao: Posicao
  vaga: number
  camisa: number
  minutos: number
  entrouAos: number | null
  saiuAos: number | null
  /** Condição ao fim do jogo. */
  condicaoFinal: number
}

export interface DetalhePartida {
  eventos: EventoPartida[]
  participacoes: Participacao[]
  /** Reservas que não entraram (convocados). */
  naoUtilizados: { jogador: string; lado: Lado }[]
}
