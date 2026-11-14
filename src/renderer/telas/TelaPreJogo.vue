<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { PreJogo } from '@shared/esquemas/we'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WeEscudo from '../componentes/WeEscudo.vue'
import WePlacar from '../componentes/WePlacar.vue'
import WeTag from '../componentes/WeTag.vue'
import EscalacaoPreJogo from '../componentes/EscalacaoPreJogo.vue'
import { useTela } from '../composables/useTela'
import { useCarreira, urlArquivoCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { useUi } from '../stores/ui'
import { chamar, ErroApi } from '../api'

const router = useRouter()
const carreira = useCarreira()
const temporada = useTemporada()
const ui = useUi()
const p = ref<PreJogo | null>(null)
const ocupado = ref(false)

useTela(
  [
    { comando: 'acaoX', rotulo: 'Simular' },
    { comando: 'acaoY', rotulo: 'Jogar no WE' },
  ],
  {
    acaoX: () => void simular(),
    acaoY: () => void noWe('jogar'),
  },
)

onMounted(async () => {
  try {
    p.value = await chamar('prejogo:obter', undefined)
  } catch (e) {
    ui.avisar((e as Error).message, 6000)
    void router.push({ name: 'inicio' })
  }
})

const usuario = computed(() => carreira.atual?.time.sigla ?? '')
const time = (s: string) => temporada.times.get(s)
const NOME_CONTROLE = { p1_cpu: 'você no pad 1, time da casa', cpu_p1: 'você no pad 1, time visitante', p1_p2: 'dois jogadores', cpu_cpu: 'CPU x CPU' } as const

const podeWe = computed(() => !!p.value && p.value.ambiente.bat && p.value.ambiente.emulador && p.value.ambiente.imagem && p.value.ambiente.estados.includes('p1_cpu'))
const faltas = computed(() => {
  const a = p.value?.ambiente
  if (!a) return []
  const f: string[] = []
  if (!a.emulador) f.push('executável do PCSX-Redux (Configurações)')
  if (!a.imagem) f.push('imagem do jogo .cue (Configurações)')
  if (!a.bat) f.push(`run-pcsx.bat em ${a.raiz}`)
  if (!a.estados.includes('p1_cpu')) f.push('estado base states/amistoso.sstate')
  return f
})

async function noWe(modo: 'jogar' | 'assistir'): Promise<void> {
  ocupado.value = true
  try {
    await chamar('we:iniciar', { modo })
    void router.push({ name: 'emulador' })
  } catch (e) {
    ui.avisar((e as Error).message, 8000)
    if (e instanceof ErroApi && e.codigo === 'evento_pendente') void router.push({ name: 'noticias' })
  } finally {
    ocupado.value = false
  }
}

async function simular(): Promise<void> {
  ocupado.value = true
  try {
    await carreira.concluirJogo(await chamar('prejogo:simular', undefined))
  } catch (e) {
    ui.avisar((e as Error).message, 8000)
    if (e instanceof ErroApi && e.codigo === 'evento_pendente') void router.push({ name: 'noticias' })
  } finally {
    ocupado.value = false
  }
}
</script>

<template>
  <h1 class="titulo-tela">Pré-jogo</h1>
  <template v-if="p">
    <WePainel :titulo="`${p.jogo.competicaoNome} · ${p.jogo.faseNome}${p.jogo.grupo ? ` · Grupo ${p.jogo.grupo}` : ''} · semana ${p.jogo.semana}`" clube>
      <div class="confronto">
        <div class="lado">
          <WeEscudo :sigla="p.jogo.casa" :cor="time(p.jogo.casa)?.cores[0]" :src="urlArquivoCarreira(time(p.jogo.casa)?.escudo ?? null)" tamanho="m" />
          <RouterLink class="nome nome--link" :to="{ name: 'time', params: { sigla: p.jogo.casa } }">{{ temporada.nome(p.jogo.casa) }}</RouterLink>
          <WeTag v-if="p.jogo.casa === usuario" tipo="positivo">Seu time</WeTag>
        </div>
        <WePlacar />
        <div class="lado">
          <WeEscudo :sigla="p.jogo.visitante" :cor="time(p.jogo.visitante)?.cores[0]" :src="urlArquivoCarreira(time(p.jogo.visitante)?.escudo ?? null)" tamanho="m" />
          <RouterLink class="nome nome--link" :to="{ name: 'time', params: { sigla: p.jogo.visitante } }">{{ temporada.nome(p.jogo.visitante) }}</RouterLink>
          <WeTag v-if="p.jogo.visitante === usuario" tipo="positivo">Seu time</WeTag>
        </div>
      </div>
      <p class="we-lb">{{ p.decisao }}</p>
    </WePainel>

    <div class="duas">
      <div class="opcoes">
        <WePainel titulo="Como jogar">
          <WeBotao v-if="p.pendente && p.pendente.estado !== 'sem_partida'" icone="assistir" variante="opcao" sub="A partida já foi mandada para o emulador." @click="router.push({ name: 'emulador' })">
            Ver partida no emulador
          </WeBotao>
          <WeBotao icone="jogar" variante="opcao" :desabilitado="!podeWe || ocupado" data-foco-inicial :sub="`Abre o PCSX-Redux com os dois times (${NOME_CONTROLE[p.controle]}${p.invertido ? '; seu time vai para a vaga da casa e o mando é desinvertido depois' : ''}).`" @click="noWe('jogar')">
            Jogar no WE2002
          </WeBotao>
          <WeBotao icone="assistir" variante="opcao" :desabilitado="!podeWe || ocupado || !p.ambiente.estados.includes('cpu_cpu')" sub="O WE joga CPU x CPU e você assiste. O resultado entra na carreira." @click="noWe('assistir')">
            Assistir CPU x CPU no WE
          </WeBotao>
          <WeBotao icone="simular" variante="opcao" :desabilitado="ocupado" sub="O motor do manager joga a partida agora." data-foco-inicial @click="simular">
            Simular
          </WeBotao>
          <p v-if="faltas.length" class="we-vl--atencao">Para jogar no WE falta: {{ faltas.join('; ') }}.</p>
        </WePainel>
        <WePainel titulo="O que vai para o emulador">
          <ul class="lista">
            <li>23 convocados de cada lado (11 nas vagas da formação + 12 reservas), nomes de até 10 letras, camisas de 1 a 32.</li>
            <li>Atributos no padrão do WE (12-19), já com a perda por condição baixa.</li>
            <li>Seta de condição de cada jogador, formação, aparência, uniforme e bandeira.</li>
            <li>Substituições, cartões por jogador e lesões ainda não voltam do WE: só os gols (autor, assistência, minuto) e os pênaltis.</li>
          </ul>
        </WePainel>
      </div>
      <EscalacaoPreJogo :lado="p.casa" :usuario="p.jogo.casa === usuario" />
      <EscalacaoPreJogo :lado="p.visitante" :usuario="p.jogo.visitante === usuario" />
    </div>
  </template>
</template>

<style scoped>
.confronto {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-6);
}
.lado {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.nome {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 15px;
  color: var(--texto-forte);
}
.duas {
  display: grid;
  grid-template-columns: minmax(300px, 0.9fr) 1fr 1fr;
  gap: var(--gap-painel);
  align-items: start;
}
.opcoes {
  display: flex;
  flex-direction: column;
  gap: var(--gap-painel);
}
.opcoes :deep(.we-btn--opcao) {
  width: 100%;
  margin-bottom: var(--space-2);
}
.lista {
  margin: 0;
  padding-left: 18px;
}
.nome--link {
  color: inherit;
  text-decoration: none;
}
.nome--link:hover {
  text-decoration: underline;
}
</style>
