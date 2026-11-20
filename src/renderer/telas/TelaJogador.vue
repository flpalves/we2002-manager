<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FichaJogador } from '@shared/esquemas/elenco'
import { APARENCIA_PADRAO, ATRIBUTOS, CABELOS, ROTULO_ATRIBUTO, type Aparencia } from '@shared/esquemas/pacote'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeTabela from '../componentes/WeTabela.vue'
import WeTag from '../componentes/WeTag.vue'
import WeSeta from '../componentes/WeSeta.vue'
import BarraCondicao from '../componentes/BarraCondicao.vue'
import TimeDaCarreira from '../componentes/TimeDaCarreira.vue'
import WeBandeira from '../componentes/WeBandeira.vue'
import { nomePais } from '../bandeiras'
import { useTela } from '../composables/useTela'
import { useUi } from '../stores/ui'
import { chamar } from '../api'
import { dinheiro, geralTexto, nomePosicao } from '../formato'

const rota = useRoute()
const router = useRouter()
const ui = useUi()
const f = ref<FichaJogador | null>(null)
const aparencia = ref<Aparencia | null>(null)

useTela()

watch(
  () => rota.params['id'],
  async (id) => {
    if (typeof id !== 'string') return
    try {
      f.value = await chamar('elenco:ficha', { id })
      aparencia.value = f.value.aparencia ? { ...f.value.aparencia } : null
    } catch (e) {
      ui.avisar((e as Error).message)
    }
  },
  { immediate: true },
)

const NOME_SETA = { otima: 'Ótima', boa: 'Boa', normal: 'Normal', ruim: 'Ruim', pessima: 'Péssima' } as const
const potencial = computed(() => (f.value ? (f.value.potencial.min === f.value.potencial.max ? `${f.value.potencial.min}` : `${f.value.potencial.min}-${f.value.potencial.max}`) : ''))
const letras = (ate: string) => Array.from({ length: ate.charCodeAt(0) - 64 }, (_, i) => String.fromCharCode(65 + i))
const alterada = computed(() => JSON.stringify(aparencia.value) !== JSON.stringify(f.value?.aparencia ?? null))

async function salvarAparencia(): Promise<void> {
  if (!f.value) return
  try {
    f.value = await chamar('elenco:salvarAparencia', { id: f.value.id, aparencia: aparencia.value })
    ui.avisar('Aparência salva. Vale a partir do próximo jogo no WE.')
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}

const ROTULO_MOTIVO: Record<string, string> = { evolucao: 'treino', declinio: 'idade', noticia: 'notícia', oscilacao: 'oscilação' }
</script>

<template>
  <h1 class="titulo-tela">Ficha do jogador</h1>
  <template v-if="f">
    <div class="grade">
      <WePainel :titulo="f.nome" clube>
        <template #extra>Nº {{ f.camisa }}</template>
        <div class="we-kv"><span class="we-lb">Clube</span><span class="we-vl"><TimeDaCarreira :sigla="f.time" /></span></div>
        <div class="we-kv"><span class="we-lb">Nome no WE</span><span class="we-vl">{{ f.nomeWe }}</span></div>
        <div class="we-kv">
          <span class="we-lb">Posição</span>
          <span class="we-vl">{{ nomePosicao(f.posicao) }}{{ f.posicaoSecundaria ? ` / ${nomePosicao(f.posicaoSecundaria)}` : '' }}</span>
        </div>
        <div class="we-kv"><span class="we-lb">Idade · nacionalidade</span><span class="we-vl nac">{{ f.idade }} · <WeBandeira :codigo="f.nacionalidade" /> {{ nomePais(f.nacionalidade) }}</span></div>
        <div class="we-kv"><span class="we-lb">Pé · altura</span><span class="we-vl">{{ f.pe }} · {{ f.altura }} cm</span></div>
        <div class="we-kv"><span class="we-lb">Contrato</span><span class="we-vl">até {{ f.contratoAte ?? '—' }} · {{ f.salario ? dinheiro(f.salario) : '—' }}/mês</span></div>
        <div class="acoes"><WeBotao icone="voltar" @click="router.back()">Voltar</WeBotao></div>
      </WePainel>

      <WePainel titulo="Situação">
        <div class="we-kv"><span class="we-lb">Geral</span><span class="we-vl grande">{{ geralTexto(f.geral) }}</span></div>
        <div class="we-kv"><span class="we-lb">Potencial (estimado)</span><span class="we-vl">{{ potencial }}</span></div>
        <div class="we-kv"><span class="we-lb">Condição</span><BarraCondicao :valor="f.condicao" /></div>
        <div class="we-kv"><span class="we-lb">Moral</span><BarraCondicao :valor="f.moral" rotulo="Moral" /></div>
        <div class="we-kv"><span class="we-lb">Seta no WE</span><span class="we-vl seta"><WeSeta :nivel="f.seta" /> {{ NOME_SETA[f.seta] }}</span></div>
        <div class="tags">
          <WeTag v-if="f.lesaoSemanas" tipo="negativo">Lesão: {{ f.lesaoSemanas }} semana(s)</WeTag>
          <WeTag v-for="c in f.suspenso" :key="`s${c}`" tipo="negativo">Suspenso: {{ c }}</WeTag>
          <WeTag v-for="c in f.pendurado" :key="`p${c}`" tipo="atencao">Pendurado: {{ c }}</WeTag>
        </div>
      </WePainel>
    </div>

    <WePainel titulo="Atributos" sem-corpo>
      <template #extra>1-20 no manager · número que o WE mostra (12-19, já com a condição)</template>
      <div class="atributos">
        <div v-for="a in ATRIBUTOS" :key="a" class="atributo">
          <span class="we-lb">{{ ROTULO_ATRIBUTO[a] }}</span>
          <span class="trilho"><span class="cheio" :style="{ width: `${(f.atributos[a]! / 20) * 100}%` }"></span></span>
          <span class="valor">{{ f.atributos[a] }}</span>
          <span class="we" :title="'No WE'">{{ f.atributosWe[a] }}</span>
        </div>
        <div class="atributo"><span class="we-lb">OUTSIDE</span><span></span><span class="valor">{{ f.outside ? 'Sim' : 'Não' }}</span></div>
      </div>
    </WePainel>

    <div class="grade">
      <WePainel titulo="Temporada" sem-corpo>
        <p v-if="!f.historico.length" class="vazio">Ainda não jogou nesta temporada.</p>
        <WeTabela v-else>
          <thead><tr><th>Competição</th><th>J</th><th>Min.</th><th>Gols</th><th>Assist.</th><th>Am.</th><th>Verm.</th></tr></thead>
          <tbody>
            <tr v-for="h in f.historico" :key="h.competicao">
              <td>{{ h.competicao }}</td><td>{{ h.jogos }}</td><td>{{ h.minutos }}</td><td>{{ h.gols }}</td><td>{{ h.assistencias }}</td><td>{{ h.amarelos }}</td><td>{{ h.vermelhos }}</td>
            </tr>
          </tbody>
        </WeTabela>
      </WePainel>

      <WePainel titulo="Evolução recente" sem-corpo>
        <p v-if="!f.evolucoes.length" class="vazio">Nenhuma mudança de atributo ainda.</p>
        <WeTabela v-else>
          <tbody>
            <tr v-for="(e, i) in f.evolucoes" :key="i">
              <td>Semana {{ e.semana }}</td>
              <td>{{ ROTULO_ATRIBUTO[e.atributo as keyof typeof ROTULO_ATRIBUTO] ?? e.atributo }}</td>
              <td :class="e.delta > 0 ? 'we-vl--positivo' : 'we-vl--negativo'">{{ e.delta > 0 ? `+${e.delta}` : `−${-e.delta}` }}</td>
              <td class="we-lb">{{ ROTULO_MOTIVO[e.motivo] ?? 'treino' }}</td>
            </tr>
          </tbody>
        </WeTabela>
      </WePainel>

      <WePainel titulo="Aparência no WE">
        <template v-if="aparencia">
          <div class="campos">
            <label class="campo"><span class="we-lb">Pele</span><select v-model.number="aparencia.pele"><option v-for="n in 4" :key="n" :value="n">{{ n }}</option></select></label>
            <label class="campo"><span class="we-lb">Físico</span><select v-model="aparencia.fisico"><option v-for="l in letras('H')" :key="l">{{ l }}</option></select></label>
            <label class="campo"><span class="we-lb">Cabelo</span><select v-model="aparencia.cabelo"><option v-for="c in CABELOS" :key="c">{{ c }}</option></select></label>
            <label class="campo"><span class="we-lb">Cor do cabelo</span><select v-model="aparencia.cor_cabelo"><option v-for="l in letras('H')" :key="l">{{ l }}</option></select></label>
            <label class="campo"><span class="we-lb">Barba</span><select v-model="aparencia.barba"><option v-for="l in letras('G')" :key="l">{{ l }}</option></select></label>
            <label class="campo"><span class="we-lb">Cor da barba</span><select v-model="aparencia.cor_barba"><option v-for="l in letras('G')" :key="l">{{ l }}</option></select></label>
            <label class="campo"><span class="we-lb">Chuteira</span><select v-model="aparencia.chuteira"><option v-for="l in letras('H')" :key="l">{{ l }}</option></select></label>
          </div>
        </template>
        <p v-else class="we-lb">Sem aparência definida: o WE mantém a do jogador original da vaga.</p>
        <div class="acoes">
          <WeBotao icone="jogador" @click="aparencia = aparencia ? null : { ...APARENCIA_PADRAO }">{{ aparencia ? 'Usar a original' : 'Definir aparência' }}</WeBotao>
          <WeBotao icone="salvar" :desabilitado="!alterada" @click="salvarAparencia">Salvar aparência</WeBotao>
        </div>
      </WePainel>
    </div>
  </template>
</template>

<style scoped>
.grande {
  font-size: 20px;
}
.seta {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.atributos {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 4px var(--space-6);
  padding: var(--space-2);
}
.atributo {
  display: grid;
  grid-template-columns: 70px 1fr 24px 24px;
  gap: 8px;
  align-items: center;
}
.trilho {
  height: 6px;
  background: var(--linha);
  border-radius: 1px;
  overflow: hidden;
}
.cheio {
  display: block;
  height: 100%;
  background: var(--clube);
}
.valor {
  font-family: var(--font-display);
  font-weight: 700;
  text-align: right;
  color: var(--texto-forte);
}
.we {
  text-align: right;
  color: var(--texto-suave);
  font-variant-numeric: tabular-nums;
}
.vazio {
  padding: var(--space-2);
  margin: 0;
}
.nac {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
