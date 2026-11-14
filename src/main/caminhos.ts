import { isAbsolute, join, normalize, relative, sep } from 'node:path'
import type { Caminhos } from '@shared/esquemas/config'

/**
 * Diz se `caminho` está dentro de uma pasta do OneDrive. Usa as variáveis que o
 * próprio OneDrive define (`OneDrive`, `OneDriveConsumer`, `OneDriveCommercial`) e,
 * na falta delas, procura um segmento "OneDrive" no caminho.
 */
export function estaNoOneDrive(caminho: string, env: Record<string, string | undefined>): boolean {
  const alvo = normalize(caminho).toLowerCase()
  const raizes = [env['OneDrive'], env['OneDriveConsumer'], env['OneDriveCommercial']]
    .filter((r): r is string => !!r)
    .map((r) => normalize(r).toLowerCase())
  for (const raiz of raizes) {
    const rel = relative(raiz, alvo)
    if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return true
  }
  return alvo.split(/[\\/]/).some((parte) => parte === 'onedrive' || parte.startsWith('onedrive - '))
}

/** Caminhos padrão do emulador, relativos à raiz do projeto (ver CLAUDE.md). */
export function caminhosPadrao(raizProjeto: string): Caminhos {
  return {
    emulador: join(raizProjeto, 'emulador', 'pcsx-redux', 'pcsx-redux.exe'),
    imagem: join(raizProjeto, 'emulador', 'we2002.cue'),
    estados: join(raizProjeto, 'states'),
  }
}

export function pastaCarreirasPadrao(userData: string): string {
  return join(userData, 'carreiras')
}

export { sep }
