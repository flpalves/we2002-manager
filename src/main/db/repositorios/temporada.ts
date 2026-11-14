import type { EstadoEdicao } from '@core/competicoes/fases'
import type { EstadoTemporada } from '@core/competicoes/temporada'
import type { Partida, Passo, Resultado } from '@core/competicoes/tipos'
import type { DetalhePartida } from '@core/partida/tipos'
import type { Sql } from '../sql'

interface LinhaPartida {
  id: string
  edicao_id: string
  fase: string
  grupo: string | null
  rodada: number
  confronto: string | null
  jogo: number
  passo: number
  casa: string
  visitante: string
  gols_casa: number | null
  gols_visitante: number | null
  prorrogacao: number
  penaltis_casa: number | null
  penaltis_visitante: number | null
  amarelos_casa: number
  vermelhos_casa: number
  amarelos_visitante: number
  vermelhos_visitante: number
}

function paraPartida(l: LinhaPartida): Partida {
  let resultado: Resultado | null = null
  if (l.gols_casa !== null && l.gols_visitante !== null) {
    resultado = {
      golsCasa: l.gols_casa,
      golsVisitante: l.gols_visitante,
      ...(l.prorrogacao ? { prorrogacao: true } : {}),
      ...(l.penaltis_casa !== null && l.penaltis_visitante !== null ? { penaltisCasa: l.penaltis_casa, penaltisVisitante: l.penaltis_visitante } : {}),
      cartoesCasa: { amarelos: l.amarelos_casa, vermelhos: l.vermelhos_casa },
      cartoesVisitante: { amarelos: l.amarelos_visitante, vermelhos: l.vermelhos_visitante },
    }
  }
  return {
    id: l.id,
    edicao: l.edicao_id,
    fase: l.fase,
    grupo: l.grupo,
    rodada: l.rodada,
    confronto: l.confronto,
    jogo: l.jogo,
    casa: l.casa,
    visitante: l.visitante,
    passo: l.passo,
    resultado,
  }
}

export function temporadaExiste(sql: Sql, temporada: number): boolean {
  return (sql.get<{ n: number }>('SELECT COUNT(*) n FROM edicao WHERE temporada = ?', temporada)?.n ?? 0) > 0
}

export function carregarTemporada(sql: Sql, temporada: number, passoAtual: number): EstadoTemporada {
  const passos = sql.all<Passo>('SELECT indice, dia, semana, tipo FROM passo WHERE temporada = ? ORDER BY indice', temporada)
  const edicoes = sql.all<{ estado: string }>('SELECT estado FROM edicao WHERE temporada = ? ORDER BY rowid', temporada).map((e) => JSON.parse(e.estado) as EstadoEdicao)
  const partidas = sql.all<LinhaPartida>('SELECT * FROM partida WHERE temporada = ? ORDER BY passo, rowid', temporada).map(paraPartida)
  const reservadas = sql
    .all<{ edicao_id: string; fase: string; rodada: number; jogo: number; passo: number; possiveis: string }>(
      `SELECT r.* FROM rodada_reservada r JOIN edicao e ON e.id = r.edicao_id WHERE e.temporada = ? ORDER BY r.passo`,
      temporada,
    )
    .map((r) => ({ edicao: r.edicao_id, fase: r.fase, rodada: r.rodada, jogo: r.jogo, passo: r.passo, possiveis: JSON.parse(r.possiveis) as string[], confrontos: null }))
  return { temporada, passos, passoAtual, edicoes, partidas, reservadas }
}

function inserirPartida(sql: Sql, temporada: number, p: Partida): void {
  sql.run(
    `INSERT INTO partida (id, temporada, edicao_id, fase, grupo, rodada, confronto, jogo, passo, casa, visitante)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    p.id, temporada, p.edicao, p.fase, p.grupo, p.rodada, p.confronto, p.jogo, p.passo, p.casa, p.visitante,
  )
}

export function gravarTemporadaNova(sql: Sql, e: EstadoTemporada, competicaoDe: (edicao: string) => string): void {
  for (const p of e.passos) sql.run('INSERT INTO passo (temporada, indice, dia, semana, tipo) VALUES (?, ?, ?, ?, ?)', e.temporada, p.indice, p.dia, p.semana, p.tipo)
  for (const ed of e.edicoes) {
    sql.run('INSERT INTO edicao (id, competicao_id, temporada, campeao, estado) VALUES (?, ?, ?, ?, ?)', ed.id, competicaoDe(ed.id), e.temporada, ed.campeao, JSON.stringify(ed))
  }
  for (const p of e.partidas) inserirPartida(sql, e.temporada, p)
  for (const r of e.reservadas) {
    sql.run('INSERT INTO rodada_reservada (edicao_id, fase, rodada, jogo, passo, possiveis) VALUES (?, ?, ?, ?, ?, ?)', r.edicao, r.fase, r.rodada, r.jogo, r.passo, JSON.stringify(r.possiveis))
  }
}

export function gravarResultado(sql: Sql, p: Partida, modo: string, origem: string): void {
  const r = p.resultado
  if (!r) throw new Error(`Partida ${p.id} sem resultado`)
  sql.run(
    `UPDATE partida SET gols_casa = ?, gols_visitante = ?, prorrogacao = ?, penaltis_casa = ?, penaltis_visitante = ?,
       amarelos_casa = ?, vermelhos_casa = ?, amarelos_visitante = ?, vermelhos_visitante = ?, modo = ?, origem = ?
     WHERE id = ?`,
    r.golsCasa, r.golsVisitante, r.prorrogacao ?? false, r.penaltisCasa, r.penaltisVisitante,
    r.cartoesCasa?.amarelos ?? 0, r.cartoesCasa?.vermelhos ?? 0, r.cartoesVisitante?.amarelos ?? 0, r.cartoesVisitante?.vermelhos ?? 0,
    modo, origem, p.id,
  )
  if (r.detalhe) gravarDetalhe(sql, p, r.detalhe)
}

/** Ids de jogador no núcleo = id da tabela `jogador` como texto. */
const idJogador = (id: string | null | undefined) => (id ? Number(id) : null)

function gravarDetalhe(sql: Sql, p: Partida, d: DetalhePartida): void {
  const sigla = (lado: 'casa' | 'visitante') => (lado === 'casa' ? p.casa : p.visitante)
  d.eventos.forEach((e, ordem) => {
    let jogador: string | null = null
    let outro: string | null = null
    let detalhe: string | null = null
    if (e.tipo === 'gol') {
      jogador = e.jogador
      outro = e.assistencia
      detalhe = e.cabeca ? 'cabeca' : null
    } else if (e.tipo === 'amarelo' || e.tipo === 'vermelho') {
      jogador = e.jogador
      detalhe = e.tipo === 'vermelho' && e.segundoAmarelo ? 'segundo_amarelo' : null
    } else if (e.tipo === 'lesao') {
      jogador = e.jogador
      detalhe = JSON.stringify({ gravidade: e.gravidade, semanas: e.semanas })
    } else if (e.tipo === 'substituicao') {
      jogador = e.sai
      outro = e.entra
      detalhe = e.motivo
    }
    sql.run(
      'INSERT INTO evento_partida (partida_id, ordem, minuto, acrescimo, tipo, time, jogador_id, outro_id, detalhe) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      p.id, ordem, e.minuto, e.acrescimo, e.tipo, sigla(e.lado), idJogador(jogador), idJogador(outro), detalhe,
    )
  })
  for (const part of d.participacoes) {
    sql.run(
      `INSERT INTO escalacao_partida (partida_id, jogador_id, time, titular, posicao, vaga, camisa, minutos, entrou_aos, saiu_aos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      p.id, idJogador(part.jogador), sigla(part.lado), part.titular, part.posicao, part.vaga, part.camisa, part.minutos, part.entrouAos, part.saiuAos,
    )
  }
}

/** Grava o que um passo mudou: resultados, partidas novas, reservas usadas e o estado das edições. */
export function gravarPasso(
  sql: Sql,
  e: EstadoTemporada,
  jogadas: readonly Partida[],
  criadas: readonly Partida[],
  origemDe: (p: Partida) => { modo: string; origem: string },
): void {
  for (const p of jogadas) {
    const o = origemDe(p)
    gravarResultado(sql, p, o.modo, o.origem)
  }
  for (const p of criadas) {
    inserirPartida(sql, e.temporada, p)
    sql.run('DELETE FROM rodada_reservada WHERE edicao_id = ? AND fase = ? AND rodada = ? AND jogo = ?', p.edicao, p.fase, p.rodada, p.jogo)
  }
  for (const ed of e.edicoes) sql.run('UPDATE edicao SET estado = ?, campeao = ? WHERE id = ?', JSON.stringify(ed), ed.campeao, ed.id)
  // Semana atual = a do último passo jogado.
  const ultimo = e.passos[e.passoAtual - 1]
  sql.run('UPDATE carreira SET passo_atual = ?, semana_atual = ?', e.passoAtual, ultimo?.semana ?? 1)
}
