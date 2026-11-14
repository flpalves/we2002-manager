import { describe, expect, it } from 'vitest'
import { prepararCarreira } from '@core/pacote/importar'
import { exterior, livre, pacote } from '../fixtures/pacote'

const escolha = { id: 'c', nome: 'C', tecnico: 'Felipe', time: 'AAA', semente: 1, criadaEm: 'x' }

describe('importação da carreira', () => {
  it('dificuldade ajusta o orçamento inicial só do time do usuário (±25%)', () => {
    const saldo = (dif: 'facil' | 'normal' | 'dificil', sigla: string) => prepararCarreira(pacote(), { ...escolha, dificuldade: dif }).times.find((t) => t.sigla === sigla)!
    expect(saldo('normal', 'AAA').saldo).toBe(100_000_000)
    expect(saldo('facil', 'AAA').saldo).toBe(125_000_000)
    expect(saldo('dificil', 'AAA')).toMatchObject({ saldo: 75_000_000, orcamento_folha_mensal: 37_500_000 })
    expect(saldo('dificil', 'BBB').saldo).toBe(100_000_000)
  })

  it('moral inicial padrão 60', () => {
    expect(prepararCarreira(pacote(), { ...escolha, dificuldade: 'normal' }).jogadores[0]!.moral).toBe(60)
  })
})

describe('importação dos jogadores sem clube', () => {
  it('exterior e livres entram sem time, camisa 0 e sem contrato', () => {
    const dados = prepararCarreira(pacote({ exterior: { temporada: 2026, jogadores: [exterior(1), exterior(2)] }, livres: { jogadores: [livre(1)] } }), {
      ...escolha,
      dificuldade: 'normal',
    })
    const semClube = dados.jogadores.filter((j) => j.time === null)
    expect(semClube.map((j) => [j.chave, j.status])).toEqual([
      ['ext-j1', 'exterior'],
      ['ext-j2', 'exterior'],
      ['liv-j1', 'livre'],
    ])
    expect(semClube.every((j) => j.camisa === 0 && j.contrato === null && j.camisa_real === null)).toBe(true)
    expect(semClube[0]).toMatchObject({ taxa_fixa: 50_000_000, origem_clube: 'Zenit', origem_pais: 'RUS', moral: 60 })
    expect(semClube[2]).toMatchObject({ taxa_fixa: null, origem_clube: null, origem_pais: null })
    expect(dados.jogadores.filter((j) => j.time !== null).every((j) => j.status === 'ativo' && j.contrato !== null)).toBe(true)
  })

  it('sem exterior.json nem livres.json, ninguém fica sem clube', () => {
    expect(prepararCarreira(pacote(), { ...escolha, dificuldade: 'normal' }).jogadores.some((j) => j.time === null)).toBe(false)
  })
})
