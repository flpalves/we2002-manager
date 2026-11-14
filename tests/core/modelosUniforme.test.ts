import { describe, expect, it } from 'vitest'
import { corDoTecido, problemasDoDesign, type DesignKit } from '@core/we/estampas'
import { corCamisa } from '@core/we/uniformes'
import { desenharKit, PAGINA_KIT, type BaseKit } from '@core/we/desenharKit'
import {
  MODELOS_UNIFORME,
  ajusteDoModelo,
  aplicarModelo,
  corContraste,
  corDoModelo,
  definirAjuste,
  definirCorCamisa,
  definirCorDoModelo,
  definirLado,
  designDasCores,
  designGoleiro,
  designReserva,
  ladoDoModelo,
  modeloDoDesign,
} from '@core/we/modelosUniforme'

const BRANCO = '#F2F2F2'
const PRETO = '#151515'
const VERMELHO = '#C8102E'
const base: DesignKit = { camisa: BRANCO, detalhe: PRETO, calcao: PRETO, meiao: BRANCO }

describe('estilos novos: listras horizontais e meio a meio', () => {
  it('listras horizontais alternam por linha na frente e nas costas (proporcional)', () => {
    const d: DesignKit = { camisa: BRANCO, listras_horizontais: { cores: [BRANCO, PRETO], altura: 4 } }
    expect(corDoTecido('frente', 10, 0, d)).toBe(BRANCO)
    expect(corDoTecido('frente', 10, 4, d)).toBe(PRETO)
    expect(corDoTecido('frente', 10, 8, d)).toBe(BRANCO)
    // costas têm 24 linhas: a linha 3 equivale à 4,67 da frente → 2ª listra
    expect(corDoTecido('costas', 5, 3, d)).toBe(PRETO)
    // mangas e laterais ficam na cor da camisa
    expect(corDoTecido('mangas', 5, 5, d)).toBe(BRANCO)
  })

  it('meio a meio pinta uma metade da frente e espelha nas costas', () => {
    const d: DesignKit = { camisa: BRANCO, meio_a_meio: { cor: VERMELHO, lado: 'esquerda' } }
    expect(corDoTecido('frente', 5, 5, d)).toBe(VERMELHO)
    expect(corDoTecido('frente', 60, 5, d)).toBe(BRANCO)
    expect(corDoTecido('costas', 2, 5, d)).toBe(BRANCO)
    expect(corDoTecido('costas', 18, 5, d)).toBe(VERMELHO)
    const direita = definirLado(d, 'direita')
    expect(corDoTecido('frente', 5, 5, direita)).toBe(BRANCO)
    expect(corDoTecido('frente', 60, 5, direita)).toBe(VERMELHO)
  })

  it('valida os campos novos', () => {
    expect(problemasDoDesign({ camisa: BRANCO, listras_horizontais: { cores: [BRANCO] } })).toEqual(['listras_horizontais.cores precisa de pelo menos 2 cores'])
    expect(problemasDoDesign({ camisa: BRANCO, listras_horizontais: { cores: [BRANCO, PRETO], altura: 40 } })).toHaveLength(1)
    expect(problemasDoDesign({ camisa: BRANCO, meio_a_meio: { cor: 'vermelho' } })).toEqual(['meio_a_meio.cor deve ser uma cor "#RRGGBB"'])
    expect(problemasDoDesign({ camisa: BRANCO, meio_a_meio: { cor: VERMELHO, lado: 'cima' } })).toHaveLength(1)
  })

  it('cor média da camisa considera os estilos novos', () => {
    const aros = corCamisa({ design: { camisa: BRANCO, listras_horizontais: { cores: ['#000000', '#FFFFFF'] } } })!
    expect(aros.map(Math.round)).toEqual([128, 128, 128])
    const metade = corCamisa({ design: { camisa: '#FFFFFF', meio_a_meio: { cor: '#000000' } } })!
    expect(metade.map(Math.round)).toEqual([128, 128, 128])
  })
})

describe('modelos de uniforme', () => {
  it('todo modelo aplicado gera um design válido e é reconhecido de volta', () => {
    for (const m of MODELOS_UNIFORME) {
      const d = aplicarModelo(base, m.id)
      expect(problemasDoDesign(d), m.id).toEqual([])
      expect(modeloDoDesign(d), m.id).toBe(m.id)
    }
  })

  it('trocar de modelo mantém as cores e a cor do modelo', () => {
    let d = aplicarModelo(base, 'faixa_diagonal')
    expect(corDoModelo(d)).toBe(PRETO) // começa no detalhe
    d = definirCorDoModelo(d, VERMELHO)
    d = aplicarModelo(d, 'listras_verticais')
    expect(d.listras_verticais?.cores).toEqual([BRANCO, VERMELHO])
    expect(d.faixa_diagonal).toBeUndefined()
    expect(d.calcao).toBe(PRETO)
    d = aplicarModelo(d, 'lisa')
    expect(modeloDoDesign(d)).toBe('lisa')
    expect(corDoModelo(d)).toBeNull()
  })

  it('sem detalhe diferente da camisa, a segunda cor é um contraste', () => {
    const d = aplicarModelo({ camisa: '#FFFFFF', detalhe: '#ffffff' }, 'mangas')
    expect(d.mangas).toBe('#151515')
  })

  it('a cor da camisa acompanha a primeira listra', () => {
    const d = definirCorCamisa(aplicarModelo(base, 'listras_horizontais'), VERMELHO)
    expect(d.camisa).toBe(VERMELHO)
    expect(d.listras_horizontais?.cores).toEqual([VERMELHO, PRETO])
  })

  it('ajuste de tamanho respeita os limites', () => {
    const d = aplicarModelo(base, 'faixa_diagonal')
    expect(ajusteDoModelo(d)?.valor).toBe(14)
    expect(definirAjuste(d, 999).faixa_diagonal?.largura).toBe(30)
    expect(ajusteDoModelo(aplicarModelo(base, 'listras_finas'))).toBeNull()
    expect(ajusteDoModelo(aplicarModelo(base, 'lisa'))).toBeNull()
  })

  it('faixa do peito cresce a partir do centro sem sair da frente', () => {
    const d = aplicarModelo(base, 'faixa_peito') // [10, 17]
    expect(definirAjuste(d, 3).faixa_peito?.linhas).toEqual([12, 15])
    expect(definirAjuste(d, 14).faixa_peito?.linhas).toEqual([7, 21])
    const alta = { ...d, faixa_peito: { cor: PRETO, linhas: [26, 31] as [number, number] } }
    expect(definirAjuste(alta, 14).faixa_peito?.linhas).toEqual([18, 32])
    expect(problemasDoDesign(definirAjuste(alta, 14))).toEqual([])
  })

  it('lado só existe na faixa diagonal e no meio a meio', () => {
    expect(ladoDoModelo(aplicarModelo(base, 'faixa_diagonal'))).toBe('direita')
    expect(ladoDoModelo(aplicarModelo(base, 'meio_a_meio'))).toBe('esquerda')
    expect(ladoDoModelo(aplicarModelo(base, 'mangas'))).toBeNull()
    const d = aplicarModelo(base, 'mangas')
    expect(definirLado(d, 'esquerda')).toBe(d)
  })

  it('sugestões a partir das cores do clube', () => {
    expect(corContraste('#FFFFFF')).toBe('#151515')
    expect(corContraste('#003399')).toBe('#F2F2F2')
    const titular = designDasCores(['#00613c', '#ffffff'])
    expect(titular).toEqual({ camisa: '#00613C', detalhe: '#FFFFFF', calcao: '#FFFFFF', meiao: '#00613C' })
    expect(designReserva(titular).camisa).toBe('#FFFFFF')
    expect(designDasCores(['#FFFFFF']).detalhe).toBe('#151515')
    // goleiro de um time verde não fica verde
    expect(designGoleiro(titular).camisa).not.toBe('#1E8C3A')
  })
})

/** Kit base sintético: frente/mangas/costas em vermelho saturado com sombra, resto cinza. */
function baseSintetica(): BaseKit {
  const { largura: W, altura: H } = PAGINA_KIT
  const rgba = new Uint8Array(W * H * 4)
  const pagina = new Uint8Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4
      const tecido = x < 100 && y < 128 && !(y >= 32 && y < 64)
      const claro = (x + y) % 2 === 0
      rgba.set(tecido ? [claro ? 200 : 100, 20, 20, 255] : [128, 128, 128, 255], o)
      pagina[y * W + x] = 1
    }
  return { rgba, pagina }
}

describe('desenharKit', () => {
  const pixel = (img: Uint8ClampedArray, x: number, y: number, S = 1) => Array.from(img.subarray((y * PAGINA_KIT.largura * S + x) * 4, (y * PAGINA_KIT.largura * S + x) * 4 + 4))

  it('pinta o tecido principal na cor da camisa, mantendo a sombra', () => {
    const img = desenharKit(baseSintetica(), { camisa: '#0000FF' })
    const claro = pixel(img, 0, 0) // pixel claro da base
    const escuro = pixel(img, 1, 0)
    expect(claro[2]).toBeGreaterThan(escuro[2]!)
    expect(claro[0]).toBe(0)
    expect(claro[3]).toBe(255)
  })

  it('aplica o estilo (meio a meio) e é determinístico', () => {
    const d: DesignKit = { camisa: '#0000FF', meio_a_meio: { cor: '#00FF00' } }
    const a = desenharKit(baseSintetica(), d)
    expect(pixel(a, 2, 2)[1]).toBeGreaterThan(0) // metade verde
    expect(pixel(a, 62, 2)[1]).toBe(0) // metade azul
    expect(desenharKit(baseSintetica(), d)).toEqual(a)
  })

  it('escala 4 repete cada pixel num bloco 4x4', () => {
    const d: DesignKit = { camisa: '#0000FF' }
    const um = desenharKit(baseSintetica(), d)
    const quatro = desenharKit(baseSintetica(), d, 4)
    expect(quatro.length).toBe(um.length * 16)
    expect(pixel(quatro, 7, 7, 4)).toEqual(pixel(um, 1, 1))
  })

  it('recusa design inválido e base de tamanho errado', () => {
    expect(() => desenharKit(baseSintetica(), { camisa: 'azul' })).toThrow(/design inválido/)
    expect(() => desenharKit({ rgba: new Uint8Array(4), pagina: new Uint8Array(1) }, { camisa: '#000000' })).toThrow(/128x256/)
  })
})
