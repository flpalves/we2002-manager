import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import TelaAbertura from './telas/TelaAbertura.vue'
import TelaInicio from './telas/TelaInicio.vue'
import TelaConfiguracoes from './telas/TelaConfiguracoes.vue'
import TelaCarreiras from './telas/TelaCarreiras.vue'
import TelaEditor from './telas/TelaEditor.vue'
import TelaCalendario from './telas/TelaCalendario.vue'
import TelaCompeticoes from './telas/TelaCompeticoes.vue'
import TelaPartida from './telas/TelaPartida.vue'
import TelaElenco from './telas/TelaElenco.vue'
import TelaJogador from './telas/TelaJogador.vue'
import TelaTreino from './telas/TelaTreino.vue'
import TelaPreJogo from './telas/TelaPreJogo.vue'
import TelaEmulador from './telas/TelaEmulador.vue'
import TelaPosJogo from './telas/TelaPosJogo.vue'
import TelaMercado from './telas/TelaMercado.vue'
import TelaFinancas from './telas/TelaFinancas.vue'
import TelaClube from './telas/TelaClube.vue'
import TelaNoticias from './telas/TelaNoticias.vue'
import TelaEscalacao from './telas/TelaEscalacao.vue'
import TelaFimTemporada from './telas/TelaFimTemporada.vue'
import TelaTime from './telas/TelaTime.vue'
import TelaTransferencias from './telas/TelaTransferencias.vue'
import type { NomeIcone } from './icones'

declare module 'vue-router' {
  interface RouteMeta {
    titulo: string
    /** Grupo do menu lateral: principal (topo) ou pe (rodapé do menu). */
    menu?: 'principal' | 'pe'
    /** Ícone de traço ao lado do item no menu. */
    icone?: NomeIcone
    /** Tela cheia, sem barra superior nem menu lateral (a abertura). */
    telaCheia?: boolean
    /** Modo editor do pacote: layout próprio, sem menu nem barra da carreira (ver modos.ts). */
    editor?: boolean
  }
}

export const rotas: RouteRecordRaw[] = [
  { path: '/inicio', name: 'inicio', component: TelaInicio, meta: { titulo: 'Início', menu: 'principal', icone: 'inicio' } },
  { path: '/elenco', name: 'elenco', component: TelaElenco, meta: { titulo: 'Elenco', menu: 'principal', icone: 'elenco' } },
  { path: '/escalacao', name: 'escalacao', component: TelaEscalacao, meta: { titulo: 'Escalação', menu: 'principal', icone: 'escalacao' } },
  { path: '/treino', name: 'treino', component: TelaTreino, meta: { titulo: 'Treino', menu: 'principal', icone: 'treino' } },
  { path: '/calendario', name: 'calendario', component: TelaCalendario, meta: { titulo: 'Calendário', menu: 'principal', icone: 'calendario' } },
  { path: '/competicoes', name: 'competicoes', component: TelaCompeticoes, meta: { titulo: 'Competições', menu: 'principal', icone: 'competicoes' } },
  { path: '/mercado', name: 'mercado', component: TelaMercado, meta: { titulo: 'Mercado', menu: 'principal', icone: 'mercado' } },
  { path: '/transferencias', name: 'transferencias', component: TelaTransferencias, meta: { titulo: 'Transferências', menu: 'principal', icone: 'transferencias' } },
  { path: '/financas', name: 'financas', component: TelaFinancas, meta: { titulo: 'Finanças', menu: 'principal', icone: 'financas' } },
  { path: '/clube', name: 'clube', component: TelaClube, meta: { titulo: 'Clube e diretoria', menu: 'principal', icone: 'clube' } },
  { path: '/noticias', name: 'noticias', component: TelaNoticias, meta: { titulo: 'Notícias', menu: 'principal', icone: 'noticias' } },
  { path: '/editor', name: 'editor', component: TelaEditor, meta: { titulo: 'Editor do pacote', icone: 'editor', editor: true } },
  { path: '/configuracoes', name: 'configuracoes', component: TelaConfiguracoes, meta: { titulo: 'Configurações', menu: 'pe', icone: 'configuracoes' } },
  { path: '/prejogo', name: 'prejogo', component: TelaPreJogo, meta: { titulo: 'Pré-jogo' } },
  { path: '/emulador', name: 'emulador', component: TelaEmulador, meta: { titulo: 'No emulador' } },
  { path: '/fim-temporada', name: 'fimTemporada', component: TelaFimTemporada, meta: { titulo: 'Fim de temporada' } },
  { path: '/posjogo', name: 'posjogo', component: TelaPosJogo, meta: { titulo: 'Pós-jogo' } },
  { path: '/time/:sigla', name: 'time', component: TelaTime, meta: { titulo: 'Clube' } },
  { path: '/jogador/:id', name: 'jogador', component: TelaJogador, meta: { titulo: 'Ficha do jogador' } },
  { path: '/partida/:id', name: 'partida', component: TelaPartida, meta: { titulo: 'Súmula' } },
  { path: '/carreiras', name: 'carreiras', component: TelaCarreiras, meta: { titulo: 'Salvar / Carreiras', menu: 'pe', icone: 'carreiras' } },
  { path: '/', name: 'abertura', component: TelaAbertura, meta: { titulo: 'Tela inicial', menu: 'pe', icone: 'sair', telaCheia: true } },
]

/** Ordem do menu (LB/RB percorrem nesta ordem). O editor do pacote fica fora: não é tela da carreira. */
export const ordemMenu = rotas.filter((r) => r.meta?.menu && !r.meta.telaCheia).map((r) => r.name as string)

export const router = createRouter({
  history: createWebHashHistory(),
  routes: rotas,
})
