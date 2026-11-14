import { describe, expect, it } from 'vitest'
import { PADROES } from '@core/config/padroes'
import { fatorSerieDoTime, fatorSerieSalarioDoTime, geralProjetado, importanciaNoTime, multaPadrao, premioSalarial, salarioReferencia, semanasRestantes, valorMercado } from '@core/mercado/valor'
import { iniciarNegociacao, Movimentos, pedidaInicial, proporAoClube, proporAoJogador, salarioMinimoAceito } from '@core/mercado/negociacao'
import { cotaTv, ehSemanaDeCiclo, fatorPreco, lancamentosDoCiclo, publico } from '@core/financas/financas'
import { avaliar, clubesInteressados, confiancaAposJogo, fecharMetas, gerarMetas, pontosEsperados } from '@core/diretoria/diretoria'

describe('valor de mercado', () => {
  const base = { geral: 12, idade: 27, potencial: 12, semanasContrato: 100, fatorSerie: 1 }
  const arred = (v: number) => Math.round(v / 5_000_000) * 5_000_000
  it('1,8 mi × 1,8^(geral projetado − 12) × fatores', () => {
    expect(valorMercado(base, PADROES)).toBe(180_000_000)
    expect(valorMercado({ ...base, geral: 14, potencial: 14 }, PADROES)).toBe(arred(180_000_000 * 1.8 ** 2))
  })
  it('geral projetado: o potencial pesa mais quanto mais novo', () => {
    expect(geralProjetado(12, 16, 18, PADROES)).toBe(14)
    expect(geralProjetado(12, 16, 21, PADROES)).toBeCloseTo(13.6)
    expect(geralProjetado(12, 16, 27, PADROES)).toBeCloseTo(12.4)
    expect(geralProjetado(12, 16, 28, PADROES)).toBe(12)
    expect(geralProjetado(14, 12, 18, PADROES)).toBe(14)
  })
  it('idade, potencial, contrato e série', () => {
    expect(valorMercado({ ...base, idade: 20 }, PADROES)).toBe(215_000_000)
    expect(valorMercado({ ...base, idade: 34 }, PADROES)).toBe(55_000_000)
    expect(valorMercado({ ...base, potencial: 15 }, PADROES)).toBe(arred(180_000_000 * 1.8 ** 0.3))
    expect(valorMercado({ ...base, idade: 18, potencial: 16 }, PADROES)).toBe(arred(180_000_000 * 1.8 ** 2 * 1.2))
    // Veterano com potencial acima do geral não ganha nada por isso.
    expect(valorMercado({ ...base, idade: 33, potencial: 16 }, PADROES)).toBe(valorMercado({ ...base, idade: 33 }, PADROES))
    expect(valorMercado({ ...base, semanasContrato: 20 }, PADROES)).toBe(90_000_000)
    expect(valorMercado({ ...base, semanasContrato: 40 }, PADROES)).toBe(135_000_000)
    expect(valorMercado({ ...base, fatorSerie: 0.6 }, PADROES)).toBe(110_000_000)
  })
  it('semanas restantes: vence na última semana da temporada do contrato', () => {
    expect(semanasRestantes(2026, 2026, 10, PADROES)).toBe(42)
    expect(semanasRestantes(2027, 2026, 10, PADROES)).toBe(94)
    expect(semanasRestantes(2025, 2026, 10, PADROES)).toBe(0)
  })
  it('fator de série: maior liga; estrangeiro usa o país', () => {
    expect(fatorSerieDoTime(['serie-b', 'copa'], 'BRA', 1, PADROES)).toBe(0.85)
    expect(fatorSerieDoTime(['serie-a', 'serie-b'], 'BRA', 1, PADROES)).toBe(1)
    expect(fatorSerieDoTime([], 'BRA', 1, PADROES)).toBe(PADROES.mercado.fator_sem_liga)
    expect(fatorSerieDoTime(['serie-a'], 'ARG', 0.8, PADROES)).toBe(0.8)
  })
  it('salário de referência: 60 mil × 1,6^(geral − 12) × série × prêmio', () => {
    const neutro = { geral: 12, idade: 27, potencial: 12, fatorSerieSalario: 1 }
    expect(salarioReferencia(neutro, PADROES)).toBe(6_000_000)
    expect(salarioReferencia({ ...neutro, geral: 17, potencial: 17 }, PADROES)).toBe(Math.round((6_000_000 * 1.6 ** 5) / 100_000) * 100_000)
    expect(salarioReferencia({ ...neutro, fatorSerieSalario: 0.7 }, PADROES)).toBe(4_200_000)
    expect(salarioReferencia({ ...neutro, geral: 4, potencial: 4 }, PADROES)).toBe(PADROES.mercado.salario_minimo)
  })
  it('prêmio do salário: idade e potencial pesam pouco e ficam entre 0,8 e 1,3', () => {
    expect(premioSalarial(12, 12, 27, PADROES)).toBe(1)
    expect(premioSalarial(14, 19, 18, PADROES)).toBe(1.3)
    expect(premioSalarial(12, 12, 34, PADROES)).toBe(0.8)
    expect(premioSalarial(14, 15, 25, PADROES)).toBeCloseTo((1 * 1.8 ** 0.2) ** 0.2)
    // Joia e titular médio de mesmo geral: valor bem diferente, salário parecido.
    const joia = { geral: 14, idade: 18, potencial: 19, fatorSerieSalario: 1 }
    const medio = { geral: 14, idade: 26, potencial: 14, fatorSerieSalario: 1 }
    expect(salarioReferencia(joia, PADROES) / salarioReferencia(medio, PADROES)).toBeCloseTo(1.3)
  })
  it('fator de série do salário: maior liga; estrangeiro usa o país', () => {
    expect(fatorSerieSalarioDoTime(['serie-b'], 'BRA', 1, PADROES)).toBe(0.7)
    expect(fatorSerieSalarioDoTime([], 'BRA', 1, PADROES)).toBe(PADROES.mercado.fator_sem_liga_salario)
    expect(fatorSerieSalarioDoTime(['serie-a'], 'ARG', 0.8, PADROES)).toBe(0.8)
  })
  it('multa padrão', () => {
    expect(multaPadrao(100, PADROES)).toBe(300)
  })
  it('importância pela ordem de geral no time', () => {
    const gerais = Array.from({ length: 25 }, (_, i) => 20 - i * 0.5)
    expect(importanciaNoTime(20, gerais, PADROES)).toBe('titular')
    expect(importanciaNoTime(14, gerais, PADROES)).toBe('reserva')
    expect(importanciaNoTime(9, gerais, PADROES)).toBe('encostado')
  })
})

describe('negociação', () => {
  const pedida = pedidaInicial({ valor: 1_000_000, importancia: 'titular', porteVendedor: 'pequeno', porteComprador: 'grande' }, PADROES)
  it('pedida = valor × importância × porte (pequeno → grande +10%)', () => {
    expect(pedida).toBe(1_540_000)
    expect(pedidaInicial({ valor: 1_000_000, importancia: 'encostado', porteVendedor: 'grande', porteComprador: 'pequeno' }, PADROES)).toBe(1_000_000)
  })
  it('oferta ≥ pedida: aceita e passa para o jogador', () => {
    const r = proporAoClube(iniciarNegociacao('compra', 1000, 50), 1000, PADROES)
    expect(r.resposta).toBe('aceita')
    expect(r.negociacao).toMatchObject({ etapa: 'jogador', valorAcordado: 1000 })
  })
  it('oferta ≥ 70%: contraproposta no meio do caminho; a pedida desce até ela', () => {
    const r = proporAoClube(iniciarNegociacao('compra', 1000, 50), 800, PADROES)
    expect(r).toMatchObject({ resposta: 'contraproposta', valor: 900 })
    const r2 = proporAoClube(r.negociacao, 850, PADROES)
    expect(r2).toMatchObject({ resposta: 'contraproposta', valor: 875 })
    expect(proporAoClube(r2.negociacao, 875, PADROES).resposta).toBe('aceita')
  })
  it('abaixo de 70%: recusa, pedida sobe 5%; 3 recusas seguidas encerram', () => {
    let n = iniciarNegociacao('compra', 1000, 50)
    const r1 = proporAoClube(n, 500, PADROES)
    expect(r1).toMatchObject({ resposta: 'recusa', valor: 1050 })
    n = r1.negociacao
    n = proporAoClube(n, 500, PADROES).negociacao
    const r3 = proporAoClube(n, 500, PADROES)
    expect(r3.resposta).toBe('encerrada')
    expect(r3.negociacao.etapa).toBe('encerrada')
    expect(() => proporAoClube(r3.negociacao, 5000, PADROES)).toThrow()
  })
  it('multa: o clube é obrigado a aceitar o valor da multa', () => {
    const r = proporAoClube(iniciarNegociacao('multa', 3000, 50), 3000, PADROES)
    expect(r).toMatchObject({ resposta: 'aceita', valor: 3000 })
  })
  it('livre e renovação começam no jogador', () => {
    expect(iniciarNegociacao('livre', 0, 50).etapa).toBe('jogador')
    expect(iniciarNegociacao('renovacao', 0, 50).etapa).toBe('jogador')
  })
  it('jogador: aceita, contraproposta ou recusa', () => {
    const n = { ...iniciarNegociacao('livre', 0, 100) }
    expect(proporAoJogador(n, 100, PADROES).resposta).toBe('aceita')
    const c = proporAoJogador(n, 90, PADROES)
    expect(c).toMatchObject({ resposta: 'contraproposta', valor: 95 })
    expect(proporAoJogador(c.negociacao, 95, PADROES).negociacao.etapa).toBe('concluida')
    expect(proporAoJogador(n, 50, PADROES).resposta).toBe('recusa')
  })
  it('salário mínimo: mudar de clube +10%, clube maior aceita menos, menor pede mais', () => {
    const base = { salarioAtual: 10_000_000, mudaDeClube: true, porteAtual: 'medio' as const, porteComprador: 'medio' as const, moral: 50, salarioReferencia: 10_000_000 }
    expect(salarioMinimoAceito(base, PADROES)).toBe(11_000_000)
    expect(salarioMinimoAceito({ ...base, porteComprador: 'grande' }, PADROES)).toBe(9_900_000)
    expect(salarioMinimoAceito({ ...base, porteComprador: 'pequeno' }, PADROES)).toBe(12_650_000)
    expect(salarioMinimoAceito({ ...base, mudaDeClube: false }, PADROES)).toBe(10_000_000)
    expect(salarioMinimoAceito({ ...base, salarioAtual: 0 }, PADROES)).toBe(Math.round(PADROES.mercado.salario_minimo * 1.1))
  })
  it('5 movimentos entre um jogo e outro (aceite)', () => {
    const m = new Movimentos(5, 5)
    for (let i = 0; i < 5; i++) m.gastar()
    expect(() => m.gastar()).toThrow(/Sem movimentos/)
    m.renovar()
    expect(m.restantes).toBe(5)
  })
})

describe('finanças e público', () => {
  const e = { capacidade: 40_000, preco: 6_000, precoReferencia: 6_000, porteMandante: 'grande' as const, porteVisitante: 'medio' as const, competicao: 'liga' as const, aproveitamento: 0.5 }
  it('público = capacidade × min(1, demanda)', () => {
    // 0,75 × 1 × 1 × 1 × (1,15 − 0,25) = 0,675
    expect(publico(e, PADROES)).toBe(27_000)
    // Dobro do preço: 0,75 × 0,65
    expect(publico({ ...e, preco: 12_000 }, PADROES)).toBe(19_500)
    expect(publico({ ...e, preco: 0 }, PADROES)).toBe(30_000)
    expect(publico({ ...e, preco: 0, porteVisitante: 'grande', competicao: 'final', aproveitamento: 1 }, PADROES)).toBe(40_000)
  })
  it('f_preço limitado entre 0,15 e 1', () => {
    expect(fatorPreco(0, 100, PADROES)).toBe(1)
    expect(fatorPreco(1000, 100, PADROES)).toBe(0.15)
    expect(fatorPreco(100, 100, PADROES)).toBeCloseTo(0.9)
  })
  it('ciclo de 4 semanas: folha, parcela do patrocínio e da TV', () => {
    expect(ehSemanaDeCiclo(4, PADROES)).toBe(true)
    expect(ehSemanaDeCiclo(5, PADROES)).toBe(false)
    const l = lancamentosDoCiclo({ time: 'A', folhaMensal: 1000, patrocinioTemporada: 13_000, cotaTvTemporada: 26_000 }, PADROES)
    expect(l.map((x) => [x.categoria, x.valor])).toEqual([
      ['salarios', -1000],
      ['patrocinio', 1000],
      ['tv', 2000],
    ])
    expect(cotaTv(['serie-a'], PADROES)).toBe(6_000_000_000)
    expect(cotaTv([], PADROES)).toBe(PADROES.financas.cota_tv_sem_liga)
  })
})

describe('diretoria', () => {
  it('metas pelo porte e dificuldade', () => {
    const liga = { id: 'serie-a', nome: 'Série A', times: 20 }
    expect(gerarMetas('grande', liga, 'normal', PADROES)[0]).toMatchObject({ tipo: 'posicao_liga', alvo: 6, critica: true })
    expect(gerarMetas('pequeno', liga, 'normal', PADROES)[0]!.alvo).toBe(16)
    expect(gerarMetas('pequeno', liga, 'dificil', PADROES)[0]!.alvo).toBe(14)
    expect(gerarMetas('medio', null, 'normal', PADROES).map((m) => m.tipo)).toEqual(['saldo_positivo', 'folha_no_orcamento'])
  })
  it('pontos esperados crescem com a força e com o mando', () => {
    expect(pontosEsperados(12, 12, true)).toBeGreaterThan(pontosEsperados(12, 12, false))
    expect(pontosEsperados(15, 10, false)).toBeGreaterThan(2)
    expect(pontosEsperados(10, 15, false)).toBeLessThan(0.8)
  })
  it('confiança por jogo e avaliação com demissão após 2 ruins', () => {
    expect(confiancaAposJogo(60, 3, 1.5, PADROES)).toBe(64.5)
    let a = avaliar(15, 0, { saldo: 10, folha: 1, orcamentoFolha: 2 }, 'normal', PADROES)
    expect(a).toMatchObject({ avaliacoesRuins: 1, demitido: false })
    a = avaliar(a.confianca, a.avaliacoesRuins, { saldo: -10, folha: 3, orcamentoFolha: 2 }, 'normal', PADROES)
    expect(a).toMatchObject({ confianca: 10, avaliacoesRuins: 2, demitido: true })
    expect(avaliar(25, 1, { saldo: 1, folha: 1, orcamentoFolha: 2 }, 'normal', PADROES).avaliacoesRuins).toBe(0)
  })
  it('metas na virada: crítica perdida demite', () => {
    const [crit, outra] = gerarMetas('grande', { id: 'l', nome: 'L', times: 20 }, 'normal', PADROES)
    expect(fecharMetas(50, [{ meta: crit!, atingida: true }, { meta: outra!, atingida: false }], PADROES)).toEqual({ confianca: 45, demitido: false })
    expect(fecharMetas(50, [{ meta: crit!, atingida: false }], PADROES).demitido).toBe(true)
  })
  it('clubes interessados: porte menor ou igual, só do Brasil', () => {
    const c = [
      { sigla: 'A', porte: 'grande' as const, pais: 'BRA' },
      { sigla: 'B', porte: 'medio' as const, pais: 'BRA' },
      { sigla: 'C', porte: 'pequeno' as const, pais: 'BRA' },
      { sigla: 'D', porte: 'pequeno' as const, pais: 'ARG' },
    ]
    expect(clubesInteressados(c, 'B', 'medio').map((x) => x.sigla)).toEqual(['C'])
    expect(clubesInteressados(c, 'X', 'grande').map((x) => x.sigla)).toEqual(['A', 'B', 'C'])
  })
})
