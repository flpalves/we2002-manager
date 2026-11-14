import { join, resolve, sep } from 'node:path'

/**
 * Protocolo `we-arquivo://` para o renderer ver PNGs do pacote e da carreira sem acesso
 * ao disco: `we-arquivo://pacote/<id>/escudos/FLA.png` e `we-arquivo://carreira/<caminho>`
 * (carreira aberta). Só resolve arquivos de imagem dentro dessas pastas.
 */
export const ESQUEMA = 'we-arquivo'

export interface Raizes {
  pacote: (id: string) => string | null
  carreira: () => string | null
}

const EXTENSOES = /\.(png|jpe?g|webp)$/i

export function resolverUrl(url: string, raizes: Raizes): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  if (u.protocol !== `${ESQUEMA}:`) return null
  const partes = decodeURIComponent(u.pathname).split('/').filter(Boolean)
  let base: string | null
  if (u.hostname === 'pacote') {
    const id = partes.shift()
    if (!id || !/^[a-z0-9-]+$/.test(id)) return null
    base = raizes.pacote(id)
  } else if (u.hostname === 'carreira') {
    base = raizes.carreira()
  } else {
    return null
  }
  if (!base || partes.length === 0 || partes.some((p) => p === '..' || p === '.')) return null
  const alvo = resolve(join(base, ...partes))
  if (!alvo.startsWith(resolve(base) + sep) || !EXTENSOES.test(alvo)) return null
  return alvo
}
