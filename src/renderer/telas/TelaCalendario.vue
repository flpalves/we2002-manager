<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import WePainel from '../componentes/WePainel.vue'
import WeTabela from '../componentes/WeTabela.vue'
import WeTag from '../componentes/WeTag.vue'
import LinhaJogo from '../componentes/LinhaJogo.vue'
import { useTela } from '../composables/useTela'
import { useTemporada } from '../stores/temporada'
import { useCarreira } from '../stores/carreira'

const temporada = useTemporada()
const carreira = useCarreira()
const soDoUsuario = ref(false)
const tabela = ref<HTMLElement | null>(null)

useTela([{ comando: 'acaoY', rotulo: 'Filtrar meus jogos' }], {
  acaoY: () => (soDoUsuario.value = !soDoUsuario.value),
})

const passos = computed(() => (temporada.calendario?.passos ?? []).filter((p) => !soDoUsuario.value || p.jogo))
const atual = computed(() => temporada.calendario?.passoAtual ?? 0)

onMounted(async () => {
  await nextTick()
  tabela.value?.querySelector('.atual')?.scrollIntoView({ block: 'center' })
})
</script>

<template>
  <h1 class="titulo-tela">Calendário {{ temporada.calendario?.temporada }}</h1>
  <WePainel v-if="!carreira.atual" titulo="Sem carreira"><p>Abra uma carreira para ver o calendário.</p></WePainel>
  <WePainel v-else titulo="Datas da temporada" sem-corpo>
    <template #extra>
      <label class="filtro"><input v-model="soDoUsuario" type="checkbox" /> só os jogos do {{ carreira.atual.time.nome }}</label>
    </template>
    <div ref="tabela" class="rolagem">
      <WeTabela>
        <thead>
          <tr><th>Sem.</th><th>Data</th><th>Jogo do {{ carreira.atual.time.nome }}</th><th>Competição</th><th>Competições na data</th></tr>
        </thead>
        <tbody>
          <tr v-for="p in passos" :key="p.indice" :class="{ atual: p.indice === atual, 'we-destaque': p.indice === atual }">
            <td>{{ p.semana }}</td>
            <td>
              {{ p.tipo === 'fds' ? 'Fim de semana' : 'Meio de semana' }}
              <WeTag v-if="p.indice === atual" tipo="atencao">Próxima</WeTag>
            </td>
            <td class="jogo">
              <LinhaJogo v-if="p.jogo" :jogo="p.jogo" :destaque="carreira.atual.time.sigla" />
              <span v-else class="we-lb">Data vazia</span>
            </td>
            <td>{{ p.jogo ? `${p.jogo.competicaoNome} · ${p.jogo.faseNome}` : '' }}</td>
            <td class="we-lb">{{ p.competicoes.join(', ') }}</td>
          </tr>
        </tbody>
      </WeTabela>
    </div>
  </WePainel>
</template>

<style scoped>
.rolagem {
  max-height: calc(100vh - 210px);
  overflow: auto;
}
.jogo {
  min-width: 360px;
}
.filtro {
  display: flex;
  gap: 6px;
  align-items: center;
}
</style>
