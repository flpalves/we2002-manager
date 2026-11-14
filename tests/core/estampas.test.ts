import { describe, expect, it } from 'vitest'
import { PADROES } from '@core/config/padroes'
import { validarPacote } from '@core/pacote/validar'
import { corDoTecido, naFaixaDiagonal, naFaixaPeito, problemasDoDesign, regiaoDoPixel, type DesignKit } from '@core/we/estampas'
import { corCamisa } from '@core/we/uniformes'
import { pacote, time } from '../fixtures/pacote'

const BRANCO = '#F2F2F2'
const PRETO = '#151515'
const VERMELHO = '#C8102E'

/** Conta quantos pixels de uma região recebem cada cor. */
function contar(regiao: 'frente' | 'costas' | 'mangas' | 'laterais', w: number, h: number, d: DesignKit): Map<string, number> {
  const m = new Map<string, number>()
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = corDoTecido(regiao, x, y, d)
    m.set(c, (m.get(c) ?? 0) + 1)
  }
  return m
}

describe('regiaoDoPixel', () => {
  it('converte para coordenadas locais; nas costas, de cada costa 20x24', () => {
    expect(regiaoDoPixel(10, 5)).toEqual({ regiao: 'frente', lx: 10, ly: 5 })
    expect(regiaoDoPixel(5, 70)).toEqual({ regiao: 'mangas', lx: 5, ly: 6 })
    expect(regiaoDoPixel(47, 110)).toEqual({ regiao: 'costas', lx: 7, ly: 6 })
    expect(regiaoDoPixel(40, 130)).toEqual({ regiao: 'laterais', lx: 8, ly: 2 })
    expect(regiaoDoPixel(10, 40)).toBeNull() // calção não é tecido da camisa
  })
})

describe('estilos da camisa', () => {
  it('lisa: tudo na cor da camisa', () => {
    expect(contar('frente', 64, 32, { camisa: VERMELHO })).toEqual(new Map([[VERMELHO, 64 * 32]]))
  })

  it('listras verticais alternam pela largura (tipo Atlético-MG)', () => {
    const d: DesignKit = { camisa: PRETO, listras_verticais: { cores: [PRETO, BRANCO], largura: 4 } }
    expect([0, 3, 4, 7, 8].map((x) => corDoTecido('frente', x, 0, d))).toEqual([PRETO, PRETO, BRANCO, BRANCO, PRETO])
    expect(corDoTecido('costas', 4, 10, d)).toBe(BRANCO)
  })

  it('mangas de outra cor só mudam as mangas, inclusive sobre listras', () => {
    const d: DesignKit = { camisa: VERMELHO, mangas: BRANCO }
    expect(contar('mangas', 64, 16, d)).toEqual(new Map([[BRANCO, 64 * 16]]))
    expect(contar('frente', 64, 32, d)).toEqual(new Map([[VERMELHO, 64 * 32]]))
    expect(contar('laterais', 32, 107, d)).toEqual(new Map([[VERMELHO, 32 * 107]]))
    expect(corDoTecido('mangas', 5, 0, { ...d, listras_verticais: { cores: [PRETO, VERMELHO] } })).toBe(BRANCO)
  })

  it('faixa diagonal desce do ombro ao quadril na frente (tipo Vasco)', () => {
    const f = { cor: PRETO }
    // padrão: ombro à direita da textura → no alto a faixa está à direita, embaixo à esquerda
    expect(naFaixaDiagonal('frente', 52, 0, f)).toBe(true)
    expect(naFaixaDiagonal('frente', 10, 0, f)).toBe(false)
    expect(naFaixaDiagonal('frente', 12, 31, f)).toBe(true)
    expect(naFaixaDiagonal('frente', 52, 31, f)).toBe(false)
    // "inicio": "esquerda" espelha
    expect(naFaixaDiagonal('frente', 11, 0, { ...f, inicio: 'esquerda' })).toBe(true)
    expect(naFaixaDiagonal('frente', 52, 0, { ...f, inicio: 'esquerda' })).toBe(false)
  })

  it('faixa diagonal nas costas sobe pelo mesmo ombro (espelhada) e não vai para mangas/laterais', () => {
    const f = { cor: PRETO }
    expect(naFaixaDiagonal('costas', 3, 0, f)).toBe(true)
    expect(naFaixaDiagonal('costas', 16, 0, f)).toBe(false)
    expect(naFaixaDiagonal('costas', 16, 23, f)).toBe(true)
    expect(naFaixaDiagonal('mangas', 52, 0, f)).toBe(false)
    expect(naFaixaDiagonal('laterais', 20, 0, f)).toBe(false)
  })

  it('faixa diagonal: largura controla a área; toda linha da frente tem faixa', () => {
    const fina = contar('frente', 64, 32, { camisa: BRANCO, faixa_diagonal: { cor: PRETO, largura: 6 } }).get(PRETO)!
    const larga = contar('frente', 64, 32, { camisa: BRANCO, faixa_diagonal: { cor: PRETO, largura: 20 } }).get(PRETO)!
    expect(larga).toBeGreaterThan(fina * 2)
    for (let y = 0; y < 32; y++) {
      const linha = Array.from({ length: 64 }, (_, x) => corDoTecido('frente', x, y, { camisa: BRANCO, faixa_diagonal: { cor: PRETO } }))
      expect(linha.filter((c) => c === PRETO).length).toBeGreaterThanOrEqual(13)
    }
  })

  it('faixa no peito: linhas da frente e altura proporcional nas costas', () => {
    const f = { cor: VERMELHO }
    expect([9, 10, 16, 17].map((y) => naFaixaPeito('frente', y, f))).toEqual([false, true, true, false])
    // costas têm 24 linhas: pelo centro do pixel, 10-17 da frente viram as linhas 7 a 12
    expect([6, 7, 12, 13].map((y) => naFaixaPeito('costas', y, f))).toEqual([false, true, true, false])
    expect(naFaixaPeito('mangas', 12, f)).toBe(false)
    expect(naFaixaPeito('frente', 3, { ...f, linhas: [2, 5] })).toBe(true)
    const d: DesignKit = { camisa: BRANCO, faixa_peito: f }
    expect(contar('frente', 64, 32, d).get(VERMELHO)).toBe(64 * 7)
  })

  it('estilos combinam: faixa por cima das listras', () => {
    const d: DesignKit = { camisa: PRETO, listras_verticais: { cores: [PRETO, BRANCO] }, faixa_peito: { cor: VERMELHO } }
    expect(corDoTecido('frente', 4, 12, d)).toBe(VERMELHO)
    expect(corDoTecido('frente', 4, 2, d)).toBe(BRANCO)
  })
})

describe('problemasDoDesign', () => {
  it('aceita os estilos bem formados e design ausente', () => {
    expect(problemasDoDesign(undefined)).toEqual([])
    expect(
      problemasDoDesign({
        camisa: BRANCO, detalhe: PRETO, calcao: PRETO, meiao: BRANCO, mangas: PRETO,
        listras_verticais: { cores: [PRETO, BRANCO], largura: 4 },
        faixa_diagonal: { cor: PRETO, largura: 14, inicio: 'esquerda' },
        faixa_peito: { cor: VERMELHO, linhas: [10, 17] },
        faixas: [{ cor: PRETO, regiao: 'costas', linhas: [1, 4] }],
      }),
    ).toEqual([])
  })

  it('acusa cores e estilos malformados', () => {
    const p = problemasDoDesign({
      camisa: 'vermelho', mangas: '#12345',
      listras_verticais: { cores: [PRETO] },
      faixa_diagonal: { cor: PRETO, largura: 100, inicio: 'cima' },
      faixa_peito: { cor: VERMELHO, linhas: [20, 10] },
      faixas: [{ cor: PRETO, regiao: 'calcao', linhas: [0, 1] }],
    })
    expect(p).toEqual([
      'camisa deve ser uma cor "#RRGGBB"',
      'mangas deve ser uma cor "#RRGGBB"',
      'listras_verticais.cores precisa de pelo menos 2 cores',
      'faixa_diagonal.largura deve ficar entre 2 e 40',
      'faixa_diagonal.inicio deve ser "esquerda" ou "direita"',
      'faixa_peito.linhas deve ser [y0, y1] com 0 <= y0 < y1 <= 32',
      'faixas[0].regiao deve ser frente, costas, laterais ou mangas',
    ])
  })

  it('o validador do pacote avisa design inválido', () => {
    const t = time('AAA', { kit: { design: { camisa: BRANCO, faixa_diagonal: { cor: 'preto' } } } })
    const p = validarPacote(pacote({ times: [t, time('BBB')] }), PADROES)
    expect(p).toContainEqual(expect.objectContaining({ nivel: 'aviso', codigo: 'kit_design_invalido', time: 'AAA' }))
  })
})

describe('cor média da camisa com os estilos', () => {
  it('faixa diagonal e mangas pesam pela área, sem dominar a camisa', () => {
    const vasco = corCamisa({ design: { camisa: '#FFFFFF', faixa_diagonal: { cor: '#000000' } } })!
    expect(vasco[0]).toBeCloseTo(255 * 0.75)
    const mangas = corCamisa({ design: { camisa: '#FF0000', mangas: '#FFFFFF' } })!
    expect(mangas).toEqual([255, 51, 51])
    const lisa = corCamisa({ design: { camisa: '#FFFFFF' } })
    expect(lisa).toEqual([255, 255, 255])
  })
})
