import { describe, expect, it } from 'vitest'
import { janelaDaSemana, ordenarJanelas, validarJanelas } from '@core/mercado/janelas'
import { dentroDaJanela } from '@core/mercado/ia'
import { mesclarRegras, PADROES } from '@core/config/padroes'

const codigos = (js: Parameters<typeof validarJanelas>[0], semanas = 52) => validarJanelas(js, semanas).map((p) => `${p.nivel}:${p.codigo}`)

describe('janelas de transferência', () => {
  it('as padrão são válidas e têm nome', () => {
    expect(codigos(PADROES.mercado.janelas)).toEqual([])
    expect(PADROES.mercado.janelas.every((j) => j.nome)).toBe(true)
  })

  it('acha a janela da semana (bordas incluídas)', () => {
    const js = [
      { semana_inicio: 1, semana_fim: 16, nome: 'Início' },
      { semana_inicio: 27, semana_fim: 31 },
    ]
    expect(janelaDaSemana(js, 1)?.nome).toBe('Início')
    expect(janelaDaSemana(js, 16)?.nome).toBe('Início')
    expect(janelaDaSemana(js, 17)).toBeNull()
    expect(janelaDaSemana(js, 31)?.semana_inicio).toBe(27)
  })

  it('o regras.json do pacote troca as janelas usadas pelo mercado', () => {
    const regras = mesclarRegras(PADROES, { mercado: { janelas: [{ semana_inicio: 40, semana_fim: 44 }] } } as never)
    expect(regras.mercado.janelas).toEqual([{ semana_inicio: 40, semana_fim: 44 }])
    expect(dentroDaJanela(10, regras)).toBe(false)
    expect(dentroDaJanela(42, regras)).toBe(true)
    expect(dentroDaJanela(10, PADROES)).toBe(true)
  })

  it('erros: fim antes do início, fora da temporada, não inteiro, sobreposição', () => {
    expect(codigos([{ semana_inicio: 10, semana_fim: 5 }])).toEqual(['erro:janela_invalida'])
    expect(codigos([{ semana_inicio: 50, semana_fim: 55 }])).toEqual(['erro:janela_invalida'])
    expect(codigos([{ semana_inicio: 0, semana_fim: 3 }])).toEqual(['erro:janela_invalida'])
    expect(codigos([{ semana_inicio: 1.5, semana_fim: 3 }])).toEqual(['erro:janela_invalida'])
    expect(
      codigos([
        { semana_inicio: 20, semana_fim: 30 },
        { semana_inicio: 1, semana_fim: 20 },
      ]),
    ).toEqual(['erro:janelas_sobrepostas'])
  })

  it('avisos: nenhuma janela e janelas coladas', () => {
    expect(codigos([])).toEqual(['aviso:sem_janela'])
    expect(
      codigos([
        { semana_inicio: 1, semana_fim: 10 },
        { semana_inicio: 11, semana_fim: 12 },
      ]),
    ).toEqual(['aviso:janelas_coladas'])
  })

  it('mensagens usam o nome da janela, ou "Janela N"', () => {
    const [p] = validarJanelas(
      [
        { semana_inicio: 1, semana_fim: 10, nome: 'Verão' },
        { semana_inicio: 5, semana_fim: 12 },
      ],
      52,
    )
    expect(p!.mensagem).toMatch(/Verão e Janela 2 se sobrepõem/)
  })

  it('ordena por início', () => {
    expect(ordenarJanelas([{ semana_inicio: 27, semana_fim: 31 }, { semana_inicio: 1, semana_fim: 16 }]).map((j) => j.semana_inicio)).toEqual([1, 27])
  })
})
