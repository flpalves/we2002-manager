-- IA de técnico: rodízio controlado (teto de poupados, jogos em sequência, perda máxima).
-- As regras ficam congeladas na carreira; aqui só entram as chaves novas (json_insert não
-- sobrescreve) e sai a penalidade antiga, que não é mais usada.
UPDATE regras SET dados = json_remove(
  json_insert(
    dados,
    '$.ia.rodizio_critico', 50,
    '$.ia.rodizio_dias_sequencia', 4,
    '$.ia.rodizio_bonus_proximo_importante', 10,
    '$.ia.rodizio_maximo', json('{"liga":2,"continental":2,"copa":3,"estadual":4}'),
    '$.ia.rodizio_maximo_decisivo', 1,
    '$.ia.rodizio_perda_maxima', json('{"liga":0.03,"continental":0.03,"copa":0.05,"estadual":0.08}'),
    '$.ia.rodizio_perda_extra_critico', 0.05
  ),
  '$.ia.rodizio_penalidade'
);
