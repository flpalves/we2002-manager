import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Autosave } from '@shared/esquemas/carreira'
import type { Sql } from '../db/sql'

/**
 * Autosave (01-arquitetura, "Persistência"): `<pasta da carreira>/autosave/` guarda as
 * últimas cópias do banco, rotativas (autosave-1 = a mais nova). A cópia é feita com
 * `VACUUM INTO`, que gera um arquivo consistente mesmo com o banco aberto em WAL.
 */

export const PASTA_AUTOSAVE = 'autosave'
export const COPIAS_AUTOSAVE = 3
const INDICE = 'indice.json'

const arquivoDa = (n: number) => `autosave-${n}.sqlite`

function lerIndice(pasta: string): Autosave[] {
  try {
    const bruto = JSON.parse(readFileSync(join(pasta, INDICE), 'utf8')) as Autosave[]
    return Array.isArray(bruto) ? bruto : []
  } catch {
    return []
  }
}

/** Cópias existentes, da mais nova para a mais antiga. */
export function listarAutosaves(pastaCarreira: string): Autosave[] {
  const pasta = join(pastaCarreira, PASTA_AUTOSAVE)
  return lerIndice(pasta).filter((a) => existsSync(join(pasta, arquivoDa(a.numero))))
}

export function arquivoAutosave(pastaCarreira: string, numero: number): string {
  return join(pastaCarreira, PASTA_AUTOSAVE, arquivoDa(numero))
}

/**
 * Grava uma cópia nova como autosave-1 e empurra as outras (a mais antiga sai).
 * Chamar fora de transação (VACUUM não roda dentro de uma).
 */
export function fazerAutosave(sql: Sql, pastaCarreira: string, info: Omit<Autosave, 'numero'>, copias = COPIAS_AUTOSAVE): Autosave {
  const pasta = join(pastaCarreira, PASTA_AUTOSAVE)
  mkdirSync(pasta, { recursive: true })
  const temporario = join(pasta, 'autosave-novo.sqlite')
  rmSync(temporario, { force: true })
  // Primeiro a cópia nova; só depois gira as antigas (se a cópia falhar, nada se perde).
  sql.exec(`VACUUM INTO '${temporario.replaceAll("'", "''")}'`)
  const anteriores = lerIndice(pasta)
  rmSync(join(pasta, arquivoDa(copias)), { force: true })
  for (let n = copias - 1; n >= 1; n--) {
    const de = join(pasta, arquivoDa(n))
    if (existsSync(de)) renameSync(de, join(pasta, arquivoDa(n + 1)))
  }
  renameSync(temporario, join(pasta, arquivoDa(1)))
  const novo: Autosave = { numero: 1, ...info }
  const indice = [novo, ...anteriores.map((a) => ({ ...a, numero: a.numero + 1 })).filter((a) => a.numero <= copias)]
  writeFileSync(join(pasta, INDICE), JSON.stringify(indice, null, 2))
  return novo
}
