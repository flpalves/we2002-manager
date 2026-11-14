import type { Regras } from '../config/padroes'

/** Valor de mercado, salário de referência e contrato (06-mercado; semanas restantes em 02-dados). */

export type Porte = 'grande' | 'medio' | 'pequeno'
export const ORDEM_PORTE: Record<Porte, number> = { pequeno: 0, medio: 1, grande: 2 }

/**
 * Semanas restantes de contrato: `ate_temporada` vence na última semana daquela temporada.
 * (ate − temporada atual) × S + (S − semana atual).
 */
export function semanasRestantes(ateTemporada: number, temporada: number, semana: number, regras: Regras): number {
  const s = regras.temporada.semanas_por_temporada
  return Math.max(0, (ateTemporada - temporada) * s + (s - semana))
}

function tabela<T extends { fator: number }>(linhas: readonly T[], ok: (l: T) => boolean): number {
  return (linhas.find(ok) ?? linhas[linhas.length - 1])?.fator ?? 1
}

export interface EntradaValor {
  geral: number
  idade: number
  potencial: number
  semanasContrato: number
  /** f_serie: liga do time (ou fator do país, para estrangeiros). */
  fatorSerie: number
}

/** Quanto da margem até o potencial já entra no valor, pela idade (06). */
export function realizacaoPotencial(idade: number, regras: Regras): number {
  return tabela(regras.mercado.realizacao_potencial, (l) => idade <= l.ate_idade)
}

/** Geral projetado = geral + realização(idade) × max(0, potencial − geral). */
export function geralProjetado(geral: number, potencial: number, idade: number, regras: Regras): number {
  return geral + realizacaoPotencial(idade, regras) * Math.max(0, potencial - geral)
}

function fatorIdade(idade: number, regras: Regras): number {
  return tabela(regras.mercado.fator_idade, (l) => idade <= l.ate_idade)
}

/** valor = valor_base × base_geral^(projetado − referência) × f_idade × f_contrato × f_serie. */
export function valorMercado(e: EntradaValor, regras: Regras): number {
  const m = regras.mercado
  const bruto =
    m.valor_base *
    m.base_geral ** (geralProjetado(e.geral, e.potencial, e.idade, regras) - m.geral_referencia) *
    fatorIdade(e.idade, regras) *
    tabela(m.fator_contrato, (l) => e.semanasContrato <= l.ate_semanas) *
    e.fatorSerie
  return Math.max(m.arredondar, Math.round(bruto / m.arredondar) * m.arredondar)
}

/** Fator de série do time: a liga de maior fator em que ele joga; estrangeiro usa o fator do país. */
export function fatorSerieDoTime(ligas: readonly string[], pais: string, fatorPais: number, regras: Regras): number {
  if (pais !== 'BRA') return fatorPais
  const fatores = ligas.map((l) => regras.mercado.fator_serie[l]).filter((f): f is number => f !== undefined)
  return fatores.length ? Math.max(...fatores) : regras.mercado.fator_sem_liga
}

/** Fator de série do salário (clube que paga); estrangeiro usa o fator do país. */
export function fatorSerieSalarioDoTime(ligas: readonly string[], pais: string, fatorPais: number, regras: Regras): number {
  if (pais !== 'BRA') return fatorPais
  const fatores = ligas.map((l) => regras.mercado.fator_serie_salario[l]).filter((f): f is number => f !== undefined)
  return fatores.length ? Math.max(...fatores) : regras.mercado.fator_sem_liga_salario
}

export interface EntradaSalario {
  geral: number
  idade: number
  potencial: number
  /** f_serie_salario do clube que paga. */
  fatorSerieSalario: number
}

/**
 * Prêmio do salário: o valor do jogador comparado com o de um jogador "neutro" do mesmo geral
 * (sem margem de potencial, idade de fator 1), com peso pequeno (expoente) e limitado.
 */
export function premioSalarial(geral: number, potencial: number, idade: number, regras: Regras): number {
  const m = regras.mercado
  const razao = fatorIdade(idade, regras) * m.base_geral ** (geralProjetado(geral, potencial, idade, regras) - geral)
  return Math.min(m.premio_maximo, Math.max(m.premio_minimo, razao ** m.expoente_premio))
}

/**
 * Salário mensal de referência (06): parte do talento atual (geral) e recebe só o prêmio do valor.
 * Inicializa quem vem do pacote com salário 0 e baliza a negociação. Arredonda para R$ 1 mil.
 */
export function salarioReferencia(e: EntradaSalario, regras: Regras): number {
  const m = regras.mercado
  const bruto =
    m.salario_base *
    m.base_geral_salario ** (e.geral - m.geral_referencia) *
    e.fatorSerieSalario *
    premioSalarial(e.geral, e.potencial, e.idade, regras)
  return Math.max(m.salario_minimo, Math.round(bruto / 100_000) * 100_000)
}

export function multaPadrao(valor: number, regras: Regras): number {
  return valor * regras.mercado.multa_por_valor
}

export type Importancia = 'titular' | 'reserva' | 'encostado'

/** Importância no time pela ordem de geral (os 11 melhores são titulares, os 7 seguintes reservas). */
export function importanciaNoTime(geralDoJogador: number, geraisDoTime: readonly number[], regras: Regras): Importancia {
  const acima = geraisDoTime.filter((g) => g > geralDoJogador).length
  if (acima < regras.mercado.titulares) return 'titular'
  if (acima < regras.mercado.titulares + regras.mercado.reservas) return 'reserva'
  return 'encostado'
}
