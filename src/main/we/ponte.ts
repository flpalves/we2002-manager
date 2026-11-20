import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { criarRng } from '@core/rng'
import { empatado } from '@core/competicoes/mataMata'
import { escalarTime, temElencoParaJogar } from '@core/partida/sessao'
import { papeisDa } from '@core/partida/formacoes'
import { seta } from '@core/jogadores/setas'
import { ARQUIVO_ESTADO, escolherControle, vagasDoJogo, type Controle, type ModoWe } from '@core/we/controle'
import { resolverUniformes, type Uniforme } from '@core/we/uniformes'
import { ID_WE, timeParaPonte, type JogadorExportar, type TimeExportar } from '@core/we/exportar'
import { aceitarParcial, conferir, desinverter, normalizarResultado, paraResultado, penaltisDoManager, type LadoEscalado } from '@core/we/resultado'
import type { Escalacao, JogadorPartida, Lado } from '@core/partida/tipos'
import type { Resultado } from '@core/competicoes/tipos'
import type { Aparencia, Atributos, Posicao } from '@shared/esquemas/pacote'
import type { Caminhos } from '@shared/esquemas/config'
import type { AmbienteWe, PreJogo, StatusWe } from '@shared/esquemas/we'
import type { ResultadoContinuar } from '@shared/esquemas/temporada'
import { gravarJson } from '../pacote/leitor'
import { jogarDataDoUsuario, jogoDoUsuarioPendente } from '../carreira/temporada'
import { pendentes } from '../carreira/noticias'
import { ErroApp } from '../ipc/registrar'
import type { Sql } from '../db/sql'

/**
 * Ponte com o WE2002 no PCSX-Redux (spec 07). Fala com a ponte Lua pelos mesmos arquivos
 * de sempre: data/partida.json (agora "versao": 2), os times em data/gerado/*.json no
 * formato antigo, e data/resultado.json. A ponte (bridge/) não muda.
 */

export interface ConfigPonte {
  /** Raiz do projeto (onde ficam bridge/, data/, states/, run-pcsx.bat). */
  raiz: string
  caminhos: Caminhos
  /** Pasta da carreira aberta (cópia dos resultados e partida pendente). */
  pastaCarreira: string
  carreiraId: string
}

/** O que foi gravado para o emulador, para conferir e converter o resultado depois. */
interface PartidaPendente {
  partida: string
  partidaWe: string
  modo: ModoWe
  controle: Controle
  invertido: boolean
  /** O WE joga em "mata_mata" (precisa de vencedor). */
  precisaVencedor: boolean
  /** Volta de ida e volta: o WE dá os 90', o manager decide os pênaltis se o agregado empatar. */
  penaltisNoManager: boolean
  nomes: { vagaCasa: string; vagaVisitante: string }
  /** Mando real. */
  lados: Record<Lado, LadoEscalado>
  iniciadoEm: string
}

const ARQ = (raiz: string) => ({
  partida: join(raiz, 'data', 'partida.json'),
  modelo: join(raiz, 'data', 'partida.modelo.json'),
  resultado: join(raiz, 'data', 'resultado.json'),
  resultadoAnterior: join(raiz, 'data', 'resultado.anterior.json'),
  gerado: join(raiz, 'data', 'gerado'),
  bat: join(raiz, 'run-pcsx.bat'),
  estados: join(raiz, 'states'),
})
const arquivoPendente = (cfg: ConfigPonte) => join(cfg.pastaCarreira, 'we-pendente.json')

function lerJson<T>(arq: string): T | null {
  try {
    return JSON.parse(readFileSync(arq, 'utf8').replace(/^﻿/, '')) as T
  } catch {
    return null
  }
}

export function ambiente(cfg: ConfigPonte): AmbienteWe {
  const a = ARQ(cfg.raiz)
  // A ponte carrega os estados de <raiz>/states (bridge/we2002.lua, ESTADOS_BASE).
  const estados = (Object.keys(ARQUIVO_ESTADO) as Controle[]).filter((c) => existsSync(join(a.estados, ARQUIVO_ESTADO[c])))
  return { raiz: cfg.raiz, emulador: existsSync(cfg.caminhos.emulador), imagem: existsSync(cfg.caminhos.imagem), bat: existsSync(a.bat), estados }
}

// ---------------------------------------------------------------- escalações

interface InfoJogadorBanco {
  id: number
  nome_we: string
  altura: number
  pe: string
  outside: number
  aparencia: string | null
}

interface InfoTimeBanco {
  sigla: string
  nome: string
  nome_curto: string
  kit: string | null
  kit_reserva: string | null
  bandeira: string | null
}

/** Caminho de arquivo do pacote copiado para a carreira (kits e bandeira) → absoluto, se existir. */
function arquivoDaCarreira(cfg: ConfigPonte, rel: unknown): string | null {
  if (typeof rel !== 'string' || !rel) return null
  const abs = join(cfg.pastaCarreira, 'pacote', rel)
  return existsSync(abs) ? abs : null
}

function kitComCaminho(cfg: ConfigPonte, json: string | null): Record<string, unknown> | null {
  if (!json) return null
  const k = JSON.parse(json) as Record<string, unknown>
  // A arte vira caminho absoluto (as ferramentas de kit resolvem a partir da raiz do projeto).
  const arte = arquivoDaCarreira(cfg, k['arte'])
  const copia = { ...k }
  if (arte) copia['arte'] = arte
  else delete copia['arte']
  return copia
}

function desfalques(pend: NonNullable<ReturnType<typeof jogoDoUsuarioPendente>>, sigla: string): { nome: string; motivo: string }[] {
  return pend.elencos
    .doTime(sigla)
    .flatMap((j) => {
      if (j.lesaoDias > 0) return [{ nome: j.nome, motivo: `lesão (${Math.ceil(j.lesaoDias / 7)} sem.)` }]
      if (pend.elencos.disciplinas.estaSuspenso(j.id, pend.ctx.competicao)) return [{ nome: j.nome, motivo: 'suspenso' }]
      return []
    })
}

function montar(sql: Sql) {
  const pend = jogoDoUsuarioPendente(sql)
  if (!pend) throw new ErroApp('sem_jogo', 'Não há jogo do seu time na data atual. Use Continuar.')
  const { partida, dados: d } = pend
  for (const sigla of [partida.casa, partida.visitante]) {
    if (!temElencoParaJogar(pend.elencos, sigla)) {
      throw new ErroApp('elenco_incompleto', `${sigla} não tem 11 jogadores para ir ao WE; simule o jogo (o time sem elenco perde por W.O.).`)
    }
  }
  const escalacoes: Record<Lado, Escalacao> = {
    casa: escalarTime(pend.elencos, partida.casa, pend.competicao, d.regras, pend.rodizio(partida.casa)),
    visitante: escalarTime(pend.elencos, partida.visitante, pend.competicao, d.regras, pend.rodizio(partida.visitante)),
  }
  const infoTime = (sigla: string) => sql.get<InfoTimeBanco>('SELECT sigla, nome, nome_curto, kit, kit_reserva, bandeira FROM time WHERE sigla = ?', sigla)!
  const times = { casa: infoTime(partida.casa), visitante: infoTime(partida.visitante) }
  const parse = (j: string | null) => (j ? (JSON.parse(j) as Record<string, unknown>) : null)
  const uniformes = resolverUniformes(
    { kit: parse(times.casa.kit), kit_reserva: parse(times.casa.kit_reserva) },
    { kit: parse(times.visitante.kit), kit_reserva: parse(times.visitante.kit_reserva) },
  )
  const mm = pend.ctx.mataMata
  const decisivo = !!mm && partida.jogo === mm.regra.jogos
  const precisaVencedor = decisivo && mm!.regra.jogos === 1
  const penaltisNoManager = decisivo && mm!.regra.jogos === 2
  const usuarioVisitante = partida.visitante === d.timeUsuario
  return { pend, escalacoes, times, uniformes, precisaVencedor, penaltisNoManager, usuarioVisitante }
}

function escalados(e: Escalacao, regras: Parameters<typeof seta>[2]) {
  const papeis = papeisDa(e.formacao)
  const dto = (j: JogadorPartida, posicao: string) => ({
    id: j.id,
    nome: j.nome,
    posicao,
    camisa: j.camisa,
    condicao: Math.round(j.condicao),
    seta: seta(j.condicao, j.moral, regras),
  })
  return { titulares: e.titulares.map((j, i) => dto(j, papeis[i] ?? j.posicao)), reservas: e.reservas.map((j) => dto(j, j.posicao)) }
}

export function preJogo(sql: Sql, cfg: ConfigPonte): PreJogo {
  const m = montar(sql)
  const amb = ambiente(cfg)
  const esc = escolherControle(m.usuarioVisitante, new Set(amb.estados), 'jogar')
  const regras = m.pend.dados.regras
  const mm = m.pend.ctx.mataMata
  const decisao = m.precisaVencedor
    ? `Mata-mata em jogo único: empate vai para a prorrogação e os pênaltis do próprio WE.`
    : m.penaltisNoManager
      ? `Jogo de volta: vale o placar dos 90'. Se o agregado empatar${mm?.regra.gol_fora ? ' (contando o gol fora)' : ''}, o manager decide nos pênaltis.`
      : mm
        ? `Jogo de ida: empate vale.`
        : `Empate vale (sem prorrogação).`
  const lado = (l: Lado) => ({
    sigla: m.times[l].sigla,
    formacao: m.escalacoes[l].formacao,
    uniforme: m.uniformes[l] as Uniforme,
    ...escalados(m.escalacoes[l], regras),
    desfalques: desfalques(m.pend, m.times[l].sigla),
  })
  return {
    jogo: m.pend.jogo,
    decisao,
    precisaVencedor: m.precisaVencedor,
    casa: lado('casa'),
    visitante: lado('visitante'),
    controle: esc.controle,
    invertido: esc.invertido,
    ambiente: amb,
    pendente: lerPendente(cfg)?.partida === m.pend.partida.id ? status(sql, cfg) : null,
  }
}

// ---------------------------------------------------------------- preparar e abrir

function lerPendente(cfg: ConfigPonte): PartidaPendente | null {
  return lerJson<PartidaPendente>(arquivoPendente(cfg))
}

/** Grava data/gerado/*.json e data/partida.json para a ponte; guarda a partida pendente na carreira. */
export function preparar(sql: Sql, cfg: ConfigPonte, modo: ModoWe): PartidaPendente {
  // Um evento esperando decisão travaria a confirmação do resultado depois do jogo.
  if (pendentes(sql) > 0) throw new ErroApp('evento_pendente', 'Há uma notícia esperando a sua decisão. Responda em Notícias antes do jogo.')
  const a = ARQ(cfg.raiz)
  const amb = ambiente(cfg)
  if (!amb.bat) throw new ErroApp('sem_ponte', `Não achei ${a.bat}.`)
  if (!amb.estados.includes('p1_cpu')) throw new ErroApp('sem_estado', 'Falta o estado base states/amistoso.sstate (P1 x CPU).')
  const modelo = lerJson<Record<string, unknown>>(a.modelo)
  if (!modelo) throw new ErroApp('sem_modelo', `Não achei ${a.modelo}.`)

  const m = montar(sql)
  const { partida, dados: d } = m.pend
  const esc = escolherControle(m.usuarioVisitante, new Set(amb.estados), modo)
  const regras = d.regras

  // Dados de cada jogador que o motor não guarda (altura, pé, aparência...).
  const extras = new Map(
    sql
      .all<InfoJogadorBanco>('SELECT id, nome_we, altura, pe, outside, aparencia FROM jogador WHERE time_id IN (SELECT id FROM time WHERE sigla IN (?, ?))', partida.casa, partida.visitante)
      .map((j) => [String(j.id), j]),
  )
  const exportar = (l: Lado): { time: TimeExportar; lado: LadoEscalado } => {
    const e = m.escalacoes[l]
    const ordem = [...e.titulares, ...e.reservas]
    const t = m.times[l]
    const jogadores: JogadorExportar[] = ordem.map((j) => {
      const x = extras.get(j.id)!
      return {
        id: j.id,
        nomeWe: x.nome_we,
        posicao: j.posicao,
        camisa: j.camisa,
        altura: x.altura,
        idade: j.idade,
        pe: x.pe,
        outside: !!x.outside,
        aparencia: x.aparencia ? (JSON.parse(x.aparencia) as Aparencia) : null,
        atributos: j.atributos as Atributos,
        condicao: j.condicao,
        moral: j.moral,
      }
    })
    const papeis = papeisDa(e.formacao)
    const bandeira = t.bandeira ? (JSON.parse(t.bandeira) as { arquivo?: string; ajuste?: string }) : null
    const arqBandeira = arquivoDaCarreira(cfg, bandeira?.arquivo)
    return {
      time: {
        sigla: t.sigla,
        nome: t.nome,
        nomeCurto: t.nome_curto,
        formacao: e.formacao,
        kit: kitComCaminho(cfg, t.kit),
        kitReserva: kitComCaminho(cfg, t.kit_reserva),
        bandeira: arqBandeira ? { arquivo: arqBandeira, ajuste: bandeira?.ajuste ?? 'esticar' } : null,
        jogadores,
      },
      lado: {
        ids: ordem.map((j) => j.id),
        posicoes: ordem.map((j, i) => (i < 11 ? (papeis[i] ?? j.posicao) : j.posicao)) as Posicao[],
        camisas: ordem.map((j) => j.camisa),
        perfis: ordem.map((j) => ({ idade: j.idade, resistencia: j.resistencia, fole: j.atributos.STA, condicao: j.condicao })),
      },
    }
  }
  const real = { casa: exportar('casa'), visitante: exportar('visitante') }
  const vagas = vagasDoJogo(real.casa, real.visitante, esc.invertido)
  const uniVaga = vagasDoJogo(m.uniformes.casa, m.uniformes.visitante, esc.invertido)

  mkdirSync(a.gerado, { recursive: true })
  gravarJson(join(a.gerado, 'casa.json'), timeParaPonte(vagas.vagaCasa.time, regras))
  gravarJson(join(a.gerado, 'visitante.json'), timeParaPonte(vagas.vagaVisitante.time, regras))

  const partidaWe = `${cfg.carreiraId}-${d.temporada}-${partida.id}`.replace(/[^\w-]/g, '_')
  gravarJson(a.partida, {
    ...modelo,
    versao: 2,
    partida_id: partidaWe,
    tipo: 'carreira',
    modo: m.precisaVencedor ? 'mata_mata' : 'pontos_corridos',
    controle: esc.controle,
    casa: { nome: vagas.vagaCasa.time.nome, id_we: ID_WE.casa, time: 'data/gerado/casa.json', uniforme: uniVaga.vagaCasa },
    visitante: { nome: vagas.vagaVisitante.time.nome, id_we: ID_WE.visitante, time: 'data/gerado/visitante.json', uniforme: uniVaga.vagaVisitante },
    edicoes: [],
    carreira: {
      partida: partida.id,
      mando_invertido: esc.invertido,
      competicao: m.pend.jogo.competicaoNome,
      fase: m.pend.jogo.faseNome,
    },
  })
  // O resultado da partida anterior não pode ser confundido com o desta.
  if (existsSync(a.resultado)) renameSync(a.resultado, a.resultadoAnterior)

  const pendente: PartidaPendente = {
    partida: partida.id,
    partidaWe,
    modo,
    controle: esc.controle,
    invertido: esc.invertido,
    precisaVencedor: m.precisaVencedor,
    penaltisNoManager: m.penaltisNoManager,
    nomes: { vagaCasa: vagas.vagaCasa.time.nome, vagaVisitante: vagas.vagaVisitante.time.nome },
    lados: { casa: real.casa.lado, visitante: real.visitante.lado },
    iniciadoEm: new Date().toISOString(),
  }
  gravarJson(arquivoPendente(cfg), pendente)
  return pendente
}

/** Abre o PCSX-Redux pelo run-pcsx.bat (que converte kits e bandeiras e carrega a ponte). */
export function abrirEmulador(cfg: ConfigPonte): void {
  if (process.platform !== 'win32') throw new ErroApp('so_windows', 'Abrir o emulador só funciona no Windows.')
  const filho = spawn('cmd.exe', ['/d', '/c', 'run-pcsx.bat'], {
    cwd: cfg.raiz,
    env: { ...process.env, WE_EMU: cfg.caminhos.emulador, WE_ISO: cfg.caminhos.imagem },
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  filho.on('error', () => undefined)
  filho.unref()
}

export function iniciar(sql: Sql, cfg: ConfigPonte, modo: ModoWe): StatusWe {
  preparar(sql, cfg, modo)
  abrirEmulador(cfg)
  return status(sql, cfg)
}

export function jogarDeNovo(sql: Sql, cfg: ConfigPonte): StatusWe {
  const p = lerPendente(cfg)
  if (!p) throw new ErroApp('sem_partida', 'Nenhuma partida no emulador.')
  return iniciar(sql, cfg, p.modo)
}

// ---------------------------------------------------------------- resultado

export function status(sql: Sql, cfg: ConfigPonte): StatusWe {
  const p = lerPendente(cfg)
  const vazio: StatusWe = {
    estado: 'sem_partida',
    partidaWe: null,
    jogo: null,
    controle: null,
    invertido: false,
    modo: null,
    placar: null,
    fase: null,
    gols: [],
    motivo: null,
    penaltisNoManager: false,
    iniciadoEm: null,
  }
  if (!p) return vazio
  const pend = jogoDoUsuarioPendente(sql)
  const base: StatusWe = {
    ...vazio,
    estado: 'aguardando',
    partidaWe: p.partidaWe,
    jogo: pend && pend.partida.id === p.partida ? pend.jogo : null,
    controle: p.controle,
    invertido: p.invertido,
    modo: p.modo,
    penaltisNoManager: p.penaltisNoManager,
    iniciadoEm: p.iniciadoEm,
  }
  const bruto = lerJson<unknown>(ARQ(cfg.raiz).resultado)
  if (!bruto) return base
  const r = normalizarResultado(bruto)
  if (!r) return { ...base, estado: 'invalido', motivo: 'resultado.json fora do formato esperado' }
  const c = conferir(r, { partidaId: p.partidaWe, vagaCasa: p.nomes.vagaCasa, vagaVisitante: p.nomes.vagaVisitante, precisaVencedor: p.precisaVencedor })
  if (!c.ok) return { ...base, estado: r.partidaId === p.partidaWe ? 'invalido' : 'aguardando', motivo: c.motivo }
  const real = desinverter(r, p.invertido)
  const nomeDe = (lado: Lado, vaga: number | null) => {
    const id = vaga !== null ? p.lados[lado].ids[vaga] : undefined
    return id ? (pend?.elencos.jogadores.get(id)?.nome ?? null) : null
  }
  return {
    ...base,
    estado: r.final ? 'final' : 'parcial',
    placar: {
      golsCasa: real.golsCasa,
      golsVisitante: real.golsVisitante,
      penaltisCasa: real.penaltis?.casa ?? null,
      penaltisVisitante: real.penaltis?.visitante ?? null,
      prorrogacao: real.prorrogacao,
    },
    fase: real.fase,
    gols: real.gols.map((g) => ({ lado: g.lado, minuto: g.minuto, autor: nomeDe(g.lado, g.vaga) ?? g.nome, assistencia: nomeDe(g.lado, g.assistVaga) ?? g.assistNome })),
  }
}

/** Confirma o resultado final do WE: entra na carreira (e a data é concluída com os outros jogos simulados). */
export function confirmar(sql: Sql, cfg: ConfigPonte, opcoes: { aceitarParcial?: boolean } = {}): ResultadoContinuar {
  const p = lerPendente(cfg)
  if (!p) throw new ErroApp('sem_partida', 'Nenhuma partida no emulador.')
  const st = status(sql, cfg)
  const lido = normalizarResultado(lerJson<unknown>(ARQ(cfg.raiz).resultado))
  if (st.estado === 'parcial' && opcoes.aceitarParcial && lido) {
    // A ponte não reconheceu o apito final: o usuário encerra com o placar que ela gravou.
    const c = aceitarParcial(lido, p.precisaVencedor)
    if (!c.ok) throw new ErroApp('parcial_invalido', `Não dá para encerrar com este placar: ${c.motivo}.`)
  } else if (st.estado !== 'final') {
    throw new ErroApp('sem_final', st.motivo ?? 'O resultado final ainda não chegou.')
  }
  const pend = jogoDoUsuarioPendente(sql)
  if (!pend || pend.partida.id !== p.partida) throw new ErroApp('partida_mudou', 'O jogo pendente não é mais o desta partida no emulador.')
  const real = desinverter(lido!, p.invertido)
  const resultado: Resultado = paraResultado(real, p.lados, pend.dados.regras)

  // Volta de ida e volta: agregado empatado → pênaltis decididos pelo manager (decisão 5).
  const mm = pend.ctx.mataMata
  if (mm && pend.partida.jogo === mm.regra.jogos && empatado([...mm.anteriores, { ...pend.partida, resultado }], mm.regra) && resultado.penaltisCasa === undefined) {
    const pk = penaltisDoManager(criarRng(pend.dados.semente).derivar('penaltis-we', pend.partida.id), pend.dados.regras)
    resultado.penaltisCasa = pk.casa
    resultado.penaltisVisitante = pk.visitante
  }

  const r = jogarDataDoUsuario(sql, { resultado, modo: p.modo === 'assistir' ? 'cpu_cpu_we' : 'we', origem: 'resultado.json' })
  // Cópia do resultado na carreira e fim da pendência.
  const destino = join(cfg.pastaCarreira, 'resultados')
  mkdirSync(destino, { recursive: true })
  copyFileSync(ARQ(cfg.raiz).resultado, join(destino, `${p.partidaWe}.json`))
  rmSync(arquivoPendente(cfg), { force: true })
  return r
}

export function descartar(cfg: ConfigPonte): void {
  rmSync(arquivoPendente(cfg), { force: true })
}

/** Placar digitado (fallback). Mata-mata decisivo empatado exige pênaltis. */
export function resultadoManual(
  sql: Sql,
  cfg: ConfigPonte,
  placar: { golsCasa: number; golsVisitante: number; penaltisCasa: number | null; penaltisVisitante: number | null },
): ResultadoContinuar {
  const pend = jogoDoUsuarioPendente(sql)
  if (!pend) throw new ErroApp('sem_jogo', 'Não há jogo do seu time na data atual.')
  const resultado: Resultado = { golsCasa: placar.golsCasa, golsVisitante: placar.golsVisitante }
  const mm = pend.ctx.mataMata
  if (mm && pend.partida.jogo === mm.regra.jogos && empatado([...mm.anteriores, { ...pend.partida, resultado }], mm.regra)) {
    if (placar.penaltisCasa === null || placar.penaltisVisitante === null || placar.penaltisCasa === placar.penaltisVisitante) {
      throw new ErroApp('precisa_penaltis', 'Confronto empatado: informe os pênaltis (com vencedor).')
    }
    resultado.penaltisCasa = placar.penaltisCasa
    resultado.penaltisVisitante = placar.penaltisVisitante
  }
  const r = jogarDataDoUsuario(sql, { resultado, modo: 'manual', origem: 'usuario' })
  descartar(cfg)
  return r
}

/** Simular o jogo do usuário pelo motor (escolha do pré-jogo ou fallback). */
export function simular(sql: Sql, cfg: ConfigPonte): ResultadoContinuar {
  const r = jogarDataDoUsuario(sql)
  descartar(cfg)
  return r
}
