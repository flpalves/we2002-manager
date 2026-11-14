import type { Posicao } from '@shared/esquemas/pacote'

/**
 * Formações do WE2002 com o papel de cada vaga (0 = goleiro, 1-10 na ordem da formação,
 * a mesma ordem que a ponte usa para escrever o time na RAM).
 *
 * 4-3-3B, 4-4-2A e 5-3-2 vêm dos times reais de data/times. As outras quatro têm o código
 * mapeado na ponte (bridge/we2002.lua), mas os papéis das vagas são provisórios até a
 * trilha A confirmar no jogo (decisão 7).
 */
export const FORMACOES: Readonly<Record<string, readonly Posicao[]>> = {
  '4-3-3B': ['GK', 'CB', 'CB', 'SB', 'SB', 'DH', 'DH', 'OH', 'CF', 'WG', 'WG'],
  '4-4-2A': ['GK', 'CB', 'CB', 'SB', 'SB', 'DH', 'SH', 'SH', 'OH', 'CF', 'CF'],
  '5-3-2': ['GK', 'CB', 'CB', 'CB', 'DH', 'DH', 'SH', 'SH', 'OH', 'CF', 'CF'],
  // provisórias
  '4-4-2B': ['GK', 'CB', 'CB', 'SB', 'SB', 'DH', 'DH', 'OH', 'OH', 'CF', 'CF'],
  '4-5-1A': ['GK', 'CB', 'CB', 'SB', 'SB', 'DH', 'DH', 'SH', 'SH', 'OH', 'CF'],
  '4-5-1B': ['GK', 'CB', 'CB', 'SB', 'SB', 'DH', 'SH', 'SH', 'OH', 'OH', 'CF'],
  '4-3-3A': ['GK', 'CB', 'CB', 'SB', 'SB', 'DH', 'OH', 'OH', 'CF', 'WG', 'WG'],
}

export const FORMACAO_PADRAO = '4-4-2A'

export type Setor = 'gol' | 'defesa' | 'meio' | 'ataque'

export const SETOR: Readonly<Record<Posicao, Setor>> = {
  GK: 'gol',
  CB: 'defesa',
  SB: 'defesa',
  DH: 'meio',
  SH: 'meio',
  OH: 'meio',
  CF: 'ataque',
  WG: 'ataque',
}

export function papeisDa(formacao: string): readonly Posicao[] {
  return FORMACOES[formacao] ?? FORMACOES[FORMACAO_PADRAO]!
}
