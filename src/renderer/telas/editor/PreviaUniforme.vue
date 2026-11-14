<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { PAGINA_KIT } from '@core/we/desenharKit'

/**
 * Prévia do uniforme a partir da textura desenhada (128x256): um jogador de frente e de costas
 * montado com os pedaços da textura (camisa, mangas, calção, meião e a 1ª costa), ou a própria
 * página de textura que vai para o jogo.
 */
const props = defineProps<{
  textura: Uint8ClampedArray | null
  corNumero: string
  numero: number
  modo: 'jogador' | 'textura'
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const ESCALA = 3
const FIG = { largura: 100, altura: 184 }
const PELE = '#c99b78'
const CABELO = '#2a1d14'
const CHUTEIRA = '#111111'

type Ponto = [number, number]

function caminho(ctx: CanvasRenderingContext2D, pts: Ponto[]): void {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
}

/** Desenha um pedaço da textura recortado pelo contorno. */
function pedaco(ctx: CanvasRenderingContext2D, tex: HTMLCanvasElement, fonte: [number, number, number, number], destino: [number, number, number, number], contorno: Ponto[]): void {
  ctx.save()
  caminho(ctx, contorno)
  ctx.clip()
  ctx.drawImage(tex, ...fonte, ...destino)
  ctx.restore()
  caminho(ctx, contorno)
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  ctx.lineWidth = 0.6
  ctx.stroke()
}

const espelhar = (pts: Ponto[]): Ponto[] => pts.map(([x, y]) => [FIG.largura - x, y])

function figura(ctx: CanvasRenderingContext2D, tex: HTMLCanvasElement, costas: boolean): void {
  // Braços (atrás do tronco): mangas da textura e antebraço de pele.
  const manga: Ponto[] = [[27, 31], [15, 35], [8, 58], [20, 61], [26, 46]]
  const antebraco: Ponto[] = [[9, 57], [19, 60], [16, 84], [7, 82]]
  for (const lado of [0, 1]) {
    const m = lado ? espelhar(manga) : manga
    const a = lado ? espelhar(antebraco) : antebraco
    ctx.fillStyle = PELE
    caminho(ctx, a)
    ctx.fill()
    // De costas, a manga esquerda da tela é o braço direito do jogador.
    const metade = (lado === 1) !== costas ? 32 : 0
    pedaco(ctx, tex, [metade, 64, 32, 16], lado ? [74, 31, 19, 31] : [7, 31, 19, 31], m)
  }
  // Pernas e meiões.
  for (const x of [30, 55]) {
    ctx.fillStyle = PELE
    ctx.fillRect(x, 114, 15, 18)
    pedaco(ctx, tex, [0, 128, 32, 40], [x, 130, 15, 40], [[x, 130], [x + 15, 130], [x + 14, 170], [x + 1, 170]])
    ctx.fillStyle = CHUTEIRA
    ctx.fillRect(x - 1, 170, 18, 7)
  }
  // Calção.
  pedaco(ctx, tex, [0, 32, 64, 32], [25, 86, 50, 32], [[27, 86], [73, 86], [75, 115], [52, 117], [50, 108], [48, 117], [25, 115]])
  // Tronco.
  const tronco: Ponto[] = [[26, 30], [40, 27], [50, 31], [60, 27], [74, 30], [76, 46], [73, 89], [27, 89], [24, 46]]
  if (costas) pedaco(ctx, tex, [0, 80, 20, 24], [24, 27, 52, 62], tronco)
  else pedaco(ctx, tex, [0, 0, 64, 32], [24, 27, 52, 62], tronco)
  // Pescoço e cabeça.
  ctx.fillStyle = PELE
  ctx.fillRect(45, 22, 10, 7)
  ctx.beginPath()
  ctx.arc(50, 15, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = CABELO
  ctx.beginPath()
  if (costas) ctx.arc(50, 15, 10.4, Math.PI * 0.85, Math.PI * 2.15)
  else ctx.arc(50, 13, 10.4, Math.PI * 1.05, Math.PI * 1.95)
  ctx.fill()
  if (costas) {
    ctx.font = `700 26px "Chakra Petch", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 1.2
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    ctx.strokeText(String(props.numero), 50, 58)
    ctx.fillStyle = props.corNumero
    ctx.fillText(String(props.numero), 50, 58)
  }
}

function desenhar(): void {
  const c = canvas.value
  const t = props.textura
  if (!c) return
  const ctx = c.getContext('2d')!
  const { largura: W, altura: H } = PAGINA_KIT
  if (props.modo === 'textura') {
    c.width = W * 2
    c.height = H * 2
  } else {
    c.width = FIG.largura * 2 * ESCALA
    c.height = FIG.altura * ESCALA
  }
  ctx.clearRect(0, 0, c.width, c.height)
  if (!t) return
  const tex = document.createElement('canvas')
  tex.width = W
  tex.height = H
  tex.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(t), W, H), 0, 0)
  ctx.imageSmoothingEnabled = false
  if (props.modo === 'textura') {
    ctx.drawImage(tex, 0, 0, W * 2, H * 2)
    return
  }
  for (const [i, costas] of [false, true].entries()) {
    ctx.save()
    ctx.scale(ESCALA, ESCALA)
    ctx.translate(i * FIG.largura, 2)
    figura(ctx, tex, costas)
    ctx.restore()
  }
}

onMounted(desenhar)
watch(() => [props.textura, props.corNumero, props.numero, props.modo], desenhar)
</script>

<template>
  <canvas ref="canvas" class="previa" :class="`previa--${modo}`" role="img" :aria-label="modo === 'jogador' ? 'Prévia do uniforme: frente e costas' : 'Textura do uniforme no jogo'" />
</template>

<style scoped>
.previa {
  display: block;
  margin: 0 auto;
  image-rendering: pixelated;
  max-width: 100%;
}
.previa--jogador {
  width: 400px;
}
.previa--textura {
  width: 256px;
  background: repeating-conic-gradient(var(--painel-alt) 0 25%, var(--painel) 0 50%) 0 0 / 16px 16px;
}
</style>
