import type { FocoTreino, Regras } from '../config/padroes'
import type { Rng } from '../rng'
import type { Atributo, Atributos, Posicao } from '@shared/esquemas/pacote'
import { geral } from './conversao'

/** Treino semanal, evolução, declínio e entrosamento (spec 05). */

export interface JogadorTreino {
  id: string
  posicao: Posicao
  idade: number
  potencial: number
  atributos: Atributos
}

export interface MudancaAtributo {
  jogador: string
  atributo: Atributo
  delta: number
  /** Treino, idade, efeito de notícia (fase 7) ou oscilação semanal aleatória. */
  motivo: 'evolucao' | 'declinio' | 'noticia' | 'oscilacao'
}

function porIdade(tabela: readonly { ate_idade: number; fator: number }[], idade: number): number {
  return (tabela.find((f) => idade <= f.ate_idade) ?? tabela[tabela.length - 1])?.fator ?? 1
}

/** Fator dos minutos jogados na semana: ≥ 60' → 1,2 · entrou → 1,0 · não jogou → 0,7. */
export function fatorMinutos(minutos: number, regras: Regras): number {
  const e = regras.evolucao
  if (minutos >= e.minutos_bom) return e.fator_jogou_bem
  if (minutos > 0) return e.fator_entrou
  return e.fator_nao_jogou
}

/**
 * Chance semanal de +1 num atributo do foco. O potencial é o teto do **geral** (mesma escala),
 * então a margem é potencial − geral atual.
 */
export function chanceEvolucao(potencial: number, geralAtual: number, idade: number, minutos: number, regras: Regras): number {
  const e = regras.evolucao
  return e.base * (Math.max(0, potencial - geralAtual) / e.divisor) * porIdade(e.fator_idade, idade) * fatorMinutos(minutos, regras)
}

/** Atributos do foco que contam para o geral da posição (sem pesos para a posição: todos). */
export function atributosQueEvoluem(foco: FocoTreino, posicao: Posicao, regras: Regras): Atributo[] {
  const pesos = regras.jogadores.pesos_geral[posicao]
  return atributosDoFoco(foco, posicao, regras).filter((a) => !pesos || (pesos[a] ?? 0) > 0)
}

/** Chance semanal de −1 em cada atributo físico (a partir dos 30). */
export function chanceDeclinio(idade: number, regras: Regras): number {
  return Math.max(0, regras.evolucao.declinio_por_ano * (idade - regras.evolucao.idade_declinio))
}

export function atributosDoFoco(foco: FocoTreino, posicao: Posicao, regras: Regras): Atributo[] {
  const f = regras.treino.focos[foco]
  return [...f.atributos, ...(posicao === 'GK' ? (f.so_goleiro ?? []) : [])] as Atributo[]
}

/**
 * Uma semana de treino do jogador: evolução nos atributos do foco (geral até o potencial) e
 * declínio físico para quem tem 30+. Altera `j.atributos` e devolve as mudanças.
 */
export function semanaDeTreino(j: JogadorTreino, foco: FocoTreino, minutosNaSemana: number, regras: Regras, rng: Rng): MudancaAtributo[] {
  const mudancas: MudancaAtributo[] = []
  // Evolução: enquanto o geral estiver abaixo do potencial, nos atributos do foco que contam para a posição.
  let g = geral(j.atributos, j.posicao, regras)
  for (const a of atributosQueEvoluem(foco, j.posicao, regras)) {
    if (g >= j.potencial) break
    const atual = j.atributos[a]
    if (atual >= 20) continue
    if (rng.chance(chanceEvolucao(j.potencial, g, j.idade, minutosNaSemana, regras))) {
      j.atributos[a] = atual + 1
      mudancas.push({ jogador: j.id, atributo: a, delta: 1, motivo: 'evolucao' })
      g = geral(j.atributos, j.posicao, regras)
    }
  }
  const pDeclinio = chanceDeclinio(j.idade, regras)
  if (pDeclinio > 0) {
    for (const a of regras.evolucao.atributos_fisicos as Atributo[]) {
      if (j.atributos[a] > 1 && rng.chance(pDeclinio)) {
        j.atributos[a] -= 1
        mudancas.push({ jogador: j.id, atributo: a, delta: -1, motivo: 'declinio' })
      }
    }
  }
  return mudancas
}

/** Entrosamento depois de uma semana com o foco: tático sobe; os outros caem até o mínimo. */
export function entrosamentoSemanal(entrosamento: number, foco: FocoTreino, regras: Regras): number {
  const delta = regras.treino.focos[foco].entrosamento
  if (delta >= 0) return Math.min(100, entrosamento + delta)
  if (entrosamento <= regras.treino.entrosamento_minimo) return entrosamento
  return Math.max(regras.treino.entrosamento_minimo, entrosamento + delta)
}

/** Trocar a formação do time derruba o entrosamento para 50% do valor. */
export function entrosamentoAoTrocarFormacao(entrosamento: number, regras: Regras): number {
  return entrosamento * regras.treino.entrosamento_troca_formacao
}

/**
 * Foco da IA para os times da CPU: descansa se o elenco está cansado, treina tático se o
 * entrosamento está baixo, senão alterna técnico e físico pela semana.
 */
export function focoDaIa(condicaoMedia: number, entrosamento: number, semana: number): FocoTreino {
  if (condicaoMedia < 80) return 'descanso'
  if (entrosamento < 60) return 'tatico'
  return semana % 2 === 0 ? 'tecnico' : 'fisico'
}
