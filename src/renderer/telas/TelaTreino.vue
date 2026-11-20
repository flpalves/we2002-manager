<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { Treino } from '@shared/esquemas/elenco'
import { ROTULO_ATRIBUTO } from '@shared/esquemas/pacote'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeTabela from '../componentes/WeTabela.vue'
import BarraCondicao from '../componentes/BarraCondicao.vue'
import { useTela } from '../composables/useTela'
import { useCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { useUi } from '../stores/ui'
import { chamar } from '../api'
import { nomeFoco } from '../formato'

const carreira = useCarreira()
const temporada = useTemporada()
const ui = useUi()
const t = ref<Treino | null>(null)

useTela()

async function carregar(): Promise<void> {
  if (!carreira.atual) return
  try {
    t.value = await chamar('treino:obter', undefined)
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}
watch(() => [carreira.atual?.id, temporada.calendario?.passoAtual, temporada.calendario?.semanaAtual], carregar, { immediate: true })

async function escolher(foco: Treino['foco']): Promise<void> {
  try {
    t.value = await chamar('treino:definir', { foco })
    ui.avisar(`Foco do treino: ${nomeFoco(foco)}. Vale a partir desta semana.`)
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}

const rotulo = (a: string) => ROTULO_ATRIBUTO[a as keyof typeof ROTULO_ATRIBUTO] ?? a
const pct = (f: number) => (f === 1 ? 'normal' : `${f > 1 ? '+' : '−'}${Math.round(Math.abs(f - 1) * 100)}%`)

function resumo(f: Treino['focos'][number]): string {
  const partes: string[] = []
  partes.push(f.atributos.length ? `Evolui: ${f.atributos.map(rotulo).join(', ')}` : 'Não evolui atributos')
  partes.push(`recuperação ${pct(f.recuperacao)}`)
  partes.push(`lesão ${pct(f.lesao)}`)
  partes.push(f.entrosamento > 0 ? `entrosamento +${f.entrosamento}/semana` : `entrosamento ${f.entrosamento}/semana`)
  return partes.join(' · ')
}

const atual = computed(() => t.value?.focos.find((f) => f.id === t.value?.foco) ?? null)

const ROTULO_MOTIVO: Record<string, string> = { evolucao: 'treino', declinio: 'idade', noticia: 'notícia', oscilacao: 'oscilação' }
</script>

<template>
  <h1 class="titulo-tela">Treino</h1>
  <WePainel v-if="!carreira.atual" titulo="Sem carreira"><p>Abra uma carreira para definir o treino.</p></WePainel>
  <template v-else-if="t">
    <div class="duas">
      <WePainel titulo="Foco da semana" clube>
        <p class="we-lb">Um foco para o time todo; vale até ser trocado. A evolução acontece a cada semana, pelo potencial, idade e minutos jogados.</p>
        <div class="focos">
          <WeBotao v-for="f in t.focos" :key="f.id" variante="opcao" :ativo="t.foco === f.id" :sub="resumo(f)" @click="escolher(f.id)">
            {{ nomeFoco(f.id) }}
          </WeBotao>
        </div>
      </WePainel>

      <div class="coluna">
        <WePainel titulo="Estado do elenco">
          <div class="we-kv"><span class="we-lb">Foco atual</span><span class="we-vl">{{ nomeFoco(t.foco) }}</span></div>
          <div class="we-kv"><span class="we-lb">Condição média</span><BarraCondicao :valor="t.condicaoMedia" /></div>
          <div class="we-kv"><span class="we-lb">Moral média</span><BarraCondicao :valor="t.moralMedia" rotulo="Moral" /></div>
          <div class="we-kv"><span class="we-lb">Entrosamento</span><BarraCondicao :valor="t.entrosamento" rotulo="Entrosamento" /></div>
          <div class="we-kv"><span class="we-lb">Lesionados</span><span class="we-vl" :class="{ 'we-vl--negativo': t.lesionados }">{{ t.lesionados }}</span></div>
          <p v-if="atual" class="we-lb">{{ resumo(atual) }}</p>
        </WePainel>

        <WePainel titulo="Evolução recente" sem-corpo>
          <p v-if="!t.evolucoes.length" class="vazio">Nenhuma mudança de atributo ainda nesta temporada.</p>
          <WeTabela v-else>
            <thead><tr><th>Sem.</th><th>Jogador</th><th>Atributo</th><th></th></tr></thead>
            <tbody>
              <tr v-for="(e, i) in t.evolucoes" :key="i">
                <td>{{ e.semana }}</td>
                <td><RouterLink class="link" :to="{ name: 'jogador', params: { id: e.jogadorId } }">{{ e.jogador }}</RouterLink></td>
                <td>{{ rotulo(e.atributo) }}</td>
                <td :class="e.delta > 0 ? 'we-vl--positivo' : 'we-vl--negativo'">{{ e.delta > 0 ? `+${e.delta}` : `−${-e.delta}` }} <span class="we-lb">({{ ROTULO_MOTIVO[e.motivo] ?? 'treino' }})</span></td>
              </tr>
            </tbody>
          </WeTabela>
        </WePainel>
      </div>
    </div>
  </template>
</template>

<style scoped>
.duas {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 1fr);
  gap: var(--gap-painel);
  align-items: start;
}
.coluna {
  display: flex;
  flex-direction: column;
  gap: var(--gap-painel);
}
.focos {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.vazio {
  padding: var(--space-2);
  margin: 0;
}
.link {
  color: var(--texto-forte);
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}
</style>
