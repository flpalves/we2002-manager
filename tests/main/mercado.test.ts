import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Carreiras } from '../../src/main/carreira/servico'
import { buscar, contrapropor, definirAVenda, negociacao, propor, propostas, responderProposta, situacao } from '../../src/main/carreira/mercado'
import { assumirClube, definirIngresso, diretoria, financas } from '../../src/main/carreira/clube'
import { continuar } from '../../src/main/carreira/temporada'
import type { Sql } from '../../src/main/db/sql'
import { avancar } from '../helpers/avancar'
import { abrirNodeSqlite } from '../helpers/sqlite'
import { pacote as fixture, time } from '../fixtures/pacote'
import { escreverPacote } from '../helpers/pacote'
import { ErroApp } from '../../src/main/ipc/registrar'
import type { Regras } from '@core/config/padroes'

const codigo = (f: () => unknown): string | null => {
  try {
    f()
    return null
  } catch (e) {
    return e instanceof ErroApp ? e.codigo : (e as Error).message
  }
}

describe('mercado, finanças e diretoria do usuário (serviço + SQLite)', () => {
  let carreiras: Carreiras
  let sql: Sql

  beforeEach(() => {
    const base = mkdtempSync(join(tmpdir(), 'we-mercado-'))
    escreverPacote(join(base, 'pacotes', 'teste'), fixture({ times: ['AAA', 'BBB', 'CCC', 'DDD'].map((s) => time(s)) }))
    let n = 0
    carreiras = new Carreiras({
      pastaCarreiras: () => join(base, 'carreiras'),
      pastaPacotes: () => join(base, 'pacotes'),
      abrirBanco: abrirNodeSqlite,
      lerResumoArquivo: () => null,
      sementeNova: () => 7,
      agora: () => '2026-11-13T00:00:00Z',
      sufixoId: () => `m${++n}`,
    })
    carreiras.criar({ pacote: 'teste', time: 'AAA', tecnico: 'Felipe', nome: 'M', dificuldade: 'normal' })
    sql = carreiras.sql()
    sql.run("UPDATE time SET saldo = 5000000000 WHERE sigla = 'AAA'")
  })

  const idDe = (sigla: string, n: number) =>
    String(sql.get<{ id: number }>("SELECT j.id FROM jogador j JOIN time t ON t.id = j.time_id WHERE t.sigla = ? AND j.chave = ?", sigla, `${sigla.toLowerCase()}-j${n}`)!.id)
  const mudarRegras = (f: (r: Regras) => void) => {
    const r = JSON.parse(sql.get<{ dados: string }>('SELECT dados FROM regras WHERE id = 1')!.dados)
    f(r)
    sql.run('UPDATE regras SET dados = ? WHERE id = 1', JSON.stringify(r))
  }

  it('situação inicial: janela aberta, 5 movimentos, valores calculados', () => {
    expect(situacao(sql)).toMatchObject({ movimentos: 5, movimentosMaximo: 5, janelaAberta: true, elenco: 23, demitido: false })
    const lista = buscar(sql, { posicao: 'GK' })
    expect(lista.length).toBe(8)
    expect(lista.every((j) => j.valor > 0 && j.multa === j.valor * 3 && j.salario >= 1_000_000)).toBe(true)
    expect(lista.filter((j) => j.doUsuario)).toHaveLength(2)
  })

  it('compra em duas etapas: clube e depois jogador; cada proposta gasta 1 movimento', () => {
    const id = idDe('BBB', 18)
    const n0 = negociacao(sql, id)
    expect(n0).toMatchObject({ tipo: 'compra', etapa: 'clube', id: null, tiposPossiveis: ['compra', 'emprestimo', 'multa'] })
    expect(situacao(sql).movimentos).toBe(5) // abrir não gasta

    const baixa = propor(sql, { jogadorId: id, tipo: 'compra', valor: Math.round(n0.pedida * 0.3) })
    expect(baixa.historico.at(-1)?.tipo).toBe('recusa')
    expect(baixa.pedida).toBeGreaterThan(n0.pedida) // paciência
    const aceita = propor(sql, { jogadorId: id, tipo: 'compra', valor: baixa.pedida })
    expect(aceita.etapa).toBe('jogador')
    const fechada = propor(sql, { jogadorId: id, tipo: 'compra', salario: 50_000_000, temporadas: 3 })
    expect(fechada).toMatchObject({ etapa: 'concluida', mensagem: 'Negócio fechado!' })
    expect(fechada.jogador).toMatchObject({ time: 'AAA', doUsuario: true, salario: 50_000_000, contratoAte: 2029 })
    expect(situacao(sql)).toMatchObject({ movimentos: 2, elenco: 24 })

    const aaa = sql.get<{ saldo: number }>("SELECT saldo FROM time WHERE sigla = 'AAA'")!.saldo
    expect(aaa).toBe(5_000_000_000 - baixa.pedida)
    expect(sql.get<{ n: number }>("SELECT COUNT(*) n FROM transferencia WHERE de = 'BBB' AND para = 'AAA' AND tipo = 'compra'")!.n).toBe(1)
    expect(sql.all<{ categoria: string }>("SELECT categoria FROM lancamento_financeiro ORDER BY id").map((l) => l.categoria)).toEqual(['transferencia_saida', 'transferencia_entrada'])
    // A camisa 18 já existia no AAA: ganhou uma livre.
    const camisas = sql.all<{ camisa: number }>("SELECT j.camisa FROM jogador j JOIN time t ON t.id = j.time_id WHERE t.sigla = 'AAA'").map((j) => j.camisa)
    expect(new Set(camisas).size).toBe(24)
  })

  it('o limite de movimentos vale para todas as negociações e renova depois do jogo', () => {
    const alvos = [1, 2, 3, 4, 5, 6].map((n) => idDe('BBB', n + 2))
    for (const a of alvos.slice(0, 5)) propor(sql, { jogadorId: a, tipo: 'compra', valor: 100 })
    expect(situacao(sql).movimentos).toBe(0)
    expect(codigo(() => propor(sql, { jogadorId: alvos[5]!, tipo: 'compra', valor: 100 }))).toBe('sem_movimentos')
    avancar(sql)
    expect(situacao(sql).movimentos).toBe(5)
  })

  it('multa rescisória: o clube é obrigado a aceitar; fora da janela só livres e renovações', () => {
    const id = idDe('CCC', 5)
    const n = negociacao(sql, id, 'multa')
    const r = propor(sql, { jogadorId: id, tipo: 'multa', valor: 0 })
    expect(r).toMatchObject({ etapa: 'jogador', valorAcordado: n.pedida })

    mudarRegras((x) => (x.mercado.janelas = [{ semana_inicio: 50, semana_fim: 51 }]))
    expect(situacao(sql).janelaAberta).toBe(false)
    expect(codigo(() => propor(sql, { jogadorId: idDe('DDD', 5), tipo: 'compra', valor: 1 }))).toBe('negocio_indisponivel')
    expect(negociacao(sql, idDe('DDD', 5)).mensagem).toMatch(/Fora da janela/)
    // Livre e renovação continuam valendo.
    const livre = idDe('DDD', 6)
    sql.run("UPDATE jogador SET time_id = NULL, status = 'livre' WHERE id = ?", Number(livre))
    sql.run('DELETE FROM contrato WHERE jogador_id = ?', Number(livre))
    expect(negociacao(sql, livre)).toMatchObject({ tipo: 'livre', etapa: 'jogador' })
    expect(propor(sql, { jogadorId: livre, tipo: 'livre', salario: 40_000_000 }).etapa).toBe('concluida')
    const meu = idDe('AAA', 1)
    expect(propor(sql, { jogadorId: meu, tipo: 'renovacao', salario: 30_000_000, temporadas: 4 }).jogador).toMatchObject({ contratoAte: 2030, salario: 30_000_000 })
  })

  it('saldo negativo bloqueia compras (livres só com salário dentro do orçamento)', () => {
    sql.run("UPDATE time SET saldo = -100 WHERE sigla = 'AAA'")
    expect(codigo(() => propor(sql, { jogadorId: idDe('BBB', 3), tipo: 'compra', valor: 1000 }))).toBe('saldo_negativo')
    const livre = idDe('DDD', 6)
    sql.run("UPDATE jogador SET time_id = NULL, status = 'livre' WHERE id = ?", Number(livre))
    sql.run('DELETE FROM contrato WHERE jogador_id = ?', Number(livre))
    // Folha 23 × R$ 10 mil = R$ 230 mil; orçamento R$ 500 mil.
    expect(codigo(() => propor(sql, { jogadorId: livre, tipo: 'livre', salario: 30_000_000 }))).toBe('saldo_negativo')
    expect(propor(sql, { jogadorId: livre, tipo: 'livre', salario: 20_000_000 }).etapa).toBe('concluida')
  })

  it('propostas recebidas: não gastam movimento; respeitam o elenco mínimo; vender põe o dinheiro no caixa', () => {
    const id = Number(idDe('AAA', 20))
    sql.run("INSERT INTO proposta_recebida (jogador_id, clube, valor, teto, temporada, semana, prazo_semana) VALUES (?, 'BBB', 30000000, 30000000, 2026, 10, 12)", id)
    const [p] = propostas(sql)
    expect(p).toMatchObject({ clube: 'BBB', valor: 30_000_000, prazo: 12, contraproposta: null, aVenda: false })
    expect(codigo(() => responderProposta(sql, p!.id, true))).toBe('elenco_minimo')
    mudarRegras((x) => (x.mercado.elenco_minimo = 20))
    expect(responderProposta(sql, p!.id, true)).toEqual([])
    expect(situacao(sql)).toMatchObject({ movimentos: 5, elenco: 22, saldo: 5_000_000_000 + 30_000_000 })
    expect(sql.get<{ sigla: string }>('SELECT t.sigla FROM jogador j JOIN time t ON t.id = j.time_id WHERE j.id = ?', id)?.sigla).toBe('BBB')
  })

  it('contraproposta (1 rodada): até o teto fecha; um pouco acima o clube cobre com o teto; muito acima desiste', () => {
    mudarRegras((x) => (x.mercado.elenco_minimo = 15))
    const proposta = (n: number) => {
      sql.run("INSERT INTO proposta_recebida (jogador_id, clube, valor, teto, temporada, semana, prazo_semana) VALUES (?, 'BBB', 30000000, 40000000, 2026, 1, 3)", Number(idDe('AAA', n)))
      return propostas(sql).find((p) => p.jogadorId === idDe('AAA', n))!
    }
    // Até o teto: vende pelo pedido.
    const a = contrapropor(sql, proposta(20).id, 38_000_000)
    expect(a).toMatchObject({ resposta: 'aceita', valor: 38_000_000 })
    expect(situacao(sql).saldo).toBe(5_000_000_000 + 38_000_000)
    // Um pouco acima: cobre com o teto e não aceita outra contraproposta.
    const b = proposta(21)
    expect(contrapropor(sql, b.id, 45_000_000)).toMatchObject({ resposta: 'cobre', valor: 40_000_000 })
    expect(propostas(sql).find((p) => p.id === b.id)).toMatchObject({ valor: 40_000_000, contraproposta: 45_000_000 })
    expect(codigo(() => contrapropor(sql, b.id, 41_000_000))).toBe('contraproposta_feita')
    responderProposta(sql, b.id, true)
    expect(situacao(sql).saldo).toBe(5_000_000_000 + 38_000_000 + 40_000_000)
    // Muito acima: desiste e a proposta some.
    const c = proposta(22)
    expect(contrapropor(sql, c.id, 90_000_000).resposta).toBe('desiste')
    expect(propostas(sql).some((p) => p.id === c.id)).toBe(false)
    expect(sql.get<{ estado: string }>('SELECT estado FROM proposta_recebida WHERE id = ?', c.id)!.estado).toBe('desistiu')
  })

  it('lista de venda: o usuário põe e tira os seus; à venda tem desconto na pedida e aparece no filtro', () => {
    const meu = idDe('AAA', 3)
    expect(definirAVenda(sql, meu, true).aVenda).toBe('usuario')
    expect(buscar(sql, { somenteAVenda: true }).map((j) => j.id)).toEqual([meu])
    expect(definirAVenda(sql, meu, false).aVenda).toBeNull()
    expect(codigo(() => definirAVenda(sql, idDe('BBB', 3), true))).toBe('jogador_de_outro_time')
    // Jogador da CPU à venda: pedida 15% menor.
    const alvo = idDe('BBB', 4)
    const cheia = negociacao(sql, alvo).pedida
    sql.run("UPDATE jogador SET a_venda = 'excedente' WHERE id = ?", Number(alvo))
    sql.run('UPDATE negociacao SET aberta = 0')
    expect(negociacao(sql, alvo, 'compra').pedida).toBe(Math.round(cheia * 0.85))
  })

  it('finanças: ingresso mais caro reduz o público estimado; extrato com bilheteria depois dos jogos', () => {
    const f = financas(sql)
    expect(f.estadio).toMatchObject({ capacidade: 30000, ingresso: 4000 })
    const caro = definirIngresso(sql, 12_000)
    expect(caro.estadio.publicoEstimado).toBeLessThan(f.estadio.publicoEstimado)
    expect(codigo(() => definirIngresso(sql, 50))).toBe('ingresso_invalido')
    definirIngresso(sql, 4000)
    for (let i = 0; i < 3; i++) avancar(sql)
    const depois = financas(sql)
    expect(depois.porCategoria.map((c) => c.categoria)).toContain('bilheteria')
    expect(depois.estadio.ultimosJogos.length).toBeGreaterThan(0)
  })

  it('diretoria: metas com a situação de hoje; demitido não avança e assume outro clube', () => {
    const d = diretoria(sql)
    expect(d).toMatchObject({ confianca: 60, limite: 20, demitido: false, clubesInteressados: [] })
    expect(d.metas.map((m) => m.tipo)).toEqual(['posicao_liga', 'saldo_positivo', 'folha_no_orcamento'])
    expect(d.metas[1]).toMatchObject({ atual: 5_000_000_000, noCaminho: true })

    sql.run('UPDATE carreira SET demitido = 1')
    expect(codigo(() => continuar(sql))).toBe('demitido')
    const dem = diretoria(sql)
    expect(dem.clubesInteressados.map((c) => c.sigla)).toEqual(['BBB', 'CCC', 'DDD'])
    const nova = assumirClube(sql, 'CCC')
    expect(nova).toMatchObject({ demitido: false, confianca: 60 })
    expect(situacao(sql).movimentos).toBe(5)
    expect(sql.get<{ time_usuario: string }>('SELECT time_usuario FROM carreira')?.time_usuario).toBe('CCC')
    expect(continuar(sql).preJogo).not.toBeNull()
  })
})
