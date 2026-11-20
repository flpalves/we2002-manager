# Gera pacotes/brasil-2026/exterior.json: os "disponíveis do exterior" (jogadores sem clube no jogo,
# com taxa de transferência fixa). Spec: docs/spec/06-mercado-financas-diretoria.md, "Disponíveis do exterior".
#   python3 docs/we/mercado-exterior-2026/montar.py <pasta do pacote>
# Fonte: jogadores.txt (uma linha por jogador). Notas: mesmo método do montar.py da Série B/C
# (perfil por posição + tags, nível do WE 12-19 convertido para 3/7/9/.../19); aqui o nível é
# procurado até o geral (pesos por posição de padroes.ts) bater o "geral alvo" da linha.
# Taxa: mesma fórmula do valor de mercado (core/mercado/valor.ts, contrato longo, Série A)
# × fator da liga de origem (FATOR_ORIGEM), arredondada para R$ 50 mil.
import json, sys, os, re, hashlib, unicodedata

AQUI = os.path.dirname(os.path.abspath(__file__))
PAC = sys.argv[1]
TEMPORADA = 2026

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
PARA = {"OFF": "OFF", "DEF": "DEF", "BAL": "BAL", "STA": "STA", "SPD": "SPD", "ACC": "ACC", "RES": "RES", "JMP": "JMP",
        "HEAD": "HEA", "TEC": "TEC", "PASS": "PAS", "SHPW": "SHP", "SHAC": "SHA", "DRI": "DRI", "CRV": "CUR", "AGR": "AGR"}
WE_PARA_NOTA = {12: 3, 13: 7, 14: 9, 15: 11, 16: 13, 17: 15, 18: 17, 19: 19}
SECUNDARIA = {"GK": None, "CB": "DH", "SB": "SH", "DH": "OH", "OH": "SH", "SH": "SB", "WG": "SH", "CF": "WG"}
ALTURA_PADRAO = {"GK": 189, "CB": 186, "SB": 175, "DH": 179, "OH": 174, "SH": 175, "WG": 173, "CF": 182}
# Pesos do geral por posição (src/core/config/padroes.ts, jogadores.pesos_geral).
PESOS = {"GK": {"RES": 6, "DEF": 3, "JMP": 2, "BAL": 1}, "CB": {"DEF": 5, "HEA": 2, "JMP": 2, "BAL": 1.5, "SPD": 1, "PAS": .5},
         "SB": {"STA": 2.5, "SPD": 2.5, "ACC": 1.5, "DEF": 2, "CUR": 1.5, "PAS": 1, "OFF": 1, "DRI": 1, "TEC": .5},
         "DH": {"DEF": 3, "STA": 2, "PAS": 2.5, "RES": 1, "BAL": 1, "TEC": 1, "SHP": .5},
         "SH": {"PAS": 2.5, "TEC": 2, "DRI": 2, "STA": 1.5, "SPD": 1.5, "CUR": 1.5, "OFF": 1, "DEF": 1, "ACC": 1},
         "OH": {"PAS": 3, "TEC": 2.5, "DRI": 2, "OFF": 1.5, "SHA": 1, "CUR": 1, "STA": 1, "SPD": .5, "ACC": .5},
         "CF": {"OFF": 3, "SHA": 2.5, "DRI": 1.5, "SPD": 1.5, "TEC": 1, "SHP": 1, "HEA": 1, "ACC": 1, "BAL": .5},
         "WG": {"OFF": 2, "DRI": 2.5, "SPD": 2, "ACC": 1.5, "TEC": 1.5, "SHA": 1.5, "PAS": 1, "CUR": 1}}
# Valor de mercado (padroes.ts, mercado.*), contrato longo (f_contrato 1) e liga de Série A (f_serie 1).
VALOR_BASE, BASE_GERAL, GERAL_REF, ARREDONDAR = 180_000_000, 1.8, 12, 5_000_000
FATOR_IDADE = [(21, 1.2), (24, 1.1), (27, 1), (29, .85), (31, .65), (33, .45), (999, .3)]
REALIZACAO = [(19, .5), (21, .4), (23, .3), (25, .2), (27, .1), (999, 0)]
# Quanto um clube brasileiro paga a mais (ou a menos) pela liga de origem. CONMEBOL = fator_valor do paises.json.
EUROPA = {"ENG", "ESP", "ITA", "GER", "FRA", "POR", "NED", "BEL", "TUR", "RUS", "UKR", "GRE", "DEN"}
FATOR_ORIGEM = {**{p: 1.2 for p in EUROPA}, "MEX": 1.0, "USA": 0.9, "CAN": 0.9, "JPN": 0.85, "AUS": 0.8, "RSA": 0.8, "KSA": 1.0, "QAT": 0.9,
                "ARG": 0.8, "URU": 0.6, "COL": 0.6, "CHI": 0.5, "ECU": 0.5, "PAR": 0.45, "PER": 0.4}

def h(s): return hashlib.md5(s.encode()).digest()[0]
def ruido(nome, k): return (h(f"{nome}:{k}") / 255 - .5) * .8
def ascii_(s): return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
def slug(s): return re.sub(r"[^a-z0-9]+", "-", ascii_(s).lower()).strip("-")
def tabela(t, x): return next(f for ate, f in t if x <= ate)

def nome_we(nome):
    n = re.sub(r"[^A-Z0-9 .'-]", "", ascii_(nome).upper()).strip()
    if len(n) <= 10: return n
    partes = n.split()
    for cand in (f"{partes[0][0]}. {partes[-1]}", f"{partes[0][0]}.{partes[-1]}", partes[-1], partes[0]):
        if len(cand) <= 10: return cand
    return n[:10]

def notas(nome, pos, nivel, tags):
    prof = [x * 1.6 for x in P[pos]]
    return {PARA[k]: WE_PARA_NOTA[max(12, min(19, round(nivel + prof[i] + sum(T[t].get(k, 0) for t in tags) + ruido(nome, k))))]
            for i, k in enumerate(A)}

def geral(at, pos, arred=True):
    p = PESOS[pos]; g = sum(at[a] * w for a, w in p.items()) / sum(p.values())
    return round(g) if arred else g

def potencial(at, idade):
    g = sum(at.values()) / 16
    return min(20, round(g) + (3 if idade <= 19 else 2 if idade <= 22 else 1 if idade <= 26 else 0))

def taxa(g, pot, idade, pais_liga):
    proj = g + tabela(REALIZACAO, idade) * max(0, pot - g)
    v = VALOR_BASE * BASE_GERAL ** (proj - GERAL_REF) * tabela(FATOR_IDADE, idade) * FATOR_ORIGEM[pais_liga]
    return max(ARREDONDAR, round(v / ARREDONDAR) * ARREDONDAR)

jogs, vistos = [], set()
for linha in open(os.path.join(AQUI, "jogadores.txt"), encoding="utf-8"):
    if not linha.strip() or linha.startswith("#"): continue
    nome, nwe, pos, sec, ano, nac, pe, alt, clube, pais_liga, alvo, tags, _validar = [c.strip() for c in linha.split("|")]
    idade, alvo = TEMPORADA - int(ano), float(alvo)
    alt = int(alt) if alt else ALTURA_PADRAO[pos]
    tags = [t for t in tags.split(",") if t]
    if alt >= 189 and pos != "GK" and "cab" not in tags: tags.append("cab")
    if alt <= 169 and "baixo" not in tags: tags.append("baixo")
    if idade >= 33 and "vet" not in tags: tags.append("vet")
    if pos in ("WG", "SB") and idade <= 26 and "vel" not in tags: tags.append("vel")
    if pos == "OH" and "cri" not in tags: tags.append("cri")
    if pos == "DH" and "mar" not in tags: tags.append("mar")
    # nível do WE (12-19) que deixa o geral mais perto do alvo
    nivel = min((x / 20 for x in range(240, 391)), key=lambda n: abs(geral(notas(nome, pos, n, tags), pos, False) - alvo))
    at = notas(nome, pos, nivel, tags)
    g, pot = geral(at, pos), potencial(at, idade)
    jid = f"ext-{slug(nome)}"
    assert jid not in vistos, jid
    vistos.add(jid)
    jogs.append({"id": jid, "nome": nome, "nome_we": nwe or nome_we(nome), "posicao": pos,
                 "posicao_secundaria": sec or SECUNDARIA[pos], "idade": idade, "nacionalidade": nac,
                 "pe": "canhoto" if pe == "c" else "destro", "altura": alt, "atributos": at, "outside": True,
                 "potencial": max(pot, g), "resistencia": 10,
                 "origem": {"clube": clube, "pais": pais_liga}, "taxa": taxa(g, max(pot, g), idade, pais_liga)})

nomes_we = [j["nome_we"] for j in jogs]
repetidos = sorted({n for n in nomes_we if nomes_we.count(n) > 1})
longos = [n for n in nomes_we if len(n) > 10]
with open(os.path.join(PAC, "exterior.json"), "w", encoding="utf-8", newline="\n") as fh:
    json.dump({"temporada": TEMPORADA, "jogadores": jogs}, fh, ensure_ascii=False, indent=2); fh.write("\n")

por_pos = {}
for j in jogs: por_pos[j["posicao"]] = por_pos.get(j["posicao"], 0) + 1
gs = sorted(geral(j["atributos"], j["posicao"]) for j in jogs)
tx = sorted(j["taxa"] for j in jogs)
print(f"{len(jogs)} jogadores · {por_pos}")
print(f"geral: mín {gs[0]} · mediana {gs[len(gs)//2]} · máx {gs[-1]}")
print(f"taxa: mín R$ {tx[0]/1e8:.2f} mi · mediana R$ {tx[len(tx)//2]/1e8:.2f} mi · máx R$ {tx[-1]/1e8:.2f} mi")
if repetidos: print("nome_we repetido:", ", ".join(repetidos))
if longos: print("nome_we com mais de 10 caracteres:", ", ".join(longos))
