<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Artilheiro, EdicaoDetalhe } from '@shared/esquemas/temporada'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeAbas from '../componentes/WeAbas.vue'
import WeTabela from '../componentes/WeTabela.vue'
import WeTag from '../componentes/WeTag.vue'
import TimeDaCarreira from '../componentes/TimeDaCarreira.vue'
import LinhaJogo from '../componentes/LinhaJogo.vue'
import { useTela } from '../composables/useTela'
import { acoesAbas } from '../composables/useAbas'
import { useTemporada } from '../stores/temporada'
import { useCarreira } from '../stores/carreira'
import { useUi } from '../stores/ui'
import { chamar } from '../api'

const temporada = useTemporada()
const carreira = useCarreira()
const ui = useUi()

const edicaoId = ref<string>('')
const detalhe = ref<EdicaoDetalhe | null>(null)
const artilheiros = ref<Artilheiro[]>([])
const faseId = ref<string>('')
const rodada = ref(0)

const abas = computed(() => temporada.edicoes.map((e) => ({ id: e.id, titulo: e.nome })))
watch(
  () => temporada.edicoes,
  (eds) => {
    if (!eds.some((e) => e.id === edicaoId.value)) edicaoId.value = (eds.find((e) => e.usuarioParticipa) ?? eds[0])?.id ?? ''
  },
  { immediate: true },
)

async function carregar(): Promise<void> {
  if (!edicaoId.value) {
    detalhe.value = null
    return
  }
  try {
    ;[detalhe.value, artilheiros.value] = await Promise.all([
      chamar('temporada:edicao', { id: edicaoId.value }),
      chamar('temporada:artilharia', { edicao: edicaoId.value }),
    ])
    const fases = detalhe.value.fases
    if (!fases.some((f) => f.id === faseId.value)) faseId.value = ([...fases].reverse().find((f) => f.iniciada) ?? fases[0])?.id ?? ''
    ajustarRodada()
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}
watch(edicaoId, carregar, { immediate: true })
// Depois de cada Continuar, recarrega a competição aberta.
watch(() => [temporada.calendario?.passoAtual, temporada.calendario?.semanaAtual], carregar)

const fase = computed(() => detalhe.value?.fases.find((f) => f.id === faseId.value) ?? null)

/** Rodada exibida: a primeira ainda sem resultado completo (ou a última). */
function ajustarRodada(): void {
  const rs = fase.value?.rodadas ?? []
  const pendente = rs.find((r) => r.jogos.some((j) => !j.placar))
  rodada.value = (pendente ?? rs[rs.length - 1])?.rodada ?? 0
}
watch(faseId, ajustarRodada)

const jogosDaRodada = computed(() => fase.value?.rodadas.find((r) => r.rodada === rodada.value)?.jogos ?? [])
const totalRodadas = computed(() => fase.value?.rodadas.length ?? 0)
const etapas = computed(() => {
  const cs = fase.value?.confrontos ?? []
  return [...new Set(cs.map((c) => c.rodada))].sort((a, b) => a - b).map((r) => ({ rodada: r, confrontos: cs.filter((c) => c.rodada === r) }))
})
const nomeEtapa = (r: number, total: number) => {
  const faltam = total - r
  return faltam === 1 ? 'Final' : faltam === 2 ? 'Semifinal' : faltam === 3 ? 'Quartas de final' : faltam === 4 ? 'Oitavas de final' : `${r + 1}ª etapa`
}

useTela([{ comando: 'abaAnterior', rotulo: 'Competição', tecla: 'LT/RT' }, { comando: 'acaoX', rotulo: 'Rodada anterior' }, { comando: 'acaoY', rotulo: 'Próxima rodada' }], {
  ...acoesAbas(edicaoId, () => temporada.edicoes.map((e) => e.id)),
  acaoX: () => (rodada.value = Math.max(0, rodada.value - 1)),
  acaoY: () => (rodada.value = Math.min(totalRodadas.value - 1, rodada.value + 1)),
})

const zonas = computed(() => {
  const vistas = new Map<string, { nome: string; cor: string }>()
  for (const t of fase.value?.tabelas ?? []) for (const l of t.linhas) if (l.zona) vistas.set(l.zona.nome, l.zona)
  return [...vistas.values()]
})
const usuario = computed(() => carreira.atual?.time.sigla ?? null)
const corUltimo = { V: 'positivo', E: 'padrao', D: 'negativo' } as const
</script>

<template>
  <h1 class="titulo-tela">Competições</h1>
  <WePainel v-if="!carreira.atual" titulo="Sem carreira"><p>Abra uma carreira para ver as competições.</p></WePainel>
  <template v-else-if="detalhe">
    <WeAbas v-model="edicaoId" :abas="abas" rotulo="Competições da temporada" />
    <div class="cabecalho">
      <div class="acoes" role="group" aria-label="Fases">
        <WeBotao v-for="f in detalhe.fases" :key="f.id" :ativo="f.id === faseId" :desabilitado="!f.iniciada" @click="faseId = f.id">{{ f.nome }}</WeBotao>
      </div>
      <span v-if="detalhe.campeao" class="campeao">Campeão: <TimeDaCarreira :sigla="detalhe.campeao" /></span>
    </div>

    <div v-if="fase && fase.formato !== 'mata_mata'" class="duas">
      <div class="tabelas">
        <WePainel v-for="t in fase.tabelas" :key="t.grupo ?? 'unica'" :titulo="t.grupo ? `Grupo ${t.grupo}` : fase.nome" sem-corpo>
          <WeTabela>
            <thead>
              <tr><th>#</th><th>Time</th><th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th><th>Últimos</th></tr>
            </thead>
            <tbody>
              <tr v-for="l in t.linhas" :key="l.time" :class="{ 'we-destaque': l.time === usuario }">
                <td :style="l.zona ? { color: `var(--${l.zona.cor})`, fontWeight: 700 } : undefined" :title="l.zona?.nome">{{ l.posicao }}</td>
                <td><TimeDaCarreira :sigla="l.time" /></td>
                <td class="pts">{{ l.pontos }}</td>
                <td>{{ l.jogos }}</td>
                <td>{{ l.vitorias }}</td>
                <td>{{ l.empates }}</td>
                <td>{{ l.derrotas }}</td>
                <td>{{ l.golsPro }}</td>
                <td>{{ l.golsContra }}</td>
                <td>{{ l.saldo > 0 ? `+${l.saldo}` : l.saldo }}</td>
                <td class="ultimos"><WeTag v-for="(u, i) in l.ultimos" :key="i" :tipo="corUltimo[u]">{{ u }}</WeTag></td>
              </tr>
            </tbody>
          </WeTabela>
        </WePainel>
        <p v-if="zonas.length" class="legenda">
          <span v-for="z in zonas" :key="z.nome" class="we-lb"><b :style="{ color: `var(--${z.cor})` }">■</b> {{ z.nome }}</span>
        </p>
      </div>
      <WePainel :titulo="`Rodada ${rodada + 1} de ${totalRodadas}`" sem-corpo>
        <template #extra>
          <span class="nav-rodada">
            <WeBotao icone="anterior" :desabilitado="rodada === 0" @click="rodada--">Anterior</WeBotao>
            <WeBotao icone="seta" :desabilitado="rodada >= totalRodadas - 1" @click="rodada++">Próxima</WeBotao>
          </span>
        </template>
        <ul class="jogos">
          <li v-for="j in jogosDaRodada" :key="j.id">
            <LinhaJogo :jogo="j" :destaque="usuario" />
            <span class="we-lb">{{ j.grupo ? `Grupo ${j.grupo} · ` : '' }}semana {{ j.semana }}</span>
          </li>
        </ul>
      </WePainel>
    </div>

    <div v-else-if="fase" class="chave">
      <WePainel v-for="e in etapas" :key="e.rodada" :titulo="nomeEtapa(e.rodada, etapas.length)" sem-corpo>
        <ul class="jogos">
          <li v-for="c in e.confrontos" :key="c.id" class="confronto">
            <div v-for="j in c.jogos" :key="j.id"><LinhaJogo :jogo="j" :destaque="usuario" /></div>
            <span v-if="c.vencedor" class="we-lb classificado">Classificado: <TimeDaCarreira :sigla="c.vencedor" /></span>
          </li>
        </ul>
      </WePainel>
      <p v-if="!etapas.length" class="we-lb">Os confrontos aparecem quando a fase anterior terminar.</p>
    </div>
    <WePainel titulo="Artilharia" sem-corpo>
      <p v-if="!artilheiros.length" class="vazio">Nenhum gol ainda.</p>
      <WeTabela v-else>
        <thead>
          <tr><th>#</th><th>Jogador</th><th>Time</th><th>Gols</th><th>Assist.</th><th>Jogos</th></tr>
        </thead>
        <tbody>
          <tr v-for="(a, i) in artilheiros" :key="a.jogador + a.time" :class="{ 'we-destaque': a.time === usuario }">
            <td>{{ i + 1 }}</td>
            <td>{{ a.jogador }}</td>
            <td><TimeDaCarreira :sigla="a.time" /></td>
            <td class="pts">{{ a.gols }}</td>
            <td>{{ a.assistencias }}</td>
            <td>{{ a.jogos }}</td>
          </tr>
        </tbody>
      </WeTabela>
    </WePainel>
  </template>
</template>

<style scoped>
.cabecalho {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.campeao {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--positivo);
}
.duas {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(360px, 1fr);
  gap: var(--gap-painel);
  align-items: start;
}
.tabelas {
  display: flex;
  flex-direction: column;
  gap: var(--gap-painel);
}
.pts {
  font-weight: 700;
  color: var(--texto-forte);
}
.ultimos {
  display: flex;
  gap: 2px;
}
.jogos {
  list-style: none;
  margin: 0;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.jogos li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--linha);
}
.jogos .we-lb {
  text-align: center;
}
.nav-rodada {
  display: flex;
  gap: 6px;
}
.nav-rodada .we-btn {
  padding: 2px 8px;
}
.chave {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: var(--gap-painel);
  align-items: start;
}
.vazio {
  padding: var(--space-2);
  margin: 0;
}
.legenda {
  margin: 0;
  display: flex;
  gap: var(--space-4);
}
</style>
