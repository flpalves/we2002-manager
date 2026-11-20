<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { BalancoTemporada, PreviaVirada, RelatorioTemporada } from '@shared/esquemas/temporada'
import TimeDaCarreira from '../componentes/TimeDaCarreira.vue'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeTabela from '../componentes/WeTabela.vue'
import WeTag from '../componentes/WeTag.vue'
import { useTela } from '../composables/useTela'
import { dinheiro, nomePosicao } from '../formato'
import { useCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { useUi } from '../stores/ui'
import { chamar } from '../api'

/**
 * Fim de temporada (03-competicoes, virada): balanço, contratos que vão acabar (pendência de
 * renovação) e o botão que inicia a temporada seguinte. Depois da virada mostra o relatório.
 */
const router = useRouter()
const carreira = useCarreira()
const temporada = useTemporada()
const ui = useUi()
const previa = ref<PreviaVirada | null>(null)
const relatorio = ref<RelatorioTemporada | null>(null)
const ocupado = ref(false)

const balanco = computed<BalancoTemporada | null>(() => relatorio.value ?? previa.value)
const sairiam = computed(() => {
  const p = previa.value
  return p ? Math.max(0, Math.min(p.contratosAcabando.length, p.elencoAtual - p.minimoElenco)) : 0
})

useTela([{ comando: 'acaoX', rotulo: 'Avançar' }], {
  acaoX: () => (relatorio.value ? void router.push({ name: relatorio.value.demitido ? 'clube' : 'inicio' }) : void virar()),
})

onMounted(async () => {
  try {
    previa.value = await chamar('virada:previa', undefined)
  } catch (e) {
    ui.avisar((e as Error).message, 6000)
    void router.replace({ name: 'inicio' })
  }
})

async function virar(): Promise<void> {
  if (ocupado.value || !previa.value) return
  ocupado.value = true
  try {
    relatorio.value = await chamar('virada:executar', undefined)
    await temporada.recarregar()
    await carreira.atualizar()
    ui.avisar(`Começa a temporada ${relatorio.value.proximaTemporada}.`, 6000)
  } catch (e) {
    ui.avisar((e as Error).message, 8000)
  } finally {
    ocupado.value = false
  }
}
</script>

<template>
  <h1 class="titulo-tela">Fim da temporada {{ balanco?.temporada ?? '' }}</h1>
  <template v-if="balanco">
    <WePainel titulo="Campeões" sem-corpo>
      <WeTabela>
        <tbody>
          <tr v-for="c in balanco.campeoes" :key="c.competicao">
            <td>{{ c.competicao }}</td>
            <td><TimeDaCarreira :sigla="c.time" /></td>
          </tr>
        </tbody>
      </WeTabela>
    </WePainel>

    <WePainel titulo="Sua campanha" clube sem-corpo>
      <WeTabela>
        <tbody>
          <tr v-for="c in balanco.campanhas" :key="c.competicao">
            <td>{{ c.competicao }}</td>
            <td>
              <WeTag v-if="c.campeao" tipo="positivo">Campeão</WeTag>
              <span v-else-if="c.posicao">{{ c.posicao }}º lugar</span>
              <span v-else class="we-lb">eliminado</span>
            </td>
          </tr>
        </tbody>
      </WeTabela>
    </WePainel>

    <WePainel v-if="balanco.movimentos.length" titulo="Acesso e rebaixamento" sem-corpo>
      <WeTabela>
        <tbody>
          <tr v-for="m in balanco.movimentos" :key="m.time">
            <td><TimeDaCarreira :sigla="m.time" /></td>
            <td>
              <WeTag :tipo="m.tipo === 'acesso' ? 'positivo' : 'negativo'">{{ m.tipo === 'acesso' ? 'Sobe' : 'Cai' }}</WeTag>
            </td>
            <td class="we-lb">{{ m.de }} → {{ m.para }}</td>
          </tr>
        </tbody>
      </WeTabela>
    </WePainel>

    <WePainel v-if="balanco.artilheiros.length" titulo="Artilheiros" sem-corpo>
      <WeTabela>
        <tbody>
          <tr v-for="a in balanco.artilheiros" :key="a.competicao">
            <td>{{ a.competicao }}</td>
            <td>{{ a.jogador }}</td>
            <td><TimeDaCarreira :sigla="a.time" /></td>
            <td>{{ a.gols }} gols</td>
          </tr>
        </tbody>
      </WeTabela>
    </WePainel>

    <!-- Antes da virada: pendência de renovação e o botão. -->
    <template v-if="previa && !relatorio">
      <WePainel titulo="Contratos que terminam" sem-corpo>
        <p v-if="!previa.contratosAcabando.length" class="vazio">Nenhum contrato do seu elenco termina agora.</p>
        <template v-else>
          <p class="aviso">
            {{ previa.renovacaoAberta === false
              ? `O prazo de renovação (semana ${previa.semanaLimiteRenovacao}) acabou: quem não renovou sai na virada (livre ou pelo pré-contrato).`
              : 'Quem não for renovado em Mercado sai livre na virada.' }}
            {{ sairiam < previa.contratosAcabando.length
              ? `O elenco não pode ficar com menos de ${previa.minimoElenco}: a diretoria renova por 1 temporada os melhores que faltarem (sairiam ${sairiam}).`
              : '' }}
          </p>
          <WeTabela>
            <tbody>
              <tr v-for="j in previa.contratosAcabando" :key="j.id">
                <td>{{ j.nome }}</td>
                <td class="we-lb">{{ nomePosicao(j.posicao) }}</td>
                <td class="we-lb">{{ j.idade }} anos</td>
                <td>{{ j.geral.toFixed(1) }}</td>
                <td v-if="j.preContrato"><WeTag tipo="atencao">Pré-contrato com o {{ j.preContrato }}</WeTag></td>
                <td v-else-if="previa.renovacaoAberta === false"><WeTag tipo="negativo">Sai livre</WeTag></td>
                <td v-else><WeBotao icone="contrato" @click="router.push({ name: 'mercado', query: { renovar: j.id } })">Renovar</WeBotao></td>
              </tr>
            </tbody>
          </WeTabela>
        </template>
      </WePainel>
      <WePainel v-if="previa.chegam?.length" titulo="Chegam por pré-contrato" sem-corpo>
        <WeTabela>
          <tbody>
            <tr v-for="j in previa.chegam" :key="j.id">
              <td>{{ j.nome }}</td>
              <td class="we-lb">{{ nomePosicao(j.posicao) }}</td>
              <td class="we-lb">do {{ j.de }}</td>
            </tr>
          </tbody>
        </WeTabela>
      </WePainel>
      <div class="acoes">
        <WeBotao icone="continuar" variante="principal" :desabilitado="ocupado" data-foco-inicial @click="virar">Iniciar a temporada {{ previa.temporada + 1 }}</WeBotao>
      </div>
    </template>

    <!-- Depois da virada: diretoria e contratos. -->
    <template v-if="relatorio">
      <WePainel titulo="Diretoria" clube>
        <WeTabela>
          <tbody>
            <tr v-for="m in relatorio.metas" :key="m.descricao">
              <td>{{ m.descricao }}</td>
              <td><WeTag :tipo="m.atingida ? 'positivo' : 'negativo'">{{ m.atingida ? 'Cumprida' : 'Não cumprida' }}</WeTag></td>
            </tr>
          </tbody>
        </WeTabela>
        <p>Confiança: {{ relatorio.confianca }}% · Saldo: {{ dinheiro(relatorio.saldo) }}</p>
        <p v-if="relatorio.demitido" class="aviso">Você foi demitido. Escolha um novo clube em Clube e diretoria.</p>
      </WePainel>
      <WePainel v-if="relatorio.saidas.length || relatorio.renovadosPelaDiretoria.length || relatorio.voltaramDeEmprestimo.length || relatorio.chegaramPorPreContrato?.length" titulo="Contratos">
        <p v-if="relatorio.chegaramPorPreContrato?.length">Chegaram por pré-contrato: {{ relatorio.chegaramPorPreContrato.join(', ') }}.</p>
        <p v-if="relatorio.saidas.length">Saíram: {{ relatorio.saidas.join(', ') }}.</p>
        <p v-if="relatorio.renovadosPelaDiretoria.length">Renovados por 1 temporada pela diretoria: {{ relatorio.renovadosPelaDiretoria.join(', ') }}.</p>
        <p v-if="relatorio.voltaramDeEmprestimo.length">Voltaram de empréstimo: {{ relatorio.voltaramDeEmprestimo.join(', ') }}.</p>
      </WePainel>
      <div class="acoes">
        <WeBotao icone="continuar" variante="principal" data-foco-inicial @click="router.push({ name: relatorio.demitido ? 'clube' : 'inicio' })">
          {{ relatorio.demitido ? 'Escolher novo clube' : `Ir para a temporada ${relatorio.proximaTemporada}` }}
        </WeBotao>
      </div>
    </template>
  </template>
</template>

<style scoped>
.acoes {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
.vazio,
.aviso {
  padding: var(--space-2);
  margin: 0;
}
</style>
