import json, sys, os, hashlib, copy
sys.path.insert(0, os.path.dirname(__file__))
from elencos import TIMES

ORIG = sys.argv[1]   # pasta com os times atuais (corinthians/flamengo/fluminense/spfc)
OUT = sys.argv[2]

META = {
 "flamengo": ("Flamengo", "FLAMENGO", "FLA", "#C8102E", "#151515", "#FFFFFF", "#151515", "#FFFFFF"),
 "palmeiras": ("Palmeiras", "PALMEIRAS", "PAL", "#006437", "#FFFFFF", "#FFFFFF", "#006437", "#FFFFFF"),
 "corinthians": ("Corinthians", "CORINTHIANS", "COR", "#F2F2F2", "#151515", "#151515", "#151515", "#151515"),
 "spfc": ("SPFC", "SAO PAULO", "SPFC", "#F2F2F2", "#C8102E", "#F2F2F2", "#F2F2F2", "#151515"),
 "fluminense": ("Fluminense", "FLUMINENSE", "FLU", "#7A1E3A", "#00613C", "#F2F2F2", "#F2F2F2", "#F2F2F2"),
 "botafogo": ("Botafogo", "BOTAFOGO", "BOT", "#151515", "#F2F2F2", "#151515", "#151515", "#F2F2F2"),
 "atletico-mg": ("Atletico-MG", "ATLETICO-MG", "CAM", "#151515", "#F2F2F2", "#151515", "#F2F2F2", "#F2F2F2"),
 "cruzeiro": ("Cruzeiro", "CRUZEIRO", "CRU", "#1B3F94", "#F2F2F2", "#F2F2F2", "#1B3F94", "#F2F2F2"),
 "internacional": ("Internacional", "INTERNACIONAL", "INT", "#D2001C", "#F2F2F2", "#F2F2F2", "#D2001C", "#F2F2F2"),
 "gremio": ("Gremio", "GREMIO", "GRE", "#0D80BF", "#151515", "#151515", "#F2F2F2", "#F2F2F2"),
 "bahia": ("Bahia", "BAHIA", "BAH", "#F2F2F2", "#0057A8", "#0057A8", "#F2F2F2", "#0057A8"),
 "vasco": ("Vasco", "VASCO", "VAS", "#F2F2F2", "#151515", "#151515", "#F2F2F2", "#151515"),
 "santos": ("Santos", "SANTOS", "SAN", "#F2F2F2", "#151515", "#F2F2F2", "#F2F2F2", "#151515"),
 "bragantino": ("RB Bragantino", "RB BRAGANTINO", "RBB", "#F2F2F2", "#C8102E", "#F2F2F2", "#F2F2F2", "#C8102E"),
 "athletico-pr": ("Athletico-PR", "ATHLETICO-PR", "CAP", "#C8102E", "#151515", "#151515", "#151515", "#F2F2F2"),
 "mirassol": ("Mirassol", "MIRASSOL", "MIR", "#FFD200", "#007A33", "#007A33", "#FFD200", "#007A33"),
 "vitoria": ("Vitoria", "VITORIA", "VIT", "#C8102E", "#151515", "#151515", "#C8102E", "#F2F2F2"),
 "coritiba": ("Coritiba", "CORITIBA", "CFC", "#F2F2F2", "#00553A", "#151515", "#F2F2F2", "#00553A"),
 "remo": ("Remo", "REMO", "REM", "#0B1F4B", "#F2F2F2", "#0B1F4B", "#0B1F4B", "#F2F2F2"),
 "chapecoense": ("Chapecoense", "CHAPECOENSE", "CHA", "#00843D", "#F2F2F2", "#F2F2F2", "#00843D", "#F2F2F2"),
}

LISTRAS = {"botafogo": ["#151515", "#F2F2F2"], "atletico-mg": ["#151515", "#F2F2F2"],
 "gremio": ["#0D80BF", "#151515", "#0D80BF", "#F2F2F2"], "vitoria": ["#C8102E", "#151515"],
 "athletico-pr": ["#C8102E", "#151515"]}

FORMACOES = {
 "4-3-3B": ["GK", "CB", "CB", "LB", "RB", "DH", "DH", "OH", "CF", "LW", "RW"],
 "4-4-2A": ["GK", "CB", "CB", "LB", "RB", "DH", "LH", "RH", "OH", "CF", "CF"],
 "5-3-2":  ["GK", "CB", "CB", "CB", "DH", "DH", "LH", "RH", "OH", "CF", "CF"],
}

A = ["OFF", "DEF", "BAL", "STA", "SPD", "ACC", "RES", "JMP", "HEAD", "TEC", "PASS", "SHPW", "SHAC", "DRI", "CRV", "AGR"]
# perfil por posição: deslocamento sobre o nível do jogador (mesma ordem de A)
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
T = {  # ajustes por característica
 "vel": {"SPD": 1.5, "ACC": 1.5},
 "lento": {"SPD": -1.5, "ACC": -1.2},
 "cab": {"HEAD": 1.5, "JMP": 1.2},
 "fin": {"SHAC": 1, "SHPW": .8, "OFF": .5},
 "cri": {"PASS": 1, "TEC": .8, "CRV": .8},
 "dri": {"DRI": 1.2, "TEC": .7},
 "bola": {"CRV": 1.5, "SHAC": .5},
 "for": {"BAL": 1.2, "SHPW": 1},
 "mar": {"DEF": 1, "RES": .5},
 "vet": {"STA": -1.5, "SPD": -1, "ACC": -1, "RES": .5},
 "baixo": {"BAL": -1, "JMP": -1, "HEAD": -1, "ACC": .5},
}
GRUPO = {"GK": "GK", "CB": "CB", "LB": "SB", "RB": "SB", "DH": "DH", "LH": "SH", "RH": "SH", "OH": "OH",
         "CF": "CF", "LW": "WG", "RW": "WG"}
BASE_TIT, BASE_RES = 14.1, 13.6
PES = {"d": "destro", "c": "canhoto", "a": "ambidestro"}

def ruido(nome, k):
    h = hashlib.md5(f"{nome}:{k}".encode()).digest()[0]
    return (h / 255 - .5) * .8   # ±0.4

def atributos(nome, pos, nivel, tags):
    prof = [x * 1.6 for x in P[GRUPO[pos]]]
    out = {}
    for i, k in enumerate(A):
        v = nivel + prof[i] + sum(T[t].get(k, 0) for t in tags) + ruido(nome, k)
        out[k] = max(12, min(19, round(v)))
    return out

def aparencia(pele, tags, altura):
    fis = "F"
    if "for" in tags or altura >= 190: fis = "G"
    if "baixo" in tags or altura <= 168: fis = "E"
    return {"pele": pele, "fisico": fis, "cabelo": "i1", "cor_cabelo": "B" if pele == 1 else "A",
            "barba": "A", "cor_barba": "A", "chuteira": "A"}

def montar(slug, cfg):
    linhas = [l for l in cfg["elenco"].strip().splitlines() if l.strip()]
    assert len(linhas) == 22, (slug, len(linhas))
    form = FORMACOES[cfg["formacao"]]
    jogs, usados = [], set()
    pend = []
    for i, l in enumerate(linhas):
        nome, pos, num, alt, idade, pe, delta, tags, pele = [x.strip() for x in l.split("|")]
        assert len(nome) <= 10 and nome.isascii(), nome
        if i < 11:
            assert pos == form[i], (slug, i, nome, pos, form[i])
        if i == 11: assert pos == "GK", (slug, nome)
        tags = tags.split()
        nivel = (BASE_TIT if i < 11 else BASE_RES) + cfg["forca"] + float(delta)
        j = {"vaga": i, "nome": nome, "posicao": pos, "camisa": int(num), "altura": int(alt), "idade": int(idade),
             "pe": PES[pe], "outside": True, "aparencia": aparencia(int(pele), tags, int(alt)),
             "atributos": atributos(nome, pos, nivel, tags)}
        if not (1 <= j["camisa"] <= 32) or j["camisa"] in usados:
            j["camisa_real"] = j["camisa"]; pend.append(j)
        else:
            usados.add(j["camisa"])
        jogs.append(j)
    livres = [n for n in range(32, 0, -1) if n not in usados]
    for j in pend:   # camisa > 32 (limite do jogo): usa a maior livre
        j["camisa"] = livres.pop(0)
    return jogs

def main():
    os.makedirs(OUT, exist_ok=True)
    resumo = []
    for slug, cfg in TIMES.items():
        nome, tela, sigla, cam, det, calc, meiao, num = META[slug]
        caminho = os.path.join(ORIG, slug + ".json")
        if os.path.exists(caminho):
            base = json.load(open(caminho, encoding="utf-8"))
        else:
            base = {"nome": nome, "nome_tela": tela, "sigla": sigla, "bandeira": None, "bandeira_ajuste": "ajustar",
                    "kit": {"arte": f"kits/desenhos/{slug}_4x.png", "cor_numero": num,
                            "design": {"camisa": cam, "detalhe": det, "calcao": calc, "meiao": meiao}}}
            if slug in LISTRAS: base["kit"]["design"]["listras_verticais"] = {"cores": LISTRAS[slug], "largura": 4}
        base["formacao"] = cfg["formacao"]
        base["observacao"] = ("Elenco real da Série A 2026 (titulares = escalação da 34ª rodada, nov/2026). "
                              "Vaga 0 = goleiro; 1-10 = titulares na ordem da formação; 11-21 = reservas; "
                              "a vaga 22 fica com o jogador original. Atributos estimados (12-19). "
                              "'camisa_real' guarda o número verdadeiro quando passa de 32.")
        base["jogadores"] = montar(slug, cfg)
        json.dump(base, open(os.path.join(OUT, slug + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        tit = base["jogadores"][:11]
        media = sum(sum(j["atributos"].values()) / 16 for j in tit) / 11
        resumo.append((slug, round(media, 2)))
    for s, m in sorted(resumo, key=lambda x: -x[1]): print(f"{s:15s} {m}")

main()
