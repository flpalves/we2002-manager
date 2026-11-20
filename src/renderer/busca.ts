/** Busca de times nos seletores: sem acento, sem caixa, por nome, nome curto, sigla ou estado. */

export interface TimeBuscavel {
  sigla: string
  nome: string
  nome_curto?: string
  estado?: string
  pais?: string
}

export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Filtra e ordena: sigla exata primeiro, depois nomes que começam com o termo,
 * depois o resto que contém todas as palavras digitadas (em qualquer ordem).
 * Termo vazio devolve a lista como veio.
 */
export function filtrarTimes<T extends TimeBuscavel>(times: readonly T[], termo: string): T[] {
  const busca = normalizarBusca(termo)
  if (!busca) return [...times]
  const palavras = busca.split(' ')
  const pontuados: { time: T; nota: number; ordem: number }[] = []
  times.forEach((time, ordem) => {
    const sigla = normalizarBusca(time.sigla)
    const nome = normalizarBusca(time.nome)
    const curto = normalizarBusca(time.nome_curto ?? '')
    const texto = [nome, curto, sigla, normalizarBusca(time.estado ?? ''), normalizarBusca(time.pais ?? '')].join(' ')
    if (!palavras.every((p) => texto.includes(p))) return
    const nota = sigla === busca ? 0 : nome.startsWith(busca) || curto.startsWith(busca) ? 1 : sigla.startsWith(busca) ? 2 : 3
    pontuados.push({ time, nota, ordem })
  })
  return pontuados.sort((a, b) => a.nota - b.nota || a.ordem - b.ordem).map((p) => p.time)
}

export interface JogadorBuscavel {
  nome: string
  nome_we: string
  posicao: string
}

/**
 * Lista de jogadores do editor: filtra pela posição principal (null = todas) e pelo termo
 * (todas as palavras, sem acento, no nome ou no nome do WE). Mantém a ordem da lista.
 */
export function filtrarJogadores<T extends JogadorBuscavel>(jogadores: readonly T[], termo: string, posicao: string | null): T[] {
  const palavras = normalizarBusca(termo).split(' ').filter(Boolean)
  return jogadores.filter((j) => {
    if (posicao && j.posicao !== posicao) return false
    if (!palavras.length) return true
    const texto = `${normalizarBusca(j.nome)} ${normalizarBusca(j.nome_we)}`
    return palavras.every((p) => texto.includes(p))
  })
}
