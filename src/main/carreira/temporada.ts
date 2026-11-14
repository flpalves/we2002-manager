import { criarRng } from '@core/rng'
import type { Regras } from '@core/config/padroes'
import type { Bloco } from '@core/competicoes/calendario'
import { idEdicao, tabelasDaFase, type EstadoEdicao } from '@core/competicoes/fases'
import { decidirConfronto } from '@core/competicoes/mataMata'
import { regraMataMata } from '@core/competicoes/fases'
import {
  contextoDaPartida,
  gerarTemporada,
  jogarPasso,
  temporadaEncerrada,
  type ContextoTemporada,
  type EstadoTemporada,
  type Simulador,
} from '@core/competicoes/temporada'
import type { Partida, Resultado } from '@core/competicoes/tipos'
import { forcaDoElenco } from '@core/jogadores/forca'
import { aplicarEfeitosPartida, contextoRodizio, criarSimuladorMotor, partidaDecisiva } from '@core/partida/sessao'
import { ErroApp } from '../ipc/registrar'
import { carregarElencos, gravarElencos } from '../db/repositorios/elencos'
import { aproveitamento, Economia, recalcularValores, type ContextoEconomia } from './economia'
import { Jornal, pendentes, registrarInfo } from './noticias'
import * as info from '@core/noticias/informativas'
import { janelaDaSemana } from '@core/mercado/janelas'
import type { EventoMercado } from '@core/mercado/ia'
import { dinheiro } from '@shared/dinheiro'
import type { Dificuldade } from '@core/diretoria/diretoria'
import { gerarMetas } from '@core/diretoria/diretoria'
import type { Atributos, Competicao } from '@shared/esquemas/pacote'
import type { Artilheiro, Calendario, EdicaoDetalhe, EdicaoResumo, Jogo, ResultadoContinuar, Sumula, TimeResumo } from '@shared/esquemas/temporada'
import { carregarTemporada, gravarPasso, gravarTemporadaNova, temporadaExiste } from '../db/repositorios/temporada'
import type { Sql } from '../db/sql'

/**
 * Casos de uso da temporada sobre o banco da carreira aberta: gerar o calendário,
 * Continuar (até o próximo jogo do usuário) e as visões das telas.
 */

interface DadosCarreira {
  semente: number
  temporada: number
  passoAtual: number
  timeUsuario: string
  regras: Regras
  competicoes: Map<string, Competicao>
  blocos: Bloco[]
  pais: Map<string, string>
  forca: Map<string, number>
  dificuldade: Dificuldade
  intensidade: 'baixa' | 'media' | 'alta'
  fatorPais: Map<string, number>
}

/** Modo e origem gravados nas partidas resolvidas pelo motor próprio. */
export const ORIGEM_MOTOR = { modo: 'simulada', origem: 'motor' }

export function lerDados(sql: Sql): DadosCarreira {
  const c = sql.get<{ semente: number; temporada_atual: number; passo_atual: number; time_usuario: string; dificuldade: Dificuldade; intensidade_mercado: 'baixa' | 'media' | 'alta' }>(
    'SELECT semente, temporada_atual, passo_atual, time_usuario, dificuldade, intensidade_mercado FROM carreira',
  )
  if (!c) throw new Error('Carreira sem dados')
  const regras = JSON.parse(sql.get<{ dados: string }>('SELECT dados FROM regras WHERE id = 1')!.dados) as Regras
  const competicoes = new Map(
    sql.all<{ id: string; definicao: string }>('SELECT id, definicao FROM competicao ORDER BY rowid').map((x) => [x.id, JSON.parse(x.definicao) as Competicao]),
  )
  const blocos = JSON.parse(sql.get<{ valor: string }>("SELECT valor FROM configuracao WHERE chave = 'temporada_blocos'")?.valor ?? '[]') as Bloco[]
  const times = sql.all<{ sigla: string; pais: string }>('SELECT sigla, pais FROM time')
  const jogadores = sql.all<{ sigla: string; posicao: string; atributos: string }>(
    "SELECT t.sigla, j.posicao, j.atributos FROM jogador j JOIN time t ON t.id = j.time_id WHERE j.status = 'ativo'",
  )
  const porTime = new Map<string, { posicao: string; atributos: Atributos }[]>()
  for (const j of jogadores) porTime.set(j.sigla, [...(porTime.get(j.sigla) ?? []), { posicao: j.posicao, atributos: JSON.parse(j.atributos) as Atributos }])
  const forca = new Map(times.map((t) => [t.sigla, forcaDoElenco(porTime.get(t.sigla) ?? [], regras)]))
  return {
    semente: c.semente,
    temporada: c.temporada_atual,
    passoAtual: c.passo_atual,
    timeUsuario: c.time_usuario,
    regras,
    competicoes,
    blocos,
    pais: new Map(times.map((t) => [t.sigla, t.pais])),
    forca,
    dificuldade: c.dificuldade,
    intensidade: c.intensidade_mercado,
    fatorPais: new Map(sql.all<{ codigo: string; fator_valor: number }>('SELECT codigo, fator_valor FROM pais').map((p) => [p.codigo, p.fator_valor])),
  }
}

function contexto(d: DadosCarreira): ContextoTemporada {
  const ranking = [...d.forca.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s)
  return {
    competicoes: d.competicoes,
    regras: d.regras,
    rng: criarRng(d.semente).derivar('temporada', d.temporada),
    ranking,
    paisDe: (t) => d.pais.get(t) ?? '',
  }
}

/** Gera o calendário da temporada atual se ainda não existir (carreira nova ou criada antes da fase 2). */
export function garantirTemporada(sql: Sql): void {
  const d = lerDados(sql)
  if (temporadaExiste(sql, d.temporada)) return
  const ctx = contexto(d)
  const participantes: Record<string, string[]> = {}
  // Lista: a definição da carreira (a virada aplica acesso/rebaixamento nela). Classificados: gravados pela virada.
  const classificados = JSON.parse(sql.get<{ valor: string }>('SELECT valor FROM configuracao WHERE chave = ?', chaveClassificados(d.temporada))?.valor ?? '{}') as Record<string, string[]>
  for (const c of d.competicoes.values()) {
    const vindos = classificados[c.id]
    if (c.participantes.regra === 'lista') participantes[c.id] = [...c.participantes.times]
    else if (vindos) participantes[c.id] = [...vindos]
  }
  const estado = gerarTemporada({
    temporada: d.temporada,
    competicoes: [...d.competicoes.values()],
    participantes,
    blocos: d.blocos,
    regras: d.regras,
    rng: ctx.rng,
    ...(ctx.ranking && { ranking: ctx.ranking }),
    ...(ctx.paisDe && { paisDe: ctx.paisDe }),
  })
  const competicaoDe = new Map(estado.edicoes.map((e) => [e.id, e.competicao]))
  sql.transacao(() => {
    gravarTemporadaNova(sql, estado, (id) => competicaoDe.get(id)!)
    sql.run('UPDATE carreira SET passo_atual = 0, semana_atual = 1')
    // Valores de mercado (e salário/multa de quem veio do pacote com 0) e metas da diretoria.
    recalcularValores(sql, { regras: d.regras, temporada: d.temporada, competicoes: d.competicoes, fatorPais: d.fatorPais }, 1)
    criarMetas(sql, d)
  })
}

/** Chave em `configuracao` com os participantes por `classificados_de` de uma temporada (gravados na virada). */
export const chaveClassificados = (temporada: number) => `participantes_${temporada}`

/** Metas da temporada para o time do usuário (se ainda não existirem). */
export function criarMetas(sql: Sql, d: Pick<DadosCarreira, 'temporada' | 'timeUsuario' | 'competicoes' | 'dificuldade' | 'regras'>): void {
  if ((sql.get<{ n: number }>('SELECT COUNT(*) n FROM meta_diretoria WHERE temporada = ?', d.temporada)?.n ?? 0) > 0) return
  const porte = sql.get<{ porte: 'grande' | 'medio' | 'pequeno' }>('SELECT porte FROM time WHERE sigla = ?', d.timeUsuario)?.porte ?? 'medio'
  const liga = [...d.competicoes.values()].find(
    (c) => c.tipo === 'nacional' && c.fases[0]?.formato === 'pontos_corridos' && c.participantes.regra === 'lista' && c.participantes.times.includes(d.timeUsuario),
  )
  const dadosLiga = liga && liga.participantes.regra === 'lista' ? { id: liga.id, nome: liga.nome, times: liga.participantes.times.length } : null
  const metas = gerarMetas(porte, dadosLiga, d.dificuldade, d.regras)
  for (const m of metas) {
    sql.run(
      'INSERT INTO meta_diretoria (temporada, tipo, alvo, competicao, descricao, critica) VALUES (?, ?, ?, ?, ?, ?)',
      d.temporada, m.tipo, m.alvo, m.competicao, m.descricao, m.critica,
    )
  }
  registrarInfo(sql, d.temporada, 1, info.metasDaTemporada(metas.map((m) => m.descricao), d.temporada))
}

function carregar(sql: Sql): { d: DadosCarreira; estado: EstadoTemporada } {
  const d = lerDados(sql)
  return { d, estado: carregarTemporada(sql, d.temporada, d.passoAtual) }
}

function paraJogo(p: Partida, estado: EstadoTemporada, d: DadosCarreira): Jogo {
  const edicao = estado.edicoes.find((e) => e.id === p.edicao)
  const c = edicao ? d.competicoes.get(edicao.competicao) : undefined
  const r = p.resultado
  return {
    id: p.id,
    passo: p.passo,
    semana: estado.passos[p.passo]?.semana ?? 0,
    competicao: c?.id ?? p.edicao,
    competicaoNome: c?.nome ?? p.edicao,
    fase: p.fase,
    faseNome: c?.fases.find((f) => f.id === p.fase)?.nome ?? p.fase,
    grupo: p.grupo,
    rodada: p.rodada,
    jogo: p.jogo,
    casa: p.casa,
    visitante: p.visitante,
    placar: r
      ? {
          golsCasa: r.golsCasa,
          golsVisitante: r.golsVisitante,
          prorrogacao: !!r.prorrogacao,
          penaltisCasa: r.penaltisCasa ?? null,
          penaltisVisitante: r.penaltisVisitante ?? null,
        }
      : null,
  }
}

/** Resultado do jogo do usuário que não veio do motor (WE ou digitado). */
export interface ResultadoExterno {
  resultado: Resultado
  modo: 'we' | 'cpu_cpu_we' | 'manual'
  origem: string
}

/** Sessão de avanço: estado carregado, elencos, simulador e o que já aconteceu. */
export function abrirSessao(sql: Sql) {
  const { d, estado } = carregar(sql)
  const ctx = contexto(d)
  const elencos = carregarElencos(sql, estado.passos[estado.passoAtual - 1]?.dia ?? 0)
  const ctxEconomia: ContextoEconomia = {
    regras: d.regras,
    temporada: d.temporada,
    timeUsuario: d.timeUsuario,
    dificuldade: d.dificuldade,
    intensidade: d.intensidade,
    competicoes: d.competicoes,
    forca: d.forca,
    fatorPais: d.fatorPais,
  }
  // A economia só é carregada quando vai jogar (o pré-jogo não precisa dela).
  let economia: Economia | null = null
  const eco = () => (economia ??= new Economia(sql, ctxEconomia, elencos))
  const jornal = new Jornal(sql, {
    temporada: d.temporada,
    timeUsuario: d.timeUsuario,
    regras: d.regras,
    semente: d.semente,
    elencos,
    economia: eco,
    aproveitamento: () => aproveitamento(estado, d.timeUsuario),
  })
  const rngSemana = (semana: number) => criarRng(d.semente).derivar('treino', d.temporada, semana)
  const motor = criarSimuladorMotor({
    elencos,
    competicoes: d.competicoes,
    regras: d.regras,
    semente: (d.semente ^ d.temporada) >>> 0,
    agenda: (p, sigla, c) => contextoRodizio(estado, p, sigla, d.competicoes, partidaDecisiva(p, c)),
  })
  const campeoes: ResultadoContinuar['campeoes'] = []
  let passosJogados = 0
  let jogoDoUsuario: Jogo | null = null

  /** Leva os elencos até a data atual: recuperação diária e, a cada semana completa, o treino. */
  const chegarNaData = () => elencos.avancarAte(estado.passos[estado.passoAtual]!.dia, d.regras, rngSemana)

  const suspensosDoUsuario = () =>
    new Set(elencos.disciplinas.todas().filter((x) => x.suspenso > 0 && elencos.jogadores.get(x.jogador)?.time === d.timeUsuario).map((x) => `${x.jogador}|${x.competicao}`))

  /** Semanas que passaram: eventos semanais, janela abrindo/fechando, aviso de contratos. */
  const noticiasDasSemanas = (de: number, ate: number) => {
    const r = d.regras
    for (let w = de + 1; w <= ate; w++) {
      for (const j of r.mercado.janelas) {
        if (w === j.semana_inicio) {
          jornal.info(info.janela(true, j.semana_fim, j.nome), w)
          jornal.avaliar('janela_abre', w)
        }
        if (w === j.semana_fim + 1) {
          jornal.info(info.janela(false, null, j.nome), w)
          jornal.avaliar('janela_fecha', w)
        }
      }
      if (w === r.noticias.semana_aviso_contratos) {
        const nomes = sql
          .all<{ nome: string }>(
            'SELECT j.nome FROM jogador j JOIN contrato c ON c.jogador_id = j.id JOIN time t ON t.id = j.time_id WHERE t.sigla = ? AND c.ate_temporada <= ? ORDER BY j.nome',
            d.timeUsuario, d.temporada,
          )
          .map((x) => x.nome)
        if (nomes.length) jornal.info(info.contratosAcabando(nomes, d.temporada), w)
      }
      jornal.avaliar('semana', w)
    }
  }

  /** Depois do jogo do usuário: resultado, lesões, suspensões e os eventos de pós-jogo. */
  const noticiasDoJogo = (p: Partida, j: Jogo, suspensosAntes: Set<string>, semana: number) => {
    const r = p.resultado!
    const emCasa = p.casa === d.timeUsuario
    const pen = r.penaltisCasa !== undefined ? `pênaltis ${r.penaltisCasa} x ${r.penaltisVisitante}` : null
    jornal.info(
      info.resultadoDoUsuario(
        { casa: jornal.nomeTime(p.casa), visitante: jornal.nomeTime(p.visitante), golsCasa: r.golsCasa, golsVisitante: r.golsVisitante, competicao: j.competicaoNome, penaltis: pen },
        jornal.nomeTime(d.timeUsuario),
      ),
      semana,
    )
    const lado = emCasa ? 'casa' : 'visitante'
    for (const ev of r.detalhe?.eventos ?? []) {
      if (ev.tipo === 'lesao' && ev.lado === lado) jornal.info(info.lesao({ id: ev.jogador, nome: jornal.nomeJogador(ev.jogador) }, ev.semanas, d.timeUsuario), semana)
    }
    for (const x of elencos.disciplinas.todas()) {
      if (x.suspenso <= 0 || elencos.jogadores.get(x.jogador)?.time !== d.timeUsuario || suspensosAntes.has(`${x.jogador}|${x.competicao}`)) continue
      jornal.info(info.suspensao({ id: x.jogador, nome: jornal.nomeJogador(x.jogador) }, d.competicoes.get(x.competicao)?.nome ?? x.competicao, x.suspenso, d.timeUsuario), semana)
    }
    const meus = emCasa ? r.golsCasa : r.golsVisitante
    const deles = emCasa ? r.golsVisitante : r.golsCasa
    jornal.avaliar('pos_jogo', semana, { resultado: meus > deles ? 'V' : meus < deles ? 'D' : 'E', golsPro: meus, golsContra: deles, emCasa })
  }

  /**
   * Notícias do mercado da CPU, com limite por data para não afogar o jornal: crises (até 3),
   * reposições (até 3) e quem perde espaço com uma chegada (os 2 de maior geral).
   */
  const noticiasDoMercado = (eventos: readonly (EventoMercado & { semana: number })[]) => {
    const clube = (s: string) => ({ sigla: s, nome: jornal.nomeTime(s) })
    for (const ev of eventos.filter((x) => x.tipo === 'a_venda_crise').slice(0, 3)) {
      jornal.info(info.aVendaPorCrise(clube(ev.clube), ev.jogadores.map((j) => jornal.nomeJogador(j))), ev.semana)
    }
    for (const ev of eventos.filter((x) => x.tipo === 'reposicao').slice(0, 3)) jornal.info(info.reposicao(clube(ev.clube), ev.saidas, ev.chegadas), ev.semana)
    const espaco = eventos
      .filter((x): x is Extract<EventoMercado, { tipo: 'perde_espaco' }> & { semana: number } => x.tipo === 'perde_espaco')
      .sort((a, b) => (eco().mundo.jogadores.get(b.jogador)?.geral ?? 0) - (eco().mundo.jogadores.get(a.jogador)?.geral ?? 0))
      .slice(0, 2)
    for (const ev of espaco) {
      jornal.info(info.perdeEspaco(clube(ev.clube), { id: ev.jogador, nome: jornal.nomeJogador(ev.jogador) }, jornal.nomeJogador(ev.chegou)), ev.semana)
    }
  }

  /** Joga o passo atual; o jogo do usuário pode vir de fora (WE ou digitado). */
  const jogar = (externo?: { partida: string } & ResultadoExterno) => {
    const passo = estado.passos[estado.passoAtual]!
    const semanaAnterior = estado.passos[estado.passoAtual - 1]?.semana ?? 0
    chegarNaData()
    const e = eco()
    const demitidoAntes = e.demitido
    const ruinsAntes = e.avaliacoesRuinsAtuais()
    e.semanasPassadas(semanaAnterior, passo.semana)
    noticiasDasSemanas(semanaAnterior, passo.semana)
    if (e.demitido && !demitidoAntes) jornal.info(info.demissao(jornal.nomeTime(d.timeUsuario)), passo.semana)
    else if (e.avaliacoesRuinsAtuais() > ruinsAntes) jornal.info(info.cargoAmeacado(), passo.semana)
    const propostasAntes = e.propostasNovas().length
    const eventosAntes = e.eventosNovos().length
    const janela = janelaDaSemana(d.regras.mercado.janelas, passo.semana)
    // Datas que faltam na janela, contando a de hoje (as compras e propostas se espalham por elas).
    const datasRestantes = janela ? estado.passos.filter((x) => x.indice >= passo.indice && x.semana <= janela.semana_fim).length : 1
    // Propostas vencidas (prazo passou ou a janela fechou) caem antes das novas.
    sql.run(
      "UPDATE proposta_recebida SET estado = 'expirada' WHERE estado = 'aberta' AND (temporada < ? OR prazo_semana < ? OR ?)",
      d.temporada, passo.semana, janela ? 0 : 1,
    )
    const feitas = e.mercado(passo.semana, criarRng(d.semente).derivar('mercado', d.temporada, passo.indice), datasRestantes)
    noticiasDoMercado(e.eventosNovos().slice(eventosAntes))
    // No jornal, só as 3 transferências mais caras da data (a lista completa fica em Transferências).
    for (const t of [...feitas].sort((a, b) => b.valor - a.valor || a.jogador.localeCompare(b.jogador)).slice(0, d.regras.noticias.transferencias_por_data)) {
      jornal.info(
        info.transferencia(
          { jogador: jornal.nomeJogador(t.jogador), jogadorId: t.jogador, de: t.de && jornal.nomeTime(t.de), para: jornal.nomeTime(t.para), valor: t.valor, emprestimo: t.tipo === 'emprestimo', ...(t.origem && { exterior: t.origem }) },
          dinheiro,
        ),
        passo.semana,
      )
    }
    for (const p of e.propostasNovas().slice(propostasAntes)) {
      const prazo = 'prazo' in p && typeof p.prazo === 'number' ? p.prazo : undefined
      jornal.info(info.propostaRecebida({ clube: jornal.nomeTime(p.clube), jogador: jornal.nomeJogador(p.jogador), jogadorId: p.jogador, valor: p.valor, ...(prazo && { prazo }) }, dinheiro), passo.semana)
    }
    const doPasso = estado.partidas.filter((p) => p.passo === passo.indice && !p.resultado)
    const finais = new Set(doPasso.filter((p) => contextoDaPartida(estado, p, ctx).jogoGrande).map((p) => p.id))
    e.publicoDosJogos(doPasso, estado, finais)
    const simular: Simulador = (p, c) => {
      if (!externo || p.id !== externo.partida) return motor(p, c)
      aplicarEfeitosPartida(elencos, p, externo.resultado, c, d.competicoes.get(c.competicao), d.regras)
      return externo.resultado
    }
    const suspensosAntes = suspensosDoUsuario()
    const r = jogarPasso(estado, simular, ctx)
    gravarPasso(sql, estado, r.jogadas, r.criadas, (p) =>
      externo && p.id === externo.partida ? { modo: externo.modo, origem: externo.origem } : ORIGEM_MOTOR,
    )
    passosJogados++
    e.registrarJogos(r.jogadas, passo.semana)
    for (const ev of r.eventos) {
      const edicao = estado.edicoes.find((x) => x.id === ev.edicao)!
      const c = d.competicoes.get(edicao.competicao)
      if (ev.tipo === 'campeao') {
        campeoes.push({ competicao: c?.nome ?? ev.edicao, time: ev.time })
        jornal.info(info.campeao(jornal.nomeTime(ev.time), c?.nome ?? ev.edicao, ev.time === d.timeUsuario), passo.semana)
        e.premiar(c, edicao.classificacaoFinal, passo.semana)
      }
      // Começo de fase: zera os amarelos se a competição pedir.
      if (ev.tipo === 'fase_encerrada' && c?.suspensao) {
        const i = c.fases.findIndex((f) => f.id === ev.fase)
        const proxima = c.fases[i + 1]
        if (proxima) elencos.disciplinas.iniciarFase(c.id, proxima.id, c.suspensao)
      }
    }
    const doUsuario = r.jogadas.find((p) => p.casa === d.timeUsuario || p.visitante === d.timeUsuario)
    if (doUsuario) {
      jogoDoUsuario = paraJogo(doUsuario, estado, d)
      e.jogoDoUsuario(doUsuario)
      noticiasDoJogo(doUsuario, jogoDoUsuario, suspensosAntes, passo.semana)
      // Depois de cada jogo do usuário: movimentos de negociação renovados; propostas antigas expiram.
      sql.run('UPDATE carreira SET movimentos = ?', d.regras.mercado.movimentos_por_jogo)
    }
  }

  const jogoPendente = (): Partida | null =>
    estado.partidas.find((p) => p.passo === estado.passoAtual && !p.resultado && (p.casa === d.timeUsuario || p.visitante === d.timeUsuario)) ?? null

  const resumo = (): ResultadoContinuar => {
    const pendente = temporadaEncerrada(estado) ? null : jogoPendente()
    return {
      passosJogados,
      semana: estado.passos[estado.passoAtual - 1]?.semana ?? 1,
      encerrada: temporadaEncerrada(estado),
      jogoDoUsuario,
      preJogo: pendente ? paraJogo(pendente, estado, d) : null,
      campeoes,
      eventoPendente: jornal.temPendente(),
    }
  }

  const gravar = () => {
    gravarElencos(sql, elencos, d.temporada)
    economia?.gravar()
    jornal.gravar()
  }
  /** Valores de mercado atualizados (antes do mercado da CPU usar). */
  const recalcular = () =>
    recalcularValores(sql, { regras: d.regras, temporada: d.temporada, competicoes: d.competicoes, fatorPais: d.fatorPais }, estado.passos[estado.passoAtual]?.semana ?? 1)
  return { d, estado, ctx, elencos, jornal, economia: eco, rngSemana, jogar, chegarNaData, jogoPendente, resumo, gravar, recalcularValores: recalcular }
}

/**
 * Continuar: joga as datas até a do próximo jogo do usuário e PARA antes dele (o pré-jogo
 * decide: WE, CPU x CPU no WE ou simular). Sem jogo do usuário marcado, segue até aparecer
 * um ou até o fim da temporada. Tudo numa transação.
 */
/** Demitido: o calendário só anda depois de escolher o novo clube. */
export function exigirEmpregado(sql: Sql): void {
  if (sql.get<{ demitido: number }>('SELECT demitido FROM carreira')?.demitido) {
    throw new ErroApp('demitido', 'Você foi demitido. Escolha um novo clube em Clube e diretoria.')
  }
  if (pendentes(sql) > 0) throw new ErroApp('evento_pendente', 'Há uma notícia esperando a sua decisão. Responda em Notícias.')
}

export function continuar(sql: Sql): ResultadoContinuar {
  exigirEmpregado(sql)
  const s = abrirSessao(sql)
  sql.transacao(() => {
    s.recalcularValores()
    // Para antes do jogo do usuário, ou logo depois de um evento que pede decisão.
    while (!temporadaEncerrada(s.estado) && !s.jogoPendente() && !s.jornal.temPendente()) s.jogar()
    s.gravar()
  })
  return s.resumo()
}

/** Joga a data do jogo do usuário: pelo motor (sem `externo`) ou com o resultado do WE / digitado. */
export function jogarDataDoUsuario(sql: Sql, externo?: ResultadoExterno): ResultadoContinuar {
  exigirEmpregado(sql)
  const s = abrirSessao(sql)
  const p = s.jogoPendente()
  if (!p) throw new ErroApp('sem_jogo', 'Não há jogo do seu time na data atual. Use Continuar.')
  sql.transacao(() => {
    s.jogar(externo && { partida: p.id, ...externo })
    s.gravar()
  })
  return s.resumo()
}

/** Jogo do usuário na data atual, com o contexto (mata-mata, competição) para o pré-jogo e a ponte. */
export function jogoDoUsuarioPendente(sql: Sql) {
  const s = abrirSessao(sql)
  const p = s.jogoPendente()
  if (!p) return null
  // Condição e lesões como estarão no dia do jogo (o mesmo avanço determinístico de quando jogar; não grava).
  s.chegarNaData()
  const ctxPartida = contextoDaPartida(s.estado, p, s.ctx)
  const decisivo = partidaDecisiva(p, ctxPartida)
  const rodizio = (sigla: string) => contextoRodizio(s.estado, p, sigla, s.d.competicoes, decisivo)
  return { partida: p, jogo: paraJogo(p, s.estado, s.d), ctx: ctxPartida, competicao: s.d.competicoes.get(ctxPartida.competicao), dados: s.d, elencos: s.elencos, rodizio }
}

export function calendario(sql: Sql): Calendario {
  const { d, estado } = carregar(sql)
  const doUsuario = new Map<number, Partida>()
  const competicoesDoPasso = new Map<number, Set<string>>()
  for (const p of estado.partidas) {
    if (p.casa === d.timeUsuario || p.visitante === d.timeUsuario) doUsuario.set(p.passo, p)
    const ed = estado.edicoes.find((e) => e.id === p.edicao)
    const nome = (ed && d.competicoes.get(ed.competicao)?.nome) ?? p.edicao
    competicoesDoPasso.set(p.passo, (competicoesDoPasso.get(p.passo) ?? new Set()).add(nome))
  }
  for (const r of estado.reservadas) {
    const ed = estado.edicoes.find((e) => e.id === r.edicao)
    const nome = (ed && d.competicoes.get(ed.competicao)?.nome) ?? r.edicao
    competicoesDoPasso.set(r.passo, (competicoesDoPasso.get(r.passo) ?? new Set()).add(nome))
  }
  return {
    temporada: d.temporada,
    passoAtual: estado.passoAtual,
    encerrada: temporadaEncerrada(estado),
    passos: estado.passos.map((p) => {
      const jogo = doUsuario.get(p.indice)
      return {
        indice: p.indice,
        semana: p.semana,
        tipo: p.tipo,
        jogo: jogo ? paraJogo(jogo, estado, d) : null,
        competicoes: [...(competicoesDoPasso.get(p.indice) ?? [])],
      }
    }),
  }
}

function resumoEdicao(e: EstadoEdicao, d: DadosCarreira): EdicaoResumo {
  return {
    id: e.id,
    competicao: e.competicao,
    nome: d.competicoes.get(e.competicao)?.nome ?? e.competicao,
    campeao: e.campeao,
    usuarioParticipa: e.participantes.includes(d.timeUsuario),
  }
}

export function edicoes(sql: Sql): EdicaoResumo[] {
  const { d, estado } = carregar(sql)
  return estado.edicoes.map((e) => resumoEdicao(e, d))
}

export function detalheEdicao(sql: Sql, id: string): EdicaoDetalhe {
  const { d, estado } = carregar(sql)
  const e = estado.edicoes.find((x) => x.id === id)
  if (!e) throw new Error(`Competição ${id} não encontrada nesta temporada`)
  const c = d.competicoes.get(e.competicao)!
  const op = { temporada: estado.temporada, pontos: d.regras.competicao.pontos }
  const daEdicao = estado.partidas.filter((p) => p.edicao === e.id)
  return {
    ...resumoEdicao(e, d),
    fases: c.fases.map((f, i) => {
      const ef = e.fases[i]!
      const daFase = daEdicao.filter((p) => p.fase === f.id)
      const jogos = daFase.map((p) => paraJogo(p, estado, d))
      const tabelas =
        f.formato !== 'mata_mata' && ef.grupos
          ? tabelasDaFase(f, ef, daFase, op, e.id).map((t) => ({
              grupo: t.grupo,
              linhas: t.linhas.map((l) => {
                const z = f.zonas?.find((zz) => l.posicao >= zz.de && l.posicao <= zz.ate)
                return {
                  time: l.time,
                  posicao: l.posicao,
                  jogos: l.jogos,
                  vitorias: l.vitorias,
                  empates: l.empates,
                  derrotas: l.derrotas,
                  golsPro: l.golsPro,
                  golsContra: l.golsContra,
                  saldo: l.saldo,
                  pontos: l.pontos,
                  ultimos: l.ultimos.slice(-5),
                  zona: z ? { nome: z.nome, cor: z.cor } : null,
                }
              }),
            }))
          : []
      const confrontos: EdicaoDetalhe['fases'][number]['confrontos'] = []
      if (f.formato === 'mata_mata') {
        const ids = [...new Set(daFase.map((p) => p.confronto!))]
        for (const cid of ids) {
          const js = daFase.filter((p) => p.confronto === cid).sort((a, b) => a.jogo - b.jogo)
          let vencedor: string | null = null
          try {
            vencedor = decidirConfronto(js, regraMataMata(f))?.vencedor ?? null
          } catch {
            vencedor = null
          }
          confrontos.push({ id: cid, rodada: js[0]!.rodada, jogos: js.map((p) => paraJogo(p, estado, d)), vencedor })
        }
      }
      const rodadas =
        f.formato === 'mata_mata'
          ? []
          : [...new Set(jogos.map((j) => j.rodada))].sort((a, b) => a - b).map((r) => ({ rodada: r, jogos: jogos.filter((j) => j.rodada === r) }))
      return {
        id: f.id,
        nome: f.nome,
        formato: f.formato,
        iniciada: ef.participantes !== null,
        encerrada: ef.encerrada,
        tabelas,
        confrontos,
        rodadas,
      }
    }),
  }
}

export function times(sql: Sql): TimeResumo[] {
  return sql
    .all<{ sigla: string; nome: string; cores: string; escudo: string | null }>('SELECT sigla, nome, cores, escudo FROM time ORDER BY nome')
    .map((t) => ({ sigla: t.sigla, nome: t.nome, cores: JSON.parse(t.cores) as string[], escudo: t.escudo }))
}

/** Súmula de uma partida jogada: eventos e quem entrou em campo (nomes do WE). */
export function sumula(sql: Sql, id: string): Sumula {
  const { d, estado } = carregar(sql)
  const p = estado.partidas.find((x) => x.id === id)
  if (!p) throw new Error('Partida não encontrada nesta temporada')
  const eventos = sql
    .all<{ minuto: number; acrescimo: number; tipo: Sumula['eventos'][number]['tipo']; time: string; jogador: string | null; outro: string | null; detalhe: string | null }>(
      `SELECT e.minuto, e.acrescimo, e.tipo, e.time, j.nome AS jogador, o.nome AS outro, e.detalhe
         FROM evento_partida e LEFT JOIN jogador j ON j.id = e.jogador_id LEFT JOIN jogador o ON o.id = e.outro_id
        WHERE e.partida_id = ? ORDER BY e.ordem`,
      id,
    )
  const atuacoes = sql.all<{ jogador: string; time: string; camisa: number; posicao: string; titular: number; minutos: number }>(
    `SELECT j.nome AS jogador, x.time, x.camisa, x.posicao, x.titular, x.minutos
       FROM escalacao_partida x JOIN jogador j ON j.id = x.jogador_id
      WHERE x.partida_id = ? ORDER BY x.titular DESC, x.vaga, x.entrou_aos`,
    id,
  )
  const lado = (sigla: string) => atuacoes.filter((a) => a.time === sigla).map((a) => ({ jogador: a.jogador, camisa: a.camisa, posicao: a.posicao, titular: !!a.titular, minutos: a.minutos }))
  return { jogo: paraJogo(p, estado, d), eventos, casa: lado(p.casa), visitante: lado(p.visitante) }
}

/** Artilharia de uma edição (gols, assistências e jogos na competição). */
export function artilharia(sql: Sql, edicao: string, limite = 20): Artilheiro[] {
  return sql.all<Artilheiro>(
    `WITH gols AS (
       SELECT e.jogador_id AS id, COUNT(*) AS n FROM evento_partida e JOIN partida p ON p.id = e.partida_id
        WHERE p.edicao_id = ? AND e.tipo = 'gol' GROUP BY e.jogador_id),
     ass AS (
       SELECT e.outro_id AS id, COUNT(*) AS n FROM evento_partida e JOIN partida p ON p.id = e.partida_id
        WHERE p.edicao_id = ? AND e.tipo = 'gol' AND e.outro_id IS NOT NULL GROUP BY e.outro_id),
     jogos AS (
       SELECT x.jogador_id AS id, COUNT(*) AS n FROM escalacao_partida x JOIN partida p ON p.id = x.partida_id
        WHERE p.edicao_id = ? GROUP BY x.jogador_id)
     SELECT j.nome AS jogador, t.sigla AS time, g.n AS gols, COALESCE(a.n, 0) AS assistencias, COALESCE(k.n, 0) AS jogos
       FROM gols g JOIN jogador j ON j.id = g.id JOIN time t ON t.id = j.time_id
       LEFT JOIN ass a ON a.id = g.id LEFT JOIN jogos k ON k.id = g.id
      ORDER BY g.n DESC, assistencias DESC, jogos ASC, j.nome
      LIMIT ?`,
    edicao, edicao, edicao, limite,
  )
}

export { idEdicao }

/** Resposta a um evento com escolha: aplica os efeitos da opção na sessão e grava. */
export function responderEvento(sql: Sql, noticia: number, escolha: string): void {
  const s = abrirSessao(sql)
  const semana = s.estado.passos[s.estado.passoAtual - 1]?.semana ?? 1
  sql.transacao(() => {
    s.jornal.responder(noticia, escolha, semana)
    s.gravar()
  })
}
