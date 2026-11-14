import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { desenharKit, PAGINA_KIT, type BaseKit } from '@core/we/desenharKit'
import { problemasDoDesign, type DesignKit } from '@core/we/estampas'
import { TimeSchema } from '@shared/esquemas/pacote'
import { decodificarPng, codificarPng } from '../png'
import { salvarTime } from './leitor'

/** Kit original do WE usado como base de todos os desenhos (o mesmo do `kits:desenhar`). */
export const BASE_KIT_PADRAO = 'brasil'

export type CampoKit = 'kit' | 'kit_reserva' | 'kit_goleiro'

const SUFIXO: Record<CampoKit, string> = { kit: '', kit_reserva: '_reserva', kit_goleiro: '_goleiro' }

/** Escala da arte gravada (512x1024), a mesma do `tools/desenhar-kit.ts`. */
export const ESCALA_ARTE = 4

/** Lê `kits/<base>_original.png` e `kits/<base>_pagina.bin`; null se faltar algum. */
export function lerBaseKit(pastaKits: string, nome = BASE_KIT_PADRAO): BaseKit | null {
  const png = join(pastaKits, `${nome}_original.png`)
  const bin = join(pastaKits, `${nome}_pagina.bin`)
  if (!existsSync(png) || !existsSync(bin)) return null
  const img = decodificarPng(readFileSync(png))
  if (img.largura !== PAGINA_KIT.largura || img.altura !== PAGINA_KIT.altura) throw new Error(`${png}: o kit base precisa ter 128x256`)
  return { rgba: img.dados, pagina: new Uint8Array(readFileSync(bin)) }
}

/** Caminho da arte no pacote (relativo, com `/`), no padrão dos kits já gerados. */
export function caminhoArte(sigla: string, campo: CampoKit): string {
  return `kits/desenhos/${sigla.toLowerCase()}${SUFIXO[campo]}_4x.png`
}

/**
 * Desenha a arte 4x do kit, grava no pacote e atualiza o `times/<SIGLA>.json` (design, cor do
 * número e caminho da arte). Os outros campos do kit e do time ficam como estavam.
 */
export function gerarKit(raizPacote: string, base: BaseKit, sigla: string, campo: CampoKit, design: DesignKit, corNumero: string): string {
  const problemas = problemasDoDesign(design)
  if (problemas.length) throw new Error(`Uniforme inválido: ${problemas.join('; ')}`)
  const arqTime = join(raizPacote, 'times', `${sigla}.json`)
  if (!existsSync(arqTime)) throw new Error(`O time ${sigla} não existe no pacote.`)
  const time = TimeSchema.parse(JSON.parse(readFileSync(arqTime, 'utf8')))

  const arte = caminhoArte(sigla, campo)
  const png = codificarPng({ largura: PAGINA_KIT.largura * ESCALA_ARTE, altura: PAGINA_KIT.altura * ESCALA_ARTE, dados: desenharKit(base, design, ESCALA_ARTE) })
  const destino = join(raizPacote, ...arte.split('/'))
  mkdirSync(dirname(destino), { recursive: true })
  const tmp = `${destino}.tmp`
  writeFileSync(tmp, png)
  renameSync(tmp, destino)

  salvarTime(raizPacote, { ...time, [campo]: { ...(time[campo] ?? {}), arte, cor_numero: corNumero.toUpperCase(), design } })
  return arte
}
