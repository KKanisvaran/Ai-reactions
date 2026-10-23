# Sécurité

## Signaler une vulnérabilité

Merci de **ne pas ouvrir d’issue publique**. Utilise le bouton
**Report a vulnerability** de l’onglet *Security* du dépôt (signalement privé
GitHub). Réponse sous 7 jours ; un correctif est publié dès que possible.

## Ce que fait le projet, et ce qu’il ne fait pas

- Tout fonctionne **uniquement en local** : aucun port ouvert, aucune requête
  réseau, aucune donnée enregistrée.
- Le pingouin lit le bas de l’écran de l’IA, en mémoire, pour y repérer quelques
  indices génériques (travail en cours, demande de permission, interruption,
  erreur d’API). Il n’en garde que des oui/non : jamais le texte.
- Les séquences de l’IA ne sont jamais relayées telles quelles au terminal : le
  lanceur repeint lui-même son écran à partir d’une copie virtuelle.
- Aucune simulation de clavier, injection de touches ou interruption du processus
  de l’IA. Le lanceur ne transmet à l’IA que les touches réellement saisies.
- Sous Windows, les arguments du lanceur sont passés à PowerShell comme chaînes
  littérales, guillemets typographiques compris.
