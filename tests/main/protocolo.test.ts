import { describe, expect, it } from 'vitest'
import { resolverUrl } from '../../src/main/protocolo'

const raizes = {
  pacote: (id: string) => (id === 'brasil-2026' ? 'C:\\proj\\pacotes\\brasil-2026' : null),
  carreira: () => 'C:\\dados\\carreiras\\minha-x1',
}

describe('protocolo we-arquivo', () => {
  it('resolve escudo do pacote e da carreira', () => {
    expect(resolverUrl('we-arquivo://pacote/brasil-2026/escudos/FLA.png?v=3', raizes)).toBe('C:\\proj\\pacotes\\brasil-2026\\escudos\\FLA.png')
    expect(resolverUrl('we-arquivo://carreira/pacote/escudos/FLA.png', raizes)).toBe('C:\\dados\\carreiras\\minha-x1\\pacote\\escudos\\FLA.png')
  })

  it('recusa sair da pasta, pacote desconhecido, outro host e não-imagem', () => {
    expect(resolverUrl('we-arquivo://pacote/brasil-2026/..%2F..%2Fsegredo.png', raizes)).toBeNull()
    expect(resolverUrl('we-arquivo://pacote/outro/escudos/FLA.png', raizes)).toBeNull()
    expect(resolverUrl('we-arquivo://disco/c/x.png', raizes)).toBeNull()
    expect(resolverUrl('we-arquivo://pacote/brasil-2026/times/FLA.json', raizes)).toBeNull()
    expect(resolverUrl('file:///c:/x.png', raizes)).toBeNull()
  })

  it('sem carreira aberta não resolve nada da carreira', () => {
    expect(resolverUrl('we-arquivo://carreira/pacote/escudos/FLA.png', { ...raizes, carreira: () => null })).toBeNull()
  })
})
