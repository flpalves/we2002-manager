import { publico } from '@core/financas/financas'
import { cotaTv } from '@core/financas/financas'
import { clubesInteressados } from '@core/diretoria/diretoria'
import type { Porte } from '@core/mercado/valor'
import { idEdicao } from '@core/competicoes/fases'
import type { Diretoria, Financas } from '@shared/esquemas/mercado'
import { ErroApp } from '../ipc/registrar'
import type { Sql } from '../db/sql'
import { carreiraDe, folhaDe, regrasDe } from './mercado'
import { ligasDosTimes } from './economia'
import { criarMetas, detalheEdicao, lerDados } from './temporada'

/** Finanças, estádio e diretoria do time do usuário (06). */

interface LinhaTime {
  sigla: string
  porte: Porte
  saldo: number
  orcamento_folha_mensal: number
  patrocinio_temporada: number
  estadio_nome: string
  estadio_capacidade: number
  ingresso: number
  custo_por_jogo: number
  confianca_diretoria: number
}

function timeDoUsuario(sql: Sql): LinhaTime {
  const c = carreiraDe(sql)
  return sql.get<LinhaTime>(
    'SELECT sigla, porte, saldo, orcamento_folha_mensal, patrocinio_temporada, estadio_nome, estadio_capacidade, ingresso, custo_por_jogo, confianca_diretoria FROM time WHERE sigla = ?',
    c.time_usuario,
  )!
}

export function financas(sql: Sql): Financas {
  const r = regrasDe(sql)
  const c = carreiraDe(sql)
  const t = timeDoUsuario(sql)
  const d = lerDados(sql)
  const referencia = r.padrao_por_porte[t.porte].ingresso_padrao
  const estimado = publico(
    { capacidade: t.estadio_capacidade, preco: t.ingresso, precoReferencia: referencia, porteMandante: t.porte, porteVisitante: 'medio', competicao: 'liga', aproveitamento: 0.5 },
    r,
  )
  return {
    saldo: t.saldo,
    folha: folhaDe(sql, t.sigla),
    orcamentoFolha: t.orcamento_folha_mensal,
    patrocinioTemporada: t.patrocinio_temporada,
    cotaTvTemporada: cotaTv(ligasDosTimes(d.competicoes).get(t.sigla) ?? [], r),
    porCategoria: sql.all<{ categoria: string; valor: number }>(
      'SELECT categoria, SUM(valor) valor FROM lancamento_financeiro WHERE time = ? AND temporada = ? GROUP BY categoria ORDER BY categoria',
      t.sigla, c.temporada_atual,
    ),
    extrato: sql.all<{ semana: number; categoria: string; valor: number; descricao: string }>(
      'SELECT semana, categoria, valor, descricao FROM lancamento_financeiro WHERE time = ? AND temporada = ? ORDER BY id DESC LIMIT 200',
      t.sigla, c.temporada_atual,
    ),
    estadio: {
      nome: t.estadio_nome,
      capacidade: t.estadio_capacidade,
      ingresso: t.ingresso,
      precoReferencia: referencia,
      custoPorJogo: t.custo_por_jogo,
      publicoEstimado: estimado,
      rendaEstimada: estimado * t.ingresso,
      ultimosJogos: sql
        .all<{ visitante: string; publico: number; renda: number }>(
          'SELECT visitante, publico, renda FROM partida WHERE casa = ? AND publico IS NOT NULL ORDER BY id DESC LIMIT 5',
          t.sigla,
        )
        .map((p) => ({ adversario: p.visitante, publico: p.publico, renda: p.renda })),
    },
  }
}

/** Preço do ingresso (centavos): de R$ 1 até 5× a referência do porte. */
export function definirIngresso(sql: Sql, preco: number): Financas {
  const r = regrasDe(sql)
  const t = timeDoUsuario(sql)
  const maximo = r.padrao_por_porte[t.porte].ingresso_padrao * 5
  if (preco < 100 || preco > maximo) throw new ErroApp('ingresso_invalido', 'Preço do ingresso fora do limite.')
  sql.run('UPDATE time SET ingresso = ? WHERE sigla = ?', Math.round(preco), t.sigla)
  return financas(sql)
}

export function diretoria(sql: Sql): Diretoria {
  const r = regrasDe(sql)
  const c = carreiraDe(sql)
  const t = timeDoUsuario(sql)
  const dif = sql.get<{ dificuldade: 'facil' | 'normal' | 'dificil'; avaliacoes_ruins: number }>('SELECT dificuldade, avaliacoes_ruins FROM carreira')!
  const folha = folhaDe(sql, t.sigla)
  const metas = sql
    .all<{ tipo: Diretoria['metas'][number]['tipo']; alvo: number | null; competicao: string | null; descricao: string; critica: number; status: Diretoria['metas'][number]['status'] }>(
      'SELECT tipo, alvo, competicao, descricao, critica, status FROM meta_diretoria WHERE temporada = ? ORDER BY id',
      c.temporada_atual,
    )
    .map((m) => {
      let atual: number | null = null
      let alvo = m.alvo
      let noCaminho = false
      if (m.tipo === 'posicao_liga' && m.competicao) {
        atual = posicaoNaLiga(sql, m.competicao, c.temporada_atual, t.sigla)
        noCaminho = atual !== null && alvo !== null && atual <= alvo
      } else if (m.tipo === 'saldo_positivo') {
        atual = t.saldo
        noCaminho = t.saldo >= 0
      } else {
        atual = folha
        alvo = t.orcamento_folha_mensal
        noCaminho = folha <= t.orcamento_folha_mensal
      }
      return { tipo: m.tipo, descricao: m.descricao, status: m.status, critica: !!m.critica, atual, alvo, noCaminho }
    })
  const clubes = sql.all<{ sigla: string; nome: string; porte: Porte; pais: string }>('SELECT sigla, nome, porte, pais FROM time')
  return {
    confianca: t.confianca_diretoria,
    limite: r.diretoria.limite_demissao[dif.dificuldade],
    avaliacoesRuins: dif.avaliacoes_ruins,
    demitido: !!c.demitido,
    metas,
    clubesInteressados: c.demitido ? interessados(clubes, t) : [],
  }
}

function interessados<T extends { sigla: string; porte: Porte; pais: string; nome: string }>(clubes: T[], t: LinhaTime): { sigla: string; nome: string; porte: string }[] {
  let lista = clubesInteressados(clubes, t.sigla, t.porte)
  // Sem clube de porte igual ou menor no país: qualquer outro do pacote.
  if (!lista.length) lista = clubes.filter((c) => c.sigla !== t.sigla)
  return lista.map((c) => ({ sigla: c.sigla, nome: c.nome, porte: c.porte }))
}

function posicaoNaLiga(sql: Sql, competicao: string, temporada: number, sigla: string): number | null {
  try {
    const e = detalheEdicao(sql, idEdicao(competicao, temporada))
    for (const f of e.fases) for (const tab of f.tabelas) {
      const l = tab.linhas.find((x) => x.time === sigla)
      if (l) return l.posicao
    }
  } catch {
    return null
  }
  return null
}

/** Depois da demissão: assume outro clube (da lista de interessados); a carreira continua. */
export function assumirClube(sql: Sql, sigla: string): Diretoria {
  const c = carreiraDe(sql)
  if (!c.demitido) throw new ErroApp('nao_demitido', 'Você não está desempregado.')
  const t = timeDoUsuario(sql)
  const clubes = sql.all<{ sigla: string; nome: string; porte: Porte; pais: string }>('SELECT sigla, nome, porte, pais FROM time')
  if (!interessados(clubes, t).some((x) => x.sigla === sigla)) throw new ErroApp('clube_invalido', 'Este clube não fez proposta.')
  const r = regrasDe(sql)
  sql.transacao(() => {
    sql.run('UPDATE carreira SET time_usuario = ?, demitido = 0, avaliacoes_ruins = 0, movimentos = ?', sigla, r.mercado.movimentos_por_jogo)
    sql.run('UPDATE time SET confianca_diretoria = ? WHERE sigla = ?', r.diretoria.confianca_inicial, sigla)
    sql.run('UPDATE time SET treino_foco = COALESCE(treino_foco, ?) WHERE sigla = ?', 'tecnico', sigla)
    sql.run('UPDATE negociacao SET aberta = 0')
    sql.run("UPDATE proposta_recebida SET estado = 'expirada' WHERE estado = 'aberta'")
    // Metas novas para o clube novo (as do clube anterior saem).
    sql.run("DELETE FROM meta_diretoria WHERE temporada = ? AND status = 'andamento'", c.temporada_atual)
    criarMetas(sql, lerDados(sql))
  })
  return diretoria(sql)
}
