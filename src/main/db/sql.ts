/**
 * Interface mínima de acesso ao SQLite usada pelos repositórios. Em produção é o
 * better-sqlite3 (ver `conexao.ts`); nos testes, o `node:sqlite` do Node.
 * Parâmetros sempre posicionais (`?`); booleanos viram 0/1 e `undefined` vira NULL.
 */

export type ValorSql = string | number | bigint | null | Uint8Array
export type ParametroSql = ValorSql | boolean | undefined

export interface Sql {
  exec(sql: string): void
  run(sql: string, ...params: ParametroSql[]): { lastInsertRowid: number | bigint; changes: number | bigint }
  get<T>(sql: string, ...params: ParametroSql[]): T | undefined
  all<T>(sql: string, ...params: ParametroSql[]): T[]
  transacao<T>(fn: () => T): T
}

export function normalizarParametros(params: ParametroSql[]): ValorSql[] {
  return params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p))
}

/**
 * Transação por BEGIN/COMMIT, para drivers sem `transaction()` (node:sqlite). Como no
 * better-sqlite3, uma transação dentro de outra vira SAVEPOINT (a de fora decide o COMMIT).
 */
export function criarTransacaoManual(exec: (sql: string) => void): <T>(fn: () => T) => T {
  let profundidade = 0
  return <T>(fn: () => T): T => {
    const nome = `sp${profundidade}`
    exec(profundidade === 0 ? 'BEGIN' : `SAVEPOINT ${nome}`)
    profundidade++
    try {
      const r = fn()
      profundidade--
      exec(profundidade === 0 ? 'COMMIT' : `RELEASE ${nome}`)
      return r
    } catch (e) {
      profundidade--
      exec(profundidade === 0 ? 'ROLLBACK' : `ROLLBACK TO ${nome}; RELEASE ${nome}`)
      throw e
    }
  }
}
