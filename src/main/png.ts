import { deflateSync, inflateSync } from 'node:zlib'

/**
 * PNG mínimo para os kits (RGBA/RGB de 8 bits, sem entrelaçamento): o main não carrega o
 * `pngjs` (só as ferramentas de linha de comando usam).
 */

const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const TABELA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function bloco(tipo: string, dados: Uint8Array): Buffer {
  const cab = Buffer.alloc(8)
  cab.writeUInt32BE(dados.length, 0)
  cab.write(tipo, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([cab.subarray(4), dados])), 0)
  return Buffer.concat([cab, dados, crc])
}

export interface ImagemRgba {
  largura: number
  altura: number
  dados: Uint8Array | Uint8ClampedArray
}

export function codificarPng({ largura, altura, dados }: ImagemRgba): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largura, 0)
  ihdr.writeUInt32BE(altura, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  const linha = largura * 4
  const cru = Buffer.alloc((linha + 1) * altura)
  for (let y = 0; y < altura; y++) {
    cru[y * (linha + 1)] = 0 // sem filtro
    cru.set(dados.subarray(y * linha, (y + 1) * linha), y * (linha + 1) + 1)
  }
  return Buffer.concat([ASSINATURA, bloco('IHDR', ihdr), bloco('IDAT', deflateSync(cru, { level: 9 })), bloco('IEND', new Uint8Array(0))])
}

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

export function decodificarPng(arquivo: Uint8Array): ImagemRgba {
  const buf = Buffer.from(arquivo)
  if (!buf.subarray(0, 8).equals(ASSINATURA)) throw new Error('não é um PNG')
  let pos = 8
  let largura = 0
  let altura = 0
  let tipo = 0
  const idat: Buffer[] = []
  while (pos < buf.length) {
    const tam = buf.readUInt32BE(pos)
    const nome = buf.toString('ascii', pos + 4, pos + 8)
    const dados = buf.subarray(pos + 8, pos + 8 + tam)
    if (nome === 'IHDR') {
      largura = dados.readUInt32BE(0)
      altura = dados.readUInt32BE(4)
      tipo = dados[9]!
      if (dados[8] !== 8 || (tipo !== 6 && tipo !== 2) || dados[12] !== 0) throw new Error('PNG não suportado (só RGB/RGBA de 8 bits, sem entrelaçamento)')
    } else if (nome === 'IDAT') idat.push(dados)
    else if (nome === 'IEND') break
    pos += 12 + tam
  }
  const bpp = tipo === 6 ? 4 : 3
  const linha = largura * bpp
  const cru = inflateSync(Buffer.concat(idat))
  const px = new Uint8Array(linha * altura)
  for (let y = 0; y < altura; y++) {
    const filtro = cru[y * (linha + 1)]!
    const ent = y * (linha + 1) + 1
    const sai = y * linha
    for (let i = 0; i < linha; i++) {
      const x = cru[ent + i]!
      const a = i >= bpp ? px[sai + i - bpp]! : 0
      const b = y > 0 ? px[sai - linha + i]! : 0
      const c = i >= bpp && y > 0 ? px[sai - linha + i - bpp]! : 0
      const v = filtro === 0 ? x : filtro === 1 ? x + a : filtro === 2 ? x + b : filtro === 3 ? x + ((a + b) >> 1) : paeth(a, b, c) + x
      px[sai + i] = v & 0xff
    }
  }
  if (bpp === 4) return { largura, altura, dados: px }
  const rgba = new Uint8Array(largura * altura * 4)
  for (let i = 0; i < largura * altura; i++) rgba.set([px[i * 3]!, px[i * 3 + 1]!, px[i * 3 + 2]!, 255], i * 4)
  return { largura, altura, dados: rgba }
}
