<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { CaixaNoticias, Noticia, TipoNoticia } from '@shared/esquemas/noticias'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeTag from '../componentes/WeTag.vue'
import { useTela } from '../composables/useTela'
import { useCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { useUi } from '../stores/ui'
import { chamar } from '../api'
import { ROTULO_TIPO, TAG_TIPO } from '../noticias'

const carreira = useCarreira()
const temporada = useTemporada()
const ui = useUi()
const dados = ref<CaixaNoticias | null>(null)
const filtro = ref<TipoNoticia | null>(null)
const respondendo = ref(false)

const TIPOS = Object.keys(ROTULO_TIPO) as TipoNoticia[]
useTela([{ comando: 'acaoY', rotulo: 'Filtrar' }], {
  acaoY: () => {
    const i = filtro.value === null ? -1 : TIPOS.indexOf(filtro.value)
    filtro.value = i + 1 >= TIPOS.length ? null : TIPOS[i + 1]!
  },
})

async function carregar(): Promise<void> {
  if (!carreira.atual) return
  try {
    dados.value = await chamar('noticias:caixa', filtro.value ? { tipo: filtro.value } : {})
    // Abrir a caixa marca como lidas (as não lidas aparecem destacadas desta vez).
    if (dados.value.naoLidas > dados.value.pendentes) {
      await chamar('noticias:lidas', { ids: null })
      await carreira.carregarNoticias()
    }
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}
watch(() => [carreira.atual?.id, temporada.calendario?.passoAtual, temporada.calendario?.semanaAtual, filtro.value], carregar, { immediate: true })

const pendentes = computed(() => (dados.value?.noticias ?? []).filter((n) => n.pendente))
const demais = computed(() => (dados.value?.noticias ?? []).filter((n) => !n.pendente))

async function responder(n: Noticia, escolha: string): Promise<void> {
  if (respondendo.value) return
  respondendo.value = true
  try {
    await chamar('noticias:responder', { id: n.id, escolha })
    await carreira.atualizar()
    await carregar()
    ui.avisar(pendentes.value.length ? 'Decisão registrada. Ainda há notícias esperando resposta.' : 'Decisão registrada. CONTINUAR liberado.')
  } catch (e) {
    ui.avisar((e as Error).message)
  } finally {
    respondendo.value = false
  }
}
</script>

<template>
  <h1 class="titulo-tela">Notícias</h1>
  <WePainel v-if="!carreira.atual" titulo="Sem carreira"><p>Abra uma carreira para ver as notícias.</p></WePainel>
  <template v-else-if="dados">
    <div class="filtros">
      <span class="we-lb">Tipo</span>
      <WeBotao :ativo="filtro === null" @click="filtro = null">Todas</WeBotao>
      <WeBotao v-for="t in TIPOS" :key="t" :ativo="filtro === t" @click="filtro = t">{{ ROTULO_TIPO[t] }}</WeBotao>
    </div>

    <WePainel v-for="n in pendentes" :key="n.id" titulo="Decisão necessária" clube>
      <p class="pendente__texto">
        <WeTag :tipo="TAG_TIPO[n.tipo]">{{ ROTULO_TIPO[n.tipo] }}</WeTag>
        {{ n.texto }}
      </p>
      <p class="we-lb">O CONTINUAR fica parado até você decidir.</p>
      <div class="escolhas">
        <WeBotao v-for="(o, k) in n.escolhas ?? []" :key="o.id" variante="opcao" :desabilitado="respondendo" :data-foco-inicial="k === 0 ? '' : undefined" @click="responder(n, o.id)">{{ o.texto }}</WeBotao>
      </div>
    </WePainel>

    <WePainel :titulo="`Caixa de notícias (${demais.length})`" sem-corpo>
      <p v-if="!demais.length" class="vazio">Nenhuma notícia{{ filtro ? ' deste tipo' : '' }}.</p>
      <ul v-else class="lista">
        <li v-for="n in demais" :key="n.id" :class="{ nova: !n.lida }">
          <div class="cabeca">
            <WeTag :tipo="TAG_TIPO[n.tipo]">{{ ROTULO_TIPO[n.tipo] }}</WeTag>
            <span class="we-lb">{{ n.temporada }} · semana {{ n.semana }}</span>
            <WeTag v-if="!n.lida" tipo="atencao">Nova</WeTag>
          </div>
          <p class="texto">{{ n.texto }}</p>
          <ul v-if="n.efeitos.length" class="efeitos">
            <li v-for="(e, i) in n.efeitos" :key="i" class="we-lb">{{ e }}</li>
          </ul>
          <RouterLink v-if="n.jogadorId && n.tipo !== 'mercado'" class="link we-lb" :to="{ name: 'jogador', params: { id: n.jogadorId } }">Ver jogador</RouterLink>
          <RouterLink v-else-if="n.tipo === 'mercado'" class="link we-lb" :to="{ name: 'mercado' }">Ir ao mercado</RouterLink>
        </li>
      </ul>
    </WePainel>
  </template>
</template>

<style scoped>
.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.filtros .we-btn {
  padding: 4px 10px;
}
.pendente__texto {
  font-size: 16px;
  color: var(--texto-forte);
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
}
.escolhas {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.lista {
  list-style: none;
  margin: 0;
  padding: 0;
}
.lista > li {
  padding: var(--space-3);
  border-bottom: 1px solid var(--linha);
}
.lista > li.nova {
  background: var(--painel-alt);
}
.cabeca {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
.texto {
  margin: 6px 0 0;
  color: var(--texto-forte);
}
.efeitos {
  margin: 4px 0 0;
  padding-left: 18px;
}
.link {
  display: inline-block;
  margin-top: 4px;
  color: var(--texto-forte);
}
.vazio {
  padding: var(--space-2);
  margin: 0;
}
</style>
