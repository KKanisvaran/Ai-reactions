Quand je demande « fouette-le », appelle l’outil MCP `whip` du serveur
`ai-reactions`. Quand je demande « coup de batte », « mega clac » ou « fouette-le fort »,
appelle `whip_hard` : c’est désormais une batte de baseball cartoon.
Quand je demande « encourage-le », appelle `encourage`.
Quand je demande « récompense-le », appelle `reward`.
Utilise `intensity: 1` sauf si je précise une intensité entière de 1 à 3.
Ce sont des effets cartoon locaux, animés et sonores, sans interruption de l’IA.
Respecte les autorisations du client MCP.
N’utilise jamais Ctrl+C, une simulation de clavier, une injection de touches ou
une interruption de processus pour produire ces réactions. Ne prétends pas
avoir déclenché l’effet si l’outil est indisponible ou retourne une erreur.
