import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import type { z } from 'zod'
import { CatalogoSchema, type EventoCatalogo } from '@shared/esquemas/noticias'
import {
  CompeticaoSchema,
  DivisoesSchema,
  ManifestoSchema,
  PaisesSchema,
  RegrasArquivoSchema,
  TemporadaSchema,
  TimeSchema,
  type ArquivoInvalido,
  type Competicao,
  type Divisoes,
  type JanelaTransferencia,
  JanelaTransferenciaSchema,
  type Manifesto,
  type Pacote,
  type Temporada,
  type Time,
} from '@shared/esquemas/pacote'
import { descreverErroZod } from '@shared/esquemas/ipc'

/** Lê um JSON e passa pelo esquema; problemas viram `ArquivoInvalido` (nunca lança). */
function lerJson<S extends z.ZodType>(raiz: string, rel: string, esquema: S, invalidos: ArquivoInvalido[]): z.output<S> | null {
  const caminho = join(raiz, rel)
  if (!existsSync(caminho)) return null
  let bruto: unknown
  try {
    bruto = JSON.parse(readFileSync(caminho, 'utf8'))
  } catch (e) {
    invalidos.push({ arquivo: rel, mensagem: `JSON inválido: ${(e as Error).message}` })
    return null
  }
  const r = esquema.safeParse(bruto)
  if (!r.success) {
    invalidos.push({ arquivo: rel, mensagem: descreverErroZod(r.error) })
    return null
  }
  return r.data
}

function listar(pasta: string, extensao: string): string[] {
  if (!existsSync(pasta)) return []
  return readdirSync(pasta)
    .filter((f) => f.toLowerCase().endsWith(extensao))
    .sort()
}

function listarRecursivo(raiz: string, pasta: string): string[] {
  const base = join(raiz, pasta)
  if (!existsSync(base)) return []
  const saida: string[] = []
  const visitar = (dir: string) => {
    for (const nome of readdirSync(dir)) {
      const c = join(dir, nome)
      if (statSync(c).isDirectory()) visitar(c)
      else saida.push(relative(raiz, c).split(sep).join('/'))
    }
  }
  visitar(base)
  return saida.sort()
}

export function lerPacote(raiz: string): Pacote {
  const invalidos: ArquivoInvalido[] = []
  const manifesto = lerJson(raiz, 'manifesto.json', ManifestoSchema, invalidos)
  const regras = lerJson(raiz, 'regras.json', RegrasArquivoSchema, invalidos) ?? {}
  const paises = lerJson(raiz, 'paises.json', PaisesSchema, invalidos) ?? []
  const temporada = lerJson(raiz, 'temporada.json', TemporadaSchema, invalidos)
  const noticias = lerJson(raiz, 'noticias.json', CatalogoSchema, invalidos)
  const divisoes = lerJson(raiz, 'divisoes.json', DivisoesSchema, invalidos)

  const times: Time[] = []
  for (const arq of listar(join(raiz, 'times'), '.json')) {
    const rel = `times/${arq}`
    const t = lerJson(raiz, rel, TimeSchema, invalidos)
    if (!t) continue
    if (arq !== `${t.sigla}.json`) invalidos.push({ arquivo: rel, mensagem: `o arquivo deveria se chamar ${t.sigla}.json` })
    times.push(t)
  }

  const competicoes: Competicao[] = []
  for (const arq of listar(join(raiz, 'competicoes'), '.json')) {
    const rel = `competicoes/${arq}`
    const c = lerJson(raiz, rel, CompeticaoSchema, invalidos)
    if (!c) continue
    if (arq !== `${c.id}.json`) invalidos.push({ arquivo: rel, mensagem: `o arquivo deveria se chamar ${c.id}.json` })
    competicoes.push(c)
  }

  const escudos = listar(join(raiz, 'escudos'), '.png').map((f) => f.slice(0, -4))
  const arquivosKit = listarRecursivo(raiz, 'kits')

  return { manifesto, regras, temporada, divisoes, paises, times, competicoes, noticias, escudos, arquivosKit, invalidos }
}

/** Lista os pacotes (subpastas com manifesto.json) da pasta de pacotes. */
export function listarPacotes(pastaPacotes: string): { id: string; pasta: string; manifesto: Manifesto | null }[] {
  if (!existsSync(pastaPacotes)) return []
  return readdirSync(pastaPacotes)
    .filter((nome) => existsSync(join(pastaPacotes, nome, 'manifesto.json')))
    .sort()
    .map((nome) => {
      const invalidos: ArquivoInvalido[] = []
      const pasta = join(pastaPacotes, nome)
      return { id: nome, pasta, manifesto: lerJson(pasta, 'manifesto.json', ManifestoSchema, invalidos) }
    })
}

/** Gravação atômica de JSON (arquivo temporário + rename). */
export function gravarJson(caminho: string, dados: unknown): void {
  mkdirSync(dirname(caminho), { recursive: true })
  const tmp = `${caminho}.tmp`
  writeFileSync(tmp, `${JSON.stringify(dados, null, 2)}\n`, 'utf8')
  renameSync(tmp, caminho)
}

export function salvarTime(raiz: string, time: Time, siglaAnterior?: string): void {
  const valido = TimeSchema.parse(time)
  gravarJson(join(raiz, 'times', `${valido.sigla}.json`), valido)
  if (siglaAnterior && siglaAnterior !== valido.sigla) {
    rmSync(join(raiz, 'times', `${siglaAnterior}.json`), { force: true })
    const escudoAntigo = join(raiz, 'escudos', `${siglaAnterior}.png`)
    if (existsSync(escudoAntigo)) renameSync(escudoAntigo, join(raiz, 'escudos', `${valido.sigla}.png`))
  }
}

export function removerTime(raiz: string, sigla: string): void {
  rmSync(join(raiz, 'times', `${sigla}.json`), { force: true })
}

export function salvarCompeticao(raiz: string, competicao: Competicao, idAnterior?: string): void {
  const valida = CompeticaoSchema.parse(competicao)
  gravarJson(join(raiz, 'competicoes', `${valida.id}.json`), valida)
  if (idAnterior && idAnterior !== valida.id) rmSync(join(raiz, 'competicoes', `${idAnterior}.json`), { force: true })
}

/**
 * Grava as janelas de transferência em `regras.json` (`mercado.janelas`), mantendo o resto do
 * arquivo. `null` tira a chave (volta ao padrão do jogo).
 */
export function salvarJanelas(raiz: string, janelas: JanelaTransferencia[] | null): void {
  alterarRegra(raiz, 'mercado', 'janelas', janelas ? janelas.map((j) => JanelaTransferenciaSchema.parse(j)) : undefined)
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Troca `secao.chave` do `regras.json` mantendo o resto do arquivo; `undefined` tira a chave
 * (e a seção, se ficar vazia), o que devolve o valor ao padrão do jogo.
 */
function alterarRegra(raiz: string, secao: string, chave: string, valor: unknown): void {
  const caminho = join(raiz, 'regras.json')
  let regras: Record<string, unknown> = {}
  if (existsSync(caminho)) {
    const bruto: unknown = JSON.parse(readFileSync(caminho, 'utf8'))
    if (ehObjeto(bruto)) regras = bruto
  }
  const atual = regras[secao]
  const dados: Record<string, unknown> = ehObjeto(atual) ? { ...atual } : {}
  if (valor !== undefined) dados[chave] = valor
  else delete dados[chave]
  if (Object.keys(dados).length) regras[secao] = dados
  else delete regras[secao]
  gravarJson(caminho, regras)
}

/**
 * Grava o `temporada.json` (blocos das competições) e a duração da temporada no `regras.json`
 * (`temporada.semanas_por_temporada`); `semanas` null volta a duração ao padrão do jogo.
 */
export function salvarTemporada(raiz: string, temporada: Temporada, semanas: number | null): void {
  const valida = TemporadaSchema.parse(temporada)
  if (semanas !== null && (!Number.isInteger(semanas) || semanas < 1)) throw new Error('Duração da temporada inválida.')
  gravarJson(join(raiz, 'temporada.json'), valida)
  alterarRegra(raiz, 'temporada', 'semanas_por_temporada', semanas ?? undefined)
}

/** Grava a escada de divisões; lista vazia apaga o arquivo. */
export function salvarDivisoes(raiz: string, divisoes: Divisoes): void {
  const validas = DivisoesSchema.parse(divisoes)
  const caminho = join(raiz, 'divisoes.json')
  if (validas.divisoes.length) gravarJson(caminho, validas)
  else rmSync(caminho, { force: true })
}

/** Regras gerais dos eventos (`regras.json`, `noticias`); null em cada uma volta ao padrão do jogo. */
export interface RegrasNoticiasArquivo {
  fator_chance: number | null
  maximo_por_avaliacao: number | null
}

/**
 * Grava o catálogo de eventos (`noticias.json`) e as regras gerais dos eventos no `regras.json`.
 * Catálogo `null` apaga o arquivo (o pacote volta a usar o catálogo padrão do jogo).
 */
export function salvarNoticias(raiz: string, catalogo: EventoCatalogo[] | null, regras: RegrasNoticiasArquivo): void {
  const fator = regras.fator_chance
  const maximo = regras.maximo_por_avaliacao
  if (fator !== null && !(Number.isFinite(fator) && fator >= 0 && fator <= 10)) throw new Error('Fator de chance precisa ficar entre 0 e 10.')
  if (maximo !== null && !(Number.isInteger(maximo) && maximo >= 1 && maximo <= 10)) throw new Error('Máximo de eventos por avaliação precisa ser um inteiro de 1 a 10.')
  const caminho = join(raiz, 'noticias.json')
  if (catalogo) gravarJson(caminho, CatalogoSchema.parse(catalogo))
  else rmSync(caminho, { force: true })
  alterarRegra(raiz, 'noticias', 'fator_chance', fator ?? undefined)
  alterarRegra(raiz, 'noticias', 'maximo_por_avaliacao', maximo ?? undefined)
}

export function removerCompeticao(raiz: string, id: string): void {
  rmSync(join(raiz, 'competicoes', `${id}.json`), { force: true })
}

const ASSINATURA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Copia um PNG escolhido pelo usuário para `escudos/<SIGLA>.png`. */
export function importarEscudo(raiz: string, sigla: string, origem: string): void {
  const cabecalho = readFileSync(origem).subarray(0, 8)
  if (!cabecalho.equals(ASSINATURA_PNG)) throw new Error('O arquivo escolhido não é um PNG.')
  const destino = join(raiz, 'escudos', `${sigla}.png`)
  mkdirSync(dirname(destino), { recursive: true })
  copyFileSync(origem, destino)
}
