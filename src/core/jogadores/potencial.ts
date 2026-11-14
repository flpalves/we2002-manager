import type { Regras } from '../config/padroes'
import { criarRng } from '../rng'

/**
 * Faixa de potencial exibida (spec 05): estreita com a idade (até 19 → ±3 ... 27+ → exato).
 * O deslocamento da faixa é sorteado com a semente da carreira e o id do jogador, então é
 * sempre o mesmo (não "pula" a cada tela) e o valor real nunca fica sempre no meio.
 */
export function faixaPotencial(potencial: number, idade: number, sementeCarreira: number, chaveJogador: string, regras: Regras): { min: number; max: number } {
  const tabela = regras.jogadores.faixa_potencial
  const largura = (tabela.find((f) => idade <= f.ate_idade) ?? tabela[tabela.length - 1])?.mais_ou_menos ?? 0
  if (largura === 0) return { min: potencial, max: potencial }
  const deslocamento = criarRng(sementeCarreira).derivar('potencial', chaveJogador).inteiro(-largura, largura)
  let min = potencial + deslocamento - largura
  let max = potencial + deslocamento + largura
  // Mantém a largura dentro de 1-20 empurrando a janela, sem perder o valor real.
  if (min < 1) {
    max += 1 - min
    min = 1
  }
  if (max > 20) {
    min -= max - 20
    max = 20
  }
  return { min: Math.max(1, min), max: Math.min(20, max) }
}
