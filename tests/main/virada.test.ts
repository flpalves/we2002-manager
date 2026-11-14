import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Carreiras } from '../../src/main/carreira/servico'
import { calendario } from '../../src/main/carreira/temporada'
import { previaVirada, relatorioTemporada, virarTemporada } from '../../src/main/carreira/virada'
import { buscar, propor } from '../../src/main/carreira/mercado'
import { exterior } from '../fixtures/pacote'
import type { Sql } from '../../src/main/db/sql'
import { avancar } from '../helpers/avancar'
import { escreverPacote } from '../helpers/pacote'
import { jogarTemporada, novaCarreira, pacoteDuasDivisoes } from '../helpers/duasDivisoes'
import type { Competicao } from '@shared/esquemas/pacote'

const timesDe = (sql: Sql, id: string): string[] => {
  const p = (JSON.parse(sql.get<{ definicao: string }>('SELECT definicao FROM competicao WHERE id = ?', id)!.definicao) as Competicao).participantes
  return p.regra === 'lista' ? [...p.times].sort() : []
}

describe('virada de temporada (serviço + SQLite)', () => {
  let carreiras: Carreiras
  let sql: Sql

  beforeEach(() => {
    const base = mkdtempSync(join(tmpdir(), 'we-virada-'))
    escreverPacote(join(base, 'pacotes', 'teste'), pacoteDuasDivisoes())
    carreiras = novaCarreira(base)
    sql = carreiras.sql()
  })

  it('não vira com a temporada em andamento', () => {
    expect(() => virarTemporada(sql)).toThrow(/ainda não acabou/)
    expect(() => previaVirada(sql)).toThrow(/ainda não acabou/)
  })

  it('primeira virada: acesso/rebaixamento, metas fechadas, idade +1, calendário novo e relatório gravado', () => {
    jogarTemporada(sql)
    const previa = previaVirada(sql)
    expect(previa.temporada).toBe(2026)
    expect(previa.contratosAcabando).toEqual([]) // contratos do pacote vão até 2027
    expect(previa.campeoes.map((c) => c.competicao).sort()).toEqual(['Série A', 'Série B'])
    expect(previa.movimentos).toHaveLength(4)

    const finais = Object.fromEntries(
      sql
        .all<{ competicao_id: string; estado: string }>('SELECT competicao_id, estado FROM edicao WHERE temporada = 2026')
        .map((e) => [e.competicao_id, (JSON.parse(e.estado) as { classificacaoFinal: string[] }).classificacaoFinal]),
    )
    const idadeAntes = sql.get<{ idade: number }>('SELECT idade FROM jogador WHERE id = 1')!.idade

    const r = virarTemporada(sql)
    expect(r.temporada).toBe(2026)
    expect(r.proximaTemporada).toBe(2027)
    expect(r.metas.length).toBeGreaterThan(0)
    expect(relatorioTemporada(sql, 2026)).toEqual(r)

    expect(timesDe(sql, 'a')).toEqual([...finais['a']!.slice(0, 2), ...finais['b']!.slice(0, 2)].sort())
    expect(timesDe(sql, 'b')).toEqual([...finais['a']!.slice(2), ...finais['b']!.slice(2)].sort())

    expect(sql.get('SELECT temporada_atual, passo_atual FROM carreira')).toMatchObject({ temporada_atual: 2027, passo_atual: 0 })
    const cal = calendario(sql)
    expect(cal.temporada).toBe(2027)
    expect(cal.encerrada).toBe(false)
    expect(cal.passos.length).toBeGreaterThan(0)
    expect(sql.get<{ idade: number }>('SELECT idade FROM jogador WHERE id = 1')!.idade).toBe(idadeAntes + 1)
    expect(sql.get<{ n: number }>("SELECT COUNT(*) n FROM meta_diretoria WHERE temporada = 2026 AND status = 'andamento'")!.n).toBe(0)
    expect(sql.get<{ n: number }>('SELECT COUNT(*) n FROM meta_diretoria WHERE temporada = 2027')!.n).toBeGreaterThan(0)
    expect(sql.get<{ n: number }>('SELECT COUNT(*) n FROM disciplina WHERE amarelos > 0')!.n).toBe(0)
    // Virar de novo antes de jogar a temporada nova não é possível.
    expect(() => virarTemporada(sql)).toThrow(/ainda não acabou/)
  })

  it('a escada do divisoes.json move os times mesmo sem saídas nas competições', () => {
    const base = mkdtempSync(join(tmpdir(), 'we-virada-escada-'))
    const p = pacoteDuasDivisoes()
    p.competicoes = p.competicoes.map((c) => ({ ...c, saidas: [] }))
    p.divisoes = { divisoes: [{ competicao: 'a' }, { competicao: 'b', troca: 2 }] }
    escreverPacote(join(base, 'pacotes', 'teste'), p)
    const sql2 = novaCarreira(base).sql()
    jogarTemporada(sql2)
    const finais = Object.fromEntries(
      sql2
        .all<{ competicao_id: string; estado: string }>('SELECT competicao_id, estado FROM edicao WHERE temporada = 2026')
        .map((e) => [e.competicao_id, (JSON.parse(e.estado) as { classificacaoFinal: string[] }).classificacaoFinal]),
    )
    expect(previaVirada(sql2).movimentos).toHaveLength(4)
    virarTemporada(sql2)
    expect(timesDe(sql2, 'a')).toEqual([...finais['a']!.slice(0, 2), ...finais['b']!.slice(0, 2)].sort())
    expect(timesDe(sql2, 'b')).toEqual([...finais['a']!.slice(2), ...finais['b']!.slice(2)].sort())
  })

  it('empréstimo volta ao clube de origem na virada', () => {
    const id = sql.get<{ id: number }>("SELECT j.id FROM jogador j JOIN time t ON t.id = j.time_id WHERE t.sigla = 'BBB' ORDER BY j.id LIMIT 1")!.id
    sql.run("UPDATE jogador SET time_id = (SELECT id FROM time WHERE sigla = 'AAA'), camisa = 30 WHERE id = ?", id)
    sql.run(
      "UPDATE contrato SET time_id = (SELECT id FROM time WHERE sigla = 'AAA'), tipo = 'emprestimo', time_origem_id = (SELECT id FROM time WHERE sigla = 'BBB'), ate_temporada = 2026 WHERE jogador_id = ?",
      id,
    )
    jogarTemporada(sql)
    const r = virarTemporada(sql)
    expect(r.saidas).toHaveLength(1)
    const j = sql.get('SELECT t.sigla, c.tipo, c.ate_temporada ate FROM jogador j JOIN time t ON t.id = j.time_id JOIN contrato c ON c.jogador_id = j.id WHERE j.id = ?', id)
    expect(j).toEqual({ sigla: 'BBB', tipo: 'definitivo', ate: 2028 })
  })

  it('segunda virada: contratos do usuário que acabam saem, mas o elenco fica no mínimo; ninguém abaixo do mínimo', () => {
    jogarTemporada(sql)
    virarTemporada(sql)
    jogarTemporada(sql)
    const previa = previaVirada(sql)
    expect(previa.contratosAcabando).toHaveLength(25)
    expect(previa.elencoAtual).toBe(25)
    const r = virarTemporada(sql)
    expect(r.saidas).toHaveLength(2)
    expect(r.renovadosPelaDiretoria).toHaveLength(23)
    const elencos = sql.all<{ sigla: string; n: number; gk: number }>(
      "SELECT t.sigla, COUNT(j.id) n, SUM(j.posicao = 'GK') gk FROM time t LEFT JOIN jogador j ON j.time_id = t.id AND j.status = 'ativo' GROUP BY t.sigla",
    )
    for (const e of elencos) {
      expect(e.n).toBeGreaterThanOrEqual(23)
      expect(e.gk).toBeGreaterThanOrEqual(2)
    }
    expect(sql.get<{ n: number }>("SELECT COUNT(*) n FROM jogador WHERE status = 'livre' AND time_id IS NULL")!.n).toBeGreaterThanOrEqual(2)
    expect(sql.get<{ n: number }>('SELECT COUNT(*) n FROM contrato WHERE ate_temporada <= 2027')!.n).toBe(0)
    // Quem saiu fica registrado por clube para a IA de mercado repor na janela principal.
    const saidas = sql.all<{ time: string; n: number }>("SELECT time, COUNT(*) n FROM saida_elenco WHERE temporada = 2028 AND motivo = 'fim_contrato' GROUP BY time")
    expect(saidas.find((x) => x.time === 'AAA')?.n).toBe(2)
    expect(saidas.reduce((a, x) => a + x.n, 0)).toBe(sql.get<{ n: number }>("SELECT COUNT(*) n FROM jogador WHERE status = 'livre' AND time_id IS NULL")!.n)
    // A terceira temporada anda.
    avancar(sql)
    expect(calendario(sql)).toMatchObject({ temporada: 2028, encerrada: false })
    expect(calendario(sql).passoAtual).toBeGreaterThan(0)
  })

  it('renovar depois do fim da temporada tira o jogador da pendência e ele fica', () => {
    jogarTemporada(sql)
    virarTemporada(sql)
    jogarTemporada(sql)
    const [j] = previaVirada(sql).contratosAcabando
    const n = propor(sql, { jogadorId: j!.id, tipo: 'renovacao', salario: 30_000_000, temporadas: 3 })
    expect(n.etapa).toBe('concluida')
    const previa = previaVirada(sql)
    expect(previa.contratosAcabando.map((x) => x.id)).not.toContain(j!.id)
    const r = virarTemporada(sql)
    expect([...r.saidas, ...r.renovadosPelaDiretoria]).not.toContain(j!.nome)
    expect(sql.get('SELECT ate_temporada ate FROM contrato WHERE jogador_id = ?', Number(j!.id))).toEqual({ ate: 2030 })
  })

  it('mesma semente, mesmas duas temporadas (relatórios idênticos)', () => {
    const rodar = (c: Carreiras) => {
      const s = c.sql()
      jogarTemporada(s)
      const r1 = virarTemporada(s)
      jogarTemporada(s)
      const r2 = virarTemporada(s)
      return [r1, r2]
    }
    const primeira = rodar(carreiras)
    const base2 = mkdtempSync(join(tmpdir(), 'we-virada-'))
    escreverPacote(join(base2, 'pacotes', 'teste'), pacoteDuasDivisoes())
    expect(rodar(novaCarreira(base2))).toEqual(primeira)
  })
})

describe('virada: disponíveis do exterior (9.2)', () => {
  // Taxa alta: ninguém da CPU compra durante a temporada e o pool chega inteiro à virada.
  const TAXA = 10_000_000_000

  it('o pool diminui, as taxas de quem passou de faixa de idade caem e quem sai não aparece na busca', () => {
    const base = mkdtempSync(join(tmpdir(), 'we-virada-ext-'))
    const jogadores = Array.from({ length: 40 }, (_, i) => exterior(i + 1, { idade: i < 20 ? 27 : 35, taxa: TAXA }))
    escreverPacote(join(base, 'pacotes', 'teste'), { ...pacoteDuasDivisoes(), exterior: { temporada: 2026, jogadores } })
    const sql = novaCarreira(base).sql()
    jogarTemporada(sql)
    const antes = sql.get<{ n: number }>("SELECT COUNT(*) n FROM jogador WHERE status = 'exterior'")!.n
    expect(antes).toBe(40)

    virarTemporada(sql)
    const pool = sql.all<{ id: number; idade: number; taxa_fixa: number }>("SELECT id, idade, taxa_fixa FROM jogador WHERE status = 'exterior'")
    const fora = sql.all<{ id: number }>("SELECT id FROM jogador WHERE status = 'fora'").map((j) => String(j.id))
    expect(pool.length).toBeLessThan(antes)
    expect(pool.length + fora.length).toBe(antes)
    // 27 → 28: f_idade 1 → 0,85; 35 → 36 fica na mesma faixa (0,3).
    for (const j of pool) expect(j.taxa_fixa).toBe(j.idade === 28 ? 8_500_000_000 : TAXA)
    expect(pool.some((j) => j.idade === 28)).toBe(true)
    const ids = new Set(buscar(sql, {}).map((j) => j.id))
    expect(fora.some((id) => ids.has(id))).toBe(false)
    expect(buscar(sql, { somenteExterior: true })).toHaveLength(pool.length)
  }, 120_000)
})
