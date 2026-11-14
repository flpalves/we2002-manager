# 02 · Pacote de dados e banco da carreira

## Princípio

- O **pacote de dados** é a base inicial (times, jogadores, competições, regras). Fica em JSON + PNG, editável pelo **editor do pacote** e à mão.
- Ao **criar uma carreira**, o pacote é validado (Zod + regras de consistência) e **importado** para o `carreira.sqlite`. Daí em diante o SQLite é a fonte da verdade daquela carreira; mudar o pacote não afeta carreiras existentes.

## Estrutura do pacote

```
pacotes/<id>/
  manifesto.json            # id, nome, versao, temporada_inicial (2026), tipo: "real" | "ficticio", autor
  regras.json               # conversão 1-20 → WE, pesos do "geral" por posição, padrões de suspensão,
                            # janelas, calibragem do motor e das finanças (sobrescreve core/config/padroes.ts)
  paises.json               # BRA + 9 da CONMEBOL: código, nome, fator de valor de mercado
  temporada.json            # ordem da temporada: blocos por competição (estaduais, séries, copas, continentais)
  divisoes.json             # escada de acesso e rebaixamento entre as séries (opcional; ver 03-competicoes-calendario.md)
  times/<SIGLA>.json        # um arquivo por time (formato abaixo)
  competicoes/<id>.json     # definição pelo motor de fases (ver 03-competicoes-calendario.md)
  noticias.json             # catálogo de eventos (ver 09-noticias-eventos.md)
  exterior.json             # disponíveis do exterior: jogadores sem clube no jogo, com taxa fixa (opcional; ver 06)
  livres.json               # livres iniciais (opcional; mesmo formato, sem origem e taxa)
  escudos/<SIGLA>.png       # OBRIGATÓRIO para todo time
  kits/desenhos/<sigla>_4x.png, <sigla>_reserva_4x.png, <sigla>_goleiro_4x.png
```

O pacote atual do Felipe (`pacotes/brasil-2026/`, gerado por `npm run pacote:gerar`) nasce dos arquivos existentes em `data/times/*.json` (20 times da Série A 2026) e cresce pelo editor. **Leia esses arquivos e `tools/lib/times.mjs` antes de definir o esquema final**: o formato abaixo estende o que já existe, não o substitui.

### `times/<SIGLA>.json`

```jsonc
{
  "sigla": "FLA", "nome": "Flamengo", "nome_curto": "FLAMENGO",   // nome_curto: até 10 chars ASCII (vai para o WE)
  "pais": "BRA", "estado": "RJ",
  "cores": ["#C8102E", "#111111", "#FFFFFF"],                      // a 1ª é a cor do clube na interface
  "porte": "grande",                                               // grande | medio | pequeno (IA, diretoria, demanda de público)
  "estadio": { "nome": "Maracanã", "capacidade": 78838, "ingresso_padrao": 8000, "custo_por_jogo": 90000000 },
  "financas": { "saldo_inicial": 3560000000, "patrocinio_temporada": 7000000000, "orcamento_folha_mensal": 1500000000 },
  "formacao": "4-3-3B",
  "kit": { ... }, "kit_reserva": { ... },                          // formato atual de data/times
  "bandeira": { ... },                                             // formato atual (bandeira na VRAM)
  "jogadores": [ /* ver abaixo */ ]
}
```

Dinheiro em **centavos** (inteiros).

### Jogador

```jsonc
{
  "id": "fla-arrascaeta",              // estável dentro do pacote
  "nome": "Giorgian de Arrascaeta", "nome_we": "ARRASCAETA",   // nome_we: até 10 chars ASCII
  "posicao": "OH", "posicao_secundaria": "WG",                 // GK CB SB DH SH OH CF WG
  "camisa": 10, "camisa_real": null,                           // camisa 1-32 (limite do WE)
  "idade": 32, "nacionalidade": "URU", "pe": "esquerdo",       // destro | canhoto | ambidestro
  "altura": 174,                                               // 148-211 cm (limite do WE)
  "atributos": { "OFF": 17, "DEF": 8, "BAL": 12, "STA": 13, "SPD": 14, "ACC": 15, "RES": 15, "DRI": 18,
                 "PAS": 19, "SHP": 15, "SHA": 16, "TEC": 18, "HEA": 10, "JMP": 9, "CUR": 18, "AGR": 15 },
  "outside": true,
  "potencial": 18, "resistencia": 12,                          // ocultos, 1-20
  "moral_inicial": 60,                                         // 0-100, opcional
  "contrato": { "salario_mensal": 0, "ate_temporada": 2026, "multa": 0 },
  "aparencia": { "pele": 3, "fisico": "F", "cabelo": "i1", "cor_cabelo": "A", "barba": "A", "cor_barba": "A", "chuteira": "A" }   // opcional; formato da ponte (tools/lib/registro.mjs)
}
```

- **16 atributos do WE** (os 15 do painel + AGREC), todos na **escala 1-20** do manager. Siglas internas acima; rótulos da interface em pt-BR como no menu de edição do WE: ATAQU, DEFESA, EQUILI., FOLE, VELOC., ACELE., REFLE., DRIBLE, PAS, CHU.F., CHUTE M., TECN., CABECI., PULO, CURV, AGREC.
- Aparência no formato que a ponte já grava: pele 1-4, físico A-H, cabelo a1…p1 (32 modelos), cor do cabelo A-H, barba A-G, cor da barba A-G, chuteira A-H. Sem aparência, o WE mantém a do jogador original da vaga.
- Limites de aparência e campos: ver `docs/we/offsets-we2002.md` (registro de 12 bytes). Pele 1-4, físico A-H, cabelo 32 modelos, cor do cabelo A-H, barba A-G, cor da barba A-G, chuteira A-H, idade no WE 18-38 (fora disso, satura).
- Importação dos arquivos atuais: atributos na escala do WE (12-19) viram 1-20 pela **inversa da tabela de conversão** (valor central da faixa, arredondado para baixo). Com a tabela padrão: 12 → 3 · 13 → 7 · 14 → 9 · 15 → 11 · 16 → 13 · 17 → 15 · 18 → 17 · 19 → 19. Ida e volta preservam o nível do WE (teste).
- Contrato: `ate_temporada` quer dizer que o contrato **vence na última semana daquela temporada**. As **semanas restantes** (usadas pelo valor de mercado, pela renovação e pela IA) = (`ate_temporada` − temporada atual) × `semanas_por_temporada` + (`semanas_por_temporada` − semana atual). Ver `03-competicoes-calendario.md`.

### `exterior.json` e `livres.json`

Jogadores que começam a carreira **sem clube**. Mesmo formato do jogador do time, **sem** `camisa`, `camisa_real` e `contrato` (ganham na contratação), e com dois campos a mais no `exterior.json`:

```jsonc
{
  "temporada": 2026,
  "jogadores": [
    {
      "id": "ext-wendel", "nome": "Wendel", "nome_we": "WENDEL",
      "posicao": "OH", "posicao_secundaria": "DH", "idade": 29, "nacionalidade": "BRA",
      "pe": "destro", "altura": 175, "atributos": { /* 16 atributos 1-20 */ }, "outside": true,
      "potencial": 17, "resistencia": 10,
      "origem": { "clube": "Zenit", "pais": "RUS" },   // só exterior: texto informativo
      "taxa": 3470000000                                // só exterior: taxa fixa, em centavos
    }
  ]
}
```

- `id` começa com `ext-` (exterior) ou `liv-` (livre) e não pode repetir um id de jogador de time.
- `origem.pais` é só um código de 3 letras (não precisa estar no `paises.json`: o clube de origem não existe no jogo).
- Importação: `time_id = NULL`, `status = 'exterior'` (com `taxa_fixa`, `origem_clube`, `origem_pais`) ou `status = 'livre'`; camisa provisória 0 (a contratação dá uma camisa livre).
- Gerador do `exterior.json` do Felipe: `docs/we/mercado-exterior-2026/` (`jogadores.txt` + `montar.py`).
- **Validação**: erro se um id repetir (entre times, exterior e livres) ou se a taxa do exterior for ≤ 0; aviso se `nome_we` repetir entre os sem clube, se `nome_we` passar de 10 caracteres ou se faltar posição secundária.

### Validação do pacote (painel "Validação" do editor)

- **Erros** (bloqueiam criar carreira): escudo PNG faltando; time sem 23 jogadores convocáveis com pelo menos 2 GK; competição com número de times diferente do que o formato pede; time referenciado que não existe; camisa repetida no mesmo time; `nome_we` vazio.
- **Avisos**: nome com mais de 10 caracteres (será cortado); kit de goleiro faltando; finanças vazias (usa padrão por porte); jogador sem posição secundária.

## Banco da carreira (`carreira.sqlite`)

Tabelas principais (chaves e colunas essenciais; detalhar nas migrações):

| Tabela | Conteúdo |
|---|---|
| `carreira` | id, nome, pacote_id, pacote_versao, semente, tecnico_nome, time_usuario, dificuldade, temporada_atual, semana_atual, passo_atual, versao_esquema, criada_em |
| `configuracao` | chave/valor: tema, cor, caminhos do emulador, regras sobrescritas |
| `pais`, `time` | dados do pacote + estado vivo (saldo, confiança da diretoria, entrosamento, formação, ingresso) |
| `jogador` | atributos 1-20, ocultos, condição, moral, time_id, posição, aparência, status (ativo, emprestado, livre, exterior, fora); `taxa_fixa`, `origem_clube`, `origem_pais` para o exterior |
| `contrato` | jogador, time, salário, até, multa, tipo (definitivo, empréstimo com time de origem) |
| `competicao`, `edicao` | competição do pacote; edição por temporada |
| `fase`, `grupo`, `participante` | estrutura gerada pelo motor de fases para cada edição |
| `partida` | edição, fase, grupo, rodada, passo do calendário, casa, visitante, gols, pênaltis, modo (we, cpu_cpu_we, simulada, manual), origem do resultado, semente |
| `evento_partida` | gol (autor, assistência, minuto, contra), cartão, lesão, substituição (sai, entra, minuto) |
| `escalacao_partida` | quem jogou, minutos, posição, número |
| `estatistica_temporada` | por jogador e competição: jogos, minutos, gols, assistências, amarelos, vermelhos |
| `suspensao`, `lesao` | jogador, competição (suspensão), semanas/jogos restantes, origem |
| `negociacao`, `movimento_negociacao` | alvo, clubes, etapa (clube/jogador), histórico de propostas; contador de movimentos por janela entre partidas |
| `transferencia` | histórico (inclui IA x IA) |
| `lancamento_financeiro` | semana, time, categoria, valor, descrição |
| `meta_diretoria` | temporada, tipo, alvo, status |
| `noticia` | semana, tipo, texto, entidades ligadas, efeitos aplicados, lida |
| `historico_temporada` | campeões, artilheiros, acesso/rebaixamento, classificação final do usuário |

Classificações são **calculadas** a partir de `partida` (com cache por edição/fase invalidado ao gravar jogo), para nunca divergirem dos resultados.
