import { describe, expect, it } from 'vitest'
import { proximoFoco, type Retangulo } from '@renderer/gamepad/espacial'
import { LeitorControle, comandosAtivos } from '@renderer/gamepad/controle'

const r = (x: number, y: number, largura = 100, altura = 30): Retangulo => ({ x, y, largura, altura })

describe('navegação espacial', () => {
  // Grade 3x2 de botões + menu lateral alto à esquerda
  const itens = {
    a1: r(200, 0),
    a2: r(320, 0),
    a3: r(440, 0),
    b1: r(200, 50),
    b2: r(320, 50),
    menu: r(0, 0, 180, 700),
  }
  const candidatos = Object.entries(itens).map(([item, ret]) => ({ item, ret }))

  it('anda para o vizinho imediato em cada direção', () => {
    expect(proximoFoco(itens.a1, candidatos, 'direita')).toBe('a2')
    expect(proximoFoco(itens.a2, candidatos, 'esquerda')).toBe('a1')
    expect(proximoFoco(itens.a1, candidatos, 'baixo')).toBe('b1')
    expect(proximoFoco(itens.b2, candidatos, 'cima')).toBe('a2')
  })

  it('sem vizinho alinhado, vai para o mais próximo na diagonal', () => {
    expect(proximoFoco(itens.a3, candidatos, 'baixo')).toBe('b2')
    expect(proximoFoco(itens.b2, candidatos, 'direita')).toBe('a3')
  })

  it('prefere o alinhado a um mais perto na diagonal', () => {
    const c = [
      { item: 'diagonal', ret: r(300, 40) }, // mais perto na vertical, mas fora da coluna
      { item: 'alinhado', ret: r(160, 140) },
    ]
    expect(proximoFoco(r(160, 0), c, 'baixo')).toBe('alinhado')
  })

  it('chega ao menu lateral pela esquerda', () => {
    expect(proximoFoco(itens.b1, candidatos, 'esquerda')).toBe('menu')
  })

  it('devolve null quando não há nada naquela direção', () => {
    expect(proximoFoco(itens.a1, candidatos, 'cima')).toBeNull()
  })

  it('ignora elementos invisíveis (tamanho zero)', () => {
    const c = [...candidatos, { item: 'oculto', ret: r(320, 25, 0, 0) }]
    expect(proximoFoco(itens.a2, c, 'baixo')).toBe('b2')
  })
})

describe('leitor do controle', () => {
  const nenhum = { botoes: [], eixos: [0, 0] }
  const botao = (i: number) => {
    const b = new Array(17).fill(false)
    b[i] = true
    return { botoes: b, eixos: [0, 0] }
  }

  it('dispara uma vez ao apertar e não repete botões de ação', () => {
    const l = new LeitorControle()
    expect(l.atualizar(botao(0), 0)).toEqual(['confirmar'])
    expect(l.atualizar(botao(0), 50)).toEqual([])
    expect(l.atualizar(botao(0), 2000)).toEqual([])
    expect(l.atualizar(nenhum, 2100)).toEqual([])
    expect(l.atualizar(botao(0), 2200)).toEqual(['confirmar'])
  })

  it('repete direções segurando: atraso e depois intervalo', () => {
    const l = new LeitorControle({ atrasoRepeticao: 400, intervaloRepeticao: 100, zonaMorta: 0.5 })
    expect(l.atualizar(botao(13), 0)).toEqual(['baixo'])
    expect(l.atualizar(botao(13), 399)).toEqual([])
    expect(l.atualizar(botao(13), 400)).toEqual(['baixo'])
    expect(l.atualizar(botao(13), 450)).toEqual([])
    expect(l.atualizar(botao(13), 500)).toEqual(['baixo'])
  })

  it('analógico vira direção fora da zona morta, pelo eixo dominante', () => {
    expect([...comandosAtivos({ botoes: [], eixos: [0.3, 0.2] }, 0.5)]).toEqual([])
    expect([...comandosAtivos({ botoes: [], eixos: [0.9, 0.6] }, 0.5)]).toEqual(['direita'])
    expect([...comandosAtivos({ botoes: [], eixos: [-0.2, -0.8] }, 0.5)]).toEqual(['cima'])
  })

  it('mapeia LB/RB, LT/RT e START', () => {
    const l = new LeitorControle()
    expect(l.atualizar(botao(4), 0)).toEqual(['secaoAnterior'])
    expect(l.atualizar(botao(5), 10)).toEqual(['secaoProxima'])
    expect(l.atualizar(botao(7), 20)).toEqual(['abaProxima'])
    expect(l.atualizar(botao(9), 30)).toEqual(['continuar'])
  })
})
