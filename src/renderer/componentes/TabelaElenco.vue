<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { JogadorElenco } from '@shared/esquemas/elenco'
import WeTabela from './WeTabela.vue'
import WeTag from './WeTag.vue'
import WeSeta from './WeSeta.vue'
import WeBandeira from './WeBandeira.vue'
import BarraCondicao from './BarraCondicao.vue'
import WeThOrdem from './WeThOrdem.vue'
import { dinheiro, geralTexto, nomePosicao, type OrdemElenco } from '../formato'

/** Tabela do elenco (do usuário ou de outro clube), com bandeira e link para a ficha. */
withDefaults(
  defineProps<{
    jogadores: readonly JogadorElenco[]
    /** Temporada atual: contrato que acaba nela fica em destaque. */
    temporada: number
    /** Ids dos titulares do próximo jogo (marcados na coluna Situação). */
    titulares?: ReadonlySet<string>
    /** Coluna ordenada (títulos clicáveis; o pai ordena a lista). */
    ordem?: OrdemElenco
    crescente?: boolean
  }>(),
  { titulares: undefined, ordem: undefined, crescente: true },
)
defineEmits<{ ordenar: [chave: OrdemElenco] }>()

/** Colunas na ordem da tabela; `null` = não ordenável. */
const COLUNAS: { rotulo: string; chave: OrdemElenco | null }[] = [
  { rotulo: 'Nº', chave: 'camisa' },
  { rotulo: 'Pos.', chave: 'posicao' },
  { rotulo: 'Jogador', chave: 'nome' },
  { rotulo: 'Idade', chave: 'idade' },
  { rotulo: 'Geral', chave: 'geral' },
  { rotulo: 'Condição', chave: 'condicao' },
  { rotulo: 'Seta', chave: 'seta' },
  { rotulo: 'Moral', chave: 'moral' },
  { rotulo: 'Situação', chave: null },
  { rotulo: 'Contrato', chave: 'contrato' },
  { rotulo: 'Salário', chave: 'salario' },
  { rotulo: 'Valor', chave: 'valor' },
]
</script>

<template>
  <WeTabela>
    <thead>
      <tr>
        <template v-for="c in COLUNAS" :key="c.rotulo">
          <WeThOrdem v-if="c.chave && ordem" :rotulo="c.rotulo" :chave="c.chave" :ordem="ordem" :crescente="crescente" @ordenar="$emit('ordenar', $event)" />
          <th v-else>{{ c.rotulo }}</th>
        </template>
      </tr>
    </thead>
    <tbody>
      <tr v-for="j in jogadores" :key="j.id">
        <td>{{ j.camisa }}</td>
        <td :title="j.posicaoSecundaria ? `Secundária: ${nomePosicao(j.posicaoSecundaria)}` : ''">{{ nomePosicao(j.posicao) }}</td>
        <td>
          <span class="jogador">
            <WeBandeira :codigo="j.nacionalidade" />
            <RouterLink class="link" :to="{ name: 'jogador', params: { id: j.id } }">{{ j.nome }}</RouterLink>
          </span>
        </td>
        <td>{{ j.idade }}</td>
        <td class="geral">{{ geralTexto(j.geral) }}</td>
        <td><BarraCondicao :valor="j.condicao" /></td>
        <td><WeSeta :nivel="j.seta" /></td>
        <td>{{ j.moral }}</td>
        <td>
          <span class="tags">
            <WeTag v-if="titulares?.has(j.id)" tipo="info">Titular</WeTag>
            <WeTag v-if="j.lesaoSemanas" tipo="negativo">Lesão {{ j.lesaoSemanas }} sem.</WeTag>
            <WeTag v-for="c in j.suspenso" :key="`s${c}`" tipo="negativo" :title="c">Suspenso</WeTag>
            <WeTag v-for="c in j.pendurado" :key="`p${c}`" tipo="atencao" :title="c">Pendurado</WeTag>
          </span>
        </td>
        <td :class="{ 'we-vl--atencao': j.contratoAte !== null && j.contratoAte <= temporada }">{{ j.contratoAte ?? '—' }}</td>
        <td>{{ j.salario ? dinheiro(j.salario) : '—' }}</td>
        <td>{{ dinheiro(j.valor) }}</td>
      </tr>
    </tbody>
  </WeTabela>
</template>

<style scoped>
.geral {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--texto-forte);
}
.tags {
  display: inline-flex;
  gap: 4px;
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
</style>
