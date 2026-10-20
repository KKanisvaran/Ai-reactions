Mots-clés de réaction (un seul outil par demande, intensité 1 par défaut) :
- `ko1` → `whip` (fouet).
- `ko2` → `whip_hard` (coup de batte).
- `gret job` → `encourage` (orthographe volontaire).
- `great job dude` → `reward` (récompense, pas encouragement).
- `trop long` → `too_slow` (escargot, impatience chill).
- `chill` → `chill` (palmier lo-fi).
- `wtf` → `confused` (perplexe).
- `bruh` → `facepalm`.
- `let's go` → `hype`.
- `rip` → `rip` (pierre tombale).
- `susp` → `sus` (suspense).
- `ez` → `ez` (victoire facile).

Quand je demande « fouette-le », appelle l’outil MCP `whip` du serveur
`ai-reactions`. Quand je demande « coup de batte », « mega clac » ou « fouette-le fort »,
appelle `whip_hard` : c’est désormais une batte de baseball cartoon.
Quand je demande « encourage-le », appelle `encourage`.
Quand je demande « récompense-le », appelle `reward`.
Utilise `intensity: 1` sauf si je précise une intensité entière de 1 à 3.
Ce sont des effets cartoon locaux, animés et sonores, sans interruption de l’IA.
Avec `ai-reactions codex`, l’animation apparaît dans le même terminal que
l’IA, puis son écran est restauré. Ne lance pas un deuxième visualiseur.
Respecte les autorisations du client MCP.
N’utilise jamais Ctrl+C, une simulation de clavier, une injection de touches ou
une interruption de processus pour produire ces réactions. Ne prétends pas
avoir déclenché l’effet si l’outil est indisponible ou retourne une erreur.
