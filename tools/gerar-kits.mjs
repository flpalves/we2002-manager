// Gera os PNGs de substituição dos kits para o DuckStation (opção B):
// o número da camisa continua na RAM (o jogo mostra o número certo em todo
// lugar) e o nome do arquivo de substituição é RECALCULADO.
//
// Como funciona:
//  1. kits/<time>_pagina.bin guarda a página de textura do kit (128x256, 8 bits,
//     índices de paleta) tirada da VRAM de um save state do PCSX-Redux.
//  2. O script remonta essa página como o jogo faz: costas sem número + algarismos
//     copiados da fita "0123456789" da própria página (colunas 64+6*d, linhas 68-79).
//     Um algarismo: célula na coluna 7 da costa; dois: colunas 3 e 11; linhas 7-18.
//  3. Calcula o hash do DuckStation (XXH3 de 64 bits sobre as linhas do retângulo)
//     e grava o PNG com o nome que o DuckStation vai procurar.
//  4. A arte (kits/<arte>.png, página inteira 128x256) recebe os mesmos números.
//
// Substituições dinâmicas: no modo página o DuckStation testa cada arquivo de
// substituição pelo hash do SEU retângulo (gpu_hw_texture_cache.cpp,
// GetTexturePageTextureReplacements) e aplica vários na mesma página. Por isso o
// kit é dividido em pedaços: topo e base (fixos) + uma costa por arquivo, com
// todas as camisas de 0 a 99 em cada uma das 10 costas. Assim qualquer escalação,
// troca de número ou substituição durante o jogo já tem arquivo pronto.
//
// Uso: node tools/gerar-kits.mjs [partida.json] [pasta de saída] [--verificar]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { carregarPartida } from "./lib/times.mjs";
import { PNG } from "pngjs";
import { xxh3 } from "@node-rs/xxhash";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERIAL = "SLPM-87056";
const args = process.argv.slice(2);
const [argPartida, argSaida] = args.filter((a) => !a.startsWith("--"));
const VERIFICAR = args.includes("--verificar");
const partidaPath = argPartida || path.join(ROOT, "data", "partida.json");
const DUCK_TEX = path.join(process.env.LOCALAPPDATA || path.join(ROOT, "duckstation"), "DuckStation", "textures", SERIAL);
const saida = argSaida || path.join(DUCK_TEX, "replacements");

const PW = 128, PH = 256; // página 8 bits: 128 texels x 256 linhas
const TILE = { x0: 0, y0: 80, w: 20, h: 24, porLinha: 5, total: 10 };
const DIG = { y: 7, h: 12, w: 6, x1: 7, x2: [3, 11] };
const FITA = { x: 64, y: 68 };
const NUMERO_MIN = 0xf0; // índices F0-F3 = pixels de algarismo
const TAMANHOS_PADRAO = [[100, 213], [100, 235]];

const tileOrigem = (k) => ({ x: TILE.x0 + (k % TILE.porLinha) * TILE.w, y: TILE.y0 + Math.floor(k / TILE.porLinha) * TILE.h });

// Para cada pixel das costas, um valor "sem número", vindo de alguma costa em que
// aquele pixel não é algarismo (todas as costas são iguais fora dos números).
function costasLimpas(pagina, ler, igual = (a) => a) {
  const limpo = [];
  for (let ty = 0; ty < TILE.h; ty++) {
    for (let tx = 0; tx < TILE.w; tx++) {
      let v = null;
      for (let k = 0; k < TILE.total && v === null; k++) {
        const { x, y } = tileOrigem(k);
        if (pagina[(y + ty) * PW + x + tx] < NUMERO_MIN) v = igual(ler(x + tx, y + ty));
      }
      if (v === null) throw new Error(`pixel (${tx},${ty}) é algarismo em todas as costas`);
      limpo.push(v);
    }
  }
  return limpo;
}

// Posições dos pixels de algarismo para um número numa costa: [{x,y,indice}]
function pixelsDoNumero(pagina, k, numero) {
  const s = String(numero);
  const xs = s.length === 1 ? [DIG.x1] : DIG.x2;
  const { x, y } = tileOrigem(k);
  const out = [];
  [...s].forEach((d, i) => {
    const fx = FITA.x + Number(d) * DIG.w;
    for (let r = 0; r < DIG.h; r++) {
      for (let c = 0; c < DIG.w; c++) {
        const v = pagina[(FITA.y + r) * PW + fx + c];
        if (v !== 0) out.push({ x: x + xs[i] + c, y: y + DIG.y + r, indice: v });
      }
    }
  });
  return out;
}

function montarPagina(ref, numeros) {
  const pag = Buffer.from(ref);
  const limpo = costasLimpas(ref, (x, y) => ref[y * PW + x]);
  for (let k = 0; k < TILE.total; k++) {
    const { x, y } = tileOrigem(k);
    for (let ty = 0; ty < TILE.h; ty++) for (let tx = 0; tx < TILE.w; tx++) pag[(y + ty) * PW + x + tx] = limpo[ty * TILE.w + tx];
    for (const p of pixelsDoNumero(ref, k, numeros[k])) pag[p.y * PW + p.x] = p.indice;
  }
  return pag;
}

function hashRetangulo(pag, w, h, x0 = 0, y0 = 0) {
  const linhas = [];
  for (let y = y0; y < y0 + h; y++) linhas.push(pag.subarray(y * PW + x0, y * PW + x0 + w));
  return xxh3.xxh64(Buffer.concat(linhas)).toString(16).toUpperCase().padStart(16, "0");
}

function hexParaRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || "");
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : null;
}

// Escala da arte: 1 = tamanho original (128x256), 2 = 256x512, 4 = 512x1024...
// O DuckStation aceita substituições maiores que o original (kits em HD).
function escalaDaArte(arte) {
  const S = arte.width / PW;
  if (!Number.isInteger(S) || S < 1 || arte.height !== PH * S) {
    throw new Error(`a arte precisa ter ${PW}x${PH} ou um múltiplo exato (ex.: 512x1024); veio ${arte.width}x${arte.height}`);
  }
  return S;
}

// costaModelo:
//  "primeira" -> a 1ª costa (canto superior esquerdo da faixa das costas) da arte é
//                desenhada SEM número e é copiada para as 10 costas (kits desenhados por você);
//  "auto"     -> as costas da arte já têm números (ex.: dump original); o fundo sem
//                número é reconstruído juntando as 10 costas.
function montarArte(arte, ref, numeros, paleta, corNumero, costaModelo = "auto") {
  const S = escalaDaArte(arte);
  const png = new PNG({ width: arte.width, height: arte.height });
  arte.data.copy(png.data);
  const copiarBloco = (sx, sy, dx, dy) => {
    for (let j = 0; j < S; j++) arte.data.copy(png.data, ((dy * S + j) * arte.width + dx * S) * 4,
      ((sy * S + j) * arte.width + sx * S) * 4, ((sy * S + j) * arte.width + sx * S + S) * 4);
  };
  const pintarBloco = (x, y, c) => {
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const o = ((y * S + j) * arte.width + x * S + i) * 4;
      png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; png.data[o + 3] = 255;
    }
  };
  const t0 = tileOrigem(0);
  const fontes = costaModelo === "primeira"
    ? Array.from({ length: TILE.w * TILE.h }, (_, i) => [t0.x + (i % TILE.w), t0.y + Math.floor(i / TILE.w)])
    : costasLimpas(ref, (x, y) => [x, y]);
  for (let k = 0; k < TILE.total; k++) {
    const { x, y } = tileOrigem(k);
    for (let ty = 0; ty < TILE.h; ty++) for (let tx = 0; tx < TILE.w; tx++) {
      const [sx, sy] = fontes[ty * TILE.w + tx];
      copiarBloco(sx, sy, x + tx, y + ty);
    }
    for (const p of pixelsDoNumero(ref, k, numeros[k])) pintarBloco(p.x, p.y, corNumero || paleta[p.indice] || [200, 200, 200]);
  }
  return png;
}

function recortar(png, w, h, x0 = 0, y0 = 0) {
  const S = png.width / PW;
  const W = w * S, H = h * S, X = x0 * S, Y = y0 * S;
  const out = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) png.data.copy(out.data, y * W * 4, ((Y + y) * png.width + X) * 4, ((Y + y) * png.width + X + W) * 4);
  return out;
}

// Pedaços fixos do kit (sem as costas numeradas, linhas 80-127).
const PEDACOS_FIXOS = [[0, 0, 100, 80], [0, 128, 100, 107]];
const nomeArquivo = (hash, pal, x, y, w, h) => `texpage-P8-${hash}-${pal}-128x256-${x}-${y}-${w}x${h}-P0-255.png`;

// Tamanhos de retângulo que o DuckStation já usou para esta paleta (pasta dumps).
function tamanhosConhecidos(palHash) {
  const set = new Set(TAMANHOS_PADRAO.map(([w, h]) => `${w}x${h}`));
  const dumps = path.join(DUCK_TEX, "dumps");
  if (fs.existsSync(dumps)) {
    const re = new RegExp(`^texpage-P8-[0-9A-F]{16}-${palHash}-128x256-0-0-(\\d+)x(\\d+)-P0-255\\.png$`);
    for (const f of fs.readdirSync(dumps)) { const m = re.exec(f); if (m) set.add(`${m[1]}x${m[2]}`); }
  }
  return [...set].map((s) => s.split("x").map(Number));
}

// Principal ------------------------------------------------------------------
const partida = carregarPartida(partidaPath, ROOT);
fs.mkdirSync(saida, { recursive: true });
let erros = 0;

for (const lado of ["casa", "visitante"]) {
  const kit = (partida.kits || {})[lado];
  if (!kit) continue;
  const ref = fs.readFileSync(path.resolve(ROOT, kit.pagina));
  const numeros = [...kit.numeros_originais];
  for (const e of partida.edicoes || []) {
    const l = e.lado === "visitante" ? "visitante" : "casa";
    if (l === lado && typeof e.camisa === "number" && e.jogador >= 1 && e.jogador <= 10) numeros[e.jogador - 1] = e.camisa;
  }
  if (numeros.some((n) => !(n >= 0 && n <= 99))) throw new Error(`${lado}: camisas precisam ser de 0 a 99`);

  if (VERIFICAR) {
    for (const [w, h, esperado] of kit.verificacao || []) {
      const got = hashRetangulo(montarPagina(ref, kit.numeros_originais), w, h);
      const ok = got === esperado;
      if (!ok) erros++;
      console.log(`${lado}: verificação ${w}x${h} com números originais: ${got} ${ok ? "OK" : `ESPERADO ${esperado}`}`);
    }
  }

  const pag = montarPagina(ref, numeros);
  const paleta = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.resolve(ROOT, kit.paleta), "utf8"))).map(([k, v]) => [Number(k), v]));
  const arte = PNG.sync.read(fs.readFileSync(path.resolve(ROOT, kit.arte)));
  const cor = hexParaRgb(kit.cor_numero);
  const arteFinal = montarArte(arte, ref, numeros, paleta, cor, kit.costa_modelo);

  const pasta = path.join(saida, `we2002-${lado}`);
  fs.mkdirSync(pasta, { recursive: true });
  let n = 0;
  // 1. Pedaços fixos (camisa da frente, calção, meião etc.)
  for (const [x, y, w, h] of PEDACOS_FIXOS) {
    fs.writeFileSync(path.join(pasta, nomeArquivo(hashRetangulo(pag, w, h, x, y), kit.paleta_hash, x, y, w, h)),
      PNG.sync.write(recortar(arteFinal, w, h, x, y)));
    n++;
  }
  // 2. Cada costa com cada número possível
  for (let numero = 0; numero <= 99; numero++) {
    const todas = Array(TILE.total).fill(numero);
    const pagN = montarPagina(ref, todas);
    const arteN = montarArte(arte, ref, todas, paleta, cor, kit.costa_modelo);
    for (let k = 0; k < TILE.total; k++) {
      const { x, y } = tileOrigem(k);
      const hash = hashRetangulo(pagN, TILE.w, TILE.h, x, y);
      fs.writeFileSync(path.join(pasta, nomeArquivo(hash, kit.paleta_hash, x, y, TILE.w, TILE.h)),
        PNG.sync.write(recortar(arteN, TILE.w, TILE.h, x, y)));
      n++;
    }
  }
  console.log(`${lado}: ${n} arquivos (escala ${escalaDaArte(arte)}x) em ${pasta} — arte: ${kit.arte}`);
}
if (erros) { console.error(`${erros} verificação(ões) falharam`); process.exit(1); }
