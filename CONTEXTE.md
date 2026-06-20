# CONTEXTE & PASSATION — à lire en priorité

> Ce fichier sert à briefer une nouvelle session Claude Code qui reprend le projet.
> **Lis aussi `PRD.md`** (le cahier des charges complet). Réponds en français.

## Le projet en 2 lignes
Un **assistant de suivi partagé** pour piloter l'été 2026 (déménagements, travaux, ouverture du
nouveau centre « Atelier des loisirs », congés des agents). Une page web simple + un Google Sheet
comme **mémoire commune** + un **assistant IA via OpenRouter** (compte du directeur, avec crédits).
Public : le directeur + 6-7 collègues **non techniques**, surtout sur **smartphone**.
**Priorité n°1 non négociable : la simplicité d'accès pour les collègues.**

## Où on en est (état actuel)
- ✅ **PRD.md** : cahier des charges complet (v0.2), calé sur les données réelles.
- ✅ **index.html** : un **prototype V1 fonctionnel**, autonome (un seul fichier), pré-rempli avec
  **34 tâches réelles** issues d'un Gantt Excel, réparties sur **7 chantiers**
  (Malmedonne 16, Atelier des loisirs 6, Haute-Futaie 4, CLP 3, Bessières 3, CAP Chapiteau 1, CAP La Tour 1),
  période 6 juin → 1er sept. 2026.
  - Onglets : Tâches (filtres site/statut/pilote + recherche, statut cliquable, consigne de relais éditable,
    ajout/édition), Chantiers (avancement %), Congés (ajout), Assistant (chat OpenRouter).
  - **Limite V1** : mémoire = `localStorage` du navigateur (donc PAS encore partagée) ; clé OpenRouter
    saisie localement (donc pas partageable à l'équipe).

## Décisions déjà prises (modifiables)
- Statuts simplifiés : **À faire / En cours / Fait / Jalon**.
- Vue principale = **liste de tâches filtrable** (mobile d'abord), pas un Gantt complet.
- Livraison en 2 temps : V1 prototype local (fait) → **V2 version partagée** (à construire).

## CE QU'IL RESTE À FAIRE — la V2 (version partagée)
Objectif : que les 6-7 personnes partagent la **même** mémoire en temps réel, sans compte à créer.
Architecture cible :
1. **Google Sheet** = base/mémoire (onglets Tâches, Congés, Chantiers). Modèle de données dans PRD.md §9.
2. **Google Apps Script** (le « pont ») : une petite API web (doGet/doPost) qui lit/écrit le Sheet
   **et** relaie les appels OpenRouter — la **clé OpenRouter reste cachée côté script**, jamais dans la page.
3. **Page web** (réutiliser/adapter `index.html`) hébergée sur **GitHub Pages** (ce dépôt) → un simple lien à partager.
4. En V2, l'assistant doit pouvoir **écrire** dans la mémoire (créer/mettre à jour des tâches en langage naturel).

## Premières actions suggérées pour la nouvelle session
1. Commiter les fichiers présents (`PRD.md`, `index.html`, ce fichier) sur une branche, puis proposer un plan V2.
2. Démarrer par le **Google Sheet + le script Apps Script** (cœur de la mémoire partagée), puis brancher la page.
3. Garder l'esprit « léger » : pas de framework lourd, pas de build compliqué.

## Questions ouvertes à reposer au directeur (voir PRD.md §14)
- Accès V2 : un seul lien pour tous, ou un mot de passe simple partagé en plus ?
- Droits : tout le monde modifie, ou directeur + chefs en écriture / autres en lecture ?
- Quel modèle Claude sur OpenRouter (coût/qualité) ?
- Congés : tableau simple (retenu) ou aussi une mini-vue calendrier ?

## Données / accès
- Source des données : fichier Excel « Gantt croisé été 2026 » (déjà extrait dans index.html).
- OpenRouter : compte actif du directeur, avec crédits (clé à coller côté Apps Script en V2, jamais dans le dépôt).
- Dépôt : `y-kerauffret/suivi-chantier-ete-2026` (privé).
