# 09 · Notícias e eventos aleatórios

O **catálogo completo entra na v1** e está especificado em `docs/spec/09b-catalogo-noticias.md`. Este arquivo define o **motor** que o catálogo vai usar.

## Dois tipos de notícia

1. **Informativas**, geradas pelo próprio jogo: resultado da rodada, lesão, suspensão, transferência (inclusive IA x IA), proposta recebida, janela abrindo/fechando, meta da diretoria, renovação pendente, artilharia, acesso/rebaixamento.
2. **Eventos aleatórios** do catálogo: acontecimentos com chance e efeito (ex.: "jogador se destaca no treino", "atrito no vestiário", "patrocinador oferece bônus").

## Formato de um evento do catálogo (`noticias.json`)

```jsonc
{
  "id": "destaque-treino",
  "tipo": "elenco",                         // elenco | diretoria | mercado | financas | torcida | imprensa
  "gatilho": { "momento": "semana", "condicoes": [ { "campo": "jogador.idade", "op": "<=", "valor": 23 } ] },
  "alvo": "jogador_aleatorio_do_usuario",   // ou time_usuario, jogador_condicionado, time_qualquer
  "chance": 0.02,                           // por avaliação
  "intervalo_minimo_semanas": 6,            // não repetir o mesmo evento antes disso
  "texto": "{jogador} chama atenção no treino e ganha elogios da comissão.",
  "efeitos": [ { "campo": "moral", "delta": 8 }, { "campo": "atributo_aleatorio_do_foco", "delta": 1, "chance": 0.5 } ],
  "escolhas": null                          // opcional: lista de opções do usuário, cada uma com efeitos
}
```

- **Momentos**: a cada semana, depois de cada partida, ao abrir/fechar janela, na virada de temporada.
- **Efeitos** possíveis: moral, condição, atributo, potencial (raro), confiança da diretoria, saldo (lançamento financeiro), lesão, disponibilidade (ex.: "liberado para assuntos pessoais por 1 semana"), interesse do mercado.
- **Escolhas**: o evento pode pedir decisão do usuário (ex.: multar o jogador ou não). Interrompe o Continuar.
- Toda aplicação de efeito é registrada em `noticia.efeitos_aplicados` (auditável e reversível em teste).
- Sorteios com o `rng` derivado de `('noticias', semana)`.

## Interface

- Caixa de notícias com filtro por tipo e etiqueta colorida (`we-tag`); as mais recentes no painel inicial.
- Notícias com escolha aparecem em destaque e bloqueiam o Continuar até a resposta.
