/**
 * Regras do editor visual de fases e saídas (aba Competições do editor de pacote):
 * fase nova com padrões sensatos, troca de formato, encadeamento, renomear/remover fase
 * mantendo as referências, e o resumo "quantos entram, quantos saem, quantas rodadas".
 * Puro: o renderer só chama estas funções.
 */
import type { Competicao, Fase, SaidaCompeticao } from '@shared/esquemas/pacote'
import { quantidadeRodadas } from '../competicoes/rodadas'

export type FormatoFase = Fase['formato']
export type CriterioDesempate = NonNullable<Fase['desempate']>[number]

export const DESEMPATE_PADRAO: CriterioDesempate[] = ['pontos', 'vitorias', 'saldo', 'gols_pro', 'confronto_direto', 'menos_vermelhos', 'menos_amarelos', 'sorteio']

export const ROTULO_FORMATO: Record<FormatoFase, string> = { pontos_corridos: 'Pontos corridos', grupos: 'Grupos', mata_mata: 'Mata-mata' }

export const ROTULO_DESEMPATE: Record<CriterioDesempate, string> = {
  pontos: 'Pontos',
  vitorias: 'Vitórias',
  saldo: 'Saldo de gols',
  gols_pro: 'Gols pró',
  confronto_direto: 'Confronto direto',
  menos_vermelhos: 'Menos vermelhos',
  menos_amarelos: 'Menos amarelos',
  sorteio: 'Sorteio',
}

export interface ResumoFase {
  /** Times que entram na fase (null = participantes desconhecidos). */
  entram: number | null
  saem: number | null
  /** Rodadas (datas) que a fase ocupa no calendário. */
  rodadas: number | null
  /** O que impede a fase de fechar a conta (mesma mensagem da validação do pacote). */
  problema: string | null
}

const ehPotenciaDe2 = (n: number) => n >= 1 && (n & (n - 1)) === 0

/** Etapas de chave de n até saem (null se a conta não fecha). */
function etapasMataMata(n: number, saem: number): number | null {
  let etapas = 0
  while (n > saem && n % 2 === 0) {
    n /= 2
    etapas++
  }
  return n === saem ? etapas : null
}

/** Fase a fase: quantos entram, quantos saem, quantas rodadas e o primeiro problema da conta. */
export function resumirFases(c: Pick<Competicao, 'fases'>, participantes: number | null): ResumoFase[] {
  const resumos: ResumoFase[] = []
  let n: number | null = participantes
  let quebrou = false
  c.fases.forEach((f, i) => {
    const ultima = i === c.fases.length - 1
    const entram = quebrou ? null : n
    let saem: number | null = null
    let rodadas: number | null = null
    let problema: string | null = null
    if (f.formato === 'grupos') {
      const g = f.grupos
      saem = g.quantidade * g.classificam
      rodadas = quantidadeRodadas(g.tamanho, g.turnos)
      if (entram !== null && entram !== g.quantidade * g.tamanho) problema = `${f.nome} pede ${g.quantidade * g.tamanho} times e recebe ${entram}.`
      else if (g.classificam > g.tamanho) problema = `${f.nome} classifica ${g.classificam} por grupo de ${g.tamanho}.`
    } else if (f.formato === 'pontos_corridos') {
      if (entram !== null) {
        saem = f.pontos_corridos.classificam ?? (ultima ? 1 : entram)
        rodadas = quantidadeRodadas(entram, f.pontos_corridos.turnos)
        if (saem > entram) problema = `${f.nome} classifica ${saem} de ${entram} times.`
      } else saem = f.pontos_corridos.classificam ?? (ultima ? 1 : null)
    } else if (entram !== null) {
      saem = f.mata_mata.classificam ?? (ultima ? 1 : entram / 2)
      const etapas = etapasMataMata(entram, saem)
      if (etapas === null) problema = `${f.nome}: mata-mata de ${entram} times não chega a ${saem}.`
      else rodadas = etapas * f.mata_mata.jogos
    } else saem = f.mata_mata.classificam ?? (ultima ? 1 : null)
    if (problema) quebrou = true
    resumos.push({ entram, saem: problema ? null : saem, rodadas: problema ? null : rodadas, problema })
    n = saem
  })
  return resumos
}

/** Nome da etapa do mata-mata pelo número de times nela ("Oitavas", "Final"...). */
export function nomeEtapa(times: number): string {
  if (times === 2) return 'Final'
  if (times === 4) return 'Semifinal'
  if (times === 8) return 'Quartas'
  if (times === 16) return 'Oitavas'
  return `${times} times`
}

/** Etapas de um mata-mata de `entram` até `saem` ("Quartas → Semifinal → Final"). */
export function etapasDoMataMata(entram: number, saem: number): string[] {
  const etapas: string[] = []
  let n = entram
  while (n > saem && n % 2 === 0) {
    etapas.push(nomeEtapa(n))
    n /= 2
  }
  return etapas
}

/** Id livre a partir de uma base ("f2", "f2-2"...). */
export function idLivre(base: string, usados: Iterable<string>): string {
  const u = new Set(usados)
  if (!u.has(base)) return base
  let i = 2
  while (u.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

/** Formato-padrão de uma fase que recebe `entram` times (null = desconhecido). */
function corpoDoFormato(formato: FormatoFase, entram: number | null, ultima: boolean): Pick<Fase, 'formato'> & Record<string, unknown> {
  if (formato === 'pontos_corridos') {
    return { formato, pontos_corridos: { turnos: 2, ...(!ultima && entram && entram > 2 && { classificam: Math.min(8, Math.floor(entram / 2)) }) } }
  }
  if (formato === 'grupos') {
    // Grupos de 4 quando dá; senão 2 grupos com metade cada.
    const n = entram ?? 8
    const tamanho = n % 4 === 0 ? 4 : n % 2 === 0 ? n / 2 : 4
    const quantidade = Math.max(1, Math.floor(n / tamanho))
    return { formato, grupos: { quantidade, tamanho, turnos: 2, sorteio: 'potes', classificam: Math.min(2, tamanho - 1) } }
  }
  return {
    formato,
    mata_mata: { jogos: 2, gol_fora: false, prorrogacao: false, penaltis: true, mando: 'melhor_campanha', ...(!ultima && entram && ehPotenciaDe2(entram) && entram > 2 && { classificam: entram / 2 }) },
  }
}

/** Fase nova no fim da lista, com padrões que fecham a conta com o que a fase anterior entrega. */
export function faseNova(c: Pick<Competicao, 'fases'>, formato: FormatoFase, participantes: number | null): Fase {
  const resumos = resumirFases(c, participantes)
  const entram = c.fases.length ? (resumos[resumos.length - 1]?.saem ?? null) : participantes
  const id = idLivre(`f${c.fases.length + 1}`, c.fases.map((f) => f.id))
  const etapa = formato === 'mata_mata' && entram ? nomeEtapa(entram) : null
  const nome = etapa && etapa !== `${entram} times` ? etapa : `${c.fases.length + 1}ª fase`
  const fase = { id, nome, ...corpoDoFormato(formato, entram, true) } as Fase
  if (formato !== 'mata_mata') fase.desempate = [...DESEMPATE_PADRAO]
  return fase
}

/** Troca o formato mantendo id, nome, desempate, zonas e encadeamento. */
export function trocarFormato(fase: Fase, formato: FormatoFase, entram: number | null, ultima: boolean): Fase {
  if (fase.formato === formato) return fase
  const { id, nome, entram: e, classificam_para, desempate, zonas } = fase
  const nova = { id, nome, ...corpoDoFormato(formato, entram, ultima) } as Fase
  if (e) nova.entram = e
  if (classificam_para) nova.classificam_para = classificam_para
  if (formato !== 'mata_mata') {
    nova.desempate = desempate ?? [...DESEMPATE_PADRAO]
    if (zonas?.length) nova.zonas = zonas
  }
  return nova
}

/**
 * Liga cada fase à seguinte (`classificam_para`) e tira da última. O motor segue a ordem da
 * lista; o campo fica para a validação e para quem lê o arquivo. Uma fase de pontos corridos
 * que passa a ter próxima fase ganha `classificam` (obrigatório nesse caso).
 */
export function encadear(fases: Fase[], participantes: number | null = null): Fase[] {
  return fases.map((f, i) => {
    const proxima = fases[i + 1]
    const r: Fase = { ...f }
    if (proxima) r.classificam_para = proxima.id
    else delete r.classificam_para
    if (r.formato === 'pontos_corridos' && proxima && !r.pontos_corridos.classificam) {
      const entram = resumirFases({ fases: fases.slice(0, i + 1) }, participantes)[i]?.entram
      r.pontos_corridos = { ...r.pontos_corridos, classificam: entram ? Math.max(1, Math.floor(entram / 2)) : 4 }
    }
    return r
  })
}

/** Troca o id de uma fase em tudo que a cita (encadeamento, saídas, suspensão, premiação). */
export function renomearFase(c: Competicao, antigo: string, novo: string): Competicao {
  if (antigo === novo) return c
  const troca = (id: string | undefined) => (id === antigo ? novo : id)
  const r: Competicao = {
    ...c,
    fases: c.fases.map((f) => {
      const g = { ...f, id: troca(f.id)! }
      if (f.classificam_para) g.classificam_para = troca(f.classificam_para)!
      return g
    }),
  }
  if (c.saidas) {
    r.saidas = c.saidas.map((s) => {
      const t: SaidaCompeticao = { ...s }
      if (s.fase) t.fase = troca(s.fase)!
      if (s.por_grupo) t.por_grupo = { ...s.por_grupo, fase: troca(s.por_grupo.fase)! }
      return t
    })
  }
  if (c.suspensao?.zera_na_fase === antigo) r.suspensao = { ...c.suspensao, zera_na_fase: novo }
  const porFase = c.premiacao?.por_fase
  if (porFase && antigo in porFase) {
    r.premiacao = { ...c.premiacao, por_fase: Object.fromEntries(Object.entries(porFase).map(([k, v]) => [k === antigo ? novo : k, v])) }
  }
  return r
}

/** Quais saídas citam a fase (para avisar antes de remover). */
export function saidasQueCitam(c: Pick<Competicao, 'saidas'>, fase: string): SaidaCompeticao[] {
  return (c.saidas ?? []).filter((s) => s.fase === fase || s.por_grupo?.fase === fase)
}

/** Remove a fase i, religa as outras e tira das saídas a referência (a saída por grupo some). */
export function removerFase(c: Competicao, i: number, participantes: number | null = null): Competicao {
  const fase = c.fases[i]
  if (!fase || c.fases.length <= 1) return c
  const r: Competicao = { ...c, fases: encadear(c.fases.filter((_, j) => j !== i), participantes) }
  if (c.saidas) {
    const saidas = c.saidas
      .filter((s) => s.por_grupo?.fase !== fase.id)
      .map((s) => {
        if (s.fase !== fase.id) return s
        const resto = { ...s }
        delete resto.fase
        return resto
      })
    if (saidas.length) r.saidas = saidas
    else delete r.saidas
  }
  if (c.suspensao?.zera_na_fase === fase.id) r.suspensao = { ...c.suspensao, zera_na_fase: null }
  return r
}

/** Move a fase i uma posição (passo -1 sobe, 1 desce) e religa. */
export function moverFase(fases: Fase[], i: number, passo: -1 | 1, participantes: number | null = null): Fase[] {
  const j = i + passo
  if (j < 0 || j >= fases.length) return fases
  const l = [...fases]
  ;[l[i], l[j]] = [l[j]!, l[i]!]
  return encadear(l, participantes)
}

// ---------------------------------------------------------------- saídas

export type ModoSaida = 'campeao' | 'posicoes' | 'primeiros' | 'ultimos' | 'por_grupo'

export const ROTULO_MODO_SAIDA: Record<ModoSaida, string> = {
  campeao: 'Campeão',
  posicoes: 'Posições',
  primeiros: 'Primeiros',
  ultimos: 'Últimos',
  por_grupo: 'Por grupo',
}

export function modoDaSaida(s: SaidaCompeticao): ModoSaida {
  if (s.campeao) return 'campeao'
  if (s.por_grupo) return 'por_grupo'
  if (s.posicoes) return 'posicoes'
  if (s.ultimos) return 'ultimos'
  return 'primeiros'
}

/** Mesma saída (destino e tipo) com outro jeito de escolher os times. */
export function trocarModoSaida(s: SaidaCompeticao, modo: ModoSaida, c: Pick<Competicao, 'fases'>): SaidaCompeticao {
  const base: SaidaCompeticao = { destino: s.destino, ...(s.tipo && { tipo: s.tipo }) }
  const pulo = s.exceto_de?.length ? { exceto_de: s.exceto_de } : {}
  if (modo === 'campeao') return { campeao: true, ...pulo, ...base }
  if (modo === 'posicoes') return { posicoes: s.posicoes ?? '1-4', ...pulo, ...base }
  if (modo === 'primeiros') return { primeiros: s.primeiros ?? s.ultimos ?? 4, ...(s.exceto_de?.length && { exceto_de: s.exceto_de }), ...base }
  if (modo === 'ultimos') return { ultimos: s.ultimos ?? s.primeiros ?? 4, ...base }
  const fase = c.fases.find((f) => f.formato === 'grupos') ?? c.fases[0]
  return { por_grupo: { fase: fase?.id ?? '', lado: 'primeiros', n: 1 }, ...base }
}

/** "1-4" → [1, 4]; "3" → [3, 3]; inválido → null. */
export function lerPosicoes(texto: string): [number, number] | null {
  const m = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(texto)
  if (!m) return null
  const de = Number(m[1])
  const ate = m[2] ? Number(m[2]) : de
  return de >= 1 && ate >= de ? [de, ate] : null
}

/** Frase em português do que a saída faz. */
export function descreverSaida(s: SaidaCompeticao, c: Pick<Competicao, 'fases'>, nomeCompeticao: (id: string) => string = (id) => id): string {
  const destino = nomeCompeticao(s.destino) || '?'
  const fase = (id: string) => c.fases.find((f) => f.id === id)?.nome ?? id
  const tipo = s.tipo ?? 'vaga'
  const acao = (plural: boolean) => {
    if (tipo === 'acesso') return `${plural ? 'sobem' : 'sobe'} para ${destino}`
    if (tipo === 'rebaixamento') return `${plural ? 'caem' : 'cai'} para ${destino}`
    return `${plural ? 'vão' : 'vai'} para ${destino} (${tipo})`
  }
  const modo = modoDaSaida(s)
  const pula = s.exceto_de?.length ? ` (pulando quem joga ${s.exceto_de.map(nomeCompeticao).join(', ')}; a vaga desce)` : ''
  if (modo === 'campeao') return `O campeão ${acao(false)}${pula}.`
  if (modo === 'posicoes') {
    const p = lerPosicoes(s.posicoes ?? '')
    if (!p) return `Posições "${s.posicoes ?? ''}" inválidas (use 1-4 ou 3).`
    return p[0] === p[1] ? `O ${p[0]}º colocado ${acao(false)}${pula}.` : `Do ${p[0]}º ao ${p[1]}º ${acao(true)}${pula}.`
  }
  if (modo === 'por_grupo') {
    const g = s.por_grupo!
    const um = g.n === 1
    return `${um ? 'O' : `Os ${g.n}`} ${g.lado === 'primeiros' ? (um ? 'primeiro' : 'primeiros') : um ? 'último' : 'últimos'} de cada grupo de "${fase(g.fase)}" ${acao(!um)}.`
  }
  const n = (modo === 'primeiros' ? s.primeiros : s.ultimos) ?? 0
  if (modo === 'primeiros' && s.exceto_de?.length) {
    const pula = s.exceto_de.map(nomeCompeticao).join(', ')
    const onde = s.fase ? `entre quem jogou "${fase(s.fase)}"` : 'na classificação final'
    return `${n === 1 ? 'O melhor' : `Os ${n} melhores`} ${onde}, pulando quem joga ${pula} na próxima temporada ou já está em ${destino}, ${acao(n !== 1)}.`
  }
  if (s.fase) return `Entre quem jogou "${fase(s.fase)}", ${n === 1 ? 'o' : `os ${n}`} ${modo === 'primeiros' ? (n === 1 ? 'melhor' : 'melhores') : n === 1 ? 'pior' : 'piores'} ${acao(n !== 1)}.`
  return `${n === 1 ? 'O' : `Os ${n}`} ${modo === 'primeiros' ? (n === 1 ? 'primeiro' : 'primeiros') : n === 1 ? 'último' : 'últimos'} da classificação final ${acao(n !== 1)}.`
}

// ---------------------------------------------------------------- vagas de uma competição por vagas (Série D)

const ehVagaPara = (s: SaidaCompeticao, destino: string) => s.destino === destino && !['acesso', 'rebaixamento'].includes(s.tipo ?? 'vaga')

/** Quantas vagas `origem` dá para `destino` (soma de "primeiros"; campeão e posições também contam). */
export function vagasDaOrigem(origem: Pick<Competicao, 'saidas'>, destino: string): number {
  let n = 0
  for (const s of origem.saidas ?? []) {
    if (!ehVagaPara(s, destino)) continue
    if (s.primeiros) n += s.primeiros
    if (s.campeao) n += 1
    const p = s.posicoes ? lerPosicoes(s.posicoes) : null
    if (p) n += p[1] - p[0] + 1
  }
  return n
}

/** Sugestão de "pular quem joga" para uma competição por vagas: as nacionais por lista que não são por vagas. */
export function excetoPadrao(competicoes: readonly Competicao[], destino: string): string[] {
  return competicoes.filter((c) => c.id !== destino && c.tipo === 'nacional' && c.participantes.regra === 'lista' && !c.participantes.por_vagas).map((c) => c.id)
}

/**
 * A origem com `n` vagas para `destino` ("os N melhores"; quem é pulado é regra do destino,
 * `pula_quem_joga`): troca as saídas de vaga para o destino por uma só (0 = tira). Mantém a fase,
 * o tipo e o `exceto_de` de uma vaga "primeiros" que já existia.
 */
export function definirVagasDaOrigem(origem: Competicao, destino: string, n: number): Competicao {
  const atuais = (origem.saidas ?? []).filter((s) => ehVagaPara(s, destino))
  const antiga = atuais.find((s) => s.primeiros)
  const outras = (origem.saidas ?? []).filter((s) => !ehVagaPara(s, destino))
  const nova: SaidaCompeticao | null =
    n > 0
      ? {
          primeiros: n,
          ...(antiga?.fase && { fase: antiga.fase }),
          destino,
          ...(antiga?.exceto_de?.length && { exceto_de: [...antiga.exceto_de] }),
          ...(antiga?.tipo && { tipo: antiga.tipo }),
        }
      : null
  const saidas = nova ? [...outras, nova] : outras
  const r: Competicao = { ...origem, saidas }
  if (!saidas.length) delete r.saidas
  return r
}

/** Competições que a origem pula na(s) própria(s) saída(s) para `destino` (`exceto_de`). */
export function puloDaOrigem(origem: Pick<Competicao, 'saidas'>, destino: string): string[] {
  return [...new Set((origem.saidas ?? []).filter((s) => ehVagaPara(s, destino)).flatMap((s) => s.exceto_de ?? []))]
}

/** A origem sem o pulo próprio nas saídas para `destino` (quando a regra passa para o destino). */
export function tirarPuloDaOrigem(origem: Competicao, destino: string): Competicao {
  return {
    ...origem,
    saidas: (origem.saidas ?? []).map((s) => {
      if (!ehVagaPara(s, destino) || !s.exceto_de) return s
      const resto = { ...s }
      delete resto.exceto_de
      return resto
    }),
  }
}
