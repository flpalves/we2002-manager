/**
 * Desenha a página de textura de um kit (128x256, RGBA) a partir do `kit.design`, usando um
 * kit original do WE como base para manter dobras e sombras. Núcleo puro: quem chama lê o
 * PNG base e a página 8 bits (`kits/<base>_pagina.bin`) e grava o resultado.
 *
 * Usado pelo `tools/desenhar-kit.ts` (linha de comando) e pelo editor de uniformes (prévia ao
 * vivo no renderer e geração da arte no main).
 */

import { REGIOES_KIT, corDoTecido, problemasDoDesign, regiaoDoPixel, type DesignKit, type RegiaoTecido } from './estampas'

export const PAGINA_KIT = { largura: 128, altura: 256 } as const
const PW = PAGINA_KIT.largura
const PH = PAGINA_KIT.altura

/** Kit original do WE usado como base. */
export interface BaseKit {
  /** PNG original decodificado: 128x256 RGBA. */
  rgba: Uint8Array | Uint8ClampedArray
  /** Página 8 bits (índices de paleta) da VRAM: 128x256; índices >= 0xF0 são algarismos. */
  pagina: Uint8Array
}

type RGB = [number, number, number]
type RGBA = [number, number, number, number]

const dentro = (x: number, y: number, [x0, y0, x1, y1]: readonly number[]) => x >= x0! && x < x1! && y >= y0! && y < y1!

function hsv([r, g, b]: readonly number[]): [number, number, number] {
  const R = r! / 255
  const G = g! / 255
  const B = b! / 255
  const mx = Math.max(R, G, B)
  const mn = Math.min(R, G, B)
  const d = mx - mn
  let h = 0
  if (d) h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4
  return [(h / 6 + 1) % 1, mx ? d / mx : 0, mx]
}
const lum = ([r, g, b]: readonly number[]) => 0.299 * r! + 0.587 * g! + 0.114 * b!
export function hexRgb(h: unknown): RGB | null {
  const m = typeof h === 'string' ? /^#?([0-9a-f]{6})$/i.exec(h) : null
  return m ? ([0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16)) as RGB) : null
}
const difHue = (a: number, b: number) => Math.min(Math.abs(a - b), 1 - Math.abs(a - b))

/**
 * Página do kit em RGBA, na escala pedida (1 = 128x256; 4 = 512x1024, a "arte 4x").
 * Lança erro se o design for inválido.
 */
export function desenharKit(base: BaseKit, d: DesignKit, escala = 1): Uint8ClampedArray {
  const problemas = problemasDoDesign(d)
  if (problemas.length) throw new Error(`design inválido: ${problemas.join('; ')}`)
  if (base.rgba.length !== PW * PH * 4 || base.pagina.length < PW * PH) throw new Error('kit base precisa ter 128x256')
  const S = Math.max(1, Math.floor(escala))
  const png = base.rgba
  const ref = base.pagina
  const px = (x: number, y: number): RGBA => {
    const o = (y * PW + x) * 4
    return [png[o]!, png[o + 1]!, png[o + 2]!, png[o + 3]!]
  }

  // Costas sem número: cada pixel vem de alguma costa onde ele não é algarismo.
  const limpo: RGBA[] = []
  for (let ty = 0; ty < 24; ty++)
    for (let tx = 0; tx < 20; tx++) {
      let v: RGBA | null = null
      for (let k = 0; k < 10 && !v; k++) {
        const x = (k % 5) * 20 + tx
        const y = 80 + Math.floor(k / 5) * 24 + ty
        if (ref[y * PW + x]! < 0xf0) v = px(x, y)
      }
      limpo.push(v || [128, 128, 128, 255])
    }
  const fonte = (x: number, y: number): RGBA => (dentro(x, y, REGIOES_KIT.costas) ? limpo[((y - 80) % 24) * 20 + (x % 20)]! : px(x, y))

  // Cor principal do kit original = matiz mais comum entre pixels saturados da frente.
  const hist = new Array<number>(36).fill(0)
  const amostras: [number, RGBA][] = []
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 64; x++) {
      const c = fonte(x, y)
      if (!c[3]) continue
      const [h, s, v] = hsv(c)
      if (s > 0.35 && v > 0.25) {
        hist[Math.floor(h * 36) % 36]!++
        amostras.push([h, c])
      }
    }
  const hPrincipal = (hist.indexOf(Math.max(...hist)) + 0.5) / 36
  const lumsPrincipal = amostras
    .filter(([h]) => difHue(h, hPrincipal) < 0.06)
    .map(([, c]) => lum(c))
    .sort((a, b) => a - b)
  const lumRef = lumsPrincipal[Math.floor(lumsPrincipal.length * 0.7)] || 160 // tom "claro" do tecido

  const cores = { camisa: hexRgb(d.camisa)!, detalhe: hexRgb(d.detalhe), calcao: hexRgb(d.calcao), meiao: hexRgb(d.meiao) }
  const sombrear = (alvo: RGB, c: readonly number[]): RGB => {
    const f = Math.min(1.15, lum(c) / lumRef)
    return alvo.map((v) => Math.max(0, Math.min(255, Math.round(v * f)))) as RGB
  }
  const tecido = new Set<string>(['frente', 'costas', 'laterais', 'mangas'])
  const regioes = Object.entries(REGIOES_KIT).filter(([nome]) => nome !== 'detalhes')
  const cache = new Map<string, RGB | null>()
  const rgbDe = (hex: string) => {
    let c = cache.get(hex)
    if (c === undefined) cache.set(hex, (c = hexRgb(hex)))
    return c
  }

  const out = new Uint8ClampedArray(PW * S * PH * S * 4)
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      let c = fonte(x, y)
      const uniforme = regioes.find(([, r]) => dentro(x, y, r))
      // Fora do mapa de regiões: só a cor principal do kit original é trocada
      // (o mapa é aproximado e varia de um kit para outro).
      if (!uniforme && c[3]) {
        const [h, sat] = hsv(c)
        if (sat > 0.3 && difHue(h, hPrincipal) < 0.08) c = [...sombrear(cores.camisa, c), c[3]]
      }
      if (uniforme && c[3]) {
        const [nome] = uniforme
        const [h, s] = hsv(c)
        const principal = s > 0.3 && difHue(h, hPrincipal) < 0.08
        let alvo: RGB | null
        if (nome === 'calcao') alvo = principal ? cores.camisa : cores.calcao
        else if (nome === 'meiao') alvo = principal || s <= 0.3 ? cores.meiao : cores.detalhe
        else alvo = principal ? cores.camisa : s > 0.3 ? cores.detalhe : null // cinzas/brancos ficam como estão
        if (principal && tecido.has(nome)) {
          const local = regiaoDoPixel(x, y)
          if (local) alvo = rgbDe(corDoTecido(local.regiao, local.lx, local.ly, d)) ?? alvo
        }
        if (alvo) c = [...sombrear(alvo, c), c[3]]
        for (const f of d.faixas || []) {
          const r = REGIOES_KIT[f.regiao as RegiaoTecido]
          if (!r || !dentro(x, y, r)) continue
          const yy = f.regiao === 'costas' ? (y - 80) % 24 : y - r[1]
          if (yy >= f.linhas[0] && yy < f.linhas[1] && c[3]) c = [...sombrear(hexRgb(f.cor)!, fonte(x, y)), c[3]]
        }
      }
      for (let j = 0; j < S; j++)
        for (let i = 0; i < S; i++) {
          const o = ((y * S + j) * PW * S + x * S + i) * 4
          out[o] = c[0]
          out[o + 1] = c[1]
          out[o + 2] = c[2]
          out[o + 3] = c[3]
        }
    }
  return out
}
