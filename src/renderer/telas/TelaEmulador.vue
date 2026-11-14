<script setup lang="ts">
import TimeDaCarreira from '../componentes/TimeDaCarreira.vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { StatusWe } from '@shared/esquemas/we'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WePlacar from '../componentes/WePlacar.vue'
import WeTag from '../componentes/WeTag.vue'
import { useTela } from '../composables/useTela'
import { useCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { useUi } from '../stores/ui'
import { chamar } from '../api'

/** Tela "No emulador": acompanha o resultado.json e oferece as saídas de falha. */
const router = useRouter()
const carreira = useCarreira()
const temporada = useTemporada()
const ui = useUi()
const s = ref<StatusWe | null>(null)
const ocupado = ref(false)
const manual = reactive({ aberto: false, golsCasa: 0, golsVisitante: 0, penaltisCasa: '', penaltisVisitante: '' })
let timer: ReturnType<typeof setInterval> | undefined

useTela([{ comando: 'acaoX', rotulo: 'Simular' }], { acaoX: () => void simular() })

async function atualizar(): Promise<void> {
  try {
    s.value = await chamar('we:status', undefined)
  } catch (e) {
    ui.avisar((e as Error).message)
  }
}

onMounted(() => {
  void atualizar()
  timer = setInterval(() => void atualizar(), 1000)
})
onBeforeUnmount(() => clearInterval(timer))

const ESTADO = {
  sem_partida: { texto: 'Nenhuma partida no emulador', tag: 'padrao' },
  aguardando: { texto: 'Esperando o jogo começar', tag: 'info' },
  parcial: { texto: 'Partida em andamento', tag: 'atencao' },
  final: { texto: 'Partida encerrada', tag: 'positivo' },
  invalido: { texto: 'Resultado não confere', tag: 'negativo' },
} as const

const FASE: Record<string, string> = { '1T': '1º tempo', '2T': '2º tempo', PR: 'prorrogação', PK: 'pênaltis' }
const fase = computed(() => (s.value?.fase ? (FASE[s.value.fase] ?? s.value.fase) : ''))

async function acao(fn: () => Promise<unknown>): Promise<void> {
  ocupado.value = true
  try {
    await fn()
  } catch (e) {
    ui.avisar((e as Error).message, 8000)
  } finally {
    ocupado.value = false
  }
}

const jogarDeNovo = () =>
  acao(async () => {
    s.value = await chamar('we:jogarDeNovo', undefined)
    ui.avisar('Abrindo o emulador de novo com a mesma partida.')
  })
const simular = () => acao(async () => carreira.concluirJogo(await chamar('prejogo:simular', undefined)))
const descartar = () =>
  acao(async () => {
    if (!(await ui.confirmar('Descartar partida', 'Esquecer a partida mandada para o emulador? O jogo continua pendente no pré-jogo.', 'Descartar'))) return
    await chamar('we:descartar', undefined)
    void router.push({ name: 'prejogo' })
  })
/** A ponte não reconheceu o apito final: encerra com o placar parcial que ela gravou (com autores). */
const encerrar = () =>
  acao(async () => {
    const placar = s.value?.placar
    const texto = placar && s.value?.jogo ? `${temporada.nome(s.value.jogo.casa)} ${placar.golsCasa} x ${placar.golsVisitante} ${temporada.nome(s.value.jogo.visitante)}` : 'o placar atual'
    if (!(await ui.confirmar('Encerrar partida', `A partida já acabou no WE? O resultado entra na carreira como ${texto}, com os gols lidos da RAM.`, 'Encerrar'))) return
    await carreira.concluirJogo(await chamar('we:confirmar', { aceitarParcial: true }))
  })
const numero = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.trunc(Number(v))))
const salvarManual = () =>
  acao(async () =>
    carreira.concluirJogo(
      await chamar('we:manual', {
        golsCasa: manual.golsCasa,
        golsVisitante: manual.golsVisitante,
        penaltisCasa: numero(manual.penaltisCasa),
        penaltisVisitante: numero(manual.penaltisVisitante),
      }),
    ),
  )
</script>

<template>
  <h1 class="titulo-tela">No emulador</h1>
  <template v-if="s">
    <WePainel :titulo="s.jogo ? `${temporada.nome(s.jogo.casa)} x ${temporada.nome(s.jogo.visitante)}` : 'Partida'" clube>
      <template #extra>{{ s.partidaWe ?? '' }}</template>
      <div class="status">
        <WeTag :tipo="ESTADO[s.estado].tag">{{ ESTADO[s.estado].texto }}</WeTag>
        <span v-if="fase" class="we-lb">{{ fase }}</span>
      </div>
      <div class="placar">
        <span class="nome"><TimeDaCarreira v-if="s.jogo" :sigla="s.jogo.casa" tamanho="m" escudo-depois :link="false" /></span>
        <WePlacar :casa="s.placar?.golsCasa ?? null" :visitante="s.placar?.golsVisitante ?? null" />
        <span class="nome"><TimeDaCarreira v-if="s.jogo" :sigla="s.jogo.visitante" tamanho="m" :link="false" /></span>
      </div>
      <p v-if="s.placar && s.placar.penaltisCasa !== null" class="centro we-lb">Pênaltis: {{ s.placar.penaltisCasa }} x {{ s.placar.penaltisVisitante }}</p>
      <p v-if="s.penaltisNoManager" class="centro we-lb">Jogo de volta: se o agregado empatar, o manager decide nos pênaltis ao confirmar.</p>
      <ul v-if="s.gols.length" class="gols">
        <li v-for="(g, i) in s.gols" :key="i" :class="g.lado">
          {{ g.minuto }}' · {{ g.autor ?? 'sem autor' }}{{ g.assistencia ? ` (assist. ${g.assistencia})` : '' }}
        </li>
      </ul>
      <p v-if="s.motivo" class="we-vl--atencao">{{ s.motivo }}</p>
      <p v-if="s.estado === 'aguardando'" class="we-lb">
        Jogue a partida no PCSX-Redux. O placar aparece aqui sozinho; ao fim, a ponte grava o resultado e fecha o emulador.
      </p>
      <p v-if="s.estado === 'parcial' && s.fase !== '1T'" class="we-lb">
        Se a partida já acabou e o emulador não fechou, a ponte não reconheceu o apito final: use "Encerrar com este placar".
      </p>

      <div class="acoes">
        <WeBotao v-if="s.estado === 'final'" icone="seta" variante="principal" data-foco-inicial @click="router.push({ name: 'posjogo' })">Conferir resultado</WeBotao>
        <WeBotao v-if="s.estado === 'parcial' && s.fase !== '1T'" icone="parar" variante="principal" data-foco-inicial :desabilitado="ocupado" @click="encerrar">
          Encerrar com este placar
        </WeBotao>
        <WeBotao icone="restaurar" :desabilitado="ocupado || s.estado === 'sem_partida'" @click="jogarDeNovo">Jogar de novo</WeBotao>
        <WeBotao icone="simular" :desabilitado="ocupado" @click="simular">Simular</WeBotao>
        <WeBotao icone="editor" :desabilitado="ocupado" @click="manual.aberto = !manual.aberto">Digitar placar</WeBotao>
        <WeBotao icone="descartar" :desabilitado="ocupado || s.estado === 'sem_partida'" @click="descartar">Descartar</WeBotao>
      </div>
    </WePainel>

    <WePainel v-if="manual.aberto" titulo="Placar digitado">
      <div class="campos">
        <label class="campo"><span class="we-lb">Gols {{ s.jogo ? temporada.nome(s.jogo.casa) : 'casa' }}</span><input v-model.number="manual.golsCasa" type="number" min="0" max="30" /></label>
        <label class="campo"><span class="we-lb">Gols {{ s.jogo ? temporada.nome(s.jogo.visitante) : 'visitante' }}</span><input v-model.number="manual.golsVisitante" type="number" min="0" max="30" /></label>
        <label class="campo"><span class="we-lb">Pênaltis casa (se houve)</span><input v-model="manual.penaltisCasa" type="number" min="0" max="30" /></label>
        <label class="campo"><span class="we-lb">Pênaltis visitante</span><input v-model="manual.penaltisVisitante" type="number" min="0" max="30" /></label>
      </div>
      <p class="we-lb">Resultado digitado entra sem autores dos gols.</p>
      <div class="acoes"><WeBotao icone="salvar" :desabilitado="ocupado" @click="salvarManual">Salvar placar</WeBotao></div>
    </WePainel>
  </template>
</template>

<style scoped>
.status {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
.placar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-2) 0;
}
.placar .nome:first-child {
  text-align: right;
}
.nome {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 15px;
  color: var(--texto-forte);
}
.centro {
  text-align: center;
  margin: 0;
}
.gols {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px var(--space-6);
}
.gols .casa {
  grid-column: 1;
  text-align: right;
}
.gols .visitante {
  grid-column: 2;
}
</style>
