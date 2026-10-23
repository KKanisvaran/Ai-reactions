# ai-reactions · KK LAB

**Un pingouin qui vit sous ton IA.** Lance Codex, Claude Code ou Gemini CLI avec
`ai-reactions` : un petit pingouin en pixel art s’installe sur sa banquise, en
bas du terminal, sous un ciel étoilé, et réagit tout seul à ce que fait l’IA. Il bosse avec elle, prend un
café sur les longues tâches, fête la fin, se cache les yeux quand tu
l’interromps, part pêcher quand tout est calme. Aucun mot-clé à retenir, et rien
ne vient interrompre ni recouvrir l’IA.

> **Projet 100 % pour le fun.** Ça ne sert à rien, c’est un peu débile, et c’est
> exactement le but : rendre le code avec une IA un peu plus drôle.

![Intro KK LAB : le tigre KK LAB et son petit mot](docs/kk-lab-intro.png)

```text
+----------------------------------------------------------+
| BOOP / SUR LE NEZ !  [2/3]                               |
|                             ♥    o    ♥ * BOOP! *        |
|                      _____    .-----.                    |
|                     (_____)--o| >w< |                    |
|                               +-----+                    |
|                              \| AI |/                    |
|                                /   \                     |
| ============================================             |
+----------------------------------------------------------+
```

- **12 réactions**, du `boop` sur le nez au `chill` lo-fi, chacune en 3 intensités.
- **Sons synthétisés à la volée** : aucun fichier audio, rien de téléchargé.
- **Tout seul** : les réactions se déclenchent d’après l’écran de l’IA, sans
  mot-clé ni prompt à envoyer.
- **En bas, jamais par-dessus** : le bandeau vit sous l’IA, qui reste visible et
  utilisable pendant chaque animation. Sans fenêtre ni overlay.
- **Protocole standard** : un serveur [MCP](https://modelcontextprotocol.io) local,
  compatible avec tous les clients qui le supportent.

## Installation

Prérequis : **Node.js 24+** et une IA en ligne de commande (Codex, Claude Code ou Gemini CLI).

```sh
npm install -g --allow-scripts=node-pty https://github.com/KKanisvaran/Ai-reactions/archive/refs/heads/main.tar.gz
ai-reactions setup     # enregistre le serveur MCP dans les IA installées, puis présente les mots-clés
ai-reactions codex     # lance Codex avec les animations (ou : ai-reactions claude / gemini)
```

Sans npm récent, retire `--allow-scripts=node-pty`. Autre méthode : `git clone`
du dépôt puis `npm install -g --install-links ./Ai-reactions`.

| Système | Animations | Son |
| --- | --- | --- |
| Windows 10 1809+ / 11 | Oui | Oui, via PowerShell (intégré) |
| macOS | Oui | Oui, via `afplay` (intégré) |
| Linux | Oui | Si `paplay` ou `aplay` est installé. `node-pty` se compile : `python3`, `make`, `g++` |

Désinstallation : `npm uninstall -g ai-reactions`.

## Ce qui fait réagir le pingouin

| Ce que fait l’IA | Réaction dans le bandeau |
| --- | --- |
| Elle se met au travail | Le pingouin glisse jusqu’à son ordi, puis s’y concentre, avec un coup d’œil de temps en temps |
| Plus de 45 s de travail | Pause café |
| Plus de 2 min 30 | L’escargot : ça traîne |
| Elle a fini, en 15 à 40 s | EZ |
| Elle a fini, en 40 s à 2 min | Encouragement ou fusée |
| Elle a fini, après plus de 2 min | Trophée et XP |
| Elle attend ton feu vert (permission) | Regard suspicieux |
| Tu l’interromps | Facepalm |
| Erreur d’API | Pierre tombale |
| 5 min sans activité | Lunettes de soleil et lo-fi, puis il part pêcher et finit par s’endormir |
| Tu reviens taper | Boop, il se réveille |
| Tout est calme | Il cligne des yeux et regarde autour de lui ; une mouette, un poisson qui saute ou une étoile filante passe le voir |

Les réactions sont en pixel art, dans le décor : cœurs, tasse fumante, escargot,
palmier, trophée, fusée, pierre tombale… Seule leur légende est du texte.

La molette de la souris fait défiler l’historique de l’IA, comme une page ;
n’importe quelle touche ramène l’écran en direct. Pour sélectionner du texte,
maintiens Maj en glissant.

Le lancement commence par l’intro KK LAB : le tigre se dessine, avec son petit
mot. Puis le pingouin se dessine à son tour dans le bandeau, contour d’abord. Ses
12 poses viennent pixel pour pixel de sa planche de dessin. Les réactions
automatiques sont silencieuses.

### Bonus : les mots-clés

Tu peux aussi demander une réaction à l’IA en tapant son mot-clé dans le chat.
L’IA appelle l’outil MCP et l’animation se joue dans le bandeau, avec son.
Demande « intensité 2 » ou « intensité 3 » pour un effet plus long et plus intense.

| Mot-clé | Effet | Son |
| --- | --- | --- |
| `boop` | Petit boop sur le nez de l’IA, cœurs | « Boop » mignon |
| `café` | Pause café, l’IA se réveille d’un coup | Gorgée puis arpège plein d’énergie |
| `bien joué` | Encouragement, étoiles | Arpège positif |
| `gg` | Trophée et XP | Fanfare de victoire |
| `trop long` | Escargot, sablier, l’IA somnole | Tic-tac d’horloge |
| `chill` | Lunettes de soleil, palmier | Accord lo-fi |
| `wtf` | L’IA perplexe, points d’interrogation | « Hein ? » montant |
| `bruh` | Facepalm | Trombone triste |
| `let's go` | Fusée qui décolle | Fanfare montante |
| `rip` | Pierre tombale | Orgue mélancolique |
| `susp` | Regard suspicieux (suspense) | Deux notes graves |
| `ez` | Victoire trop facile | Petit « ding » |

`ai-reactions intro` remontre cette liste avec l’intro KK LAB.
`ai-reactions demo gg rip` joue des effets sans IA.

## Comment ce projet est né

Tout part d’un réflexe qu’on a tous en codant avec une IA : on lui parle comme à
un coéquipier. On s’impatiente quand elle tourne en rond, on la félicite quand
elle trouve enfin le bug. Mais elle ne voit rien de tout ça, et l’échange reste
un mur de texte.

En septembre 2026, j’ai voulu rendre ces moments **visibles et drôles** sans
casser le flux de travail. La première version tenait en quatre réactions,
taquineries et encouragements, jouées dans une fenêtre à part. Deux contraintes
ont façonné la suite :

1. **Rester dans le terminal de l’IA.** Le protocole MCP permet à l’IA d’appeler
   un outil, mais pas de dessiner dans sa propre interface. La solution : un
   lanceur qui héberge l’IA dans un pseudo-terminal avec un écran virtuel. Il
   peut ainsi jouer l’animation par-dessus, puis restaurer l’écran à l’identique.
2. **Ne jamais toucher à l’IA.** Pas de touches simulées, pas d’interruption de
   processus : l’IA continue de travailler pendant l’effet.

La version 2 retire la dernière friction : taper un mot-clé, c’est envoyer un
prompt à l’IA. Un pingouin vit désormais dans un bandeau sous l’IA, lit son
écran en mémoire et réagit tout seul, sans jamais la recouvrir.

Les réactions sont ensuite devenues plus variées et plus chill (`trop long`,
`chill`, `bruh`…). Puis le projet est devenu une vraie CLI installable, avec
l’identité **KK LAB** et son tigre en intro.

## Comment ça marche

```text
  toi
   │  « gg »
   ▼
  l’IA (Codex, Claude, Gemini)
   │  « oh, merci ! » et appelle l’outil MCP reward
   ▼
  serveur ai-reactions
   │  note la réaction dans son carnet (~/.ai-reactions/*.jsonl)
   ▼
  lanceur ai-reactions
   │  voit la note et joue l’anim dans le bandeau, sous l’IA
   ▼
  ╭──────────────────────╮
  │  \o/  +XP  ta-da-da! │   ♪ fanfare
  ╰──────────────────────╯
   │
   ▼
  l’IA reprend son taf, tranquille ~
```

- **Serveur MCP** (`src/server.ts`, `src/reactions.ts`) : expose 12 outils sur
  stdio, valide chaque appel et écrit l’événement dans un journal local.
- **Lanceur** (`scripts/session.mjs`, `src/session-terminal.ts`) : lance l’IA dans
  un pseudo-terminal `node-pty`, garde une copie de son écran avec
  `@xterm/headless`, et réserve le bas du terminal au bandeau.
- **Bandeau** (`src/ambient.ts`, `src/penguin.ts`, `src/decor.ts`, `src/scenes.ts`) :
  10 lignes sous l’IA, le pingouin en pixel art (une pose par état) dans sa nuit polaire :
  ciel en dégradé, étoiles qui scintillent, lune, montagnes, mer qui miroite,
  banquise, bonhomme de neige et petite neige. Il déduit l’activité de l’IA de
  l’écran virtuel (« esc to interrupt », demandes de permission, interruptions),
  en mémoire uniquement, et y joue toutes les réactions.
- **Rendu et son** (`src/terminal-animation.ts`, `src/sound.ts`) : images ASCII
  générées image par image, sons WAV synthétisés mathématiquement.
- **Intro** (`src/intro.ts`, `src/mascot-render.ts`, `src/mascot-image.ts`) : à
  chaque lancement, la mascotte KK LAB se dessine au centre d’après son SVG, avec
  son petit mot en dessous ; au premier lancement, la liste des mots-clés suit.
  Dans un terminal compatible Sixel (Windows Terminal 1.22+, WezTerm, iTerm2),
  l’image elle-même remplace le dessin ; ailleurs, dont le terminal de VS Code
  sous Windows, le tigre reste en demi-blocs Unicode truecolor.

## Commandes

| Commande | Rôle |
| --- | --- |
| `ai-reactions setup [codex\|claude\|gemini]` | Enregistre le serveur MCP (tous les clients installés par défaut) |
| `ai-reactions codex [args]` | Lance l’IA avec les animations, aussi `claude` et `gemini` |
| `ai-reactions intro` | Intro KK LAB et liste des mots-clés |
| `ai-reactions demo [mots-clés]` | Joue des effets sans IA |
| `ai-reactions watch` | Visualiseur séparé, dans un autre volet de terminal |
| `ai-reactions serve` | Serveur MCP sur stdio, pour une configuration manuelle |

Configuration manuelle d’un client MCP : commande `node`, argument
`<dossier d’installation>/dist/index.js`. Voir les exemples dans [`examples/`](examples/).

## Réglages

| Variable | Défaut | Effet |
| --- | --- | --- |
| `AI_REACTIONS_SOUND` | `1` | `0` coupe le son |
| `AI_REACTIONS_VOLUME` | `0.3` | Volume de 0 à 1 |
| `AI_REACTIONS_INTRO` | `1` | `0` désactive l’intro du lancement |
| `AI_REACTIONS_AMBIENT` | `1` | `0` retire le pingouin sous l’IA |
| `AI_REACTIONS_EFFECTS` | `terminal` | `text` : journal et messages seuls |
| `AI_REACTIONS_LOG` | `~/.ai-reactions/reactions.jsonl` | Chemin absolu du journal |

Le bandeau fait toujours 10 lignes : comme une image sur une page web, le
pingouin garde sa taille et seul le décor suit la largeur du terminal (le
bonhomme de neige apparaît à partir de 100 colonnes, les scènes sont coupées au
bord quand la place manque). Il demande au moins 40 × 18 caractères. En dessous, l’IA garde tout
l’écran et une réaction MCP s’affiche en plein écran le temps de l’effet
(61 × 16 minimum). L’intro s’adapte au terminal : 30 × 13 au minimum, 54 × 22 pour
la liste des mots-clés. Si la sortie est capturée, une image fixe est affichée.

## Sécurité et vie privée

- Tout reste **local** : aucun port ouvert, aucune requête réseau, aucune télémétrie.
- Le journal ne contient que les réactions, jamais tes conversations.
- Le bandeau lit le bas de l’écran de l’IA, en mémoire, pour y repérer quelques
  indices génériques (« esc to interrupt », une demande de permission, une
  erreur d’API). Il n’en garde que des oui/non : jamais le texte, ni ton code, ni
  tes questions. Rien n’est enregistré ni envoyé. `AI_REACTIONS_AMBIENT=0` le coupe.
- Les entrées MCP sont validées strictement. Le journal rejette les caractères
  de contrôle, pour qu’aucune séquence ne puisse piloter ton terminal.
- Aucune touche n’est simulée et aucun processus n’est interrompu.

Pour signaler une faille, voir [SECURITY.md](SECURITY.md).

## Développement

```sh
git clone https://github.com/KKanisvaran/Ai-reactions.git && cd Ai-reactions
npm ci
npm test               # build + 34 tests : MCP, rendu, sons, journal, pseudo-terminal réel
npm run demo
npm run ai -- codex    # lanceur depuis les sources
```

`dist/` est versionné pour que l’installation n’ait rien à compiler. Après une
modification de `src/`, lance `npm run build` et commite `dist/` avec. La CI le
vérifie sur Windows, Linux et macOS.

Pour ajouter une réaction : sa définition (mot-clé, résumé, messages) dans
`src/reactions.ts`, son dessin dans `src/terminal-animation.ts` et son son dans
`src/sound.ts`.

## Licence

Code sous licence **MIT**, voir [LICENSE](LICENSE).

**Exception** : le nom et le logo **KK LAB**, la mascotte tigre (son image dans
`src/mascot-image.ts` et l’intro) et le pingouin (ses poses dans `src/penguin.ts`)
restent © KKanisvaran, **tous droits réservés**. Un fork peut reprendre le code,
mais doit remplacer ces éléments.

---

Un projet **KK LAB**, par [KKanisvaran](https://github.com/KKanisvaran).
