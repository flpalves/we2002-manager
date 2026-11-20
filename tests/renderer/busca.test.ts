import { describe, expect, it } from 'vitest'
import { filtrarJogadores, filtrarTimes, normalizarBusca } from '@renderer/busca'

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

describe('filtrarJogadores', () => {
  const jogadores = [
    { nome: 'João Lopes', nome_we: 'J LOPES', posicao: 'GK' },
    { nome: 'Lucas Perri', nome_we: 'PERRI', posicao: 'GK' },
    { nome: 'Lucas Moura', nome_we: 'L MOURA', posicao: 'OH' },
    { nome: 'Gabriel Barbosa', nome_we: 'GABIGOL', posicao: 'CF' },
  ]

  it('sem termo nem posição devolve todos, na ordem', () => {
    expect(filtrarJogadores(jogadores, '  ', null)).toEqual(jogadores)
  })

  it('filtra pela posição principal', () => {
    expect(filtrarJogadores(jogadores, '', 'GK').map((j) => j.nome)).toEqual(['João Lopes', 'Lucas Perri'])
  })

  it('busca sem acento, no nome ou no nome do WE, e combina com a posição', () => {
    expect(filtrarJogadores(jogadores, 'joao', null).map((j) => j.nome)).toEqual(['João Lopes'])
    expect(filtrarJogadores(jogadores, 'gabigol', null).map((j) => j.nome)).toEqual(['Gabriel Barbosa'])
    expect(filtrarJogadores(jogadores, 'lucas', 'OH').map((j) => j.nome)).toEqual(['Lucas Moura'])
    expect(filtrarJogadores(jogadores, 'moura lucas', null).map((j) => j.nome)).toEqual(['Lucas Moura'])
  })
})
