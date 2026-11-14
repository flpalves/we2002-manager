<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { computed } from 'vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeEscudo from '../componentes/WeEscudo.vue'
import { useUi } from '../stores/ui'
import { urlArquivoCarreira, useCarreira } from '../stores/carreira'
import { dinheiro } from '../formato'
import { useTemporada } from '../stores/temporada'

const ui = useUi()
const carreira = useCarreira()
const c = computed(() => carreira.atual)
const temporada = useTemporada()
const m = computed(() => carreira.mercado)
</script>

<template>
  <header class="topo">
    <WeEscudo
      v-if="c"
      :sigla="c.time.sigla"
      :cor="c.time.cores[0]"
      :src="urlArquivoCarreira(c.time.escudo)"
      tamanho="g"
      :nome="c.time.nome"
    />
    <WeEscudo v-else sigla="WE" :cor="ui.corClube" tamanho="g" />
    <div>
      <RouterLink v-if="c" class="topo__clube topo__clube--link" :to="{ name: 'time', params: { sigla: c.time.sigla } }">{{ c.time.nome }}</RouterLink>
      <div v-else class="topo__clube">WE2002 Manager</div>
      <div class="we-lb">{{ c ? `Técnico ${c.tecnico}` : 'Nenhuma carreira aberta' }}</div>
    </div>
    <div class="topo__info">
      <span class="we-kv"><span class="we-lb">Temporada</span><span class="we-vl">{{ c?.temporada ?? '—' }}</span></span>
      <span class="we-kv"><span class="we-lb">Semana</span><span class="we-vl">{{ c?.semana ?? '—' }}</span></span>
      <span class="we-kv">
        <span class="we-lb">Saldo</span>
        <span class="we-vl" :class="c && c.saldo < 0 ? 'we-vl--negativo' : ''">{{ c ? dinheiro(c.saldo) : '—' }}</span>
      </span>
      <span class="we-kv" title="Propostas de negociação até o próximo jogo do seu time">
        <span class="we-lb">Movimentos</span>
        <span class="we-vl" :class="{ 'we-vl--atencao': m && m.movimentos === 0 }">{{ m ? `${m.movimentos}/${m.movimentosMaximo}` : '—' }}</span>
      </span>
      <span class="we-kv">
        <span class="we-lb">Janela</span>
        <span class="we-vl" :class="m?.janelaAberta ? 'we-vl--positivo' : ''">{{ m ? (m.janelaAberta ? 'Aberta' : 'Fechada') : '—' }}</span>
      </span>
      <WeBotao icone="continuar" variante="principal" :desabilitado="temporada.avancando" @click="ui.continuar()">{{ temporada.avancando ? 'Avançando…' : 'Continuar' }}</WeBotao>
    </div>
  </header>
</template>

<style scoped>
.topo .we-kv {
  gap: 6px;
}
.topo__clube--link {
  display: block;
  color: inherit;
  text-decoration: none;
}
.topo__clube--link:hover {
  text-decoration: underline;
}
</style>
