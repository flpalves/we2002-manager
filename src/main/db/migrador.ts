/**
 * Migrações do SQLite da carreira. Arquivos `migracoes/NNN_nome.sql`, aplicados em ordem,
 * cada um numa transação. A versão do esquema fica em `PRAGMA user_version`.
 *
 * Uma migração que recria uma tabela referenciada por outras (o SQLite não altera CHECK) começa
 * com a linha `-- migrador: sem_chaves_estrangeiras`: as chaves estrangeiras são desligadas fora
 * da transação (o PRAGMA não vale dentro dela) e religadas no fim, como manda o SQLite.
 *
 * O migrador conversa com o banco por uma interface mínima para poder ser testado sem o
 * binário do better-sqlite3 compilado para o Electron.
 */

export interface BancoMigravel {
  exec(sql: string): void
  versaoEsquema(): number
  definirVersaoEsquema(versao: number): void
}

export interface Migracao {
  versao: number
  nome: string
  sql: string
}

const SEM_CHAVES = /^--\s*migrador:\s*sem_chaves_estrangeiras\s*$/m

const PADRAO_ARQUIVO = /^(\d{3})_([a-z0-9_]+)\.sql$/

/** Monta a lista ordenada a partir de `{ 'caminho/001_x.sql': conteúdo }`. */
export function lerMigracoes(arquivos: Record<string, string>): Migracao[] {
  const lista: Migracao[] = []
  for (const [caminho, sql] of Object.entries(arquivos)) {
    const nomeArquivo = caminho.split(/[\\/]/).pop() ?? caminho
    const m = PADRAO_ARQUIVO.exec(nomeArquivo)
    if (!m) throw new Error(`Nome de migração inválido: ${nomeArquivo} (esperado NNN_nome.sql)`)
    lista.push({ versao: Number(m[1]), nome: m[2] as string, sql })
  }
  lista.sort((a, b) => a.versao - b.versao)
  lista.forEach((mig, i) => {
    if (mig.versao !== i + 1) {
      throw new Error(`Migrações fora de sequência: esperado ${String(i + 1).padStart(3, '0')}, achado ${mig.nome} (${mig.versao})`)
    }
  })
  return lista
}

export interface ResultadoMigracao {
  de: number
  para: number
  aplicadas: string[]
}

export function migrar(banco: BancoMigravel, migracoes: readonly Migracao[]): ResultadoMigracao {
  const de = banco.versaoEsquema()
  const ultima = migracoes.at(-1)?.versao ?? 0
  if (de > ultima) {
    throw new Error(`Carreira criada por uma versão mais nova do app (esquema ${de}, este app conhece até ${ultima})`)
  }
  const aplicadas: string[] = []
  for (const mig of migracoes) {
    if (mig.versao <= de) continue
    const semChaves = SEM_CHAVES.test(mig.sql)
    if (semChaves) banco.exec('PRAGMA foreign_keys = OFF')
    banco.exec('BEGIN')
    try {
      banco.exec(mig.sql)
      banco.definirVersaoEsquema(mig.versao)
      banco.exec('COMMIT')
    } catch (e) {
      banco.exec('ROLLBACK')
      throw new Error(`Falha na migração ${String(mig.versao).padStart(3, '0')}_${mig.nome}: ${(e as Error).message}`, { cause: e })
    } finally {
      if (semChaves) banco.exec('PRAGMA foreign_keys = ON')
    }
    aplicadas.push(mig.nome)
  }
  return { de, para: Math.max(de, ultima), aplicadas }
}
