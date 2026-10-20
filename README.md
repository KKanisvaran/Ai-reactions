# ai-reactions

**Des réactions animées et sonores directement dans le terminal de ton IA**
(Codex, Claude Code, Gemini CLI) : fouet, batte de baseball, encouragements,
récompense, et des réactions plus chill (escargot « trop long », palmier lo-fi,
facepalm, pierre tombale…). Rendu ASCII animé, sons synthétisés à la volée.
Aucun overlay, aucune fenêtre graphique, aucun téléchargement d’asset.

Les IA appellent un serveur MCP en `stdio`. Aucune simulation de clavier,
injection de touches ou interruption du processus de l’IA.

## Installation (CLI)

Prérequis : **Node.js 24** ou plus récent, et l’IA de ton choix déjà installée.

```sh
git clone https://github.com/KKanisvaran/Ai-reactions.git
npm install -g --install-links --allow-scripts=node-pty ./Ai-reactions
ai-reactions setup        # enregistre le serveur MCP dans codex, claude et gemini s’ils sont installés
ai-reactions codex        # lance Codex avec les animations (ou : ai-reactions claude / gemini)
```

Dépôt public, sans clone : `npm install -g --allow-scripts=node-pty
https://github.com/KKanisvaran/Ai-reactions/archive/refs/heads/main.tar.gz`.
Éviter `npm install -g github:…` : npm 11 échoue sur ce type d’installation globale.

`setup` peut viser un seul client : `ai-reactions setup claude`. Il enregistre le
serveur pour l’utilisateur, donc dans tous les projets. S’il est déjà enregistré,
lancer `codex mcp remove ai-reactions` (ou `claude` / `gemini`) puis relancer.

À la fin de `setup` et au premier lancement, une intro **KK LAB** présente le
tigre et les mots-clés à taper dans le chat. Pour la revoir : `ai-reactions intro`.

Pour essayer sans IA : `ai-reactions demo` (ou `ai-reactions demo chill rip`).
`ai-reactions --help` liste toutes les commandes. Désinstallation :
`npm uninstall -g ai-reactions`.

| Système | Animations | Son | Notes |
| --- | --- | --- | --- |
| Windows 10 1809+ / 11 | Oui | Oui (PowerShell, intégré) | Binaires `node-pty` précompilés |
| macOS | Oui | Oui (`afplay`, intégré) | Binaires `node-pty` précompilés |
| Linux | Oui | Si `paplay` ou `aplay` est présent | `node-pty` est compilé : `python3`, `make`, `g++` requis |

Les anciennes versions de npm n’ont pas l’option `--allow-scripts` : l’enlever.
Sans son lecteur audio, l’effet reste simplement muet.

## Depuis le dépôt (développement)

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run demo
npm.cmd run ai -- codex
```

`npm link` installe la commande `ai-reactions` depuis ta copie locale. `dist/` est
versionné pour que l’installation depuis GitHub n’ait rien à compiler : après une
modification de `src/`, lancer `npm.cmd run build` et commiter `dist/` avec.

Le terminal doit être interactif et mesurer au moins **61 colonnes et 16 lignes**.
Une sortie capturée par une IA, un fichier ou un pipeline reçoit une image fixe
sans commandes de curseur. Le moteur ne lit pas le clavier et ne vide pas l’écran :
il anime seulement son propre bloc de 13 lignes. Un redimensionnement trop petit
arrête les déplacements de curseur.

## Réactions déclenchées par une IA

Lance **l’IA avec le lanceur** :

```sh
ai-reactions codex
```

Puis envoie un de ces messages dans le chat :

| Mot-clé | Réaction |
| --- | --- |
| `clac` | Fouet |
| `bonk` | Coup de batte |
| `bien joué` | Encouragement |
| `gg` | Récompense |
| `trop long` | Escargot, sablier et tic-tac (« ça traîne… ») |
| `chill` | Lunettes de soleil, palmier, notes de musique et accord lo-fi |
| `wtf` | Points d’interrogation et « hein ? » montant |
| `bruh` | Facepalm et trombone triste |
| `let's go` | Fusée qui décolle et fanfare montante |
| `rip` | Pierre tombale cartoon et orgue mélancolique |
| `susp` | Suspense : regard suspicieux et deux notes graves |
| `ez` | Victoire trop facile et petit « ding » |

L’IA appelle l’outil MCP correspondant. L’animation complète et son son sont
joués **dans le même terminal**, puis l’écran de l’IA est restauré avec ses
derniers messages. Elle continue à travailler pendant l’effet. Les touches
réellement saisies sont transmises à l’IA ; aucune touche n’est fabriquée pour
déclencher une réaction. Quitte l’IA normalement pour fermer aussi le lanceur.
La compilation est automatique au lancement. Les arguments après `codex` sont
transmis au client. `claude` et `gemini` sont également acceptés si installés et
configurés avec ce serveur MCP (voir plus bas).

Le lanceur possède le terminal physique et héberge le client dans un
pseudo-terminal. Son écran virtuel conserve couleurs, Unicode, curseur et
écran alternatif. Un terminal d’au moins **61 colonnes et 16 lignes** est requis
pour l’animation complète ; en dessous, le moteur utilise une image fixe.
Le défilement natif du terminal ne donne pas accès à l’historique de l’écran
virtuel : utilise la navigation du client IA.

Une session déjà lancée sans ce lanceur ne peut pas être reprise à chaud.
Cela concerne les **CLI dans un terminal**, pas la fenêtre graphique de Codex.
MCP seul renvoie une image fixe ; il ne peut pas animer l’interface du client.
Le serveur MCP garde stdout réservé au protocole.

### Visualiseur séparé (facultatif)

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

Plusieurs IA peuvent alimenter le même journal. Utiliser un seul lanceur ou
visualiseur par journal pour éviter les animations et sons en double. Ne lance
pas `watch` en même temps que `ai`. Pour des sessions indépendantes, configure
`AI_REACTIONS_LOG` avec le même chemin absolu dans le serveur et son lanceur.

## Outils

| Outil | Demande à l’IA | Réaction |
| --- | --- | --- |
| `whip` | `clac`, `fouette-le` | Fouet et claquement |
| `whip_hard` | `bonk`, `coup de batte`, `mega clac`, `fouette-le fort` | Batte de baseball cartoon et impact en bois |
| `encourage` | `bien joué`, `encourage-le` | Robot souriant, étoiles et notes positives |
| `reward` | `gg`, `récompense-le` | Trophée, confettis, XP et son de victoire |
| `too_slow` | `trop long`, `ça traîne` | Escargot, sablier et tic-tac d’horloge |
| `chill` | `chill`, `tranquille`, `relax` | Lunettes de soleil, palmier et accord lo-fi |
| `confused` | `wtf`, `hein ?` | Points d’interrogation et glissando « huh ? » |
| `facepalm` | `bruh`, `sérieux ?` | Facepalm et trombone triste |
| `hype` | `let's go`, `go go go` | Fusée, étincelles et fanfare montante |
| `rip` | `rip`, `c’est mort` | Pierre tombale et orgue mélancolique |
| `sus` | `susp`, `louche` | Regard suspicieux et notes de suspense |
| `ez` | `ez`, `trop facile` | Victoire tranquille et « ding » |

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
| `ai-reactions setup [client]` | Enregistre le serveur MCP dans codex, claude, gemini |
| `ai-reactions codex` | Lance l’IA avec les animations (aussi `claude`, `gemini`) |
| `ai-reactions intro` | Intro KK LAB : tigre et mots-clés |
| `ai-reactions demo [réactions]` | Animations sans IA |
| `ai-reactions watch` | Visualiseur séparé |
| `ai-reactions serve` | Serveur MCP sur stdio |
| `npm.cmd run ai -- codex` | Compile et lance Codex avec les animations dans le même terminal |
| `npm.cmd run ai -- claude` | Même lanceur pour Claude Code configuré avec MCP |
| `npm.cmd run dev` | Serveur MCP depuis TypeScript, support natif Node |
| `npm.cmd run build` | Compilation dans `dist/` |
| `npm.cmd start` | Serveur MCP compilé ; attend son client |
| `npm.cmd test` | Build et tests du moteur, de MCP et du visualiseur |
| `npm.cmd run demo` | Les douze animations terminal, puis sortie automatique |
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
| `AI_REACTIONS_INTRO` | `1` | `0` désactive l’intro du premier lancement |
| `AI_REACTIONS_VOLUME` | `0.3` | Entre 0 et 1 ; ne modifie pas le volume Windows |
| `AI_REACTIONS_LOG` | `~/.ai-reactions/reactions.jsonl` | Chemin absolu du journal partagé |

Le mode `windows` a été retiré : supprimer une ancienne variable définie à cette
valeur ou la remplacer par `terminal`. Le helper PowerShell joue uniquement du
son, console masquée, sans API de fenêtre. Sous macOS le son passe par `afplay`,
sous Linux par `paplay` puis `aplay` ; un lecteur absent rend l’effet muet.

Pour couper le son dans le terminal de la démo ou du visualiseur :

```powershell
$env:AI_REACTIONS_SOUND = '0'
npm.cmd run demo
Remove-Item Env:\AI_REACTIONS_SOUND
```

Le journal se trouve dans `~/.ai-reactions/` (dossier utilisateur), indépendamment
du dossier de l’IA et du dossier d’installation. Si
`AI_REACTIONS_LOG` est personnalisé, utiliser le même chemin pour serveur et
visualiseur. Les variables du serveur vont dans son objet MCP `env` (ou
`[mcp_servers.ai-reactions.env]` pour Codex), celles du visualiseur dans son terminal.
Le serveur ne transmet pas ses réglages audio au visualiseur ou au lanceur.

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
| `src/journal-reader.ts`, `scripts/watch.mjs` | Réception des événements et visualiseur séparé |
| `src/session-terminal.ts`, `scripts/session.mjs` | Écran virtuel et lanceur de l’IA dans le terminal partagé |
| `scripts/client.mjs`, `scripts/demo.mjs` | Démonstration avec client MCP officiel |

stdout du serveur est réservé à MCP. stderr ne reçoit jamais de commandes de
curseur ; les CLI de rendu possèdent leur propre stdout. Le WAV arrive au helper
audio via stdin, sans interpolation shell. Sa limite de 10 secondes concerne
uniquement ce helper, jamais le processus de l’IA.

Pour ajouter une réaction, étendre registre, schéma du journal, rendu et son.
Pour une autre sortie, implémenter `ReactionOutput.emit(event)`. SDK officiel
MCP v2.1.0, Zod et TypeScript 6 ; `node-pty` et `@xterm/headless` pour le lanceur.
Le verrouillage npm assure l’installation reproductible avec `npm ci`.

## Tests et dépannage

Les tests vérifient les douze outils MCP, toutes les intensités, les entrées
invalides, les erreurs et reprises, la concurrence, les WAV, le rendu dans un
flux TTY contrôlé, le repli statique sans ANSI, les lignes partielles UTF-8/JSON,
la rotation du journal et un visualiseur recevant les quatre appels MCP réels
avant sa sortie normale. Le test du lanceur utilise un vrai pseudo-terminal,
les quatre appels MCP et un client de test qui continue à écrire pendant les
animations ; il vérifie la transmission d’entrée et la fermeture de la session.
Aucun compte IA ou appel de modèle payant nécessaire aux tests.

Runtime local vérifié : Node 24.14.0 sous Windows, installation globale
depuis l’archive npm comprise. macOS et Linux suivent la même logique mais
n’ont pas été testés sur machine réelle. Pour installer Node, prendre
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
