# Gera pacotes/brasil-2026/times/<SIG>.json dos 20 times da Série B 2026.
#   python3 docs/we/elencos-serie-b-2026/montar.py <pasta do pacote> <pasta dos kits desenhados (opcional)>
# Elencos em elencos.py (titulares + reservas das rodadas 36/37 e EXTRAS das rodadas 34/35, ESPN).
# Notas: mesmo método de tools/serie-a-2026/gerar.py (nível WE 12-19 -> notas 3/7/9/.../19 do pacote).
# Não regrava um time que já exista no pacote (use --forcar).
import json, sys, os, re, hashlib, shutil, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from elencos import TIMES, EXTRAS

args = [a for a in sys.argv[1:] if not a.startswith("--")]
PAC = args[0]; KITS = args[1] if len(args) > 1 else None
FORCAR = "--forcar" in sys.argv

# slug: sigla, nome, nome_curto, estado, porte, cores, estádio (nome, capacidade)
CLUBES = {
 "novorizontino": ("NOV", "Novorizontino", "NOVORIZONT", "SP", "pequeno", ["#FFD200", "#151515"], ("Jorge Ismael de Biasi", 16000)),
 "juventude": ("JUV", "Juventude", "JUVENTUDE", "RS", "medio", ["#00843D", "#F2F2F2"], ("Alfredo Jaconi", 19924)),
 "vila-nova": ("VIL", "Vila Nova", "VILA NOVA", "GO", "medio", ["#C8102E", "#F2F2F2"], ("Onésio Brasileiro Alvarenga", 11788)),
 "fortaleza": ("FOR", "Fortaleza", "FORTALEZA", "CE", "medio", ["#0047AB", "#D2001C", "#F2F2F2"], ("Arena Castelão", 63903)),
 "criciuma": ("CRI", "Criciúma", "CRICIUMA", "SC", "medio", ["#FFD200", "#151515", "#F2F2F2"], ("Heriberto Hülse", 19225)),
 "goias": ("GOI", "Goiás", "GOIAS", "GO", "medio", ["#006437", "#F2F2F2"], ("Hailé Pinheiro (Serrinha)", 14450)),
 "sport": ("SPT", "Sport", "SPORT", "PE", "medio", ["#C8102E", "#151515"], ("Ilha do Retiro", 26418)),
 "atletico-go": ("ACG", "Atlético-GO", "ATLETICOGO", "GO", "medio", ["#C8102E", "#151515"], ("Antônio Accioly", 12500)),
 "crb": ("CRB", "CRB", "CRB", "AL", "pequeno", ["#C8102E", "#F2F2F2"], ("Rei Pelé", 17126)),
 "sao-bernardo": ("SBE", "São Bernardo", "S.BERNARDO", "SP", "pequeno", ["#FFD200", "#151515"], ("Primeiro de Maio", 15159)),
 "operario-pr": ("OPE", "Operário-PR", "OPERARIO", "PR", "pequeno", ["#151515", "#F2F2F2"], ("Germano Krüger", 10632)),
 "cuiaba": ("CUI", "Cuiabá", "CUIABA", "MT", "medio", ["#F2C500", "#007A33"], ("Arena Pantanal", 44000)),
 "ceara": ("CEA", "Ceará", "CEARA", "CE", "medio", ["#151515", "#F2F2F2"], ("Arena Castelão", 63903)),
 "america-mg": ("AME", "América-MG", "AMERICA-MG", "MG", "medio", ["#007A33", "#151515"], ("Independência", 23018)),
 "botafogo-sp": ("BFS", "Botafogo-SP", "BOTAFOGOSP", "SP", "pequeno", ["#C8102E", "#151515", "#F2F2F2"], ("Santa Cruz", 29292)),
 "athletic": ("ATH", "Athletic", "ATHLETIC", "MG", "pequeno", ["#151515", "#F2F2F2"], ("Joaquim Portugal", 5000)),
 "nautico": ("NAU", "Náutico", "NAUTICO", "PE", "medio", ["#C8102E", "#F2F2F2"], ("Aflitos", 19800)),
 "avai": ("AVA", "Avaí", "AVAI", "SC", "medio", ["#0057A8", "#F2F2F2"], ("Ressacada", 17800)),
 "ponte-preta": ("PON", "Ponte Preta", "PONTEPRETA", "SP", "medio", ["#151515", "#F2F2F2"], ("Moisés Lucarelli", 17728)),
 "londrina": ("LON", "Londrina", "LONDRINA", "PR", "pequeno", ["#6CACE4", "#F2F2F2"], ("Estádio do Café", 30000)),
}
# Valores em centavos. (saldo, patrocínio/temporada, folha mensal, ingresso, custo por jogo, salário titular, salário reserva)
FIN = {"medio": (1200000000, 2000000000, 350000000, 4000, 15000000, 15000000, 4000000),
       "pequeno": (300000000, 600000000, 110000000, 2500, 5000000, 5500000, 1800000)}
NAC = {("fortaleza", "Bastos"): "ANG", ("fortaleza", "Cardona"): "ARG", ("fortaleza", "Cantillo"): "COL",
       ("juventude", "Amarilla"): "PAR", ("sport", "D.Hernande"): "URU", ("sport", "De Pena"): "URU",
       ("sport", "P. Perotti"): "ARG", ("atletico-go", "Terans"): "URU", ("america-mg", "Ostchega"): "ARG",
       ("america-mg", "Segovia"): "PAR", ("ceara", "L. Mugni"): "ARG", ("ceara", "R. Lopez"): "URU",
       ("nautico", "Guruceaga"): "URU", ("nautico", "Borasi"): "ARG", ("novorizontino", "Alvarino"): "URU",
       ("operario-pr", "J. Cuenu"): "COL"}

POS = {"GK": "GK", "CB": "CB", "LB": "SB", "RB": "SB", "SB": "SB", "DH": "DH", "LH": "SH", "RH": "SH", "SH": "SH",
       "OH": "OH", "CF": "CF", "LW": "WG", "RW": "WG", "WG": "WG"}
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
AJUSTE = 0.3   # pacote: Série B entre 8 e 9 na média dos 11 melhores (guia, seção 5.2)
PARA = {"OFF": "OFF", "DEF": "DEF", "BAL": "BAL", "STA": "STA", "SPD": "SPD", "ACC": "ACC", "RES": "RES", "JMP": "JMP",
        "HEAD": "HEA", "TEC": "TEC", "PASS": "PAS", "SHPW": "SHP", "SHAC": "SHA", "DRI": "DRI", "CRV": "CUR", "AGR": "AGR"}
WE_PARA_NOTA = {12: 3, 13: 7, 14: 9, 15: 11, 16: 13, 17: 15, 18: 17, 19: 19}
PES = {"d": "destro", "c": "canhoto", "a": "ambidestro"}

def h(s): return hashlib.md5(s.encode()).digest()[0]
def ruido(nome, k): return (h(f"{nome}:{k}") / 255 - .5) * .8
def ascii_(s): return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
def slug(s): return re.sub(r"[^a-z0-9]+", "-", ascii_(s).lower()).strip("-")

def notas(nome, pos, nivel, tags):
    prof = [x * 1.6 for x in P[pos]]
    return {PARA[k]: WE_PARA_NOTA[max(12, min(19, round(nivel + prof[i] + sum(T[t].get(k, 0) for t in tags) + ruido(nome, k))))]
            for i, k in enumerate(A)}

def potencial(g, idade):
    return min(20, round(g) + (3 if idade <= 19 else 2 if idade <= 22 else 1 if idade <= 26 else 0))

ids = {}
for f in os.listdir(os.path.join(PAC, "times")):
    if f.endswith(".json"):
        for j in json.load(open(os.path.join(PAC, "times", f), encoding="utf-8"))["jogadores"]: ids[j["id"]] = f

legado = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kits-legado.json")
KITDATA = json.load(open(legado, encoding="utf-8"))
rel = []
for s, cfg in TIMES.items():
    sig, nome, curto, uf, porte, cores, (est, cap) = CLUBES[s]
    arq = os.path.join(PAC, "times", f"{sig}.json")
    if os.path.exists(arq) and not FORCAR:
        print(f"{sig}: já existe (use --forcar)"); continue
    for j in json.load(open(arq, encoding="utf-8"))["jogadores"] if os.path.exists(arq) else []:
        ids.pop(j["id"], None)
    saldo, patro, folha, ingr, custo, sal_t, sal_r = FIN[porte]
    linhas = [l for l in (cfg["elenco"] + EXTRAS.get(s, "")).strip().splitlines() if l.strip()]
    jogs, usadas, pend = [], set(), []
    for i, l in enumerate(linhas):
        nwe, pos, num, alt, idade, pe, delta, tags, _pele = [x.strip() for x in l.split("|")]
        pos = POS[pos]; idade = int(idade); tags = tags.split()
        nivel = (BASE_TIT if i < 11 else BASE_RES) + cfg["forca"] + AJUSTE + float(delta)
        at = notas(nwe, pos, nivel, tags)
        g = sum(at.values()) / 16
        jid = f"{sig.lower()}-{slug(nwe)}"; n = 2
        while jid in ids: jid = f"{sig.lower()}-{slug(nwe)}-{n}"; n += 1
        ids[jid] = sig
        fator = 1.0 + float(delta) if i < 11 else 1.0 + float(delta) / 2
        sal = int(round((sal_t if i < 11 else sal_r) * max(.5, fator) / 100000) * 100000)
        j = {"id": jid, "nome": nwe, "nome_we": nwe.upper()[:10], "posicao": pos, "posicao_secundaria": None,
             "camisa": None, "camisa_real": None, "idade": idade, "nacionalidade": NAC.get((s, nwe), "BRA"),
             "pe": PES[pe], "altura": int(alt), "atributos": at, "outside": True, "potencial": potencial(g, idade),
             "resistencia": 10,
             "contrato": {"salario_mensal": sal, "ate_temporada": 2026 + h(jid) % 5, "multa": 0}}
        num = int(num)
        if 1 <= num <= 32 and num not in usadas: j["camisa"] = num; usadas.add(num)
        else: j["camisa_real"] = num if 1 <= num <= 99 else None; pend.append(j)
        jogs.append(j)
    livres = [n for n in range(32, 0, -1) if n not in usadas]
    for j in pend: j["camisa"] = livres.pop(0)
    kd = KITDATA[s]
    time = {"sigla": sig, "nome": nome, "nome_curto": curto, "pais": "BRA", "estado": uf, "cores": cores,
            "porte": porte, "formacao": cfg["formacao"],
            "estadio": {"nome": est, "capacidade": cap, "ingresso_padrao": ingr, "custo_por_jogo": custo},
            "financas": {"saldo_inicial": saldo, "patrocinio_temporada": patro, "orcamento_folha_mensal": folha}}
    for campo, sufixo in (("kit", ""), ("kit_reserva", "_reserva")):
        k = {"cor_numero": kd[campo]["cor_numero"], "design": kd[campo]["design"]}
        png = f"{sig.lower()}{sufixo}_4x.png"
        if KITS and os.path.exists(os.path.join(KITS, f"{s}{sufixo}_4x.png")):
            os.makedirs(os.path.join(PAC, "kits", "desenhos"), exist_ok=True)
            shutil.copyfile(os.path.join(KITS, f"{s}{sufixo}_4x.png"), os.path.join(PAC, "kits", "desenhos", png))
        if os.path.exists(os.path.join(PAC, "kits", "desenhos", png)): k = {"arte": f"kits/desenhos/{png}", **k}
        time[campo] = k
    time["jogadores"] = jogs
    with open(arq, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(time, fh, ensure_ascii=False, indent=2); fh.write("\n")
    top = sorted((sum(j["atributos"].values()) / 16 for j in jogs), reverse=True)[:11]
    folha_real = sum(j["contrato"]["salario_mensal"] for j in jogs)
    rel.append((sig, len(jogs), sum(j["posicao"] == "GK" for j in jogs), round(sum(top) / 11, 2), folha_real / 100, folha / 100))
for r in sorted(rel, key=lambda x: -x[3]): print("%-4s %2d jog %d GK  media11 %.2f  folha R$ %s / orc R$ %s" % (r[0], r[1], r[2], r[3], f"{r[4]:,.0f}", f"{r[5]:,.0f}"))
