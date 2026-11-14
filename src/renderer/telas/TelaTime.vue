<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { DetalheTime } from '@shared/esquemas/time'
import type { JogadorElenco } from '@shared/esquemas/elenco'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeAbas from '../componentes/WeAbas.vue'
import WeCampo from '../componentes/WeCampo.vue'
import WeEscudo from '../componentes/WeEscudo.vue'
import WeBandeira from '../componentes/WeBandeira.vue'
import WeTabela from '../componentes/WeTabela.vue'
import WeSeta from '../componentes/WeSeta.vue'
import TabelaElenco from '../componentes/TabelaElenco.vue'
import TimeDaCarreira from '../componentes/TimeDaCarreira.vue'
import { useTela } from '../composables/useTela'
import { acoesAbas } from '../composables/useAbas'
import { useCarreira, urlArquivoCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { useUi } from '../stores/ui'
import { chamar } from '../api'
import { corSobreClube } from '../cores'
import { NOME_ORDEM_ELENCO, ORDENS_ELENCO, dinheiro, nomePosicao, ordenarElenco, type OrdemElenco } from '../formato'

/** Página de um clube qualquer: elenco e escalação provável (o do usuário também abre aqui). */
const rota = useRoute()
const router = useRouter()
const carreira = useCarreira()
const temporada = useTemporada()
const ui = useUi()
const d = ref<DetalheTime | null>(null)

type Aba = 'elenco' | 'escalacao'
const aba = ref<Aba>('elenco')
const ABAS: Aba[] = ['elenco', 'escalacao']
const ordem = ref<OrdemElenco>('posicao')

useTela(
  [
    { comando: 'abaAnterior', rotulo: 'Elenco / escalação', tecla: 'LT/RT' },
    { comando: 'acaoY', rotulo: 'Ordenar' },
    { comando: 'acaoX', rotulo: 'Transferências' },
  ],
  {
    ...acoesAbas(aba, () => ABAS),
    acaoY: () => (ordem.value = ORDENS_ELENCO[(ORDENS_ELENCO.indexOf(ordem.value) + 1) % ORDENS_ELENCO.length]!),
    acaoX: () => verTransferencias(),
  },
)

async function carregar(): Promise<void> {
  const sigla = rota.params['sigla']
  if (typeof sigla !== 'string' || !carreira.atual) return
  try {
    d.value = await chamar('time:detalhe', { sigla })
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}
watch(() => [rota.params['sigla'], carreira.atual?.id, temporada.calendario?.passoAtual], carregar, { immediate: true })

function verTransferencias(): void {
  if (d.value) void router.push({ name: 'transferencias', query: { time: d.value.sigla } })
}

const PORTE: Record<string, string> = { grande: 'Grande', medio: 'Médio', pequeno: 'Pequeno' }
const jogadores = computed(() => ordenarElenco(d.value?.elenco.jogadores ?? [], ordem.value))
const porId = computed(() => new Map<string, JogadorElenco>((d.value?.elenco.jogadores ?? []).map((j) => [j.id, j])))
const titulares = computed(() => new Set(d.value?.escalacao?.titulares ?? []))
const reservas = computed(() => (d.value?.escalacao?.reservas ?? []).map((id) => porId.value.get(id)).filter((j): j is JogadorElenco => !!j))
const fora = computed(() =>
  ordenarElenco(
    (d.value?.elenco.jogadores ?? []).filter((j) => !titulares.value.has(j.id) && !(d.value?.escalacao?.reservas ?? []).includes(j.id)),
    'posicao',
  ),
)
const media = computed(() => {
  const ids = d.value?.escalacao?.titulares ?? []
  const gs = ids.map((id) => porId.value.get(id)?.geral ?? 0)
  return gs.length ? (gs.reduce((a, b) => a + b, 0) / gs.length).toFixed(1) : '—'
})
const valorElenco = computed(() => (d.value?.elenco.jogadores ?? []).reduce((a, j) => a + j.valor, 0))
const estrangeiros = computed(() => (d.value?.elenco.jogadores ?? []).filter((j) => j.nacionalidade !== d.value?.pais).length)
/** O painel principal pega a cor deste clube, não a do usuário. */
const corClube = computed(() => {
  const cor = d.value?.cores[0]
  return cor ? { '--clube': cor, '--sobre-clube': corSobreClube(cor) } : undefined
})

function abrirJogador(i: number): void {
  const id = d.value?.escalacao?.titulares[i]
  if (id) void router.push({ name: 'jogador', params: { id } })
}
</script>

<template>
  <h1 class="titulo-tela">Clube</h1>
  <WePainel v-if="!carreira.atual" titulo="Sem carreira"><p>Abra uma carreira para ver os clubes.</p></WePainel>
  <div v-else-if="d" class="tela" :style="corClube">
    <WePainel :titulo="d.nome" clube>
      <template #extra>{{ d.usuario ? 'Seu clube' : `Porte ${PORTE[d.porte] ?? d.porte}` }}</template>
      <div class="cabeca">
        <WeEscudo :sigla="d.sigla" :cor="d.cores[0]" :src="urlArquivoCarreira(d.escudo)" tamanho="m" :nome="d.nome" />
        <div class="dados">
          <span class="we-kv"><span class="we-lb">País</span><span class="we-vl pais"><WeBandeira :codigo="d.pais" />{{ d.estado ?? '' }}</span></span>
          <span class="we-kv"><span class="we-lb">Estádio</span><span class="we-vl">{{ d.estadio.nome }} · {{ d.estadio.capacidade.toLocaleString('pt-BR') }}</span></span>
          <span class="we-kv"><span class="we-lb">Elenco</span><span class="we-vl">{{ d.elenco.jogadores.length }} jogadores · {{ estrangeiros }} estrangeiros</span></span>
          <span class="we-kv"><span class="we-lb">Valor do elenco</span><span class="we-vl">{{ dinheiro(valorElenco) }}</span></span>
          <span class="we-kv"><span class="we-lb">Entrosamento</span><span class="we-vl">{{ Math.round(d.elenco.entrosamento) }}</span></span>
          <span v-if="d.proximoJogo" class="we-kv">
            <span class="we-lb">Próximo jogo</span>
            <span class="we-vl">{{ d.proximoJogo.emCasa ? 'em casa' : 'fora' }} contra</span>
            <TimeDaCarreira :sigla="d.proximoJogo.adversario" />
            <span class="we-lb">{{ d.proximoJogo.competicao }}</span>
          </span>
        </div>
        <div class="acoes">
          <WeBotao icone="transferencias" @click="verTransferencias">Transferências</WeBotao>
          <WeBotao v-if="d.usuario" icone="escalacao" @click="router.push({ name: 'escalacao' })">Editar escalação</WeBotao>
          <WeBotao icone="voltar" @click="router.back()">Voltar</WeBotao>
        </div>
      </div>
    </WePainel>

    <div class="barra">
      <WeAbas v-model="aba" :abas="[{ id: 'elenco', titulo: 'Elenco', contagem: d.elenco.jogadores.length }, { id: 'escalacao', titulo: 'Escalação' }]" rotulo="Seções do clube" />
      <span v-if="aba === 'elenco'" class="ordem">
        <span class="we-lb">Ordenar</span>
        <WeBotao v-for="o in ORDENS_ELENCO" :key="o" :ativo="ordem === o" @click="ordem = o">{{ NOME_ORDEM_ELENCO[o] }}</WeBotao>
      </span>
    </div>

    <WePainel v-if="aba === 'elenco'" :titulo="`Elenco do ${d.nomeCurto}`" sem-corpo>
      <TabelaElenco :jogadores="jogadores" :temporada="carreira.atual.temporada" :titulares="titulares" />
    </WePainel>

    <template v-else>
      <WePainel v-if="!d.escalacao" titulo="Escalação"><p>O clube tem menos de 11 jogadores.</p></WePainel>
      <div v-else class="duas">
        <WePainel :titulo="`Formação ${d.escalacao.formacao} · média ${media}`">
          <WeCampo :papeis="d.escalacao.papeis" :titulares="d.escalacao.titulares" :jogadores="porId" :selecionada="null" :desfalques="new Set()" @vaga="abrirJogador" />
          <p class="we-lb dica">{{ d.usuario ? 'Escalação que vai a campo no próximo jogo.' : 'Escalação provável no próximo jogo (a IA do técnico escolhe).' }}</p>
        </WePainel>
        <WePainel :titulo="`Reservas (${reservas.length}) e fora (${fora.length})`" sem-corpo>
          <WeTabela>
            <thead>
              <tr><th>Nº</th><th>Pos.</th><th>Jogador</th><th>Geral</th><th>Seta</th><th>Situação</th></tr>
            </thead>
            <tbody>
              <tr v-for="j in reservas" :key="j.id">
                <td>{{ j.camisa }}</td>
                <td>{{ nomePosicao(j.posicao) }}</td>
                <td><span class="jogador"><WeBandeira :codigo="j.nacionalidade" /><RouterLink class="link" :to="{ name: 'jogador', params: { id: j.id } }">{{ j.nome }}</RouterLink></span></td>
                <td class="geral">{{ j.geral }}</td>
                <td><WeSeta :nivel="j.seta" /></td>
                <td class="we-lb">Reserva</td>
              </tr>
              <tr v-for="j in fora" :key="j.id" class="fora">
                <td>{{ j.camisa }}</td>
                <td>{{ nomePosicao(j.posicao) }}</td>
                <td><span class="jogador"><WeBandeira :codigo="j.nacionalidade" /><RouterLink class="link" :to="{ name: 'jogador', params: { id: j.id } }">{{ j.nome }}</RouterLink></span></td>
                <td class="geral">{{ j.geral }}</td>
                <td><WeSeta :nivel="j.seta" /></td>
                <td class="we-lb">{{ j.lesaoSemanas ? `Lesão ${j.lesaoSemanas} sem.` : j.suspenso.length ? 'Suspenso' : 'Fora' }}</td>
              </tr>
            </tbody>
          </WeTabela>
        </WePainel>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tela {
  display: flex;
  flex-direction: column;
  gap: var(--gap-painel);
}
.cabeca {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  flex-wrap: wrap;
}
.dados {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-6);
  flex: 1;
}
.dados .we-kv {
  gap: 6px;
  align-items: center;
}
.pais {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}
.acoes {
  display: flex;
  gap: var(--space-2);
}
.barra {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
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
.duas {
  display: grid;
  grid-template-columns: minmax(380px, 1fr) minmax(0, 1fr);
  gap: var(--gap-painel);
  align-items: start;
}
.dica {
  margin-top: var(--space-3);
  text-align: center;
}
.geral {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--texto-forte);
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
.fora {
  opacity: 0.6;
}
</style>
