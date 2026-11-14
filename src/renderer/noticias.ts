import type { Condicao, Efeito, EventoCatalogo, Momento, TipoNoticia } from '@shared/esquemas/noticias'
import { ROTULO_ATRIBUTO, type Atributo } from '@shared/esquemas/pacote'
import { dinheiro } from '@shared/dinheiro'

/** Nomes e cores (etiqueta `we-tag`) dos tipos de notícia. */
export const ROTULO_TIPO: Record<TipoNoticia, string> = {
  jogo: 'Jogo',
  elenco: 'Elenco',
  mercado: 'Mercado',
  diretoria: 'Diretoria',
  financas: 'Finanças',
  torcida: 'Torcida',
  imprensa: 'Imprensa',
  competicao: 'Competição',
}

export const TAG_TIPO: Record<TipoNoticia, 'padrao' | 'tit' | 'positivo' | 'atencao' | 'negativo' | 'info' | 'diretoria'> = {
  jogo: 'tit',
  elenco: 'positivo',
  mercado: 'info',
  diretoria: 'diretoria',
  financas: 'atencao',
  torcida: 'negativo',
  imprensa: 'padrao',
  competicao: 'tit',
}

// ------------------------------------------------------------------ editor do catálogo


export const ROTULO_MOMENTO: Record<Momento, string> = {
  semana: 'Toda semana',
  pos_jogo: 'Depois de cada jogo',
  janela_abre: 'Quando a janela abre',
  janela_fecha: 'Quando a janela fecha',
  virada: 'Na virada da temporada',
}

export const ROTULO_ALVO: Record<EventoCatalogo['alvo'], string> = {
  jogador_aleatorio_do_usuario: 'Um jogador qualquer do elenco',
  jogador_condicionado: 'Um jogador que atende às condições',
  time_usuario: 'O seu time',
  time_qualquer: 'Outro clube',
}

export const ROTULO_CONDICAO: Record<Condicao['campo'], string> = {
  'jogador.idade': 'Idade do jogador',
  'jogador.moral': 'Moral do jogador',
  'jogador.condicao': 'Condição física do jogador',
  'jogador.geral': 'Geral do jogador',
  'jogador.potencial': 'Potencial do jogador',
  'jogador.titular': 'Jogador é titular',
  'time.saldo': 'Saldo do clube',
  'time.confianca': 'Confiança da diretoria',
  'time.aproveitamento': 'Aproveitamento (últimos 5 jogos)',
  'time.folha_acima': 'Folha acima do orçamento',
  'time.moral_media': 'Moral média do elenco',
  'partida.resultado': 'Resultado do jogo',
  'partida.gols_pro': 'Gols marcados no jogo',
  'partida.gols_contra': 'Gols sofridos no jogo',
  'partida.em_casa': 'Jogou em casa',
}

export const ROTULO_OPERADOR: Record<Condicao['op'], string> = { '<': 'menor que', '<=': 'até', '>': 'maior que', '>=': 'a partir de', '==': 'é', '!=': 'não é' }

export const ROTULO_EFEITO: Record<Efeito['campo'], string> = {
  moral: 'Moral do jogador',
  moral_elenco: 'Moral do elenco todo',
  condicao: 'Condição física do jogador',
  atributo: 'Atributo específico',
  atributo_aleatorio: 'Atributo sorteado',
  atributo_aleatorio_do_foco: 'Atributo do foco de treino',
  potencial: 'Potencial do jogador',
  confianca: 'Confiança da diretoria',
  saldo: 'Saldo do clube (lançamento)',
  lesao: 'Lesão',
  disponibilidade: 'Fora por assuntos pessoais',
  interesse_mercado: 'Proposta de outro clube',
}

export const MARCADORES = [
  { marcador: '{jogador}', rotulo: 'Jogador' },
  { marcador: '{time}', rotulo: 'Seu time' },
  { marcador: '{clube}', rotulo: 'Outro clube' },
  { marcador: '{valor}', rotulo: 'Valor (R$)' },
] as const

const sinal = (n: number) => (n > 0 ? `+${n}` : `${n}`)
export const porcento = (p: number) => `${(Math.round(p * 1000) / 10).toLocaleString('pt-BR')}%`

/** Frase curta de um efeito do catálogo ("Moral do jogador +8 (50%)"). */
export function descreverEfeitoCatalogo(e: Efeito): string {
  let t: string
  switch (e.campo) {
    case 'atributo':
      t = `${ROTULO_ATRIBUTO[e.atributo as Atributo] ?? e.atributo ?? '?'} ${sinal(e.delta ?? 0)}`
      break
    case 'saldo':
      t = `Saldo ${(e.valor ?? 0) >= 0 ? '+' : ''}${dinheiro(e.valor ?? 0)}`
      break
    case 'lesao':
    case 'disponibilidade':
      t = `${ROTULO_EFEITO[e.campo]} (${e.semanas ?? 1} sem.)`
      break
    case 'interesse_mercado':
      t = ROTULO_EFEITO[e.campo]
      break
    default:
      t = `${ROTULO_EFEITO[e.campo]} ${sinal(e.delta ?? 0)}`
  }
  return e.chance !== undefined && e.chance < 1 ? `${t} (${porcento(e.chance)})` : t
}

/** Texto do evento com nomes de exemplo, como vai aparecer na caixa de notícias. */
export function previaTexto(texto: string, e: Pick<EventoCatalogo, 'efeitos' | 'escolhas'>, time: string): string {
  const saldo = [...e.efeitos, ...(e.escolhas?.flatMap((o) => o.efeitos) ?? [])].find((x) => x.campo === 'saldo')
  return texto
    .replaceAll('{jogador}', 'Fulano')
    .replaceAll('{time}', time)
    .replaceAll('{clube}', 'Outro Clube FC')
    .replaceAll('{valor}', saldo ? dinheiro(Math.abs(saldo.valor ?? 0)) : '')
}
