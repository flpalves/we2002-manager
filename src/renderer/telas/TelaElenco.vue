<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Elenco } from '@shared/esquemas/elenco'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import TabelaElenco from '../componentes/TabelaElenco.vue'
import { useTela } from '../composables/useTela'
import { useCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { useUi } from '../stores/ui'
import { chamar } from '../api'
import { NOME_ORDEM_ELENCO, ORDENS_ELENCO, ordenarElenco, type OrdemElenco } from '../formato'

const carreira = useCarreira()
const temporada = useTemporada()
const ui = useUi()
const dados = ref<Elenco | null>(null)

const ordem = ref<OrdemElenco>('posicao')
const ORDENS = ORDENS_ELENCO
const NOME_ORDEM = NOME_ORDEM_ELENCO

useTela([{ comando: 'acaoY', rotulo: 'Ordenar' }], {
  acaoY: () => (ordem.value = ORDENS[(ORDENS.indexOf(ordem.value) + 1) % ORDENS.length]!),
})

async function carregar(): Promise<void> {
  if (!carreira.atual) return
  try {
    dados.value = await chamar('elenco:listar', undefined)
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}
watch(() => [carreira.atual?.id, temporada.calendario?.passoAtual, temporada.calendario?.semanaAtual], carregar, { immediate: true })

const jogadores = computed(() => ordenarElenco(dados.value?.jogadores ?? [], ordem.value))

const resumo = computed(() => {
  const js = dados.value?.jogadores ?? []
  return {
    condicao: js.length ? Math.round(js.reduce((a, j) => a + j.condicao, 0) / js.length) : 0,
    lesionados: js.filter((j) => j.lesaoSemanas > 0).length,
    suspensos: js.filter((j) => j.suspenso.length).length,
    pendurados: js.filter((j) => j.pendurado.length).length,
    contratos: js.filter((j) => j.contratoAte !== null && carreira.atual && j.contratoAte <= carreira.atual.temporada).length,
  }
})
</script>

<template>
  <h1 class="titulo-tela">Elenco</h1>
  <WePainel v-if="!carreira.atual" titulo="Sem carreira"><p>Abra uma carreira para ver o elenco.</p></WePainel>
  <template v-else-if="dados">
    <div class="resumo">
      <span class="we-kv"><span class="we-lb">Jogadores</span><span class="we-vl">{{ dados.jogadores.length }}</span></span>
      <span class="we-kv"><span class="we-lb">Condição média</span><span class="we-vl">{{ resumo.condicao }}%</span></span>
      <span class="we-kv"><span class="we-lb">Entrosamento</span><span class="we-vl">{{ Math.round(dados.entrosamento) }}</span></span>
      <span class="we-kv"><span class="we-lb">Lesionados</span><span class="we-vl" :class="{ 'we-vl--negativo': resumo.lesionados }">{{ resumo.lesionados }}</span></span>
      <span class="we-kv"><span class="we-lb">Suspensos</span><span class="we-vl" :class="{ 'we-vl--negativo': resumo.suspensos }">{{ resumo.suspensos }}</span></span>
      <span class="we-kv"><span class="we-lb">Pendurados</span><span class="we-vl" :class="{ 'we-vl--atencao': resumo.pendurados }">{{ resumo.pendurados }}</span></span>
      <span class="we-kv"><span class="we-lb">Contratos acabando</span><span class="we-vl" :class="{ 'we-vl--atencao': resumo.contratos }">{{ resumo.contratos }}</span></span>
      <span class="ordem">
        <span class="we-lb">Ordenar</span>
        <WeBotao v-for="o in ORDENS" :key="o" :ativo="ordem === o" @click="ordem = o">{{ NOME_ORDEM[o] }}</WeBotao>
      </span>
    </div>
    <WePainel :titulo="`Elenco do ${carreira.atual.time.nome}`" sem-corpo>
      <TabelaElenco :jogadores="jogadores" :temporada="carreira.atual.temporada" />
    </WePainel>
  </template>
</template>

<style scoped>
.resumo {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
  align-items: center;
}
.resumo .we-kv {
  gap: 6px;
}
.ordem {
  margin-left: auto;
  display: flex;
  gap: 6px;
  align-items: center;
}
.ordem .we-btn {
  padding: 4px 10px;
}
</style>
