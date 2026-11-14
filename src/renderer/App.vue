<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import BarraSuperior from './layout/BarraSuperior.vue'
import WeNav from './componentes/WeNav.vue'
import WeAtalhos from './componentes/WeAtalhos.vue'
import WeDialogo from './componentes/WeDialogo.vue'
import WeBotao from './componentes/WeBotao.vue'
import WeEscudo from './componentes/WeEscudo.vue'
import { rotas } from './router'
import { ATALHOS_GERAIS, useUi } from './stores/ui'
import { useCarreira } from './stores/carreira'
import { bloqueioDoModo, modoDaTela } from './modos'

const ui = useUi()
const carreira = useCarreira()
const rota = useRoute()
const router = useRouter()
const telaCheia = computed(() => !!rota.meta.telaCheia)
/** Editor do pacote: layout próprio, sem o menu e a barra da carreira. */
const modoEditor = computed(() => !!rota.meta.editor)

/** O menu só mostra o que pode abrir agora (sem carreira, nada da carreira). */
const podeAbrir = (nome: string) => !bloqueioDoModo(modoDaTela(nome), !!carreira.atual)

const item = (r: (typeof rotas)[number]) => ({ nome: r.name as string, titulo: r.meta?.titulo ?? '', icone: r.meta?.icone })
const principais = computed(() =>
  rotas
    .filter((r) => r.meta?.menu === 'principal')
    .map(item)
    .filter((i) => podeAbrir(i.nome))
    .map((i) => {
      if (i.nome !== 'noticias' || !carreira.noticias) return i
      const { pendentes, naoLidas } = carreira.noticias
      return { ...i, contagem: pendentes || naoLidas, alerta: pendentes > 0 }
    }),
)
const pe = computed(() =>
  rotas
    .filter((r) => r.meta?.menu === 'pe')
    .map(item)
    .filter((i) => podeAbrir(i.nome)),
)

/** Rodapé: o banco grava a cada ação; o autosave é a cópia de segurança da última rodada. */
const rodape = computed(() => {
  const c = carreira.atual
  const partes: string[] = []
  if (c) {
    const a = c.ultimoAutosave
    partes.push(a ? `Último autosave: ${a.temporada} · semana ${a.semana}` : 'Sem autosave ainda')
  }
  partes.push(`Tema ${ui.tema}`)
  return partes.join(' · ')
})

const atalhos = computed(() => {
  const [selecionar, voltar, secao, continuar] = ATALHOS_GERAIS
  if (modoEditor.value) return [selecionar!, voltar!, ...ui.atalhosTela]
  if (telaCheia.value) return [selecionar!, voltar!, { comando: 'acaoY' as const, rotulo: 'Trocar tema' }, continuar!]
  return [selecionar!, voltar!, ...ui.atalhosTela, { ...secao!, tecla: 'LB/RB' }, continuar!]
})
</script>

<template>
  <div class="app">
    <main v-if="telaCheia" class="app__cheia" :inert="!!ui.dialogo">
      <RouterView />
    </main>
    <div v-else-if="modoEditor" class="app__fundo" :inert="!!ui.dialogo">
      <header class="topo">
        <WeEscudo sigla="WE" :cor="ui.corClube" tamanho="g" />
        <div>
          <div class="topo__clube">Editor do pacote</div>
          <div class="we-lb">Modo de edição · sem carreira aberta</div>
        </div>
        <div class="topo__info">
          <WeBotao icone="sair" @click="router.push({ name: 'abertura' })">Sair do editor</WeBotao>
        </div>
      </header>
      <main class="app__conteudo">
        <RouterView />
      </main>
    </div>
    <div v-else class="app__fundo" :inert="!!ui.dialogo">
      <BarraSuperior />
      <div class="app__meio">
        <WeNav :itens="principais" :pe="pe" />
        <main class="app__conteudo">
          <RouterView />
        </main>
      </div>
    </div>
    <WeAtalhos :atalhos="atalhos">
      <span>{{ rodape }}</span>
    </WeAtalhos>
    <div v-if="ui.aviso" class="aviso" role="status">{{ ui.aviso }}</div>
    <WeDialogo />
  </div>
</template>
