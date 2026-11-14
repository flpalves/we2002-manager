import type { Regras } from '../config/padroes'
import type { Rng } from '../rng'
import { fatorIdade } from './valor'

/**
 * Disponíveis do exterior na virada (06, "Jogadores sem clube"): quem sobrou no pool tem a taxa
 * recalculada pela idade nova e uma parte sai ("renovou com o clube dele lá fora").
 */

export interface DisponivelExterior {
  id: string
  /** Idade já com o ano da virada. */
  idade: number
  /** Idade antes da virada. */
  idadeAnterior: number
  taxa: number
}

export interface ResultadoExterior {
  id: string
  taxa: number
  sai: boolean
}

/** taxa × f_idade(nova) / f_idade(antiga), arredondada para `exterior.arredondar_taxa` (nunca abaixo dele). */
export function taxaNaVirada(taxa: number, idadeAnterior: number, idade: number, regras: Regras): number {
  const passo = regras.exterior.arredondar_taxa
  const bruta = (taxa * fatorIdade(idade, regras)) / fatorIdade(idadeAnterior, regras)
  return Math.max(passo, Math.round(bruta / passo) * passo)
}

/** Chance de sair do pool: `saida_por_virada`, dobrada a partir de `idade_saida_dobrada` (no máximo 1). */
export function chanceDeSaida(idade: number, regras: Regras): number {
  const e = regras.exterior
  return Math.min(1, e.saida_por_virada * (idade >= e.idade_saida_dobrada ? 2 : 1))
}

/** Virada do pool, na ordem do id (um sorteio por jogador, reproduzível pela semente). */
export function viradaExterior(pool: readonly DisponivelExterior[], regras: Regras, rng: Rng): ResultadoExterior[] {
  return [...pool]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((j) => ({ id: j.id, taxa: taxaNaVirada(j.taxa, j.idadeAnterior, j.idade, regras), sai: rng.derivar(j.id).chance(chanceDeSaida(j.idade, regras)) }))
}
