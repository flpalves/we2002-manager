import { continuar, jogarDataDoUsuario, responderEvento } from '../../src/main/carreira/temporada'
import type { Sql } from '../../src/main/db/sql'
import type { ResultadoContinuar } from '@shared/esquemas/temporada'

/** Responde os eventos pendentes com a primeira opção (o "usuário" dos testes). */
export function responderPendentes(sql: Sql): number {
  const pend = sql.all<{ id: number; escolhas: string }>('SELECT id, escolhas FROM noticia WHERE pendente = 1')
  for (const p of pend) responderEvento(sql, p.id, (JSON.parse(p.escolhas) as { id: string }[])[0]!.id)
  return pend.length
}

/** Um "clique" completo: Continuar até o pré-jogo e simular o jogo do usuário (como no fluxo antigo). */
export function avancar(sql: Sql): ResultadoContinuar {
  responderPendentes(sql)
  let r = continuar(sql)
  // Parou por um evento com escolha: responde e segue até o pré-jogo, como faria o usuário.
  while (!r.preJogo && r.eventoPendente && !r.encerrada) {
    responderPendentes(sql)
    const mais = continuar(sql)
    r = { ...mais, passosJogados: r.passosJogados + mais.passosJogados, campeoes: [...r.campeoes, ...mais.campeoes], jogoDoUsuario: mais.jogoDoUsuario ?? r.jogoDoUsuario }
  }
  if (!r.preJogo) return r
  responderPendentes(sql)
  const j = jogarDataDoUsuario(sql)
  return { ...j, passosJogados: r.passosJogados + j.passosJogados, campeoes: [...r.campeoes, ...j.campeoes] }
}

/** Continuar até o pré-jogo (respondendo eventos no caminho). */
export function continuarAtePreJogo(sql: Sql): ResultadoContinuar {
  responderPendentes(sql)
  let r = continuar(sql)
  while (!r.preJogo && r.eventoPendente && !r.encerrada) {
    responderPendentes(sql)
    r = continuar(sql)
  }
  return r
}

/** Simula o jogo do usuário na data atual (respondendo antes um evento pendente). */
export function jogarUsuario(sql: Sql): ResultadoContinuar {
  responderPendentes(sql)
  return jogarDataDoUsuario(sql)
}
