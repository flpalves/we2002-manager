/**
 * Modelos de uniforme do editor: cada modelo é um dos estilos de `estampas.ts` (ou nenhum, a
 * camisa lisa). O editor guarda só o `kit.design`; o modelo é deduzido dele e trocar de modelo
 * reaproveita as cores que já estavam escolhidas.
 */

import { PADRAO_ESTAMPA, type DesignKit } from './estampas'
import { hexRgb } from './desenharKit'

export const MODELOS_UNIFORME = [
  { id: 'lisa', nome: 'Lisa', descricao: 'Camisa de uma cor só' },
  { id: 'listras_verticais', nome: 'Listras verticais', descricao: 'Listras largas, tipo Atlético-MG e Botafogo' },
  { id: 'listras_finas', nome: 'Listras finas', descricao: 'Listras verticais estreitas' },
  { id: 'listras_horizontais', nome: 'Listras horizontais', descricao: 'Camisa de aros (frente e costas)' },
  { id: 'faixa_diagonal', nome: 'Faixa diagonal', descricao: 'Faixa do ombro ao quadril, tipo Vasco' },
  { id: 'faixa_peito', nome: 'Faixa no peito', descricao: 'Faixa horizontal no peito e nas costas' },
  { id: 'mangas', nome: 'Mangas de outra cor', descricao: 'Corpo de uma cor, mangas de outra' },
  { id: 'meio_a_meio', nome: 'Meio a meio', descricao: 'Metade da camisa de cada cor' },
] as const

export type ModeloUniforme = (typeof MODELOS_UNIFORME)[number]['id']

/** Largura das listras finas, em pixels da frente (64). */
export const LARGURA_LISTRA_FINA = 2

/** Campos de estilo de `DesignKit` (os que definem o modelo). */
const ESTILOS = ['listras_verticais', 'listras_horizontais', 'faixa_diagonal', 'faixa_peito', 'mangas', 'meio_a_meio'] as const

export function modeloDoDesign(d: DesignKit): ModeloUniforme {
  if (d.listras_verticais) return (d.listras_verticais.largura ?? PADRAO_ESTAMPA.larguraListra) <= LARGURA_LISTRA_FINA ? 'listras_finas' : 'listras_verticais'
  if (d.listras_horizontais) return 'listras_horizontais'
  if (d.faixa_diagonal) return 'faixa_diagonal'
  if (d.faixa_peito) return 'faixa_peito'
  if (d.meio_a_meio) return 'meio_a_meio'
  if (d.mangas) return 'mangas'
  return 'lisa'
}

/**
 * Cor do modelo: a "segunda cor" do estilo (a outra listra, a faixa, as mangas, a outra
 * metade). Camisa lisa não tem.
 */
export function corDoModelo(d: DesignKit): string | null {
  if (d.listras_verticais) return d.listras_verticais.cores[1] ?? null
  if (d.listras_horizontais) return d.listras_horizontais.cores[1] ?? null
  if (d.faixa_diagonal) return d.faixa_diagonal.cor
  if (d.faixa_peito) return d.faixa_peito.cor
  if (d.meio_a_meio) return d.meio_a_meio.cor
  return d.mangas ?? null
}

/** Cor padrão para o modelo quando o design ainda não tem uma: o detalhe, ou um contraste. */
function segundaCor(d: DesignKit): string {
  const atual = corDoModelo(d)
  if (atual) return atual
  if (d.detalhe && d.detalhe.toUpperCase() !== d.camisa.toUpperCase()) return d.detalhe
  return corContraste(d.camisa)
}

/** Troca o modelo mantendo as cores (camisa, detalhe, calção, meião e a cor do modelo). */
export function aplicarModelo(d: DesignKit, modelo: ModeloUniforme): DesignKit {
  const cor = segundaCor(d)
  const novo: DesignKit = { ...d }
  for (const e of ESTILOS) delete novo[e]
  const larguraAtual = d.listras_verticais?.largura
  switch (modelo) {
    case 'lisa':
      break
    case 'listras_verticais':
      novo.listras_verticais = { cores: [d.camisa, cor], largura: larguraAtual && larguraAtual > LARGURA_LISTRA_FINA ? larguraAtual : PADRAO_ESTAMPA.larguraListra }
      break
    case 'listras_finas':
      novo.listras_verticais = { cores: [d.camisa, cor], largura: LARGURA_LISTRA_FINA }
      break
    case 'listras_horizontais':
      novo.listras_horizontais = { cores: [d.camisa, cor], altura: d.listras_horizontais?.altura ?? PADRAO_ESTAMPA.alturaListraHorizontal }
      break
    case 'faixa_diagonal':
      novo.faixa_diagonal = { cor, largura: d.faixa_diagonal?.largura ?? PADRAO_ESTAMPA.larguraDiagonal, inicio: d.faixa_diagonal?.inicio ?? 'direita' }
      break
    case 'faixa_peito':
      novo.faixa_peito = { cor, linhas: d.faixa_peito?.linhas ?? [...PADRAO_ESTAMPA.linhasPeito] }
      break
    case 'mangas':
      novo.mangas = cor
      break
    case 'meio_a_meio':
      novo.meio_a_meio = { cor, lado: d.meio_a_meio?.lado ?? 'esquerda' }
      break
  }
  return novo
}

/** Cor principal da camisa; nas listras, a primeira listra acompanha. */
export function definirCorCamisa(d: DesignKit, cor: string): DesignKit {
  const novo: DesignKit = { ...d, camisa: cor }
  if (d.listras_verticais) novo.listras_verticais = { ...d.listras_verticais, cores: [cor, ...d.listras_verticais.cores.slice(1)] }
  if (d.listras_horizontais) novo.listras_horizontais = { ...d.listras_horizontais, cores: [cor, ...d.listras_horizontais.cores.slice(1)] }
  return novo
}

export function definirCorDoModelo(d: DesignKit, cor: string): DesignKit {
  const novo: DesignKit = { ...d }
  if (d.listras_verticais) novo.listras_verticais = { ...d.listras_verticais, cores: [d.listras_verticais.cores[0] ?? d.camisa, cor] }
  else if (d.listras_horizontais) novo.listras_horizontais = { ...d.listras_horizontais, cores: [d.listras_horizontais.cores[0] ?? d.camisa, cor] }
  else if (d.faixa_diagonal) novo.faixa_diagonal = { ...d.faixa_diagonal, cor }
  else if (d.faixa_peito) novo.faixa_peito = { ...d.faixa_peito, cor }
  else if (d.meio_a_meio) novo.meio_a_meio = { ...d.meio_a_meio, cor }
  else if (d.mangas) novo.mangas = cor
  return novo
}

/** Ajuste de tamanho do modelo (largura das listras/faixa, altura das listras); null = não tem. */
export interface AjusteModelo {
  rotulo: string
  valor: number
  min: number
  max: number
}

const FAIXA_PEITO_ALTURA = { min: 3, max: 14 } as const

export function ajusteDoModelo(d: DesignKit): AjusteModelo | null {
  if (d.listras_verticais) {
    const fina = (d.listras_verticais.largura ?? PADRAO_ESTAMPA.larguraListra) <= LARGURA_LISTRA_FINA
    return fina ? null : { rotulo: 'Largura das listras', valor: d.listras_verticais.largura ?? PADRAO_ESTAMPA.larguraListra, min: 3, max: 12 }
  }
  if (d.listras_horizontais) return { rotulo: 'Altura das listras', valor: d.listras_horizontais.altura ?? PADRAO_ESTAMPA.alturaListraHorizontal, min: 2, max: 8 }
  if (d.faixa_diagonal) return { rotulo: 'Largura da faixa', valor: d.faixa_diagonal.largura ?? PADRAO_ESTAMPA.larguraDiagonal, min: 6, max: 30 }
  if (d.faixa_peito) {
    const [y0, y1] = d.faixa_peito.linhas ?? PADRAO_ESTAMPA.linhasPeito
    return { rotulo: 'Altura da faixa', valor: y1 - y0, ...FAIXA_PEITO_ALTURA }
  }
  return null
}

export function definirAjuste(d: DesignKit, valor: number): DesignKit {
  const a = ajusteDoModelo(d)
  if (!a) return d
  const v = Math.round(Math.min(a.max, Math.max(a.min, valor)))
  if (d.listras_verticais) return { ...d, listras_verticais: { ...d.listras_verticais, largura: v } }
  if (d.listras_horizontais) return { ...d, listras_horizontais: { ...d.listras_horizontais, altura: v } }
  if (d.faixa_diagonal) return { ...d, faixa_diagonal: { ...d.faixa_diagonal, largura: v } }
  if (d.faixa_peito) {
    // A faixa cresce a partir do centro original, sem sair da frente (32 linhas).
    const [y0, y1] = d.faixa_peito.linhas ?? PADRAO_ESTAMPA.linhasPeito
    const centro = (y0 + y1) / 2
    const ini = Math.max(0, Math.min(32 - v, Math.round(centro - v / 2)))
    return { ...d, faixa_peito: { ...d.faixa_peito, linhas: [ini, ini + v] } }
  }
  return d
}

/** Lado da faixa diagonal ou da metade colorida; null = o modelo não tem lado. */
export function ladoDoModelo(d: DesignKit): 'esquerda' | 'direita' | null {
  if (d.faixa_diagonal) return d.faixa_diagonal.inicio ?? 'direita'
  if (d.meio_a_meio) return d.meio_a_meio.lado ?? 'esquerda'
  return null
}

export function definirLado(d: DesignKit, lado: 'esquerda' | 'direita'): DesignKit {
  if (d.faixa_diagonal) return { ...d, faixa_diagonal: { ...d.faixa_diagonal, inicio: lado } }
  if (d.meio_a_meio) return { ...d, meio_a_meio: { ...d.meio_a_meio, lado } }
  return d
}

/** Luminância relativa (0-1) de uma cor "#RRGGBB". */
function luminancia(hex: string): number {
  const c = hexRgb(hex)
  if (!c) return 0
  return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255
}

/** Branco ou preto, o que contrastar mais com a cor (para número da camisa e segunda cor). */
export function corContraste(hex: string): string {
  return luminancia(hex) > 0.55 ? '#151515' : '#F2F2F2'
}

/** Design inicial a partir das cores do clube (1ª = camisa, 2ª = detalhe e calção). */
export function designDasCores(cores: readonly string[]): DesignKit {
  const camisa = (cores[0] ?? '#F2F2F2').toUpperCase()
  const outra = (cores[1] ?? corContraste(camisa)).toUpperCase()
  return { camisa, detalhe: outra, calcao: outra, meiao: camisa }
}

/** Reserva sugerido: inverte camisa e detalhe do titular. */
export function designReserva(titular: DesignKit): DesignKit {
  const detalhe = titular.detalhe ?? corContraste(titular.camisa)
  return { camisa: detalhe, detalhe: titular.camisa, calcao: titular.camisa, meiao: detalhe }
}

/** Kit de goleiro sugerido: cor que não se confunde com a camisa de linha. */
export function designGoleiro(titular: DesignKit): DesignKit {
  const opcoes = ['#1E8C3A', '#F2C200', '#5A2D82', '#E05A00']
  const alvo = hexRgb(titular.camisa) ?? [0, 0, 0]
  const longe = opcoes
    .map((c) => ({ c, dist: Math.hypot(...(hexRgb(c)!.map((v, i) => v - alvo[i]!) as [number, number, number])) }))
    .sort((a, b) => b.dist - a.dist)[0]!.c
  return { camisa: longe, detalhe: '#151515', calcao: '#151515', meiao: longe }
}
