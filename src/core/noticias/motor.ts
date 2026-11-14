import type { Regras } from '../config/padroes'
import type { Rng } from '../rng'
import { ATRIBUTOS } from '@shared/esquemas/pacote'
import type { Condicao, Efeito, EventoCatalogo, Momento, TipoNoticia } from '@shared/esquemas/noticias'

/**
 * Motor de eventos aleatórios (09). Puro: recebe o catálogo e uma foto do time do usuário,
 * sorteia o que acontece e devolve os efeitos já resolvidos (alvo, atributo, chance). Quem
 * aplica é o `aplicarEfeito`, através de uma interface que o main implementa.
 */

export interface JogadorNoticia {
  id: string
  nome: string
  idade: number
  moral: number
  condicao: number
  geral: number
  potencial: number
  titular: boolean
  /** Lesionado ou indisponível (não entra em evento de jogador). */
  fora: boolean
  goleiro: boolean
}

export interface PartidaNoticia {
  resultado: 'V' | 'E' | 'D'
  golsPro: number
  golsContra: number
  emCasa: boolean
}

export interface ContextoNoticias {
  momento: Momento
  /** Semana absoluta (temporada × 100 + semana): para o intervalo mínimo entre repetições. */
  semanaAbsoluta: number
  time: { sigla: string; saldo: number; confianca: number; aproveitamento: number; folhaAcima: boolean }
  jogadores: readonly JogadorNoticia[]
  partida: PartidaNoticia | null
  /** Última semana absoluta em que cada evento aconteceu. */
  ultimaOcorrencia: ReadonlyMap<string, number>
  /** Atributos do foco de treino atual (para `atributo_aleatorio_do_foco`). */
  atributosDoFoco: readonly string[]
  /** Outros clubes (alvo `time_qualquer` e `interesse_mercado`). */
  outrosClubes: readonly string[]
  /** Já existe evento com escolha esperando resposta: não sorteia outro com escolha. */
  escolhaPendente: boolean
}

/** Efeito concreto: alvo e valores já sorteados. */
export type EfeitoConcreto =
  | { campo: 'moral' | 'condicao' | 'potencial'; jogador: string; delta: number }
  | { campo: 'moral_elenco'; time: string; delta: number }
  | { campo: 'atributo'; jogador: string; atributo: string; delta: number }
  | { campo: 'confianca'; delta: number }
  | { campo: 'saldo'; time: string; valor: number }
  | { campo: 'lesao' | 'disponibilidade'; jogador: string; semanas: number }
  | { campo: 'interesse_mercado'; jogador: string; clube: string }

export interface Ocorrencia {
  evento: string
  tipo: TipoNoticia
  texto: string
  jogador: string | null
  time: string | null
  efeitos: EfeitoConcreto[]
  escolhas: { id: string; texto: string; resultado: string | null; efeitos: EfeitoConcreto[] }[] | null
}

const comparar = (a: number | string, op: Condicao['op'], b: number | string): boolean => {
  switch (op) {
    case '<':
      return a < b
    case '<=':
      return a <= b
    case '>':
      return a > b
    case '>=':
      return a >= b
    case '==':
      return a === b
    case '!=':
      return a !== b
  }
}

const media = (xs: readonly number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0)

/** Valor de um campo de condição; `undefined` = não se aplica (ex.: partida fora do pós-jogo). */
function ler(campo: Condicao['campo'], ctx: ContextoNoticias, j: JogadorNoticia | null): number | string | undefined {
  const [grupo, nome] = campo.split('.') as [string, string]
  if (grupo === 'jogador') {
    if (!j) return undefined
    if (nome === 'titular') return j.titular ? 1 : 0
    return j[nome as 'idade' | 'moral' | 'condicao' | 'geral' | 'potencial']
  }
  if (grupo === 'time') {
    const t = ctx.time
    if (nome === 'saldo') return t.saldo
    if (nome === 'confianca') return t.confianca
    if (nome === 'aproveitamento') return t.aproveitamento
    if (nome === 'folha_acima') return t.folhaAcima ? 1 : 0
    return media(ctx.jogadores.map((x) => x.moral))
  }
  const p = ctx.partida
  if (!p) return undefined
  if (nome === 'resultado') return p.resultado
  if (nome === 'gols_pro') return p.golsPro
  if (nome === 'gols_contra') return p.golsContra
  return p.emCasa ? 1 : 0
}

function atende(condicoes: readonly Condicao[], ctx: ContextoNoticias, j: JogadorNoticia | null): boolean {
  return condicoes.every((c) => {
    const v = ler(c.campo, ctx, j)
    return v !== undefined && comparar(v, c.op, c.valor)
  })
}

const temCondicaoDeJogador = (e: EventoCatalogo) => e.gatilho.condicoes.some((c) => c.campo.startsWith('jogador.'))

/** Resolve os efeitos do catálogo para um alvo (sorteia atributo, clube e a chance de cada efeito). */
export function resolverEfeitos(efeitos: readonly Efeito[], alvo: { jogador: JogadorNoticia | null; time: string }, ctx: ContextoNoticias, rng: Rng): EfeitoConcreto[] {
  const saida: EfeitoConcreto[] = []
  for (const e of efeitos) {
    if (e.chance !== undefined && !rng.chance(e.chance)) continue
    const j = alvo.jogador
    switch (e.campo) {
      case 'moral':
      case 'condicao':
      case 'potencial':
        if (j) saida.push({ campo: e.campo, jogador: j.id, delta: e.delta ?? 0 })
        break
      case 'moral_elenco':
        saida.push({ campo: 'moral_elenco', time: alvo.time, delta: e.delta ?? 0 })
        break
      case 'atributo':
      case 'atributo_aleatorio':
      case 'atributo_aleatorio_do_foco': {
        if (!j) break
        let atributo = e.atributo
        if (e.campo === 'atributo_aleatorio') atributo = rng.escolher(ATRIBUTOS.filter((a) => a !== 'RES' || j.goleiro))
        if (e.campo === 'atributo_aleatorio_do_foco') {
          // Foco sem atributos (tático, descanso): não há o que evoluir.
          if (!ctx.atributosDoFoco.length) break
          atributo = rng.escolher(ctx.atributosDoFoco)
        }
        if (atributo) saida.push({ campo: 'atributo', jogador: j.id, atributo, delta: e.delta ?? 0 })
        break
      }
      case 'confianca':
        saida.push({ campo: 'confianca', delta: e.delta ?? 0 })
        break
      case 'saldo':
        saida.push({ campo: 'saldo', time: alvo.time, valor: e.valor ?? 0 })
        break
      case 'lesao':
      case 'disponibilidade':
        if (j) saida.push({ campo: e.campo, jogador: j.id, semanas: e.semanas ?? 1 })
        break
      case 'interesse_mercado':
        if (j && ctx.outrosClubes.length) saida.push({ campo: 'interesse_mercado', jogador: j.id, clube: rng.escolher(ctx.outrosClubes) })
        break
    }
  }
  return saida
}

function preencher(texto: string, v: { jogador?: string; time: string; clube?: string; valor?: string }): string {
  return texto
    .replaceAll('{jogador}', v.jogador ?? '')
    .replaceAll('{time}', v.time)
    .replaceAll('{clube}', v.clube ?? '')
    .replaceAll('{valor}', v.valor ?? '')
}

/** Formatação do `{valor}` (o núcleo não formata dinheiro; o main injeta a função da interface). */
export type FormatarDinheiro = (centavos: number) => string

/**
 * Sorteia os eventos do momento: cada evento elegível (momento, condições, intervalo mínimo,
 * alvo possível) tenta a sua chance, na ordem embaralhada, até o máximo por avaliação.
 */
export function sortearEventos(catalogo: readonly EventoCatalogo[], ctx: ContextoNoticias, regras: Regras, rng: Rng, dinheiro: FormatarDinheiro, nomeTime: (sigla: string) => string): Ocorrencia[] {
  const r = regras.noticias
  const saida: Ocorrencia[] = []
  let comEscolha = ctx.escolhaPendente
  for (const e of rng.embaralhar(catalogo.filter((x) => x.gatilho.momento === ctx.momento))) {
    if (saida.length >= r.maximo_por_avaliacao) break
    if (e.escolhas && comEscolha) continue
    const ultima = ctx.ultimaOcorrencia.get(e.id)
    if (ultima !== undefined && ctx.semanaAbsoluta - ultima < Math.max(1, e.intervalo_minimo_semanas)) continue

    let jogador: JogadorNoticia | null = null
    const porJogador = e.alvo === 'jogador_aleatorio_do_usuario' || e.alvo === 'jogador_condicionado'
    if (porJogador) {
      const elegiveis = ctx.jogadores.filter((j) => !j.fora && atende(e.gatilho.condicoes, ctx, j))
      if (!elegiveis.length) continue
      if (!rng.chance(Math.min(1, e.chance * r.fator_chance))) continue
      jogador = rng.escolher(elegiveis)
    } else {
      if (temCondicaoDeJogador(e) || !atende(e.gatilho.condicoes, ctx, null)) continue
      if (!rng.chance(Math.min(1, e.chance * r.fator_chance))) continue
    }
    const time = e.alvo === 'time_qualquer' && ctx.outrosClubes.length ? rng.escolher(ctx.outrosClubes) : ctx.time.sigla
    const alvo = { jogador, time }
    const efeitos = resolverEfeitos(e.efeitos, alvo, ctx, rng.derivar(e.id, 'efeitos'))
    const escolhas = e.escolhas
      ? e.escolhas.map((o) => ({ id: o.id, texto: o.texto, resultado: o.resultado ?? null, efeitos: resolverEfeitos(o.efeitos, alvo, ctx, rng.derivar(e.id, o.id)) }))
      : null
    const saldo = [...efeitos, ...(escolhas?.flatMap((o) => o.efeitos) ?? [])].find((x) => x.campo === 'saldo')
    const clube = efeitos.find((x) => x.campo === 'interesse_mercado')
    const texto = preencher(e.texto, {
      ...(jogador && { jogador: jogador.nome }),
      time: nomeTime(ctx.time.sigla),
      clube: nomeTime(clube && clube.campo === 'interesse_mercado' ? clube.clube : time),
      ...(saldo && saldo.campo === 'saldo' && { valor: dinheiro(Math.abs(saldo.valor)) }),
    })
    if (escolhas) comEscolha = true
    saida.push({ evento: e.id, tipo: e.tipo, texto, jogador: jogador?.id ?? null, time, efeitos, escolhas })
  }
  return saida
}

// ------------------------------------------------------------------ aplicação

/** O que o main expõe para os efeitos mexerem no jogo (elencos e economia em memória). */
export interface AlvoEfeitos {
  jogador(id: string): { moral: number; condicao: number; potencial: number; lesaoDias: number; atributos: Record<string, number>; time: string } | undefined
  jogadoresDoTime(sigla: string): string[]
  /** Marca o jogador como alterado (para gravar). */
  alterado(id: string): void
  confianca(): number
  definirConfianca(v: number): void
  lancar(time: string, valor: number, descricao: string): void
  proposta(jogador: string, clube: string): void
}

/** Registro auditável de um efeito aplicado: valor antes e depois. */
export interface EfeitoAplicado {
  efeito: EfeitoConcreto
  antes: number | null
  depois: number | null
}

const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** Aplica um efeito concreto com os limites do jogo (moral/condição 0-100, atributos e potencial 1-20). */
export function aplicarEfeito(alvo: AlvoEfeitos, ef: EfeitoConcreto, descricao: string): EfeitoAplicado[] {
  const reg = (antes: number | null, depois: number | null): EfeitoAplicado[] => [{ efeito: ef, antes, depois }]
  switch (ef.campo) {
    case 'moral':
    case 'condicao': {
      const j = alvo.jogador(ef.jogador)
      if (!j) return []
      const antes = j[ef.campo]
      j[ef.campo] = limitar(antes + ef.delta, 0, 100)
      alvo.alterado(ef.jogador)
      return reg(antes, j[ef.campo])
    }
    case 'potencial': {
      const j = alvo.jogador(ef.jogador)
      if (!j) return []
      const antes = j.potencial
      j.potencial = limitar(antes + ef.delta, 1, 20)
      alvo.alterado(ef.jogador)
      return reg(antes, j.potencial)
    }
    case 'atributo': {
      const j = alvo.jogador(ef.jogador)
      if (!j || j.atributos[ef.atributo] === undefined) return []
      const antes = j.atributos[ef.atributo]!
      j.atributos[ef.atributo] = limitar(antes + ef.delta, 1, 20)
      alvo.alterado(ef.jogador)
      return reg(antes, j.atributos[ef.atributo]!)
    }
    case 'moral_elenco':
      return alvo.jogadoresDoTime(ef.time).flatMap((id) => aplicarEfeito(alvo, { campo: 'moral', jogador: id, delta: ef.delta }, descricao))
    case 'lesao':
    case 'disponibilidade': {
      const j = alvo.jogador(ef.jogador)
      if (!j) return []
      const antes = j.lesaoDias
      j.lesaoDias = Math.max(antes, ef.semanas * 7)
      alvo.alterado(ef.jogador)
      return reg(antes, j.lesaoDias)
    }
    case 'confianca': {
      const antes = alvo.confianca()
      alvo.definirConfianca(limitar(antes + ef.delta, 0, 100))
      return reg(antes, alvo.confianca())
    }
    case 'saldo':
      alvo.lancar(ef.time, ef.valor, descricao)
      return reg(null, ef.valor)
    case 'interesse_mercado':
      alvo.proposta(ef.jogador, ef.clube)
      return reg(null, null)
  }
}
