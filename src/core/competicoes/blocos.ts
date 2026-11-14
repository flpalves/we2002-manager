/**
 * Validação do `temporada.json` (03-competicoes, "Datas e temporada.json"): os blocos dizem a
 * janela de semanas e o tipo de data (fim de semana, meio de semana ou ambos) de cada
 * competição. A ordem dos blocos é a ordem de encaixe no calendário. Competição sem bloco
 * usa os fins de semana da temporada inteira.
 */

import type { Bloco } from './calendario'

export interface ProblemaBloco {
  nivel: 'erro' | 'aviso'
  codigo: string
  mensagem: string
  /** Competição do bloco (ou a que ficou sem bloco). */
  competicao?: string
}

/** Limites da duração da temporada aceitos no editor e na validação. */
export const SEMANAS_MINIMO = 8
export const SEMANAS_MAXIMO = 104

const NOME_DATAS: Record<Bloco['datas'], string> = { fds: 'fins de semana', meio: 'meios de semana', ambos: 'fins e meios de semana' }

/** Quantas datas o bloco oferece (cada semana tem uma de meio e uma de fim de semana). */
export function datasDoBloco(b: Pick<Bloco, 'datas' | 'semana_inicio' | 'semana_fim'>, semanas: number): number {
  const de = Math.max(1, b.semana_inicio)
  const ate = Math.min(semanas, b.semana_fim)
  const n = Math.max(0, ate - de + 1)
  return b.datas === 'ambos' ? n * 2 : n
}

export function descreverDatas(d: Bloco['datas']): string {
  return NOME_DATAS[d]
}

/**
 * Valida os blocos contra as competições do pacote e a duração da temporada.
 * Erros: competição inexistente ou repetida, semanas fora da temporada ou invertidas,
 * duração inválida. Aviso: competição sem bloco.
 */
export function validarBlocos(
  blocos: readonly Bloco[],
  competicoes: readonly { id: string; nome: string }[],
  semanas: number,
): ProblemaBloco[] {
  const p: ProblemaBloco[] = []
  const erro = (codigo: string, mensagem: string, competicao?: string) => p.push({ nivel: 'erro', codigo, mensagem, ...(competicao !== undefined && { competicao }) })
  if (!Number.isInteger(semanas) || semanas < SEMANAS_MINIMO || semanas > SEMANAS_MAXIMO) {
    erro('semanas_invalidas', `A temporada precisa ter de ${SEMANAS_MINIMO} a ${SEMANAS_MAXIMO} semanas (está com ${semanas}).`)
  }
  const nomes = new Map(competicoes.map((c) => [c.id, c.nome]))
  const vistas = new Set<string>()
  for (const b of blocos) {
    const nome = nomes.get(b.competicao) ?? b.competicao
    if (!nomes.has(b.competicao)) erro('bloco_invalido', `temporada.json: competição "${b.competicao}" não existe.`, b.competicao)
    if (vistas.has(b.competicao)) erro('bloco_repetido', `temporada.json: ${nome} tem mais de uma janela (só a primeira vale).`, b.competicao)
    vistas.add(b.competicao)
    if (!Number.isInteger(b.semana_inicio) || !Number.isInteger(b.semana_fim)) {
      erro('bloco_invalido', `temporada.json: as semanas de ${nome} precisam ser números inteiros.`, b.competicao)
    } else if (b.semana_inicio > b.semana_fim) {
      erro('bloco_invalido', `temporada.json: ${nome} começa na semana ${b.semana_inicio} e termina antes, na ${b.semana_fim}.`, b.competicao)
    } else if (b.semana_inicio < 1 || b.semana_fim > semanas) {
      erro('bloco_invalido', `temporada.json: janela de ${nome} (semanas ${b.semana_inicio}-${b.semana_fim}) fora de 1-${semanas}.`, b.competicao)
    }
  }
  for (const c of competicoes) {
    if (!vistas.has(c.id)) p.push({ nivel: 'aviso', codigo: 'sem_bloco', mensagem: `${c.nome}: sem janela no temporada.json (usa os fins de semana da temporada inteira).`, competicao: c.id })
  }
  return p
}
