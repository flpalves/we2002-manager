import type { Regras } from '@core/config/padroes'
import { FORMACOES } from '@core/partida/formacoes'
import { aplicarEscalacaoSalva, validarEscalacaoSalva, type EscalacaoSalva } from '@core/partida/escalacaoSalva'
import { escalarTime, prioridadeDe } from '@core/partida/sessao'
import type { ContextoRodizio } from '@core/partida/ia'
import { entrosamentoAoTrocarFormacao } from '@core/jogadores/treino'
import type { Competicao } from '@shared/esquemas/pacote'
import type { Escalacao } from '@shared/esquemas/elenco'
import { carregarElencos } from '../db/repositorios/elencos'
import { ErroApp } from '../ipc/registrar'
import type { Sql } from '../db/sql'

/** Escalação do usuário (08): formação, titulares por vaga e reservas; vale no motor e no WE. */

function regrasDe(sql: Sql): Regras {
  return JSON.parse(sql.get<{ dados: string }>('SELECT dados FROM regras WHERE id = 1')!.dados) as Regras
}

function usuario(sql: Sql): string {
  return sql.get<{ time_usuario: string }>('SELECT time_usuario FROM carreira')!.time_usuario
}

/** Próximo jogo do time ainda sem resultado (competição para suspensões e rodízio). */
export function proximoJogo(sql: Sql, sigla: string) {
  // Os dois próximos: o seguinte diz se há jogos em sequência (rodízio da IA).
  const [p, depois] = sql.all<{ casa: string; visitante: string; competicao_id: string; dia: number | null }>(
    `SELECT p.casa, p.visitante, e.competicao_id, s.dia FROM partida p
       JOIN edicao e ON e.id = p.edicao_id
       LEFT JOIN passo s ON s.temporada = p.temporada AND s.indice = p.passo
      WHERE (p.casa = ? OR p.visitante = ?) AND p.gols_casa IS NULL
      ORDER BY p.temporada, p.passo LIMIT 2`,
    sigla, sigla,
  )
  if (!p) return null
  const definicao = (id: string) => {
    const def = sql.get<{ definicao: string; nome: string }>('SELECT definicao, nome FROM competicao WHERE id = ?', id)
    return { competicao: def ? (JSON.parse(def.definicao) as Competicao) : undefined, nome: def?.nome ?? id }
  }
  const atual = definicao(p.competicao_id)
  // A prévia não sabe se o jogo é decisivo (isso depende do estado do mata-mata).
  const rodizio: ContextoRodizio = {
    diasAteProximo: depois && depois.dia !== null && p.dia !== null ? depois.dia - p.dia : null,
    prioridadeProximo: depois ? prioridadeDe(definicao(depois.competicao_id).competicao) : null,
    decisivo: false,
  }
  return {
    competicao: atual.competicao,
    nomeCompeticao: atual.nome,
    adversario: p.casa === sigla ? p.visitante : p.casa,
    emCasa: p.casa === sigla,
    rodizio,
  }
}

const vazias = () => Array.from({ length: 11 }, () => null as string | null)

export function escalacao(sql: Sql): Escalacao {
  const regras = regrasDe(sql)
  const sigla = usuario(sql)
  const t = sql.get<{ formacao: string; escalacao: string | null; entrosamento: number }>('SELECT formacao, escalacao, entrosamento FROM time WHERE sigla = ?', sigla)!
  const salva = t.escalacao ? (JSON.parse(t.escalacao) as EscalacaoSalva) : null
  const prox = proximoJogo(sql, sigla)
  const elencos = carregarElencos(sql)
  let noProximoJogo: Escalacao['noProximoJogo'] = null
  let formacaoIa = t.formacao
  try {
    const e = escalarTime(elencos, sigla, prox?.competicao, regras, prox?.rodizio)
    formacaoIa = e.formacao
    noProximoJogo = {
      titulares: e.titulares.map((j) => j.id),
      reservas: e.reservas.map((j) => j.id),
      substituidos: 'substituidos' in e ? (e.substituidos as string[]) : [],
    }
  } catch {
    noProximoJogo = null // menos de 11 jogadores
  }
  // Automática: mostra a escalação da IA para o próximo jogo como ponto de partida.
  const base: EscalacaoSalva = salva ?? { formacao: formacaoIa, titulares: noProximoJogo?.titulares ?? vazias(), reservas: noProximoJogo?.reservas ?? [] }
  return {
    automatica: !salva,
    formacao: base.formacao,
    formacoes: Object.entries(FORMACOES).map(([id, papeis]) => ({ id, papeis: [...papeis] })),
    titulares: base.titulares,
    reservas: base.reservas,
    noProximoJogo,
    proximoJogo: prox ? { competicao: prox.nomeCompeticao, adversario: prox.adversario, emCasa: prox.emCasa } : null,
    entrosamento: Math.round(t.entrosamento),
  }
}

export function salvarEscalacao(sql: Sql, salva: EscalacaoSalva): Escalacao {
  const sigla = usuario(sql)
  const regras = regrasDe(sql)
  const elenco = new Set(
    sql.all<{ id: number }>("SELECT j.id FROM jogador j JOIN time t ON t.id = j.time_id WHERE t.sigla = ? AND j.status = 'ativo'", sigla).map((j) => String(j.id)),
  )
  const erro = validarEscalacaoSalva(salva, elenco)
  if (erro) throw new ErroApp('escalacao_invalida', erro)
  const t = sql.get<{ formacao: string; entrosamento: number }>('SELECT formacao, entrosamento FROM time WHERE sigla = ?', sigla)!
  sql.transacao(() => {
    if (salva.formacao !== t.formacao) {
      // Trocar a formação custa entrosamento (05).
      sql.run(
        'UPDATE time SET formacao = ?, entrosamento = ? WHERE sigla = ?',
        salva.formacao, Math.round(entrosamentoAoTrocarFormacao(t.entrosamento, regras) * 10) / 10, sigla,
      )
    }
    sql.run('UPDATE time SET escalacao = ? WHERE sigla = ?', JSON.stringify(salva), sigla)
  })
  return escalacao(sql)
}

/** Sugestão da IA na formação pedida (ou na atual), já salva como escalação do usuário. */
export function sugerirEscalacao(sql: Sql, formacao?: string): Escalacao {
  const regras = regrasDe(sql)
  const sigla = usuario(sql)
  const atual = escalacao(sql)
  const f = formacao && FORMACOES[formacao] ? formacao : atual.formacao
  const prox = proximoJogo(sql, sigla)
  const elencos = carregarElencos(sql)
  let disponiveis = elencos.disponiveis(sigla, prox?.competicao?.id ?? '')
  if (disponiveis.length < 11) disponiveis = elencos.doTime(sigla)
  if (disponiveis.length < 11) throw new ErroApp('elenco_curto', 'Menos de 11 jogadores no elenco.')
  const e = aplicarEscalacaoSalva({ formacao: f, titulares: vazias(), reservas: [] }, disponiveis, regras)
  return salvarEscalacao(sql, { formacao: f, titulares: e.titulares.map((j) => j.id), reservas: e.reservas.map((j) => j.id) })
}

/** Volta para a escalação automática (a IA escolhe a cada jogo). */
export function escalacaoAutomatica(sql: Sql): Escalacao {
  sql.run('UPDATE time SET escalacao = NULL WHERE sigla = ?', usuario(sql))
  return escalacao(sql)
}
