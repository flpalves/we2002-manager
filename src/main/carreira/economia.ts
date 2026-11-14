import type { Regras } from '@core/config/padroes'
import type { Rng } from '@core/rng'
import type { Competicao } from '@shared/esquemas/pacote'
import type { Atributos } from '@shared/esquemas/pacote'
import type { EstadoTemporada } from '@core/competicoes/temporada'
import type { Partida } from '@core/competicoes/tipos'
import { geral } from '@core/jogadores/conversao'
import {
  abrirJanela,
  MundoMercado,
  propostasPeloUsuario,
  rodadaIaMercado,
  type ClubeMercado,
  type EventoMercado,
  type JogadorMercado,
  type MotivoVenda,
  type PlanoClube,
  type PropostaIa,
  type Transferencia,
} from '@core/mercado/ia'
import { janelaDaSemana, ordenarJanelas } from '@core/mercado/janelas'
import { fatorSerieDoTime, fatorSerieSalarioDoTime, multaPadrao, salarioReferencia, semanasRestantes, valorMercado, type Porte } from '@core/mercado/valor'
import { cotaTv, ehSemanaDeCiclo, lancamentosDoCiclo, lancamentosDoJogo, publico, type Lancamento, type TipoCompeticaoPublico } from '@core/financas/financas'
import { avaliar, confiancaAposJogo, pontosEsperados, type Dificuldade } from '@core/diretoria/diretoria'
import { prioridadeDe, type Elencos } from '@core/partida/sessao'
import type { Sql } from '../db/sql'
import { camisaLivre } from './mercado'

/**
 * Economia da carreira durante o avanço do calendário: ciclo financeiro, mercado da CPU,
 * público e bilheteria, premiações e diretoria. Carrega do banco, altera em memória e grava
 * tudo de uma vez (dentro da transação do Continuar).
 */

interface InfoClube {
  porte: Porte
  pais: string
  capacidade: number
  ingresso: number
  custoPorJogo: number
  patrocinio: number
  orcamentoFolha: number
  ligas: string[]
}

export interface ContextoEconomia {
  regras: Regras
  temporada: number
  timeUsuario: string
  dificuldade: Dificuldade
  intensidade: 'baixa' | 'media' | 'alta'
  competicoes: ReadonlyMap<string, Competicao>
  forca: ReadonlyMap<string, number>
  fatorPais: ReadonlyMap<string, number>
}

/** Ligas (pontos corridos nacionais) em que cada time está. */
export function ligasDosTimes(competicoes: ReadonlyMap<string, Competicao>): Map<string, string[]> {
  const mapa = new Map<string, string[]>()
  for (const c of competicoes.values()) {
    if (c.tipo !== 'nacional' || c.fases[0]?.formato !== 'pontos_corridos' || c.participantes.regra !== 'lista') continue
    for (const s of c.participantes.times) mapa.set(s, [...(mapa.get(s) ?? []), c.id])
  }
  return mapa
}

export class Economia {
  readonly mundo: MundoMercado
  private readonly info = new Map<string, InfoClube>()
  private readonly lancamentos: (Lancamento & { semana: number })[] = []
  private readonly transferencias: (Transferencia & { semana: number })[] = []
  private readonly propostas: (PropostaIa & { semana: number; prazo: number })[] = []
  /** Janela com plano carregado (semana_inicio). */
  private janelaPlano: number | null = null
  /** À venda como veio do banco, para gravar só o que mudou. */
  private readonly aVendaOriginal = new Map<string, MotivoVenda | null>()
  private readonly eventos: (EventoMercado & { semana: number })[] = []
  private confianca: number
  private avaliacoesRuins: number
  demitido = false
  /** Partidas com público calculado neste avanço. */
  private readonly publicos = new Map<string, number>()

  constructor(
    private readonly sql: Sql,
    private readonly ctx: ContextoEconomia,
    private readonly elencos: Elencos,
  ) {
    const ligas = ligasDosTimes(ctx.competicoes)
    const times = sql.all<{
      sigla: string
      porte: Porte
      pais: string
      estadio_capacidade: number
      ingresso: number
      custo_por_jogo: number
      saldo: number
      patrocinio_temporada: number
      orcamento_folha_mensal: number
      confianca_diretoria: number
    }>('SELECT sigla, porte, pais, estadio_capacidade, ingresso, custo_por_jogo, saldo, patrocinio_temporada, orcamento_folha_mensal, confianca_diretoria FROM time')
    const clubes: ClubeMercado[] = []
    for (const t of times) {
      this.info.set(t.sigla, {
        porte: t.porte,
        pais: t.pais,
        capacidade: t.estadio_capacidade,
        ingresso: t.ingresso,
        custoPorJogo: t.custo_por_jogo,
        patrocinio: t.patrocinio_temporada,
        orcamentoFolha: t.orcamento_folha_mensal,
        ligas: ligas.get(t.sigla) ?? [],
      })
      clubes.push({
        sigla: t.sigla,
        porte: t.porte,
        pais: t.pais,
        saldo: t.saldo,
        orcamentoFolha: t.orcamento_folha_mensal,
        usuario: t.sigla === ctx.timeUsuario,
        fatorSalario: fatorSerieSalarioDoTime(ligas.get(t.sigla) ?? [], t.pais, ctx.fatorPais.get(t.pais) ?? 1, ctx.regras),
      })
    }
    const jogadores: JogadorMercado[] = sql
      .all<{
        id: number
        sigla: string | null
        posicao: string
        idade: number
        atributos: string
        moral: number
        valor: number
        a_venda: MotivoVenda | null
        salario_mensal: number | null
        ate_temporada: number | null
        contrato_tipo: string | null
        status: string
        potencial: number
        taxa_fixa: number | null
        origem_clube: string | null
      }>(
        `SELECT j.id, t.sigla, j.posicao, j.idade, j.atributos, j.moral, j.valor, j.a_venda, c.salario_mensal, c.ate_temporada, c.tipo AS contrato_tipo,
                j.status, j.potencial, j.taxa_fixa, j.origem_clube
           FROM jogador j LEFT JOIN time t ON t.id = j.time_id LEFT JOIN contrato c ON c.jogador_id = j.id
          WHERE j.status IN ('ativo', 'livre', 'exterior')`,
      )
      .map((j) => ({
        id: String(j.id),
        time: j.sigla,
        posicao: j.posicao as JogadorMercado['posicao'],
        idade: j.idade,
        geral: geral(JSON.parse(j.atributos) as Atributos, j.posicao, ctx.regras),
        moral: j.moral,
        valor: j.valor,
        salario: j.salario_mensal ?? 0,
        ateTemporada: j.ate_temporada ?? ctx.temporada,
        aVenda: j.sigla ? j.a_venda : null,
        emprestado: j.contrato_tipo === 'emprestimo',
        potencial: j.potencial,
        ...(j.status === 'exterior' && { taxa: j.taxa_fixa ?? 0, origem: j.origem_clube }),
      }))
    for (const j of jogadores) this.aVendaOriginal.set(j.id, j.aVenda)
    this.mundo = new MundoMercado(clubes, jogadores)
    const usuario = times.find((t) => t.sigla === ctx.timeUsuario)
    this.confianca = usuario?.confianca_diretoria ?? ctx.regras.diretoria.confianca_inicial
    const c = sql.get<{ avaliacoes_ruins: number; demitido: number }>('SELECT avaliacoes_ruins, demitido FROM carreira')
    this.avaliacoesRuins = c?.avaliacoes_ruins ?? 0
    this.demitido = !!c?.demitido
  }

  private lancar(l: Lancamento, semana: number): void {
    if (!l.valor) return
    this.lancamentos.push({ ...l, semana })
    const c = this.mundo.clubes.get(l.time)
    if (c) c.saldo += l.valor
  }

  /** Semanas que passaram: a cada ciclo, salários, patrocínio, TV e a avaliação da diretoria. */
  semanasPassadas(de: number, ate: number): void {
    const r = this.ctx.regras
    for (let s = de + 1; s <= ate; s++) {
      if (!ehSemanaDeCiclo(s, r)) continue
      for (const [sigla, info] of this.info) {
        for (const l of lancamentosDoCiclo({ time: sigla, folhaMensal: this.mundo.folha(sigla), patrocinioTemporada: info.patrocinio, cotaTvTemporada: cotaTv(info.ligas, r) }, r)) {
          this.lancar(l, s)
        }
      }
      const u = this.mundo.clubes.get(this.ctx.timeUsuario)
      const info = this.info.get(this.ctx.timeUsuario)
      if (u && info && !this.demitido) {
        const a = avaliar(this.confianca, this.avaliacoesRuins, { saldo: u.saldo, folha: this.mundo.folha(u.sigla), orcamentoFolha: info.orcamentoFolha }, this.ctx.dificuldade, r)
        this.confianca = a.confianca
        this.avaliacoesRuins = a.avaliacoesRuins
        if (a.demitido) this.demitido = true
      }
    }
  }

  /** Propostas da CPU feitas neste avanço (para as notícias). */
  propostasNovas(): readonly { jogador: string; clube: string; valor: number; semana: number }[] {
    return this.propostas
  }

  /** Eventos do mercado da CPU neste avanço (para as notícias). */
  eventosNovos(): readonly (EventoMercado & { semana: number })[] {
    return this.eventos
  }

  /**
   * Plano da janela: carrega do banco ou, na primeira data dela, abre a janela (perfil, chegadas,
   * lista de venda e o plano de propostas pelo usuário).
   */
  private planoDaJanela(janela: { semana_inicio: number }, semana: number, rng: Rng): void {
    if (this.janelaPlano === janela.semana_inicio) return
    const r = this.ctx.regras
    const T = this.ctx.temporada
    const m = this.mundo
    this.janelaPlano = janela.semana_inicio
    const linhas = this.sql.all<{ time: string; perfil: PlanoClube['perfil']; chegadas_alvo: number; chegadas_feitas: number; verba: number; teto_folha: number }>(
      'SELECT time, perfil, chegadas_alvo, chegadas_feitas, verba, teto_folha FROM plano_janela WHERE temporada = ? AND janela = ?',
      T,
      janela.semana_inicio,
    )
    const principal = ordenarJanelas(r.mercado.janelas)[0]?.semana_inicio === janela.semana_inicio
    if (linhas.length) {
      m.planos.clear()
      m.janelaPrincipal = principal
      for (const l of linhas) {
        m.planos.set(l.time, { sigla: l.time, perfil: l.perfil, chegadasAlvo: l.chegadas_alvo, chegadasFeitas: l.chegadas_feitas, verba: l.verba, tetoFolha: l.teto_folha })
      }
      const pp = this.sql.get<{ alvo: number; feitas: number }>('SELECT alvo, feitas FROM plano_propostas WHERE temporada = ? AND janela = ?', T, janela.semana_inicio)
      const pares = this.sql
        .all<{ clube: string; jogador_id: number }>('SELECT clube, jogador_id FROM proposta_recebida WHERE temporada = ? AND semana >= ?', T, janela.semana_inicio)
        .map((p) => `${p.clube}|${p.jogador_id}`)
      m.planoPropostas = { alvo: pp?.alvo ?? 0, feitas: pp?.feitas ?? 0, pares: new Set(pares) }
      return
    }
    const saidas = new Map(
      this.sql.all<{ time: string; n: number }>('SELECT time, COUNT(*) n FROM saida_elenco WHERE temporada = ? GROUP BY time', T).map((x) => [x.time, x.n]),
    )
    abrirJanela(m, { regras: r, rng: rng.derivar('janela', janela.semana_inicio), temporada: T, intensidade: this.ctx.intensidade, principal, saidas })
    for (const e of m.eventos.splice(0)) this.eventos.push({ ...e, semana })
  }

  /**
   * Data dentro da janela: a CPU executa o plano (compras, livres, empréstimos) e faz as
   * propostas pelos jogadores do usuário. `datasRestantes` conta a data de hoje.
   */
  mercado(semana: number, rng: Rng, datasRestantes = 1): Transferencia[] {
    const janela = janelaDaSemana(this.ctx.regras.mercado.janelas, semana)
    if (!janela) return []
    this.planoDaJanela(janela, semana, rng)
    const ctxIa = { regras: this.ctx.regras, rng: rng.derivar('ia'), temporada: this.ctx.temporada, datasRestantes }
    const feitas = rodadaIaMercado(this.mundo, ctxIa)
    for (const e of this.mundo.eventos.splice(0)) this.eventos.push({ ...e, semana })
    for (const t of feitas) {
      this.transferencias.push({ ...t, semana })
      if (t.valor) {
        const emprestimo = t.tipo === 'emprestimo'
        const saida = emprestimo ? 'emprestimo' : 'transferencia_saida'
        const entrada = emprestimo ? 'emprestimo' : 'transferencia_entrada'
        const descricao = emprestimo ? 'Empréstimo de jogador' : t.tipo === 'exterior' ? 'Contratação do exterior' : 'Compra de jogador'
        this.lancamentos.push({ time: t.para, categoria: saida, valor: -t.valor, descricao, semana })
        if (t.de) this.lancamentos.push({ time: t.de, categoria: entrada, valor: t.valor, descricao: emprestimo ? 'Empréstimo de jogador' : 'Venda de jogador', semana })
      }
      const j = this.elencos.jogadores.get(t.jogador)
      if (j) j.time = t.para
    }
    const prazo = Math.min(janela.semana_fim, semana + this.ctx.regras.mercado.ia.propostas.prazo_semanas)
    for (const p of propostasPeloUsuario(this.mundo, { ...ctxIa, rng: rng.derivar('proposta') })) this.propostas.push({ ...p, semana, prazo })
    return feitas
  }

  /** Público de cada jogo do passo (também vira a ocupação usada pelo mando no motor). */
  publicoDosJogos(partidas: readonly Partida[], estado: EstadoTemporada, finais: ReadonlySet<string>): void {
    const r = this.ctx.regras
    for (const p of partidas) {
      const mand = this.info.get(p.casa)
      const vis = this.info.get(p.visitante)
      const edicao = estado.edicoes.find((e) => e.id === p.edicao)
      const comp = edicao ? this.ctx.competicoes.get(edicao.competicao) : undefined
      if (!mand || !vis) continue
      const tipo: TipoCompeticaoPublico = finais.has(p.id) ? 'final' : prioridadeDe(comp)
      const pub = publico(
        {
          capacidade: mand.capacidade,
          preco: mand.ingresso,
          precoReferencia: r.padrao_por_porte[mand.porte].ingresso_padrao,
          porteMandante: mand.porte,
          porteVisitante: vis.porte,
          competicao: tipo,
          aproveitamento: aproveitamento(estado, p.casa),
        },
        r,
      )
      this.publicos.set(p.id, pub)
      const t = this.elencos.times.get(p.casa)
      if (t) t.ocupacao = mand.capacidade > 0 ? pub / mand.capacidade : 0
    }
  }

  /** Depois dos jogos: bilheteria e custo do estádio do mandante. */
  registrarJogos(partidas: readonly Partida[], semana: number): void {
    for (const p of partidas) {
      const mand = this.info.get(p.casa)
      const pub = this.publicos.get(p.id)
      if (!mand || pub === undefined) continue
      for (const l of lancamentosDoJogo(p.casa, pub, mand.ingresso, mand.custoPorJogo, `${p.casa} x ${p.visitante}`)) this.lancar(l, semana)
      this.sql.run('UPDATE partida SET publico = ?, renda = ? WHERE id = ?', pub, pub * mand.ingresso, p.id)
    }
  }

  /** Premiação da competição (premiacao.por_fase: "campeao" e "vice"). */
  premiar(competicao: Competicao | undefined, classificacao: readonly string[] | null, semana: number): void {
    const premios = competicao?.premiacao?.por_fase ?? {}
    const [campeao, vice] = classificacao ?? []
    if (campeao && premios['campeao']) this.lancar({ time: campeao, categoria: 'premiacao', valor: premios['campeao'], descricao: `Título: ${competicao!.nome}` }, semana)
    if (vice && premios['vice']) this.lancar({ time: vice, categoria: 'premiacao', valor: premios['vice'], descricao: `Vice: ${competicao!.nome}` }, semana)
  }

  /** Jogo do usuário: confiança da diretoria pelos pontos contra a expectativa. */
  jogoDoUsuario(p: Partida): void {
    const r = p.resultado
    if (!r || this.demitido) return
    const emCasa = p.casa === this.ctx.timeUsuario
    const meus = emCasa ? r.golsCasa : r.golsVisitante
    const deles = emCasa ? r.golsVisitante : r.golsCasa
    const pontos = meus > deles ? 3 : meus === deles ? 1 : 0
    const adv = emCasa ? p.visitante : p.casa
    const esp = pontosEsperados(this.ctx.forca.get(this.ctx.timeUsuario) ?? 10, this.ctx.forca.get(adv) ?? 10, emCasa)
    this.confianca = confiancaAposJogo(this.confianca, pontos, esp, this.ctx.regras)
  }

  // ---------------------------------------------------------------- usados pelas notícias (fase 7)

  saldo(sigla: string): number {
    return this.mundo.clubes.get(sigla)?.saldo ?? 0
  }

  folhaAcima(sigla: string): boolean {
    const info = this.info.get(sigla)
    return !!info && this.mundo.folha(sigla) > info.orcamentoFolha
  }

  confiancaAtual(): number {
    return this.confianca
  }

  definirConfianca(v: number): void {
    this.confianca = v
  }

  avaliacoesRuinsAtuais(): number {
    return this.avaliacoesRuins
  }

  /** Lançamento vindo de um evento (bônus, multa, bicho). */
  lancarEvento(time: string, valor: number, descricao: string, semana: number): void {
    this.lancar({ time, categoria: valor >= 0 ? 'evento_receita' : 'evento_despesa', valor, descricao }, semana)
  }

  /** Proposta de um clube por jogador do usuário (interesse do mercado nas notícias). */
  proporPeloUsuario(jogador: string, clube: string, semana: number): number {
    const valor = Math.max(this.ctx.regras.mercado.arredondar, this.mundo.jogadores.get(jogador)?.valor ?? 0)
    this.propostas.push({ jogador, clube, valor, teto: valor, semana, prazo: semana + this.ctx.regras.mercado.ia.propostas.prazo_semanas })
    return valor
  }

  /** Grava saldos, lançamentos, transferências (jogador e contrato), propostas e a diretoria. */
  gravar(): void {
    const sql = this.sql
    for (const c of this.mundo.clubes.values()) sql.run('UPDATE time SET saldo = ? WHERE sigla = ?', Math.round(c.saldo), c.sigla)
    for (const l of this.lancamentos.splice(0)) {
      sql.run('INSERT INTO lancamento_financeiro (temporada, semana, time, categoria, valor, descricao) VALUES (?, ?, ?, ?, ?, ?)', this.ctx.temporada, l.semana, l.time, l.categoria, Math.round(l.valor), l.descricao)
    }
    for (const t of this.transferencias.splice(0)) {
      const camisa = sql.get<{ camisa: number }>('SELECT camisa FROM jogador WHERE id = ?', Number(t.jogador))?.camisa ?? 0
      sql.run(
        "UPDATE jogador SET time_id = (SELECT id FROM time WHERE sigla = ?), status = 'ativo', camisa = ?, a_venda = NULL, taxa_fixa = NULL, origem_clube = NULL, origem_pais = NULL WHERE id = ?",
        t.para, camisaLivre(sql, t.para, camisa, Number(t.jogador)), Number(t.jogador),
      )
      sql.run('DELETE FROM contrato WHERE jogador_id = ?', Number(t.jogador))
      const emprestimo = t.tipo === 'emprestimo'
      sql.run(
        `INSERT INTO contrato (jogador_id, time_id, salario_mensal, ate_temporada, multa, tipo, time_origem_id)
         VALUES (?, (SELECT id FROM time WHERE sigla = ?), ?, ?, ?, ?, (SELECT id FROM time WHERE sigla = ?))`,
        Number(t.jogador), t.para, t.salario, t.ateTemporada, multaPadrao(this.mundo.jogadores.get(t.jogador)?.valor ?? 0, this.ctx.regras),
        emprestimo ? 'emprestimo' : 'definitivo', emprestimo ? t.de : null,
      )
      sql.run('INSERT INTO transferencia (temporada, semana, jogador_id, de, para, tipo, valor, salario) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', this.ctx.temporada, t.semana, Number(t.jogador), t.de, t.para, t.tipo, t.valor, t.salario)
    }
    // Lista de venda: só o que mudou (a CPU refaz a dela a cada janela).
    for (const j of this.mundo.jogadores.values()) {
      if (this.aVendaOriginal.get(j.id) === j.aVenda) continue
      sql.run('UPDATE jogador SET a_venda = ? WHERE id = ?', j.aVenda, Number(j.id))
      this.aVendaOriginal.set(j.id, j.aVenda)
    }
    if (this.janelaPlano !== null) {
      const T = this.ctx.temporada
      for (const p of this.mundo.planos.values()) {
        sql.run(
          `INSERT INTO plano_janela (temporada, janela, time, perfil, chegadas_alvo, chegadas_feitas, verba, teto_folha) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (temporada, janela, time) DO UPDATE SET chegadas_alvo = excluded.chegadas_alvo, chegadas_feitas = excluded.chegadas_feitas, verba = excluded.verba`,
          T, this.janelaPlano, p.sigla, p.perfil, p.chegadasAlvo, p.chegadasFeitas, Math.round(p.verba), p.tetoFolha,
        )
      }
      const pp = this.mundo.planoPropostas
      if (pp) {
        sql.run(
          'INSERT INTO plano_propostas (temporada, janela, alvo, feitas) VALUES (?, ?, ?, ?) ON CONFLICT (temporada, janela) DO UPDATE SET feitas = excluded.feitas',
          T, this.janelaPlano, pp.alvo, pp.feitas,
        )
      }
    }
    for (const p of this.propostas.splice(0)) {
      sql.run(
        'INSERT INTO proposta_recebida (jogador_id, clube, valor, teto, temporada, semana, prazo_semana) VALUES (?, ?, ?, ?, ?, ?, ?)',
        Number(p.jogador), p.clube, p.valor, p.teto, this.ctx.temporada, p.semana, p.prazo,
      )
    }
    sql.run('UPDATE time SET confianca_diretoria = ? WHERE sigla = ?', Math.round(this.confianca), this.ctx.timeUsuario)
    sql.run('UPDATE carreira SET avaliacoes_ruins = ?, demitido = ?', this.avaliacoesRuins, this.demitido)
  }
}

/** Aproveitamento nos últimos 5 jogos do time (0-1; 0,5 sem jogos). */
export function aproveitamento(estado: EstadoTemporada, sigla: string): number {
  const jogos = estado.partidas
    .filter((p) => p.resultado && (p.casa === sigla || p.visitante === sigla))
    .sort((a, b) => b.passo - a.passo)
    .slice(0, 5)
  if (!jogos.length) return 0.5
  const pts = jogos.reduce((acc, p) => {
    const r = p.resultado!
    const meus = p.casa === sigla ? r.golsCasa : r.golsVisitante
    const deles = p.casa === sigla ? r.golsVisitante : r.golsCasa
    return acc + (meus > deles ? 3 : meus === deles ? 1 : 0)
  }, 0)
  return pts / (jogos.length * 3)
}

/**
 * Valor de mercado de todos (início da temporada e abertura de janela). Quem veio do pacote com
 * salário 0 recebe o salário de referência, e multa 0 vira a multa padrão.
 */
export function recalcularValores(sql: Sql, ctx: Pick<ContextoEconomia, 'regras' | 'temporada' | 'competicoes' | 'fatorPais'>, semana: number): void {
  const ligas = ligasDosTimes(ctx.competicoes)
  const linhas = sql.all<{ id: number; sigla: string | null; pais: string | null; posicao: string; idade: number; potencial: number; atributos: string; ate_temporada: number | null; salario_mensal: number | null; multa: number | null }>(
    `SELECT j.id, t.sigla, t.pais, j.posicao, j.idade, j.potencial, j.atributos, c.ate_temporada, c.salario_mensal, c.multa
       FROM jogador j LEFT JOIN time t ON t.id = j.time_id LEFT JOIN contrato c ON c.jogador_id = j.id`,
  )
  for (const l of linhas) {
    const g = geral(JSON.parse(l.atributos) as Atributos, l.posicao, ctx.regras)
    const pais = l.pais ?? 'BRA'
    const ligasDoTime = l.sigla ? (ligas.get(l.sigla) ?? []) : []
    const valor = valorMercado(
      {
        geral: g,
        idade: l.idade,
        potencial: l.potencial,
        semanasContrato: semanasRestantes(l.ate_temporada ?? ctx.temporada, ctx.temporada, semana, ctx.regras),
        fatorSerie: fatorSerieDoTime(ligasDoTime, pais, ctx.fatorPais.get(pais) ?? 1, ctx.regras),
      },
      ctx.regras,
    )
    sql.run('UPDATE jogador SET valor = ? WHERE id = ?', valor, l.id)
    if (l.salario_mensal === 0) {
      const fatorSerieSalario = fatorSerieSalarioDoTime(ligasDoTime, pais, ctx.fatorPais.get(pais) ?? 1, ctx.regras)
      const salario = salarioReferencia({ geral: g, idade: l.idade, potencial: l.potencial, fatorSerieSalario }, ctx.regras)
      sql.run('UPDATE contrato SET salario_mensal = ? WHERE jogador_id = ?', salario, l.id)
    }
    if (l.multa === 0) sql.run('UPDATE contrato SET multa = ? WHERE jogador_id = ?', multaPadrao(valor, ctx.regras), l.id)
  }
}
