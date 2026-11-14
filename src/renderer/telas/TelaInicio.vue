<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Noticia } from '@shared/esquemas/noticias'
import type { Elenco } from '@shared/esquemas/elenco'
import type { Diretoria } from '@shared/esquemas/mercado'
import type { LinhaTabela } from '@shared/esquemas/temporada'
import BarraCondicao from '../componentes/BarraCondicao.vue'
import { chamar } from '../api'
import { ROTULO_TIPO, TAG_TIPO } from '../noticias'
import { useRouter } from 'vue-router'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeTabela from '../componentes/WeTabela.vue'
import WeTag from '../componentes/WeTag.vue'
import WeEscudo from '../componentes/WeEscudo.vue'
import WePlacar from '../componentes/WePlacar.vue'
import TimeDaCarreira from '../componentes/TimeDaCarreira.vue'
import LinhaJogo from '../componentes/LinhaJogo.vue'
import { useTela } from '../composables/useTela'
import { useUi } from '../stores/ui'
import { urlArquivoCarreira, useCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { dinheiro } from '../formato'

const router = useRouter()
const ui = useUi()
const carreira = useCarreira()
const temporada = useTemporada()

useTela([{ comando: 'acaoY', rotulo: 'Trocar tema' }], { acaoY: () => void ui.alternarTema() })

const proximo = computed(() => temporada.proximoJogo)
const ultimos = computed(() =>
  (temporada.calendario?.passos ?? [])
    .filter((p) => p.jogo?.placar)
    .slice(-5)
    .reverse()
    .map((p) => p.jogo!),
)
const time = (s: string) => temporada.times.get(s)

const recentes = ref<Noticia[]>([])
const elenco = ref<Elenco | null>(null)
const diretoria = ref<Diretoria | null>(null)
const liga = ref<{ nome: string; linhas: LinhaTabela[] } | null>(null)

/** Tabela de pontos corridos em que o usuário está (a liga, se houver; senão a 1ª que achar). */
async function carregarTabela(): Promise<void> {
  const sigla = carreira.atual?.time.sigla
  liga.value = null
  for (const e of temporada.edicoes.filter((x) => x.usuarioParticipa)) {
    const d = await chamar('temporada:edicao', { id: e.id })
    for (const f of d.fases) {
      if (f.formato !== 'pontos_corridos') continue
      const t = f.tabelas.find((x) => x.linhas.some((l) => l.time === sigla))
      if (t) {
        liga.value = { nome: d.nome, linhas: t.linhas }
        return
      }
    }
  }
}

watch(
  () => [carreira.atual?.id, temporada.calendario?.passoAtual, carreira.noticias?.pendentes],
  async () => {
    if (!carreira.atual) return
    try {
      const [c, el, di] = await Promise.all([chamar('noticias:caixa', {}), chamar('elenco:listar', undefined), chamar('diretoria:obter', undefined)])
      recentes.value = c.noticias.slice(0, 5)
      elenco.value = el
      diretoria.value = di
      await carregarTabela()
    } catch {
      recentes.value = []
    }
  },
  { immediate: true },
)

/** Cinco linhas da tabela em volta do time do usuário. */
const trechoTabela = computed(() => {
  const linhas = liga.value?.linhas ?? []
  const i = linhas.findIndex((l) => l.time === carreira.atual?.time.sigla)
  const inicio = Math.max(0, Math.min(linhas.length - 5, i - 2))
  return linhas.slice(inicio, inicio + 5)
})
const posicaoNaLiga = (s: string) => liga.value?.linhas.find((l) => l.time === s)

const estadoElenco = computed(() => {
  const js = elenco.value?.jogadores ?? []
  const temporadaAtual = carreira.atual?.temporada ?? 0
  return {
    condicao: js.length ? Math.round(js.reduce((a, j) => a + j.condicao, 0) / js.length) : 0,
    lesionados: js.filter((j) => j.lesaoSemanas > 0).length,
    suspensos: js.filter((j) => j.suspenso.length).length,
    pendurados: js.filter((j) => j.pendurado.length).length,
    contratos: js.filter((j) => j.contratoAte !== null && j.contratoAte <= temporadaAtual).length,
  }
})
</script>

<template>
  <h1 class="titulo-tela">Início</h1>

  <div v-if="carreira.atual" class="grade">
    <WePainel titulo="Próximo jogo" clube>
      <template v-if="proximo">
        <div class="confronto">
          <WeEscudo :sigla="proximo.casa" :cor="time(proximo.casa)?.cores[0]" :src="urlArquivoCarreira(time(proximo.casa)?.escudo ?? null)" tamanho="m" :nome="temporada.nome(proximo.casa)" />
          <WePlacar />
          <WeEscudo :sigla="proximo.visitante" :cor="time(proximo.visitante)?.cores[0]" :src="urlArquivoCarreira(time(proximo.visitante)?.escudo ?? null)" tamanho="m" :nome="temporada.nome(proximo.visitante)" />
        </div>
        <div class="nomes"><span>{{ temporada.nome(proximo.casa) }}</span><span>{{ temporada.nome(proximo.visitante) }}</span></div>
        <div v-if="posicaoNaLiga(proximo.casa) && posicaoNaLiga(proximo.visitante)" class="nomes nomes--info">
          <span class="we-lb">{{ posicaoNaLiga(proximo.casa)!.posicao }}º · {{ posicaoNaLiga(proximo.casa)!.ultimos.join(' ') || '—' }}</span>
          <span class="we-lb">{{ posicaoNaLiga(proximo.visitante)!.posicao }}º · {{ posicaoNaLiga(proximo.visitante)!.ultimos.join(' ') || '—' }}</span>
        </div>
        <div class="we-kv"><span class="we-lb">Competição</span><span class="we-vl">{{ proximo.competicaoNome }} · {{ proximo.faseNome }}</span></div>
        <div class="we-kv">
          <span class="we-lb">Quando</span>
          <span class="we-vl">Semana {{ proximo.semana }}{{ proximo.grupo ? ` · Grupo ${proximo.grupo}` : '' }} · rodada {{ proximo.rodada + 1 }}</span>
        </div>
        <p class="we-lb">CONTINUAR (START) simula as datas até este jogo e abre o pré-jogo: jogar no WE, assistir CPU x CPU ou simular.</p>
      </template>
      <p v-else-if="temporada.calendario?.encerrada">A temporada acabou.</p>
      <p v-else>Sem jogo marcado: o próximo depende de outras fases. CONTINUAR avança o calendário.</p>
    </WePainel>

    <WePainel :titulo="liga ? liga.nome : 'Tabela'" sem-corpo>
      <WeTabela v-if="trechoTabela.length">
        <thead>
          <tr><th>#</th><th>Time</th><th>J</th><th>SG</th><th>Pts</th></tr>
        </thead>
        <tbody>
          <tr v-for="l in trechoTabela" :key="l.time" :class="{ 'we-destaque': l.time === carreira.atual.time.sigla }">
            <td :style="l.zona ? { color: `var(--${l.zona.cor})`, fontWeight: 700 } : {}">{{ l.posicao }}</td>
            <td><TimeDaCarreira :sigla="l.time" /></td>
            <td>{{ l.jogos }}</td>
            <td>{{ l.saldo > 0 ? `+${l.saldo}` : l.saldo }}</td>
            <td>{{ l.pontos }}</td>
          </tr>
        </tbody>
      </WeTabela>
      <p v-else class="vazio">Sem tabela de pontos corridos para o seu time ainda.</p>
      <div class="acoes acoes--painel">
        <WeBotao icone="competicoes" @click="router.push({ name: 'competicoes' })">Ver competições</WeBotao>
        <WeBotao icone="calendario" @click="router.push({ name: 'calendario' })">Ver calendário</WeBotao>
      </div>
    </WePainel>

    <WePainel titulo="Estado do elenco">
      <div class="we-kv"><span class="we-lb">Condição média</span><span class="we-vl">{{ estadoElenco.condicao }}%</span></div>
      <div class="we-kv"><span class="we-lb">Lesionados</span><span class="we-vl" :class="{ 'we-vl--negativo': estadoElenco.lesionados }">{{ estadoElenco.lesionados }}</span></div>
      <div class="we-kv"><span class="we-lb">Suspensos</span><span class="we-vl" :class="{ 'we-vl--negativo': estadoElenco.suspensos }">{{ estadoElenco.suspensos }}</span></div>
      <div class="we-kv"><span class="we-lb">Pendurados</span><span class="we-vl" :class="{ 'we-vl--atencao': estadoElenco.pendurados }">{{ estadoElenco.pendurados }}</span></div>
      <div class="we-kv"><span class="we-lb">Contratos acabando</span><span class="we-vl" :class="{ 'we-vl--atencao': estadoElenco.contratos }">{{ estadoElenco.contratos }}</span></div>
      <div class="acoes">
        <WeBotao icone="escalacao" @click="router.push({ name: 'escalacao' })">Escalação</WeBotao>
        <WeBotao icone="elenco" @click="router.push({ name: 'elenco' })">Elenco</WeBotao>
      </div>
    </WePainel>

    <WePainel titulo="Diretoria e finanças">
      <div v-if="diretoria" class="we-kv"><span class="we-lb">Confiança</span><BarraCondicao :valor="diretoria.confianca" rotulo="Confiança" /></div>
      <div class="we-kv">
        <span class="we-lb">Saldo</span><span class="we-vl" :class="carreira.atual.saldo < 0 ? 'we-vl--negativo' : ''">{{ dinheiro(carreira.atual.saldo) }}</span>
      </div>
      <div v-if="carreira.mercado" class="we-kv">
        <span class="we-lb">Folha</span>
        <span class="we-vl" :class="{ 'we-vl--negativo': carreira.mercado.folha > carreira.mercado.orcamentoFolha }">
          {{ dinheiro(carreira.mercado.folha) }} de {{ dinheiro(carreira.mercado.orcamentoFolha) }}
        </span>
      </div>
      <div v-for="(m, i) in diretoria?.metas ?? []" :key="i" class="we-kv">
        <span class="we-lb meta">{{ m.descricao }}</span>
        <WeTag :tipo="m.noCaminho ? 'positivo' : 'atencao'">{{ m.noCaminho ? 'No caminho' : 'Fora' }}</WeTag>
      </div>
      <div class="acoes">
        <WeBotao icone="clube" @click="router.push({ name: 'clube' })">Diretoria</WeBotao>
        <WeBotao icone="financas" @click="router.push({ name: 'financas' })">Finanças</WeBotao>
      </div>
    </WePainel>

    <WePainel titulo="Notícias" sem-corpo>
      <ul v-if="recentes.length" class="noticias">
        <li v-for="n in recentes" :key="n.id" :class="{ pendente: n.pendente }">
          <WeTag :tipo="n.pendente ? 'atencao' : TAG_TIPO[n.tipo]">{{ n.pendente ? 'Decidir' : ROTULO_TIPO[n.tipo] }}</WeTag>
          <span>{{ n.texto }}</span>
        </li>
      </ul>
      <p v-else class="vazio">Nenhuma notícia ainda.</p>
      <div class="acoes acoes--painel"><WeBotao icone="noticias" @click="router.push({ name: 'noticias' })">Ver todas</WeBotao></div>
    </WePainel>

    <WePainel titulo="Últimos jogos" sem-corpo>
      <ul v-if="ultimos.length" class="jogos">
        <li v-for="j in ultimos" :key="j.id">
          <LinhaJogo :jogo="j" :destaque="carreira.atual.time.sigla" />
          <span class="we-lb">{{ j.competicaoNome }} · semana {{ j.semana }}</span>
        </li>
      </ul>
      <p v-else class="vazio">Nenhum jogo ainda nesta temporada.</p>
    </WePainel>
  </div>
</template>

<style scoped>
.confronto {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  padding: var(--space-2) 0;
}
.nomes {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--texto-forte);
  padding: 0 var(--space-4);
}
.nomes--info {
  margin-top: 2px;
}
.meta {
  max-width: 70%;
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
.vazio {
  padding: var(--space-2);
  margin: 0;
}
.noticias {
  list-style: none;
  margin: 0;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.noticias li {
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.noticias li.pendente span {
  font-weight: 700;
  color: var(--texto-forte);
}
.acoes--painel {
  padding: 0 var(--space-2) var(--space-2);
}
</style>
