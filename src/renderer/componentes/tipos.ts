import type { NomeIcone } from '../icones'

export type NivelSeta = 'otima' | 'boa' | 'normal' | 'ruim' | 'pessima'

export interface ItemNav {
  nome: string
  titulo: string
  icone?: NomeIcone
  /** Contador ao lado do item (ex.: notícias não lidas). */
  contagem?: number
  /** Contador em destaque (ex.: notícia esperando decisão). */
  alerta?: boolean
}
