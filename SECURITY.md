# Sécurité

## Signaler une vulnérabilité

Merci de **ne pas ouvrir d’issue publique**. Utilise le bouton
**Report a vulnerability** de l’onglet *Security* du dépôt (signalement privé
GitHub). Réponse sous 7 jours ; un correctif est publié dès que possible.

## Ce que fait le projet, et ce qu’il ne fait pas

- Le serveur MCP fonctionne **uniquement en local, sur stdio**. Il n’ouvre aucun
  port et ne fait aucune requête réseau.
- Chaque appel d’outil est validé strictement (Zod) avant tout effet ; les
  paramètres inconnus ou hors limites sont refusés.
- Le journal `~/.ai-reactions/reactions.jsonl` ne contient que les réactions, jamais
  les conversations. Sa relecture rejette les caractères de contrôle (ESC, C1),
  pour qu’aucune séquence ne puisse piloter le terminal.
- Aucune simulation de clavier, injection de touches ou interruption du processus
  de l’IA. Le lanceur ne transmet à l’IA que les touches réellement saisies.
- Les sons sont synthétisés en mémoire : aucun fichier téléchargé ni exécuté.
- Sous Windows, les arguments du lanceur sont passés à PowerShell comme chaînes
  littérales, guillemets typographiques compris.
