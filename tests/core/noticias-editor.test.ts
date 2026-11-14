import { describe, expect, it } from 'vitest'
import { catalogoPadrao } from '@core/noticias/catalogoPadrao'
import { eventoNovo, frequenciaEsperada, idLivre, limparEfeito, limparEvento, validarCatalogo, validarEvento, type BaseFrequencia } from '@core/noticias/editor'
import { EventoCatalogoSchema, type EventoCatalogo, type EventoCatalogoEntrada } from '@shared/esquemas/noticias'

const evento = (e: Partial<EventoCatalogoEntrada> = {}): EventoCatalogo =>
  EventoCatalogoSchema.parse({
    id: 'teste',
    tipo: 'elenco',
    gatilho: { momento: 'semana', condicoes: [] },
    alvo: 'jogador_aleatorio_do_usuario',
    chance: 0.1,
    texto: '{jogador} faz algo.',
    efeitos: [{ campo: 'moral', delta: 3 }],
    ...e,
  })
const codigos = (e: EventoCatalogo) => validarEvento(e).map((p) => p.codigo)
const base: BaseFrequencia = { fatorChance: 1, semanasPorTemporada: 52, janelas: 2, jogosPorTemporada: 52 }

describe('validação dos eventos do catálogo', () => {
  it('o catálogo padrão não tem erro', () => {
    expect(validarCatalogo(catalogoPadrao()).filter((p) => p.nivel === 'erro')).toEqual([])
  })

  it('evento novo é válido e ganha id livre', () => {
    const e = eventoNovo(['evento-novo'])
    expect(e.id).toBe('evento-novo-2')
    expect(validarEvento(e).filter((p) => p.nivel === 'erro')).toEqual([])
  })

  it('condição de partida fora do pós-jogo e de jogador com alvo de time nunca disparam (erro)', () => {
    expect(codigos(evento({ gatilho: { momento: 'semana', condicoes: [{ campo: 'partida.gols_pro', op: '>=', valor: 3 }] } }))).toContain('condicao_partida')
    expect(codigos(evento({ alvo: 'time_usuario', texto: 'x', gatilho: { momento: 'semana', condicoes: [{ campo: 'jogador.idade', op: '<', valor: 20 }] } }))).toContain('condicao_jogador')
  })

  it('resultado da partida só aceita V/E/D com "é" ou "não é"', () => {
    const e = evento({ gatilho: { momento: 'pos_jogo', condicoes: [{ campo: 'partida.resultado', op: '>', valor: 'X' }] } })
    expect(codigos(e)).toEqual(expect.arrayContaining(['condicao_valor', 'condicao_operador']))
    expect(codigos(evento({ gatilho: { momento: 'pos_jogo', condicoes: [{ campo: 'partida.resultado', op: '==', valor: 'V' }] } }))).not.toContain('condicao_valor')
  })

  it('efeito de jogador com alvo de time e marcador {jogador} sem jogador viram aviso', () => {
    const p = validarEvento(evento({ alvo: 'time_usuario', texto: '{jogador} e {time}', efeitos: [{ campo: 'moral', delta: 2 }] }))
    expect(p.find((x) => x.codigo === 'efeito_sem_jogador')?.nivel).toBe('aviso')
    expect(p.find((x) => x.codigo === 'marcador_jogador')?.nivel).toBe('aviso')
  })

  it('atributo sem sigla válida é erro; {valor} sem saldo e marcador desconhecido são avisos', () => {
    const e = evento({ texto: '{jogador} {valor} {foo}', efeitos: [{ campo: 'atributo', delta: 1, atributo: 'XYZ' }] })
    expect(codigos(e)).toEqual(expect.arrayContaining(['efeito_atributo', 'marcador_valor', 'marcador_desconhecido']))
  })

  it('decisão: ids das opções únicos e texto do botão obrigatório', () => {
    const e = evento({
      escolhas: [
        { id: 'a', texto: 'Sim', efeitos: [] },
        { id: 'a', texto: ' ', efeitos: [] },
      ],
    })
    expect(codigos(e)).toEqual(expect.arrayContaining(['escolha_repetida', 'escolha_texto']))
  })

  it('catálogo acusa id repetido', () => {
    expect(validarCatalogo([evento(), evento()]).map((p) => p.codigo)).toContain('id_repetido')
  })
})

describe('limpeza antes de gravar', () => {
  it('tira campos que o tipo de efeito não usa e a chance de 100%', () => {
    expect(limparEfeito({ campo: 'saldo', delta: 3, valor: 500, chance: 1, semanas: 2 })).toEqual({ campo: 'saldo', valor: 500 })
    expect(limparEfeito({ campo: 'lesao', delta: 3 })).toEqual({ campo: 'lesao', semanas: 1 })
    expect(limparEfeito({ campo: 'atributo', delta: 1, chance: 0.5 })).toEqual({ campo: 'atributo', delta: 1, atributo: 'OFF', chance: 0.5 })
  })

  it('resultado vazio da opção some e o evento continua válido no esquema', () => {
    const e = limparEvento(
      evento({
        texto: '  oi  ',
        escolhas: [
          { id: 'a', texto: 'A', resultado: '  ', efeitos: [] },
          { id: 'b', texto: 'B', resultado: 'ok', efeitos: [] },
        ],
      }),
    )
    expect(e.texto).toBe('oi')
    expect(e.escolhas?.[0]).toEqual({ id: 'a', texto: 'A', efeitos: [] })
    expect(EventoCatalogoSchema.safeParse(e).success).toBe(true)
  })

  it('idLivre normaliza a base', () => {
    expect(idLivre('Meu Evento!', [])).toBe('meu-evento')
    expect(idLivre('x', ['x', 'x-2'])).toBe('x-3')
  })
})

describe('periodicidade estimada', () => {
  const g = (momento: EventoCatalogo['gatilho']['momento']) => ({ momento, condicoes: [] })

  it('sem intervalo: 1/p semanas entre ocorrências', () => {
    const f = frequenciaEsperada({ chance: 0.1, intervalo_minimo_semanas: 0, gatilho: g('semana') }, base)
    expect(f.porAvaliacao).toBeCloseTo(0.1)
    expect(f.semanasEntre).toBeCloseTo(10)
    expect(f.porTemporada).toBeCloseTo(5.2)
  })

  it('o intervalo mínimo soma o bloqueio à espera', () => {
    const f = frequenciaEsperada({ chance: 1, intervalo_minimo_semanas: 13, gatilho: g('semana') }, base)
    expect(f.semanasEntre).toBeCloseTo(13)
    expect(f.porTemporada).toBeCloseTo(4)
  })

  it('o fator de chance multiplica (com teto de 100%) e chance 0 nunca acontece', () => {
    expect(frequenciaEsperada({ chance: 0.6, intervalo_minimo_semanas: 0, gatilho: g('semana') }, { ...base, fatorChance: 2 }).porAvaliacao).toBe(1)
    const nunca = frequenciaEsperada({ chance: 0, intervalo_minimo_semanas: 0, gatilho: g('semana') }, base)
    expect(nunca.porTemporada).toBe(0)
    expect(nunca.semanasEntre).toBeNull()
  })

  it('momentos de janela e virada contam as avaliações da temporada', () => {
    expect(frequenciaEsperada({ chance: 0.3, intervalo_minimo_semanas: 0, gatilho: g('janela_abre') }, base).porTemporada).toBeCloseTo(0.6)
    expect(frequenciaEsperada({ chance: 0.5, intervalo_minimo_semanas: 0, gatilho: g('virada') }, base).porTemporada).toBeCloseTo(0.5)
  })
})
