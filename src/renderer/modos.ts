/**
 * Modos do app: o editor do pacote e a carreira não se misturam.
 *
 * - `carreira`: telas que leem ou mexem na carreira aberta. Só com carreira aberta.
 * - `editor`: o editor do pacote. Só sem carreira aberta (entrar nele fecha a carreira).
 * - sem modo (tela inicial, configurações): valem nos dois casos.
 */
export type Modo = 'carreira' | 'editor'

/** Telas que valem com ou sem carreira. */
export const TELAS_LIVRES: readonly string[] = ['abertura', 'configuracoes']

/**
 * Modo de uma tela pelo nome da rota. Tela nova entra como `carreira` por padrão:
 * a opção segura, já que só abre com carreira aberta.
 */
export function modoDaTela(nome: string | null | undefined): Modo | undefined {
  if (nome === 'editor') return 'editor'
  if (nome && TELAS_LIVRES.includes(nome)) return undefined
  return 'carreira'
}

export type Bloqueio = 'sem_carreira' | 'carreira_aberta'

/** Por que a tela de destino não pode abrir agora; `null` se pode. */
export function bloqueioDoModo(modo: Modo | undefined, temCarreira: boolean): Bloqueio | null {
  if (modo === 'carreira' && !temCarreira) return 'sem_carreira'
  if (modo === 'editor' && temCarreira) return 'carreira_aberta'
  return null
}

export const AVISO_BLOQUEIO: Record<Bloqueio, string> = {
  sem_carreira: 'Nenhuma carreira aberta. Crie ou carregue uma na tela inicial.',
  carreira_aberta: 'O editor do pacote não abre com uma carreira em andamento. Volte à tela inicial e entre no editor por lá.',
}
