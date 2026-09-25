# ai-reactions

**Toutes les animations s’affichent dans le terminal** : fouet, batte de baseball,
encouragements et récompense. Le rendu est en ASCII animé, avec sons synthétisés
sous Windows. Aucun overlay, aucune fenêtre graphique, aucun téléchargement d’asset.

Les IA appellent directement un serveur MCP TypeScript en `stdio`. Aucune
simulation de clavier, injection de touches ou interruption du processus de l’IA.
Pas de Ctrl+C nécessaire : démo et visualiseur se terminent automatiquement.

## Installation et essai

Prérequis : Node.js **24 LTS** et npm. Sous Windows, le son utilise Windows
PowerShell 5.1 et `System.Media.SoundPlayer`, fournis par Windows. Aucun package
npm natif, WPF ou clé API nécessaire. Aucune requête réseau après installation.

Depuis le dépôt, dans PowerShell :

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run demo
```

La démo appelle les quatre outils via un vrai client MCP et joue les animations
dans **ce terminal**, avec son, puis termine. Pour un seul effet :

```powershell
npm.cmd run demo -- whip
npm.cmd run demo -- whip_hard
npm.cmd run demo -- encourage
npm.cmd run demo -- reward
```

Le terminal doit être interactif et mesurer au moins **61 colonnes et 16 lignes**.
Une sortie capturée par une IA, un fichier ou un pipeline reçoit une image fixe
sans commandes de curseur. Le moteur ne lit pas le clavier et ne vide pas l’écran :
il anime seulement son propre bloc de 13 lignes. Un redimensionnement trop petit
arrête les déplacements de curseur.

## Réactions déclenchées par une IA

Codex, Claude et Gemini possèdent leur propre interface. MCP ne permet pas
d’imposer une animation à l’intérieur de cette interface. Le serveur ne tente
jamais de dessiner par-dessus son écran, même si son stderr est un terminal.

Dans un **volet terminal**, à côté de l’IA, lancer le visualiseur :

```powershell
npm.cmd run watch -- --seconds 300
```

Chaque nouvelle réaction MCP s’anime dans ce volet, avec son son. Les anciennes
réactions ne sont pas rejouées. Le visualiseur finit l’effet en cours et s’arrête
à l’échéance : 60 secondes par défaut, durée réglable de 1 à 3600 secondes.
L’IA continue à fonctionner normalement. Aucun programme n’ouvre de fenêtre.

Le serveur enregistre la réaction dans un journal local et retourne aussi une
image ASCII fixe dans le résultat MCP. Le succès confirme l’enregistrement, pas
qu’un visualiseur est ouvert ou que l’utilisateur a entendu le son.

Plusieurs IA peuvent alimenter le même visualiseur. Utiliser un seul visualiseur
par journal pour éviter de doubler les sons. Utiliser la démo seule pour essayer,
le visualiseur pour recevoir les appels des IA.

## Outils

| Outil | Demande à l’IA | Réaction |
| --- | --- | --- |
| `whip` | `fouette-le` | Fouet et claquement |
| `whip_hard` | `coup de batte`, `mega clac`, `fouette-le fort` | Batte de baseball cartoon et impact en bois |
| `encourage` | `encourage-le` | Robot souriant, étoiles et notes positives |
| `reward` | `récompense-le` | Trophée, confettis, XP et son de victoire |

Tous acceptent `{ "intensity": 1 }`, avec un entier de **1 à 3**, défaut **1**.
L’intensité change impacts, particules et durée (2,65 à 3,45 secondes). Le nom MCP
`whip_hard` est conservé pour compatibilité ; son effet est désormais une batte.

Fractions, chaînes, valeurs nulles, paramètres inconnus et valeurs hors limites
sont refusés avant tout effet. Le succès contient `content` et `structuredContent`
avec `id`, `timestamp`, `reaction`, `intensity`, `message`. Les erreurs retournent
`isError: true` sans arrêter le serveur. Chaque appel produit un nouvel événement :
ne pas rejouer automatiquement une requête dont la réponse a été perdue.

Les descriptions MCP expliquent les demandes françaises. Pour expliciter ce
comportement, ajouter [`examples/agent-instructions.md`](examples/agent-instructions.md)
à `AGENTS.md`, `CLAUDE.md` ou `GEMINI.md`. Les permissions du client s’appliquent.

## Commandes

| Commande | Usage |
| --- | --- |
| `npm.cmd run dev` | Serveur MCP depuis TypeScript, support natif Node |
| `npm.cmd run build` | Compilation dans `dist/` |
| `npm.cmd start` | Serveur MCP compilé ; attend son client |
| `npm.cmd test` | Build et tests du moteur, de MCP et du visualiseur |
| `npm.cmd run demo` | Les quatre animations terminal, puis sortie automatique |
| `npm.cmd run demo:terminal` | Alias de la même démo |
| `npm.cmd run watch -- --seconds 300` | Anime les nouvelles réactions pendant cinq minutes |
| `npm.cmd run reactions` | Affiche les 20 dernières entrées du journal |

Construire avant les scripts CLI. `npm.cmd` évite les restrictions sur `npm.ps1`.
Configurer les clients MCP avec **node et un chemin absolu**, pas `npm start`
dont les bannières peuvent polluer stdout. Le serveur quitte naturellement
quand le client ferme son entrée standard ; il ne reçoit pas de texte libre.

## Codex CLI

Après le build, depuis le dépôt :

```powershell
$reactionNode = (Get-Command node).Source
$reactionServer = (Resolve-Path .\dist\index.js).Path
codex mcp add ai-reactions -- $reactionNode $reactionServer
codex mcp get ai-reactions
```

Ou fusionner dans `~/.codex/config.toml` en adaptant le chemin :

```toml
[mcp_servers.ai-reactions]
command = "node"
args = ["C:/chemin/ai-reactions/dist/index.js"]
```

Exemple : [`examples/codex.toml`](examples/codex.toml). Utiliser la prochaine
session ou le mécanisme de rechargement MCP du client.

## Claude Code

```powershell
$reactionNode = (Get-Command node).Source
$reactionServer = (Resolve-Path .\dist\index.js).Path
claude mcp add --transport stdio --scope local ai-reactions -- $reactionNode $reactionServer
claude mcp get ai-reactions
```

La portée `local` concerne le projet courant ; `project` crée `.mcp.json`.
Structure dans [`examples/claude.mcp.json`](examples/claude.mcp.json).
La commande `/mcp` de Claude permet d’inspecter les outils.

## Gemini CLI

```powershell
$reactionNode = (Get-Command node).Source
$reactionServer = (Resolve-Path .\dist\index.js).Path
gemini mcp add --transport stdio --scope project ai-reactions $reactionNode $reactionServer
gemini mcp list
```

Ou fusionner [`examples/gemini.settings.json`](examples/gemini.settings.json)
dans `.gemini/settings.json`, en adaptant le chemin :

```json
{
  "mcpServers": {
    "ai-reactions": {
      "command": "node",
      "args": ["C:/chemin/ai-reactions/dist/index.js"]
    }
  }
}
```

Dans Gemini, `/mcp` affiche les outils. Gemini n’était pas installé dans
l’environnement de validation ; sa configuration suit la documentation officielle.

## Réglages

| Variable | Défaut | Usage |
| --- | --- | --- |
| `AI_REACTIONS_EFFECTS` | `terminal` | `terminal` : rendu CLI ; `text` : journal et messages seuls |
| `AI_REACTIONS_SOUND` | `1` | `0` coupe le son, conserve les animations |
| `AI_REACTIONS_VOLUME` | `0.3` | Entre 0 et 1 ; ne modifie pas le volume Windows |
| `AI_REACTIONS_LOG` | `.local/reactions.jsonl` | Chemin absolu du journal partagé |

Le mode `windows` a été retiré : supprimer une ancienne variable définie à cette
valeur ou la remplacer par `terminal`. Le helper PowerShell joue uniquement du
son, console masquée, sans API de fenêtre. L’audio dépend de la sortie Windows ;
les autres systèmes restent silencieux.

Pour couper le son dans le terminal de la démo ou du visualiseur :

```powershell
$env:AI_REACTIONS_SOUND = '0'
npm.cmd run demo
Remove-Item Env:\AI_REACTIONS_SOUND
```

Le journal se trouve dans **ce dépôt**, indépendamment du dossier de l’IA. Si
`AI_REACTIONS_LOG` est personnalisé, utiliser le même chemin pour serveur et
visualiseur. Les variables du serveur vont dans son objet MCP `env` (ou
`[mcp_servers.ai-reactions.env]` pour Codex), celles du visualiseur dans son terminal.
Le serveur ne transmet pas ses réglages audio au visualiseur.

Le journal contient uniquement les réactions, pas les conversations. Il s’accumule
et peut être archivé entre sessions. Le lecteur utilise des blocs bornés, attend
les lignes UTF-8/JSON complètes et ignore les événements malformés. Le journal,
les secrets `.env`, `node_modules` et `dist` sont ignorés par Git.

## Architecture et extension

```text
Codex / Claude / Gemini
        │ MCP stdio
        ▼
  Server → ReactionEngine → journal JSONL
        │                       │
        │ résultat ASCII fixe   ▼
        └───────────────── npm run watch
                           ├─ animation dans son terminal
                           └─ audio Windows sans fenêtre

npm run demo → client MCP → même moteur de rendu terminal
```

| Fichier | Responsabilité |
| --- | --- |
| `src/index.ts`, `src/server.ts` | Transport MCP, schémas, résultats et erreurs |
| `src/reactions.ts` | Définitions des réactions et moteur |
| `src/local-output.ts` | Journal et diagnostics stderr |
| `src/terminal-animation.ts` | Animations ASCII et repli statique |
| `src/terminal-output.ts` | Sortie par défaut et lecture audio |
| `src/sound.ts`, `windows/audio.ps1` | Synthèse WAV originale et lecteur sans fenêtre |
| `src/journal-reader.ts`, `scripts/watch.mjs` | Réception des événements et visualiseur |
| `scripts/client.mjs`, `scripts/demo.mjs` | Démonstration avec client MCP officiel |

stdout du serveur est réservé à MCP. stderr ne reçoit jamais de commandes de
curseur ; les CLI de rendu possèdent leur propre stdout. Le WAV arrive au helper
audio via stdin, sans interpolation shell. Sa limite de 10 secondes concerne
uniquement ce helper, jamais le processus de l’IA.

Pour ajouter une réaction, étendre registre, schéma du journal, rendu et son.
Pour une autre sortie, implémenter `ReactionOutput.emit(event)`. SDK officiel
MCP v2.1.0, Zod et TypeScript 6 ; aucune nouvelle dépendance npm native.
Le verrouillage npm assure l’installation reproductible avec `npm ci`.

## Tests et dépannage

Les tests vérifient les quatre outils MCP, toutes les intensités, les entrées
invalides, les erreurs et reprises, la concurrence, les WAV, le rendu dans un
flux TTY contrôlé, le repli statique sans ANSI, les lignes partielles UTF-8/JSON,
la rotation du journal et un visualiseur recevant les quatre appels MCP réels
avant sa sortie normale. Aucun compte IA ou appel de modèle payant nécessaire.

Runtime local vérifié : Node 24.14.0 sous Windows. Pour installer Node, prendre
le dernier correctif de Node 24 LTS. Module manquant : `npm.cmd ci` puis
`npm.cmd run build`. Image fixe : lancer directement dans un terminal assez
grand, sans pipeline ni capture. Réaction MCP invisible : vérifier que le
visualiseur écoute encore et lit le même journal. Son absent : vérifier les
réglages du visualiseur, le volume et la sortie audio Windows.

## Licence et sources

Licence ISC conservée, voir [LICENSE](LICENSE). Dessins et sons originaux ; aucun
code ou asset GoodClaude copié. Les dépendances gardent leurs licences.

- [Node.js : versions et support](https://nodejs.org/en/about/previous-releases)
- [SDK MCP officiel](https://github.com/modelcontextprotocol/typescript-sdk)
- [Serveur MCP stdio](https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server)
- [MCP Codex](https://developers.openai.com/codex/mcp/)
- [MCP Claude Code](https://code.claude.com/docs/en/mcp)
- [MCP Gemini CLI](https://geminicli.com/docs/tools/mcp-server/)
- [SoundPlayer](https://learn.microsoft.com/en-us/dotnet/api/system.media.soundplayer)
