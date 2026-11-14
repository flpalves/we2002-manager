import type { Competicao } from '@shared/esquemas/pacote'
import { resolverSaidas, type EstadoEdicao } from './fases'
import type { Sigla } from './tipos'

/**
 * Virada de temporada (03-competicoes, "Virada de temporada"): participantes da próxima
 * temporada a partir das saídas de cada competição encerrada.
 *
 * - `acesso` e `rebaixamento` MOVEM o time: sai da lista da competição de origem e entra na
 *   do destino (as duas com participantes por `lista`).
 * - Os demais tipos (`vaga`, `libertadores`, ...) são vagas: o time entra no destino que tem
 *   participantes por `classificados_de` (na ordem das saídas, sem repetir, até `quantidade`).
 * - `por_divisao` ainda não é suportado: a competição fica como está.
 */

export interface Movimento {
  time: Sigla
  de: string
  para: string
  tipo: string
}

export interface ParticipantesSeguintes {
  /** Competição → participantes da próxima temporada (só as que têm participantes conhecidos). */
  participantes: Record<string, Sigla[]>
  /** Acessos e rebaixamentos aplicados. */
  movimentos: Movimento[]
  /** Vagas distribuídas (competição de origem → destino). */
  vagas: Movimento[]
}

export const TIPOS_MOVIMENTO = ['acesso', 'rebaixamento'] as const
const ehMovimento = (tipo: string) => (TIPOS_MOVIMENTO as readonly string[]).includes(tipo)

/**
 * @param atuais participantes desta temporada (id da competição → siglas)
 * @param edicoes edições encerradas desta temporada (com a classificação final)
 */
export function participantesSeguintes(
  competicoes: readonly Competicao[],
  atuais: Readonly<Record<string, readonly Sigla[]>>,
  edicoes: readonly EstadoEdicao[],
): ParticipantesSeguintes {
  const porId = new Map(competicoes.map((c) => [c.id, c]))
  const listas = new Map<string, Sigla[]>()
  for (const c of competicoes) if (c.participantes.regra === 'lista') listas.set(c.id, [...(atuais[c.id] ?? c.participantes.times)])

  const movimentos: Movimento[] = []
  const vagas: Movimento[] = []
  // Primeiro decide tudo pela temporada que acabou; depois aplica (a ordem das competições não importa).
  for (const e of edicoes) {
    const c = porId.get(e.competicao)
    if (!c) continue
    for (const s of resolverSaidas(e, c)) {
      const destino = porId.get(s.destino)
      if (!destino || s.destino === c.id) continue
      const m = { time: s.time, de: c.id, para: s.destino, tipo: s.tipo }
      if (ehMovimento(s.tipo)) {
        if (listas.has(c.id) && listas.has(s.destino) && !movimentos.some((x) => x.time === s.time)) movimentos.push(m)
      } else if (destino.participantes.regra === 'classificados_de' && destino.participantes.origens.includes(c.id)) {
        vagas.push(m)
      }
    }
  }

  for (const m of movimentos) {
    const origem = listas.get(m.de)!
    const i = origem.indexOf(m.time)
    if (i >= 0) origem.splice(i, 1)
    const destino = listas.get(m.para)!
    if (!destino.includes(m.time)) destino.push(m.time)
  }

  const participantes: Record<string, Sigla[]> = Object.fromEntries(listas)
  for (const c of competicoes) {
    if (c.participantes.regra !== 'classificados_de') continue
    const times: Sigla[] = []
    for (const v of vagas) if (v.para === c.id && !times.includes(v.time)) times.push(v.time)
    const q = c.participantes.quantidade
    participantes[c.id] = q ? times.slice(0, q) : times
  }
  return { participantes, movimentos, vagas }
}
