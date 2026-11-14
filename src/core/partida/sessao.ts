import { aplicarEscalacaoSalva, type EscalacaoSalva } from './escalacaoSalva'
import type { FocoTreino, Regras } from '../config/padroes'
import { criarRng, type Rng } from '../rng'
import { moralAposPartida, moralSemanal } from '../jogadores/moral'
import { entrosamentoSemanal, focoDaIa, semanaDeTreino, type MudancaAtributo } from '../jogadores/treino'
import { oscilacaoSemanal } from '../jogadores/oscilacao'
import type { Competicao } from '@shared/esquemas/pacote'
import { empatado } from '../competicoes/mataMata'
import { Disciplinas, SUSPENSAO_PADRAO, type EventoCartao } from '../competicoes/suspensoes'
import type { ContextoPartida, EstadoTemporada, Simulador } from '../competicoes/temporada'
import type { Partida, Resultado } from '../competicoes/tipos'
import { recuperar } from '../jogadores/condicao'
import { escalar, type ContextoRodizio, type PrioridadeCompeticao } from './ia'
import { simularPartida, type Desempate } from './motor'
import type { JogadorPartida, Lado } from './tipos'

/**
 * Estado dos elencos durante a temporada (condição, lesões, suspensões) e o simulador que
 * liga a IA de técnico e o motor ao calendário. O main carrega isto do SQLite, joga os
 * passos e grava de volta.
 */

export interface JogadorCarreira extends JogadorPartida {
  time: string
  /** Dias que faltam para voltar de lesão (0 = disponível). */
  lesaoDias: number
  /** Potencial oculto (1-20): teto da evolução. */
  potencial: number
}

export interface InfoTime {
  formacao: string
  entrosamento: number
  /** Ocupação esperada do estádio (0-1); o público de verdade chega na fase 6. */
  ocupacao: number
  /** Foco do treino escolhido (time do usuário); `null` = a IA escolhe toda semana. */
  foco: FocoTreino | null
  /** Escalação escolhida pelo usuário; ausente/`null` = a IA escala a cada jogo. */
  escalacao?: EscalacaoSalva | null
}

export interface EvolucaoSemana extends MudancaAtributo {
  semana: number
}

export class Elencos {
  readonly jogadores: Map<string, JogadorCarreira>
  readonly disciplinas: Disciplinas
  readonly times: Map<string, InfoTime>
  /** Jogadores que mudaram (condição, lesão, moral, atributos) desde a carga. */
  readonly alterados = new Set<string>()
  /** Times cujo entrosamento mudou. */
  readonly timesAlterados = new Set<string>()
  /** Mudanças de atributo desde a carga (para o histórico de evolução). */
  readonly evolucoes: EvolucaoSemana[] = []
  /** Minutos jogados na semana em curso (fator da evolução). */
  private readonly minutosSemana = new Map<string, number>()
  /** Foco usado na última semana por time (o da IA muda toda semana). */
  private readonly focoAtual = new Map<string, FocoTreino>()
  /** Dia implícito em que o estado está (0 = início da temporada). */
  dia: number

  constructor(jogadores: readonly JogadorCarreira[], times: Map<string, InfoTime>, disciplinas: Disciplinas, dia = 0) {
    this.jogadores = new Map(jogadores.map((j) => [j.id, { ...j, atributos: { ...j.atributos } }]))
    this.times = times
    this.disciplinas = disciplinas
    this.dia = dia
  }

  /** Foco que vale para o time agora (o do usuário, ou o da IA na semana). */
  focoDe(sigla: string): FocoTreino {
    return this.times.get(sigla)?.foco ?? this.focoAtual.get(sigla) ?? 'tecnico'
  }

  registrarMinutos(jogador: string, minutos: number): void {
    this.minutosSemana.set(jogador, (this.minutosSemana.get(jogador) ?? 0) + minutos)
  }

  /**
   * Avança o tempo até o dia `ate`: recuperação diária (pelo foco do treino de cada time)
   * e, a cada semana completa, treino, evolução, declínio, moral e entrosamento.
   */
  avancarAte(ate: number, regras: Regras, rngSemana: (semana: number) => Rng): void {
    while (this.dia < ate) {
      const fimDaSemana = (Math.floor(this.dia / 7) + 1) * 7
      const proximo = Math.min(ate, fimDaSemana)
      this.passarDias(proximo - this.dia, regras)
      this.dia = proximo
      if (this.dia === fimDaSemana) this.fecharSemana(this.dia / 7, regras, rngSemana(this.dia / 7))
    }
  }

  private fecharSemana(semana: number, regras: Regras, rng: Rng): void {
    for (const [sigla, info] of this.times) {
      const elenco = this.doTime(sigla)
      const condicaoMedia = elenco.length ? elenco.reduce((a, j) => a + j.condicao, 0) / elenco.length : 100
      const foco = info.foco ?? focoDaIa(condicaoMedia, info.entrosamento, semana)
      this.focoAtual.set(sigla, foco)
      const novo = entrosamentoSemanal(info.entrosamento, foco, regras)
      if (novo !== info.entrosamento) {
        info.entrosamento = novo
        this.timesAlterados.add(sigla)
      }
      for (const j of elenco) {
        const mudancas = semanaDeTreino(j, foco, this.minutosSemana.get(j.id) ?? 0, regras, rng.derivar(j.id))
        for (const m of mudancas) this.evolucoes.push({ ...m, semana })
        const moral = moralSemanal(j.moral, regras)
        if (mudancas.length || moral !== j.moral) {
          j.moral = moral
          this.alterados.add(j.id)
        }
      }
    }
    // Oscilação aleatória: 1-3% de todos os jogadores, de qualquer clube, ±1-2 num atributo.
    for (const m of oscilacaoSemanal([...this.jogadores.values()], regras, rng.derivar('oscilacao'))) {
      this.evolucoes.push({ ...m, semana })
      this.alterados.add(m.jogador)
    }
    this.minutosSemana.clear()
  }

  doTime(sigla: string): JogadorCarreira[] {
    return [...this.jogadores.values()].filter((j) => j.time === sigla)
  }

  /** Disponíveis para a partida: sem lesão e sem suspensão naquela competição. */
  disponiveis(sigla: string, competicao: string): JogadorCarreira[] {
    return this.doTime(sigla).filter((j) => j.lesaoDias <= 0 && !this.disciplinas.estaSuspenso(j.id, competicao))
  }

  /** Passa `dias` sem jogo: recupera condição (pelo foco do treino) e conta a lesão; quem volta de lesão volta com 70%. */
  passarDias(dias: number, regras: Regras): void {
    if (dias <= 0) return
    for (const j of this.jogadores.values()) {
      if (j.lesaoDias > 0) {
        j.lesaoDias = Math.max(0, j.lesaoDias - dias)
        if (j.lesaoDias === 0) j.condicao = regras.condicao.volta_de_lesao
        this.alterados.add(j.id)
        continue
      }
      if (j.condicao < 100) {
        j.condicao = recuperar(j.condicao, j.idade, dias, regras, regras.treino.focos[this.focoDe(j.time)].recuperacao)
        this.alterados.add(j.id)
      }
    }
  }
}

/** Prioridade da competição para o rodízio da IA (decisão 13: liga > continental > copa > estadual). */
export function prioridadeDe(c: Competicao | undefined): PrioridadeCompeticao {
  if (!c) return 'liga'
  if (c.tipo === 'continental') return 'continental'
  if (c.tipo === 'estadual' || c.tipo === 'regional') return 'estadual'
  return c.fases[0]?.formato === 'mata_mata' ? 'copa' : 'liga'
}

/** Final, ou jogo que fecha um confronto de mata-mata: a IA quase não poupa. */
export function partidaDecisiva(p: Pick<Partida, 'jogo'>, ctx: Pick<ContextoPartida, 'jogoGrande' | 'mataMata'>): boolean {
  return ctx.jogoGrande || (!!ctx.mataMata && p.jogo === ctx.mataMata.regra.jogos)
}

/**
 * O que a IA de técnico sabe do calendário para o rodízio: quantos dias até o jogo seguinte
 * do time (já definido) e de que competição ele é.
 */
export function contextoRodizio(
  estado: Pick<EstadoTemporada, 'partidas' | 'passos' | 'edicoes'>,
  p: Pick<Partida, 'id' | 'passo'>,
  sigla: string,
  competicoes: ReadonlyMap<string, Competicao>,
  decisivo: boolean,
): ContextoRodizio {
  let proxima: Partida | null = null
  for (const x of estado.partidas) {
    if (x.id === p.id || x.passo <= p.passo || (x.casa !== sigla && x.visitante !== sigla)) continue
    if (!proxima || x.passo < proxima.passo) proxima = x
  }
  if (!proxima) return { diasAteProximo: null, prioridadeProximo: null, decisivo }
  const dia = (passo: number) => estado.passos.find((s) => s.indice === passo)?.dia ?? 0
  const edicao = estado.edicoes.find((e) => e.id === proxima.edicao)
  return {
    diasAteProximo: dia(proxima.passo) - dia(p.passo),
    prioridadeProximo: prioridadeDe(edicao ? competicoes.get(edicao.competicao) : undefined),
    decisivo,
  }
}

/** Escala um time para a partida (IA de técnico). Se faltar gente, completa com quem estiver suspenso. */
export function escalarTime(elencos: Elencos, sigla: string, competicao: Competicao | undefined, regras: Regras, rodizio?: ContextoRodizio) {
  const info = elencos.times.get(sigla)
  const id = competicao?.id ?? ''
  let lista = elencos.disponiveis(sigla, id)
  if (lista.length < 11) lista = elencos.doTime(sigla).filter((j) => j.lesaoDias <= 0)
  if (lista.length < 11) lista = elencos.doTime(sigla)
  if (info?.escalacao) return aplicarEscalacaoSalva(info.escalacao, lista, regras)
  return escalar(lista, { formacao: info?.formacao ?? '4-4-2A', prioridade: prioridadeDe(competicao), ...(rodizio && { rodizio }) }, regras)
}

export interface OpcoesSimulador {
  elencos: Elencos
  competicoes: ReadonlyMap<string, Competicao>
  regras: Regras
  semente: number
  /** Calendário para o rodízio da IA (o main passa a partir do estado da temporada). */
  agenda?: (p: Partida, sigla: string, ctx: ContextoPartida) => ContextoRodizio
}

/** Simulador da temporada com o motor lance a lance e a IA de técnico nos dois times. */
export function criarSimuladorMotor(op: OpcoesSimulador): Simulador {
  const raiz = criarRng(op.semente)
  return (p: Partida, ctx: ContextoPartida): Resultado => {
    const { elencos, regras } = op
    const competicao = op.competicoes.get(ctx.competicao)
    const rng = raiz.derivar('partida', p.id)
    const escalaCasa = escalarTime(elencos, p.casa, competicao, regras, op.agenda?.(p, p.casa, ctx))
    const escalaFora = escalarTime(elencos, p.visitante, competicao, regras, op.agenda?.(p, p.visitante, ctx))
    const infoCasa = elencos.times.get(p.casa)

    let desempate: Desempate | undefined
    const mm = ctx.mataMata
    if (mm && p.jogo === mm.regra.jogos) {
      desempate = (gc, gv, apos) => {
        if (!empatado([...mm.anteriores, { ...p, resultado: { golsCasa: gc, golsVisitante: gv } }], mm.regra)) return null
        return !apos && mm.regra.prorrogacao ? 'prorrogacao' : 'penaltis'
      }
    }

    const infoFora = elencos.times.get(p.visitante)
    const fatorLesao = (sigla: string) => regras.treino.focos[elencos.focoDe(sigla)].lesao
    const s = simularPartida({
      casa: { sigla: p.casa, escalacao: escalaCasa, entrosamento: infoCasa?.entrosamento ?? 50, fatorLesao: fatorLesao(p.casa) },
      visitante: { sigla: p.visitante, escalacao: escalaFora, entrosamento: infoFora?.entrosamento ?? 50, fatorLesao: fatorLesao(p.visitante) },
      ocupacao: infoCasa?.ocupacao ?? 0.6,
      substituicoes: ctx.substituicoes,
      ...(desempate && { desempate }),
      regras,
      rng,
    })

    const resultado: Resultado = {
      golsCasa: s.golsCasa,
      golsVisitante: s.golsVisitante,
      ...(s.prorrogacao && { prorrogacao: true }),
      ...(s.penaltisCasa !== null && s.penaltisVisitante !== null && { penaltisCasa: s.penaltisCasa, penaltisVisitante: s.penaltisVisitante }),
      cartoesCasa: { amarelos: s.amarelos.casa, vermelhos: s.vermelhos.casa },
      cartoesVisitante: { amarelos: s.amarelos.visitante, vermelhos: s.vermelhos.visitante },
      detalhe: s.detalhe,
    }
    aplicarEfeitosPartida(elencos, p, resultado, ctx, competicao, regras)
    return resultado
  }
}

/**
 * Efeitos de uma partida jogada nos elencos (simulada ou, na fase 5, vinda do WE):
 * condição de quem jogou, minutos da semana, lesões, cartões → suspensões e moral.
 */
export function aplicarEfeitosPartida(
  elencos: Elencos,
  p: Partida,
  r: Resultado,
  ctx: Pick<ContextoPartida, 'competicao' | 'jogoGrande'>,
  competicao: Competicao | undefined,
  regras: Regras,
): void {
  const d = r.detalhe
  const gols = new Map<string, number>()
  const assistencias = new Map<string, number>()
  const cartoes: Record<Lado, EventoCartao[]> = { casa: [], visitante: [] }

  for (const part of d?.participacoes ?? []) {
    const j = elencos.jogadores.get(part.jogador)
    if (!j) continue
    j.condicao = Math.round(part.condicaoFinal * 10) / 10
    elencos.registrarMinutos(j.id, part.minutos)
    elencos.alterados.add(j.id)
  }
  for (const e of d?.eventos ?? []) {
    if (e.tipo === 'lesao') {
      const j = elencos.jogadores.get(e.jogador)
      if (j) {
        j.lesaoDias = e.semanas * 7
        elencos.alterados.add(j.id)
      }
    } else if (e.tipo === 'amarelo') {
      cartoes[e.lado].push({ jogador: e.jogador, tipo: 'amarelo' })
    } else if (e.tipo === 'vermelho') {
      // Segundo amarelo: vira expulsão; os dois amarelos do jogo não contam para a série.
      if (e.segundoAmarelo) cartoes[e.lado] = cartoes[e.lado].filter((c) => !(c.jogador === e.jogador && c.tipo === 'amarelo'))
      cartoes[e.lado].push({ jogador: e.jogador, tipo: 'vermelho' })
    } else if (e.tipo === 'gol') {
      gols.set(e.jogador, (gols.get(e.jogador) ?? 0) + 1)
      if (e.assistencia) assistencias.set(e.assistencia, (assistencias.get(e.assistencia) ?? 0) + 1)
    }
  }
  const regraSusp = competicao?.suspensao ?? SUSPENSAO_PADRAO
  for (const [lado, sigla] of [['casa', p.casa], ['visitante', p.visitante]] as const) {
    elencos.disciplinas.registrarPartida(ctx.competicao, elencos.doTime(sigla).map((j) => j.id), cartoes[lado], regraSusp)
  }

  // Moral: resultado do time para o elenco todo; gols e assistências para quem fez.
  // Decisão por pênaltis conta como vitória/derrota.
  const saldo = r.golsCasa - r.golsVisitante || (r.penaltisCasa ?? 0) - (r.penaltisVisitante ?? 0)
  const resultadoDe = (lado: Lado) => (saldo === 0 ? 'E' : (saldo > 0) === (lado === 'casa') ? 'V' : 'D')
  for (const [lado, sigla] of [['casa', p.casa], ['visitante', p.visitante]] as const) {
    for (const j of elencos.doTime(sigla)) {
      j.moral = moralAposPartida(
        j.moral,
        { resultado: resultadoDe(lado), gols: gols.get(j.id) ?? 0, assistencias: assistencias.get(j.id) ?? 0, jogoGrande: ctx.jogoGrande },
        regras,
      )
      elencos.alterados.add(j.id)
    }
  }
}
