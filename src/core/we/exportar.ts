import type { Regras } from '../config/padroes'
import { nivelWeNaPartida, seta, type Seta } from '../jogadores/setas'
import { BASE_EXIBICAO_WE } from '../jogadores/conversao'
import { paraAscii } from '../texto'
import { ATRIBUTOS, type Aparencia, type Atributo, type Atributos, type Posicao } from '@shared/esquemas/pacote'
import type { Uniforme } from './uniformes'

/**
 * Monta o time no formato que a ponte já lê (o mesmo de data/times/*.json): a ponte
 * (`expandir_times` em bridge/we2002.lua) e as ferramentas de kit/bandeira continuam iguais.
 * Conversões de saída da spec 07: atributos 1-20 → 12-19 com a redução por condição,
 * seta → `condicao` 5-1, nome ASCII de 10, camisa 1-32, idade e altura nos limites do WE.
 */

/** Chaves dos atributos no formato da ponte. */
export const CHAVE_PONTE: Readonly<Record<Atributo, string>> = {
  OFF: 'OFF',
  DEF: 'DEF',
  BAL: 'BAL',
  STA: 'STA',
  SPD: 'SPD',
  ACC: 'ACC',
  RES: 'RES',
  DRI: 'DRI',
  PAS: 'PASS',
  SHP: 'SHPW',
  SHA: 'SHAC',
  TEC: 'TEC',
  HEA: 'HEAD',
  JMP: 'JMP',
  CUR: 'CRV',
  AGR: 'AGR',
}

/** Seta → `condicao` da ponte (5 = seta vermelha, a melhor; 1 = branca, a pior). */
export const CONDICAO_PONTE: Readonly<Record<Seta, number>> = { otima: 5, boa: 4, normal: 3, ruim: 2, pessima: 1 }

export const LIMITES_WE = { nome: 10, camisa: [1, 32], idade: [15, 46], altura: [148, 211], vagas: 23 } as const

export interface JogadorExportar {
  id: string
  nomeWe: string
  posicao: Posicao
  camisa: number
  altura: number
  idade: number
  pe: string
  outside: boolean
  aparencia: Aparencia | null
  atributos: Atributos
  condicao: number
  moral: number
}

export interface TimeExportar {
  sigla: string
  nome: string
  nomeCurto: string
  formacao: string
  kit: Record<string, unknown> | null
  kitReserva: Record<string, unknown> | null
  bandeira: { arquivo: string; ajuste: string } | null
  /** 23: os 11 titulares na ordem das vagas da formação e os 12 reservas. */
  jogadores: JogadorExportar[]
}

export interface JogadorPonte {
  vaga: number
  nome: string
  posicao: Posicao
  camisa: number
  altura: number
  idade: number
  pe: string
  outside: boolean
  condicao: number
  atributos: Record<string, number>
  aparencia?: Aparencia
}

export interface TimePonte {
  nome: string
  nome_tela: string
  sigla: string
  formacao: string
  kit?: Record<string, unknown>
  kit_reserva?: Record<string, unknown>
  bandeira?: string
  bandeira_ajuste?: string
  jogadores: JogadorPonte[]
}

const limitar = (v: number, [a, b]: readonly [number, number]) => Math.max(a, Math.min(b, Math.round(v)))

export function nomeParaWe(nome: string): string {
  return paraAscii(nome).trim().slice(0, LIMITES_WE.nome)
}

/** Camisas válidas no WE (1-32, sem repetir): fora da faixa ou repetida vira o maior número livre. */
export function camisasParaWe(camisas: readonly number[]): number[] {
  const [min, max] = LIMITES_WE.camisa
  const usadas = new Set<number>()
  const saida: (number | null)[] = camisas.map((c) => {
    if (c >= min && c <= max && !usadas.has(c)) {
      usadas.add(c)
      return c
    }
    return null
  })
  return saida.map((c) => {
    if (c !== null) return c
    let livre: number = max
    while (usadas.has(livre) && livre > min) livre--
    usadas.add(livre)
    return livre
  })
}

export function atributosParaWe(a: Atributos, condicao: number, regras: Regras): Record<string, number> {
  return Object.fromEntries(ATRIBUTOS.map((k) => [CHAVE_PONTE[k], nivelWeNaPartida(a[k], condicao, regras) + BASE_EXIBICAO_WE]))
}

export function timeParaPonte(t: TimeExportar, regras: Regras): TimePonte {
  if (t.jogadores.length > LIMITES_WE.vagas) throw new Error(`${t.nome}: ${t.jogadores.length} jogadores (o WE leva ${LIMITES_WE.vagas})`)
  const camisas = camisasParaWe(t.jogadores.map((j) => j.camisa))
  return {
    nome: t.nome,
    nome_tela: paraAscii(t.nomeCurto).toUpperCase().slice(0, 15),
    sigla: t.sigla,
    formacao: t.formacao,
    ...(t.kit && { kit: t.kit }),
    ...(t.kitReserva && { kit_reserva: t.kitReserva }),
    ...(t.bandeira && { bandeira: t.bandeira.arquivo, bandeira_ajuste: t.bandeira.ajuste }),
    jogadores: t.jogadores.map((j, vaga) => ({
      vaga,
      nome: nomeParaWe(j.nomeWe),
      posicao: j.posicao,
      camisa: camisas[vaga]!,
      altura: limitar(j.altura, LIMITES_WE.altura),
      idade: limitar(j.idade, LIMITES_WE.idade),
      pe: j.pe,
      outside: j.outside,
      condicao: CONDICAO_PONTE[seta(j.condicao, j.moral, regras)],
      atributos: atributosParaWe(j.atributos, j.condicao, regras),
      ...(j.aparencia && { aparencia: j.aparencia }),
    })),
  }
}

export interface LadoPartidaJson {
  nome: string
  id_we: number
  /** Caminho do time gerado, relativo à raiz do projeto (a ponte lê com ROOT .. "/" .. time). */
  time: string
  uniforme: Uniforme
}

/** IDs do WE das vagas fixas do estado base (Brasil x Holanda). */
export const ID_WE = { casa: 41, visitante: 8 } as const
