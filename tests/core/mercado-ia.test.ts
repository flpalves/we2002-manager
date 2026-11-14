import { describe, expect, it } from 'vitest'
import { PADROES, type Regras } from '@core/config/padroes'
import { criarRng } from '@core/rng'
import type { Posicao } from '@shared/esquemas/pacote'
import { salarioReferencia, valorMercado, type Porte } from '@core/mercado/valor'
import { carencias, chegadasAlvo, grupoDe, perfilFinanceiro, saidasPrevistas, semEspaco } from '@core/mercado/plano'
import {
  abrirJanela,
  dentroDaJanela,
  MundoMercado,
  propostasPeloUsuario,
  responderContraproposta,
  rodadaIaMercado,
  type ClubeMercado,
  type JogadorMercado,
  type Transferencia,
} from '@core/mercado/ia'

/**
 * IA de mercado dos clubes da CPU (06, "IA de mercado"; roadmap 9.1). Os testes em lote usam um
 * mundo sintético parecido com o pacote real: 40 clubes de 26 jogadores, com a distribuição de
 * posições do Brasil 2026, quatro perfis financeiros e um grupo de jogadores livres.
 */

const POSICOES: Posicao[] = ['GK', 'CB', 'SB', 'DH', 'OH', 'SH', 'CF', 'WG']
/** Média por elenco no pacote Brasil 2026. */
const PESO_POSICAO = [2.7, 4.6, 3.8, 4.7, 2.6, 0.7, 3.1, 4.0]
const BASE_POSICAO: Posicao[] = ['GK', 'GK', 'CB', 'CB', 'CB', 'SB', 'SB', 'DH', 'DH', 'OH', 'CF', 'CF', 'WG', 'WG']

type Financeiro = 'rico' | 'equilibrado' | 'apertado' | 'crise'

interface OpcoesMundo {
  semente: number
  clubes?: number
  /** Geral médio do time do usuário (C0). */
  geralUsuario?: number
  livres?: number
}

function jogadorNovo(id: string, time: string | null, posicao: Posicao, geral: number, idade: number, ateTemporada: number): JogadorMercado {
  const valor = valorMercado({ geral, idade, potencial: geral, semanasContrato: 100, fatorSerie: 1 }, PADROES)
  const salario = time ? salarioReferencia({ geral, idade, potencial: geral, fatorSerieSalario: 1 }, PADROES) : 0
  return { id, time, posicao, idade, geral, moral: 60, valor, salario, ateTemporada, aVenda: null, emprestado: false }
}

/** Mundo sintético: clube i tem porte i%3 e perfil pela posição em blocos de 8 (2 ricos, 3 equilibrados, 2 apertados, 1 em crise; C0 é o usuário). */

function criarMundo(o: OpcoesMundo): { m: MundoMercado; financeiro: Map<string, Financeiro> } {
  const rng = criarRng(o.semente)
  const portes: Porte[] = ['grande', 'medio', 'pequeno']
  const financeiros: Financeiro[] = ['rico', 'equilibrado', 'apertado', 'equilibrado', 'rico', 'crise', 'equilibrado', 'apertado']
  const n = o.clubes ?? 40
  const jogadores: JogadorMercado[] = []
  const clubes: ClubeMercado[] = []
  const financeiro = new Map<string, Financeiro>()
  for (let i = 0; i < n; i++) {
    const sigla = `C${i}`
    const porte = portes[i % 3]!
    const media = i === 0 && o.geralUsuario !== undefined ? o.geralUsuario : [14, 12, 10][i % 3]!
    const posicoes = [...BASE_POSICAO, ...Array.from({ length: 12 }, () => POSICOES[rng.escolherPeso(PESO_POSICAO)]!)]
    const elenco = posicoes.map((posicao, k) => {
      const geral = Math.max(4, Math.min(19, Math.round(rng.normal(media, 1.6))))
      return jogadorNovo(`${sigla}-${k}`, sigla, posicao, geral, rng.inteiro(18, 34), 2026 + rng.inteiro(0, 3))
    })
    jogadores.push(...elenco)
    const folha = elenco.reduce((a, j) => a + j.salario, 0)
    const f = financeiros[i % 8]!
    financeiro.set(sigla, f)
    const saldo = { rico: 9, equilibrado: 4, apertado: 1, crise: -1 }[f] * folha
    const orcamentoFolha = Math.round(folha * (f === 'crise' ? 0.75 : 1.1))
    clubes.push({ sigla, porte, pais: 'BRA', saldo, orcamentoFolha, usuario: i === 0 })
  }
  for (let k = 0; k < (o.livres ?? 80); k++) {
    jogadores.push(jogadorNovo(`L-${k}`, null, POSICOES[rng.escolherPeso(PESO_POSICAO)]!, Math.max(4, Math.round(rng.normal(10, 2))), rng.inteiro(19, 33), 2026))
  }
  return { m: new MundoMercado(clubes, jogadores), financeiro }
}

interface Janela {
  transferencias: Transferencia[]
  propostas: number
}

/** Uma janela inteira: abertura e `datas` rodadas, com as propostas pelo usuário. */
function janela(m: MundoMercado, semente: number, datas: number, principal: boolean, saidas = new Map<string, number>(), regras: Regras = PADROES): Janela {
  const rng = criarRng(semente)
  abrirJanela(m, { regras, rng: rng.derivar('abrir'), temporada: 2026, intensidade: 'media', principal, saidas })
  const transferencias: Transferencia[] = []
  let propostas = 0
  for (let d = 0; d < datas; d++) {
    const ctx = { regras, rng: rng.derivar('data', d), temporada: 2026, datasRestantes: datas - d }
    transferencias.push(...rodadaIaMercado(m, ctx))
    propostas += propostasPeloUsuario(m, { ...ctx, rng: ctx.rng.derivar('proposta') }).length
  }
  return { transferencias, propostas }
}

const media = (xs: readonly number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length)
const chegadasPorClube = (m: MundoMercado, t: readonly Transferencia[]) =>
  [...m.clubes.values()].filter((c) => !c.usuario).map((c) => t.filter((x) => x.para === c.sigla).length)

function membro(id: number, posicao: Posicao, geral: number, idade = 25): JogadorMercado {
  return { ...jogadorNovo(String(id), 'X', posicao, geral, idade, 2027), id: String(id) }
}

describe('perfil financeiro', () => {
  const f = (saldo: number, folha: number, orcamentoFolha: number) => perfilFinanceiro({ saldo, folha, orcamentoFolha }, PADROES)
  it('crise: saldo negativo ou folha muito acima do orçamento', () => {
    expect(f(-1, 100, 100)).toBe('crise')
    expect(f(10_000, 130, 100)).toBe('crise')
  })
  it('apertado: pouco caixa (menos de 2 meses de folha) ou folha acima do orçamento', () => {
    expect(f(150, 100, 100)).toBe('apertado')
    expect(f(1_000, 110, 100)).toBe('apertado')
  })
  it('rico: 6 meses de folha em caixa e folha dentro do orçamento; o resto é equilibrado', () => {
    expect(f(600, 100, 100)).toBe('rico')
    expect(f(400, 100, 100)).toBe('equilibrado')
    expect(f(700, 104, 100)).toBe('equilibrado')
  })
})

describe('plano de janela', () => {
  it('grupos de posição: meia junta OH e SH; ataque junta CF e WG', () => {
    expect(grupoDe('SH', PADROES)).toBe('meia')
    expect(grupoDe('OH', PADROES)).toBe('meia')
    expect(grupoDe('WG', PADROES)).toBe('ataque')
    expect(grupoDe('GK', PADROES)).toBe('gol')
  })

  it('carências: falta antes de fraco, fraco antes de abaixo do ideal', () => {
    const elenco = [
      membro(1, 'GK', 14), // só 1 goleiro: falta
      ...[2, 3, 4, 5].map((i) => membro(i, 'CB', 14)),
      ...[6, 7, 8, 9].map((i) => membro(i, 'SB', 14)),
      ...[10, 11, 12, 13].map((i) => membro(i, 'DH', 8)), // volantes bem abaixo da média: fraco
      ...[14, 15, 16, 17].map((i) => membro(i, 'OH', 14)),
      ...[18, 19, 20, 21, 22].map((i) => membro(i, 'CF', 14)), // 5 de 7 no ataque: abaixo do ideal
    ]
    const c = carencias(elenco, PADROES)
    expect(c.map((x) => [x.grupo, x.motivo])).toEqual([
      ['gol', 'falta'],
      ['volante', 'fraco'],
      ['ataque', 'abaixo_ideal'],
    ])
    expect(c[1]!.referencia).toBe(8)
  })

  it('sem espaço: quem passa do ideal do grupo, mesmo com geral alto; emprestado não conta', () => {
    const zagueiros = [17, 16, 16, 15, 15].map((g, i) => membro(i, 'CB', g))
    expect(semEspaco(zagueiros, PADROES).map((j) => j.geral)).toEqual([15])
    zagueiros[4]!.emprestado = true
    expect(semEspaco(zagueiros, PADROES)).toEqual([])
  })

  it('saídas previstas: contratos acabando pesados pela chance de a CPU não renovar', () => {
    const elenco = Array.from({ length: 26 }, (_, i) => ({ ...membro(i, 'CB', 20 - Math.floor(i / 2)), ateTemporada: i >= 20 ? 2026 : 2028 }))
    // 6 encostados com contrato acabando: 6 × (1 − 0,25) × 0,5.
    expect(saidasPrevistas(elenco, 2026, PADROES)).toBeCloseTo(6 * 0.75 * 0.5)
  })

  it('chegadas-alvo crescem com carências e saídas, seguem perfil e intensidade e têm limite', () => {
    const alvo = (e: Partial<Parameters<typeof chegadasAlvo>[0]>, semente = 1) =>
      chegadasAlvo({ principal: true, carencias: 2, saidas: 0, perfil: 'equilibrado', intensidade: 'media', tamanho: 26, ...e }, PADROES, criarRng(semente))
    const varias = (e: Partial<Parameters<typeof chegadasAlvo>[0]>) => media(Array.from({ length: 200 }, (_, s) => alvo(e, s)))
    expect(varias({})).toBeCloseTo(3, 0)
    expect(varias({ saidas: 3 })).toBeGreaterThan(varias({}) + 1.5)
    expect(varias({ carencias: 4 })).toBeGreaterThan(varias({}))
    expect(varias({ perfil: 'rico' })).toBeGreaterThan(varias({ perfil: 'apertado' }))
    expect(varias({ intensidade: 'alta' })).toBeGreaterThan(varias({ intensidade: 'baixa' }))
    expect(alvo({ saidas: 30, tamanho: 20 })).toBe(PADROES.mercado.ia.chegadas.principal.maximo)
    expect(alvo({ saidas: 30, tamanho: 30 })).toBe(2) // nunca passa do elenco máximo
    expect(alvo({ principal: false, carencias: 0 })).toBe(0)
  })
})

describe('lista de venda na abertura da janela', () => {
  it('excedentes vão à venda (jovens para empréstimo); a lista do usuário fica como está', () => {
    const { m } = criarMundo({ semente: 3 })
    const meu = m.elenco('C0')[0]!
    meu.aVenda = 'usuario'
    abrirJanela(m, { regras: PADROES, rng: criarRng(1), temporada: 2026, intensidade: 'media', principal: true, saidas: new Map() })
    expect(meu.aVenda).toBe('usuario')
    const listados = [...m.jogadores.values()].filter((j) => j.aVenda === 'excedente' || j.aVenda === 'emprestimo')
    expect(listados.length).toBeGreaterThan(20)
    for (const j of listados) expect(j.aVenda === 'emprestimo').toBe(j.idade <= PADROES.mercado.ia.idade_emprestimo)
  })

  it('clube em crise põe à venda os maiores salários e o mais valioso', () => {
    const { m, financeiro } = criarMundo({ semente: 4 })
    abrirJanela(m, { regras: PADROES, rng: criarRng(1), temporada: 2026, intensidade: 'media', principal: true, saidas: new Map() })
    const crise = [...financeiro].filter(([s, f]) => f === 'crise' && s !== 'C0').map(([s]) => s)
    for (const s of crise) {
      expect(m.planos.get(s)!.perfil).toBe('crise')
      const elenco = m.elenco(s)
      const maiorSalario = [...elenco].sort((a, b) => b.salario - a.salario)[0]!
      const maisValioso = [...elenco].sort((a, b) => b.valor - a.valor)[0]!
      expect(maiorSalario.aVenda).toBe('financeiro')
      expect(maisValioso.aVenda).not.toBeNull()
    }
    expect(m.eventos.some((e) => e.tipo === 'a_venda_crise')).toBe(true)
  })
})

describe('lote: janela principal', () => {
  const sementes = [11, 12, 13, 14, 15]
  const lotes = sementes.map((s) => {
    const mundo = criarMundo({ semente: s })
    const antes = new Map([...mundo.m.clubes.values()].map((c) => [c.sigla, { folha: mundo.m.folha(c.sigla), elenco: mundo.m.elenco(c.sigla).map((j) => j.id).sort() }]))
    const saldoTotal = [...mundo.m.clubes.values()].reduce((a, c) => a + c.saldo, 0)
    const r = janela(mundo.m, s, 20, true)
    return { ...mundo, antes, saldoTotal, r }
  })

  it('em média cada clube da CPU faz de 3 a 5 contratações, nenhum passa de 7', () => {
    const porClube = lotes.flatMap(({ m, r }) => chegadasPorClube(m, r.transferencias))
    const mediaChegadas = media(porClube)
    expect(mediaChegadas).toBeGreaterThanOrEqual(3)
    expect(mediaChegadas).toBeLessThanOrEqual(5)
    expect(Math.max(...porClube)).toBeLessThanOrEqual(PADROES.mercado.ia.chegadas.principal.maximo)
  })

  it('elencos entre o mínimo e o máximo; o usuário só perde jogador por proposta; o dinheiro só muda de mão', () => {
    for (const { m, antes, saldoTotal } of lotes) {
      for (const c of m.clubes.values()) {
        const n = m.elenco(c.sigla).length
        expect(n, c.sigla).toBeGreaterThanOrEqual(PADROES.mercado.elenco_minimo)
        expect(n, c.sigla).toBeLessThanOrEqual(PADROES.mercado.elenco_maximo)
      }
      expect(m.elenco('C0').map((j) => j.id).sort()).toEqual(antes.get('C0')!.elenco)
      const livres = [...m.jogadores.values()].filter((j) => j.time === null).length
      expect(livres).toBeLessThan(80)
      // Compras entre clubes não criam nem somem com dinheiro (livres não custam nada).
      expect([...m.clubes.values()].reduce((a, c) => a + c.saldo, 0)).toBe(saldoTotal)
    }
  })

  it('ricos contratam jogadores de geral maior que os apertados e os em crise', () => {
    const geralPorPerfil = (perfil: Financeiro) =>
      media(lotes.flatMap(({ m, r, financeiro }) => r.transferencias.filter((t) => financeiro.get(t.para) === perfil).map((t) => m.jogadores.get(t.jogador)!.geral)))
    expect(geralPorPerfil('rico')).toBeGreaterThan(geralPorPerfil('apertado'))
    expect(geralPorPerfil('rico')).toBeGreaterThan(geralPorPerfil('crise'))
  })

  it('clubes em crise só trazem livres e emprestados e reduzem a folha', () => {
    for (const { m, r, financeiro, antes } of lotes) {
      const crise = [...financeiro].filter(([s, f]) => f === 'crise' && s !== 'C0').map(([s]) => s)
      for (const t of r.transferencias.filter((x) => crise.includes(x.para))) expect(t.tipo).not.toBe('compra')
      const folhaAntes = crise.reduce((a, s) => a + antes.get(s)!.folha, 0)
      const folhaDepois = crise.reduce((a, s) => a + m.folha(s), 0)
      expect(folhaDepois).toBeLessThan(folhaAntes)
    }
  })

  it('apertados aproveitam oportunidades: livres e jogadores à venda são boa parte das chegadas', () => {
    const tipos = lotes.flatMap(({ r, financeiro }) => r.transferencias.filter((t) => financeiro.get(t.para) === 'apertado'))
    const oportunidades = tipos.filter((t) => t.tipo !== 'compra' || t.valor < (t.salario * 12)).length
    expect(oportunidades / Math.max(1, tipos.length)).toBeGreaterThan(0.4)
  })

  it('quem perde muitos jogadores por fim de contrato repõe um número parecido', () => {
    const resultados = [21, 22, 23].map((s) => {
      const { m } = criarMundo({ semente: s })
      // Metade dos clubes perdeu 5 jogadores na virada (saem do elenco para os livres).
      const saidas = new Map<string, number>()
      for (const c of [...m.clubes.values()].filter((x) => !x.usuario && Number(x.sigla.slice(1)) % 2 === 0)) {
        for (const j of m.elenco(c.sigla).sort((a, b) => a.geral - b.geral).slice(0, 5)) m.liberar(j.id)
        saidas.set(c.sigla, 5)
      }
      const r = janela(m, s, 20, true, saidas)
      const chegadas = (comSaida: boolean) =>
        media([...m.clubes.values()].filter((c) => !c.usuario && saidas.has(c.sigla) === comSaida).map((c) => r.transferencias.filter((t) => t.para === c.sigla).length))
      return { com: chegadas(true), sem: chegadas(false) }
    })
    const com = media(resultados.map((x) => x.com))
    const sem = media(resultados.map((x) => x.sem))
    expect(com).toBeGreaterThan(sem + 2)
    expect(com).toBeGreaterThanOrEqual(4.5)
  })
})

describe('lote: janela do meio', () => {
  it('de 0 a 3 chegadas por clube, guiadas por caixa e carências', () => {
    const porClube = [31, 32, 33].flatMap((s) => {
      const { m } = criarMundo({ semente: s })
      janela(m, s, 20, true)
      const r = janela(m, s + 100, 6, false)
      return chegadasPorClube(m, r.transferencias)
    })
    expect(Math.max(...porClube)).toBeLessThanOrEqual(PADROES.mercado.ia.chegadas.outras.maximo)
    expect(media(porClube)).toBeGreaterThan(0.3)
    expect(media(porClube)).toBeLessThanOrEqual(3)
  })
})

describe('propostas pelos jogadores do usuário', () => {
  const propostas = (geralUsuario: number, semente: number, principal = true, preparar?: (m: MundoMercado) => void) => {
    const { m } = criarMundo({ semente, geralUsuario })
    preparar?.(m)
    return janela(m, semente, principal ? 20 : 6, principal).propostas
  }

  it('de 1 a 10 por janela, mais quanto melhor o elenco do usuário', () => {
    const fortes = [41, 42, 43, 44].map((s) => propostas(15, s))
    const fracos = [41, 42, 43, 44].map((s) => propostas(9, s))
    for (const n of [...fortes, ...fracos]) {
      expect(n).toBeGreaterThanOrEqual(1)
      expect(n).toBeLessThanOrEqual(PADROES.mercado.ia.propostas.maximo)
    }
    expect(media(fortes)).toBeGreaterThan(media(fracos) + 2)
  })

  it('a janela do meio também tem pelo menos 1', () => {
    for (const s of [51, 52, 53]) expect(propostas(12, s, false)).toBeGreaterThanOrEqual(1)
  })

  it('jogadores à venda recebem mais propostas', () => {
    const contar = (listar: boolean) =>
      [61, 62, 63, 64].map((s) => {
        const { m } = criarMundo({ semente: s, geralUsuario: 12 })
        const alvos = m.elenco('C0').sort((a, b) => a.id.localeCompare(b.id)).slice(0, 6)
        if (listar) for (const j of alvos) j.aVenda = 'usuario'
        const rng = criarRng(s)
        abrirJanela(m, { regras: PADROES, rng: rng.derivar('abrir'), temporada: 2026, intensidade: 'media', principal: true, saidas: new Map() })
        let n = 0
        for (let d = 0; d < 20; d++) {
          n += propostasPeloUsuario(m, { regras: PADROES, rng: rng.derivar('p', d), temporada: 2026, datasRestantes: 20 - d }).filter((p) => alvos.some((a) => a.id === p.jogador)).length
        }
        return n
      })
    expect(media(contar(true))).toBeGreaterThan(media(contar(false)))
  })

  it('a oferta cabe na verba do clube, não repete clube e jogador e tem teto ≥ oferta', () => {
    const { m } = criarMundo({ semente: 71, geralUsuario: 15 })
    const rng = criarRng(71)
    abrirJanela(m, { regras: PADROES, rng, temporada: 2026, intensidade: 'media', principal: true, saidas: new Map() })
    const vistas = new Set<string>()
    for (let d = 0; d < 20; d++) {
      for (const p of propostasPeloUsuario(m, { regras: PADROES, rng: rng.derivar(d), temporada: 2026, datasRestantes: 20 - d })) {
        expect(m.jogadores.get(p.jogador)!.time).toBe('C0')
        expect(p.valor).toBeLessThanOrEqual(m.planos.get(p.clube)!.verba)
        expect(p.teto).toBeGreaterThanOrEqual(p.valor)
        expect(vistas.has(`${p.clube}|${p.jogador}`)).toBe(false)
        vistas.add(`${p.clube}|${p.jogador}`)
      }
    }
    expect(m.planoPropostas!.feitas).toBe(vistas.size)
  })

  it('contraproposta: até o teto aceita; um pouco acima cobre com o teto; muito acima desiste', () => {
    const p = { valor: 1_000, teto: 1_200 }
    expect(responderContraproposta(p, 900, PADROES)).toEqual({ resposta: 'aceita', valor: 1_000 })
    expect(responderContraproposta(p, 1_150, PADROES)).toEqual({ resposta: 'aceita', valor: 1_150 })
    expect(responderContraproposta(p, 1_300, PADROES)).toEqual({ resposta: 'cobre', valor: 1_200 })
    expect(responderContraproposta(p, 1_500, PADROES)).toEqual({ resposta: 'desiste' })
    // Sem margem (teto = oferta): acima dele, desiste.
    expect(responderContraproposta({ valor: 1_000, teto: 1_000 }, 1_050, PADROES)).toEqual({ resposta: 'desiste' })
  })
})

describe('mundo do mercado', () => {
  it('transferência move o dinheiro e o jogador; empréstimo marca o emprestado e tira da lista', () => {
    const { m } = criarMundo({ semente: 2, clubes: 4 })
    const antes = { a: m.clubes.get('C1')!.saldo, b: m.clubes.get('C2')!.saldo }
    m.transferir({ jogador: 'C2-0', de: 'C2', para: 'C1', tipo: 'compra', valor: 1000, salario: 77, ateTemporada: 2029 })
    expect(m.clubes.get('C1')!.saldo).toBe(antes.a - 1000)
    expect(m.clubes.get('C2')!.saldo).toBe(antes.b + 1000)
    expect(m.jogadores.get('C2-0')).toMatchObject({ time: 'C1', salario: 77, ateTemporada: 2029, emprestado: false })
    expect(m.elenco('C1').some((j) => j.id === 'C2-0')).toBe(true)
    expect(m.elenco('C2').some((j) => j.id === 'C2-0')).toBe(false)
    m.jogadores.get('C2-1')!.aVenda = 'emprestimo'
    m.transferir({ jogador: 'C2-1', de: 'C2', para: 'C3', tipo: 'emprestimo', valor: 10, salario: 5, ateTemporada: 2026 })
    expect(m.jogadores.get('C2-1')).toMatchObject({ time: 'C3', emprestado: true, aVenda: null })
  })

  it('a mesma semente dá o mesmo mercado', () => {
    const a = criarMundo({ semente: 9 })
    const b = criarMundo({ semente: 9 })
    expect(janela(a.m, 9, 10, true)).toEqual(janela(b.m, 9, 10, true))
  })

  it('janelas', () => {
    expect(dentroDaJanela(1, PADROES)).toBe(true)
    expect(dentroDaJanela(16, PADROES)).toBe(true) // a 1ª janela cobre o começo do Brasileirão (semana 12)
    expect(dentroDaJanela(17, PADROES)).toBe(false)
    expect(dentroDaJanela(28, PADROES)).toBe(true)
  })
})
