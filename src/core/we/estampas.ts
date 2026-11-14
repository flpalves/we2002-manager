/**
 * Estampas da camisa (o "estilo" do kit desenhado): decide a cor do tecido principal em
 * cada ponto da textura do uniforme do WE2002. Usado pelo `tools/desenhar-kit.ts`, que
 * cuida das sombras e das regiões que não são tecido.
 *
 * Estilos (combináveis, aplicados nesta ordem; `faixas` livres vêm por último, no desenhador):
 *   listras_verticais  { cores: [...], largura? }          — tipo Atlético-MG, Botafogo
 *   listras_horizontais { cores: [...], altura? }          — camisa "de aros", tipo Santos 1960
 *   meio_a_meio        { cor, lado? }                      — metade de cada cor
 *   mangas             "#RRGGBB"                           — corpo de uma cor, mangas de outra
 *   faixa_diagonal     { cor, largura?, inicio? }          — tipo Vasco
 *   faixa_peito        { cor, linhas? }                    — faixa horizontal no peito
 *
 * Coordenadas: pixels da textura original (128x256). Cada região é tratada no seu sistema
 * local (0,0 = canto superior esquerdo da região; nas costas, de cada costa 20x24).
 */

export type RegiaoTecido = 'frente' | 'costas' | 'laterais' | 'mangas'

/** Retângulos [x0, y0, x1, y1] das regiões do uniforme na página do kit (aproximados). */
export const REGIOES_KIT = {
  frente: [0, 0, 64, 32],
  calcao: [0, 32, 64, 64],
  mangas: [0, 64, 64, 80],
  costas: [0, 80, 100, 128],
  meiao: [0, 128, 32, 208],
  laterais: [32, 128, 64, 235],
  detalhes: [64, 128, 100, 160],
} as const satisfies Record<string, readonly [number, number, number, number]>

/** Tamanho de uma costa (as 10 costas numeradas são cópias de 20x24). */
export const COSTA = { largura: 20, altura: 24 } as const

/** Valores padrão dos estilos, em pixels da frente (64x32). */
export const PADRAO_ESTAMPA = {
  larguraListra: 4,
  larguraDiagonal: 14,
  /** Onde a faixa diagonal começa (ombro) e termina (quadril), em fração da largura. */
  diagonalOmbro: 0.82,
  diagonalQuadril: 0.18,
  linhasPeito: [10, 17] as [number, number],
  /** Altura de cada listra horizontal, em linhas da frente (32 de altura). */
  alturaListraHorizontal: 4,
} as const

export interface ListrasVerticais {
  cores: string[]
  largura?: number
}
export interface ListrasHorizontais {
  cores: string[]
  /** Altura de cada listra, em linhas da frente (32); nas costas é proporcional. */
  altura?: number
}
export interface MeioAMeio {
  cor: string
  /** Metade da frente (na textura) que recebe `cor`; nas costas fica espelhada. */
  lado?: 'esquerda' | 'direita'
}
export interface FaixaDiagonal {
  cor: string
  /** Largura horizontal da faixa, em pixels da frente (64 de largura). */
  largura?: number
  /** Lado da textura da frente onde fica o ombro da faixa. Se sair espelhada no WE, troque. */
  inicio?: 'esquerda' | 'direita'
}
export interface FaixaPeito {
  cor: string
  /** [y0, y1) em linhas da frente (32 de altura); nas costas é proporcional. */
  linhas?: [number, number]
}
export interface FaixaLivre {
  cor: string
  regiao: RegiaoTecido
  linhas: [number, number]
}

export interface DesignKit {
  camisa: string
  detalhe?: string
  calcao?: string
  meiao?: string
  mangas?: string
  listras_verticais?: ListrasVerticais
  listras_horizontais?: ListrasHorizontais
  meio_a_meio?: MeioAMeio
  faixa_diagonal?: FaixaDiagonal
  faixa_peito?: FaixaPeito
  faixas?: FaixaLivre[]
}

const TAMANHO_REGIAO: Record<RegiaoTecido, [number, number]> = {
  frente: [64, 32],
  costas: [COSTA.largura, COSTA.altura],
  mangas: [64, 16],
  laterais: [32, 107],
}

/** Converte um pixel da página para (região de tecido, x local, y local). */
export function regiaoDoPixel(x: number, y: number): { regiao: RegiaoTecido; lx: number; ly: number } | null {
  for (const regiao of ['frente', 'mangas', 'costas', 'laterais'] as const) {
    const [x0, y0, x1, y1] = REGIOES_KIT[regiao]
    if (x < x0 || x >= x1 || y < y0 || y >= y1) continue
    if (regiao === 'costas') return { regiao, lx: (x - x0) % COSTA.largura, ly: (y - y0) % COSTA.altura }
    return { regiao, lx: x - x0, ly: y - y0 }
  }
  return null
}

/** Está dentro da faixa diagonal? Frente e costas; nas costas a faixa sobe pelo mesmo ombro (espelhada). */
export function naFaixaDiagonal(regiao: RegiaoTecido, lx: number, ly: number, f: FaixaDiagonal): boolean {
  if (regiao !== 'frente' && regiao !== 'costas') return false
  const [w, h] = TAMANHO_REGIAO[regiao]
  const u = (lx + 0.5) / w
  const v = (ly + 0.5) / h
  const deDireita = (f.inicio ?? 'direita') === 'direita'
  // Vista de costas, o ombro da faixa fica do outro lado.
  const ombroADireita = regiao === 'frente' ? deDireita : !deDireita
  const ombro = ombroADireita ? PADRAO_ESTAMPA.diagonalOmbro : 1 - PADRAO_ESTAMPA.diagonalOmbro
  const quadril = ombroADireita ? PADRAO_ESTAMPA.diagonalQuadril : 1 - PADRAO_ESTAMPA.diagonalQuadril
  const centro = ombro + (quadril - ombro) * v
  const meia = (f.largura ?? PADRAO_ESTAMPA.larguraDiagonal) / 64 / 2
  return Math.abs(u - centro) < meia
}

/** Está na metade colorida do meio a meio? Frente e costas (nas costas, espelhada). */
export function naMetade(regiao: RegiaoTecido, lx: number, m: MeioAMeio): boolean {
  if (regiao !== 'frente' && regiao !== 'costas') return false
  const w = TAMANHO_REGIAO[regiao][0]
  const esquerda = (lx + 0.5) / w < 0.5
  const ladoEsquerdo = (m.lado ?? 'esquerda') === 'esquerda'
  return regiao === 'frente' ? esquerda === ladoEsquerdo : esquerda !== ladoEsquerdo
}

/** Está dentro da faixa do peito? Frente e costas (nas costas, na mesma altura proporcional). */
export function naFaixaPeito(regiao: RegiaoTecido, ly: number, f: FaixaPeito): boolean {
  if (regiao !== 'frente' && regiao !== 'costas') return false
  const [y0, y1] = f.linhas ?? PADRAO_ESTAMPA.linhasPeito
  const yFrente = ((ly + 0.5) * 32) / TAMANHO_REGIAO[regiao][1]
  return yFrente >= y0 && yFrente < y1
}

/**
 * Cor do tecido principal da camisa num ponto (coordenadas locais da região).
 * Só vale para os pixels que, no kit base, são da cor principal; o desenhador cuida do resto.
 */
export function corDoTecido(regiao: RegiaoTecido, lx: number, ly: number, d: DesignKit): string {
  let cor = d.camisa
  const lv = d.listras_verticais
  if (lv && lv.cores.length) {
    const w = Math.max(1, lv.largura ?? PADRAO_ESTAMPA.larguraListra)
    cor = lv.cores[Math.floor(lx / w) % lv.cores.length]!
  }
  const lh = d.listras_horizontais
  if (lh && lh.cores.length && (regiao === 'frente' || regiao === 'costas')) {
    const h = Math.max(1, lh.altura ?? PADRAO_ESTAMPA.alturaListraHorizontal)
    const yFrente = ((ly + 0.5) * 32) / TAMANHO_REGIAO[regiao][1]
    cor = lh.cores[Math.floor(yFrente / h) % lh.cores.length]!
  }
  if (d.meio_a_meio && naMetade(regiao, lx, d.meio_a_meio)) cor = d.meio_a_meio.cor
  if (regiao === 'mangas' && d.mangas) cor = d.mangas
  if (d.faixa_diagonal && naFaixaDiagonal(regiao, lx, ly, d.faixa_diagonal)) cor = d.faixa_diagonal.cor
  if (d.faixa_peito && naFaixaPeito(regiao, ly, d.faixa_peito)) cor = d.faixa_peito.cor
  return cor
}

const HEX = /^#[0-9a-f]{6}$/i

/** Problemas de formato no `design` do kit (cores inválidas, estilos malformados). Vazio = ok. */
export function problemasDoDesign(design: unknown): string[] {
  if (design === undefined || design === null) return []
  if (typeof design !== 'object') return ['design não é um objeto']
  const d = design as Record<string, unknown>
  const p: string[] = []
  const cor = (v: unknown, campo: string, obrigatoria = false) => {
    if (v === undefined && !obrigatoria) return
    if (typeof v !== 'string' || !HEX.test(v)) p.push(`${campo} deve ser uma cor "#RRGGBB"`)
  }
  const objeto = (v: unknown, campo: string): Record<string, unknown> | null => {
    if (v === undefined) return null
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      p.push(`${campo} deve ser um objeto`)
      return null
    }
    return v as Record<string, unknown>
  }
  const linhas = (v: unknown, campo: string, max: number) => {
    if (v === undefined) return
    if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => Number.isInteger(n)) || !(v[0] >= 0 && v[0] < v[1] && v[1] <= max)) {
      p.push(`${campo} deve ser [y0, y1] com 0 <= y0 < y1 <= ${max}`)
    }
  }
  cor(d['camisa'], 'camisa', true)
  for (const c of ['detalhe', 'calcao', 'meiao', 'mangas']) cor(d[c], c)

  const lv = objeto(d['listras_verticais'], 'listras_verticais')
  if (lv) {
    const cores = lv['cores']
    if (!Array.isArray(cores) || cores.length < 2) p.push('listras_verticais.cores precisa de pelo menos 2 cores')
    else cores.forEach((c, i) => cor(c, `listras_verticais.cores[${i}]`, true))
    if (lv['largura'] !== undefined && !(Number.isInteger(lv['largura']) && (lv['largura'] as number) >= 1)) p.push('listras_verticais.largura deve ser um inteiro >= 1')
  }
  const lh = objeto(d['listras_horizontais'], 'listras_horizontais')
  if (lh) {
    const cores = lh['cores']
    if (!Array.isArray(cores) || cores.length < 2) p.push('listras_horizontais.cores precisa de pelo menos 2 cores')
    else cores.forEach((c, i) => cor(c, `listras_horizontais.cores[${i}]`, true))
    const a = lh['altura']
    if (a !== undefined && !(Number.isInteger(a) && (a as number) >= 1 && (a as number) <= 16)) p.push('listras_horizontais.altura deve ser um inteiro de 1 a 16')
  }
  const mm = objeto(d['meio_a_meio'], 'meio_a_meio')
  if (mm) {
    cor(mm['cor'], 'meio_a_meio.cor', true)
    if (mm['lado'] !== undefined && mm['lado'] !== 'esquerda' && mm['lado'] !== 'direita') p.push('meio_a_meio.lado deve ser "esquerda" ou "direita"')
  }
  const fd = objeto(d['faixa_diagonal'], 'faixa_diagonal')
  if (fd) {
    cor(fd['cor'], 'faixa_diagonal.cor', true)
    const l = fd['largura']
    if (l !== undefined && !(typeof l === 'number' && l >= 2 && l <= 40)) p.push('faixa_diagonal.largura deve ficar entre 2 e 40')
    if (fd['inicio'] !== undefined && fd['inicio'] !== 'esquerda' && fd['inicio'] !== 'direita') p.push('faixa_diagonal.inicio deve ser "esquerda" ou "direita"')
  }
  const fp = objeto(d['faixa_peito'], 'faixa_peito')
  if (fp) {
    cor(fp['cor'], 'faixa_peito.cor', true)
    linhas(fp['linhas'], 'faixa_peito.linhas', 32)
  }
  const faixas = d['faixas']
  if (faixas !== undefined) {
    if (!Array.isArray(faixas)) p.push('faixas deve ser uma lista')
    else
      faixas.forEach((f: unknown, i) => {
        const o = objeto(f, `faixas[${i}]`)
        if (!o) return
        cor(o['cor'], `faixas[${i}].cor`, true)
        const regiao = o['regiao']
        if (typeof regiao !== 'string' || !(regiao in TAMANHO_REGIAO)) p.push(`faixas[${i}].regiao deve ser frente, costas, laterais ou mangas`)
        else linhas(o['linhas'], `faixas[${i}].linhas`, TAMANHO_REGIAO[regiao as RegiaoTecido][1])
        if (o['linhas'] === undefined) p.push(`faixas[${i}].linhas é obrigatório`)
      })
  }
  return p
}

/**
 * Pesos aproximados de cada estilo na área visível da camisa, para a cor média
 * (escolha automática de uniforme). O resto é o tecido de base.
 */
export const PESO_NA_CAMISA = { mangas: 0.2, faixa_diagonal: 0.25, faixa_peito: 0.2, meio_a_meio: 0.5 } as const
