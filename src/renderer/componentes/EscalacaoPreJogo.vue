<script setup lang="ts">
import type { PreJogo } from '@shared/esquemas/we'
import WePainel from './WePainel.vue'
import WeTabela from './WeTabela.vue'
import WeSeta from './WeSeta.vue'
import WeTag from './WeTag.vue'
import { nomePosicao } from '../formato'
import { useTemporada } from '../stores/temporada'

/** Convocados de um lado no pré-jogo: titulares nas vagas da formação, reservas e desfalques. */
defineProps<{ lado: PreJogo['casa']; usuario: boolean }>()
const temporada = useTemporada()
</script>

<template>
  <WePainel :titulo="temporada.nome(lado.sigla)" :clube="usuario" sem-corpo>
    <template #extra>{{ lado.formacao }} · uniforme {{ lado.uniforme }}</template>
    <WeTabela>
      <thead>
        <tr><th>Nº</th><th>Vaga</th><th>Jogador</th><th>Cond.</th><th>Seta</th></tr>
      </thead>
      <tbody>
        <tr v-for="j in lado.titulares" :key="j.id">
          <td>{{ j.camisa }}</td>
          <td>{{ nomePosicao(j.posicao) }}</td>
          <td>{{ j.nome }}</td>
          <td>{{ j.condicao }}</td>
          <td><WeSeta :nivel="j.seta" /></td>
        </tr>
        <tr class="separador"><td colspan="5"><span class="we-lb">Reservas</span></td></tr>
        <tr v-for="j in lado.reservas" :key="j.id" class="reserva">
          <td>{{ j.camisa }}</td>
          <td>{{ nomePosicao(j.posicao) }}</td>
          <td>{{ j.nome }}</td>
          <td>{{ j.condicao }}</td>
          <td><WeSeta :nivel="j.seta" /></td>
        </tr>
      </tbody>
    </WeTabela>
    <div v-if="lado.desfalques.length" class="desfalques">
      <span class="we-lb">Desfalques</span>
      <span v-for="d in lado.desfalques" :key="d.nome"><WeTag tipo="negativo">{{ d.motivo }}</WeTag> {{ d.nome }}</span>
    </div>
  </WePainel>
</template>

<style scoped>
.separador td {
  background: var(--painel-fundo) !important;
  padding-top: 2px;
  padding-bottom: 2px;
}
.reserva td {
  color: var(--texto-suave);
}
.desfalques {
  display: flex;
  flex-wrap: wrap;
  gap: 6px var(--space-4);
  padding: var(--space-2);
  border-top: 1px solid var(--linha);
}
</style>
