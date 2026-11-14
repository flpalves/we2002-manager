import fs from "node:fs";
import { carregarPartida, conflitoKits } from "../lib/times.mjs";
const ROOT = new URL("../..", import.meta.url).pathname; process.chdir(ROOT);
const ts = fs.readdirSync("data/times").filter(f => f.endsWith(".json")).map(f => f.slice(0, -5));
const base = JSON.parse(fs.readFileSync("data/partida.json"));
let res = 0, conf = 0; const ex = [];
for (const c of ts) for (const v of ts) if (c !== v) {
  const p = structuredClone(base); p.casa.time = `data/times/${c}.json`; p.visitante.time = `data/times/${v}.json`;
  fs.writeFileSync("/tmp/pt.json", JSON.stringify(p));
  const r = carregarPartida("/tmp/pt.json", ROOT);
  if (r.visitante.uniforme_usado === "reserva") { res++; if (ex.length < 12) ex.push(`${c} x ${v}`); }
  const tc = JSON.parse(fs.readFileSync(`data/times/${c}.json`)), kv = { design: r.kits.visitante.design };
  if (conflitoKits(tc.kit, kv)) { conf++; console.log("ainda parecido:", c, "x", v); }
}
console.log("visitante de reserva:", res, "de", ts.length * (ts.length - 1), "| conflitos restantes:", conf);
console.log(ex.join("\n"));
const r = carregarPartida("data/partida.json", ROOT);
console.log("partida.json atual:", r.casa.nome, r.casa.uniforme_usado, "x", r.visitante.nome, r.visitante.uniforme_usado, r.kits.visitante.arte);
