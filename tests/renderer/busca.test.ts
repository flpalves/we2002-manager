import { describe, expect, it } from 'vitest'
import { filtrarTimes, normalizarBusca } from '@renderer/busca'

const times = [
  { sigla: 'ATG', nome: 'Atlético-GO', nome_curto: 'Atlético', estado: 'GO', pais: 'BRA' },
  { sigla: 'CAM', nome: 'Atlético Mineiro', nome_curto: 'Atlético', estado: 'MG', pais: 'BRA' },
  { sigla: 'GRE', nome: 'Grêmio', nome_curto: 'Grêmio', estado: 'RS', pais: 'BRA' },
  { sigla: 'SAO', nome: 'São Paulo', nome_curto: 'São Paulo', estado: 'SP', pais: 'BRA' },
  { sigla: 'BOC', nome: 'Boca Juniors', nome_curto: 'Boca', pais: 'ARG' },
]
const siglas = (termo: string) => filtrarTimes(times, termo).map((t) => t.sigla)

describe('busca de times', () => {
  it('normaliza acento, caixa e pontuação', () => {
    expect(normalizarBusca('  Grêmio  ')).toBe('gremio')
    expect(normalizarBusca('Atlético-GO')).toBe('atletico go')
  })

  it('termo vazio devolve tudo na ordem original', () => {
    expect(siglas('')).toEqual(['ATG', 'CAM', 'GRE', 'SAO', 'BOC'])
    expect(siglas('   ')).toHaveLength(5)
  })

  it('acha sem acento e sem caixa', () => {
    expect(siglas('gremio')).toEqual(['GRE'])
    expect(siglas('SAO PAULO')).toEqual(['SAO'])
  })

  it('palavras em qualquer ordem, incluindo estado e país', () => {
    expect(siglas('mg atletico')).toEqual(['CAM'])
    expect(siglas('arg')).toEqual(['BOC'])
  })

  it('sigla exata vem antes de nomes que começam com o termo', () => {
    expect(siglas('sao')).toEqual(['SAO'])
    expect(siglas('cam')).toEqual(['CAM'])
    expect(siglas('atl')).toEqual(['ATG', 'CAM'])
  })

  it('nada encontrado devolve lista vazia', () => {
    expect(siglas('flamengo')).toEqual([])
  })
})
