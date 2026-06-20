# PRD — Assistant de suivi de l'été 2026

> **Document de cadrage produit (Product Requirements Document)**
> Version 0.2 — enrichie avec les données réelles du « Gantt croisé été 2026 ».
> Date : 2026-06-20

---

## 1. En une phrase

Un **assistant de suivi partagé** pour piloter l'été (juin → septembre) : une page web simple,
adossée à un Google Sheet qui sert de **mémoire commune**, avec un **assistant IA** (Claude via
OpenRouter) qui fait des récaps, met à jour la mémoire et assure le relais entre les personnes —
y compris pendant les congés.

---

## 2. Contexte

La direction gère plusieurs services (écoles, accueils de loisirs). L'été 2026 concentre une charge
inhabituelle, déjà cartographiée dans un fichier Excel « Gantt croisé été 2026 » :

- **Déménagements** de mobilier entre sites (Haute-Futaie, Malmedonne…) ;
- **Livraison et ouverture d'un nouveau centre de loisirs** : « **Atelier des loisirs** »
  (préparation, livraison/montage mobilier, commission sécurité le 1er sept., inauguration le 12 sept.) ;
- **Travaux** (Malmedonne), ménages post-travaux, réinstallations VPI/TNI, livraison de classes neuves ;
- **Gestion des congés** des agents et des chefs de service ;
- **34 tâches** réparties sur **7 sites/chantiers**, du **6 juin au 1er septembre 2026**.

Les responsables se relaient (congés échelonnés). Le risque principal : **perdre l'information au
moment des passations** (ex. « relancer l'entreprise pour les 3 classes/bureaux manquants »).

---

## 3. Problème à résoudre

1. **Pas de mémoire commune vivante** : le Gantt Excel est excellent pour planifier, mais peu pratique
   à mettre à jour au quotidien à plusieurs, surtout sur le terrain / au téléphone.
2. **Passations fragiles** : quand quelqu'un part en congé, le suivant n'a pas le contexte.
3. **Vue d'ensemble à l'instant T** : difficile de voir vite ce qui est fait / en cours / à faire.
4. **Outils trop lourds** pour une équipe non-technique mobilisée quelques semaines.

---

## 4. Objectifs & décisions de cadrage

| # | Objectif | Indicateur de réussite |
|---|----------|------------------------|
| O1 | Centraliser le suivi de l'été | Les 34 tâches + congés y figurent et se mettent à jour |
| O2 | Accès trivial pour 6-7 collègues | Accès en 1 clic, sur téléphone, sans formation |
| O3 | Sécuriser les passations | Chaque tâche porte une « consigne de relais » lisible par le suivant |
| O4 | Récaps instantanés | « Récap de ce qui est fait / reste à faire » en < 10 s |
| O5 | Léger et gratuit | Aucun serveur à maintenir ; coût limité aux crédits OpenRouter |

**Principe directeur n°1 (non négociable) : la simplicité d'accès pour les collègues prime sur tout.**

**Décisions prises (modifiables) :**
- **Statuts simplifiés** : `À faire` / `En cours` / `Fait` / `Jalon` (au lieu des 6 d'origine).
- **Vue principale** : **liste de tâches filtrable** (mobile d'abord), pas un Gantt complet.
  Une vue planning pourra être ajoutée plus tard.
- **Livraison en 2 temps** : (V1) **prototype local** que tu ouvres dans un navigateur pour voir et
  tester le concept ; (V2) **version partagée** branchée sur Google Sheet + OpenRouter.

---

## 5. Utilisateurs cibles

- **Le directeur (toi)** — administrateur : répartit les tâches, consulte les récaps, supervise.
- **6-7 collègues** (chefs de service, agents : Enfance, HR, manutention, Éducation…) — profils
  **non techniques**, souvent sur **smartphone**, sur le terrain. Ils doivent pouvoir : voir leurs
  tâches, cocher « fait », laisser une consigne, demander un récap. **Sans compte à créer** (lien simple).

---

## 6. Cas d'usage clés (user stories)

1. *Je reviens de congé* → « fais-moi un récap de ce qui a été fait et de ce qui reste » → réponse
   immédiate à partir de la mémoire.
2. *Une tâche est terminée* → je la passe à « Fait » (tracé : qui / quand).
3. *Je pars en congé et laisse une consigne* → « Mobilier livré, 3 classes manquantes : relancer
   l'entreprise » → le suivant la voit.
4. *J'ajoute une tâche* en langage naturel → enregistrée dans la mémoire.
5. *Qui est en congé cette semaine ?* → réponse depuis l'onglet Congés.
6. *Avancement du nouveau centre (Atelier des loisirs)* → vue par chantier.

---

## 7. Périmètre fonctionnel

### 7.1 MVP — V1 (prototype local, déjà construit)
- **Page web unique**, responsive (mobile d'abord), ouvrable d'un double-clic.
- **Liste de tâches** pré-remplie avec les 34 tâches réelles : site, action, pilote, équipe,
  début/fin, statut, priorité, **consigne de relais**.
- **Filtres** : par site/chantier, par statut, par responsable + recherche.
- **Changer le statut**, **éditer la consigne de relais**, **ajouter une tâche**.
- **Onglet Congés** (ajout/visualisation) et **vue Chantiers** (avancement par site).
- **Assistant IA** : récaps et questions sur l'état courant (via clé OpenRouter saisie localement).
- **Mémoire** : sauvegarde locale du navigateur (localStorage) en V1.

### 7.2 V2 — version partagée
- Mémoire = **Google Sheet** (partagé, persistant, multi-utilisateurs).
- **Pont Google Apps Script** : lit/écrit le Sheet + relaie OpenRouter (clé cachée côté serveur).
- Page hébergée sur **GitHub Pages** (lien à partager).
- L'assistant **écrit** dans la mémoire (créer/mettre à jour des tâches en langage naturel).

### 7.3 Souhaitable (plus tard)
- Vue planning / Gantt, filtre « mes tâches » / « cette semaine », récap mail quotidien, journal.

### 7.4 Hors périmètre (pour rester léger)
- Comptes/mots de passe individuels, gestion RH complète des congés (soldes, validation),
  appli mobile native, workflows complexes.

---

## 8. Architecture technique

```
[ Page web (GitHub Pages) ]  ←→  [ Pont Google Apps Script ]  ←→  [ Google Sheet = mémoire ]
   chat + vues simples                lit/écrit le Sheet
   (le lien partagé)                  appelle OpenRouter  ──→  [ OpenRouter / Claude = cerveau ]
```

1. **Page web (frontend)** — HTML/CSS/JS simple, sans dépendance, hébergée sur **GitHub Pages**.
2. **Google Sheet** — onglets `Tâches`, `Congés`, `Chantiers` (= mémoire persistante).
3. **Google Apps Script (le pont)** — petite API lire/écrire + relais OpenRouter (clé secrète côté serveur).
4. **OpenRouter** — compte existant avec crédits, modèle Claude.

**Pourquoi ce choix** : zéro serveur à maintenir, zéro coût d'hébergement, clé OpenRouter jamais
exposée, et **aucun compte requis** pour les collègues.

> Note V1 : le prototype local fonctionne **sans** les briques 2-3 (mémoire dans le navigateur,
> clé OpenRouter saisie localement et stockée uniquement sur ton appareil).

---

## 9. Modèle de données (calé sur ton Gantt)

### Onglet `Tâches` (34 lignes pré-remplies)
| Colonne | Origine Excel | Exemple |
|---|---|---|
| ID | (généré) | T-017 |
| Site / Chantier | Site | Malmedonne |
| Action | Action | Livraison DPC pour trois classes neuves |
| Pilote | Pilote | L. Gé |
| Équipe / acteurs | Acteurs / services | Équipe manut renforcée |
| Début | Début | 2026-08-17 |
| Fin | Fin | 2026-08-17 |
| Durée (j) | Durée j. | 1 |
| Statut | (nouveau) | À faire / En cours / Fait / Jalon |
| Priorité | (nouveau) | Faible / Moyenne / Haute / Critique |
| Consigne de relais | Commentaires | « livré partiellement, relancer entreprise » |
| Dernière mise à jour | (généré) | 2026-07-02 — Marc |

### Onglet `Congés`
| Personne | Du | Au | Remplaçant·e | Remarque |
|---|---|---|---|---|

### Onglet `Chantiers` (7, déduits du Gantt)
Malmedonne (16 tâches), Atelier des loisirs (6), Haute-Futaie (4), CLP (3), Bessières (3),
CAP Chapiteau (1), CAP La Tour (1). Colonnes : Nom, Statut, Référent, Avancement, Notes,
Première date, Dernière date.

### Listes de référence
- **Services / acteurs** : Équipe manut renforcée, Équipe HR, Enfance, EN + ATSEM,
  Patrimoine + entreprise, Fournisseur, DSI / VPI-TNI.

---

## 10. Comportement de l'assistant IA

- À chaque message : l'état courant (mémoire) + la demande sont envoyés au modèle.
- Capacités V1 : **récapituler** (fait / en cours / à faire, par personne ou par chantier),
  **répondre aux questions** (« qui est en congé la semaine du 20 ? », « où en est l'Atelier des loisirs ? »),
  restituer les **consignes de relais** pertinentes.
- Capacités V2 : **créer / modifier** une tâche en langage naturel (écriture dans la mémoire, traçable).
- Ton simple, opérationnel, en français.

---

## 11. Sécurité & confidentialité

- **Clé OpenRouter** : V1 = stockée uniquement dans ton navigateur (test perso) ; V2 = cachée dans
  le Apps Script (jamais dans la page ni dans le dépôt).
- **Accès par lien** (V2) : « qui a le lien peut voir/écrire » → à cadrer (Q ouvertes).
- **Congés = données personnelles** (RGPD) : limiter au strict nécessaire (nom, dates, remplaçant) ;
  pas de motif d'absence. Dépôt GitHub en privé.

---

## 12. Exigences non fonctionnelles

- **Simplicité** : prise en main < 2 min, sans notice. **Mobile-first**. 100 % **français**.
- **Coût** : gratuit hors crédits OpenRouter. **Sans maintenance**.

---

## 13. Roadmap

- **Phase 0 — Cadrage** : ce document. ✅
- **Phase 1 — Prototype local** : page web pré-remplie avec les 34 tâches, vues + filtres + assistant
  (mémoire navigateur). ✅ **livré pour visualisation**.
- **Phase 2 — Version partagée** : Google Sheet + pont Apps Script + hébergement GitHub Pages + clé
  OpenRouter cachée + écriture par l'assistant.
- **Phase 3 — Confort** : vue planning, filtres avancés, récap mail quotidien.

---

## 14. Questions ouvertes / décisions à prendre

1. **Accès** (V2) : un seul lien pour tous, ou un mot de passe simple partagé en plus ?
2. **Droits** (V2) : tout le monde modifie, ou toi + chefs en écriture, autres en lecture ?
3. **Modèle OpenRouter** : quel Claude (équilibre coût/qualité) ?
4. **Congés** : tableau simple (retenu) ou aussi mini-vue calendrier ?
5. **Chantiers** : ✅ résolu — liste connue (7 sites ci-dessus).
6. **Saisie des tâches** : via l'assistant et/ou un petit formulaire (les deux retenus en V1).
7. **Points à arbitrer hérités du Gantt** : responsables exacts, créneaux entreprise, dates fermes,
   contraintes d'accès, disponibilité des équipes → à suivre comme « items en suspens ».

---

## 15. Annexe — éléments connus

- Dépôt : `suivi-ete-2026` (à créer côté GitHub, privé).
- Hébergement page : GitHub Pages (V2).
- Base / mémoire : Google Sheet (V2) ; localStorage (V1).
- IA : OpenRouter (compte actif, avec crédits — confirmé).
- Source des données : fichier « Gantt croisé été 2026 » (34 tâches, 7 sites, 6 juin → 1er sept.).
- Période couverte : juin → septembre 2026.
