<script setup lang="ts">
import { APARENCIA_PADRAO, ATRIBUTOS, CABELOS, POSICOES, ROTULO_ATRIBUTO, type JogadorSemClube } from '@shared/esquemas/pacote'
import WeBotao from '../../componentes/WeBotao.vue'

/**
 * Campos do jogador no editor, comuns aos elencos (aba Jogadores) e aos sem clube (aba Sem clube):
 * dados, atributos e aparência. O jogador é editado no lugar (é o rascunho de quem usa).
 * Slots: `camisa` (no meio dos dados) e `meio` (entre atributos e aparência: contrato, taxa).
 */
const jogador = defineModel<JogadorSemClube>({ required: true })

function alternarAparencia(): void {
  if (jogador.value.aparencia) delete jogador.value.aparencia
  else jogador.value.aparencia = { ...APARENCIA_PADRAO }
}

function definirSecundaria(valor: string): void {
  jogador.value.posicao_secundaria = (valor || null) as JogadorSemClube['posicao_secundaria']
}

const letras = (ate: string) => Array.from({ length: ate.charCodeAt(0) - 64 }, (_, i) => String.fromCharCode(65 + i))
</script>

<template>
  <h3 class="secao-form">Jogador</h3>
  <div class="campos">
    <label class="campo campos--largo"><span class="we-lb">Nome</span><input v-model="jogador.nome" type="text" /></label>
    <label class="campo">
      <span class="we-lb">Nome no WE {{ jogador.nome_we.length }}/10</span>
      <input v-model="jogador.nome_we" type="text" maxlength="20" :aria-invalid="jogador.nome_we.length > 10 || !jogador.nome_we.trim()" />
    </label>
    <label class="campo">
      <span class="we-lb">Posição</span>
      <select v-model="jogador.posicao"><option v-for="p in POSICOES" :key="p" :value="p">{{ p }}</option></select>
    </label>
    <label class="campo">
      <span class="we-lb">Posição secundária</span>
      <select :value="jogador.posicao_secundaria ?? ''" @change="(e) => definirSecundaria((e.target as HTMLSelectElement).value)">
        <option value="">—</option>
        <option v-for="p in POSICOES" :key="p" :value="p">{{ p }}</option>
      </select>
    </label>
    <slot name="camisa" />
    <label class="campo"><span class="we-lb">Idade</span><input v-model.number="jogador.idade" type="number" min="14" max="50" /></label>
    <label class="campo"><span class="we-lb">Nacionalidade</span><input v-model="jogador.nacionalidade" type="text" maxlength="3" /></label>
    <label class="campo">
      <span class="we-lb">Pé</span>
      <select v-model="jogador.pe">
        <option value="destro">Destro</option>
        <option value="canhoto">Canhoto</option>
        <option value="ambidestro">Ambidestro</option>
      </select>
    </label>
    <label class="campo"><span class="we-lb">Altura (cm)</span><input v-model.number="jogador.altura" type="number" min="148" max="211" /></label>
    <label class="campo campo--check"><input v-model="jogador.outside" type="checkbox" /><span class="we-lb">Outside</span></label>
  </div>

  <h3 class="secao-form">Atributos (1-20)</h3>
  <div class="campos atributos">
    <label v-for="a in ATRIBUTOS" :key="a" class="campo">
      <span class="we-lb">{{ ROTULO_ATRIBUTO[a] }}</span>
      <input v-model.number="jogador.atributos[a]" type="number" min="1" max="20" />
    </label>
    <label class="campo"><span class="we-lb">Potencial (oculto)</span><input v-model.number="jogador.potencial" type="number" min="1" max="20" /></label>
    <label class="campo"><span class="we-lb">Resistência (oculta)</span><input v-model.number="jogador.resistencia" type="number" min="1" max="20" /></label>
  </div>

  <slot name="meio" />

  <h3 class="secao-form">Aparência no WE</h3>
  <div v-if="jogador.aparencia" class="campos">
    <label class="campo">
      <span class="we-lb">Pele (clara → escura)</span>
      <select v-model.number="jogador.aparencia.pele"><option v-for="n in 4" :key="n" :value="n">{{ n }}</option></select>
    </label>
    <label class="campo">
      <span class="we-lb">Físico (magro → forte)</span>
      <select v-model="jogador.aparencia.fisico"><option v-for="l in letras('H')" :key="l">{{ l }}</option></select>
    </label>
    <label class="campo">
      <span class="we-lb">Cabelo</span>
      <select v-model="jogador.aparencia.cabelo"><option v-for="c in CABELOS" :key="c">{{ c }}</option></select>
    </label>
    <label class="campo">
      <span class="we-lb">Cor do cabelo</span>
      <select v-model="jogador.aparencia.cor_cabelo"><option v-for="l in letras('H')" :key="l">{{ l }}</option></select>
    </label>
    <label class="campo">
      <span class="we-lb">Barba (A = sem)</span>
      <select v-model="jogador.aparencia.barba"><option v-for="l in letras('G')" :key="l">{{ l }}</option></select>
    </label>
    <label class="campo">
      <span class="we-lb">Cor da barba</span>
      <select v-model="jogador.aparencia.cor_barba"><option v-for="l in letras('G')" :key="l">{{ l }}</option></select>
    </label>
    <label class="campo">
      <span class="we-lb">Chuteira</span>
      <select v-model="jogador.aparencia.chuteira"><option v-for="l in letras('H')" :key="l">{{ l }}</option></select>
    </label>
  </div>
  <p v-else class="we-lb">Sem aparência definida: o WE mantém a do jogador original da vaga.</p>
  <div><WeBotao icone="jogador" @click="alternarAparencia">{{ jogador.aparencia ? 'Usar aparência original' : 'Definir aparência' }}</WeBotao></div>
</template>

<style scoped>
.atributos {
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
}
</style>
