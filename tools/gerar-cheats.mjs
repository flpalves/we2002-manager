// Gera os cheats do DuckStation (GameShark, aplicados a cada frame) a partir
// das "edicoes" do data/partida.json. É o equivalente aos patches contínuos da
// ponte Lua do PCSX-Redux.
//
// Uso:
//   node tools/gerar-cheats.mjs [partida.json] [referencia] [saida.cht] [saida.ini]
// Padrões:
//   partida.json  = data/partida.json
//   referencia    = states/amistoso.sstate (save state do PCSX-Redux) ou um dump .bin de 2 MB
//   saida.cht     = %LOCALAPPDATA%/DuckStation/cheats/SLPM-87056.cht
//   saida.ini     = %LOCALAPPDATA%/DuckStation/gamesettings/SLPM-87056.ini
//
// A referência é usada só para ler os registros originais de atributos
// (campos ausentes no time/partida.json são preservados).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { carregarPartida } from "./lib/times.mjs";
import { camposRegistro, aplicarCampos } from "./lib/registro.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERIAL = "SLPM-87056";
const NOME_CHEAT = "WE2002 Manager";
const DUCK = path.join(process.env.LOCALAPPDATA || path.join(ROOT, "duckstation"), "DuckStation");

const [argPartida, argRef, argCht, argIni] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const partidaPath = argPartida || path.join(ROOT, "data", "partida.json");
const refPath = argRef || path.join(ROOT, "states", "amistoso.sstate");
const chtPath = argCht || path.join(DUCK, "cheats", `${SERIAL}.cht`);
const iniPath = argIni || path.join(DUCK, "gamesettings", `${SERIAL}.ini`);

// Endereços (ver docs/offsets.md) ---------------------------------------------
const POR_TIME = 23;
const NOMES = { mestre: 0x80055ff8, mestreTime: 0xe6, mestreReg: 10, buffer: 0x80064570, bufferReg: 16 };
const ATR = { mestre: 0x800a5124, buffer: 0x80065a58, reg: 12 };
const CAMISA = 0x80064970;
const CAMPOS = {
  OFF: [1, 29], DEF: [2, 0], BAL: [1, 14], STA: [1, 17], SPD: [1, 23],
  ACC: [1, 26], RES: [1, 10], JMP: [2, 18], HEAD: [2, 15], TEC: [2, 12],
  PASS: [2, 9], SHPW: [2, 3], SHAC: [2, 6], DRI: [1, 20], CRV: [2, 21],
};

// RAM de referência -------------------------------------------------------------
function carregarRam(p) {
  const buf = fs.readFileSync(p);
  if (buf.length === 0x200000) return buf;
  const ram = buf.subarray(0x27, 0x27 + 0x200000); // save state do PCSX-Redux v5
  if (ram.subarray(0x55ff8, 0x55ffd).toString("latin1") !== "Given") {
    throw new Error(`Não reconheci a RAM em ${p}. Use um dump .bin de 2 MB.`);
  }
  return ram;
}
const phys = (a) => a & 0x1fffff;

// Saída GameShark --------------------------------------------------------------
const linhas = [];
const hex = (n, d) => n.toString(16).toUpperCase().padStart(d, "0");

// Escreve bytes como códigos 80 (16 bits) e, se sobrar, 30 (8 bits).
// Escreve um bloco como códigos condicionais. Todas as linhas dependem de uma
// meia-palavra "sentinela" do bloco ainda ter o valor ORIGINAL (D0 = se 16 bits
// forem iguais); a sentinela é gravada por último. Assim:
//  - antes da confirmação (dados originais) o bloco inteiro é gravado;
//  - depois disso a sentinela já tem o nosso valor e nada mais é escrito;
//  - se o jogo recarregar os dados originais, o bloco é regravado;
//  - se o jogo usar a área para outra coisa (na partida ele carrega código ali,
//    ex.: tela de substituição), a sentinela não bate e nada é escrito.
function escrever(addr, bytes, comentario) {
  linhas.push(`; ${comentario}`);
  const o = phys(addr);
  if (o & 1) throw new Error(`endereço ímpar não suportado: ${hex(o, 6)}`);
  const mudancas = [];
  for (let i = 0; i < bytes.length; i += 2) {
    const v = bytes[i] | ((bytes[i + 1] ?? ram[o + i + 1]) << 8);
    const v0 = ram[o + i] | (ram[o + i + 1] << 8);
    if (v !== v0) mudancas.push({ a: o + i, v, v0 });
  }
  if (!mudancas.length) return;
  const sent = mudancas.find((m) => m.v0 !== 0 && m.v0 !== 0xffff) || mudancas[0];
  for (const m of [...mudancas.filter((x) => x !== sent), sent]) {
    linhas.push(`D0${hex(sent.a, 6)} ${hex(sent.v0, 4)}`, `80${hex(m.a, 6)} ${hex(m.v, 4)}`);
  }
}

function texto(nome, len) {
  const b = new Array(len).fill(0);
  const s = String(nome).normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 10);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0x7f;
  return b;
}

// Camisa na base mestre: w0, bits 26-30 (5 bits), valor = número - 1 (1 a 32).
function registroAtributos(ram, addrMestre, valores, camisa = null, altura = null, extras = []) {
  const o = phys(addrMestre);
  const w = [ram.readUInt32LE(o), ram.readUInt32LE(o + 4), ram.readUInt32LE(o + 8)];
  for (const [nome, v] of Object.entries(valores)) {
    if (nome === "AGR") continue; // agressividade vai nos extras (w2 bits 24-26)
    const c = CAMPOS[nome];
    if (!c) { console.warn(`atributo desconhecido: ${nome}`); continue; }
    const bruto = Math.max(0, Math.min(7, Number(v) - 12));
    const mask = (7 << c[1]) >>> 0;
    w[c[0]] = ((w[c[0]] & ~mask) | (bruto << c[1])) >>> 0;
  }
  if (camisa !== null) w[0] = ((w[0] & ~(0x1f << 26)) | (((camisa - 1) & 0x1f) << 26)) >>> 0;
  // Altura: w0 bits 20-25, cm = valor + 148 (148 a 211)
  if (altura !== null) w[0] = ((w[0] & ~(0x3f << 20)) | ((Math.max(0, Math.min(63, altura - 148)) & 0x3f) << 20)) >>> 0;
  aplicarCampos(w, extras);
  const out = [];
  for (const x of w) for (let k = 0; k < 4; k++) out.push((x >>> (8 * k)) & 0xff);
  return out;
}

// Principal --------------------------------------------------------------------
const partida = carregarPartida(partidaPath, ROOT);
const ram = carregarRam(refPath);
const ids = { casa: partida.casa.id_we, visitante: partida.visitante.id_we };

for (const e of partida.edicoes || []) {
  const lado = e.lado === "visitante" ? "visitante" : "casa";
  const lado2 = lado === "visitante" ? 1 : 0;
  const n = e.jogador;
  const id = ids[lado];
  const rotulo = `${lado} #${n} (time ${id})`;

  // Só a BASE MESTRE é escrita. O jogo copia a base mestre para o buffer da
  // partida ao confirmar a seleção e de novo nas substituições; forçar o buffer
  // a cada frame trava o jogo quando ele reorganiza o elenco numa substituição.
  if (typeof e.nome === "string") {
    escrever(NOMES.mestre + id * NOMES.mestreTime + n * NOMES.mestreReg, texto(e.nome, NOMES.mestreReg), `nome ${rotulo}: ${e.nome}`);
  }
  const temCamisa = typeof e.camisa === "number" && !process.argv.includes("--sem-camisa-ram");
  const temAltura = typeof e.altura === "number";
  const extras = camposRegistro(e);
  if (e.atributos || temCamisa || temAltura || extras.length) {
    const valores = !e.atributos ? {} : e.atributos === "max" ? Object.fromEntries(Object.keys(CAMPOS).map((k) => [k, 19])) : e.atributos;
    if (temCamisa && !(e.camisa >= 1 && e.camisa <= 32)) throw new Error(`${rotulo}: a base do jogo só aceita camisas de 1 a 32 (veio ${e.camisa})`);
    const reg = registroAtributos(ram, ATR.mestre + (id * POR_TIME + n) * ATR.reg, valores, temCamisa ? e.camisa : null, temAltura ? e.altura : null, extras);
    escrever(ATR.mestre + (id * POR_TIME + n) * ATR.reg, reg, `registro ${rotulo}${e.atributos ? " atributos" : ""}${temCamisa ? ` camisa ${e.camisa}` : ""}${extras.length ? ` +${extras.length} campos` : ""}`);
  }
}

const cht = [
  `; Gerado por tools/gerar-cheats.mjs a partir de ${path.basename(partidaPath)} em ${new Date().toISOString()}`,
  `[${NOME_CHEAT}]`,
  "Type = Gameshark",
  "Activation = EndFrame",
  "Author = we2002-manager",
  "Description = Edições do partida.json (nomes, atributos, camisas)",
  ...linhas,
  "",
].join("\r\n");

fs.mkdirSync(path.dirname(chtPath), { recursive: true });
fs.writeFileSync(chtPath, cht);

// Habilita o cheat nas configurações do jogo, preservando o resto do arquivo.
let ini = fs.existsSync(iniPath) ? fs.readFileSync(iniPath, "utf8") : "";
const secao = `[Cheats]\r\nEnableCheats = true\r\nEnable = ${NOME_CHEAT}\r\n`;
if (/^\[Cheats\][^\[]*/m.test(ini)) ini = ini.replace(/^\[Cheats\][^\[]*/m, secao);
else ini = (ini && !ini.endsWith("\n") ? ini + "\r\n" : ini) + secao;
fs.mkdirSync(path.dirname(iniPath), { recursive: true });
fs.writeFileSync(iniPath, ini);

console.log(`${linhas.filter((l) => !l.startsWith(";")).length} códigos gravados em ${chtPath}`);
console.log(`cheat habilitado em ${iniPath}`);
