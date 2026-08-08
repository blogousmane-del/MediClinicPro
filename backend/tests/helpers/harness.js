// Harnais de test partagé. Charge les VRAIES routes et ne remplace que ce qui
// sort de la machine : Supabase, le réseau, l'authentification.
const path = require('node:path');
const express = require('express');

const BACKEND = path.join(__dirname, '..', '..');

const db = new Proxy({}, {
  get(tables, name) {
    if (typeof name === 'string' && !tables[name]) tables[name] = [];
    return tables[name];
  }
});

function resetDb() {
  for (const table of Object.keys(db)) db[table].length = 0;
}

// Remplace un module du backend dans le cache de require. Doit être appelé
// AVANT le require du module de route qui en dépend.
function stubModule(relativePath, exports) {
  const file = require.resolve(path.join(BACKEND, relativePath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports, children: [], paths: [] };
}

// Reproduit la partie de l'API PostgREST utilisée par les routes :
// .from().select().eq().maybeSingle() / .single() / .insert() / .update(),
// le tout « thenable » pour fonctionner avec await.
function queryBuilder(table) {
  const state = { op: 'select', filters: [], payload: null, singleRow: false };
  const rowMatches = (row) => state.filters.every(([column, value]) => row[column] === value);

  const run = () => {
    const rows = db[table];

    if (state.op === 'insert') {
      const row = { id: rows.length + 1, ...state.payload };
      rows.push(row);
      return { data: state.singleRow ? row : [row], error: null };
    }

    const hits = rows.filter(rowMatches);

    if (state.op === 'update') {
      hits.forEach((row) => Object.assign(row, state.payload));
      return { data: state.singleRow ? hits[0] || null : hits, error: null };
    }

    return { data: state.singleRow ? hits[0] || null : hits, error: null };
  };

  const builder = {
    select() { return builder; },
    eq(column, value) { state.filters.push([column, value]); return builder; },
    limit() { return builder; },
    order() { return builder; },
    // Filtres de plage ignorés : les tests posent des dates explicites et
    // vérifient le calcul applicatif, pas le filtrage PostgREST.
    gte() { return builder; },
    lt() { return builder; },
    insert(payload) { state.op = 'insert'; state.payload = payload; return builder; },
    update(payload) { state.op = 'update'; state.payload = payload; return builder; },
    upsert(payload) { state.op = 'insert'; state.payload = payload; return builder; },
    maybeSingle() { state.singleRow = true; return builder; },
    single() { state.singleRow = true; return builder; },
    then(onOk, onErr) { return Promise.resolve().then(run).then(onOk, onErr); }
  };
  return builder;
}

function makeSupabaseStub() {
  return { from: queryBuilder };
}

function authStub(user = { userId: 1, clinicId: 1, role: 'admin' }) {
  return {
    auth: (req, _res, next) => { req.user = { ...user }; next(); },
    checkRole: () => (_req, _res, next) => next()
  };
}

// `verify` reproduit server.js : il capture le corps brut, indispensable à la
// vérification de signature des webhooks.
async function startApp(mounts) {
  const app = express();
  app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
  for (const [mountPath, router] of mounts) app.use(mountPath, router);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => server.close()
  };
}

module.exports = { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND };
