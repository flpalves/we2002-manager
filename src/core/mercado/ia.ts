import type { PerfilFinanceiro, Regras } from '../config/padroes'
import type { Rng } from '../rng'
import type { Posicao } from '@shared/esquemas/pacote'
import { pedidaInicial, salarioMinimoAceito } from './negociacao'
import { janelaDaSemana } from './janelas'
import { carencias, chegadasAlvo, grupoDe, perfilFinanceiro, porGrupo, saidasPrevistas, semEspaco, type Carencia } from './plano'
import { importanciaNoTime, ORDEM_PORTE, type Porte } from './valor'

/**
 * IA de mercado (06, "IA de mercado"): na abertura de cada janela, cada clube da CPU recebe um
 * plano (perfil financeiro, chegadas-alvo, verba, teto da folha) e refaz a lista de venda; nas
 * datas da janela, executa o plano comprando entre si, de livres e por empréstimo, e faz
 * propostas pelos jogadores do usuário conforme o interesse real.
 */

export interface ClubeMercado {
  sigla: string
  porte: Porte
  pais: string
  saldo: number
  orcamentoFolha: number
  usuario: boolean
}

/** Por que o jogador está à venda (null = não está). */
export type MotivoVenda = 'excedente' | 'financeiro' | 'emprestimo' | 'usuario'

export interface JogadorMercado {
  id: string
  /** Sigla do clube; `null` = livre. */
  time: string | null
  posicao: Posicao
  idade: number
  geral: number
  moral: number
  valor: number
  salario: number
  ateTemporada: number
  aVenda: MotivoVenda | null
  /** Está emprestado ao clube atual: não é vendido nem listado por ele. */
  emprestado: boolean
}

export interface Transferencia {
  jogador: string
  de: string | null
  para: string
  tipo: 'compra' | 'livre' | 'emprestimo'
  valor: number
  salario: number
  ateTemporada: number
}

export interface PlanoClube {
  sigla: string
  perfil: PerfilFinanceiro
  chegadasAlvo: number
  chegadasFeitas: number
  /** Verba que ainda pode gastar na janela (centavos). */
  verba: number
  /** Folha mensal máxima depois das chegadas. */
  tetoFolha: number
}

export interface PlanoPropostas {
  alvo: number
  feitas: number
  /** `clube|jogador` que já fizeram proposta nesta janela (não repetem). */
  pares: Set<string>
}

export interface PropostaIa {
  jogador: string
  clube: string
  valor: number
  /** Teto oculto da contraproposta. */
  teto: number
}

export type EventoMercado =
  | { tipo: 'a_venda_crise'; clube: string; jogadores: string[] }
  | { tipo: 'perde_espaco'; clube: string; jogador: string; chegou: string }
  | { tipo: 'reposicao'; clube: string; saidas: number; chegadas: number }

export class MundoMercado {
  readonly clubes: Map<string, ClubeMercado>
  readonly jogadores: Map<string, JogadorMercado>
  readonly planos = new Map<string, PlanoClube>()
  planoPropostas: PlanoPropostas | null = null
  /** A janela aberta é a principal (limita as reposições pelo máximo dela). */
  janelaPrincipal = true
  /** Eventos para as notícias (consumidos por quem chama). */
  readonly eventos: EventoMercado[] = []
  private readonly porTime = new Map<string | null, Set<string>>()

  constructor(clubes: readonly ClubeMercado[], jogadores: readonly JogadorMercado[]) {
    this.clubes = new Map(clubes.map((c) => [c.sigla, { ...c }]))
    this.jogadores = new Map(jogadores.map((j) => [j.id, { ...j }]))
    for (const j of this.jogadores.values()) this.indice(j.time).add(j.id)
  }

  private indice(time: string | null): Set<string> {
    let s = this.porTime.get(time)
    if (!s) this.porTime.set(time, (s = new Set()))
    return s
  }

  elenco(sigla: string): JogadorMercado[] {
    return [...this.indice(sigla)].map((id) => this.jogadores.get(id)!)
  }

  folha(sigla: string): number {
    return this.elenco(sigla).reduce((a, j) => a + j.salario, 0)
  }

  clubeDoUsuario(): ClubeMercado | undefined {
    return [...this.clubes.values()].find((c) => c.usuario)
  }

  /** O jogador fica livre (fim de contrato, rescisão). */
  liberar(jogadorId: string): void {
    const j = this.jogadores.get(jogadorId)
    if (!j) return
    this.indice(j.time).delete(j.id)
    this.indice(null).add(j.id)
    j.time = null
    j.salario = 0
    j.aVenda = null
    j.emprestado = false
  }

  /** Executa a transferência: dinheiro entre os clubes, jogador muda de time com salário e contrato novos. */
  transferir(t: Transferencia): void {
    const j = this.jogadores.get(t.jogador)
    const comprador = this.clubes.get(t.para)
    if (!j || !comprador) throw new Error('Transferência inválida')
    comprador.saldo -= t.valor
    if (t.de) {
      const vendedor = this.clubes.get(t.de)
      if (vendedor) vendedor.saldo += t.valor
    }
    this.indice(j.time).delete(j.id)
    this.indice(t.para).add(j.id)
    j.time = t.para
    j.salario = t.salario
    j.ateTemporada = t.ateTemporada
    j.aVenda = null
    j.emprestado = t.tipo === 'emprestimo'
  }
}

export interface ContextoJanela {
  regras: Regras
  rng: Rng
  temporada: number
  intensidade: 'baixa' | 'media' | 'alta'
  /** A primeira janela da temporada (a principal). */
  principal: boolean
  /** Saídas por fim de contrato na virada, por clube (janela principal). */
  saidas: ReadonlyMap<string, number>
}

/** Lista de venda de um clube da CPU: quem ficou sem espaço (jovens vão para empréstimo). */
function listarSemEspaco(m: MundoMercado, sigla: string, regras: Regras, grupo?: ReturnType<typeof grupoDe>): JogadorMercado[] {
  const novos: JogadorMercado[] = []
  for (const j of semEspaco(m.elenco(sigla), regras, grupo)) {
    if (j.aVenda) continue
    j.aVenda = j.idade <= regras.mercado.ia.idade_emprestimo ? 'emprestimo' : 'excedente'
    novos.push(j)
  }
  return novos
}

/**
 * Clube em crise: põe à venda os maiores salários até a folha caber no orçamento (no máximo 5)
 * e o jogador mais valioso, para equilibrar o caixa. Devolve os listados agora.
 */
function listarPorCrise(m: MundoMercado, c: ClubeMercado): JogadorMercado[] {
  const elenco = m.elenco(c.sigla).filter((j) => !j.emprestado)
  const novos: JogadorMercado[] = []
  let folha = m.folha(c.sigla) - elenco.filter((j) => j.aVenda).reduce((a, j) => a + j.salario, 0)
  for (const j of [...elenco].sort((a, b) => b.salario - a.salario || a.id.localeCompare(b.id))) {
    if (folha <= c.orcamentoFolha || novos.length >= 5) break
    if (j.aVenda) continue
    j.aVenda = 'financeiro'
    folha -= j.salario
    novos.push(j)
  }
  const maisValioso = [...elenco].sort((a, b) => b.valor - a.valor || a.id.localeCompare(b.id))[0]
  if (maisValioso && !maisValioso.aVenda) {
    maisValioso.aVenda = 'financeiro'
    novos.push(maisValioso)
  }
  return novos
}

/**
 * Abertura da janela: perfil e plano de cada clube da CPU, lista de venda refeita e o plano de
 * propostas pelos jogadores do usuário. Altera o mundo (planos, listas, eventos).
 */
export function abrirJanela(m: MundoMercado, ctx: ContextoJanela): void {
  const { regras, rng } = ctx
  const ia = regras.mercado.ia
  m.planos.clear()
  m.janelaPrincipal = ctx.principal
  const clubes = [...m.clubes.values()].filter((c) => !c.usuario).sort((a, b) => a.sigla.localeCompare(b.sigla))
  for (const c of clubes) {
    const elenco = m.elenco(c.sigla)
    // A lista da CPU é refeita a cada janela (a do usuário fica como ele deixou).
    for (const j of elenco) if (j.aVenda !== 'usuario') j.aVenda = null
    const perfil = perfilFinanceiro({ saldo: c.saldo, folha: m.folha(c.sigla), orcamentoFolha: c.orcamentoFolha }, regras)
    listarSemEspaco(m, c.sigla, regras)
    if (perfil === 'crise') {
      const listados = listarPorCrise(m, c)
      if (listados.length) m.eventos.push({ tipo: 'a_venda_crise', clube: c.sigla, jogadores: listados.map((j) => j.id) })
    }
    const saidas = ctx.principal ? (ctx.saidas.get(c.sigla) ?? 0) : saidasPrevistas(elenco, ctx.temporada, regras)
    const alvo = chegadasAlvo(
      { principal: ctx.principal, carencias: carencias(elenco, regras).length, saidas, perfil, intensidade: ctx.intensidade, tamanho: elenco.length },
      regras,
      rng.derivar('plano', c.sigla),
    )
    m.planos.set(c.sigla, {
      sigla: c.sigla,
      perfil,
      chegadasAlvo: alvo,
      chegadasFeitas: 0,
      verba: Math.round(Math.max(0, c.saldo) * ia.fracao_verba[perfil]),
      // Em crise a folha já passou do orçamento: só repõe dentro do que já paga (depois de vender).
      tetoFolha: Math.round(perfil === 'crise' ? Math.max(c.orcamentoFolha, m.folha(c.sigla)) * ia.teto_folha.crise : c.orcamentoFolha * ia.teto_folha[perfil]),
    })
    if (ctx.principal && saidas >= 5) m.eventos.push({ tipo: 'reposicao', clube: c.sigla, saidas, chegadas: alvo })
  }
  m.planoPropostas = planejarPropostas(m, regras, ctx.temporada, rng.derivar('propostas'))
}

export interface ContextoIa {
  regras: Regras
  rng: Rng
  temporada: number
  /** Datas que faltam na janela, contando a de hoje (≥ 1). */
  datasRestantes: number
}

/** Pedida do vendedor da CPU: importância e porte; à venda tem desconto (maior se ele está em crise). */
function pedidaPara(m: MundoMercado, j: JogadorMercado, comprador: ClubeMercado, regras: Regras): number {
  if (!j.time) return 0
  const vendedor = m.clubes.get(j.time)!
  const gerais = m.elenco(j.time).map((x) => x.geral)
  const p = pedidaInicial({ valor: j.valor, importancia: importanciaNoTime(j.geral, gerais, regras), porteVendedor: vendedor.porte, porteComprador: comprador.porte }, regras)
  const crise = m.planos.get(vendedor.sigla)?.perfil === 'crise' || vendedor.saldo < 0
  const desconto = j.aVenda ? (crise ? regras.mercado.ia.desconto_crise : regras.mercado.ia.desconto_a_venda) : crise ? 0.85 : 1
  return Math.round(p * desconto)
}

interface Candidato {
  j: JogadorMercado
  tipo: Transferencia['tipo']
  preco: number
  salario: number
  pontos: number
}

/** O melhor alvo para a carência, pelo perfil do comprador (ou null). */
function melhorAlvo(m: MundoMercado, comprador: ClubeMercado, plano: PlanoClube, c: Carencia, regras: Regras, podeSubir: boolean): Candidato | null {
  const mr = regras.mercado
  const ia = mr.ia
  const folha = m.folha(comprador.sigla)
  const crise = plano.perfil === 'crise'
  const verbaReferencia = Math.max(plano.verba, comprador.orcamentoFolha)
  let melhor: Candidato | null = null
  for (const j of m.jogadores.values()) {
    if (j.time === comprador.sigla || j.geral <= c.referencia || j.emprestado) continue
    if (grupoDe(j.posicao, regras) !== c.grupo) continue
    let tipo: Transferencia['tipo'] = 'livre'
    let vendedorPorte: Porte = comprador.porte
    if (j.time) {
      const vendedor = m.clubes.get(j.time)
      if (!vendedor || vendedor.usuario) continue // jogador do usuário: só por proposta
      if (m.elenco(j.time).length <= mr.elenco_minimo) continue
      vendedorPorte = vendedor.porte
      // Fora da lista de venda: de porte igual ou menor, com pequena chance para cima.
      if (!j.aVenda && ORDEM_PORTE[vendedor.porte] > ORDEM_PORTE[comprador.porte] && !podeSubir) continue
      tipo = j.aVenda === 'emprestimo' ? 'emprestimo' : 'compra'
      // Em crise: só livres e empréstimos.
      if (crise && tipo === 'compra') continue
    }
    const preco = tipo === 'livre' ? 0 : tipo === 'emprestimo' ? Math.round(j.valor * mr.taxa_emprestimo) : pedidaPara(m, j, comprador, regras)
    if (preco > plano.verba) continue
    const salario = salarioMinimoAceito(
      { salarioAtual: j.salario, mudaDeClube: true, porteAtual: vendedorPorte, porteComprador: comprador.porte, moral: j.moral, salarioReferencia: j.salario },
      regras,
    )
    if (folha + salario > plano.tetoFolha) continue
    const custo = preco + salario * ia.meses_custo_salario
    const ganho = j.geral - c.referencia
    const pontos =
      plano.perfil === 'rico' || crise
        ? // Rico: o melhor que cabe; crise: o melhor entre livres e empréstimos. Custo só desempata.
          j.geral - custo / (verbaReferencia * 1000)
        : plano.perfil === 'apertado'
          ? // Apertado: oportunidade = ganho por custo (livres e à venda pesam a favor pelo preço).
            (ganho + 1) / (1 + (4 * custo) / verbaReferencia)
          : j.geral - (2 * custo) / verbaReferencia
    if (!melhor || pontos > melhor.pontos || (pontos === melhor.pontos && j.id < melhor.j.id)) melhor = { j, tipo, preco, salario, pontos }
  }
  return melhor
}

/**
 * Uma data dentro da janela: cada clube da CPU com chegadas pendentes vai ao mercado com
 * chance (pendentes / datas restantes), busca o melhor alvo para a carência mais grave e,
 * depois da chegada, põe à venda quem perdeu espaço no grupo. Devolve as transferências.
 */
export function rodadaIaMercado(m: MundoMercado, ctx: ContextoIa): Transferencia[] {
  const { regras, rng } = ctx
  const mr = regras.mercado
  const feitas: Transferencia[] = []
  const clubes = [...m.clubes.values()].filter((c) => !c.usuario).sort((a, b) => a.sigla.localeCompare(b.sigla))
  for (const comprador of clubes) {
    const plano = m.planos.get(comprador.sigla)
    if (!plano) continue
    const pendentes = plano.chegadasAlvo - plano.chegadasFeitas
    if (pendentes <= 0) continue
    const rngClube = rng.derivar(comprador.sigla)
    if (!rngClube.chance(Math.min(1, pendentes / Math.max(1, ctx.datasRestantes)))) continue
    const elenco = m.elenco(comprador.sigla)
    if (elenco.length >= mr.elenco_maximo) continue
    // Sem carência: reforça o grupo do titular mais fraco.
    let lista = carencias(elenco, regras)
    if (!lista.length) {
      const grupos = [...porGrupo(elenco, regras)].filter(([, ms]) => ms.length).sort((a, b) => a[1][0]!.geral - b[1][0]!.geral)
      lista = grupos.slice(0, 1).map(([grupo, ms]) => ({ grupo, motivo: 'fraco' as const, referencia: ms[0]!.geral }))
    }
    // Buscar fora da lista em clube de porte maior: um sorteio por clube e data.
    const podeSubir = rngClube.chance(mr.chance_porte_maior)
    let alvo: Candidato | null = null
    for (const c of lista.slice(0, 3)) {
      alvo = melhorAlvo(m, comprador, plano, c, regras, podeSubir)
      if (alvo) break
    }
    if (!alvo) continue
    const t: Transferencia = {
      jogador: alvo.j.id,
      de: alvo.j.time,
      para: comprador.sigla,
      tipo: alvo.tipo,
      valor: alvo.preco,
      salario: alvo.salario,
      // Empréstimo vai até o fim da temporada (a virada devolve).
      ateTemporada: alvo.tipo === 'emprestimo' ? ctx.temporada : ctx.temporada + rngClube.inteiro(1, 4),
    }
    const grupo = grupoDe(alvo.j.posicao, regras)
    m.transferir(t)
    feitas.push(t)
    plano.chegadasFeitas++
    plano.verba -= t.valor
    if (t.de) venda(m, t.de, t.valor, grupo, regras)
    // Quem perdeu espaço no grupo vai para a lista (pode ser um titular de geral alto).
    const listados = listarSemEspaco(m, comprador.sigla, regras, grupo)
    const titulares = m.elenco(comprador.sigla).sort((a, b) => b.geral - a.geral).slice(0, mr.titulares)
    const media = titulares.reduce((a, j) => a + j.geral, 0) / Math.max(1, titulares.length)
    const destaque = listados.filter((j) => j.geral >= media).sort((a, b) => b.geral - a.geral)[0]
    if (destaque) m.eventos.push({ tipo: 'perde_espaco', clube: comprador.sigla, jogador: destaque.id, chegou: t.jogador })
  }
  return feitas
}

/**
 * Venda de um clube da CPU (para outro clube ou para o usuário): parte do dinheiro volta para a
 * verba e, se o grupo ficou abaixo do ideal, o clube busca uma reposição a mais.
 */
export function venda(m: MundoMercado, sigla: string, valor: number, grupo: ReturnType<typeof grupoDe>, regras: Regras): void {
  const plano = m.planos.get(sigla)
  if (!plano) return
  const ia = regras.mercado.ia
  plano.verba += Math.round(valor * ia.reinveste_venda[plano.perfil])
  const n = porGrupo(m.elenco(sigla), regras).get(grupo)!.length
  const maximo = (m.janelaPrincipal ? ia.chegadas.principal : ia.chegadas.outras).maximo
  if (n < ia.grupos[grupo].ideal) plano.chegadasAlvo = Math.min(maximo, plano.chegadasAlvo + 1)
}

// ------------------------------------------------------------------ propostas pelo usuário

interface Interesse {
  clube: ClubeMercado
  plano: PlanoClube
  jogador: JogadorMercado
  peso: number
}

/**
 * Quem tem interesse em quem: o clube tem carência no grupo do jogador (e ele a resolve) ou o
 * jogador vira titular lá; precisa ter verba. À venda, contrato acabando e jovem pesam a favor;
 * clube de porte menor que o do usuário raramente aparece.
 */
function interesses(m: MundoMercado, regras: Regras, temporada: number): Interesse[] {
  const usuario = m.clubeDoUsuario()
  if (!usuario) return []
  const meus = m.elenco(usuario.sigla).filter((j) => !j.emprestado)
  if (meus.length <= regras.mercado.elenco_minimo) return []
  const p = regras.mercado.ia.propostas
  const lista: Interesse[] = []
  const clubes = [...m.clubes.values()].filter((c) => !c.usuario).sort((a, b) => a.sigla.localeCompare(b.sigla))
  for (const clube of clubes) {
    const plano = m.planos.get(clube.sigla)
    if (!plano || plano.perfil === 'crise') continue
    const elenco = m.elenco(clube.sigla)
    if (elenco.length >= regras.mercado.elenco_maximo) continue
    const faltas = new Map(carencias(elenco, regras).map((c) => [c.grupo, c.referencia]))
    const grupos = porGrupo(elenco, regras)
    const titulares = [...elenco].sort((a, b) => b.geral - a.geral).slice(0, regras.mercado.titulares)
    const mediaTitulares = titulares.reduce((a, j) => a + j.geral, 0) / Math.max(1, titulares.length)
    for (const j of meus) {
      const grupo = grupoDe(j.posicao, regras)
      const referencia = faltas.get(grupo)
      const melhorDoGrupo = grupos.get(grupo)![0]?.geral ?? 0
      // Interessa quem chega para brigar por posição: resolve a carência no nível dos titulares
      // do clube ou passa o melhor do grupo.
      const resolve = referencia !== undefined && j.geral > referencia && j.geral >= mediaTitulares - 1
      if (!resolve && j.geral <= melhorDoGrupo) continue
      if (j.valor * p.oferta_a_venda[0] > plano.verba) continue
      let peso = 1 + Math.max(0, j.geral - melhorDoGrupo) * 0.25
      if (j.aVenda) peso *= p.peso_a_venda
      if (j.ateTemporada <= temporada) peso *= p.peso_contrato_acabando
      if (j.idade <= p.idade_jovem) peso *= p.peso_jovem
      if (ORDEM_PORTE[clube.porte] < ORDEM_PORTE[usuario.porte]) peso *= regras.mercado.chance_porte_maior * 3
      lista.push({ clube, plano, jogador: j, peso })
    }
  }
  return lista
}

/**
 * Quantas propostas o usuário recebe na janela: mínimo de 1-2 (se alguém interessa) mais um tanto
 * por jogador que interessa, até o máximo. Cada jogador conta pela fração de clubes interessados
 * (cheio com `clubes_para_interesse_cheio`); janelas depois da principal recebem uma fração.
 */
export function planejarPropostas(m: MundoMercado, regras: Regras, temporada: number, rng: Rng): PlanoPropostas {
  const p = regras.mercado.ia.propostas
  const clubesPorJogador = new Map<string, number>()
  for (const i of interesses(m, regras, temporada)) clubesPorJogador.set(i.jogador.id, (clubesPorJogador.get(i.jogador.id) ?? 0) + 1)
  if (!clubesPorJogador.size) return { alvo: 0, feitas: 0, pares: new Set() }
  const interessantes = [...clubesPorJogador.values()].reduce((a, n) => a + Math.min(1, n / p.clubes_para_interesse_cheio), 0)
  const extra = p.por_interessante * interessantes * (m.janelaPrincipal ? 1 : p.fator_outras_janelas)
  const alvo = Math.min(p.maximo, rng.inteiro(p.minimo[0], p.minimo[1]) + Math.round(extra))
  return { alvo, feitas: 0, pares: new Set() }
}

/**
 * Propostas desta data pelos jogadores do usuário: as pendentes do plano espalhadas pelas datas
 * restantes; cada uma sorteada pelo peso do interesse, sem repetir clube e jogador na janela.
 */
export function propostasPeloUsuario(m: MundoMercado, ctx: ContextoIa): PropostaIa[] {
  const { regras, rng } = ctx
  const plano = m.planoPropostas
  if (!plano) return []
  const pendentes = plano.alvo - plano.feitas
  if (pendentes <= 0) return []
  const media = pendentes / Math.max(1, ctx.datasRestantes)
  const n = Math.floor(media) + (rng.chance(media - Math.floor(media)) ? 1 : 0)
  const p = regras.mercado.ia.propostas
  const feitas: PropostaIa[] = []
  for (let i = 0; i < n; i++) {
    const possiveis = interesses(m, regras, ctx.temporada).filter((x) => !plano.pares.has(`${x.clube.sigla}|${x.jogador.id}`) && !feitas.some((f) => f.jogador === x.jogador.id))
    if (!possiveis.length) break
    const escolhido = possiveis[rng.escolherPeso(possiveis.map((x) => x.peso))]!
    const perfil = escolhido.plano.perfil === 'crise' ? 'apertado' : escolhido.plano.perfil
    const [min, max] = escolhido.jogador.aVenda ? p.oferta_a_venda : p.oferta[perfil]
    const arred = regras.mercado.arredondar
    const bruto = escolhido.jogador.valor * (min + rng.proximo() * (max - min))
    const valor = Math.max(arred, Math.min(escolhido.plano.verba, Math.round(bruto / arred) * arred))
    const teto = Math.max(valor, Math.min(escolhido.plano.verba, Math.round((escolhido.jogador.valor * p.teto[perfil]) / arred) * arred))
    plano.pares.add(`${escolhido.clube.sigla}|${escolhido.jogador.id}`)
    plano.feitas++
    feitas.push({ jogador: escolhido.jogador.id, clube: escolhido.clube.sigla, valor, teto })
  }
  return feitas
}

export type RespostaContraproposta = { resposta: 'aceita'; valor: number } | { resposta: 'cobre'; valor: number } | { resposta: 'desiste' }

/**
 * Contraproposta do usuário (1 rodada): até o teto oculto a CPU aceita o pedido; um pouco acima
 * (até teto × cobre_ate) ela cobre parte e oferece o teto; acima disso, desiste.
 */
export function responderContraproposta(p: { valor: number; teto: number }, pedido: number, regras: Regras): RespostaContraproposta {
  if (pedido <= p.valor) return { resposta: 'aceita', valor: p.valor }
  if (pedido <= p.teto) return { resposta: 'aceita', valor: pedido }
  if (pedido <= p.teto * regras.mercado.ia.propostas.cobre_ate && p.teto > p.valor) return { resposta: 'cobre', valor: p.teto }
  return { resposta: 'desiste' }
}

export function dentroDaJanela(semana: number, regras: Regras): boolean {
  return janelaDaSemana(regras.mercado.janelas, semana) !== null
}
