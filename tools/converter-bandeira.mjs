// Converte a bandeira/escudo de cada time (PNG ou JPG) para os formatos que o
// WE2002 usa: 64x28 (substituição, seleção de times) e 22x8 (placar), 4 bits
// por pixel, as duas com a MESMA paleta de 16 cores (o jogo compartilha a paleta).
// A ponte do PCSX-Redux (bridge/bandeiras.lua) grava o resultado na VRAM
// sempre que o jogo carrega a bandeira original.
//
// Onde configurar (o que vier primeiro vale):
//   partida.json   "casa": { "bandeira": "bandeiras/corinthians.png", "bandeira_ajuste": "ajustar" }
//   data/times/x.json  "bandeira": "bandeiras/corinthians.png"
// Caminhos relativos à pasta do projeto.
//
// bandeira_ajuste:
//   "esticar" (padrão)  estica a imagem para 64x28
//   "ajustar"           cabe inteira, sem distorcer; sobra transparente nas laterais
//   "cortar"            preenche tudo, sem distorcer; corta o que sobrar
// Pixels transparentes do PNG ficam transparentes no jogo (cor 0 da paleta).
//
// Uso: node tools/converter-bandeira.mjs [partida.json]
// Saída: kits/convertidos/bandeira_<lado>.bin (64x28), bandeira_<lado>_pequena.bin (22x8 dentro
//        de um bloco de 24x8), bandeira_<lado>_paleta.bin e bandeira_<lado>_previa.png

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { carregarPartida } from "./lib/times.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const partidaPath = process.argv.slice(2).find((a) => !a.startsWith("--")) || path.join(ROOT, "data", "partida.json");
const SAIDA = path.join(ROOT, "kits", "convertidos");
const W = 64, H = 28, MAX_CORES = 15; // a cor 0 é a transparente
const PW = 22, PH = 8, PBLOCO = 24;   // bandeirinha do placar: 22x8, gravada num bloco de 24 (1 pixel de folga de cada lado)

function lerImagem(arquivo) {
  const buf = fs.readFileSync(arquivo);
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    const png = PNG.sync.read(buf);
    return { width: png.width, height: png.height, data: png.data };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    const img = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
    return { width: img.width, height: img.height, data: img.data };
  }
  throw new Error(`${arquivo}: formato não suportado (use PNG ou JPG)`);
}

// Redimensiona para W x H pela média da área de cada pixel de destino.
// Retorna um array de [r,g,b] ou null (transparente).
function redimensionar(img, ajuste, W, H) {
  let sx0 = 0, sy0 = 0, sw = img.width, sh = img.height; // recorte da origem
  let dx0 = 0, dy0 = 0, dw = W, dh = H;                    // área no destino
  const rOrig = img.width / img.height, rDest = W / H;
  if (ajuste === "cortar") {
    if (rOrig > rDest) { sw = img.height * rDest; sx0 = (img.width - sw) / 2; }
    else { sh = img.width / rDest; sy0 = (img.height - sh) / 2; }
  } else if (ajuste === "ajustar") {
    if (rOrig > rDest) { dh = Math.max(1, Math.round(W / rOrig)); dy0 = Math.floor((H - dh) / 2); }
    else { dw = Math.max(1, Math.round(H * rOrig)); dx0 = Math.floor((W - dw) / 2); }
  }
  const out = new Array(W * H).fill(null);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const ax = sx0 + (x * sw) / dw, bx = sx0 + ((x + 1) * sw) / dw;
    const ay = sy0 + (y * sh) / dh, by = sy0 + ((y + 1) * sh) / dh;
    let r = 0, g = 0, b = 0, a = 0, peso = 0;
    const x0 = Math.floor(ax), x1 = Math.max(x0 + 1, Math.ceil(bx));
    const y0 = Math.floor(ay), y1 = Math.max(y0 + 1, Math.ceil(by));
    for (let j = y0; j < y1 && j < img.height; j++) for (let i = x0; i < x1 && i < img.width; i++) {
      const wx = Math.min(i + 1, bx) - Math.max(i, ax), wy = Math.min(j + 1, by) - Math.max(j, ay);
      const w = Math.max(0, wx) * Math.max(0, wy) || 1e-6;
      const o = (j * img.width + i) * 4, al = img.data[o + 3] / 255;
      r += img.data[o] * al * w; g += img.data[o + 1] * al * w; b += img.data[o + 2] * al * w;
      a += al * w; peso += w;
    }
    out[(dy0 + y) * W + dx0 + x] = a / peso >= 0.5 ? [r / a, g / a, b / a] : null;
  }
  return out;
}

// Median cut: divide a caixa com maior variação até ter k cores.
function medianCut(cores, k) {
  let caixas = [cores];
  while (caixas.length < k) {
    let melhor = -1, eixo = 0, faixa = -1;
    caixas.forEach((c, i) => {
      if (c.length < 2) return;
      for (let e = 0; e < 3; e++) {
        let mn = 255, mx = 0;
        for (const p of c) { mn = Math.min(mn, p[e]); mx = Math.max(mx, p[e]); }
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

// RGB 8 bits -> PS1 BGR555 com o bit 15 ligado (como as bandeiras originais).
const paraPs1 = ([r, g, b]) => 0x8000 | (Math.round(r) >> 3) | ((Math.round(g) >> 3) << 5) | ((Math.round(b) >> 3) << 10);
const dePs1 = (c) => [(c & 31) << 3, ((c >> 5) & 31) << 3, ((c >> 10) & 31) << 3];
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

function converter(lado, arquivo, ajuste) {
  const imagem = lerImagem(arquivo);
  const pix = redimensionar(imagem, ajuste, W, H);
  const pixP = redimensionar(imagem, ajuste, PW, PH);
  const opacos = pix.filter(Boolean).concat(pixP.filter(Boolean));
  if (!opacos.length) throw new Error(`${arquivo}: imagem toda transparente`);
  // Cores exatas, se couberem; senão median cut
  const unicas = new Map();
  for (const p of opacos) unicas.set(paraPs1(p), p);
  const centros = unicas.size <= MAX_CORES ? [...unicas.values()] : medianCut(opacos.map((p) => p.slice()), MAX_CORES);
  const paleta = new Uint16Array(16); // índice 0 = 0x0000 (transparente)
  centros.forEach((c, i) => { paleta[i + 1] = paraPs1(c); });
  const corDe = centros.map((_, i) => dePs1(paleta[i + 1]));
  const indice = (p) => {
    if (!p) return 0;
    let m = 0, md = Infinity;
    corDe.forEach((c, i) => { const d = dist2(p, c); if (d < md) { md = d; m = i; } });
    return m + 1;
  };
  const idx = pix.map(indice);
  const idxP = pixP.map(indice);
  // 4 bits por pixel: 4 pixels por halfword, o primeiro no nibble baixo
  const pagina = Buffer.alloc((W / 2) * H);
  for (let i = 0; i < W * H; i += 2) pagina[i >> 1] = idx[i] | (idx[i + 1] << 4);
  const pal = Buffer.from(paleta.buffer);
  fs.mkdirSync(SAIDA, { recursive: true });
  const base = path.join(SAIDA, `bandeira_${lado}`);
  fs.writeFileSync(`${base}.bin`, pagina);
  // bandeirinha: bloco de 24x8 (colunas 0 e 23 transparentes)
  const peq = Buffer.alloc((PBLOCO / 2) * PH);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PBLOCO; x += 2) {
    const v = (xx) => (xx >= 1 && xx <= PW ? idxP[y * PW + xx - 1] : 0);
    peq[(y * PBLOCO + x) >> 1] = v(x) | (v(x + 1) << 4);
  }
  fs.writeFileSync(`${base}_pequena.bin`, peq);
  fs.writeFileSync(`${base}_paleta.bin`, pal);
  // Prévia 4x (transparente = xadrez)
  const Z = 4, prev = new PNG({ width: W * Z, height: (H + 2 + PH) * Z });
  for (let y = 0; y < (H + 2 + PH) * Z; y++) for (let x = 0; x < W * Z; x++) {
    const yy = Math.floor(y / Z), xx = Math.floor(x / Z);
    let i = 0;
    if (yy < H) i = idx[yy * W + xx];
    else if (yy >= H + 2 && xx < PW) i = idxP[(yy - H - 2) * PW + xx];
    const c = i ? dePs1(paleta[i]) : (((x >> 3) + (y >> 3)) & 1 ? [200, 200, 200] : [255, 255, 255]);
    const o = (y * W * Z + x) * 4;
    prev.data[o] = c[0]; prev.data[o + 1] = c[1]; prev.data[o + 2] = c[2]; prev.data[o + 3] = 255;
  }
  fs.writeFileSync(`${base}_previa.png`, PNG.sync.write(prev));
  console.log(`${lado}: ${path.relative(ROOT, arquivo)} -> ${centros.length} cores (${ajuste}) em ${path.relative(ROOT, base)}.bin`);
}

const partida = carregarPartida(partidaPath, ROOT);
let n = 0;
for (const lado of ["casa", "visitante"]) {
  const t = partida[lado] || {};
  const base = path.join(SAIDA, `bandeira_${lado}`);
  if (!t.bandeira) {
    // sem bandeira configurada: remove a conversão antiga para a ponte não aplicar
    for (const s of [".bin", "_pequena.bin", "_paleta.bin", "_previa.png"]) fs.rmSync(base + s, { force: true });
    console.log(`${lado}: sem "bandeira" configurada (mantém a original)`);
    continue;
  }
  converter(lado, path.resolve(ROOT, t.bandeira), t.bandeira_ajuste || "esticar");
  n++;
}
if (!n) console.log("nenhuma bandeira configurada");
