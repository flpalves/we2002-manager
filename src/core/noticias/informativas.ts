import type { TipoNoticia } from '@shared/esquemas/noticias'
import type { FormatarDinheiro } from './motor'

/** Notícias informativas geradas pelo próprio jogo (09, tipo 1). Só texto e classificação. */

export interface NoticiaInfo {
  tipo: TipoNoticia
  texto: string
  jogador?: string | null
  time?: string | null
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export function resultadoDoUsuario(p: { casa: string; visitante: string; golsCasa: number; golsVisitante: number; competicao: string; penaltis: string | null }, usuario: string): NoticiaInfo {
  const meus = p.casa === usuario ? p.golsCasa : p.golsVisitante
  const deles = p.casa === usuario ? p.golsVisitante : p.golsCasa
  const como = meus > deles ? 'Vitória' : meus < deles ? 'Derrota' : 'Empate'
  return { tipo: 'jogo', time: usuario, texto: `${como} pela ${p.competicao}: ${p.casa} ${p.golsCasa} x ${p.golsVisitante} ${p.visitante}${p.penaltis ? ` (${p.penaltis})` : ''}.` }
}

export function lesao(jogador: { id: string; nome: string }, semanas: number, time: string): NoticiaInfo {
  return { tipo: 'elenco', jogador: jogador.id, time, texto: `${jogador.nome} se machuca e desfalca o time por ${plural(semanas, 'semana', 'semanas')}.` }
}

export function suspensao(jogador: { id: string; nome: string }, competicao: string, jogos: number, time: string): NoticiaInfo {
  return { tipo: 'elenco', jogador: jogador.id, time, texto: `${jogador.nome} está suspenso: cumpre ${plural(jogos, 'jogo', 'jogos')} na ${competicao}.` }
}

export function transferencia(t: { jogador: string; jogadorId: string; de: string | null; para: string; valor: number; emprestimo?: boolean }, dinheiro: FormatarDinheiro): NoticiaInfo {
  const como = t.emprestimo ? 'acerta o empréstimo de' : t.de ? 'contrata' : 'contrata o livre'
  const origem = t.de ? `, ex-${t.de}` : ''
  const valor = t.valor > 0 ? ` por ${dinheiro(t.valor)}` : ''
  return { tipo: 'mercado', jogador: t.jogadorId, time: t.para, texto: `${t.para} ${como} ${t.jogador}${origem}${valor}.` }
}

export function propostaRecebida(p: { clube: string; jogador: string; jogadorId: string; valor: number; prazo?: number }, dinheiro: FormatarDinheiro): NoticiaInfo {
  const prazo = p.prazo ? `até a semana ${p.prazo}` : 'logo'
  return { tipo: 'mercado', jogador: p.jogadorId, time: p.clube, texto: `${p.clube} oferece ${dinheiro(p.valor)} por ${p.jogador}. Responda em Mercado ${prazo}.` }
}

/** Clube da CPU em crise põe jogadores à venda para aliviar a folha. */
export function aVendaPorCrise(clube: { sigla: string; nome: string }, jogadores: readonly string[]): NoticiaInfo {
  const lista = jogadores.length > 1 ? `${jogadores.slice(0, -1).join(', ')} e ${jogadores[jogadores.length - 1]}` : (jogadores[0] ?? '')
  return { tipo: 'mercado', time: clube.sigla, texto: `Em crise financeira, ${clube.nome} põe ${lista} à venda para aliviar a folha.` }
}

/** Com a chegada de um reforço, um jogador de destaque perde espaço e vai para a lista de venda. */
export function perdeEspaco(clube: { sigla: string; nome: string }, jogador: { id: string; nome: string }, chegou: string): NoticiaInfo {
  return { tipo: 'mercado', jogador: jogador.id, time: clube.sigla, texto: `Com a chegada de ${chegou}, ${jogador.nome} perde espaço no ${clube.nome} e entra na lista de venda.` }
}

/** Clube que perdeu muitos jogadores por fim de contrato vai repor o elenco. */
export function reposicao(clube: { sigla: string; nome: string }, saidas: number, chegadas: number): NoticiaInfo {
  return { tipo: 'mercado', time: clube.sigla, texto: `${clube.nome} perdeu ${saidas} jogadores com o fim dos contratos e vai às compras: a ideia é trazer ${chegadas} reforços.` }
}

export function janela(abre: boolean, ate: number | null, nome?: string): NoticiaInfo {
  const qual = nome?.trim() ? ` (${nome.trim()})` : ''
  return {
    tipo: 'mercado',
    texto: abre
      ? `A janela de transferências${qual} está aberta${ate ? ` até a semana ${ate}` : ''}.`
      : `A janela de transferências${qual} fechou: agora só livres e renovações.`,
  }
}

export function metasDaTemporada(metas: readonly string[], temporada: number): NoticiaInfo {
  return { tipo: 'diretoria', texto: `Metas da diretoria para ${temporada}: ${metas.join('; ')}.` }
}

export function contratosAcabando(nomes: readonly string[], temporada: number): NoticiaInfo {
  const lista = nomes.length > 4 ? `${nomes.slice(0, 4).join(', ')} e mais ${nomes.length - 4}` : nomes.join(', ')
  return { tipo: 'elenco', texto: `${plural(nomes.length, 'contrato termina', 'contratos terminam')} em ${temporada}: ${lista}. Renove em Mercado.` }
}

export function campeao(time: string, competicao: string, doUsuario: boolean): NoticiaInfo {
  return { tipo: 'competicao', time, texto: doUsuario ? `É campeão! ${time} conquista a ${competicao}!` : `${time} é campeão da ${competicao}.` }
}

export function demissao(time: string): NoticiaInfo {
  return { tipo: 'diretoria', time, texto: `A diretoria do ${time} demite o técnico. Veja os clubes interessados em Clube e diretoria.` }
}

export function cargoAmeacado(): NoticiaInfo {
  return { tipo: 'diretoria', texto: 'A diretoria está insatisfeita: mais uma avaliação ruim e o técnico cai.' }
}

// ---------------------------------------------------------------- virada de temporada (fase 9)

export function acessoOuRebaixamento(time: string, competicao: string, tipo: string, doUsuario: boolean): NoticiaInfo {
  const subiu = tipo === 'acesso'
  const texto = doUsuario
    ? subiu
      ? `Acesso! ${time} vai disputar a ${competicao} na próxima temporada.`
      : `Rebaixado: ${time} vai disputar a ${competicao} na próxima temporada.`
    : `${time} ${subiu ? 'sobe' : 'cai'} para a ${competicao}.`
  return { tipo: 'competicao', time, texto }
}

export function artilheiro(jogador: string, time: string, gols: number, competicao: string): NoticiaInfo {
  return { tipo: 'competicao', time, texto: `${jogador} (${time}) é o artilheiro da ${competicao} com ${plural(gols, 'gol', 'gols')}.` }
}

export function metasFechadas(atingidas: number, total: number, confianca: number, demitido: boolean): NoticiaInfo {
  const texto = demitido
    ? `Balanço da diretoria: ${atingidas} de ${plural(total, 'meta cumprida', 'metas cumpridas')}. Uma meta essencial ficou para trás.`
    : `Balanço da diretoria: ${atingidas} de ${plural(total, 'meta cumprida', 'metas cumpridas')}. Confiança em ${confianca}%.`
  return { tipo: 'diretoria', texto }
}

export function contratosEncerrados(nomes: readonly string[]): NoticiaInfo {
  const lista = nomes.length > 4 ? `${nomes.slice(0, 4).join(', ')} e mais ${nomes.length - 4}` : nomes.join(', ')
  return { tipo: 'elenco', texto: `Fim de contrato: ${lista} ${nomes.length === 1 ? 'deixa' : 'deixam'} o clube e ${nomes.length === 1 ? 'fica livre' : 'ficam livres'} no mercado.` }
}

export function voltaDeEmprestimo(jogador: { id: string; nome: string }, time: string): NoticiaInfo {
  return { tipo: 'mercado', jogador: jogador.id, time, texto: `${jogador.nome} volta de empréstimo para o ${time}.` }
}

export function novaTemporada(temporada: number): NoticiaInfo {
  return { tipo: 'competicao', texto: `Começa a temporada ${temporada}. O calendário está em Calendário.` }
}
