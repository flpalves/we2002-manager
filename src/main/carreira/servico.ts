import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { ErroImportacao, prepararCarreira, type Dificuldade } from '@core/pacote/importar'
import { slug } from '@core/texto'
import { lerPacote } from '../pacote/leitor'
import { gravarCarreiraNova, lerResumo, type LinhaResumo } from '../db/repositorios/carreira'
import type { Sql } from '../db/sql'
import { ErroApp } from '../ipc/registrar'
import { garantirTemporada } from './temporada'
import { ErroCalendario } from '@core/competicoes/calendario'
import type { Autosave, ResumoCarreira } from '@shared/esquemas/carreira'
import { arquivoAutosave, fazerAutosave, listarAutosaves, PASTA_AUTOSAVE } from './autosave'

export const ARQUIVO_BANCO = 'carreira.sqlite'

/** Conexão aberta: o main usa better-sqlite3; os testes, node:sqlite. */
export interface ConexaoCarreira {
  sql: Sql
  versaoEsquema: number
  fechar(): void
}

export interface DependenciasCarreiras {
  pastaCarreiras: () => string
  pastaPacotes: () => string
  /** Abre (criando e migrando, se preciso) o banco de uma carreira. */
  abrirBanco: (arquivo: string) => ConexaoCarreira
  /** Abre só para ler o resumo (sem migrar); `null` se não der para ler. */
  lerResumoArquivo: (arquivo: string) => LinhaResumo | null
  /** Fonte de entropia e relógio (ficam fora do núcleo). */
  sementeNova: () => number
  agora: () => string
  sufixoId: () => string
}

export interface EntradaCarreiraNova {
  pacote: string
  time: string
  tecnico: string
  nome: string
  dificuldade: Dificuldade
}

function dentroDe(base: string, alvo: string): boolean {
  const b = resolve(base) + sep
  return resolve(alvo).startsWith(b)
}

export function paraResumo(l: LinhaResumo, ultimoAutosave: Autosave | null = null): ResumoCarreira {
  let cores: string[] = []
  try {
    cores = JSON.parse(l.cores) as string[]
  } catch {
    cores = []
  }
  return {
    id: l.id,
    nome: l.nome,
    tecnico: l.tecnico_nome,
    pacote: l.pacote_id,
    dificuldade: l.dificuldade,
    temporada: l.temporada_atual,
    semana: l.semana_atual,
    criadaEm: l.criada_em,
    saldo: l.saldo,
    time: { sigla: l.sigla, nome: l.time_nome, cores, escudo: l.escudo },
    ultimoAutosave,
  }
}

export class Carreiras {
  private aberta: { id: string; conexao: ConexaoCarreira } | null = null

  constructor(private readonly dep: DependenciasCarreiras) {}

  private pastaDa(id: string): string {
    const raiz = this.dep.pastaCarreiras()
    const pasta = join(raiz, id)
    if (!/^[a-z0-9-]+$/.test(id) || !dentroDe(raiz, pasta)) throw new ErroApp('carreira_invalida', `Carreira inválida: ${id}`)
    return pasta
  }

  pastaPacote(id: string): string {
    const raiz = this.dep.pastaPacotes()
    const pasta = join(raiz, id)
    if (!/^[a-z0-9-]+$/.test(id) || !dentroDe(raiz, pasta) || !existsSync(join(pasta, 'manifesto.json'))) {
      throw new ErroApp('pacote_inexistente', `Pacote não encontrado: ${id}`)
    }
    return pasta
  }

  listar(): ResumoCarreira[] {
    const raiz = this.dep.pastaCarreiras()
    if (!existsSync(raiz)) return []
    const saida: ResumoCarreira[] = []
    for (const nome of readdirSync(raiz)) {
      const arquivo = join(raiz, nome, ARQUIVO_BANCO)
      if (!existsSync(arquivo)) continue
      const linha = this.aberta?.id === nome ? (lerResumo(this.aberta.conexao.sql) ?? null) : this.dep.lerResumoArquivo(arquivo)
      if (linha) saida.push(paraResumo(linha, listarAutosaves(join(raiz, nome))[0] ?? null))
    }
    return saida.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))
  }

  criar(entrada: EntradaCarreiraNova): ResumoCarreira {
    const pacote = lerPacote(this.pastaPacote(entrada.pacote))
    const base = slug(entrada.nome) || slug(`${entrada.time}-${pacote.manifesto?.temporada_inicial ?? ''}`) || 'carreira'
    const id = `${base.slice(0, 40)}-${this.dep.sufixoId()}`
    const pasta = this.pastaDa(id)
    if (existsSync(pasta)) throw new ErroApp('carreira_existe', 'Já existe uma carreira com esse identificador; tente de novo.')

    let dados
    try {
      dados = prepararCarreira(pacote, { ...entrada, id, semente: this.dep.sementeNova(), criadaEm: this.dep.agora() })
    } catch (e) {
      if (e instanceof ErroImportacao) throw new ErroApp('pacote_com_erros', e.message)
      throw e
    }

    mkdirSync(pasta, { recursive: true })
    let conexao: ConexaoCarreira | null = null
    try {
      const raizPacote = this.pastaPacote(entrada.pacote)
      for (const [origem, destino] of dados.arquivos) {
        const de = join(raizPacote, origem)
        const para = join(pasta, destino)
        if (!dentroDe(raizPacote, de) || !dentroDe(pasta, para)) throw new Error(`Caminho fora do pacote: ${origem}`)
        if (!existsSync(de)) continue
        mkdirSync(dirname(para), { recursive: true })
        copyFileSync(de, para)
      }
      conexao = this.dep.abrirBanco(join(pasta, ARQUIVO_BANCO))
      gravarCarreiraNova(conexao.sql, dados, conexao.versaoEsquema)
      garantirTemporada(conexao.sql)
    } catch (e) {
      conexao?.fechar()
      conexao = null
      rmSync(pasta, { recursive: true, force: true })
      if (e instanceof ErroCalendario) throw new ErroApp('calendario_invalido', `Não foi possível montar o calendário: ${e.message}`)
      throw e
    }
    this.fechar()
    this.aberta = { id, conexao }
    return this.resumoAtual() as ResumoCarreira
  }

  abrir(id: string): ResumoCarreira {
    if (this.aberta?.id === id) return this.resumoAtual() as ResumoCarreira
    const arquivo = join(this.pastaDa(id), ARQUIVO_BANCO)
    if (!existsSync(arquivo)) throw new ErroApp('carreira_inexistente', 'Carreira não encontrada.')
    const conexao = this.dep.abrirBanco(arquivo)
    try {
      garantirTemporada(conexao.sql)
    } catch (e) {
      conexao.fechar()
      if (e instanceof ErroCalendario) throw new ErroApp('calendario_invalido', `Não foi possível montar o calendário: ${e.message}`)
      throw e
    }
    this.fechar()
    this.aberta = { id, conexao }
    const r = this.resumoAtual()
    if (!r) {
      this.fechar()
      throw new ErroApp('carreira_corrompida', 'Não foi possível ler os dados da carreira.')
    }
    return r
  }

  /** Há carreira aberta? Com uma aberta, o pacote não pode ser editado (ver renderer/modos.ts). */
  temAberta(): boolean {
    return this.aberta !== null
  }

  resumoAtual(): ResumoCarreira | null {
    if (!this.aberta) return null
    const l = lerResumo(this.aberta.conexao.sql)
    return l ? paraResumo(l, listarAutosaves(this.pastaDa(this.aberta.id))[0] ?? null) : null
  }

  /** Cópia de segurança da carreira aberta (depois de cada jogo do usuário e da virada). */
  autosave(motivo: string): Autosave | null {
    if (!this.aberta) return null
    const l = lerResumo(this.aberta.conexao.sql)
    return fazerAutosave(this.aberta.conexao.sql, this.pastaDa(this.aberta.id), {
      em: this.dep.agora(),
      temporada: l?.temporada_atual ?? 0,
      semana: l?.semana_atual ?? 0,
      motivo,
    })
  }

  autosaves(id: string): Autosave[] {
    return listarAutosaves(this.pastaDa(id))
  }

  /**
   * Volta a carreira para um autosave. O estado atual fica guardado em
   * `autosave/antes-de-restaurar.sqlite` (só a última restauração).
   */
  restaurar(id: string, numero: number): ResumoCarreira {
    const pasta = this.pastaDa(id)
    const banco = join(pasta, ARQUIVO_BANCO)
    if (!existsSync(banco)) throw new ErroApp('carreira_inexistente', 'Carreira não encontrada.')
    if (!this.autosaves(id).some((a) => a.numero === numero)) throw new ErroApp('autosave_inexistente', 'Este autosave não existe mais.')
    const origem = arquivoAutosave(pasta, numero)
    // Fecha a conexão (grava o WAL no arquivo) antes de mexer nos arquivos.
    if (this.aberta?.id === id) this.fechar()
    const guarda = join(pasta, PASTA_AUTOSAVE, 'antes-de-restaurar.sqlite')
    copyFileSync(banco, guarda)
    // WAL que sobrou de um fechamento ruim vai junto com a guarda (o SQLite o aplica ao abrir).
    if (existsSync(banco + '-wal')) copyFileSync(banco + '-wal', guarda + '-wal')
    else rmSync(guarda + '-wal', { force: true })
    for (const extra of ['-wal', '-shm']) rmSync(banco + extra, { force: true })
    copyFileSync(origem, banco)
    return this.abrir(id)
  }

  /** Banco da carreira aberta (erro se não houver). */
  sql(): Sql {
    if (!this.aberta) throw new ErroApp('sem_carreira', 'Nenhuma carreira aberta.')
    return this.aberta.conexao.sql
  }

  /** Pasta da carreira aberta (para servir os escudos copiados). */
  pastaAberta(): string | null {
    return this.aberta ? this.pastaDa(this.aberta.id) : null
  }

  fechar(): void {
    this.aberta?.conexao.fechar()
    this.aberta = null
  }

  apagar(id: string): void {
    const pasta = this.pastaDa(id)
    if (this.aberta?.id === id) this.fechar()
    if (!existsSync(join(pasta, ARQUIVO_BANCO))) throw new ErroApp('carreira_inexistente', 'Carreira não encontrada.')
    rmSync(pasta, { recursive: true, force: true })
  }
}
