import { describe, expect, it } from 'vitest'
import { PADROES, mesclarRegras } from '@core/config/padroes'
import { deExibicaoWe, geral, paraExibicaoWe, paraNivelWe } from '@core/jogadores/conversao'
import { atributos } from '../fixtures/pacote'

const tabela = PADROES.jogadores.conversao_we

describe('conversão 1-20 ↔ WE', () => {
  it('segue a tabela padrão da spec (1-6 → 0 … 19-20 → 7)', () => {
    const esperado = [0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]
    expect(Array.from({ length: 20 }, (_, i) => paraNivelWe(i + 1, tabela))).toEqual(esperado)
    expect(paraExibicaoWe(20, tabela)).toBe(19)
    expect(paraExibicaoWe(1, tabela)).toBe(12)
  })

  it('satura fora de 1-20', () => {
    expect(paraNivelWe(0, tabela)).toBe(0)
    expect(paraNivelWe(25, tabela)).toBe(7)
  })

  it('importação 12-19 → 1-20 usa o valor central arredondado para baixo (decisão 16)', () => {
    expect([12, 13, 14, 15, 16, 17, 18, 19].map((x) => deExibicaoWe(x, tabela))).toEqual([3, 7, 9, 11, 13, 15, 17, 19])
  })

  it('ida e volta preservam o nível do WE', () => {
    for (let exibido = 12; exibido <= 19; exibido++) {
      expect(paraExibicaoWe(deExibicaoWe(exibido, tabela), tabela)).toBe(exibido)
    }
  })

  it('ida e volta valem também para uma tabela do pacote', () => {
    const outra = { limites: [2, 5, 8, 11, 13, 15, 17, 20] }
    for (let exibido = 12; exibido <= 19; exibido++) {
      expect(paraExibicaoWe(deExibicaoWe(exibido, outra), outra)).toBe(exibido)
    }
  })
})

describe('geral', () => {
  it('sem pesos é a média simples arredondada', () => {
    const semPesos = { ...PADROES, jogadores: { ...PADROES.jogadores, pesos_geral: {} } }
    expect(geral({ ...atributos(10), OFF: 18 }, 'CF', semPesos)).toBe(11) // 168/16 = 10.5 → 11
  })

  it('pesos padrão por posição: goleiro pelos reflexos, centroavante pelo ataque', () => {
    expect(geral({ ...atributos(3), RES: 19, DEF: 15, JMP: 15, BAL: 15 }, 'GK', PADROES)).toBe(17)
    expect(geral({ ...atributos(3), RES: 19, DEF: 15, JMP: 15, BAL: 15 }, 'CF', PADROES)).toBe(3)
  })

  it('com pesos da posição vindos do regras.json', () => {
    const regras = mesclarRegras(PADROES, { jogadores: { pesos_geral: { GK: { DEF: 1, RES: 1 } } } })
    expect(geral({ ...atributos(5), DEF: 18, RES: 16 }, 'GK', regras)).toBe(17)
    expect(geral({ ...atributos(5), DEF: 18, RES: 16 }, 'CF', regras)).toBe(5) // CF fica com os pesos padrão
  })
})
