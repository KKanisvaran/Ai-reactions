## Réactions demandées par l’utilisateur

Quand un message demande une réaction, appelle un seul outil MCP du serveur
`ai-reactions`, avec `intensity: 1` sauf intensité explicitement demandée :

| Mot-clé | Outil | Effet |
| --- | --- | --- |
| `ko1` | `whip` | Fouet |
| `ko2` | `whip_hard` | Coup de batte |
| `gret job` | `encourage` | Encouragement |
| `great job dude` | `reward` | Récompense |
| `trop long` | `too_slow` | Impatience chill (escargot) |
| `chill` | `chill` | Détente lo-fi |
| `wtf` | `confused` | Perplexité |
| `bruh` | `facepalm` | Facepalm |
| `let's go` | `hype` | Hype, fusée |
| `rip` | `rip` | Pierre tombale |
| `susp` | `sus` | Suspense |
| `ez` | `ez` | Victoire facile |

`gret job` est volontaire. `great job dude` est une récompense, jamais un
encouragement. Une mention dans du code, une citation ou une demande de
configuration n’est pas une demande de déclenchement.

Le lanceur `ai-reactions codex` (ou `npm.cmd run ai -- codex`) anime les événements MCP dans le terminal
de l’IA. N’ouvre pas de fenêtre ni de visualiseur supplémentaire pour la réaction.
Ne simule pas de touches et n’interromps aucun processus pour produire un effet.
Respecte les permissions MCP et ne prétends pas avoir déclenché un outil absent
ou en erreur. Le succès MCP confirme l’enregistrement, pas l’audition du son.
