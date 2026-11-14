# Times da Série B 2026 (gerados em 13/11/2026)

## No pacote do manager (`C:\Users\felip\OneDrive\Documentos\projetos\we2002-manager`)

- 20 arquivos em `pacotes/brasil-2026/times/`: NOV, JUV, VIL, FOR, CRI, GOI, SPT, ACG, CRB, SBE, OPE, CUI, CEA, AME, BFS, ATH, NAU, AVA, PON, LON. Arte dos kits em `pacotes/brasil-2026/kits/desenhos/<sig>_4x.png` e `<sig>_reserva_4x.png` (copiadas de `D:\we2002-manager\kits\desenhos`).
- Fonte e gerador: `docs/we/elencos-serie-b-2026/`. `elencos.py` tem os titulares e reservas das rodadas 36/37 e os `EXTRAS` tirados dos bancos das rodadas 34/35 (ESPN). `kits-legado.json` guarda as cores dos kits. Para rodar: `python3 docs/we/elencos-serie-b-2026/montar.py pacotes/brasil-2026 [pasta dos kits] [--forcar]`. Sem `--forcar`, não regrava time que já existe. Com `--forcar`, regrava só os 20 da Série B.
- Notas pelo mesmo método do `montar.py` da Série A (níveis do WE convertidos para 3/7/9/…/19), com `AJUSTE = 0.3`. Média dos 11 melhores: FOR 9,08 · NOV 9,02 · JUV 8,95 … PON 7,94 · LON 7,92. O guia pede de 8 a 9 para a Série B.
- Elencos com 23 a 27 jogadores. Só GOI e CUI têm 3 goleiros; os outros têm 2.
- **Supostos:** porte, estádio (capacidade aproximada), finanças pelo porte (médio: saldo R$ 12 mi, patrocínio R$ 20 mi, folha R$ 3,5 mi; pequeno: R$ 3 mi, R$ 6 mi, R$ 1,1 mi), salários (titular R$ 150 mil / R$ 55 mil, reserva R$ 40 mil / R$ 18 mil) e vencimentos de contrato espalhados entre 2026 e 2030. Altura e idade são estimadas. O `nome` é o nome curto (falta o nome completo). Não tem `aparencia` (o guia manda omitir quando não se sabe). Nacionalidade estrangeira só nos casos conhecidos.
- Validação (`tools/validar-pacote.ts`): o único erro de cada time é `escudo_faltando`, que precisa de PNG aprovado pelo Felipe. Os avisos são `sem_posicao_secundaria` e `kit_goleiro_faltando`. O pacote inteiro tem 20 erros, todos esses escudos.
- Ainda não existe competição Série B (`competicoes/serie-b.json` + bloco no `temporada.json`). O guia pede para não criar sem autorização.
- Para validar no Linux da sessão: instalar `@esbuild/linux-x64@0.28.2` fora do projeto e usar `ESBUILD_BINARY_PATH`. O `node_modules` do projeto é do Windows.

## No projeto antigo (`D:\we2002-manager`)

- 20 arquivos novos em `data/times/` (slugs: novorizontino, juventude, vila-nova, fortaleza, criciuma, goias, sport, atletico-go, crb, sao-bernardo, operario-pr, cuiaba, ceara, america-mg, botafogo-sp, athletic, nautico, avai, ponte-preta, londrina).
- Titulares = escalações da ESPN nas rodadas 36 e 37 (31/10 a 9/11/2026). Reservas = banco e substitutos das mesmas partidas. O Náutico usa a escalação da 36ª, porque na 37ª jogou com time alternativo.
- Gerador: `tools/serie-b-2026/elencos.py` e `gerar.py` (cópia do gerador da Série A com `META`, `RESERVA` e `LISTRAS` próprios).
- Kits: listras verticais em JUV, ACG, OPE, CEA, NAU, AVA, CRB e SPT. No Sport e no CRB as listras reais são horizontais, então é uma aproximação.
- Uniformes: `node tools/serie-b-2026/teste-uniformes.mjs` roda os 1560 confrontos com `uniforme: "auto"`. Resultado: 340 visitantes de reserva e 0 camisas parecidas. O teste da Série A lê o `uniforme` do `data/partida.json` atual e dá resultado errado.
- Goleiros reservas deduzidos do banco, a conferir: Vila Nova (W. Camargo), Ceará (Caíque), América-MG (Cássio), Goiás (Ezequiel) e Cuiabá (Otávio).
