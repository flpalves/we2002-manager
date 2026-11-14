# Guia para agentes: como criar um time novo no pacote

Instruções para um agente (Claude Cowork ou outro) que recebe o pedido "crie o time X" no WE2002 Manager. O resultado é um time **válido no pacote de dados**, pronto para entrar numa competição e numa carreira nova.

> Escopo: este guia cria o time no **pacote** (`pacotes/<id>/`). Carreiras já existentes não mudam: cada carreira é uma cópia do pacote feita na criação (`docs/spec/02-dados.md`).

---

## 1. O que entregar

Para um time de sigla `SIG` no pacote `brasil-2026`:

| Arquivo | Obrigatório | Conteúdo |
|---|---|---|
| `pacotes/brasil-2026/times/SIG.json` | **sim** | o time e o elenco (formato na seção 4) |
| `pacotes/brasil-2026/escudos/SIG.png` | **sim** (sem ele a carreira não é criada) | escudo em PNG, fundo transparente, de preferência quadrado (≥ 128 px) |
| `pacotes/brasil-2026/bandeiras/SIG.png` | não | arte da bandeira que a ponte põe no WE (seção 6) |
| `pacotes/brasil-2026/kits/desenhos/sig_4x.png` etc. | não | arte do uniforme (seção 6); sem ela vale o `kit.design` |
| `pacotes/brasil-2026/competicoes/<id>.json` | só se o time for disputar algo | sigla na lista de participantes (seção 7) |
| `pacotes/brasil-2026/paises.json` | só se o país ainda não existir | o país do clube (seção 4.1) |

No fim, devolva ao usuário o **relatório da seção 9**.

## 2. Antes de começar

1. Leia este guia inteiro, depois `docs/spec/02-dados.md` (formato do pacote) e um time existente parecido como modelo, por exemplo `pacotes/brasil-2026/times/BAH.json` para um clube médio.
2. Rode a validação para ver o estado atual do pacote (seção 8). **O pacote já tem erros que não são seus**: na data deste guia, nenhum time tem escudo e todos têm 22 jogadores. Não tente consertar os outros times, a menos que o usuário peça. O seu time precisa sair **sem nenhum erro**.
3. Confirme com o usuário (ou deduza do pedido):
   - se o time é **real** (pesquisar o elenco atual) ou **fictício** (inventar com nomes plausíveis);
   - em que **competição** ele entra, se em alguma;
   - quem fornece o **escudo**: o usuário manda o PNG ou você procura. Para clube real, use só imagem que o usuário aprovar.

### Não fazer

- **Não** rode `npm run pacote:gerar -- --forcar`: ele regrava todos os times a partir de `data/times` e apaga edições.
- **Não** edite `data/times/`, `bridge/`, `tools/`, `states/` nem nada dentro de `src/`. O time vive só no pacote.
- **Não** mude `regras.json` nem `temporada.json` para "fazer caber" o time.
- **Não** use acentos nem caracteres fora do ASCII em `nome_we` e `nome_curto`: o WE só aceita ASCII.
- **Não** reaproveite sigla nem `id` de jogador que já exista no pacote.

## 3. Sigla e nomes

- `sigla`: 2 a 5 caracteres, **letras maiúsculas ou números** (`^[A-Z0-9]{2,5}$`), única no pacote. Prefira a sigla usada pela imprensa (SAN, GOI, CEA). Confira se já existe com `ls pacotes/brasil-2026/times`.
- O arquivo se chama exatamente `SIG.json`, e o escudo `SIG.png`.
- `nome`: nome completo, com acento ("Ceará Sporting Club" ou "Ceará").
- `nome_curto`: o que aparece no WE, **até 10 caracteres ASCII**, normalmente em maiúsculas ("CEARA"). Passar de 10 gera aviso e o nome é cortado.

## 4. O arquivo `times/SIG.json`

Dinheiro **sempre em centavos e inteiro** (R$ 1,5 mi = `150000000`). Todas as cores no formato `#RRGGBB`.

### 4.1 Dados do clube

| Campo | Regra | Como preencher |
|---|---|---|
| `pais` | 3 letras maiúsculas e precisa existir em `paises.json` | `BRA` para brasileiros. País novo: acrescente `{ "codigo", "nome", "fator_valor" }` em `paises.json` (BRA = 1; ARG 0,8; URU/COL 0,6, como referência) |
| `estado` | 2 letras maiúsculas, opcional | UF do clube ("CE") |
| `cores` | 1 a 3 cores | a 1ª vira a cor do clube na interface; use as cores oficiais |
| `porte` | `grande` \| `medio` \| `pequeno` | grande = os 12 tradicionais; médio = Série A/B estável ou com torcida grande; pequeno = o resto. Mexe na IA de mercado, na diretoria e no público |
| `formacao` | uma das 7 formações do WE (abaixo) | a formação habitual do time |
| `estadio` | opcional, mas recomendado | `{ nome, capacidade, ingresso_padrao, custo_por_jogo }` |
| `financas` | opcional, mas recomendado | `{ saldo_inicial, patrocinio_temporada, orcamento_folha_mensal }` |

Sem `estadio` ou `financas`, o jogo usa o padrão do porte e a validação dá aviso. Valores padrão (`src/core/config/padroes.ts`), que servem de referência de escala:

| Porte | saldo inicial | patrocínio/temporada | folha mensal | capacidade | ingresso | custo por jogo |
|---|---|---|---|---|---|---|
| grande | R$ 50 mi | R$ 80 mi | R$ 12 mi | 45.000 | R$ 60 | R$ 400 mil |
| médio | R$ 15 mi | R$ 25 mi | R$ 4 mi | 25.000 | R$ 40 | R$ 150 mil |
| pequeno | R$ 3 mi | R$ 6 mi | R$ 1 mi | 12.000 | R$ 25 | R$ 50 mil |

Para clube real, use a capacidade real do estádio e valores coerentes com o porte. A soma dos salários do elenco (seção 4.4) deve ficar **perto ou abaixo** de `orcamento_folha_mensal`, senão a diretoria cobra desde a 1ª avaliação.

**Formações** (vagas na ordem do WE; 0 = goleiro):

| Formação | Vagas |
|---|---|
| `4-3-3B` | GK CB CB SB SB DH DH OH CF WG WG |
| `4-4-2A` | GK CB CB SB SB DH SH SH OH CF CF |
| `5-3-2` | GK CB CB CB DH DH SH SH OH CF CF |
| `4-4-2B` | GK CB CB SB SB DH DH OH OH CF CF |
| `4-5-1A` | GK CB CB SB SB DH DH SH SH OH CF |
| `4-5-1B` | GK CB CB SB SB DH SH SH OH OH CF |
| `4-3-3A` | GK CB CB SB SB DH OH OH CF WG WG |

### 4.2 Elenco

- **Mínimo de 23 jogadores e pelo menos 2 goleiros.** Abaixo disso é erro e a carreira não cria. **Recomendado: 25 a 28, com 3 goleiros.** Com exatamente 23, o clube não consegue vender nem liberar ninguém (o elenco nunca fica abaixo de 23).
- Máximo prático de 32: a camisa vai de 1 a 32.
- Cubra a formação em dobro. Para `4-4-2A`, algo como 3 GK, 4 CB, 4 SB, 3 DH, 3 SH, 3 OH, 4 CF.
- As 8 posições são as do WE: `GK` goleiro, `CB` zagueiro, `SB` lateral, `DH` volante, `SH` meia lateral, `OH` meia ofensivo, `CF` centroavante, `WG` ponta. Lateral-esquerdo e lateral-direito são ambos `SB`; ponta-esquerda e ponta-direita são ambos `WG`.

### 4.3 Cada jogador

```jsonc
{
  "id": "cea-joao-silva",          // único no PACOTE inteiro: <sigla minúscula>-<nome em slug>
  "nome": "João Silva",            // nome completo, com acento
  "nome_we": "J. SILVA",           // ATÉ 10 caracteres ASCII, sem acento
  "posicao": "CB",
  "posicao_secundaria": "DH",      // recomendado (sem ela: aviso); null se não houver
  "camisa": 4,                     // 1 a 32, sem repetir no time
  "camisa_real": 44,               // opcional: número real se passar de 32 (1-99), senão null
  "idade": 27,                     // 14 a 50 (o WE mostra de 18 a 38)
  "nacionalidade": "BRA",          // código de 3 letras
  "pe": "destro",                  // destro | canhoto | ambidestro
  "altura": 184,                   // 148 a 211 cm
  "atributos": { ... },            // 16 notas de 1 a 20 (seção 5)
  "outside": true,                 // os times existentes usam true em todos; mantenha true
  "potencial": 13,                 // oculto, 1-20 (seção 5.3)
  "resistencia": 10,               // oculto, 1-20; 10 = normal (é o que o pacote todo usa)
  "moral_inicial": 55,             // opcional, 0-100
  "contrato": { "salario_mensal": 8000000, "ate_temporada": 2028, "multa": 0 },
  "aparencia": { "pele": 2, "fisico": "F", "cabelo": "i1", "cor_cabelo": "A", "barba": "A", "cor_barba": "A", "chuteira": "A" }  // opcional
}
```

- **`id`**: só minúsculas, números e hífen (`^[a-z0-9-]+$`). Se dois jogadores tiverem o mesmo nome, acrescente um sufixo (`cea-joao-silva-2`).
- **`nome_we`**: como a imprensa chama o jogador ("ARRASCAETA", "G. HENRIQUE"). Corte para caber em 10 caracteres e tire os acentos (ç → c, ã → a).
- **`aparencia`** (opcional): pele 1-4, físico A-H, cabelo um de `a1 a2 a3 b1…b6 c1 c2 d1 d2 e1 e2 f1 f2 f3 g1 h1 i1 i2 i3 j1 k1 l1 l2 l3 m1 n1 o1 p1`, cor do cabelo A-H, barba A-G, cor da barba A-G, chuteira A-H. Sem ela, o WE mantém o rosto do jogador original da vaga. Se não souber, omita o campo em vez de chutar.

### 4.4 Contratos

- `salario_mensal` em centavos. `0` é aceito, mas dá aviso: o jogo põe 1,2% do valor de mercado ao mês (mínimo R$ 15 mil). Prefira valores plausíveis: titulares de clube médio entre R$ 80 mil e R$ 400 mil por mês, reservas e jovens entre R$ 15 mil e R$ 60 mil.
- **`ate_temporada`**: o contrato vence na última semana daquela temporada. **Espalhe os vencimentos** entre `temporada_inicial` e `temporada_inicial + 4` (2026 a 2030 no `brasil-2026`). Se todos vencerem no mesmo ano, o elenco inteiro cai na virada de temporada de uma vez.
- `multa`: `0` deixa o jogo calcular (3× o valor de mercado).

## 5. Atributos (a parte mais importante)

### 5.1 A escala

As 16 notas vão de 1 a 20 no manager e são convertidas para os 8 níveis do WE (12 a 19 na tela) só na hora da partida:

| Nota no manager | 1-6 | 7-8 | 9-10 | 11-12 | 13-14 | 15-16 | 17-18 | 19-20 |
|---|---|---|---|---|---|---|---|---|
| WE (tela) | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 |

Os times importados usam só os valores centrais **3, 7, 9, 11, 13, 15, 17, 19**. Você pode usar qualquer valor de 1 a 20 (a evolução do jogador usa a escala fina), mas lembre que 11 e 12 viram o mesmo nível no WE.

Siglas e rótulos do menu do WE: OFF (ATAQU), DEF (DEFESA), BAL (EQUILI.), STA (FOLE), SPD (VELOC.), ACC (ACELE.), RES (REFLE.), DRI (DRIBLE), PAS (PAS), SHP (CHU.F., chute forte), SHA (CHUTE M., precisão), TEC (TECN.), HEA (CABECI.), JMP (PULO), CUR (CURV), AGR (AGREC.).

### 5.2 Calibrar pelo pacote, não pelo instinto

O "geral" de um jogador é a média simples das 16 notas. Referência do `brasil-2026` (Série A 2026, média dos 11 melhores de cada time):

| Faixa | Média dos 11 melhores | Exemplos |
|---|---|---|
| Topo | 13 a 14 | FLA 13,7 · PAL 13,3 |
| Grandes | 11 a 12,5 | CRU, CAM, FLU, BOT, COR, SAN |
| Meio da Série A | 10 a 11,3 | BAH, INT, GRE, RBB, CAP |
| Fundo da Série A | 8,8 a 9,8 | MIR, VIT, CFC, REM, CHA |

No pacote todo, o geral médio de um jogador é 9,5 (de 5,1 a 16,1). **Um time da Série B deve ficar abaixo do fundo da Série A** (11 melhores perto de 8 a 9), e um da Série C mais abaixo ainda. Não dê 17 a 19 para ninguém que não seja destaque nacional: 19 é raro no pacote inteiro (273 notas em 7.000).

### 5.3 Perfil por posição

Médias por posição no pacote atual. Comece por elas e ajuste pelo estilo do jogador; as demais notas ficam baixas (3 a 9):

| Posição | Notas altas (média no pacote) |
|---|---|
| GK | RES 16 · BAL 13 · JMP 13 · DEF 12 (OFF, DRI, SHA, PAS, TEC, HEA em 3) |
| CB | HEA 17 · DEF 16 · JMP 14 · BAL 14 · RES 11 |
| SB | STA 15 · SPD 14 · ACC 13 · CUR 11 · DEF 10 |
| DH | STA 15 · DEF 15 · PAS 13 · RES 11 · BAL 11 |
| OH | TEC 17 · PAS 17 · CUR 16 · DRI 15 · OFF 13 |
| CF | OFF 18 · SHA 17 · AGR 16 · SHP 15 · HEA 14 |
| WG | ACC 18 · SPD 18 · DRI 17 · OFF 14 · AGR 14 |
| SH | ACC 15 · SPD 15 · STA 15 · TEC 14 · DRI 14 |

Esses são os números de titulares de Série A. Para o reserva e para clube menor, tire 2 a 4 pontos das notas altas.

- **`potencial`** (oculto, 1-20): até onde o jogador pode chegar. Jovem promissor fica 2 a 5 acima do próprio geral; jogador de 27 a 30 anos, perto do geral; veterano, igual ou abaixo. No pacote vai de 5 a 17.
- **`resistencia`** (oculto): use 10, salvo motivo forte (8 = se machuca e cansa mais; 12 a 13 = muito resistente).

## 6. Kits, bandeira e escudo

**Escudo (obrigatório):** `escudos/SIG.png`, PNG com transparência. Sem ele, o erro `escudo_faltando` bloqueia a carreira. Se o usuário não mandar um, **pare e peça**; não crie um escudo falso de clube real. Para time fictício, um escudo simples nas cores do clube serve, desde que o usuário saiba.

**Uniformes** (`kit`, `kit_reserva`, `kit_goleiro`): o formato é o de `data/times`. O mínimo útil é o `design` com as cores:

```jsonc
"kit": {
  "cor_numero": "#FFFFFF",
  "design": {
    "camisa": "#000000", "detalhe": "#FFFFFF", "calcao": "#000000", "meiao": "#000000",
    // estilos, todos opcionais e combináveis (aplicados nesta ordem):
    "listras_verticais": { "cores": ["#000000", "#FFFFFF"], "largura": 4 },          // tipo Atlético-MG
    "mangas": "#FFFFFF",                                                             // mangas de outra cor
    "faixa_diagonal": { "cor": "#000000", "largura": 14, "inicio": "direita" },     // tipo Vasco
    "faixa_peito": { "cor": "#C8102E", "linhas": [10, 17] },                        // faixa no peito
    "faixas": [ { "cor": "#FFFFFF", "regiao": "frente", "linhas": [10, 14] } ]       // faixas livres, por último
  }
}
```

- `faixa_diagonal`: `largura` em pixels da frente (64 de largura, padrão 14, de 2 a 40); `inicio` é o lado da textura onde fica o ombro (`direita` por padrão). Nas costas a faixa sai espelhada, subindo pelo mesmo ombro. Se aparecer invertida no WE, troque o `inicio`.
- `faixa_peito`: `linhas` em linhas da frente (32 de altura, padrão `[10, 17]`); nas costas fica na mesma altura proporcional.
- `regiao` das faixas livres: `frente`, `costas`, `laterais` ou `mangas`. `linhas` vale `[y0, y1]` a partir do topo da região, em pixels da textura original (a frente tem 32 linhas; veja `src/core/we/estampas.ts`).
- Design malformado dá o aviso `kit_design_invalido`.
- **Só use `"arte": "kits/desenhos/sig_4x.png"` se o arquivo existir.** Arte apontando para arquivo inexistente dá aviso. A arte é gerada à mão ou com `npm run kits:desenhar -- --time pacotes/brasil-2026/times/SIG.json`, que grava na pasta do pacote e **não regrava** arte existente (use `--forcar`, ou `--saida <pasta>` para uma prévia); se não for gerá-la, deixe o campo de fora.
- Sem `kit_goleiro` sai um aviso. Recomenda-se uma camisa de cor que não confunda com nenhum dos dois kits de linha.

**Bandeira** (opcional): imagem em `bandeiras/SIG.png` e, no time, `"bandeira": { "arquivo": "bandeiras/SIG.png", "ajuste": "esticar" }` (`esticar`, `ajustar` ou `cortar`). A ponte a converte para 64x28 com 16 cores.

## 7. Colocar o time numa competição

Um time pode existir só para o mercado. Para ele jogar, acrescente a sigla em `competicoes/<id>.json`:

```jsonc
"participantes": { "regra": "lista", "times": [ "...", "SIG" ], "quantidade": 20 }
```

- `quantidade` precisa bater com o tamanho da lista; se acrescentar alguém, tire outro ou mude o formato com o usuário.
- O formato da 1ª fase manda no tamanho: mata-mata pede potência de 2; grupos pedem `quantidade × tamanho`.
- Competição nova (Série B etc.) é outro trabalho, em `docs/spec/03-competicoes-calendario.md`, e precisa de bloco no `temporada.json`. Não faça sem pedir.

## 8. Validar

Rode na pasta do projeto:

```bash
npm run pacote:validar -- --time SIG
```

- **Erros** precisam zerar no seu time: `escudo_faltando`, `elenco_incompleto`, `goleiros_insuficientes`, `camisa_repetida`, `jogador_id_repetido`, `nome_we_vazio`, `pais_inexistente`, `sigla_repetida`, `arquivo_invalido` (JSON fora do formato; a mensagem diz o campo).
- **Avisos** são aceitáveis, mas explique cada um no relatório: `nome_longo`, `sem_posicao_secundaria`, `contrato_sem_salario`, `financas_vazias`, `estadio_vazio`, `kit_goleiro_faltando`, `kit_arquivo_faltando`, `kit_design_invalido`.
- Se mexeu numa competição, rode também `npm run pacote:validar` sem `--time` e confira que não surgiu erro novo na competição (`competicao_tamanho`, `time_inexistente`).

Antes de dar como pronto, confira à mão:

- [ ] `times/SIG.json` com sigla, nome, `nome_curto` ≤ 10 ASCII, país existente, porte, formação da lista, cores `#RRGGBB`
- [ ] 25 a 28 jogadores (mínimo 23), 3 goleiros (mínimo 2), formação coberta em dobro
- [ ] `id` únicos no pacote, camisas 1-32 sem repetir, `nome_we` ≤ 10 ASCII
- [ ] Atributos 1-20 coerentes com a divisão (seção 5.2) e com a posição (seção 5.3)
- [ ] Contratos espalhados de 2026 a 2030; folha ≤ orçamento
- [ ] Dinheiro em centavos e inteiro em todo lugar
- [ ] `escudos/SIG.png` existe
- [ ] `npm run pacote:validar -- --time SIG` sem erros

## 9. Relatório para o usuário

Termine com:

1. Arquivos criados ou alterados (caminhos).
2. Resumo do time: porte, formação, número de jogadores por posição, média dos 11 melhores e onde isso fica na tabela da seção 5.2.
3. Saída da validação do time (erros = 0) e a explicação de cada aviso.
4. O que foi **suposto ou inventado** (finanças, salários, aparência, potencial) e as fontes usadas para o elenco real.
5. O que falta e só o usuário pode fazer: escudo, se ainda não houver; arte do kit; testar no WE.
