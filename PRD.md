# PRD — Assistant de suivi de l'été 2026

> **Document de cadrage produit (Product Requirements Document)**
> Version 0.4 — simplification de l'auth (mots de passe en clair, V2.5).
> Date : 2026-06-30 (historique : 0.3 le 2026-06-29, 0.2 le 2026-06-20)

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
  tâches, cocher « fait », laisser une consigne, demander un récap.
- **18 comptes individuels** ont été provisionnés (cf. § 11). L'inscription est faite **par le
  directeur en amont** : les agents reçoivent simplement leur identifiant + mot de passe et n'ont
  rien à créer eux-mêmes. La promesse « accès en moins de 2 minutes » reste tenue : 2 champs à
  saisir une fois, session valable 24 h, l'identifiant est mémorisé ensuite.

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
- Gestion RH complète des congés (soldes, validation), appli mobile native, workflows complexes.
- *Initialement* les comptes individuels étaient hors périmètre — le DSI les a depuis demandés
  (cf. § 11, ajout du 29 juin 2026).

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

> **Note d'évolution — 29 juin 2026.** À la demande du **DSI de la collectivité**, l'accès au
> suivi est désormais protégé par un **système d'authentification individuel** (login + mot de
> passe par agent), avec **sessions signées** et **limitation des tentatives**. Le « mot de passe
> partagé » initial (« qui a le lien peut entrer ») n'est plus la voie nominale. Détail ci-dessous.
> Livré en deux lots : V2.3 (backend Apps Script) et V2.4 (bascule du front), tous deux le 29/06/2026.

> **Note d'évolution — 30 juin 2026 (V2.5) — simplification.** Après une journée de mise en
> production, le système hash + sel décrit ci-dessous (§ 11.1) a été **simplifié** : les mots
> de passe sont désormais **stockés en clair** dans l'onglet `Utilisateurs` de la Sheet (cf.
> § 11.1bis). **Pourquoi** : périmètre limité (6-7 agents, 3 mois, suivi interne de chantier),
> Sheet partagée uniquement avec le directeur, complexité opérationnelle (régénération de
> hash) jugée disproportionnée au risque réel. **Bénéfice perdu** assumé : si la Sheet venait
> à fuiter (compte Google compromis, partage involontaire), les mots de passe seraient
> lisibles tels quels — alors qu'avec les hashes ils auraient été inexploitables. **Tout le
> reste** (sessions signées HMAC, rate-limit 5/15 min, traçabilité par session, clé OpenRouter
> cachée, dépôt privé) est **conservé tel quel**. Le § 11.1 ci-dessous reste à titre
> historique pour expliquer la démarche initiale demandée par le DSI.

### 11.1 Authentification individuelle (V2.3 / V2.4 — historique, voir § 11.1bis pour le système actif)

- **18 comptes** ont été créés et provisionnés dans la Google Sheet (onglet `Utilisateurs`,
  colonnes : `Login`, `Hash`, `Sel`, `Role`, `Actif`).
- **Identifiant** = prénom de l'agent (comparaison **tolérante** : casse, accents et espaces
  ignorés, pour éviter les blocages liés à une majuscule manquante).
- **Mots de passe jamais stockés en clair** : la Sheet ne contient que `SHA-256(mot_de_passe + « : » + sel)`
  en hexadécimal, avec un **sel unique** généré aléatoirement par compte. Conséquence : même si
  la Sheet était lue par un tiers, il ne pourrait pas remonter aux mots de passe.
- **Distribution** : les couples (login, mot de passe) sont remis **hors-canal** par le directeur
  à chaque agent. Les fichiers techniques ayant servi à générer ces hashes ne sont
  **volontairement pas conservés dans le dépôt** (pas de traces des secrets en clair, pas même
  dans l'historique git).
- **Rôles** : deux rôles définis (`admin`, `editeur`). Le rôle est exposé côté client mais n'est
  pas encore exploité pour différencier les permissions — prévu pour une évolution si le besoin
  se confirme (par défaut tout le monde peut tout éditer, comme avant).

### 11.1bis Authentification individuelle (V2.5 — système actuellement en production)

- **18 comptes actifs** dans la Google Sheet, onglet `Utilisateurs`, colonnes simplifiées :
  `Login`, `MotDePasse`, `Role`, `Actif`. La Sheet n'est partagée qu'avec le directeur.
- **Mots de passe en clair** dans la colonne `MotDePasse`. Le backend compare l'égalité stricte
  (`password === user.password`). Aucune fonction de hashing utilisée côté serveur.
- **Identifiant** = prénom de l'agent, même comparaison tolérante qu'en V2.3 (casse / accents /
  espaces ignorés).
- **Distribution** : inchangé — le directeur envoie son couple à chaque agent par le canal de
  son choix (mail interne, message direct, etc.).
- **Rôles** : `admin` (un seul, Yannick) et `editeur` (les 17 autres). Comme en V2.3, le rôle
  n'est pas encore exploité côté front pour différencier les permissions.
- **Procédure de réinitialisation** : éditer directement la cellule `MotDePasse` correspondante
  dans la Sheet, puis communiquer le nouveau mot de passe à l'agent concerné. Pas de
  redéploiement Apps Script nécessaire.

### 11.2 Sessions

- Connexion réussie → le serveur renvoie un **token de session signé** (HMAC-SHA256 avec un secret
  généré et conservé dans les Propriétés du Apps Script — jamais exposé). Le token contient
  `{ login, role, exp }` en base64, suivi de la signature ; sa modification est détectée et rejetée.
- **Durée de validité** : **24 heures**. Au-delà, l'agent doit se reconnecter — son identifiant est
  pré-rempli, il n'a qu'à retaper son mot de passe.
- **Stockage côté navigateur** : `localStorage`, clé `session_v1`. Aucun cookie HTTP, aucune
  information personnelle au-delà de l'identifiant.
- **Sans état côté serveur** : la signature suffit à vérifier le token, donc rien à maintenir
  côté Apps Script. Conséquence pratique : la « déconnexion » est purement locale (purge du
  `localStorage`) — aucune révocation centralisée tant que le token n'a pas expiré.

### 11.3 Protection contre les attaques par force brute

- **5 tentatives ratées** sur un même identifiant → **verrouillage 15 minutes** pour ce login.
- Le compteur est tenu par le cache court d'Apps Script (`CacheService`), auto-purgé à expiration.
- Le message d'erreur est volontairement **générique** (« Identifiants invalides ») et ne révèle
  pas si le login existe ou non — un attaquant ne peut pas énumérer les comptes.

### 11.4 Traçabilité des modifications

- Chaque création/modification de tâche ou de congé est tracée dans la colonne `MAJ` au format
  `AAAA-MM-JJ — Prénom`. Depuis V2.4, **le prénom est extrait de la session authentifiée**
  (et non plus saisi librement par l'utilisateur), ce qui garantit l'**imputabilité réelle**.

### 11.5 Autres mesures (rappel)

- **Clé OpenRouter** : cachée dans les Propriétés du Apps Script — jamais dans la page, jamais
  dans le dépôt.
- **Dépôt GitHub privé** ; l'hébergement GitHub Pages ne sert que la page statique.
- **Congés = données personnelles** (RGPD) : on limite au strict nécessaire (nom, dates,
  remplaçant·e, remarque libre). Pas de motif d'absence, pas de coordonnées personnelles.

### 11.6 Reste à faire (suite de la sécurisation)

- **Retirer le mode legacy** (`token=ete2026`) côté serveur — il est encore accepté pour
  permettre une bascule sans casse, mais le front V2.4 ne l'utilise plus. À supprimer dès que
  les 18 agents sont effectivement passés sur l'auth (cible : courant juillet 2026).
- **Exploiter le rôle `admin`** côté front si on veut restreindre certaines actions (ex.
  suppression de tâche, gestion des congés des autres).

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
  OpenRouter cachée + écriture par l'assistant. ✅ **livré (V2 → V2.2)**.
- **Phase 2.5 — Sécurisation (demande DSI)** : authentification individuelle login + mot de passe,
  sessions signées 24 h, rate-limiting, traçabilité par session. ✅ **livré le 29/06/2026 (V2.3 + V2.4)**,
  **simplifié le 30/06/2026 (V2.5)** par passage des mots de passe en clair côté Sheet (cf. § 11.1bis).
  Reliquat : retirer le mode legacy backend une fois les agents tous basculés (cf. § 11.6).
- **Phase 3 — Confort** : vue planning, filtres avancés, récap mail quotidien.

---

## 14. Questions ouvertes / décisions à prendre

1. ~~**Accès** (V2) : un seul lien pour tous, ou un mot de passe simple partagé en plus ?~~
   ✅ **résolu le 29/06/2026** — authentification individuelle (login + mot de passe par agent),
   suite à la demande du DSI. Cf. § 11.
2. **Droits** (V2) : tout le monde modifie, ou toi + chefs en écriture, autres en lecture ?
   ↳ partiellement résolu : les rôles `admin` / `editeur` existent dans la Sheet mais ne sont
   pas encore exploités côté front (tout le monde peut tout éditer). À arbitrer si besoin réel.
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
