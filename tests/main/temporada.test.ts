import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Carreiras } from '../../src/main/carreira/servico'
import { artilharia, calendario, continuar, detalheEdicao, edicoes, jogarDataDoUsuario, sumula, times } from '../../src/main/carreira/temporada'
import { avancar } from '../helpers/avancar'
import { lerResumo } from '../../src/main/db/repositorios/carreira'
import { abrirNodeSqlite } from '../helpers/sqlite'
import { pacote as fixture, time } from '../fixtures/pacote'
import { escreverPacote } from '../helpers/pacote'

describe('temporada na carreira (serviço + SQLite)', () => {
  let carreiras: Carreiras
  let base: string

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'we-temporada-'))
    const p = fixture({ times: ['AAA', 'BBB', 'CCC', 'DDD'].map((s) => time(s)) })
    escreverPacote(join(base, 'pacotes', 'teste'), p)
    let n = 0
    carreiras = new Carreiras({
      pastaCarreiras: () => join(base, 'carreiras'),
      pastaPacotes: () => join(base, 'pacotes'),
      abrirBanco: abrirNodeSqlite,
      lerResumoArquivo: () => null,
      sementeNova: () => 99,
      agora: () => '2026-11-12T00:00:00Z',
      sufixoId: () => `t${++n}`,
    })
    carreiras.criar({ pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'T', dificuldade: 'normal' })
  })

  it('a carreira nova já tem o calendário da temporada (turno e returno de 4 = 6 rodadas)', () => {
    const cal = calendario(carreiras.sql())
    expect(cal.passos).toHaveLength(6)
    expect(cal.passos.every((p) => p.tipo === 'fds' && p.semana >= 10 && p.semana <= 40)).toBe(true)
    expect(cal.passos.every((p) => p.jogo !== null)).toBe(true)
    expect(cal.passoAtual).toBe(0)
    expect(times(carreiras.sql()).map((t) => t.sigla)).toEqual(['AAA', 'BBB', 'CCC', 'DDD'])
  })

  it('Continuar joga até o jogo do usuário, grava e atualiza a semana', () => {
    const r = avancar(carreiras.sql())
    expect(r.passosJogados).toBe(1)
    expect(r.jogoDoUsuario?.placar).not.toBeNull()
    expect([r.jogoDoUsuario!.casa, r.jogoDoUsuario!.visitante]).toContain('AAA')
    const sql = carreiras.sql()
    expect(sql.get<{ n: number }>('SELECT COUNT(*) n FROM partida WHERE gols_casa IS NOT NULL')?.n).toBe(2)
    expect(sql.get<{ origem: string }>('SELECT origem FROM partida WHERE gols_casa IS NOT NULL')?.origem).toBe('motor')
    expect(lerResumo(sql)?.semana_atual).toBe(calendario(sql).passos[0]!.semana)
  })

  it('temporada inteira até o fim, com campeão e tabela coerente', () => {
    let r = avancar(carreiras.sql())
    let voltas = 1
    while (!r.encerrada) {
      r = avancar(carreiras.sql())
      voltas++
    }
    expect(voltas).toBe(6)
    expect(r.campeoes).toHaveLength(1)
    const [ed] = edicoes(carreiras.sql())
    expect(ed!.campeao).toBe(r.campeoes[0]!.time)
    const det = detalheEdicao(carreiras.sql(), ed!.id)
    const linhas = det.fases[0]!.tabelas[0]!.linhas
    expect(linhas[0]!.time).toBe(ed!.campeao)
    expect(linhas.every((l) => l.jogos === 6)).toBe(true)
    expect(det.fases[0]!.rodadas).toHaveLength(6)
  })

  it('grava súmula do motor: eventos, escalações, condição e disciplina', () => {
    avancar(carreiras.sql())
    avancar(carreiras.sql())
    const sql = carreiras.sql()
    const partidas = sql.all<{ id: string; gols_casa: number; gols_visitante: number }>('SELECT id, gols_casa, gols_visitante FROM partida WHERE gols_casa IS NOT NULL')
    expect(partidas.length).toBe(4)
    for (const p of partidas) {
      const gols = sql.get<{ n: number }>("SELECT COUNT(*) n FROM evento_partida WHERE partida_id = ? AND tipo = 'gol'", p.id)!.n
      expect(gols).toBe(p.gols_casa + p.gols_visitante)
      const titulares = sql.get<{ n: number }>('SELECT COUNT(*) n FROM escalacao_partida WHERE partida_id = ? AND titular = 1', p.id)!.n
      expect(titulares).toBe(22)
    }
    // Quem jogou gastou condição (e recuperou um pouco até a data seguinte).
    expect(sql.get<{ n: number }>('SELECT COUNT(*) n FROM jogador WHERE condicao < 100')!.n).toBeGreaterThan(0)
    const amarelos = sql.get<{ n: number }>("SELECT COUNT(*) n FROM evento_partida WHERE tipo = 'amarelo'")!.n
    const disciplina = sql.get<{ n: number }>('SELECT COUNT(*) n FROM disciplina')!.n
    if (amarelos > 0) expect(disciplina).toBeGreaterThan(0)
  })

  it('o estado persiste: fechar e abrir de novo continua de onde parou', () => {
    avancar(carreiras.sql())
    avancar(carreiras.sql())
    const id = carreiras.resumoAtual()!.id
    carreiras.fechar()
    carreiras.abrir(id)
    expect(calendario(carreiras.sql()).passoAtual).toBe(2)
    const r = avancar(carreiras.sql())
    expect(r.passosJogados).toBe(1)
  })
})

describe('súmula e artilharia', () => {
  it('a súmula traz eventos e atuações; a artilharia soma os gols', async () => {
    const { mkdtempSync } = await import('node:fs')
    const base = mkdtempSync(join(tmpdir(), 'we-sumula-'))
    escreverPacote(join(base, 'pacotes', 'teste'), fixture({ times: ['AAA', 'BBB', 'CCC', 'DDD'].map((s) => time(s)) }))
    const c = new Carreiras({
      pastaCarreiras: () => join(base, 'carreiras'),
      pastaPacotes: () => join(base, 'pacotes'),
      abrirBanco: abrirNodeSqlite,
      lerResumoArquivo: () => null,
      sementeNova: () => 5,
      agora: () => '2026-11-12T00:00:00Z',
      sufixoId: () => 's1',
    })
    c.criar({ pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'S', dificuldade: 'normal' })
    let r = avancar(c.sql())
    while (!r.encerrada) r = avancar(c.sql())
    const s = sumula(c.sql(), r.jogoDoUsuario!.id)
    expect(s.casa.filter((a) => a.titular)).toHaveLength(11)
    expect(s.eventos.filter((e) => e.tipo === 'gol')).toHaveLength(s.jogo.placar!.golsCasa + s.jogo.placar!.golsVisitante)
    const [ed] = edicoes(c.sql())
    const art = artilharia(c.sql(), ed!.id)
    const totalGols = c.sql().get<{ n: number }>('SELECT SUM(gols_casa + gols_visitante) n FROM partida')!.n
    expect(art.reduce((a, x) => a + x.gols, 0)).toBeLessThanOrEqual(totalGols)
    for (let i = 1; i < art.length; i++) expect(art[i - 1]!.gols).toBeGreaterThanOrEqual(art[i]!.gols)
  })
})

describe('pré-jogo: o Continuar para antes do jogo do usuário', () => {
  it('para com o jogo pendente; o resultado de fora entra com o modo certo', async () => {
    const { mkdtempSync } = await import('node:fs')
    const base = mkdtempSync(join(tmpdir(), 'we-prejogo-'))
    escreverPacote(join(base, 'pacotes', 'teste'), fixture({ times: ['AAA', 'BBB', 'CCC', 'DDD'].map((s) => time(s)) }))
    const c = new Carreiras({
      pastaCarreiras: () => join(base, 'carreiras'),
      pastaPacotes: () => join(base, 'pacotes'),
      abrirBanco: abrirNodeSqlite,
      lerResumoArquivo: () => null,
      sementeNova: () => 9,
      agora: () => '2026-11-13T00:00:00Z',
      sufixoId: () => 'p1',
    })
    c.criar({ pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'P', dificuldade: 'normal' })
    const r = continuar(c.sql())
    expect(r.preJogo).not.toBeNull()
    expect(r.jogoDoUsuario).toBeNull()
    // Continuar de novo não pula o jogo
    expect(continuar(c.sql()).preJogo?.id).toBe(r.preJogo!.id)
    const j = jogarDataDoUsuario(c.sql(), { resultado: { golsCasa: 3, golsVisitante: 1 }, modo: 'manual', origem: 'usuario' })
    expect(j.jogoDoUsuario?.placar).toMatchObject({ golsCasa: 3, golsVisitante: 1 })
    const linha = c.sql().get<{ modo: string; origem: string }>('SELECT modo, origem FROM partida WHERE id = ?', r.preJogo!.id)
    expect(linha).toEqual({ modo: 'manual', origem: 'usuario' })
    // o outro jogo da data foi simulado pelo motor
    expect(c.sql().get<{ n: number }>("SELECT COUNT(*) n FROM partida WHERE origem = 'motor'")!.n).toBe(1)
  })
})
