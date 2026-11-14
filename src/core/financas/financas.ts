import type { Regras } from '../config/padroes'
import type { Porte } from '../mercado/valor'

/** Público, bilheteria e o ciclo financeiro (06: finanças e estádio). Centavos. */

export type TipoCompeticaoPublico = 'liga' | 'copa' | 'estadual' | 'continental' | 'final'

export interface EntradaPublico {
  capacidade: number
  /** Preço do ingresso (centavos) e referência do porte (ingresso padrão). */
  preco: number
  precoReferencia: number
  porteMandante: Porte
  porteVisitante: Porte
  competicao: TipoCompeticaoPublico
  /** Aproveitamento recente do mandante (0-1): pontos dos últimos jogos / máximo. */
  aproveitamento: number
}

export function fatorPreco(preco: number, referencia: number, regras: Regras): number {
  const f = regras.financas
  return Math.min(f.preco_maximo, Math.max(f.preco_minimo, f.preco_base - (f.preco_peso * preco) / Math.max(1, referencia)))
}

/** Público = capacidade × min(1, demanda). */
export function publico(e: EntradaPublico, regras: Regras): number {
  const f = regras.financas
  const demanda =
    f.demanda_base[e.porteMandante] *
    (1 + f.peso_momento * (e.aproveitamento - 0.5)) *
    f.fator_adversario[e.porteVisitante] *
    f.fator_competicao[e.competicao] *
    fatorPreco(e.preco, e.precoReferencia, regras)
  return Math.round(e.capacidade * Math.max(0, Math.min(1, demanda)))
}

export interface Lancamento {
  time: string
  categoria: CategoriaLancamento
  valor: number
  descricao: string
}

export type CategoriaLancamento =
  | 'bilheteria'
  | 'estadio'
  | 'salarios'
  | 'patrocinio'
  | 'tv'
  | 'premiacao'
  | 'transferencia_entrada'
  | 'transferencia_saida'
  | 'emprestimo'
  | 'evento_receita'
  | 'evento_despesa'

/** Renda e custo de um jogo em casa. */
export function lancamentosDoJogo(mandante: string, publicoPagante: number, preco: number, custoPorJogo: number, descricao: string): Lancamento[] {
  return [
    { time: mandante, categoria: 'bilheteria', valor: publicoPagante * preco, descricao },
    { time: mandante, categoria: 'estadio', valor: -custoPorJogo, descricao },
  ]
}

export interface EntradaCiclo {
  time: string
  folhaMensal: number
  patrocinioTemporada: number
  cotaTvTemporada: number
}

/** A cada ciclo (4 semanas): salários, parcela do patrocínio e parcela da TV. */
export function lancamentosDoCiclo(e: EntradaCiclo, regras: Regras): Lancamento[] {
  const parcelas = Math.max(1, Math.floor(regras.temporada.semanas_por_temporada / regras.financas.ciclo_semanas))
  const l: Lancamento[] = []
  if (e.folhaMensal) l.push({ time: e.time, categoria: 'salarios', valor: -e.folhaMensal, descricao: 'Folha salarial' })
  if (e.patrocinioTemporada) l.push({ time: e.time, categoria: 'patrocinio', valor: Math.round(e.patrocinioTemporada / parcelas), descricao: 'Patrocínio (parcela)' })
  if (e.cotaTvTemporada) l.push({ time: e.time, categoria: 'tv', valor: Math.round(e.cotaTvTemporada / parcelas), descricao: 'Cota de TV (parcela)' })
  return l
}

export function cotaTv(ligas: readonly string[], regras: Regras): number {
  const cotas = ligas.map((l) => regras.financas.cota_tv[l]).filter((v): v is number => v !== undefined)
  return cotas.length ? Math.max(...cotas) : regras.financas.cota_tv_sem_liga
}

export function ehSemanaDeCiclo(semana: number, regras: Regras): boolean {
  return semana > 0 && semana % regras.financas.ciclo_semanas === 0
}
