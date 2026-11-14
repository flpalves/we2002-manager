# Elencos da Série A 2026 (base: escalações da 34ª rodada, 3-6/11/2026, + reservas do elenco)
# Linha: nome | pos | camisa | altura | idade | pé (d/c/a) | nível relativo | tags | pele (1-4)
# Ordem: 11 titulares na ordem da formação, depois 11 reservas (o 1º reserva é o goleiro).
# Formações (ordem das vagas 1-10, igual aos times já existentes):
#   4-3-3B : CB CB LB RB DH DH OH CF LW RW
#   4-4-2A : CB CB LB RB DH LH RH OH CF CF
#   5-3-2  : CB CB CB DH DH LH RH OH CF CF

TIMES = {}

TIMES["flamengo"] = dict(forca=1.0, formacao="4-3-3B", elenco="""
Rossi|GK|1|186|31|d|0.6||2
Leo Ortiz|CB|3|183|30|d|0.5||3
L. Pereira|CB|4|188|30|c|0.6|cab|2
A. Sandro|LB|26|180|35|c|0.3|vet cri|3
Varela|RB|2|173|33|d|0.4|vet|2
Pulgar|DH|5|187|32|d|0.6|mar|2
Jorginho|DH|21|180|34|d|0.8|cri vet|1
Arrascaeta|OH|10|174|32|c|2.0|cri dri bola|1
Pedro|CF|9|185|29|d|1.4|fin cab|2
S. Lino|LW|16|175|26|d|0.8|vel dri|3
Carrascal|RW|15|182|27|c|1.0|dri|3
M. Cunha|GK|25|190|25|d|-0.2||2
Danilo|CB|13|184|35|d|0.4|vet mar|3
A. Lucas|LB|6|176|29|c|0.2|vel|3
E. Royal|RB|22|183|27|d|0.2||3
Saul|DH|8|182|31|c|0.6|cri|1
E. Araujo|DH|30|178|23|d|0.0||3
Paqueta|OH|20|180|29|d|1.6|dri cri|2
Plata|RW|19|178|26|c|0.6|vel dri|4
L. Araujo|RW|7|175|30|c|0.3|vel|2
B.Henrique|CF|27|184|35|d|0.5|vel vet|3
Juninho|CF|23|178|29|d|0.0|fin|3
""")

TIMES["palmeiras"] = dict(forca=0.9, formacao="5-3-2", elenco="""
C. Miguel|GK|1|204|27|d|0.5||3
B. Fuchs|CB|3|186|27|d|0.3|cab|2
G. Gomez|CB|15|185|33|d|0.7|cab mar vet|2
Barboza|CB|16|189|31|c|0.4|cab|1
M. Freitas|DH|17|178|31|d|0.5|cri|3
Andreas|DH|8|178|30|d|0.8|cri bola|2
Arthur|LH|38|175|23|c|0.0|vel|2
Khellven|RH|2|178|25|d|0.2|vel|3
Arias|OH|11|172|29|d|1.3|dri vel|3
V. Roque|CF|9|172|21|d|1.2|vel fin|3
Mauricio|CF|18|178|25|d|0.8|cri|2
M. Lomba|GK|42|190|39|d|-0.5|vet|2
Murilo|CB|26|184|29|d|0.4|cab|2
Piquerez|LB|22|182|28|c|0.5||1
Giay|RB|4|178|25|d|0.1||2
A. Moreno|DH|5|180|27|d|0.4|mar|1
Allan|DH|40|175|21|d|0.2||3
L.Evangel.|DH|30|177|31|d|0.1||2
R. Veiga|OH|23|176|31|c|0.8|bola cri|2
F.Anderson|RW|7|175|33|c|0.4|vet dri|3
Flaco|CF|42|189|25|c|0.8|cab fin|1
Ramon Sosa|LW|19|175|27|c|0.4|vel|2
""")

TIMES["corinthians"] = dict(forca=0.2, formacao="4-3-3B", elenco="""
Hugo Souza|GK|1|196|27|d|0.8||2
A. Ramalho|CB|5|182|34|d|0.2|vet|2
G.Henrique|CB|13|196|33|d|0.3|cab|3
Angileri|LB|26|179|32|c|0.1||1
Milans|RB|23|177|24|d|0.0||1
B. Bidon|DH|27|176|21|d|0.4|cri|2
Andre|DH|7|176|25|d|0.3|mar|3
Garro|OH|10|171|28|c|1.1|cri bola|1
Yuri|CF|9|180|25|d|1.1|vel fin|3
M. Bidu|LW|21|172|27|c|0.0|vel|3
Kaio Cesar|RW|11|174|22|d|0.3|vel dri|3
F. Longo|GK|32|190|21|d|-0.5||2
G.Paulista|CB|3|186|36|d|0.3|vet cab|2
Tchoca|CB|25|186|26|c|-0.2||2
Matheuzin|RB|2|170|26|d|0.2|vel|3
Raniele|DH|14|183|29|d|0.3|mar|3
Allan|DH|28|174|35|d|0.0|vet mar|3
Labyad|OH|20|179|33|c|0.3|cri vet|2
Lingard|OH|17|175|33|d|0.6|cri vet|3
Memphis|CF|31|176|32|d|1.4|fin for bola|3
Carrillo|RH|19|180|35|d|0.2|vet dri|3
Pedro Raul|CF|18|193|30|d|0.1|cab|3
""")

TIMES["spfc"] = dict(forca=0.2, formacao="5-3-2", elenco="""
Rafael|GK|23|190|36|d|0.4|vet|2
Newton|CB|6|186|30|d|0.0||3
Arboleda|CB|5|187|34|d|0.5|cab vet|4
Osorio|CB|4|188|26|c|0.0|cab|3
Djhordney|DH|29|178|24|d|0.0||3
Bobadilla|DH|21|178|24|d|0.4|mar|2
Iago|LH|16|176|22|c|-0.1|vel|2
Pedro Lima|RH|2|174|20|d|0.1|vel|3
Luciano|OH|10|176|33|d|0.6|fin vet|3
Calleri|CF|9|188|32|d|0.8|cab fin for|1
Artur|CF|11|170|28|c|0.3|vel dri|3
Jandrei|GK|93|190|33|d|-0.3||2
Sabino|CB|35|187|29|c|0.0|cab|3
A. Franco|CB|28|184|29|d|0.2||2
L. Ramon|RB|22|175|29|d|-0.1||3
Enzo Diaz|LB|13|175|26|c|0.0||1
M. Antonio|DH|8|167|26|d|0.3|cri|3
Danielzin|DH|20|175|30|d|0.1||3
L. Moura|OH|7|172|34|d|0.8|dri vet|3
G. Santana|CF|19|180|22|d|-0.1||3
A. Silva|CF|17|185|30|d|0.2|fin|2
Ferreira|LW|47|169|28|d|0.2|vel dri|3
""")

TIMES["fluminense"] = dict(forca=0.4, formacao="4-3-3B", elenco="""
Fabio|GK|1|188|46|d|0.5|vet|2
T. Silva|CB|3|183|42|d|1.0|vet mar cab|3
Freytes|CB|4|187|27|c|0.3|cab|1
Rene|LB|6|180|34|c|0.1|vet|3
Guga|RB|23|178|28|d|0.2|vel|3
Hercules|DH|35|181|25|d|0.3|mar|3
Nonato|DH|16|178|28|d|0.2||3
L. Acosta|OH|32|160|32|d|1.0|dri cri baixo|2
Hulk|CF|7|180|40|c|1.2|for fin bola vet|3
Canobbio|LW|17|171|28|d|0.4|vel|1
Savarino|RW|11|172|29|c|0.8|dri cri|2
V. Eudes|GK|98|180|28|d|-0.4||2
Ignacio|CB|44|188|29|d|0.1|cab|1
S. Xavier|RB|2|174|36|d|0.0|vet|3
Arana|LB|13|176|29|c|0.4|vel|2
Martinelli|DH|8|178|25|d|0.4|cri|2
Bernal|DH|5|179|24|d|0.1|mar|2
Ganso|OH|10|184|37|c|0.5|cri lento|2
Lima|OH|45|176|30|d|0.0||3
J. Kennedy|CF|9|174|24|d|0.3|fin|3
Cano|CF|14|186|38|d|0.3|fin vet cab|1
Serna|RW|90|178|26|d|0.2|vel|4
""")

TIMES["botafogo"] = dict(forca=0.3, formacao="4-3-3B", elenco="""
G. Batista|GK|1|190|28|d|0.1||2
Ferraresi|CB|3|188|27|d|0.3|cab|2
Marcal|CB|21|180|37|c|0.1|vet|3
A. Telles|LB|13|181|33|c|0.6|bola cri vet|2
Vitinho|RB|2|172|27|d|0.2|vel|3
Huguinho|DH|5|175|23|d|0.0||3
Medina|DH|8|178|24|d|0.5|cri|2
Montoro|OH|10|172|19|d|0.6|dri cri|1
A. Cabral|CF|9|186|28|d|0.6|cab fin|3
M. Martins|LW|11|172|22|d|0.4|vel dri|3
Ziyech|RW|22|180|33|c|1.1|cri bola vet|2
Leo Linck|GK|24|190|25|d|-0.2||1
Monzon|CB|4|187|24|c|0.0|cab|1
Pantaleao|CB|15|188|30|d|0.1|cab|3
Ponte|RB|32|178|23|d|0.0||1
Danilo|DH|17|180|29|d|0.2|mar|3
Barrera|RW|25|175|26|d|0.2|dri|3
Santi R.|OH|23|172|28|c|0.3|cri|1
Correa|CF|26|188|32|d|0.4|fin vet|1
N.Fernand.|LW|7|175|21|d|0.0|vel|3
Jeffinho|LW|47|168|27|d|0.0|vel dri|4
K. Barria|CF|19|180|21|d|-0.2||3
""")

TIMES["atletico-mg"] = dict(forca=0.3, formacao="4-4-2A", elenco="""
Everson|GK|22|192|36|d|0.4|vet|2
Lyanco|CB|4|187|29|d|0.4|cab|2
Ruan|CB|3|188|27|d|0.1|cab|3
Pascini|LB|6|176|22|c|-0.1|vel|2
Preciado|RB|2|176|28|d|0.2|vel|4
Alexsander|DH|5|182|23|d|0.4|mar|3
G. Scarpa|LH|10|176|32|c|1.0|cri bola|1
Cisse|RH|8|180|25|d|0.2|mar|4
Igor Gomes|OH|17|176|27|d|0.5|cri|3
Minda|CF|11|172|23|d|0.4|vel dri|4
C. Soares|CF|19|182|19|d|0.0|fin|3
G. Delfim|GK|31|190|23|d|-0.4||2
Vitor Hugo|CB|14|189|35|d|0.1|cab vet|2
J. Alonso|CB|20|186|33|c|0.3|cab vet|1
Saravia|RB|13|178|33|d|0.0|vet|1
Natanael|LB|26|172|25|c|-0.1||3
Fred|DH|35|169|33|d|0.4|cri vet|3
Reinier|OH|18|185|24|d|0.4|cri|3
Bernard|OH|21|164|33|d|0.5|dri vet baixo|2
Rony|CF|33|169|31|d|0.4|vel|3
Cassierra|CF|9|189|29|d|0.2|cab fin|4
T. Borbas|CF|29|185|24|d|0.0|fin|1
""")

TIMES["cruzeiro"] = dict(forca=0.5, formacao="4-4-2A", elenco="""
Cassio|GK|1|195|39|d|0.6|vet|2
J. Jesus|CB|15|187|29|d|0.3|cab|3
Villalba|CB|25|185|27|c|0.4|mar|1
Rojas|LB|6|176|26|c|0.0||2
William|RB|12|176|31|d|0.3||3
L. Romero|DH|29|172|32|d|0.6|mar cri|1
B.Rodrigue|LH|47|180|29|c|0.3|dri|3
Gerson|RH|8|184|29|c|1.0|cri dri|3
M. Pereira|OH|10|175|30|c|1.4|cri bola dri|2
Kaio Jorge|CF|19|182|24|d|1.2|fin cab|3
Arroyo|CF|11|176|20|d|0.5|vel dri|4
Otavio|GK|31|190|25|d|-0.3||2
J. Marcelo|CB|4|186|26|d|0.2|cab|3
Fagner|RB|23|168|37|d|0.0|vet|3
Vina|LB|26|178|29|c|0.1||1
Ze Lucas|DH|5|178|18|d|0.0||3
Walace|DH|16|188|31|d|0.2|mar|3
Eduardo|OH|20|178|36|d|0.1|cri vet|2
Wesley|RW|17|176|22|d|0.4|vel dri|4
Sinisterra|LW|7|172|27|c|0.3|vel|4
Marquinhos|LW|18|170|23|c|0.0|vel|3
Villarreal|CF|9|182|20|d|0.1|fin|4
""")

TIMES["internacional"] = dict(forca=0.2, formacao="4-3-3B", elenco="""
Kauan|GK|22|190|21|d|-0.2||2
Maripan|CB|3|192|32|d|0.6|cab mar|2
Juninho|CB|18|186|29|d|0.0|cab|3
Bernabei|LB|26|180|26|c|0.4|cri|1
Aguirre|RB|35|178|26|d|0.1|vel|1
Villagra|DH|5|178|25|d|0.3|mar|1
Ronaldo|DH|16|178|29|d|0.1||3
A. Patrick|OH|10|176|35|d|1.0|cri bola vet|2
Alerrandro|CF|9|184|26|d|0.4|fin cab|3
Vitinho|LW|28|175|32|d|0.3|dri|3
Carbonero|RW|7|168|27|c|0.3|vel dri|4
Rochet|GK|1|192|33|d|0.4|vet|1
Mercado|CB|25|181|39|d|0.0|vet cab|1
Vitao|CB|4|188|26|d|0.2|cab|3
M. Bahia|LB|6|176|31|c|-0.2||3
B. Gomes|DH|15|180|25|d|0.1||3
T. Maia|DH|29|176|29|d|0.2|mar|2
O. Romero|OH|17|170|34|c|0.3|cri vet|2
Wanderson|LW|11|172|31|c|0.3|vel dri|3
Borre|CF|19|174|31|d|0.6|fin|3
Valencia|CF|13|175|37|d|0.4|fin vet|4
R. Mathias|CF|20|186|21|d|-0.2|cab|3
""")

TIMES["gremio"] = dict(forca=0.1, formacao="5-3-2", elenco="""
G. Grando|GK|1|193|26|d|0.0||1
G. Martins|CB|53|187|22|d|0.2|cab|2
Kannemann|CB|4|184|35|c|0.4|mar vet cab|1
Wallace|CB|3|190|31|d|0.2|cab|3
Villasanti|DH|20|183|29|d|0.5|mar|2
Noriega|DH|25|181|25|d|0.2|mar|2
Marlon|LH|36|176|29|c|0.0||3
Joao Pedro|RH|2|176|24|d|0.0|vel|2
Enamorado|OH|11|178|27|c|0.3|vel dri|4
Braithwait|CF|22|177|35|d|0.8|fin vet|2
Amuzu|CF|7|173|27|d|0.4|vel dri|4
Weverton|GK|21|189|38|d|0.4|vet|2
Viery|CB|43|189|21|c|-0.2|cab|2
M. Rocha|RB|14|178|38|d|-0.1|vet|3
C.Paulista|LB|6|179|27|c|0.0|vel|3
Cuellar|DH|8|180|33|c|0.3|mar vet|2
Dodi|DH|17|178|30|d|0.1||3
Nardoni|DH|5|175|23|d|0.1||1
Cristaldo|OH|10|175|29|c|0.6|cri bola|1
Pavon|RW|9|169|30|d|0.5|vel dri|2
C.Vinicius|CF|95|190|31|d|0.3|cab fin|3
Jovane|LW|23|180|28|d|0.0|vel|4
""")

TIMES["bahia"] = dict(forca=0.2, formacao="4-3-3B", elenco="""
Ronaldo|GK|1|187|30|d|0.0||3
D. Duarte|CB|4|186|30|d|0.2|cab|3
M. Moreno|CB|3|188|24|c|0.0|cab|2
L. Juba|LB|46|172|27|c|0.6|bola cri|3
M. Victor|RB|2|177|21|d|-0.2|vel|3
Acevedo|DH|5|176|27|d|0.4|mar|1
Jean Lucas|DH|6|183|28|d|0.3||3
R. Nestor|OH|8|174|26|d|0.5|cri|2
Veliz|CF|9|188|23|d|0.3|cab fin|1
K. Olivera|LW|11|170|23|d|0.2|vel dri|2
E. Pulga|RW|16|170|25|d|0.6|vel dri|3
M. Felipe|GK|22|189|30|d|-0.1||2
Kanu|CB|13|188|29|c|0.1|cab|4
G. Xavier|CB|14|186|23|d|-0.2|cab|3
R. Gomez|RB|25|175|29|d|0.0||1
S. Arias|RB|30|177|34|d|0.0|vet|4
C.Alexandr|DH|19|178|27|d|0.3||3
Erick|DH|23|175|24|d|0.0||3
E. Ribeiro|OH|10|174|37|c|0.6|cri vet|2
Cauly|OH|7|168|31|c|0.4|dri cri|2
Ademir|RW|17|163|31|d|0.2|vel|4
W. Jose|CF|12|189|35|d|0.3|cab fin vet|2
""")

TIMES["vasco"] = dict(forca=0.0, formacao="4-3-3B", elenco="""
Leo Jardim|GK|1|187|31|d|0.6||2
Gabriel|CB|4|186|25|d|0.0|cab|3
R. Renan|CB|3|184|22|c|0.2||3
L. Piton|LB|6|177|26|c|0.4|cri|2
P.Henrique|RB|96|178|29|d|0.2|vel|3
Sosa|DH|5|180|26|d|0.1|mar|2
T. Mendes|DH|8|176|34|d|0.3|mar vet|3
Lescano|OH|10|175|25|d|0.3|cri|1
B. Duarte|CF|9|185|30|d|0.1|cab|3
Colidio|LW|11|178|26|d|0.4|dri|1
A. Gomez|RW|7|170|24|c|0.4|vel dri|4
Fuzato|GK|12|191|29|d|-0.3||2
Saldivia|CB|14|186|27|c|0.0|cab|1
Cuesta|CB|15|190|27|d|0.1|cab|4
Puma|RB|2|172|33|d|0.0|vet|1
Cuiabano|LB|16|172|23|c|0.0|vel|3
Jair|DH|17|176|21|d|0.0||3
Barros|DH|20|178|27|d|0.1||3
R. Rique|OH|18|173|23|d|0.0||3
Adson|RW|28|170|25|d|0.1|vel|3
Hinestroza|LW|23|173|23|d|0.3|vel dri|4
Brenner|CF|19|181|26|d|0.1|fin|3
""")

TIMES["santos"] = dict(forca=0.1, formacao="4-4-2A", elenco="""
Diogenes|GK|34|190|26|d|-0.3||2
J. Alencar|CB|33|186|24|d|-0.1|cab|3
Luan Peres|CB|14|185|32|c|0.1||2
Barreal|LB|22|170|29|c|0.2|vel|1
Rodinei|RB|23|176|34|d|0.0|vel vet|3
Oliva|DH|5|175|30|d|0.3|mar|1
Bontempo|LH|21|175|21|d|0.1||2
Coutinho|RH|11|172|34|d|0.9|cri bola vet|2
Neymar|OH|10|175|34|d|2.0|dri cri bola vet|2
Gabigol|CF|9|177|30|c|0.7|fin|3
Cebolinha|CF|7|175|30|d|0.5|vel dri|3
G. Brazao|GK|77|190|26|d|0.2||2
Verissimo|CB|4|187|31|d|0.2|cab|3
Escobar|LB|31|175|29|c|0.0||1
W. Arao|DH|15|184|34|d|0.2|vet|3
J. Schmidt|DH|8|183|33|d|0.2|cri vet|1
G.Henrique|DH|17|178|27|d|0.0||3
Arthur|OH|30|172|30|d|0.5|cri|2
Thaciano|OH|16|180|31|d|0.2||3
Guilherme|LW|28|174|31|d|0.1|vel|3
L. Diaz|CF|19|178|28|d|0.2|vel|1
Vini Lira|RB|42|172|23|d|-0.2||3
""")

TIMES["bragantino"] = dict(forca=0.0, formacao="4-3-3B", elenco="""
Volpi|GK|1|190|36|d|0.3|vet|2
Alix|CB|3|190|24|d|0.2|cab|3
Guzman|CB|5|186|26|d|0.1|cab|1
Capixaba|LB|29|172|29|c|0.3|cri|3
R. Augusto|RB|22|175|21|d|-0.1|vel|3
Fabinho|DH|8|178|32|d|0.2|mar|3
E. Ramires|DH|17|175|26|d|0.3|cri|3
L. Barbosa|OH|10|176|25|d|0.4|dri|2
Sasha|CF|9|180|34|d|0.3|fin vet|2
W. Yan|LW|11|172|21|d|0.2|vel dri|3
Fernando|RW|7|172|25|d|0.2|vel|3
Cleiton|GK|12|190|28|d|0.0||3
P.Henrique|CB|4|183|31|c|0.0||3
G. Marques|CB|14|189|24|d|0.0|cab|3
N. Mendes|RB|2|175|26|d|0.0||3
A. Hurtado|RB|30|173|26|d|0.0|vel|4
Gabriel|DH|6|178|24|d|0.1||3
M.Fernand.|DH|15|178|28|d|0.1||3
Jhon Jhon|OH|20|172|25|c|0.3|cri dri|3
Laquintana|RW|23|170|30|c|0.1|vel|1
Pitta|CF|19|182|26|d|0.2|fin|1
Mosquera|CF|18|178|24|d|0.0|vel|4
""")

TIMES["athletico-pr"] = dict(forca=-0.1, formacao="5-3-2", elenco="""
Mycael|GK|1|190|22|d|0.0||2
Dantas|CB|3|186|26|d|0.0|cab|3
Aguirre|CB|4|187|27|c|0.1|cab|2
A. Dias|CB|44|188|25|d|0.0|cab|3
L. Gustavo|DH|16|187|39|d|0.4|mar vet cri|3
Benavidez|DH|5|178|27|d|0.2|mar|1
Esquivel|LH|6|176|27|c|0.1||1
G. Moraes|RH|2|175|33|d|0.0||3
Vargas|OH|10|174|30|d|0.4|dri cri|2
Viveros|CF|9|182|28|d|0.6|fin|4
Mendoza|CF|11|176|27|d|0.4|vel dri|4
Santos|GK|30|193|36|d|0.2|vet|2
Teran|CB|15|187|30|c|0.1|cab|1
Leo Godoy|RB|22|172|31|d|0.0||2
Felipinho|LB|36|172|21|c|-0.2||3
Jadson|DH|8|178|35|d|0.1|vet|3
Portilla|DH|20|180|28|d|0.1||1
Zapelli|OH|17|176|24|c|0.2|cri|1
Claudinho|OH|23|172|29|d|0.4|cri dri|2
Leozinho|RW|47|170|24|d|0.0|vel|3
Dudu|LW|7|166|34|d|0.4|dri vet baixo|3
Julimar|CF|19|186|30|d|-0.1|cab|3
""")

TIMES["mirassol"] = dict(forca=-0.4, formacao="4-3-3B", elenco="""
Walter|GK|1|191|38|d|0.3|vet|2
J. Victor|CB|3|188|27|d|0.2|cab|3
W. Machado|CB|4|187|32|d|0.1|cab|2
Reinaldo|LB|6|175|36|c|0.6|bola cri vet|3
I. Formiga|RB|2|175|26|d|0.0|vel|3
Neto Moura|DH|5|180|31|d|0.2|mar|3
Denilson|DH|8|177|27|d|0.1||3
Eduardo|OH|10|176|29|d|0.3|cri|2
Andre Luis|CF|9|183|28|d|0.2|fin|3
Alesson|LW|11|172|26|d|0.3|vel dri|3
C. Eduardo|RW|7|172|29|d|0.2|vel|3
A. Muralha|GK|12|188|36|d|-0.2|vet|2
Jemmes|CB|14|187|27|d|0.1|cab|3
B. Santos|DH|15|180|28|d|0.0|mar|3
D. Borges|RB|22|175|29|d|0.0||2
I. Carius|LB|16|177|29|c|0.0||2
Jose Aldo|DH|17|176|31|d|0.0||3
Gabriel|OH|20|175|27|d|0.1||3
Negueba|RW|27|168|30|d|0.3|vel dri|4
E. Carioca|CF|19|183|28|d|0.1|fin|3
Chico|CF|18|188|26|d|0.0|cab|3
Cristian|LW|23|174|25|d|0.0|vel|3
""")

TIMES["vitoria"] = dict(forca=-0.4, formacao="4-3-3B", elenco="""
L. Arcanjo|GK|1|186|27|d|0.3||3
Caca|CB|3|186|27|d|0.1|cab|3
L. Candido|CB|4|187|25|c|0.1|cab|2
Jamerson|LB|6|174|28|c|0.0||3
M. Silva|RB|2|175|25|d|0.0|vel|3
Caique|DH|5|180|24|d|0.0|mar|3
Baralhas|DH|8|178|29|d|0.2||3
Martinez|OH|10|170|28|c|0.4|cri dri|1
Rene|CF|9|180|24|d|0.0|fin|3
Matheuzin|LW|11|172|25|d|0.5|dri cri|3
Erick|RW|7|172|28|d|0.3|vel dri|3
T. Couto|GK|12|188|24|d|-0.2||2
L. Halter|CB|14|187|26|d|0.1|cab|1
Ze Marcos|CB|15|185|29|c|0.0|cab|3
R. Caceres|RB|22|176|26|d|0.0||1
Ramon|LB|16|176|24|c|0.0||3
Ronald|DH|17|175|30|d|0.1|mar|3
W.Oliveira|DH|18|178|33|d|0.0|vet|3
Cantalap.|OH|20|172|26|d|0.1|cri|1
Tarzia|RW|23|170|30|d|0.1|vel|1
R. Kayzer|CF|19|185|30|d|0.2|cab fin|3
R. Lopez|CF|29|180|31|d|0.1|fin|1
""")

TIMES["coritiba"] = dict(forca=-0.5, formacao="4-3-3B", elenco="""
P. Morisco|GK|1|190|21|d|0.1||2
T. Coser|CB|23|186|29|d|0.1|cab|2
Jacy|CB|55|190|31|d|0.0|cab|3
Bruno Melo|LB|26|176|33|c|0.0||3
Tinga|RB|2|175|33|d|0.0|vet|3
T. Santos|DH|21|182|37|d|0.2|mar vet|3
N. Fonseca|DH|5|178|27|d|0.1||2
Josue|OH|10|172|36|d|0.6|cri bola vet|2
P. Rocha|CF|32|180|31|d|0.4|vel fin|3
B. Lopes|LW|77|177|30|d|0.3|vel|3
S. Gomez|RW|19|176|29|d|0.1|cri|1
P. Rangel|GK|12|188|25|d|-0.3||2
R. Moledo|CB|4|190|38|d|0.0|cab vet|1
Maicon|CB|14|185|35|d|0.0|vet|3
Chermont|RB|22|175|28|d|0.0||2
Zeca|LB|16|175|32|c|-0.1||3
Wallisson|DH|8|178|27|d|0.0||3
V.Paulista|DH|17|178|26|d|0.0||3
Frizzo|OH|20|174|28|d|0.1||1
Clayson|LW|11|170|31|d|0.1|vel dri|3
L. Ronier|CF|9|180|21|d|0.3|fin vel|3
G.Coutinho|CF|18|184|26|d|0.0|cab|2
""")

TIMES["remo"] = dict(forca=-0.6, formacao="4-3-3B", elenco="""
M. Rangel|GK|1|192|38|d|0.3|vet|2
Marllon|CB|4|187|34|d|0.1|cab vet|3
Ze Ivaldo|CB|3|186|29|d|0.2|cab|3
Marlon|LB|6|176|29|c|0.0||3
Marcelinho|RB|2|175|28|d|0.0||3
Z.Welisson|DH|5|180|30|d|0.1|mar|3
Picco|DH|8|178|26|d|0.0||1
Patrick|OH|10|175|26|d|0.3|cri|3
Taliari|CF|9|184|27|d|0.2|fin cab|2
Jaja|LW|11|170|29|d|0.3|vel dri|3
D. Braga|RW|7|172|24|d|0.1|vel|3
Leo Lang|GK|12|190|29|d|-0.3||2
Klaus|CB|14|187|27|d|0.0|cab|1
K. Almeida|CB|15|186|23|d|-0.1|cab|3
Jorge|LB|16|175|30|c|0.0||3
Caio V.|DH|17|180|26|d|0.0||3
P. Castro|DH|18|178|32|d|0.0|cri|2
N. Camargo|OH|20|176|25|d|0.0||2
Hernandez|RW|23|172|26|d|0.1|vel|1
N.Ferreira|CF|19|182|26|d|0.0|fin|1
Janderson|CF|29|178|27|d|-0.1|vel|3
Savio|LW|27|172|26|c|-0.1|vel|3
""")

TIMES["chapecoense"] = dict(forca=-0.7, formacao="4-3-3B", elenco="""
Anderson|GK|1|189|33|d|0.1||3
K. Faria|CB|3|187|23|d|0.0|cab|3
E. Doma|CB|4|188|30|d|0.0|cab|3
B. Pacheco|LB|6|176|35|c|0.0|vet|3
B. Tubarao|RB|2|175|25|d|0.0|vel|3
Camilo|DH|5|178|37|d|0.3|cri vet|2
Y. Felipe|DH|8|178|31|d|0.2||3
G. Augusto|OH|10|176|36|d|0.4|cri bola vet|3
Tulio|CF|9|182|26|d|0.1|fin|3
Bolasie|LW|11|188|37|d|0.3|dri for vet|4
Marcinho|RW|7|170|31|d|0.2|vel|3
R. Santos|GK|12|190|30|d|-0.2||2
V. Caetano|CB|14|187|27|d|0.0|cab|3
Joao Paulo|CB|15|186|30|d|-0.1|cab|3
Everton|RB|22|174|29|d|-0.1||3
W. Clar|LB|16|175|29|c|-0.1||1
Carvalhei.|DH|17|178|30|d|0.0||3
J. Jimenez|DH|18|176|27|d|0.0|cri|1
Max Alves|OH|20|174|25|d|0.1||3
N. Pessoa|CF|19|185|32|d|0.1|cab vet|3
Robert|LW|23|172|24|d|0.0|vel|3
Balieiro|RW|27|172|23|d|-0.1|vel|3
""")
