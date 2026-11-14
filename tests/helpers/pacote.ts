import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gravarJson } from '../../src/main/pacote/leitor'
import type { Pacote } from '@shared/esquemas/pacote'

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])

export function escreverPacote(raiz: string, p: Pacote): void {
  gravarJson(join(raiz, 'manifesto.json'), p.manifesto)
  gravarJson(join(raiz, 'regras.json'), p.regras)
  gravarJson(join(raiz, 'paises.json'), p.paises)
  if (p.noticias) gravarJson(join(raiz, 'noticias.json'), p.noticias)
  if (p.temporada) gravarJson(join(raiz, 'temporada.json'), p.temporada)
  if (p.divisoes) gravarJson(join(raiz, 'divisoes.json'), p.divisoes)
  for (const t of p.times) gravarJson(join(raiz, 'times', `${t.sigla}.json`), t)
  for (const c of p.competicoes) gravarJson(join(raiz, 'competicoes', `${c.id}.json`), c)
  mkdirSync(join(raiz, 'escudos'), { recursive: true })
  for (const s of p.escudos) writeFileSync(join(raiz, 'escudos', `${s}.png`), PNG)
}
