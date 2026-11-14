import { describe, expect, it } from 'vitest'
import { PADROES, type Regras } from '@core/config/padroes'
import { criarRng } from '@core/rng'
import { aplicarEfeito, sortearEventos, type AlvoEfeitos, type ContextoNoticias, type JogadorNoticia } from '@core/noticias/motor'
import { catalogoPadrao } from '@core/noticias/catalogoPadrao'
import * as info from '@core/noticias/informativas'
import { CatalogoSchema, type EventoCatalogoEntrada } from '@shared/esquemas/noticias'

const dinheiro = (c: number) => `R$${c / 100}`
const nome = (s: string) => `Time ${s}`

function jogador(id: string, extra: Partial<JogadorNoticia> = {}): JogadorNoticia {
  return { id, nome: `J${id}`, idade: 25, moral: 50, condicao: 90, geral: 12, potencial: 14, titular: true, fora: false, goleiro: false, ...extra }
}

function ctx(extra: Partial<ContextoNoticias> = {}): ContextoNoticias {
  return {
    momento: 'semana',
    semanaAbsoluta: 202610,
    time: { sigla: 'AAA', saldo: 1000, confianca: 60, aproveitamento: 0.5, folhaAcima: false },
    jogadores: [jogador('1', { idade: 20 }), jogador('2', { idade: 33, titular: false }), jogador('3', { moral: 20 })],
    partida: null,
    ultimaOcorrencia: new Map(),
    atributosDoFoco: ['PAS', 'DRI'],
    outrosClubes: ['BBB', 'CCC'],
    escolhaPendente: false,
    ...extra,
  }
}

const catalogo = (eventos: EventoCatalogoEntrada[]) => CatalogoSchema.parse(eventos)
const regras = (fator = 1, maximo = 1): Regras => ({ ...PADROES, noticias: { ...PADROES.noticias, maximo_por_avaliacao: maximo, fator_chance: fator } })

const base: EventoCatalogoEntrada = {
  id: 'teste',
  tipo: 'elenco',
  gatilho: { momento: 'semana', condicoes: [{ campo: 'jogador.idade', op: '<=', valor: 23 }] },
  alvo: 'jogador_condicionado',
  chance: 1,
  texto: '{jogador} brilha no {time}.',
  efeitos: [{ campo: 'moral', delta: 8 }, { campo: 'atributo_aleatorio_do_foco', delta: 1 }],
}

describe('motor de eventos', () => {
  it('catálogo padrão é válido e cobre os momentos e as escolhas', () => {
    const c = catalogoPadrao()
    expect(c.length).toBeGreaterThanOrEqual(20)
    expect(new Set(c.map((e) => e.gatilho.momento))).toEqual(new Set(['semana', 'pos_jogo', 'janela_abre', 'janela_fecha']))
    expect(c.filter((e) => e.escolhas).length).toBeGreaterThanOrEqual(4)
  })

  it('esquema recusa id repetido e campo desconhecido', () => {
    expect(CatalogoSchema.safeParse([base, base]).success).toBe(false)
    expect(CatalogoSchema.safeParse([{ ...base, efeitos: [{ campo: 'gols', delta: 1 }] }]).success).toBe(false)
  })

  it('condições escolhem o alvo; efeitos saem resolvidos; texto preenchido', () => {
    const [o] = sortearEventos(catalogo([base]), ctx(), regras(), criarRng(1), dinheiro, nome)
    expect(o).toMatchObject({ evento: 'teste', jogador: '1', texto: 'J1 brilha no Time AAA.' })
    expect(o!.efeitos[0]).toEqual({ campo: 'moral', jogador: '1', delta: 8 })
    expect(o!.efeitos[1]).toMatchObject({ campo: 'atributo', jogador: '1', delta: 1 })
    expect(['PAS', 'DRI']).toContain((o!.efeitos[1] as { atributo: string }).atributo)
  })

  it('sem alvo elegível, fora do momento, no intervalo mínimo ou sem sorte: nada', () => {
    const c = catalogo([{ ...base, intervalo_minimo_semanas: 6 }])
    expect(sortearEventos(c, ctx({ jogadores: [jogador('9', { idade: 30 })] }), regras(), criarRng(1), dinheiro, nome)).toEqual([])
    expect(sortearEventos(c, ctx({ momento: 'pos_jogo' }), regras(), criarRng(1), dinheiro, nome)).toEqual([])
    expect(sortearEventos(c, ctx({ ultimaOcorrencia: new Map([['teste', 202606]]) }), regras(), criarRng(1), dinheiro, nome)).toEqual([])
    expect(sortearEventos(c, ctx({ ultimaOcorrencia: new Map([['teste', 202604]]) }), regras(), criarRng(1), dinheiro, nome)).toHaveLength(1)
    expect(sortearEventos(c, ctx(), regras(0), criarRng(1), dinheiro, nome)).toEqual([])
    // Lesionado não é alvo.
    expect(sortearEventos(c, ctx({ jogadores: [jogador('1', { idade: 20, fora: true })] }), regras(), criarRng(1), dinheiro, nome)).toEqual([])
  })

  it('condições de time e de partida; máximo por avaliação', () => {
    const c = catalogo([
      { ...base, id: 'a', alvo: 'time_usuario', gatilho: { momento: 'pos_jogo', condicoes: [{ campo: 'partida.resultado', op: '==', valor: 'V' }] }, efeitos: [{ campo: 'confianca', delta: 2 }] },
      { ...base, id: 'b', alvo: 'time_usuario', gatilho: { momento: 'pos_jogo', condicoes: [{ campo: 'time.aproveitamento', op: '>=', valor: 0.4 }] }, efeitos: [] },
    ])
    const vitoria = ctx({ momento: 'pos_jogo', partida: { resultado: 'V', golsPro: 2, golsContra: 0, emCasa: true } })
    expect(sortearEventos(c, vitoria, regras(1, 5), criarRng(1), dinheiro, nome).map((o) => o.evento).sort()).toEqual(['a', 'b'])
    expect(sortearEventos(c, vitoria, regras(1, 1), criarRng(1), dinheiro, nome)).toHaveLength(1)
    const derrota = ctx({ momento: 'pos_jogo', partida: { resultado: 'D', golsPro: 0, golsContra: 1, emCasa: true } })
    expect(sortearEventos(c, derrota, regras(1, 5), criarRng(1), dinheiro, nome).map((o) => o.evento)).toEqual(['b'])
  })

  it('evento com escolha: opções com efeitos resolvidos; só uma escolha pendente por vez', () => {
    const c = catalogo([
      {
        ...base,
        id: 'escolha',
        alvo: 'time_usuario',
        gatilho: { momento: 'semana', condicoes: [] },
        texto: 'Bônus de {valor}?',
        efeitos: [],
        escolhas: [
          { id: 'sim', texto: 'Sim', efeitos: [{ campo: 'saldo', valor: 3000 }] },
          { id: 'nao', texto: 'Não', efeitos: [] },
        ],
      },
    ])
    const [o] = sortearEventos(c, ctx(), regras(), criarRng(1), dinheiro, nome)
    expect(o!.texto).toBe('Bônus de R$30?')
    expect(o!.escolhas).toEqual([
      { id: 'sim', texto: 'Sim', resultado: null, efeitos: [{ campo: 'saldo', time: 'AAA', valor: 3000 }] },
      { id: 'nao', texto: 'Não', resultado: null, efeitos: [] },
    ])
    expect(sortearEventos(c, ctx({ escolhaPendente: true }), regras(), criarRng(1), dinheiro, nome)).toEqual([])
  })

  it('mesma semente, mesmo sorteio (reproduzível)', () => {
    const c = catalogoPadrao()
    const rodar = () => sortearEventos(c, ctx(), regras(30, 3), criarRng(77).derivar('noticias', 10), dinheiro, nome)
    expect(rodar()).toEqual(rodar())
    expect(rodar().length).toBeGreaterThan(0)
  })
})

describe('aplicação dos efeitos (auditável)', () => {
  function mundo() {
    const js = new Map([
      ['1', { moral: 95, condicao: 50, potencial: 20, lesaoDias: 0, atributos: { PAS: 19 } as Record<string, number>, time: 'AAA' }],
      ['2', { moral: 10, condicao: 50, potencial: 10, lesaoDias: 3, atributos: { PAS: 5 } as Record<string, number>, time: 'AAA' }],
    ])
    let confianca = 60
    const lancamentos: [string, number, string][] = []
    const propostas: [string, string][] = []
    const alterados = new Set<string>()
    const alvo: AlvoEfeitos = {
      jogador: (id) => js.get(id),
      jogadoresDoTime: (s) => [...js.entries()].filter(([, j]) => j.time === s).map(([id]) => id),
      alterado: (id) => alterados.add(id),
      confianca: () => confianca,
      definirConfianca: (v) => (confianca = v),
      lancar: (t, v, d) => lancamentos.push([t, v, d]),
      proposta: (j, c) => propostas.push([j, c]),
    }
    return { js, alvo, lancamentos, propostas, alterados, confianca: () => confianca }
  }

  it('respeita os limites e registra antes/depois', () => {
    const m = mundo()
    expect(aplicarEfeito(m.alvo, { campo: 'moral', jogador: '1', delta: 10 }, 'x')).toEqual([{ efeito: { campo: 'moral', jogador: '1', delta: 10 }, antes: 95, depois: 100 }])
    expect(aplicarEfeito(m.alvo, { campo: 'atributo', jogador: '1', atributo: 'PAS', delta: 3 }, 'x')[0]).toMatchObject({ antes: 19, depois: 20 })
    expect(aplicarEfeito(m.alvo, { campo: 'potencial', jogador: '1', delta: 1 }, 'x')[0]).toMatchObject({ antes: 20, depois: 20 })
    expect(aplicarEfeito(m.alvo, { campo: 'disponibilidade', jogador: '2', semanas: 1 }, 'x')[0]).toMatchObject({ antes: 3, depois: 7 })
    expect(aplicarEfeito(m.alvo, { campo: 'confianca', delta: -70 }, 'x')[0]).toMatchObject({ antes: 60, depois: 0 })
    expect(m.alterados).toEqual(new Set(['1', '2']))
  })

  it('moral do elenco, saldo e interesse do mercado', () => {
    const m = mundo()
    expect(aplicarEfeito(m.alvo, { campo: 'moral_elenco', time: 'AAA', delta: -20 }, 'x').map((r) => r.depois)).toEqual([75, 0])
    aplicarEfeito(m.alvo, { campo: 'saldo', time: 'AAA', valor: -500 }, 'Multa')
    aplicarEfeito(m.alvo, { campo: 'interesse_mercado', jogador: '1', clube: 'BBB' }, 'x')
    expect(m.lancamentos).toEqual([['AAA', -500, 'Multa']])
    expect(m.propostas).toEqual([['1', 'BBB']])
  })
})

describe('notícias informativas', () => {
  it('textos', () => {
    expect(info.resultadoDoUsuario({ casa: 'AAA', visitante: 'BBB', golsCasa: 1, golsVisitante: 2, competicao: 'Série A', penaltis: null }, 'AAA').texto).toBe('Derrota pela Série A: AAA 1 x 2 BBB.')
    expect(info.transferencia({ jogador: 'Zé', jogadorId: '1', de: 'BBB', para: 'CCC', valor: 100_000 }, dinheiro).texto).toBe('CCC contrata Zé, ex-BBB por R$1000.')
    expect(info.transferencia({ jogador: 'Wendel', jogadorId: '2', de: null, para: 'BAHIA', valor: 100_000, exterior: 'Zenit' }, dinheiro).texto).toBe('Wendel, ex-Zenit, chega ao BAHIA por R$1000.')
    expect(info.lesao({ id: '1', nome: 'Zé' }, 1, 'AAA').texto).toBe('Zé se machuca e desfalca o time por 1 semana.')
    expect(info.contratosAcabando(['A', 'B', 'C', 'D', 'E', 'F'], 2026).texto).toBe('6 contratos terminam em 2026: A, B, C, D e mais 2. Renove em Mercado.')
  })

  it('mercado da CPU: propostas com prazo, crise, perda de espaço e reposição', () => {
    expect(info.propostaRecebida({ clube: 'BBB', jogador: 'Zé', jogadorId: '1', valor: 100_000, prazo: 12 }, dinheiro).texto).toBe('BBB oferece R$1000 por Zé. Responda em Mercado até a semana 12.')
    const clube = { sigla: 'CCC', nome: 'Ceará' }
    expect(info.aVendaPorCrise(clube, ['Zé', 'Tião', 'Lula'])).toEqual({ tipo: 'mercado', time: 'CCC', texto: 'Em crise financeira, Ceará põe Zé, Tião e Lula à venda para aliviar a folha.' })
    expect(info.aVendaPorCrise(clube, ['Zé']).texto).toBe('Em crise financeira, Ceará põe Zé à venda para aliviar a folha.')
    expect(info.perdeEspaco(clube, { id: '7', nome: 'Tião' }, 'Zé')).toEqual({
      tipo: 'mercado',
      jogador: '7',
      time: 'CCC',
      texto: 'Com a chegada de Zé, Tião perde espaço no Ceará e entra na lista de venda.',
    })
    expect(info.reposicao(clube, 6, 5).texto).toBe('Ceará perdeu 6 jogadores com o fim dos contratos e vai às compras: a ideia é trazer 5 reforços.')
  })
})
