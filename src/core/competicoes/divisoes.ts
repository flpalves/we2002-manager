import type { Competicao, CriterioDivisao, Divisoes, Fase, SaidaCompeticao } from '@shared/esquemas/pacote'
import { tamanhosDasFases } from './fases'
import { tamanhoDaCompeticao } from './vagas'

/**
 * Escada de divisões (`divisoes.json`, 03-competicoes): acesso e rebaixamento configurados
 * por par de divisões, com o mesmo número nos dois sentidos. Na criação da carreira a escada
 * vira as saídas (`acesso`/`rebaixamento`) e as zonas da tabela de cada competição; o motor
 * da virada continua lendo só as saídas.
 */

type Zona = NonNullable<Fase['zonas']>[number]

/** Nomes das zonas que a escada controla (as do pacote com esses nomes são substituídas). */
const ZONAS_DA_ESCADA = ['acesso', 'rebaixamento']

export const CRITERIO_PADRAO: CriterioDivisao = { criterio: 'posicao' }

/** Saída que escolhe os times de um lado da troca, pelo critério. */
export function saidaDoCriterio(criterio: CriterioDivisao, lado: 'primeiros' | 'ultimos', troca: number): Omit<SaidaCompeticao, 'destino' | 'tipo'> {
  switch (criterio.criterio) {
    case 'posicao':
      return { [lado]: troca }
    case 'fase':
      return { fase: criterio.fase, [lado]: troca }
    case 'grupo':
      return { por_grupo: { fase: criterio.fase, lado, n: criterio.por_grupo } }
  }
}

/** Saídas de acesso e rebaixamento que a escada gera, por competição. */
export function saidasDaEscada(divisoes: Divisoes): Map<string, SaidaCompeticao[]> {
  const saidas = new Map<string, SaidaCompeticao[]>()
  const add = (id: string, s: SaidaCompeticao) => saidas.set(id, [...(saidas.get(id) ?? []), s])
  divisoes.divisoes.forEach((baixo, i) => {
    const cima = divisoes.divisoes[i - 1]
    if (!cima || !baixo.troca) return
    add(cima.competicao, { ...saidaDoCriterio(baixo.descem ?? CRITERIO_PADRAO, 'ultimos', baixo.troca), destino: baixo.competicao, tipo: 'rebaixamento' })
    add(baixo.competicao, { ...saidaDoCriterio(baixo.sobem ?? CRITERIO_PADRAO, 'primeiros', baixo.troca), destino: cima.competicao, tipo: 'acesso' })
  })
  return saidas
}

const tamanhoInicial = (c: Competicao) => tamanhoDaCompeticao(c) ?? 0

/**
 * Zona que pinta na tabela quem sobe ou desce, quando o critério cabe numa tabela:
 * posição (topo da última fase ou fundo da 1ª, se forem pontos corridos) ou grupo.
 * Critério por fase não tem zona (quem passa é decidido em outra fase).
 */
export function zonaDoCriterio(c: Competicao, criterio: CriterioDivisao, lado: 'primeiros' | 'ultimos', troca: number): { fase: string; zona: Zona } | null {
  const zona = (de: number, ate: number): Zona =>
    lado === 'primeiros' ? { de, ate, nome: 'Acesso', cor: 'positivo' } : { de, ate, nome: 'Rebaixamento', cor: 'negativo' }
  if (criterio.criterio === 'grupo') {
    const f = c.fases.find((x) => x.id === criterio.fase)
    if (f?.formato !== 'grupos') return null
    const n = criterio.por_grupo
    return { fase: f.id, zona: lado === 'primeiros' ? zona(1, n) : zona(f.grupos.tamanho - n + 1, f.grupos.tamanho) }
  }
  if (criterio.criterio !== 'posicao') return null
  if (lado === 'primeiros') {
    const ultima = c.fases[c.fases.length - 1]
    return ultima?.formato === 'pontos_corridos' ? { fase: ultima.id, zona: zona(1, troca) } : null
  }
  const primeira = c.fases[0]
  const n = tamanhoInicial(c)
  if (primeira?.formato !== 'pontos_corridos' || n < troca) return null
  return { fase: primeira.id, zona: zona(n - troca + 1, n) }
}

/**
 * Competições com a escada aplicada: nas que estão na escada, as saídas de acesso e
 * rebaixamento e as zonas "Acesso"/"Rebaixamento" do pacote dão lugar às geradas.
 * As outras saídas (vagas) e zonas ficam como estão. Sem escada, devolve as competições.
 */
export function aplicarDivisoes(competicoes: readonly Competicao[], divisoes: Divisoes | null | undefined): Competicao[] {
  if (!divisoes?.divisoes.length) return [...competicoes]
  const naEscada = new Set(divisoes.divisoes.map((d) => d.competicao))
  const geradas = saidasDaEscada(divisoes)
  const porId = new Map(competicoes.map((c) => [c.id, c]))

  const zonas = new Map<string, { fase: string; zona: Zona }[]>()
  divisoes.divisoes.forEach((baixo, i) => {
    const cima = divisoes.divisoes[i - 1]
    if (!cima || !baixo.troca) return
    const cc = porId.get(cima.competicao)
    const cb = porId.get(baixo.competicao)
    const zc = cc && zonaDoCriterio(cc, baixo.descem ?? CRITERIO_PADRAO, 'ultimos', baixo.troca)
    const zb = cb && zonaDoCriterio(cb, baixo.sobem ?? CRITERIO_PADRAO, 'primeiros', baixo.troca)
    if (zc) zonas.set(cima.competicao, [...(zonas.get(cima.competicao) ?? []), zc])
    if (zb) zonas.set(baixo.competicao, [...(zonas.get(baixo.competicao) ?? []), zb])
  })

  return competicoes.map((c) => {
    if (!naEscada.has(c.id)) return c
    const saidas = [...(c.saidas ?? []).filter((s) => s.tipo !== 'acesso' && s.tipo !== 'rebaixamento'), ...(geradas.get(c.id) ?? [])]
    const fases = c.fases.map((f) => {
      const minhas = (zonas.get(c.id) ?? []).filter((z) => z.fase === f.id).map((z) => z.zona)
      const mantidas = (f.zonas ?? []).filter((z) => !ZONAS_DA_ESCADA.includes(z.nome.toLowerCase()))
      const todas = [...mantidas, ...minhas].sort((a, b) => a.de - b.de)
      const nova: Fase = { ...f, zonas: todas }
      if (!todas.length) delete nova.zonas
      return nova
    })
    const nova: Competicao = { ...c, fases, saidas }
    if (!saidas.length) delete nova.saidas
    return nova
  })
}

// ---------------------------------------------------------------- validação

export interface ProblemaDivisao {
  nivel: 'erro' | 'aviso'
  codigo: string
  mensagem: string
  competicao?: string
}

/** Quantos times o critério entrega (null = não dá para saber; erro = critério impossível). */
function conferirCriterio(c: Competicao, criterio: CriterioDivisao, troca: number, rotulo: string): string | null {
  const n = tamanhoInicial(c)
  if (criterio.criterio === 'posicao') return null
  const i = c.fases.findIndex((f) => f.id === criterio.fase)
  const f = c.fases[i]
  if (!f) return `${rotulo}: a fase "${criterio.fase}" não existe em ${c.nome}.`
  if (criterio.criterio === 'fase') {
    if (n < 2) return null
    let tamanho: number | undefined
    try {
      tamanho = tamanhosDasFases(c, n)[i]
    } catch {
      return null // fases que não fecham já viram erro na validação da competição
    }
    if (tamanho !== undefined && tamanho < troca) return `${rotulo}: a fase "${f.nome}" tem ${tamanho} times, menos que os ${troca} da troca.`
    return null
  }
  if (f.formato !== 'grupos') return `${rotulo}: a fase "${f.nome}" de ${c.nome} não é de grupos.`
  if (criterio.por_grupo > f.grupos.tamanho) return `${rotulo}: ${criterio.por_grupo} por grupo, mas os grupos de "${f.nome}" têm ${f.grupos.tamanho}.`
  const total = criterio.por_grupo * f.grupos.quantidade
  if (total !== troca) return `${rotulo}: ${criterio.por_grupo} por grupo × ${f.grupos.quantidade} grupos = ${total}, mas a troca é de ${troca}.`
  return null
}

export function validarDivisoes(divisoes: Divisoes, competicoes: readonly Competicao[]): ProblemaDivisao[] {
  const p: ProblemaDivisao[] = []
  const erro = (codigo: string, mensagem: string, competicao?: string) => p.push({ nivel: 'erro', codigo, mensagem, ...(competicao ? { competicao } : {}) })
  const aviso = (codigo: string, mensagem: string, competicao?: string) => p.push({ nivel: 'aviso', codigo, mensagem, ...(competicao ? { competicao } : {}) })
  const porId = new Map(competicoes.map((c) => [c.id, c]))
  const vistas = new Set<string>()

  divisoes.divisoes.forEach((d, i) => {
    const c = porId.get(d.competicao)
    const nome = c?.nome ?? d.competicao
    if (vistas.has(d.competicao)) erro('divisao_repetida', `Divisões: ${nome} aparece mais de uma vez na escada.`, d.competicao)
    vistas.add(d.competicao)
    if (!c) return void erro('divisao_inexistente', `Divisões: a competição "${d.competicao}" não existe.`)
    if (c.participantes.regra !== 'lista') erro('divisao_sem_lista', `Divisões: ${nome} precisa de participantes por "lista" para trocar times.`, c.id)
    if (i === 0) {
      if (d.troca || d.sobem || d.descem) aviso('divisao_topo', `Divisões: ${nome} é a 1ª divisão; troca e critérios dela são ignorados.`, c.id)
      return
    }
    const cima = porId.get(divisoes.divisoes[i - 1]!.competicao)
    if (!d.troca) return void erro('divisao_sem_troca', `Divisões: diga quantos times trocam entre ${cima?.nome ?? 'a divisão de cima'} e ${nome}.`, c.id)
    for (const [comp, rotulo] of [
      [cima, `Quem desce de ${cima?.nome}`],
      [c, `Quem sobe de ${nome}`],
    ] as const) {
      if (!comp) continue
      const n = tamanhoInicial(comp)
      if (n && d.troca >= n) erro('divisao_troca_grande', `Divisões: troca de ${d.troca} entre ${cima?.nome} e ${nome}, mas ${comp.nome} tem ${n} times.`, comp.id)
      const criterio = comp === c ? (d.sobem ?? CRITERIO_PADRAO) : (d.descem ?? CRITERIO_PADRAO)
      const problema = conferirCriterio(comp, criterio, d.troca, rotulo)
      if (problema) erro('divisao_criterio', `Divisões: ${problema}`, comp.id)
    }
  })

  for (const c of competicoes) {
    if (!vistas.has(c.id)) continue
    if ((c.saidas ?? []).some((s) => s.tipo === 'acesso' || s.tipo === 'rebaixamento')) {
      aviso('saida_substituida', `${c.nome}: as saídas de acesso/rebaixamento do arquivo da competição são substituídas pela escada de divisões.`, c.id)
    }
  }
  return p
}
