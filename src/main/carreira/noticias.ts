import { criarRng } from '@core/rng'
import type { Regras } from '@core/config/padroes'
import { geral } from '@core/jogadores/conversao'
import type { Elencos } from '@core/partida/sessao'
import { catalogoPadrao } from '@core/noticias/catalogoPadrao'
import { aplicarEfeito, sortearEventos, type AlvoEfeitos, type ContextoNoticias, type EfeitoAplicado, type EfeitoConcreto, type Ocorrencia, type PartidaNoticia } from '@core/noticias/motor'
import type { NoticiaInfo } from '@core/noticias/informativas'
import { dinheiro } from '@shared/dinheiro'
import { CatalogoSchema, type CaixaNoticias, type EventoCatalogo, type Momento, type Noticia, type TipoNoticia } from '@shared/esquemas/noticias'
import { ROTULO_ATRIBUTO, type Atributo } from '@shared/esquemas/pacote'
import type { Economia } from './economia'
import { ErroApp } from '../ipc/registrar'
import type { Sql } from '../db/sql'

/**
 * Notícias da carreira (09): o `Jornal` vive dentro da sessão de avanço (mesma transação do
 * Continuar), gera as informativas, sorteia os eventos do catálogo e aplica os efeitos nos
 * elencos e na economia em memória. Eventos com escolha ficam pendentes e travam o Continuar.
 */

/** Catálogo da carreira (gravado na criação); carreiras antigas usam o padrão. */
export function catalogoDe(sql: Sql): EventoCatalogo[] {
  const bruto = sql.get<{ valor: string }>("SELECT valor FROM configuracao WHERE chave = 'catalogo_noticias'")?.valor
  if (!bruto) return catalogoPadrao()
  const r = CatalogoSchema.safeParse(JSON.parse(bruto))
  return r.success ? r.data : catalogoPadrao()
}

const semanaAbsoluta = (temporada: number, semana: number) => temporada * 100 + semana

export interface ContextoJornal {
  temporada: number
  timeUsuario: string
  regras: Regras
  semente: number
  elencos: Elencos
  economia: () => Economia
  /** Aproveitamento recente do time do usuário (0-1). */
  aproveitamento: () => number
}

type Escolhas = NonNullable<Ocorrencia['escolhas']>

interface NovaNoticia {
  semana: number
  tipo: TipoNoticia
  origem: 'info' | 'evento'
  evento: string | null
  texto: string
  jogador: string | null
  time: string | null
  efeitos: EfeitoAplicado[] | null
  escolhas: Escolhas | null
}

export class Jornal {
  private readonly novas: NovaNoticia[] = []
  private readonly catalogo: EventoCatalogo[]
  private readonly ultima: Map<string, number>
  private nomesJogadores: Map<string, string> | null = null
  private readonly nomesTimes: Map<string, string>

  constructor(
    private readonly sql: Sql,
    private readonly c: ContextoJornal,
  ) {
    this.catalogo = catalogoDe(sql)
    this.ultima = new Map(
      sql
        .all<{ evento: string; s: number }>("SELECT evento, MAX(temporada * 100 + semana) s FROM noticia WHERE origem = 'evento' GROUP BY evento")
        .map((x) => [x.evento, x.s]),
    )
    this.nomesTimes = new Map(sql.all<{ sigla: string; nome_curto: string }>('SELECT sigla, nome_curto FROM time').map((t) => [t.sigla, t.nome_curto]))
  }

  nomeTime = (sigla: string): string => this.nomesTimes.get(sigla) ?? sigla

  nomeJogador(id: string): string {
    this.nomesJogadores ??= new Map(this.sql.all<{ id: number; nome: string }>('SELECT id, nome FROM jogador').map((j) => [String(j.id), j.nome]))
    return this.nomesJogadores.get(id) ?? id
  }

  info(n: NoticiaInfo, semana: number): void {
    this.novas.push({ semana, tipo: n.tipo, origem: 'info', evento: null, texto: n.texto, jogador: n.jogador ?? null, time: n.time ?? null, efeitos: null, escolhas: null })
  }

  temPendente(): boolean {
    return this.novas.some((n) => n.escolhas) || pendentes(this.sql) > 0
  }

  /** Foto do time do usuário para as condições do catálogo. */
  private foto(momento: Momento, semana: number, partida: PartidaNoticia | null): ContextoNoticias {
    const { elencos, regras, timeUsuario } = this.c
    const eco = this.c.economia()
    const meus = [...elencos.jogadores.values()].filter((j) => j.time === timeUsuario)
    const gerais = new Map(meus.map((j) => [j.id, geral(j.atributos, j.posicao, regras)]))
    const titulares = new Set([...meus].sort((a, b) => gerais.get(b.id)! - gerais.get(a.id)!).slice(0, 11).map((j) => j.id))
    const foco = elencos.times.get(timeUsuario)?.foco
    return {
      momento,
      semanaAbsoluta: semanaAbsoluta(this.c.temporada, semana),
      time: { sigla: timeUsuario, saldo: eco.saldo(timeUsuario), confianca: eco.confiancaAtual(), aproveitamento: this.c.aproveitamento(), folhaAcima: eco.folhaAcima(timeUsuario) },
      jogadores: meus.map((j) => ({
        id: j.id,
        nome: this.nomeJogador(j.id),
        idade: j.idade,
        moral: j.moral,
        condicao: j.condicao,
        geral: gerais.get(j.id)!,
        potencial: j.potencial,
        titular: titulares.has(j.id),
        fora: j.lesaoDias > 0,
        goleiro: j.posicao === 'GK',
      })),
      partida,
      ultimaOcorrencia: this.ultima,
      atributosDoFoco: foco ? regras.treino.focos[foco].atributos : [],
      outrosClubes: [...this.nomesTimes.keys()].filter((s) => s !== timeUsuario).sort(),
      escolhaPendente: this.temPendente(),
    }
  }

  /** Avaliação do catálogo num momento: efeitos sem escolha já são aplicados. */
  avaliar(momento: Momento, semana: number, partida: PartidaNoticia | null = null): void {
    const ctx = this.foto(momento, semana, partida)
    const rng = criarRng(this.c.semente).derivar('noticias', this.c.temporada, semana, momento)
    for (const o of sortearEventos(this.catalogo, ctx, this.c.regras, rng, dinheiro, this.nomeTime)) {
      this.ultima.set(o.evento, ctx.semanaAbsoluta)
      this.novas.push({
        semana,
        tipo: o.tipo,
        origem: 'evento',
        evento: o.evento,
        texto: o.texto,
        jogador: o.jogador,
        time: o.time,
        efeitos: o.escolhas ? null : this.aplicar(o.efeitos, o.texto, semana),
        escolhas: o.escolhas,
      })
    }
  }

  /** Aplica efeitos concretos (registro auditável); a moral do elenco vira um registro com a média. */
  aplicar(efeitos: readonly EfeitoConcreto[], descricao: string, semana: number): EfeitoAplicado[] {
    const { elencos } = this.c
    const eco = this.c.economia()
    const alvo: AlvoEfeitos = {
      jogador: (id) => elencos.jogadores.get(id),
      jogadoresDoTime: (s) => [...elencos.jogadores.values()].filter((j) => j.time === s).map((j) => j.id),
      alterado: (id) => elencos.alterados.add(id),
      confianca: () => eco.confiancaAtual(),
      definirConfianca: (v) => eco.definirConfianca(v),
      lancar: (t, v) => eco.lancarEvento(t, v, descricao.length > 80 ? `${descricao.slice(0, 77)}...` : descricao, semana),
      proposta: (j, clube) => eco.proporPeloUsuario(j, clube, semana),
    }
    const registros: EfeitoAplicado[] = []
    for (const ef of efeitos) {
      const r = aplicarEfeito(alvo, ef, descricao)
      if (ef.campo === 'moral_elenco') {
        const media = (xs: (number | null)[]) => (xs.length ? Math.round(xs.reduce<number>((a, x) => a + (x ?? 0), 0) / xs.length) : null)
        registros.push({ efeito: ef, antes: media(r.map((x) => x.antes)), depois: media(r.map((x) => x.depois)) })
        continue
      }
      for (const x of r) {
        registros.push(x)
        if (x.efeito.campo === 'atributo' && x.antes !== null && x.depois !== null && x.depois !== x.antes) {
          elencos.evolucoes.push({ jogador: x.efeito.jogador, atributo: x.efeito.atributo as Atributo, delta: x.depois - x.antes, motivo: 'noticia', semana })
        }
      }
    }
    return registros
  }

  /** Resposta a um evento com escolha (dentro de uma sessão aberta). */
  responder(id: number, escolha: string, semana: number): void {
    const linha = this.sql.get<{ texto: string; escolhas: string | null; pendente: number }>('SELECT texto, escolhas, pendente FROM noticia WHERE id = ?', id)
    if (!linha || !linha.pendente || !linha.escolhas) throw new ErroApp('noticia_sem_escolha', 'Este evento não espera resposta.')
    const opcao = (JSON.parse(linha.escolhas) as Escolhas).find((o) => o.id === escolha)
    if (!opcao) throw new ErroApp('escolha_invalida', 'Opção inexistente.')
    const efeitos = this.aplicar(opcao.efeitos, `${opcao.texto}`, semana)
    this.sql.run('UPDATE noticia SET pendente = 0, lida = 1, escolha_feita = ?, efeitos_aplicados = ? WHERE id = ?', opcao.id, JSON.stringify(efeitos), id)
  }

  gravar(): void {
    for (const n of this.novas.splice(0)) {
      this.sql.run(
        `INSERT INTO noticia (temporada, semana, tipo, origem, evento, texto, jogador_id, time, efeitos_aplicados, escolhas, pendente)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        this.c.temporada, n.semana, n.tipo, n.origem, n.evento, n.texto, n.jogador === null ? null : Number(n.jogador), n.time,
        n.efeitos ? JSON.stringify(n.efeitos) : null, n.escolhas ? JSON.stringify(n.escolhas) : null, n.escolhas ? 1 : 0,
      )
    }
  }
}

/** Notícia informativa fora de uma sessão (ex.: metas na criação da temporada). */
export function registrarInfo(sql: Sql, temporada: number, semana: number, n: NoticiaInfo): void {
  sql.run(
    "INSERT INTO noticia (temporada, semana, tipo, origem, texto, jogador_id, time) VALUES (?, ?, ?, 'info', ?, ?, ?)",
    temporada, semana, n.tipo, n.texto, n.jogador ? Number(n.jogador) : null, n.time ?? null,
  )
}

export function pendentes(sql: Sql): number {
  return sql.get<{ n: number }>('SELECT COUNT(*) n FROM noticia WHERE pendente = 1')?.n ?? 0
}

// ------------------------------------------------------------------ caixa de notícias

function descrever(r: EfeitoAplicado, nomeJogador: (id: string) => string, nomeTime: (s: string) => string): string {
  const e = r.efeito
  const n = (v: number | null) => (v === null ? '—' : String(Math.round(v)))
  const seta = `${n(r.antes)} → ${n(r.depois)}`
  switch (e.campo) {
    case 'moral':
      return `Moral de ${nomeJogador(e.jogador)}: ${seta}`
    case 'condicao':
      return `Condição de ${nomeJogador(e.jogador)}: ${seta}`
    case 'potencial':
      return `Potencial de ${nomeJogador(e.jogador)} ${e.delta > 0 ? 'sobe' : 'cai'}`
    case 'atributo':
      return `${ROTULO_ATRIBUTO[e.atributo as Atributo] ?? e.atributo} de ${nomeJogador(e.jogador)}: ${seta}`
    case 'moral_elenco':
      return `Moral média do elenco: ${seta}`
    case 'confianca':
      return `Confiança da diretoria: ${seta}`
    case 'saldo':
      return `${e.valor >= 0 ? 'Receita' : 'Despesa'}: ${dinheiro(Math.abs(e.valor))}`
    case 'lesao':
      return `${nomeJogador(e.jogador)} lesionado por ${e.semanas} semana(s)`
    case 'disponibilidade':
      return `${nomeJogador(e.jogador)} fora por ${e.semanas} semana(s)`
    case 'interesse_mercado':
      return `Proposta do ${nomeTime(e.clube)} por ${nomeJogador(e.jogador)} (veja em Mercado)`
  }
}

interface LinhaNoticia {
  id: number
  temporada: number
  semana: number
  tipo: TipoNoticia
  origem: 'info' | 'evento'
  evento: string | null
  texto: string
  jogador_id: number | null
  time: string | null
  efeitos_aplicados: string | null
  escolhas: string | null
  escolha_feita: string | null
  pendente: number
  lida: number
}

export function caixa(sql: Sql, filtro: { tipo?: TipoNoticia; limite?: number } = {}): CaixaNoticias {
  const nomesJ = new Map(sql.all<{ id: number; nome: string }>('SELECT id, nome FROM jogador').map((j) => [String(j.id), j.nome]))
  const nomesT = new Map(sql.all<{ sigla: string; nome_curto: string }>('SELECT sigla, nome_curto FROM time').map((t) => [t.sigla, t.nome_curto]))
  const nj = (id: string) => nomesJ.get(id) ?? id
  const nt = (s: string) => nomesT.get(s) ?? s
  const linhas = sql.all<LinhaNoticia>(
    `SELECT * FROM noticia ${filtro.tipo ? 'WHERE tipo = ?' : ''} ORDER BY pendente DESC, temporada DESC, semana DESC, id DESC LIMIT ?`,
    ...(filtro.tipo ? [filtro.tipo] : []), filtro.limite ?? 300,
  )
  const noticias: Noticia[] = linhas.map((l) => {
    const escolhas = l.escolhas ? (JSON.parse(l.escolhas) as Escolhas) : null
    const feita = escolhas?.find((o) => o.id === l.escolha_feita)
    return {
      id: l.id,
      temporada: l.temporada,
      semana: l.semana,
      tipo: l.tipo,
      origem: l.origem,
      evento: l.evento,
      texto: feita ? `${l.texto} ${feita.resultado ?? `Escolha: ${feita.texto}.`}` : l.texto,
      jogadorId: l.jogador_id === null ? null : String(l.jogador_id),
      time: l.time,
      lida: !!l.lida,
      pendente: !!l.pendente,
      escolhas: escolhas?.map((o) => ({ id: o.id, texto: o.texto })) ?? null,
      escolhaFeita: l.escolha_feita,
      efeitos: l.efeitos_aplicados ? (JSON.parse(l.efeitos_aplicados) as EfeitoAplicado[]).map((r) => descrever(r, nj, nt)) : [],
    }
  })
  return {
    noticias,
    naoLidas: sql.get<{ n: number }>('SELECT COUNT(*) n FROM noticia WHERE lida = 0')?.n ?? 0,
    pendentes: pendentes(sql),
  }
}

/** Marca como lidas (as pendentes só saem com a resposta). */
export function marcarLidas(sql: Sql, ids: number[] | null): void {
  if (ids === null) sql.run('UPDATE noticia SET lida = 1 WHERE pendente = 0')
  else for (const id of ids) sql.run('UPDATE noticia SET lida = 1 WHERE id = ? AND pendente = 0', id)
}
