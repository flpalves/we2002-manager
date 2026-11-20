import { continuar, jogarDataDoUsuario, responderEvento } from '../../src/main/carreira/temporada'
import type { Sql } from '../../src/main/db/sql'
import type { ResultadoContinuar } from '@shared/esquemas/temporada'

/** Responde os eventos pendentes com a primeira opção (o "usuário" dos testes). */
export function responderPendentes(sql: Sql): number {
  const pend = sql.all<{ id: number; escolhas: string }>('SELECT id, escolhas FROM noticia WHERE pendente = 1')
  for (const p of pend) responderEvento(sql, p.id, (JSON.parse(p.escolhas) as { id: string }[])[0]!.id)
  return pend.length
}

/** Junta dois avanços seguidos num resumo só. */
function somar(a: ResultadoContinuar, b: ResultadoContinuar): ResultadoContinuar {
  return { ...b, passosJogados: a.passosJogados + b.passosJogados, campeoes: [...a.campeoes, ...b.campeoes], jogoDoUsuario: b.jogoDoUsuario ?? a.jogoDoUsuario }
}

/**
 * Continuar semana a semana (respondendo os eventos no caminho, como faria o usuário) até o
 * pré-jogo ou o fim da temporada.
 */
export function continuarAtePreJogo(sql: Sql): ResultadoContinuar {
  responderPendentes(sql)
  let r = continuar(sql)
  while (!r.preJogo && !r.encerrada) {
    responderPendentes(sql)
    r = somar(r, continuar(sql))
  }
  return r
}

/** Um "clique" completo do fluxo antigo: Continuar até o pré-jogo e simular o jogo do usuário. */
export function avancar(sql: Sql): ResultadoContinuar {
  const r = continuarAtePreJogo(sql)
  if (!r.preJogo) return r
  responderPendentes(sql)
  return somar(r, jogarDataDoUsuario(sql))
}

/** Simula o jogo do usuário na data atual (respondendo antes um evento pendente). */
export function jogarUsuario(sql: Sql): ResultadoContinuar {
  responderPendentes(sql)
  return jogarDataDoUsuario(sql)
}
