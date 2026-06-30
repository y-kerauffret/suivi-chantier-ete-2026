/**
 * SUIVI ÉTÉ 2026 — Pont Google Apps Script
 *
 * Rôle : exposer une mini-API web qui lit/écrit le Sheet
 * (onglets Tâches / Congés / Chantiers) et qui relaie les appels
 * au modèle Claude via OpenRouter — en gardant la clé OpenRouter
 * cachée côté serveur (jamais exposée à la page web).
 *
 * À copier-coller intégralement dans le fichier Code.gs du projet
 * Apps Script lié au Sheet « Suivi été 2026 — mémoire partagée ».
 *
 * Avant de déployer :
 *   1. Définir les Propriétés du script :
 *        - SHARED_TOKEN     = ete2026
 *        - OPENROUTER_KEY   = sk-or-... (ta clé OpenRouter)
 *        - OPENROUTER_MODEL = anthropic/claude-sonnet-4.5  (facultatif)
 *   2. Exécuter une fois la fonction setup() pour vérifier la conformité du Sheet.
 *   3. Déployer en « Application Web » : exécuter en tant que MOI, accès TOUT LE MONDE.
 */

// ============================================================
//  CONSTANTES
// ============================================================
const SHEET_TACHES    = 'Tâches';
const SHEET_CONGES    = 'Congés';
const SHEET_CHANTIERS = 'Chantiers';
const SHEET_USERS     = 'Utilisateurs';

const TACHES_COLS    = ['ID','Site','Action','Pilote','Equipe','Debut','Fin','Duree','Statut','Priorite','Consigne','MAJ'];
const CONGES_COLS    = ['Personne','Du','Au','Remplacant','Remarque'];
const CHANTIERS_COLS = ['Nom','Couleur','Referent','Notes'];
const USERS_COLS     = ['Login','MotDePasse','Role','Actif'];

const STATUTS = ['À faire','En cours','Fait','Jalon'];
const ROLES   = ['admin','editeur'];

// Auth — paramètres
const SESSION_TTL_SECONDS = 24 * 60 * 60;  // 24h de session
const MAX_LOGIN_ATTEMPTS  = 5;             // tentatives avant verrouillage
const LOCKOUT_TTL_SECONDS = 15 * 60;       // 15 min de verrouillage

// ============================================================
//  PROPRIÉTÉS (token + clé OpenRouter — stockés côté serveur)
// ============================================================
function props() { return PropertiesService.getScriptProperties(); }
function getToken()          { return props().getProperty('SHARED_TOKEN'); }
function getOpenRouterKey()  { return props().getProperty('OPENROUTER_KEY'); }
function getOpenRouterModel(){ return props().getProperty('OPENROUTER_MODEL') || 'anthropic/claude-sonnet-4.5'; }

// ============================================================
//  HELPERS SHEET
// ============================================================
function getSS() { return SpreadsheetApp.getActive(); }

function getSheet(name) {
  const sh = findSheet(name);
  if (sh) return sh;
  // Erreur explicative : liste les onglets réellement présents
  const all = getSS().getSheets();
  throw new Error(
    'Onglet introuvable : "' + name + '". ' +
    'Onglets présents dans le Sheet : ' +
    all.map(s => '"' + s.getName() + '"').join(', ')
  );
}

/* Variante non-throw de getSheet : renvoie l'onglet trouvé (recherche
   tolérante aux accents/casse/espaces) ou null. Utilisé par setup() pour
   diagnostiquer sans casser. */
function findSheet(name) {
  const ss = getSS();
  let sh = ss.getSheetByName(name);
  if (sh) return sh;
  const target = normalizeName(name);
  return ss.getSheets().find(s => normalizeName(s.getName()) === target) || null;
}
function normalizeName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function readRows(sheetName, cols) {
  const sh = getSheet(sheetName);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const data = sh.getRange(2, 1, lastRow - 1, cols.length).getValues();
  return data.map(row => {
    const o = {};
    cols.forEach((c, i) => { o[c] = formatCell(row[i]); });
    return o;
  });
}

function formatCell(v) {
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return v === '' ? null : v;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ============================================================
//  HELPERS UTILISATEURS — auth login/mot de passe
// ============================================================

/* Normalise un login pour comparaison : trim + minuscules + accents
   supprimés. Permet à un utilisateur de taper « sebastien », « Sébastien »
   ou « SEBASTIEN », tous reconnus comme la même personne. */
function normalizeLogin(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/* Cherche un utilisateur actif par son login (comparaison normalisée).
   Renvoie { row, login, password, role } ou null.
   Le mot de passe est stocké en clair dans la Sheet (privée) — choix
   assumé après évaluation du risque (cf. PRD § 11). */
function findUser(login) {
  const sh = getSheet(SHEET_USERS);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return null;
  const data = sh.getRange(2, 1, lastRow - 1, USERS_COLS.length).getValues();
  const wanted = normalizeLogin(login);
  for (let i = 0; i < data.length; i++) {
    const row    = data[i];
    const stored = normalizeLogin(row[0]);
    const actif  = row[3] === true || row[3] === 'TRUE' || row[3] === 'true' || row[3] === 1;
    if (stored === wanted && actif) {
      return {
        row:      i + 2,
        login:    row[0],
        password: String(row[1] || ''),
        role:     row[2] || 'editeur'
      };
    }
  }
  return null;
}

// ============================================================
//  AUTH — session token signé + rate-limiting (LOT 1.3)
// ============================================================

/* Renvoie le secret HMAC utilisé pour signer les sessions, en le
   générant la 1re fois si absent. Stocké dans les propriétés du script
   (jamais exposé à la page). */
function ensureSessionSecret() {
  const p = props();
  let secret = p.getProperty('SESSION_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    p.setProperty('SESSION_SECRET', secret);
  }
  return secret;
}

function b64Encode(str) {
  return Utilities.base64Encode(str, Utilities.Charset.UTF_8);
}
function b64Decode(s) {
  return Utilities.newBlob(Utilities.base64Decode(s)).getDataAsString();
}

function hmacSha256Hex(message, secret) {
  const bytes = Utilities.computeHmacSha256Signature(message, secret);
  return bytes.map(function(b){
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

function nowSeconds() {
  return Math.floor(new Date().getTime() / 1000);
}

/* Construit un session token : base64(payload).hex(HMAC-SHA256(payload, SECRET))
   Payload = { login, role, exp }. */
function signSession(login, role) {
  const payload = JSON.stringify({ login: login, role: role, exp: nowSeconds() + SESSION_TTL_SECONDS });
  const payloadB64 = b64Encode(payload);
  const sig = hmacSha256Hex(payloadB64, ensureSessionSecret());
  return payloadB64 + '.' + sig;
}

/* Vérifie un session token : renvoie le payload { login, role, exp }
   si la signature est valide ET non expirée, sinon null. */
function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expectedSig = hmacSha256Hex(parts[0], ensureSessionSecret());
  if (parts[1] !== expectedSig) return null;
  try {
    const payload = JSON.parse(b64Decode(parts[0]));
    if (!payload.exp || payload.exp < nowSeconds()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// Rate-limiting des tentatives de login (via CacheService, TTL auto)
function loginAttemptsKey(login) {
  return 'loginfail:' + normalizeLogin(login);
}
function getLoginAttempts(login) {
  const v = CacheService.getScriptCache().get(loginAttemptsKey(login));
  return v ? parseInt(v, 10) : 0;
}
function incrementLoginAttempts(login) {
  const cache = CacheService.getScriptCache();
  const n = getLoginAttempts(login) + 1;
  cache.put(loginAttemptsKey(login), String(n), LOCKOUT_TTL_SECONDS);
  return n;
}
function clearLoginAttempts(login) {
  CacheService.getScriptCache().remove(loginAttemptsKey(login));
}

/* OPÉRATION login : vérifie login+mdp et renvoie un session token.
   - Rate-limit : 5 tentatives ratées => verrouillage 15 min (par login).
   - Le message d'erreur est volontairement générique ("Identifiants
     invalides") pour ne pas révéler si le login existe ou pas. */
function opLogin(p) {
  const login    = String(p.login    || '').trim();
  const password = String(p.password || '');
  if (!login || !password) {
    return { error: 'Login et mot de passe requis' };
  }
  if (getLoginAttempts(login) >= MAX_LOGIN_ATTEMPTS) {
    return { error: 'Trop de tentatives. Reessayez dans 15 minutes.' };
  }
  const user = findUser(login);
  if (!user) {
    incrementLoginAttempts(login);
    return { error: 'Identifiants invalides' };
  }
  if (password !== user.password) {
    incrementLoginAttempts(login);
    return { error: 'Identifiants invalides' };
  }
  clearLoginAttempts(login);
  return {
    ok: true,
    token: signSession(user.login, user.role),
    login: user.login,
    role:  user.role,
    expires_in: SESSION_TTL_SECONDS
  };
}

/* Petit auto-test à exécuter une fois depuis l'éditeur Apps Script
   pour vérifier que la chaîne hash + signature + vérif marche. */
function testLogin() {
  Logger.log('--- testLogin ---');
  // 1. Tentative avec un mauvais mdp pour Yannick
  const ko = opLogin({ login: 'Yannick', password: 'wrong' });
  Logger.log('Mauvais mdp -> ' + JSON.stringify(ko));
  // 2. Vérifie que la signature valide passe la vérif
  const fake = signSession('TESTUSER', 'editeur');
  const payload = verifySession(fake);
  Logger.log('Signature self-test : ' + (payload && payload.login === 'TESTUSER' ? 'OK' : 'KO'));
  // 3. Vérifie qu'un token bidon est rejeté
  Logger.log('Token bidon       : ' + (verifySession('blabla') === null ? 'OK (rejete)' : 'KO'));
  // 4. NOTE: on ne teste pas le bon mdp ici pour ne pas l'ecrire en clair.
  //    Le vrai test grandeur nature se fera depuis la page web (LOT 1.4).
}

/* Étiquette mise à jour : "YYYY-MM-DD — Prénom" si un acteur est fourni,
   sinon juste "YYYY-MM-DD". */
function actorTag(actor) {
  const a = String(actor || '').trim();
  return a ? today() + ' — ' + a : today();
}

// ============================================================
//  POINTS D'ENTRÉE HTTP
//  doGet  : lecture (op=state)
//  doPost : écriture (task.*, leave.*, ai.chat)
// ============================================================
function doGet(e)  { return handle(e, 'GET'); }
function doPost(e) { return handle(e, 'POST'); }

function handle(e, method) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (err) {
    return json({ error: 'Verrou indisponible (autre écriture en cours)' });
  }
  try {
    let body = {};
    if (method === 'POST' && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); }
      catch (err) { return json({ error: 'Corps JSON invalide : ' + err.message }); }
    }
    const params = Object.assign({}, e.parameter || {}, body);

    const op = params.op;
    if (!op) return json({ error: 'Paramètre op manquant' });

    // Op « login » : pas besoin de token de session (elle SERT à l'obtenir)
    if (op === 'login') {
      return json(opLogin(params));
    }

    // Pour les autres ops : deux modes d'auth acceptes pendant la
    // transition (LOT 1.3 -> 1.6) :
    //   1. session token signe  -> mode cible
    //   2. token partage (legacy) -> compatibilite collegues le temps
    //      qu'on bascule le front (LOT 1.4)
    if (params.session) {
      const sess = verifySession(params.session);
      if (!sess) return json({ error: 'Session expiree ou invalide' });
      params.actor = sess.login;
      params.role  = sess.role;
    } else if (params.token !== getToken()) {
      return json({ error: 'Token invalide ou manquant' });
    }

    switch (op) {
      case 'state':        return json(opState());
      case 'task.update':  return json(opTaskUpdate(params));
      case 'task.create':  return json(opTaskCreate(params));
      case 'task.delete':  return json(opTaskDelete(params));
      case 'leave.create': return json(opLeaveCreate(params));
      case 'leave.update': return json(opLeaveUpdate(params));
      case 'leave.delete': return json(opLeaveDelete(params));
      case 'ai.chat':      return json(opAiChat(params));
      default:             return json({ error: 'Opération inconnue : ' + op });
    }
  } catch (err) {
    return json({ error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  OPÉRATIONS — LECTURE
// ============================================================
function opState() {
  return {
    meta: {
      titre: "Suivi de l'été 2026",
      periode: '6 juin → 1er septembre 2026'
    },
    statuts: STATUTS,
    priorites: ['Faible','Moyenne','Haute','Critique'],
    taches: readRows(SHEET_TACHES, TACHES_COLS).map(t => ({
      id:        t.ID,
      site:      t.Site || '',
      action:    t.Action || '',
      pilote:    t.Pilote || '',
      equipe:    t.Equipe || '',
      debut:     t.Debut,
      fin:       t.Fin,
      duree:     t.Duree,
      statut:    t.Statut || 'À faire',
      priorite:  t.Priorite || 'Moyenne',
      consigne:  t.Consigne || '',
      maj:       t.MAJ || ''
    })),
    conges: readRows(SHEET_CONGES, CONGES_COLS).map(c => ({
      personne:   c.Personne || '',
      du:         c.Du,
      au:         c.Au,
      remplacant: c.Remplacant || '',
      remarque:   c.Remarque || ''
    })),
    chantiers: readRows(SHEET_CHANTIERS, CHANTIERS_COLS).map(c => ({
      nom:      c.Nom || '',
      couleur:  c.Couleur || '',
      referent: c.Referent || '',
      notes:    c.Notes || ''
    }))
  };
}

// ============================================================
//  OPÉRATIONS — TÂCHES
// ============================================================
function opTaskUpdate(p) {
  if (!p.id) return { error: 'id manquant' };
  const sh = getSheet(SHEET_TACHES);
  const rowNum = findRowById(sh, p.id);
  if (rowNum < 0) return { error: 'Tâche introuvable : ' + p.id };

  const fields = p.fields || {};
  const fmap = {
    site:'Site', action:'Action', pilote:'Pilote', equipe:'Equipe',
    debut:'Debut', fin:'Fin', duree:'Duree',
    statut:'Statut', priorite:'Priorite', consigne:'Consigne'
  };
  Object.keys(fields).forEach(k => {
    const colName = fmap[k];
    if (!colName) return;
    const colIdx = TACHES_COLS.indexOf(colName);
    if (colIdx < 0) return;
    const v = fields[k];
    sh.getRange(rowNum, colIdx + 1).setValue(v == null ? '' : v);
  });
  // Met à jour la colonne MAJ automatiquement, avec le prénom de l'auteur si fourni
  sh.getRange(rowNum, TACHES_COLS.indexOf('MAJ') + 1).setValue(actorTag(p.actor));
  return { ok: true, id: p.id };
}

function opTaskCreate(p) {
  const sh = getSheet(SHEET_TACHES);
  const f = p.fields || {};
  const newId = 'T-' + Date.now().toString().slice(-4);
  sh.appendRow([
    newId,
    f.site     || 'Divers',
    f.action   || '',
    f.pilote   || '',
    f.equipe   || '',
    f.debut    || '',
    f.fin      || '',
    f.duree    || '',
    f.statut   || 'À faire',
    f.priorite || 'Moyenne',
    f.consigne || '',
    actorTag(p.actor)
  ]);
  return { ok: true, id: newId };
}

function opTaskDelete(p) {
  if (!p.id) return { error: 'id manquant' };
  const sh = getSheet(SHEET_TACHES);
  const rowNum = findRowById(sh, p.id);
  if (rowNum < 0) return { error: 'Tâche introuvable : ' + p.id };
  sh.deleteRow(rowNum);
  return { ok: true, id: p.id };
}

function findRowById(sh, id) {
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues().map(r => r[0]);
  const idx = ids.indexOf(id);
  return idx < 0 ? -1 : idx + 2;
}

// ============================================================
//  OPÉRATIONS — CONGÉS
//  (index = position 0-based dans la liste, telle que renvoyée par state)
// ============================================================
function opLeaveCreate(p) {
  const sh = getSheet(SHEET_CONGES);
  const f = p.fields || {};
  sh.appendRow([
    f.personne   || '',
    f.du         || '',
    f.au         || '',
    f.remplacant || '',
    f.remarque   || ''
  ]);
  return { ok: true };
}

function opLeaveUpdate(p) {
  if (p.index == null) return { error: 'index manquant' };
  const sh = getSheet(SHEET_CONGES);
  const rowNum = p.index + 2;
  if (rowNum > sh.getLastRow()) return { error: 'Index hors plage' };
  const f = p.fields || {};
  const fmap = {
    personne:'Personne', du:'Du', au:'Au',
    remplacant:'Remplacant', remarque:'Remarque'
  };
  Object.keys(f).forEach(k => {
    const colName = fmap[k];
    if (!colName) return;
    const colIdx = CONGES_COLS.indexOf(colName);
    if (colIdx < 0) return;
    sh.getRange(rowNum, colIdx + 1).setValue(f[k] == null ? '' : f[k]);
  });
  return { ok: true };
}

function opLeaveDelete(p) {
  if (p.index == null) return { error: 'index manquant' };
  const sh = getSheet(SHEET_CONGES);
  const rowNum = p.index + 2;
  if (rowNum > sh.getLastRow()) return { error: 'Index hors plage' };
  sh.deleteRow(rowNum);
  return { ok: true };
}

// ============================================================
//  OPÉRATION — IA (relais OpenRouter, clé cachée)
// ============================================================
function opAiChat(p) {
  const key = getOpenRouterKey();
  if (!key) return { error: 'Clé OpenRouter non configurée côté script (propriété OPENROUTER_KEY manquante)' };
  const model = p.model || getOpenRouterModel();
  const messages = p.messages || [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return { error: 'messages manquants ou vides' };
  }
  const response = UrlFetchApp.fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + key },
    payload: JSON.stringify({ model: model, messages: messages }),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code >= 400) {
    return { error: 'OpenRouter ' + code + ' : ' + text.slice(0, 500) };
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    return { error: 'Réponse OpenRouter non-JSON : ' + text.slice(0, 200) };
  }
}

// ============================================================
//  SETUP — vérification de l'installation
//  À exécuter une fois depuis l'éditeur Apps Script (bouton Exécuter)
// ============================================================
function setup() {
  const ss = getSS();
  const ok = [];
  const ko = [];

  // 1. Onglets présents ?
  [SHEET_TACHES, SHEET_CONGES, SHEET_CHANTIERS, SHEET_USERS].forEach(name => {
    const sh = findSheet(name);
    if (sh) ok.push('Onglet trouvé : ' + name);
    else    ko.push('Onglet MANQUANT : ' + name + ' (vérifie l\'orthographe et les accents)');
  });

  // 2. En-têtes corrects ?
  function checkHeaders(name, expected) {
    const sh = findSheet(name);
    if (!sh) return;
    const headers = sh.getRange(1, 1, 1, expected.length).getValues()[0];
    const mismatch = expected.filter((h, i) => headers[i] !== h);
    if (mismatch.length === 0) ok.push('En-têtes OK : ' + name);
    else ko.push('En-têtes incorrects pour ' + name + ' (attendu : ' + expected.join(', ') + ' / lu : ' + headers.join(', ') + ')');
  }
  checkHeaders(SHEET_TACHES, TACHES_COLS);
  checkHeaders(SHEET_CONGES, CONGES_COLS);
  checkHeaders(SHEET_CHANTIERS, CHANTIERS_COLS);
  checkHeaders(SHEET_USERS, USERS_COLS);

  // 4. Comptes utilisateurs présents ?
  const shUsers = findSheet(SHEET_USERS);
  if (shUsers) {
    const nb = Math.max(0, shUsers.getLastRow() - 1);
    if (nb > 0) ok.push(nb + ' compte(s) utilisateur(s) chargé(s)');
    else        ko.push('Onglet ' + SHEET_USERS + ' vide — remplir manuellement les lignes (Login / MotDePasse / Role / Actif)');
  }

  // 3. Propriétés
  if (getToken())         ok.push('Propriété SHARED_TOKEN définie');
  else                    ko.push('Propriété SHARED_TOKEN MANQUANTE (mettre : ete2026)');
  if (getOpenRouterKey()) ok.push('Propriété OPENROUTER_KEY définie');
  else                    ko.push('Propriété OPENROUTER_KEY MANQUANTE (clé sk-or-...)');

  const log = [
    '=== Vérification ===',
    ...ok.map(s => '  ✓ ' + s),
    ...ko.map(s => '  ✗ ' + s),
    '',
    ko.length === 0 ? '✅ Tout est prêt. Tu peux déployer.' : '⚠️ Corrige les points ci-dessus avant de déployer.'
  ].join('\n');

  Logger.log(log);
  return log;
}
