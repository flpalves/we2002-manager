<script setup lang="ts">
import TimeDaCarreira from '../componentes/TimeDaCarreira.vue'
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { StatusWe } from '@shared/esquemas/we'
import WePainel from '../componentes/WePainel.vue'
import WeBotao from '../componentes/WeBotao.vue'
import WePlacar from '../componentes/WePlacar.vue'
import WeEscudo from '../componentes/WeEscudo.vue'
import WeTabela from '../componentes/WeTabela.vue'
import { useTela } from '../composables/useTela'
import { useCarreira, urlArquivoCarreira } from '../stores/carreira'
import { useTemporada } from '../stores/temporada'
import { useUi } from '../stores/ui'
import { chamar } from '../api'

/** Pós-jogo: o usuário confere o resultado do WE e confirma; só então ele entra na carreira. */
const router = useRouter()
const carreira = useCarreira()
const temporada = useTemporada()
const ui = useUi()
const s = ref<StatusWe | null>(null)
const ocupado = ref(false)

useTela([{ comando: 'acaoX', rotulo: 'Confirmar' }], { acaoX: () => void confirmar() })

onMounted(async () => {
  try {
    s.value = await chamar('we:status', undefined)
    if (s.value.estado !== 'final') {
      ui.avisar('O resultado final ainda não chegou.')
      void router.replace({ name: 'emulador' })
    }
  } catch (e) {
    ui.avisar((e as Error).message)
  }
})

const time = (sigla: string) => temporada.times.get(sigla)

async function confirmar(): Promise<void> {
  ocupado.value = true
  try {
    await carreira.concluirJogo(await chamar('we:confirmar', undefined))
  } catch (e) {
    ui.avisar((e as Error).message, 8000)
  } finally {
    ocupado.value = false
  }
}
</script>

<template>
  <h1 class="titulo-tela">Pós-jogo</h1>
  <template v-if="s && s.jogo && s.placar">
    <WePainel :titulo="`${s.jogo.competicaoNome} · ${s.jogo.faseNome} · resultado do WE2002`" clube>
      <div class="confronto">
        <div class="lado">
          <WeEscudo :sigla="s.jogo.casa" :cor="time(s.jogo.casa)?.cores[0]" :src="urlArquivoCarreira(time(s.jogo.casa)?.escudo ?? null)" tamanho="m" />
          <RouterLink class="nome nome--link" :to="{ name: 'time', params: { sigla: s.jogo.casa } }">{{ temporada.nome(s.jogo.casa) }}</RouterLink>
        </div>
        <div class="centro">
          <WePlacar :casa="s.placar.golsCasa" :visitante="s.placar.golsVisitante" />
          <span v-if="s.placar.prorrogacao" class="we-lb">com prorrogação</span>
          <span v-if="s.placar.penaltisCasa !== null" class="we-lb">Pênaltis: {{ s.placar.penaltisCasa }} x {{ s.placar.penaltisVisitante }}</span>
        </div>
        <div class="lado">
          <WeEscudo :sigla="s.jogo.visitante" :cor="time(s.jogo.visitante)?.cores[0]" :src="urlArquivoCarreira(time(s.jogo.visitante)?.escudo ?? null)" tamanho="m" />
          <RouterLink class="nome nome--link" :to="{ name: 'time', params: { sigla: s.jogo.visitante } }">{{ temporada.nome(s.jogo.visitante) }}</RouterLink>
        </div>
      </div>
      <p v-if="s.penaltisNoManager" class="we-lb">Se o agregado do confronto estiver empatado, o manager decide nos pênaltis ao confirmar.</p>
      <p class="we-lb">
        Substituições, cartões por jogador e lesões ainda não são lidos do WE: os 11 titulares contam os minutos todos, e os amarelos entram só no total do time.
      </p>
      <div class="acoes">
        <WeBotao icone="confirmar" variante="principal" :desabilitado="ocupado" data-foco-inicial @click="confirmar">Confirmar resultado</WeBotao>
        <WeBotao icone="voltar" :desabilitado="ocupado" @click="router.push({ name: 'emulador' })">Voltar (jogar de novo, simular ou digitar)</WeBotao>
      </div>
    </WePainel>

    <WePainel titulo="Gols" sem-corpo>
      <p v-if="!s.gols.length" class="vazio">Sem gols.</p>
      <WeTabela v-else>
        <tbody>
          <tr v-for="(g, i) in s.gols" :key="i">
            <td>{{ g.minuto }}'</td>
            <td><TimeDaCarreira :sigla="g.lado === 'casa' ? s.jogo.casa : s.jogo.visitante" /></td>
            <td>{{ g.autor ?? 'sem autor' }}</td>
            <td class="we-lb">{{ g.assistencia ? `assist. ${g.assistencia}` : '' }}</td>
          </tr>
        </tbody>
      </WeTabela>
    </WePainel>
  </template>
</template>

<style scoped>
.confronto {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-6);
}
.lado,
.centro {
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
.vazio {
  padding: var(--space-2);
  margin: 0;
}
.nome--link {
  color: inherit;
  text-decoration: none;
}
.nome--link:hover {
  text-decoration: underline;
}
</style>
