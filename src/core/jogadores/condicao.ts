import type { Regras } from '../config/padroes'

/**
 * Condição física (spec 05). O gasto em campo é por minuto (o motor chama `gastoPorMinuto`);
 * fora de campo, a recuperação é por dia implícito.
 */

function porIdade(tabela: readonly { ate_idade: number; fator: number }[], idade: number): number {
  return (tabela.find((f) => idade <= f.ate_idade) ?? tabela[tabela.length - 1])?.fator ?? 1
}

export interface PerfilFisico {
  idade: number
  resistencia: number
  /** Atributo FOLE (STA), 1-20. */
  fole: number
}

/** Quanto o jogador perde de condição por minuto em campo. */
export function gastoPorMinuto(j: PerfilFisico, regras: Regras): number {
  const c = regras.condicao
  const fatorResistencia = c.resistencia_base - c.resistencia_por_ponto * j.resistencia
  const fatorFole = c.fole_base - c.fole_por_ponto * j.fole
  return (c.gasto_por_90 / 90) * fatorResistencia * fatorFole * porIdade(c.fator_idade_gasto, j.idade)
}

/** Recuperação em `dias` sem jogar (até 100). `fatorTreino` vem do foco do treino (fase 4). */
export function recuperar(condicao: number, idade: number, dias: number, regras: Regras, fatorTreino = 1): number {
  if (dias <= 0) return condicao
  const ganho = regras.condicao.recuperacao_por_dia * porIdade(regras.condicao.fator_idade_recuperacao, idade) * fatorTreino * dias
  return Math.min(100, condicao + ganho)
}
