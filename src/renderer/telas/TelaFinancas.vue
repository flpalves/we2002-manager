<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Financas } from '@shared/esquemas/mercado'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeTabela from '../componentes/WeTabela.vue'
import CampoDinheiro from '../componentes/CampoDinheiro.vue'
import TimeDaCarreira from '../componentes/TimeDaCarreira.vue'
import { useRouter } from 'vue-router'
import { useTela } from '../composables/useTela'
import { useCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { useUi } from '../stores/ui'
import { chamar } from '../api'
import { dinheiro } from '../formato'

const carreira = useCarreira()
const router = useRouter()
const temporada = useTemporada()
const ui = useUi()
const f = ref<Financas | null>(null)
const ingresso = ref(0)

useTela([{ comando: 'acaoY', rotulo: 'Diretoria' }], { acaoY: () => void router.push({ name: 'clube' }) })

async function carregar(): Promise<void> {
  if (!carreira.atual) return
  try {
    f.value = await chamar('financas:obter', undefined)
    ingresso.value = f.value.estadio.ingresso
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}
watch(() => [carreira.atual?.id, temporada.calendario?.passoAtual], carregar, { immediate: true })

async function salvarIngresso(): Promise<void> {
  try {
    f.value = await chamar('financas:ingresso', { preco: ingresso.value })
    ui.avisar(`Ingresso a ${dinheiro(f.value.estadio.ingresso)}. Público estimado: ${f.value.estadio.publicoEstimado.toLocaleString('pt-BR')}.`)
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}

const NOME_CATEGORIA: Record<string, string> = {
  bilheteria: 'Bilheteria',
  estadio: 'Custo do estádio',
  salarios: 'Salários',
  patrocinio: 'Patrocínio',
  tv: 'Cota de TV',
  premiacao: 'Premiações',
  transferencia_entrada: 'Venda de jogadores',
  transferencia_saida: 'Compra de jogadores',
  emprestimo: 'Empréstimos',
}
const categoria = (c: string) => NOME_CATEGORIA[c] ?? c

const receitas = computed(() => (f.value?.porCategoria ?? []).filter((c) => c.valor > 0))
const despesas = computed(() => (f.value?.porCategoria ?? []).filter((c) => c.valor < 0))
const total = (l: { valor: number }[]) => l.reduce((a, c) => a + c.valor, 0)
const ocupacao = computed(() => (f.value && f.value.estadio.capacidade ? Math.round((f.value.estadio.publicoEstimado / f.value.estadio.capacidade) * 100) : 0))
</script>

<template>
  <h1 class="titulo-tela">Finanças</h1>
  <WePainel v-if="!carreira.atual" titulo="Sem carreira"><p>Abra uma carreira para ver as finanças.</p></WePainel>
  <template v-else-if="f">
    <div class="resumo">
      <span class="we-kv"><span class="we-lb">Saldo</span><span class="we-vl" :class="{ 'we-vl--negativo': f.saldo < 0 }">{{ dinheiro(f.saldo) }}</span></span>
      <span class="we-kv">
        <span class="we-lb">Folha mensal</span>
        <span class="we-vl" :class="{ 'we-vl--negativo': f.folha > f.orcamentoFolha }">{{ dinheiro(f.folha) }} de {{ dinheiro(f.orcamentoFolha) }}</span>
      </span>
      <span class="we-kv"><span class="we-lb">Patrocínio / temporada</span><span class="we-vl">{{ dinheiro(f.patrocinioTemporada) }}</span></span>
      <span class="we-kv"><span class="we-lb">TV / temporada</span><span class="we-vl">{{ dinheiro(f.cotaTvTemporada) }}</span></span>
    </div>
    <p v-if="f.saldo < 0" class="aviso we-vl--negativo">Saldo negativo: contratações bloqueadas (só livres com salário dentro do orçamento) e a diretoria fica mais pressionada.</p>

    <div class="duas">
      <div class="coluna">
        <WePainel titulo="Receitas e despesas da temporada" sem-corpo>
          <WeTabela>
            <thead><tr><th>Categoria</th><th class="num">Valor</th></tr></thead>
            <tbody>
              <tr v-for="c in receitas" :key="c.categoria"><td>{{ categoria(c.categoria) }}</td><td class="num we-vl--positivo">+{{ dinheiro(c.valor) }}</td></tr>
              <tr v-for="c in despesas" :key="c.categoria"><td>{{ categoria(c.categoria) }}</td><td class="num we-vl--negativo">{{ dinheiro(c.valor) }}</td></tr>
              <tr v-if="!receitas.length && !despesas.length"><td colspan="2">Nenhum lançamento ainda (salários, patrocínio e TV a cada 4 semanas).</td></tr>
              <tr v-else class="total"><td>Resultado</td><td class="num" :class="total(f.porCategoria) < 0 ? 'we-vl--negativo' : 'we-vl--positivo'">{{ dinheiro(total(f.porCategoria)) }}</td></tr>
            </tbody>
          </WeTabela>
        </WePainel>

        <WePainel titulo="Extrato" sem-corpo>
          <p v-if="!f.extrato.length" class="vazio">Sem lançamentos.</p>
          <WeTabela v-else>
            <thead><tr><th>Sem.</th><th>Lançamento</th><th>Categoria</th><th class="num">Valor</th></tr></thead>
            <tbody>
              <tr v-for="(l, i) in f.extrato" :key="i">
                <td>{{ l.semana }}</td>
                <td>{{ l.descricao }}</td>
                <td>{{ categoria(l.categoria) }}</td>
                <td class="num" :class="l.valor < 0 ? 'we-vl--negativo' : 'we-vl--positivo'">{{ l.valor > 0 ? '+' : '' }}{{ dinheiro(l.valor) }}</td>
              </tr>
            </tbody>
          </WeTabela>
        </WePainel>
      </div>

      <div class="coluna">
        <WePainel :titulo="f.estadio.nome" clube>
          <div class="we-kv"><span class="we-lb">Capacidade</span><span class="we-vl">{{ f.estadio.capacidade.toLocaleString('pt-BR') }}</span></div>
          <div class="we-kv"><span class="we-lb">Custo por jogo</span><span class="we-vl">{{ dinheiro(f.estadio.custoPorJogo) }}</span></div>
          <div class="we-kv"><span class="we-lb">Preço de referência</span><span class="we-vl">{{ dinheiro(f.estadio.precoReferencia) }}</span></div>
          <div class="ingresso">
            <CampoDinheiro v-model="ingresso" rotulo="Ingresso" />
            <WeBotao icone="financas" variante="principal" :desabilitado="ingresso === f.estadio.ingresso" @click="salvarIngresso">Definir preço</WeBotao>
          </div>
          <p class="we-lb">Estimativa num jogo de liga contra um time médio, com o time em fase normal:</p>
          <div class="we-kv"><span class="we-lb">Público</span><span class="we-vl">{{ f.estadio.publicoEstimado.toLocaleString('pt-BR') }} ({{ ocupacao }}%)</span></div>
          <div class="we-kv"><span class="we-lb">Bilheteria</span><span class="we-vl">{{ dinheiro(f.estadio.rendaEstimada) }}</span></div>
          <div class="we-kv">
            <span class="we-lb">Lucro do jogo</span>
            <span class="we-vl" :class="f.estadio.rendaEstimada < f.estadio.custoPorJogo ? 'we-vl--negativo' : 'we-vl--positivo'">{{ dinheiro(f.estadio.rendaEstimada - f.estadio.custoPorJogo) }}</span>
          </div>
        </WePainel>

        <WePainel titulo="Últimos jogos em casa" sem-corpo>
          <p v-if="!f.estadio.ultimosJogos.length" class="vazio">Nenhum jogo em casa ainda.</p>
          <WeTabela v-else>
            <thead><tr><th>Adversário</th><th class="num">Público</th><th class="num">Renda</th></tr></thead>
            <tbody>
              <tr v-for="(j, i) in f.estadio.ultimosJogos" :key="i">
                <td><TimeDaCarreira :sigla="j.adversario" /></td>
                <td class="num">{{ j.publico.toLocaleString('pt-BR') }}</td>
                <td class="num">{{ dinheiro(j.renda) }}</td>
              </tr>
            </tbody>
          </WeTabela>
        </WePainel>
      </div>
    </div>
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
.aviso {
  margin: 0;
  font-weight: 600;
}
.duas {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 1fr);
  gap: var(--gap-painel);
  align-items: start;
}
.coluna {
  display: flex;
  flex-direction: column;
  gap: var(--gap-painel);
  min-width: 0;
}
.ingresso {
  display: flex;
  gap: var(--space-3);
  align-items: flex-end;
  margin: var(--space-3) 0;
}
.num {
  text-align: right;
}
.total td {
  font-weight: 700;
  color: var(--texto-forte);
  border-top: 2px solid var(--linha-forte);
}
.vazio {
  padding: var(--space-2);
  margin: 0;
}
</style>
