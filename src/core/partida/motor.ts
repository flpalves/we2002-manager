import type { Regras } from '../config/padroes'
import type { Rng } from '../rng'
import type { Atributos, Posicao } from '@shared/esquemas/pacote'
import { gastoPorMinuto } from '../jogadores/condicao'
import { papeisDa, SETOR, type Setor } from './formacoes'
import { fatorCondicao, fatorMoral, fatorPosicao, notaBasePapel, notaSetor } from './efetivo'
import type { DetalhePartida, EventoPartida, JogadorPartida, Lado, Participacao, TimePartida } from './tipos'

/**
 * Motor próprio, lance a lance por minuto (04-motor-partida). Entrega placar, autores,
 * assistências, cartões, lesões, substituições e minutos jogados. Todos os números vêm de
 * `regras.motor` / `regras.ia` / `regras.condicao` e são calibrados pelo teste em lote.
 */

export type Desempate = (golsCasa: number, golsVisitante: number, aposProrrogacao: boolean) => 'prorrogacao' | 'penaltis' | null

export interface EntradaMotor {
  casa: TimePartida
  visitante: TimePartida
  /** Ocupação do estádio, 0-1 (bônus de mando). */
  ocupacao: number
  substituicoes: number
  /** Chamado ao fim do tempo normal (e da prorrogação) para saber se o jogo continua. */
  desempate?: Desempate
  regras: Regras
  rng: Rng
}

export interface SaidaMotor {
  golsCasa: number
  golsVisitante: number
  prorrogacao: boolean
  penaltisCasa: number | null
  penaltisVisitante: number | null
  amarelos: Record<Lado, number>
  vermelhos: Record<Lado, number>
  detalhe: DetalhePartida
}

interface Vaga {
  papel: Posicao
  jogador: JogadorPartida | null
  condicao: number
  /** Notas por setor já com posição e moral (sem condição, aplicada por minuto). */
  setores: Record<Setor, number>
  amarelos: number
}

interface EstadoTime {
  lado: Lado
  base: TimePartida
  vagas: Vaga[]
  /** Denominador fixo dos setores (pela formação), para que expulsão reduza a força. */
  pesoFormacao: Record<Setor, number>
  reservas: JogadorPartida[]
  subsRestantes: number
  modificador: number
  gols: number
  amarelos: number
  vermelhos: number
  amareladosAvaliados: Set<string>
}

const SETORES: Setor[] = ['gol', 'defesa', 'meio', 'ataque']
const outro = (l: Lado): Lado => (l === 'casa' ? 'visitante' : 'casa')

function montarVaga(j: JogadorPartida, papel: Posicao, regras: Regras, condicao = j.condicao): Vaga {
  const fp = fatorPosicao(j, papel, regras) * fatorMoral(j.moral, regras)
  const setores = Object.fromEntries(SETORES.map((s) => [s, notaSetor(j.atributos, s, regras) * fp])) as Record<Setor, number>
  return { papel, jogador: j, condicao, setores, amarelos: 0 }
}

function efetivo(a: Atributos, attr: keyof Atributos, v: Vaga, regras: Regras): number {
  return a[attr] * fatorCondicao(v.condicao, regras)
}

export function simularPartida(e: EntradaMotor): SaidaMotor {
  const { regras, rng } = e
  const m = regras.motor
  const eventos: EventoPartida[] = []
  const participacoes = new Map<string, Participacao>()

  const criar = (lado: Lado, t: TimePartida): EstadoTime => {
    const papeis = papeisDa(t.escalacao.formacao)
    const vagas = t.escalacao.titulares.map((j, i) => montarVaga(j, papeis[i] ?? 'CF', regras))
    const pesoFormacao = Object.fromEntries(SETORES.map((s) => [s, papeis.reduce((acc, p) => acc + (m.contribuicao[p]?.[s] ?? 0), 0)])) as Record<Setor, number>
    const mando = lado === 'casa' ? m.mando_base + m.mando_publico_max * Math.min(1, Math.max(0, e.ocupacao)) : 0
    const entros = m.entrosamento_amplitude * ((t.entrosamento - 50) / 50)
    vagas.forEach((v, i) =>
      participacoes.set(v.jogador!.id, {
        jogador: v.jogador!.id,
        lado,
        titular: true,
        posicao: v.papel,
        vaga: i,
        camisa: v.jogador!.camisa,
        minutos: 0,
        entrouAos: null,
        saiuAos: null,
        condicaoFinal: v.condicao,
      }),
    )
    return {
      lado,
      base: t,
      vagas,
      pesoFormacao,
      reservas: [...t.escalacao.reservas],
      subsRestantes: e.substituicoes,
      // Forma do dia: limitada a ±2 desvios para não gerar times absurdos.
      modificador: (1 + mando + entros) * (1 + Math.max(-2, Math.min(2, rng.normal())) * m.variacao_dia),
      gols: 0,
      amarelos: 0,
      vermelhos: 0,
      amareladosAvaliados: new Set(),
    }
  }
  const times: Record<Lado, EstadoTime> = { casa: criar('casa', e.casa), visitante: criar('visitante', e.visitante) }

  const forca = (t: EstadoTime, setor: Setor): number => {
    let soma = 0
    for (const v of t.vagas) {
      if (!v.jogador) continue
      soma += (m.contribuicao[v.papel]?.[setor] ?? 0) * v.setores[setor] * fatorCondicao(v.condicao, regras)
    }
    const den = t.pesoFormacao[setor]
    return den > 0 ? (soma / den) * t.modificador : 0
  }

  const escolher = <T>(itens: T[], peso: (x: T) => number): T | null => {
    const pesos = itens.map((x) => Math.max(0, peso(x)))
    if (!pesos.some((p) => p > 0)) return null
    return itens[rng.escolherPeso(pesos)] ?? null
  }

  let minuto = 0
  let acrescimo = 0
  let minutoReal = 0
  const marca = () => ({ minuto, acrescimo })

  const tirarDeCampo = (v: Vaga) => {
    const p = participacoes.get(v.jogador!.id)!
    p.saiuAos = minutoReal
    p.condicaoFinal = v.condicao
  }

  /** Coloca um reserva na vaga; `papelNovo` muda o papel (substituição tática). */
  const substituir = (t: EstadoTime, v: Vaga, motivo: 'lesao' | 'cansaco' | 'cartao' | 'tatica', papelNovo?: Posicao): boolean => {
    if (t.subsRestantes <= 0 || t.reservas.length === 0 || !v.jogador) return false
    const papel = papelNovo ?? v.papel
    // Goleiro só sai para goleiro (e reserva de linha nunca vai para o gol, se houver goleiro).
    const candidatos = papel === 'GK' ? t.reservas.filter((r) => r.posicao === 'GK') : t.reservas.filter((r) => r.posicao !== 'GK')
    const lista = candidatos.length ? candidatos : t.reservas
    const entra = lista.reduce((a, b) => (notaBasePapel(b, papel, regras) * fatorCondicao(b.condicao, regras) > notaBasePapel(a, papel, regras) * fatorCondicao(a.condicao, regras) ? b : a))
    const sai = v.jogador
    tirarDeCampo(v)
    t.reservas = t.reservas.filter((r) => r !== entra)
    t.subsRestantes--
    const nova = montarVaga(entra, papel, regras)
    Object.assign(v, nova)
    const vaga = t.vagas.indexOf(v)
    participacoes.set(entra.id, {
      jogador: entra.id,
      lado: t.lado,
      titular: false,
      posicao: papel,
      vaga,
      camisa: entra.camisa,
      minutos: 0,
      entrouAos: minutoReal,
      saiuAos: null,
      condicaoFinal: entra.condicao,
    })
    eventos.push({ tipo: 'substituicao', ...marca(), lado: t.lado, sai: sai.id, entra: entra.id, motivo })
    return true
  }

  const expulsar = (t: EstadoTime, v: Vaga) => {
    tirarDeCampo(v)
    v.jogador = null
    if (v.papel !== 'GK') return
    // Goleiro expulso: sai o jogador de linha mais fraco no ataque. Entra o goleiro reserva
    // (se houver troca disponível); senão, esse jogador de linha vai para o gol.
    const sacrificado = naCampo(t)
      .filter((x) => x.papel !== 'GK')
      .sort((a, b) => a.setores.ataque - b.setores.ataque)[0]
    if (!sacrificado) return
    const sai = sacrificado.jogador!
    const goleiroReserva = t.reservas.find((r) => r.posicao === 'GK')
    if (goleiroReserva && t.subsRestantes > 0) {
      tirarDeCampo(sacrificado)
      sacrificado.jogador = null
      t.reservas = t.reservas.filter((r) => r !== goleiroReserva)
      t.subsRestantes--
      Object.assign(v, montarVaga(goleiroReserva, 'GK', regras))
      participacoes.set(goleiroReserva.id, {
        jogador: goleiroReserva.id,
        lado: t.lado,
        titular: false,
        posicao: 'GK',
        vaga: t.vagas.indexOf(v),
        camisa: goleiroReserva.camisa,
        minutos: 0,
        entrouAos: minutoReal,
        saiuAos: null,
        condicaoFinal: goleiroReserva.condicao,
      })
      eventos.push({ tipo: 'substituicao', ...marca(), lado: t.lado, sai: sai.id, entra: goleiroReserva.id, motivo: 'cartao' })
    } else {
      Object.assign(v, montarVaga(sai, 'GK', regras, sacrificado.condicao))
      sacrificado.jogador = null
    }
  }

  const naCampo = (t: EstadoTime) => t.vagas.filter((v) => v.jogador)

  // ---------------------------------------------------------------- lances de um minuto
  const jogarMinuto = () => {
    minutoReal++
    for (const t of [times.casa, times.visitante]) {
      for (const v of naCampo(t)) {
        const j = v.jogador!
        v.condicao = Math.max(0, v.condicao - gastoPorMinuto({ idade: j.idade, resistencia: j.resistencia, fole: j.atributos.STA }, regras))
      }
    }

    // 1. posse pelo meio
    const meioC = forca(times.casa, 'meio') ** m.expoente_posse
    const meioV = forca(times.visitante, 'meio') ** m.expoente_posse
    const ladoBola: Lado = rng.chance(meioC / (meioC + meioV || 1)) ? 'casa' : 'visitante'
    const atk = times[ladoBola]
    const def = times[outro(ladoBola)]

    // 2. jogada perigosa
    const razao = forca(atk, 'ataque') / Math.max(0.1, forca(def, 'defesa'))
    if (rng.chance(Math.min(0.6, m.chance_jogada * razao ** m.expoente_jogada))) {
      const vagasAtk = naCampo(atk)
      const finalizador = escolher(vagasAtk, (v) => (m.peso_finalizador[v.papel] ?? 0) * efetivo(v.jogador!.atributos, 'OFF', v, regras))
      if (finalizador) {
        const a = finalizador.jogador!.atributos
        const cabeca = rng.chance(m.chance_cabeceio)
        const fp = fatorPosicao(finalizador.jogador!, finalizador.papel, regras)
        const habilidade = (cabeca ? a.HEA * 0.7 + a.JMP * 0.3 : a.SHA * 0.65 + a.SHP * 0.35) * fatorCondicao(finalizador.condicao, regras) * Math.max(fp, 0.85)
        const gk = def.vagas.find((v) => v.jogador && v.papel === 'GK')
        const goleiro = gk ? gk.setores.gol * fatorCondicao(gk.condicao, regras) : 3
        const pGol = Math.min(0.9, m.conversao * (habilidade / Math.max(1, goleiro)) ** m.expoente_finalizacao)
        if (rng.chance(pGol)) {
          atk.gols++
          let assistencia: string | null = null
          if (rng.chance(m.chance_assistencia)) {
            const outros = vagasAtk.filter((v) => v !== finalizador)
            const ass = escolher(outros, (v) => (m.peso_assistente[v.papel] ?? 0) * (v.jogador!.atributos.PAS + v.jogador!.atributos.TEC))
            assistencia = ass?.jogador?.id ?? null
          }
          eventos.push({ tipo: 'gol', ...marca(), lado: ladoBola, jogador: finalizador.jogador!.id, assistencia, cabeca })
        }
      }
    }

    // 3. faltas, cartões e lesões
    for (const t of [times.casa, times.visitante]) {
      if (rng.chance(m.falta_por_minuto)) {
        const autor = escolher(naCampo(t), (v) => ((m.contribuicao[v.papel]?.defesa ?? 0) + (m.contribuicao[v.papel]?.meio ?? 0) + 0.2) * (0.5 + v.jogador!.atributos.AGR / 20))
        if (autor) {
          const agr = (1 + m.fator_agressividade * (autor.jogador!.atributos.AGR - 10)) * (autor.amarelos > 0 ? m.cuidado_amarelado : 1)
          if (rng.chance(m.vermelho_direto_por_falta * agr)) {
            t.vermelhos++
            eventos.push({ tipo: 'vermelho', ...marca(), lado: t.lado, jogador: autor.jogador!.id, segundoAmarelo: false })
            expulsar(t, autor)
          } else if (rng.chance(m.amarelo_por_falta * agr)) {
            autor.amarelos++
            t.amarelos++
            eventos.push({ tipo: 'amarelo', ...marca(), lado: t.lado, jogador: autor.jogador!.id, segundoAmarelo: false })
            if (autor.amarelos >= 2) {
              t.vermelhos++
              eventos.push({ tipo: 'vermelho', ...marca(), lado: t.lado, jogador: autor.jogador!.id, segundoAmarelo: true })
              expulsar(t, autor)
            }
          }
        }
      }
      if (rng.chance(m.lesao_por_minuto * (t.base.fatorLesao ?? 1))) {
        const vitima = escolher(naCampo(t), (v) => 1 + m.lesao_fator_cansaco * (1 - v.condicao / 100))
        if (vitima) {
          const faixas = regras.lesoes.faixas
          const faixa = faixas[rng.escolherPeso(faixas.map((f) => f.peso))]!
          const semanas = rng.inteiro(faixa.semanas[0], faixa.semanas[1])
          eventos.push({ tipo: 'lesao', ...marca(), lado: t.lado, jogador: vitima.jogador!.id, gravidade: faixa.nome, semanas })
          if (!substituir(t, vitima, 'lesao')) {
            tirarDeCampo(vitima)
            vitima.jogador = null
          }
        }
      }
    }

    // 4. substituições da IA
    iaSubstituicoes()
  }

  const iaSubstituicoes = () => {
    const ia = regras.ia
    for (const t of [times.casa, times.visitante]) {
      if (t.subsRestantes <= 0) continue
      // cansaço
      if (minuto >= ia.minuto_cansaco) {
        const cansado = naCampo(t)
          .filter((v) => v.condicao < ia.cansaco_substituicao)
          .sort((a, b) => a.condicao - b.condicao)[0]
        if (cansado && substituir(t, cansado, 'cansaco')) continue
      }
      // amarelado agressivo
      if (minuto >= 60) {
        const risco = naCampo(t).find((v) => v.amarelos === 1 && v.jogador!.atributos.AGR >= 14 && !t.amareladosAvaliados.has(v.jogador!.id))
        if (risco) {
          t.amareladosAvaliados.add(risco.jogador!.id)
          if (rng.chance(ia.chance_tirar_amarelado) && substituir(t, risco, 'cartao')) continue
        }
      }
      // tática: perdendo → mais ataque; ganhando no fim → mais defesa. Guarda uma troca para lesão.
      if (t.subsRestantes < 2 || minuto % 5 !== 0) continue
      const saldo = t.gols - times[outro(t.lado)].gols
      if (minuto >= ia.minuto_tatica && saldo < 0) {
        const sai = naCampo(t)
          .filter((v) => SETOR[v.papel] === 'defesa' || v.papel === 'DH')
          .sort((a, b) => a.setores.ataque - b.setores.ataque)[0]
        const temAtacante = t.reservas.some((r) => SETOR[r.posicao] === 'ataque' || r.posicao === 'OH')
        if (sai && temAtacante) {
          const melhor = t.reservas.filter((r) => SETOR[r.posicao] === 'ataque' || r.posicao === 'OH').sort((a, b) => notaBasePapel(b, b.posicao, regras) - notaBasePapel(a, a.posicao, regras))[0]!
          substituir(t, sai, 'tatica', melhor.posicao)
        }
      } else if (minuto >= ia.minuto_segurar && saldo > 0) {
        const sai = naCampo(t)
          .filter((v) => SETOR[v.papel] === 'ataque')
          .sort((a, b) => a.condicao - b.condicao)[0]
        const defensor = t.reservas.filter((r) => SETOR[r.posicao] === 'defesa' || r.posicao === 'DH').sort((a, b) => notaBasePapel(b, b.posicao, regras) - notaBasePapel(a, a.posicao, regras))[0]
        if (sai && defensor) substituir(t, sai, 'tatica', defensor.posicao)
      }
    }
  }

  // ---------------------------------------------------------------- tempo de jogo
  const jogarTempo = (inicio: number, fim: number, acrescimos: number) => {
    for (minuto = inicio + 1; minuto <= fim; minuto++) {
      acrescimo = 0
      jogarMinuto()
    }
    minuto = fim
    for (acrescimo = 1; acrescimo <= acrescimos; acrescimo++) jogarMinuto()
    acrescimo = 0
  }

  jogarTempo(0, 45, rng.inteiro(m.acrescimo_primeiro[0], m.acrescimo_primeiro[1]))
  jogarTempo(45, 90, rng.inteiro(m.acrescimo_segundo[0], m.acrescimo_segundo[1]))

  let prorrogacao = false
  let penaltisCasa: number | null = null
  let penaltisVisitante: number | null = null
  let decisao = e.desempate?.(times.casa.gols, times.visitante.gols, false) ?? null
  if (decisao === 'prorrogacao') {
    prorrogacao = true
    jogarTempo(90, 105, 0)
    jogarTempo(105, 120, 0)
    decisao = e.desempate?.(times.casa.gols, times.visitante.gols, true) ?? null
  }
  if (decisao === 'penaltis') [penaltisCasa, penaltisVisitante] = disputaPenaltis(times.casa, times.visitante, regras, rng)

  // minutos jogados e condição final
  const duracao = prorrogacao ? 120 : 90
  for (const t of [times.casa, times.visitante]) for (const v of naCampo(t)) participacoes.get(v.jogador!.id)!.condicaoFinal = v.condicao
  for (const p of participacoes.values()) {
    const entrou = p.entrouAos ?? 0
    const saiu = p.saiuAos ?? minutoReal
    p.minutos = Math.round((Math.min(saiu, minutoReal) - Math.min(entrou, minutoReal)) * (duracao / minutoReal))
  }

  const naoUtilizados = (['casa', 'visitante'] as const).flatMap((lado) => times[lado].reservas.map((r) => ({ jogador: r.id, lado })))
  return {
    golsCasa: times.casa.gols,
    golsVisitante: times.visitante.gols,
    prorrogacao,
    penaltisCasa,
    penaltisVisitante,
    amarelos: { casa: times.casa.amarelos, visitante: times.visitante.amarelos },
    vermelhos: { casa: times.casa.vermelhos, visitante: times.visitante.vermelhos },
    detalhe: { eventos, participacoes: [...participacoes.values()], naoUtilizados },
  }
}

/** 5 cobranças alternadas + alternadas até decidir; batedores = melhores finalizadores em campo. */
function disputaPenaltis(casa: EstadoTime, visitante: EstadoTime, regras: Regras, rng: Rng): [number, number] {
  const m = regras.motor
  const batedores = (t: EstadoTime) =>
    t.vagas
      .filter((v) => v.jogador)
      .sort((a, b) => b.jogador!.atributos.SHA - a.jogador!.atributos.SHA || (a.papel === 'GK' ? 1 : 0) - (b.papel === 'GK' ? 1 : 0))
  const goleiro = (t: EstadoTime) => t.vagas.find((v) => v.jogador && v.papel === 'GK')?.jogador!.atributos.RES ?? 8
  const lista = { casa: batedores(casa), visitante: batedores(visitante) }
  const cobrar = (t: EstadoTime, adversario: EstadoTime, n: number) => {
    const b = lista[t.lado][n % lista[t.lado].length]!.jogador!
    const p = m.penalti_conversao + m.penalti_ajuste * (b.atributos.SHA - goleiro(adversario))
    return rng.chance(Math.min(0.95, Math.max(0.45, p)))
  }
  let a = 0
  let b = 0
  for (let i = 0; i < 5; i++) {
    if (cobrar(casa, visitante, i)) a++
    if (a > b + (5 - i)) break
    if (cobrar(visitante, casa, i)) b++
    if (a > b + (4 - i) || b > a + (4 - i)) break
  }
  for (let i = 5; a === b; i++) {
    if (cobrar(casa, visitante, i)) a++
    if (cobrar(visitante, casa, i)) b++
  }
  return [a, b]
}
