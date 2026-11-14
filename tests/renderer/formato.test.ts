import { describe, expect, it } from 'vitest'
import { centavosParaReais, dinheiro, nomeTipoTransferencia, ordenarElenco, reaisParaCentavos } from '@renderer/formato'

describe('formato de dinheiro', () => {
  it('formata como na spec ("R$ 48,2 mi", "R$ 850 mil")', () => {
    expect(dinheiro(4_820_000_000)).toBe('R$ 48,2 mi')
    expect(dinheiro(85_000_000)).toBe('R$ 850 mil')
    expect(dinheiro(500_000_000)).toBe('R$ 5 mi')
    expect(dinheiro(12_000_000_000)).toBe('R$ 120 mi')
    expect(dinheiro(250_000_000_000)).toBe('R$ 2,5 bi')
    expect(dinheiro(12_345)).toBe('R$ 123')
    expect(dinheiro(0)).toBe('R$ 0')
    expect(dinheiro(-150_000_000)).toBe('−R$ 1,5 mi')
  })

  it('lê reais digitados', () => {
    expect(reaisParaCentavos('1.500,50')).toBe(150_050)
    expect(reaisParaCentavos('1500.5')).toBe(150_050)
    expect(reaisParaCentavos('R$ 60')).toBe(6_000)
    expect(reaisParaCentavos('')).toBe(0)
    expect(reaisParaCentavos('abc')).toBeNull()
    expect(centavosParaReais(150_050)).toBe('1.500,50')
  })
})

describe('ordenarElenco', () => {
  const j = (posicao: string, geral: number, condicao: number, idade: number) => ({ posicao, geral, condicao, idade })
  const lista = [j('CF', 15, 90, 30), j('GK', 10, 70, 22), j('CB', 12, 100, 35), j('CF', 16, 60, 19)]
  it('por posição (e geral dentro da posição), geral, condição e idade; não mexe na original', () => {
    expect(ordenarElenco(lista, 'posicao').map((x) => `${x.posicao}${x.geral}`)).toEqual(['GK10', 'CB12', 'CF16', 'CF15'])
    expect(ordenarElenco(lista, 'geral').map((x) => x.geral)).toEqual([16, 15, 12, 10])
    expect(ordenarElenco(lista, 'condicao').map((x) => x.condicao)).toEqual([60, 70, 90, 100])
    expect(ordenarElenco(lista, 'idade').map((x) => x.idade)).toEqual([19, 22, 30, 35])
    expect(lista[0]!.posicao).toBe('CF')
  })
  it('nome do tipo de transferência', () => {
    expect(nomeTipoTransferencia('emprestimo')).toBe('Empréstimo')
    expect(nomeTipoTransferencia('xyz')).toBe('xyz')
  })
})
