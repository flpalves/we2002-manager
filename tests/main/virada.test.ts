import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Carreiras } from '../../src/main/carreira/servico'
import { calendario } from '../../src/main/carreira/temporada'
import { previaVirada, relatorioTemporada, virarTemporada } from '../../src/main/carreira/virada'
import { buscar, propor } from '../../src/main/carreira/mercado'
import { exterior, livre, time } from '../fixtures/pacote'
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

  it('orçamento pela divisão: quem cai tem o orçamento da folha cortado, quem sobe ganha; patrocínio não muda', () => {
    // As ligas do pacote de teste são 'a' e 'b': o fator da divisão vem das regras da carreira.
    sql.run(`UPDATE regras SET dados = json_set(dados, '$.financas.orcamento_divisao.liga', json('{"a":1,"b":0.5}'))`)
    jogarTemporada(sql)
    const antes = new Map(
      sql.all<{ sigla: string; orcamento_folha_mensal: number; patrocinio_temporada: number }>('SELECT sigla, orcamento_folha_mensal, patrocinio_temporada FROM time').map((t) => [t.sigla, t]),
    )
    const deA = timesDe(sql, 'a')
    virarTemporada(sql)
    const depoisA = new Set(timesDe(sql, 'a'))
    const saldo = new Map(sql.all<{ sigla: string; saldo: number }>('SELECT sigla, saldo FROM time').map((t) => [t.sigla, t.saldo]))
    for (const t of sql.all<{ sigla: string; orcamento_folha_mensal: number; patrocinio_temporada: number }>('SELECT sigla, orcamento_folha_mensal, patrocinio_temporada FROM time')) {
      const a = antes.get(t.sigla)!
      const fator = deA.includes(t.sigla) === depoisA.has(t.sigla) ? 1 : depoisA.has(t.sigla) ? 2 : 0.5
      expect(t.orcamento_folha_mensal).toBe(Math.round((a.orcamento_folha_mensal * fator) / 100_000) * 100_000 || a.orcamento_folha_mensal * fator)
      expect(t.patrocinio_temporada).toBe(a.patrocinio_temporada)
    }
    expect([...depoisA].some((s) => !deA.includes(s))).toBe(true)
    expect(saldo.size).toBe(antes.size)
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

  it('segunda divisão fantasma: o pior do estadual cai e sobe um clube do estado configurado', () => {
    const base = mkdtempSync(join(tmpdir(), 'we-virada-fantasma-'))
    const p = pacoteDuasDivisoes()
    p.times = [...p.times, time('III'), time('JJJ', { estado: 'RJ' })]
    p.escudos = p.times.map((t) => t.sigla)
    p.competicoes = p.competicoes.map((c) => (c.id === 'b' ? { ...c, nome: 'Paulistão', tipo: 'estadual' as const, segunda_divisao: { troca: 1, nome: 'Série A2', estados: ['RJ'] } } : c))
    escreverPacote(join(base, 'pacotes', 'teste'), p)
    const sql2 = novaCarreira(base).sql()
    jogarTemporada(sql2)
    const finais = Object.fromEntries(
      sql2
        .all<{ competicao_id: string; estado: string }>('SELECT competicao_id, estado FROM edicao WHERE temporada = 2026')
        .map((e) => [e.competicao_id, (JSON.parse(e.estado) as { classificacaoFinal: string[] }).classificacaoFinal]),
    )
    const previa = previaVirada(sql2)
    // Só sobe quem é do RJ: JJJ (os outros são de SP).
    expect(previa.movimentos).toContainEqual({ time: finais['b']![3], de: 'Paulistão', para: 'Série A2', tipo: 'rebaixamento' })
    expect(previa.movimentos).toContainEqual({ time: 'JJJ', de: 'Série A2', para: 'Paulistão', tipo: 'acesso' })
    virarTemporada(sql2)
    expect(timesDe(sql2, 'b')).toEqual([...finais['a']!.slice(2), finais['b']![2]!, 'JJJ'].sort())
  })

  it('Série D por vagas: estadual do mesmo ano define os participantes e a virada guarda só os garantidos', () => {
    const base = mkdtempSync(join(tmpdir(), 'we-virada-serie-d-'))
    const p = pacoteDuasDivisoes()
    const extras = ['III', 'JJJ', 'KKK', 'LLL']
    p.times = [...p.times, ...extras.map((s) => time(s))]
    p.escudos = p.times.map((t) => t.sigla)
    const liga1: Competicao['fases'] = [{ id: 'f1', nome: 'Turno', formato: 'pontos_corridos', pontos_corridos: { turnos: 1 } }]
    p.competicoes = [
      ...p.competicoes.map((c) => (c.id === 'b' ? { ...c, saidas: [...(c.saidas ?? []), { ultimos: 1, destino: 'd', tipo: 'rebaixamento' }] } : c)),
      {
        id: 'est',
        nome: 'Estadual',
        tipo: 'estadual',
        participantes: { regra: 'lista', times: ['EEE', 'FFF', 'GGG', 'HHH', ...extras] },
        fases: liga1,
        saidas: [{ primeiros: 2, destino: 'd', exceto_de: ['a', 'b'] }],
      },
      { id: 'd', nome: 'Série D', tipo: 'nacional', participantes: { regra: 'lista', times: [], quantidade: 4, por_vagas: true }, fases: liga1 },
    ]
    p.temporada = {
      blocos: [
        { competicao: 'est', datas: 'fds', semana_inicio: 2, semana_fim: 9 },
        { competicao: 'a', datas: 'fds', semana_inicio: 10, semana_fim: 40 },
        { competicao: 'b', datas: 'fds', semana_inicio: 10, semana_fim: 40 },
        { competicao: 'd', datas: 'meio', semana_inicio: 12, semana_fim: 40 },
      ],
    }
    escreverPacote(join(base, 'pacotes', 'teste'), p)
    const sql2 = novaCarreira(base).sql()
    expect(sql2.get<{ n: number }>("SELECT COUNT(*) n FROM rodada_reservada WHERE edicao_id = 'd-2026'")!.n).toBeGreaterThan(0)
    jogarTemporada(sql2)
    const estado = (id: string) => JSON.parse(sql2.get<{ estado: string }>('SELECT estado FROM edicao WHERE id = ?', id)!.estado) as { participantes: string[]; classificacaoFinal: string[] | null; campeao: string | null }
    const d = estado('d-2026')
    // Os 4 do estadual que não jogam a A nem a B: as 2 vagas e os 2 próximos.
    expect([...d.participantes].sort()).toEqual([...extras].sort())
    expect(d.campeao).not.toBeNull()
    expect(sql2.get<{ n: number }>("SELECT COUNT(*) n FROM partida WHERE edicao_id = 'd-2026' AND gols_casa IS NOT NULL")!.n).toBe(6)
    expect(sql2.get<{ n: number }>('SELECT COUNT(*) n FROM rodada_reservada')!.n).toBe(0)
    const ultimoDaB = estado('b-2026').classificacaoFinal!.at(-1)!
    virarTemporada(sql2)
    // Na próxima temporada a D começa só com o rebaixado da B (o resto vem do estadual de 2027).
    expect(timesDe(sql2, 'd')).toEqual([ultimoDaB])
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

  it('segunda virada: pré-contratos levam jogadores do usuário, o resto sai livre; a semana 1 deixa todo mundo com 23 e 2 goleiros', () => {
    // Livres no pacote (goleiros inclusive) para a semana 1 ter de onde completar.
    const base = mkdtempSync(join(tmpdir(), 'we-virada-livres-'))
    const p = pacoteDuasDivisoes()
    p.livres = { jogadores: Array.from({ length: 30 }, (_, i) => livre(i + 1, i < 10 ? { posicao: 'GK', posicao_secundaria: null } : {})) }
    escreverPacote(join(base, 'pacotes', 'teste'), p)
    const sql = novaCarreira(base).sql()
    jogarTemporada(sql)
    virarTemporada(sql)
    jogarTemporada(sql)
    const previa = previaVirada(sql)
    expect(previa.contratosAcabando).toHaveLength(25)
    expect(previa.elencoAtual).toBe(25)
    // A temporada do pacote acaba na semana 40: o prazo de renovação ainda está aberto.
    expect(previa.renovacaoAberta).toBe(true)
    const r = virarTemporada(sql)
    const levados = sql.all<{ id: number; para: string }>("SELECT jogador_id id, para FROM pre_contrato WHERE temporada = 2027 AND de = 'AAA'")
    // A virada é a última data dos pré-contratos: a CPU leva alguns do usuário (sem renovação, todos em fim de contrato).
    expect(levados.length).toBeGreaterThan(0)
    for (const x of levados) expect(sql.get<{ sigla: string }>('SELECT t.sigla FROM jogador j JOIN time t ON t.id = j.time_id WHERE j.id = ?', x.id)!.sigla).toBe(x.para)
    expect(sql.get<{ n: number }>("SELECT COUNT(*) n FROM transferencia WHERE temporada = 2027 AND tipo = 'pre_contrato' AND de = 'AAA'")!.n).toBe(levados.length)
    // O resto: a diretoria segura o mínimo (renova por 1 temporada) e quem passa dele sai livre.
    expect(r.saidas.length).toBeGreaterThanOrEqual(levados.length)
    expect(r.renovadosPelaDiretoria.length).toBe(Math.min(25 - levados.length, 23))
    const elencos = sql.all<{ sigla: string; n: number; gk: number }>(
      "SELECT t.sigla, COUNT(j.id) n, SUM(j.posicao = 'GK') gk FROM time t LEFT JOIN jogador j ON j.time_id = t.id AND j.status = 'ativo' GROUP BY t.sigla",
    )
    for (const e of elencos) {
      expect(e.n).toBeGreaterThanOrEqual(23)
      expect(e.gk).toBeGreaterThanOrEqual(2)
    }
    // Contratos que acabavam: renovados, transferidos por pré-contrato ou encerrados.
    expect(sql.get<{ n: number }>('SELECT COUNT(*) n FROM contrato WHERE ate_temporada <= 2027')!.n).toBe(0)
    // Quem saiu fica registrado por clube para a IA de mercado repor na janela principal.
    const saidas = sql.all<{ time: string; motivo: string; n: number }>('SELECT time, motivo, COUNT(*) n FROM saida_elenco WHERE temporada = 2028 GROUP BY time, motivo')
    expect(saidas.find((x) => x.time === 'AAA' && x.motivo === 'pre_contrato')?.n).toBe(levados.length)
    expect(saidas.find((x) => x.time === 'AAA' && x.motivo === 'fim_contrato')?.n ?? 0).toBe(r.saidas.length - levados.length)
    // Semana 1: quem completou o elenco tem a transferência de livre na semana 1.
    expect(sql.get<{ n: number }>("SELECT COUNT(*) n FROM transferencia WHERE temporada = 2028 AND semana = 1 AND tipo = 'livre'")!.n).toBeGreaterThan(0)
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

  it('mesma semente, mesmas duas temporadas (relatórios idênticos)', { timeout: 30_000 }, () => {
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
    const jogadores = Array.from({ length: 40 }, (_, i) => exterior(i + 1, { idade: i < 20 ? 28 : 38, taxa: TAXA }))
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
    // 28 → 29: f_idade 1 → 0,92; 38 → 39 fica na mesma faixa (0,12).
    for (const j of pool) expect(j.taxa_fixa).toBe(j.idade === 29 ? 9_200_000_000 : TAXA)
    expect(pool.some((j) => j.idade === 29)).toBe(true)
    const ids = new Set(buscar(sql, {}).map((j) => j.id))
    expect(fora.some((id) => ids.has(id))).toBe(false)
    expect(buscar(sql, { somenteExterior: true })).toHaveLength(pool.length)
  }, 120_000)
})
