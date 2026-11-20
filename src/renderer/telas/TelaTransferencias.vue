<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { ListaTransferencias, Transferencia } from '@shared/esquemas/time'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeTabela from '../componentes/WeTabela.vue'
import WeTag from '../componentes/WeTag.vue'
import WeBandeira from '../componentes/WeBandeira.vue'
import WeSeletorTime from '../componentes/WeSeletorTime.vue'
import TimeDaCarreira from '../componentes/TimeDaCarreira.vue'
import WeThOrdem from '../componentes/WeThOrdem.vue'
import WePaginacao from '../componentes/WePaginacao.vue'
import { useOrdenacao } from '../composables/useOrdenacao'
import { useTela } from '../composables/useTela'
import { useCarreira, urlArquivoCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { useUi } from '../stores/ui'
import { chamar } from '../api'
import { dinheiro, nomePosicao, nomeTipoTransferencia, ORDEM_POSICAO, ordenarPor } from '../formato'

/** Todas as transferências da temporada, de todos os clubes ou de um só (?time=SIG). */
const rota = useRoute()
const router = useRouter()
const carreira = useCarreira()
const temporada = useTemporada()
const ui = useUi()
const dados = ref<ListaTransferencias | null>(null)

const time = ref(typeof rota.query['time'] === 'string' ? rota.query['time'] : '')
const ano = ref<number | undefined>(undefined)

useTela([{ comando: 'acaoX', rotulo: 'Meu clube' }, { comando: 'acaoY', rotulo: 'Todos os clubes' }], {
  acaoX: () => (time.value = carreira.atual?.time.sigla ?? ''),
  acaoY: () => (time.value = ''),
})

watch(
  () => rota.query['time'],
  (q) => (time.value = typeof q === 'string' ? q : ''),
)
watch(time, (t) => {
  if ((rota.query['time'] ?? '') !== t) void router.replace({ query: t ? { time: t } : {} })
})

async function carregar(): Promise<void> {
  if (!carreira.atual) return
  try {
    dados.value = await chamar('time:transferencias', { ...(time.value && { sigla: time.value }), ...(ano.value !== undefined && { temporada: ano.value }) })
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}
watch(() => [time.value, ano.value, carreira.atual?.id, temporada.calendario?.passoAtual, temporada.calendario?.semanaAtual], carregar, { immediate: true })

const opcoes = computed(() => [...temporada.times.values()].map((t) => ({ sigla: t.sigla, nome: t.nome, cores: t.cores })))
const escudo = (sigla: string) => urlArquivoCarreira(temporada.times.get(sigla)?.escudo ?? null)
const nomeTime = computed(() => (time.value ? (temporada.times.get(time.value)?.nome ?? time.value) : null))
const titulo = computed(() => `Transferências ${dados.value?.temporada ?? ''}${nomeTime.value ? ` · ${nomeTime.value}` : ' · todos os clubes'}`)
const totalMovimentado = computed(() => (dados.value?.lista ?? []).reduce((a, t) => a + t.valor, 0))

// Ordenação pelos títulos e páginas de 100 (a lista de todos os clubes passa de mil negócios).
type Coluna = 'semana' | 'jogador' | 'posicao' | 'idade' | 'de' | 'para' | 'tipo' | 'valor' | 'salario'
const POR_PAGINA = 100
const nomeDe = (sigla: string | null) => (sigla ? (temporada.times.get(sigla)?.nome ?? sigla) : null)
const CHAVE: Record<Coluna, (t: Transferencia) => number | string | null> = {
  semana: (t) => t.semana,
  jogador: (t) => t.jogador,
  posicao: (t) => ORDEM_POSICAO.indexOf(t.posicao),
  idade: (t) => t.idade,
  de: (t) => nomeDe(t.de),
  para: (t) => nomeDe(t.para),
  tipo: (t) => nomeTipoTransferencia(t.tipo),
  valor: (t) => t.valor,
  salario: (t) => t.salario,
}
const CRESCENTE: Record<Coluna, boolean> = { semana: false, jogador: true, posicao: true, idade: true, de: true, para: true, tipo: true, valor: false, salario: false }
const COLUNAS: { rotulo: string; chave: Coluna }[] = [
  { rotulo: 'Sem.', chave: 'semana' },
  { rotulo: 'Jogador', chave: 'jogador' },
  { rotulo: 'Pos.', chave: 'posicao' },
  { rotulo: 'Idade', chave: 'idade' },
  { rotulo: 'De', chave: 'de' },
  { rotulo: 'Para', chave: 'para' },
  { rotulo: 'Tipo', chave: 'tipo' },
  { rotulo: 'Valor', chave: 'valor' },
  { rotulo: 'Salário', chave: 'salario' },
]
const { ordem, crescente, ordenar } = useOrdenacao<Coluna>('semana', (k) => CRESCENTE[k])
const pagina = ref(1)
// A lista do servidor já vem da semana mais recente para a mais antiga: é o desempate.
const ordenada = computed(() => ordenarPor(dados.value?.lista ?? [], CHAVE[ordem.value], crescente.value))
const linhasPagina = computed(() => ordenada.value.slice((pagina.value - 1) * POR_PAGINA, pagina.value * POR_PAGINA))
watch([time, ano, ordem, crescente], () => (pagina.value = 1))
</script>

<template>
  <h1 class="titulo-tela">Transferências</h1>
  <WePainel v-if="!carreira.atual" titulo="Sem carreira"><p>Abra uma carreira para ver as transferências.</p></WePainel>
  <template v-else>
    <div class="filtros">
      <div class="seletor">
        <WeSeletorTime v-model="time" :times="opcoes" rotulo="Clube" :escudo="escudo" placeholder="Todos os clubes" />
      </div>
      <WeBotao :ativo="!time" @click="time = ''">Todos</WeBotao>
      <WeBotao :ativo="time === carreira.atual.time.sigla" @click="time = carreira.atual.time.sigla">Meu clube</WeBotao>
      <WeBotao v-if="time" icone="clube" @click="router.push({ name: 'time', params: { sigla: time } })">Página do clube</WeBotao>
      <span v-if="dados && dados.temporadas.length > 1" class="temporadas">
        <span class="we-lb">Temporada</span>
        <WeBotao v-for="t in dados.temporadas" :key="t" :ativo="dados.temporada === t" @click="ano = t">{{ t }}</WeBotao>
      </span>
    </div>

    <div v-if="dados" class="resumo">
      <span class="we-kv"><span class="we-lb">Negócios</span><span class="we-vl">{{ dados.lista.length }}</span></span>
      <template v-if="dados.saldo">
        <span class="we-kv"><span class="we-lb">Chegadas</span><span class="we-vl">{{ dados.saldo.chegadas }}</span></span>
        <span class="we-kv"><span class="we-lb">Saídas</span><span class="we-vl">{{ dados.saldo.saidas }}</span></span>
        <span class="we-kv"><span class="we-lb">Gasto</span><span class="we-vl">{{ dinheiro(dados.saldo.gasto) }}</span></span>
        <span class="we-kv"><span class="we-lb">Arrecadado</span><span class="we-vl">{{ dinheiro(dados.saldo.arrecadado) }}</span></span>
        <span class="we-kv">
          <span class="we-lb">Saldo</span>
          <span class="we-vl" :class="dados.saldo.arrecadado - dados.saldo.gasto < 0 ? 'we-vl--negativo' : 'we-vl--positivo'">{{ dinheiro(dados.saldo.arrecadado - dados.saldo.gasto) }}</span>
        </span>
      </template>
      <span v-else class="we-kv"><span class="we-lb">Dinheiro movimentado</span><span class="we-vl">{{ dinheiro(totalMovimentado) }}</span></span>
    </div>

    <WePainel v-if="dados" :titulo="titulo" sem-corpo>
      <p v-if="!dados.lista.length" class="vazio">Nenhuma transferência nesta temporada{{ nomeTime ? ` envolvendo o ${nomeTime}` : '' }}.</p>
      <WeTabela v-else>
        <thead>
          <tr>
            <WeThOrdem v-for="c in COLUNAS" :key="c.chave" :rotulo="c.rotulo" :chave="c.chave" :ordem="ordem" :crescente="crescente" @ordenar="ordenar" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in linhasPagina" :key="t.id" :class="{ 'we-destaque': t.de === carreira.atual.time.sigla || t.para === carreira.atual.time.sigla }">
            <td>{{ t.semana }}</td>
            <td>
              <span class="jogador">
                <WeBandeira :codigo="t.nacionalidade" />
                <RouterLink class="link" :to="{ name: 'jogador', params: { id: t.jogadorId } }">{{ t.jogador }}</RouterLink>
              </span>
            </td>
            <td>{{ nomePosicao(t.posicao) }}</td>
            <td>{{ t.idade }}</td>
            <td><TimeDaCarreira v-if="t.de" :sigla="t.de" /><span v-else class="we-lb">Sem clube</span></td>
            <td><TimeDaCarreira v-if="t.para" :sigla="t.para" /><span v-else class="we-lb">Sem clube</span></td>
            <td>
              <WeTag v-if="time && t.para === time" tipo="positivo">Chegada</WeTag>
              <WeTag v-else-if="time && t.de === time" tipo="negativo">Saída</WeTag>
              {{ nomeTipoTransferencia(t.tipo) }}
            </td>
            <td>{{ t.valor ? dinheiro(t.valor) : '—' }}</td>
            <td>{{ t.salario ? dinheiro(t.salario) : '—' }}</td>
          </tr>
        </tbody>
      </WeTabela>
      <WePaginacao v-if="dados.lista.length" v-model="pagina" :total="dados.lista.length" :por-pagina="POR_PAGINA" />
    </WePainel>
  </template>
</template>

<style scoped>
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}
.seletor {
  width: 280px;
}
.temporadas {
  margin-left: auto;
  display: flex;
  gap: 6px;
  align-items: center;
}
.resumo {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
  margin: var(--space-3) 0;
}
.resumo .we-kv {
  gap: 6px;
}
.jogador {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.link {
  color: var(--texto-forte);
  text-decoration: none;
  font-weight: 600;
}
.link:hover {
  text-decoration: underline;
}
.vazio {
  padding: var(--space-4);
}
</style>
