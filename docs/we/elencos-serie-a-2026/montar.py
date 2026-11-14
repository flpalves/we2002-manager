# Atualiza os elencos do pacote brasil-2026 a partir de /home/claude/final/<SIG>.txt
# Linha: nome|nome_we|pos|pos2|camisa|nasc|nac|pe|altura|pele|fis|cab|cor|barba|cbarba|old|delta|tags
#   nasc: AAAA-MM-DD ou idade (número); pe: d/c/a; old: nome atual no pacote (mantém notas/contrato) ou vazio
#   delta/tags: só para jogador novo (nível relativo e características, como em tools/serie-a-2026)
#   Ordem: 11 titulares na ordem da formação, depois o resto.
import json, sys, os, re, hashlib, unicodedata, datetime

PAC = sys.argv[1]           # pasta pacotes/brasil-2026 (cópia de trabalho)
FIN = sys.argv[2]           # pasta com os .txt finais
SIGLAS = sys.argv[3:]
ORIG = "/mnt/user-data/uploads/we2002-manager/pacotes/brasil-2026/times"
HOJE = datetime.date(2026, 11, 13)

FORCA = {"FLA": 1.0, "PAL": .9, "COR": .2, "SPFC": .2, "FLU": .4, "BOT": .3, "CAM": .3, "CRU": .5, "INT": .2,
         "GRE": .1, "BAH": .2, "VAS": 0, "SAN": .1, "RBB": 0, "CAP": -.1, "MIR": -.4, "VIT": -.4, "CFC": -.5,
         "REM": -.6, "CHA": -.7}
FORM = {"4-3-3B": "GK CB CB SB SB DH DH OH CF WG WG", "4-4-2A": "GK CB CB SB SB DH SH SH OH CF CF",
        "5-3-2": "GK CB CB CB DH DH SH SH OH CF CF", "4-4-2B": "GK CB CB SB SB DH DH OH OH CF CF",
        "4-5-1A": "GK CB CB SB SB DH DH SH SH OH CF", "4-5-1B": "GK CB CB SB SB DH SH SH OH OH CF",
        "4-3-3A": "GK CB CB SB SB DH OH OH CF WG WG"}

# --- notas de jogador novo: mesmo método de tools/serie-a-2026/gerar.py (escala WE 12-19) ---
A = ["OFF", "DEF", "BAL", "STA", "SPD", "ACC", "RES", "JMP", "HEAD", "TEC", "PASS", "SHPW", "SHAC", "DRI", "CRV", "AGR"]
P = {
 "GK": [-3, 1, 1.2, -2, -1, -1, 2.2, 1.2, -2, -2, -2, 0, -3, -2.5, -2.5, -3],
 "CB": [-2, 2, 1.5, .5, -.5, -.6, .5, 1, 1.5, -1, -1, 0, -2, -1.5, -2.5, -2],
 "SB": [0, .5, -.5, 2, 1.5, 1.2, 0, -.5, -1, 0, 0, -.5, -1.5, 0, .5, -1],
 "DH": [-1, 1.5, .5, 2, -.5, -.5, .5, 0, 0, 0, 1, .5, -1, -.5, -.5, -1],
 "SH": [1, -1, -.5, 1.5, 1.2, 1.2, .5, -1, -1, 1, 1, 0, 0, 1, 1, .5],
 "OH": [1, -1.5, -.5, .5, 0, .5, .5, -1.5, -1.5, 2, 2, .5, .5, 1.5, 1.5, .5],
 "WG": [1.5, -2, -1, .5, 2, 2, .5, -1.5, -2, 1, 0, 0, .5, 2, 1, 1.5],
 "CF": [2.5, -2.5, .5, -.5, .5, .5, 1, .5, 1, .5, -1, 1.5, 2, .5, -1, 2],
}
T = {"vel": {"SPD": 1.5, "ACC": 1.5}, "lento": {"SPD": -1.5, "ACC": -1.2}, "cab": {"HEAD": 1.5, "JMP": 1.2},
     "fin": {"SHAC": 1, "SHPW": .8, "OFF": .5}, "cri": {"PASS": 1, "TEC": .8, "CRV": .8},
     "dri": {"DRI": 1.2, "TEC": .7}, "bola": {"CRV": 1.5, "SHAC": .5}, "for": {"BAL": 1.2, "SHPW": 1},
     "mar": {"DEF": 1, "RES": .5}, "vet": {"STA": -1.5, "SPD": -1, "ACC": -1, "RES": .5},
     "baixo": {"BAL": -1, "JMP": -1, "HEAD": -1, "ACC": .5}}
BASE_TIT, BASE_RES = 14.1, 13.6
PARA_PACOTE = {"OFF": "OFF", "DEF": "DEF", "BAL": "BAL", "STA": "STA", "SPD": "SPD", "ACC": "ACC", "RES": "RES",
               "JMP": "JMP", "HEAD": "HEA", "TEC": "TEC", "PASS": "PAS", "SHPW": "SHP", "SHAC": "SHA", "DRI": "DRI",
               "CRV": "CUR", "AGR": "AGR"}
WE_PARA_NOTA = {12: 3, 13: 7, 14: 9, 15: 11, 16: 13, 17: 15, 18: 17, 19: 19}

def ruido(nome, k):
    h = hashlib.md5(f"{nome}:{k}".encode()).digest()[0]
    return (h / 255 - .5) * .8

def notas_novas(nome, pos, nivel, tags):
    prof = [x * 1.6 for x in P[pos]]
    out = {}
    for i, k in enumerate(A):
        v = nivel + prof[i] + sum(T[t].get(k, 0) for t in tags) + ruido(nome, k)
        out[PARA_PACOTE[k]] = WE_PARA_NOTA[max(12, min(19, round(v)))]
    return out

def potencial(geral, idade):
    folga = 3 if idade <= 19 else 2 if idade <= 22 else 1 if idade <= 26 else 0
    return min(20, round(geral) + folga)

def ascii_(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", ascii_(s).lower()).strip("-")

def idade_de(nasc):
    if re.fullmatch(r"\d+", nasc): return int(nasc)
    d = datetime.date.fromisoformat(nasc)
    return HOJE.year - d.year - ((HOJE.month, HOJE.day) < (d.month, d.day))

PES = {"d": "destro", "c": "canhoto", "a": "ambidestro"}

ids_pacote = {}
for f in os.listdir(os.path.join(PAC, "times")):
    t = json.load(open(os.path.join(PAC, "times", f), encoding="utf-8"))
    for j in t["jogadores"]: ids_pacote[j["id"]] = t["sigla"]

relatorio = []
for SIG in SIGLAS:
    arq = os.path.join(PAC, "times", f"{SIG}.json")
    time = json.load(open(arq, encoding="utf-8"))
    antigos = {j["nome"]: j for j in time["jogadores"]}
    usados_old = set()
    linhas = [l for l in open(os.path.join(FIN, f"{SIG}.txt"), encoding="utf-8").read().splitlines()
              if l.strip() and not l.startswith("#")]
    vagas = FORM[time["formacao"]].split()
    novos, camisas, pend = [], set(), []
    for i, l in enumerate(linhas):
        c = [x.strip() for x in l.split("|")]
        c += [""] * (18 - len(c))
        nome, nwe, pos, pos2, cam, nasc, nac, pe, alt, pele, fis, cab, cor, bar, cbar, old, delta, tags = c[:18]
        assert pos in P, (SIG, nome, pos)
        assert not pos2 or pos2 in P, (SIG, nome, pos2)
        if i < 11: assert pos == vagas[i], (SIG, i, nome, pos, vagas[i])
        nwe = ascii_(nwe or nome)
        if len(nwe) > 10: nwe = nwe.replace(". ", ".")
        if len(nwe) > 10: print("AVISO nome_we cortado:", SIG, nwe, file=sys.stderr); nwe = nwe[:10]
        idade = idade_de(nasc)
        if old and ":" in old:   # transferência entre times do pacote: SIG:nome
            o_sig, o_nome = old.split(":", 1)
            o_t = json.load(open(os.path.join(ORIG, f"{o_sig}.json"), encoding="utf-8"))
            j = dict(next(x for x in o_t["jogadores"] if x["nome"] == o_nome))
            j["_novo"] = True; j["_veio_de"] = o_sig
        elif old:
            assert old in antigos, (SIG, "old inexistente", old)
            assert old not in usados_old, (SIG, "old repetido", old)
            usados_old.add(old)
            j = dict(antigos[old])
            if j["posicao"] != pos: j["_mudou_pos"] = j["posicao"]
        else:
            nivel = (BASE_TIT if i < 11 else BASE_RES) + FORCA[SIG] + float(delta or 0)
            at = notas_novas(nome, pos, nivel, tags.split())
            g = sum(at.values()) / 16
            jid = f"{SIG.lower()}-{slug(nome)}"
            n = 2
            while jid in ids_pacote: jid = f"{SIG.lower()}-{slug(nome)}-{n}"; n += 1
            ids_pacote[jid] = SIG
            j = {"id": jid, "atributos": at, "outside": True, "potencial": potencial(g, idade), "resistencia": 10,
                 "contrato": {"salario_mensal": 0, "ate_temporada": 2027, "multa": 0}, "_novo": True}
        ap_ant = j.get("aparencia") or {}
        j.update({"nome": nome, "nome_we": nwe, "posicao": pos, "posicao_secundaria": pos2 or None,
                  "idade": idade, "nacionalidade": nac, "pe": PES[pe], "altura": int(alt)})
        j["aparencia"] = {"pele": int(pele), "fisico": fis, "cabelo": cab, "cor_cabelo": cor, "barba": bar,
                          "cor_barba": cbar, "chuteira": ap_ant.get("chuteira", "A")}
        num = int(cam)
        if 1 <= num <= 32 and num not in camisas:
            j["camisa"], j["camisa_real"] = num, None
            camisas.add(num)
        else:
            j["camisa_real"] = num; pend.append(j)
        novos.append(j)
    livres = [n for n in range(32, 0, -1) if n not in camisas]
    for j in pend: j["camisa"] = livres.pop(0)
    saidas = [n for n in antigos if n not in usados_old]
    ordem = ["id", "nome", "nome_we", "posicao", "posicao_secundaria", "camisa", "camisa_real", "idade",
             "nacionalidade", "pe", "altura", "atributos", "outside", "potencial", "resistencia", "moral_inicial",
             "contrato", "aparencia"]
    final = []
    for j in novos:
        extra = {k: j[k] for k in ("_novo", "_mudou_pos") if k in j}
        final.append({k: j[k] for k in ordem if k in j})
        final[-1]["_x"] = extra
    tit = sorted((sum(j["atributos"].values()) / 16 for j in final), reverse=True)[:11]
    relatorio.append({"sigla": SIG, "n": len(final), "gk": sum(j["posicao"] == "GK" for j in final),
                      "media11": round(sum(tit) / 11, 2), "saidas": saidas,
                      "novos": [j["nome"] for j in final if j["_x"].get("_novo")],
                      "mudou_pos": [(j["nome"], j["_x"]["_mudou_pos"], j["posicao"]) for j in final if "_mudou_pos" in j["_x"]],
                      "camisa_real": [(j["nome"], j["camisa_real"], j["camisa"]) for j in final if j["camisa_real"]]})
    for j in final: del j["_x"]
    time["jogadores"] = final
    with open(arq, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(time, fh, ensure_ascii=False, indent=2); fh.write("\n")
print(json.dumps(relatorio, ensure_ascii=False, indent=1))
