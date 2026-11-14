import type { Regras } from '../config/padroes'
import type { UnidadeRodada } from './fases'
import type { Passo, Sigla, TipoData } from './tipos'

/**
 * Montagem do calendário (03-competicoes): cada semana implícita tem uma data de meio de
 * semana e uma de fim de semana; as rodadas de cada competição entram, em ordem, na
 * primeira data livre da sua janela. Datas sem jogo de ninguém não viram passo, mas o
 * tempo entre os passos corre igual (a semana sai do dia).
 */

export interface Bloco {
  competicao: string
  datas: 'fds' | 'meio' | 'ambos'
  semana_inicio: number
  semana_fim: number
}

export interface DataCalendario {
  dia: number
  semana: number
  tipo: TipoData
}

export function datasDaTemporada(regras: Regras): DataCalendario[] {
  const datas: DataCalendario[] = []
  for (let s = 1; s <= regras.temporada.semanas_por_temporada; s++) {
    const base = (s - 1) * 7
    const meio = { dia: base + regras.calendario.dia_meio, semana: s, tipo: 'meio' as const }
    const fds = { dia: base + regras.calendario.dia_fds, semana: s, tipo: 'fds' as const }
    datas.push(...(meio.dia <= fds.dia ? [meio, fds] : [fds, meio]))
  }
  return datas
}

export const semanaDoDia = (dia: number) => Math.floor(dia / 7) + 1

export class ErroCalendario extends Error {}

export interface PlanoEdicao {
  competicao: string
  unidades: UnidadeRodada[]
}

/**
 * Encaixa as rodadas. Devolve, para cada plano, o índice da data de cada unidade, e os
 * passos (datas usadas, em ordem). Regras: rodadas da mesma edição em datas crescentes;
 * nenhum time com dois jogos a menos de `descanso_minimo_dias` dias.
 */
export function montarCalendario(planos: readonly PlanoEdicao[], blocos: readonly Bloco[], regras: Regras): { passos: Passo[]; passoDasUnidades: number[][] } {
  const datas = datasDaTemporada(regras)
  const semanas = regras.temporada.semanas_por_temporada
  const descanso = regras.calendario.descanso_minimo_dias
  const diasDoTime = new Map<Sigla, number[]>()
  const livre = (t: Sigla, dia: number) => !(diasDoTime.get(t) ?? []).some((d) => Math.abs(d - dia) <= descanso)

  // Ordem: a dos blocos do temporada.json; competições sem bloco vão no fim, em fds.
  const ordem = [...planos.keys()].sort((a, b) => indiceBloco(planos[a]!.competicao) - indiceBloco(planos[b]!.competicao))
  function indiceBloco(c: string): number {
    const i = blocos.findIndex((b) => b.competicao === c)
    return i === -1 ? blocos.length : i
  }

  const dataDasUnidades: number[][] = planos.map(() => [])
  for (const iPlano of ordem) {
    const plano = planos[iPlano]!
    const bloco = blocos.find((b) => b.competicao === plano.competicao) ?? { competicao: plano.competicao, datas: 'fds', semana_inicio: 1, semana_fim: semanas }
    let ultima = -1
    for (const u of plano.unidades) {
      const times = u.confrontos ? u.confrontos.flatMap((c) => [c.casa, c.visitante]) : u.possiveis
      let escolhida = -1
      for (let d = ultima + 1; d < datas.length; d++) {
        const data = datas[d]!
        if (data.semana < bloco.semana_inicio) continue
        if (data.semana > Math.min(bloco.semana_fim, semanas)) break
        if (bloco.datas !== 'ambos' && data.tipo !== bloco.datas) continue
        if (times.every((t) => livre(t, data.dia))) {
          escolhida = d
          break
        }
      }
      if (escolhida === -1) {
        throw new ErroCalendario(
          `${plano.competicao}: a rodada ${u.fase}/${u.rodada + 1}${u.jogo > 1 ? ' (volta)' : ''} não cabe entre as semanas ${bloco.semana_inicio} e ${bloco.semana_fim}`,
        )
      }
      for (const t of times) diasDoTime.set(t, [...(diasDoTime.get(t) ?? []), datas[escolhida]!.dia])
      dataDasUnidades[iPlano]!.push(escolhida)
      ultima = escolhida
    }
  }

  const usadas = [...new Set(dataDasUnidades.flat())].sort((a, b) => a - b)
  const passoDaData = new Map(usadas.map((d, i) => [d, i]))
  const passos: Passo[] = usadas.map((d, i) => ({ indice: i, dia: datas[d]!.dia, semana: datas[d]!.semana, tipo: datas[d]!.tipo }))
  return { passos, passoDasUnidades: dataDasUnidades.map((ds) => ds.map((d) => passoDaData.get(d)!)) }
}
