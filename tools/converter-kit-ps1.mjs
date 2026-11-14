// Converte um kit desenhado (kits/desenhos/*.png) para o formato do próprio
// PS1: 8 bits por pixel + paleta de 256 cores. A ponte Lua do PCSX-Redux grava
// o resultado na VRAM durante a partida (funciona sem texture replacement).
//
// - Só as regiões do uniforme são trocadas; pele/cabeça e a fonte dos números
//   continuam as do jogo, e as cores que elas usam ficam reservadas na paleta.
// - O desenho é reduzido para o tamanho original (128x256) e quantizado nas
//   cores livres da paleta (no Brasil, 121).
// - Os números das costas continuam sendo desenhados pelo jogo: a ponte só
//   preserva os pixels de algarismo (índices F0-F3) que já estiverem na VRAM.
//
// Uso: node tools/converter-kit-ps1.mjs [partida.json]
// Saída (por lado): kits/convertidos/<lado>_{pagina,mascara,paleta,paleta_mascara}.bin

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { carregarPartida } from "./lib/times.mjs";
import { PNG } from "pngjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const partidaPath = process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(ROOT, "data", "partida.json");
const SAIDA = path.join(ROOT, "kits", "convertidos");
const PW = 128, PH = 256;

// Regiões do uniforme (mesmo mapa de kits/modelos/guia_regioes_4x.png)
const REGIOES_UNIFORME = [
  [0, 0, 64, 32], [0, 32, 64, 64], [0, 64, 64, 80], [0, 80, 100, 128],
  [0, 128, 32, 208], [32, 128, 64, 235], [64, 128, 100, 160],
];
const COSTAS = { x: 0, y: 80, w: 20, h: 24, total: 10, porLinha: 5 };
const DIGITOS = [0xf0, 0xf1, 0xf2, 0xf3];

function mascaraUniforme() {
  const m = new Uint8Array(PW * PH);
  for (const [x0, y0, x1, y1] of REGIOES_UNIFORME)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * PW + x] = 1;
  return m;
}

// Reduz a arte (escala S) para 128x256 pela média de cada bloco SxS.
function reduzir(arte) {
  const S = arte.width / PW;
  if (!Number.isInteger(S) || arte.height !== PH * S) throw new Error(`arte precisa ser 128x256 ou múltiplo exato; veio ${arte.width}x${arte.height}`);
  const out = new Array(PW * PH);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const o = ((y * S + j) * arte.width + x * S + i) * 4;
      if (arte.data[o + 3] >= 128) { r += arte.data[o]; g += arte.data[o + 1]; b += arte.data[o + 2]; n++; }
      a++;
    }
    out[y * PW + x] = n * 2 >= a ? [r / n, g / n, b / n] : null; // null = transparente
  }
  return out;
}

// Median cut simples: divide a caixa com maior variação até ter k cores.
function medianCut(cores, k) {
  let caixas = [cores];
  while (caixas.length < k) {
    let melhor = -1, eixo = 0, faixa = -1;
    caixas.forEach((c, i) => {
      if (c.length < 2) return;
      for (let e = 0; e < 3; e++) {
        let mn = 255, mx = 0;
        for (const p of c) { if (p[e] < mn) mn = p[e]; if (p[e] > mx) mx = p[e]; }
        if (mx - mn > faixa) { faixa = mx - mn; melhor = i; eixo = e; }
      }
    });
    if (melhor < 0 || faixa <= 0) break;
    const c = caixas[melhor].sort((a, b) => a[eixo] - b[eixo]);
    const meio = c.length >> 1;
    caixas.splice(melhor, 1, c.slice(0, meio), c.slice(meio));
  }
  return caixas.map((c) => [0, 1, 2].map((e) => c.reduce((s, p) => s + p[e], 0) / c.length));
}

// RGB 8 bits -> cor PS1 de 15 bits (BGR555). 0x0000 é transparente no PS1,
// então preto vira o tom mais escuro não-transparente.
function paraPs1([r, g, b]) {
  const c = (Math.round(r) >> 3) | ((Math.round(g) >> 3) << 5) | ((Math.round(b) >> 3) << 10);
  return c === 0 ? 0x0421 : c;
}
const dePs1 = (c) => [(c & 31) << 3, ((c >> 5) & 31) << 3, ((c >> 10) & 31) << 3];
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function hexParaRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || "");
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
}

function converter(lado, kit) {
  const ref = fs.readFileSync(path.resolve(ROOT, kit.pagina));
  const palRef = new Uint16Array(new Uint8Array(fs.readFileSync(path.resolve(ROOT, kit.ps1.paleta_vram))).buffer);
  const arte = reduzir(PNG.sync.read(fs.readFileSync(path.resolve(ROOT, kit.arte))));
  // Uniforme = regiões do mapa + tudo o que o desenho mudou em relação ao kit original
  // (o mapa é aproximado). A fonte dos números nunca é trocada.
  const mascara = mascaraUniforme();
  const original = reduzir(PNG.sync.read(fs.readFileSync(path.resolve(ROOT, kit.pagina.replace("_pagina.bin", "_original.png")))));
  for (let i = 0; i < PW * PH; i++) {
    const a = arte[i], o = original[i];
    if (a && o && Math.abs(a[0] - o[0]) + Math.abs(a[1] - o[1]) + Math.abs(a[2] - o[2]) > 24) mascara[i] = 1;
  }
  for (let y = 64; y < 80; y++) for (let x = 64; x < 124; x++) mascara[y * PW + x] = 0;

  // Costas: a 1ª costa desenhada (sem número) vira o fundo das 10.
  if ((kit.costa_modelo || "primeira") === "primeira") {
    for (let k = 1; k < COSTAS.total; k++) {
      const ox = COSTAS.x + (k % COSTAS.porLinha) * COSTAS.w, oy = COSTAS.y + Math.floor(k / COSTAS.porLinha) * COSTAS.h;
      for (let ty = 0; ty < COSTAS.h; ty++) for (let tx = 0; tx < COSTAS.w; tx++)
        arte[(oy + ty) * PW + ox + tx] = arte[(COSTAS.y + ty) * PW + COSTAS.x + tx];
    }
  }

  // Cores reservadas: tudo o que aparece fora das regiões do uniforme + algarismos.
  const reservadas = new Set(DIGITOS);
  for (let i = 0; i < PW * PH; i++) if (!mascara[i]) reservadas.add(ref[i]);
  const livres = [];
  for (let i = 1; i < 256; i++) if (!reservadas.has(i)) livres.push(i);

  // Quantiza as cores do uniforme nas entradas livres (reserva 1 para transparente, se preciso).
  const pixels = [];
  let temTransparente = false;
  for (let i = 0; i < PW * PH; i++) if (mascara[i]) { if (arte[i]) pixels.push(arte[i]); else temTransparente = true; }
  const nCores = Math.min(livres.length - (temTransparente ? 1 : 0), 255);
  const centros = medianCut(pixels.slice(), nCores);
  const paleta = Uint16Array.from(palRef);
  const palMascara = new Uint8Array(256);
  const corDe = [];
  centros.forEach((c, i) => { const idx = livres[i]; paleta[idx] = paraPs1(c); palMascara[idx] = 1; corDe.push([idx, dePs1(paleta[idx])]); });
  const idxTransp = temTransparente ? livres[centros.length] : null;
  if (idxTransp !== undefined && idxTransp !== null) { paleta[idxTransp] = 0x0000; palMascara[idxTransp] = 1; }

  // Cor dos números (opcional): recolore F0-F3 em degradê.
  const corNum = hexParaRgb(kit.cor_numero);
  if (corNum && kit.ps1.recolorir_numeros !== false) {
    DIGITOS.forEach((idx, i) => { const f = 1 - i * 0.08; paleta[idx] = paraPs1(corNum.map((v) => v * f)); palMascara[idx] = 1; });
  }

  // Página: uniforme com as cores novas; o resto continua igual ao jogo.
  const pagina = Buffer.from(ref);
  const cache = new Map();
  for (let i = 0; i < PW * PH; i++) {
    if (!mascara[i]) continue;
    const p = arte[i];
    if (!p) { pagina[i] = idxTransp ?? 0; continue; }
    const chave = (Math.round(p[0]) << 16) | (Math.round(p[1]) << 8) | Math.round(p[2]);
    let melhor = cache.get(chave);
    if (melhor === undefined) {
      let d = Infinity;
      for (const [idx, c] of corDe) { const dd = dist2(p, c); if (dd < d) { d = dd; melhor = idx; } }
      cache.set(chave, melhor);
    }
    pagina[i] = melhor;
  }

  fs.mkdirSync(SAIDA, { recursive: true });
  const base = path.join(SAIDA, lado);
  fs.writeFileSync(`${base}_pagina.bin`, pagina);
  fs.writeFileSync(`${base}_mascara.bin`, mascara);
  fs.writeFileSync(`${base}_paleta.bin`, Buffer.from(paleta.buffer));
  fs.writeFileSync(`${base}_paleta_mascara.bin`, palMascara);
  fs.writeFileSync(`${base}_previa.png`, previa(pagina, paleta));
  console.log(`${lado}: ${kit.arte} -> ${centros.length} cores (de ${livres.length} livres) em ${path.relative(ROOT, base)}_*.bin`);
}

function previa(pagina, paleta) {
  const S = 4, png = new PNG({ width: PW * S, height: PH * S });
  for (let y = 0; y < PH * S; y++) for (let x = 0; x < PW * S; x++) {
    const c = paleta[pagina[Math.floor(y / S) * PW + Math.floor(x / S)]];
    const o = (y * PW * S + x) * 4, [r, g, b] = dePs1(c);
    png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b; png.data[o + 3] = c === 0 ? 0 : 255;
  }
  return PNG.sync.write(png);
}

const partida = carregarPartida(partidaPath, ROOT);
for (const lado of ["casa", "visitante"]) {
  const kit = (partida.kits || {})[lado];
  if (kit && kit.ps1 && kit.ps1.ativo !== false) converter(lado, kit);
}
