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

const TACHES_COLS    = ['ID','Site','Action','Pilote','Equipe','Debut','Fin','Duree','Statut','Priorite','Consigne','MAJ'];
const CONGES_COLS    = ['Personne','Du','Au','Remplacant','Remarque'];
const CHANTIERS_COLS = ['Nom','Couleur','Referent','Notes'];

const STATUTS = ['À faire','En cours','Fait','Jalon'];

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
  const ss = getSS();
  // 1. Recherche stricte
  let sh = ss.getSheetByName(name);
  if (sh) return sh;
  // 2. Recherche tolérante : sans accents, casse ignorée, espaces ignorés
  const target = normalizeName(name);
  const all = ss.getSheets();
  sh = all.find(s => normalizeName(s.getName()) === target);
  if (sh) return sh;
  // 3. Erreur explicative : liste les onglets réellement présents
  throw new Error(
    'Onglet introuvable : "' + name + '". ' +
    'Onglets présents dans le Sheet : ' +
    all.map(s => '"' + s.getName() + '"').join(', ')
  );
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

    // Authentification : token partagé
    if (params.token !== getToken()) {
      return json({ error: 'Token invalide ou manquant' });
    }

    const op = params.op;
    if (!op) return json({ error: 'Paramètre op manquant' });

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
  [SHEET_TACHES, SHEET_CONGES, SHEET_CHANTIERS].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (sh) ok.push('Onglet trouvé : ' + name);
    else    ko.push('Onglet MANQUANT : ' + name + ' (vérifie l\'orthographe et les accents)');
  });

  // 2. En-têtes corrects ?
  function checkHeaders(name, expected) {
    const sh = ss.getSheetByName(name);
    if (!sh) return;
    const headers = sh.getRange(1, 1, 1, expected.length).getValues()[0];
    const mismatch = expected.filter((h, i) => headers[i] !== h);
    if (mismatch.length === 0) ok.push('En-têtes OK : ' + name);
    else ko.push('En-têtes incorrects pour ' + name + ' (attendu : ' + expected.join(', ') + ' / lu : ' + headers.join(', ') + ')');
  }
  checkHeaders(SHEET_TACHES, TACHES_COLS);
  checkHeaders(SHEET_CONGES, CONGES_COLS);
  checkHeaders(SHEET_CHANTIERS, CHANTIERS_COLS);

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
