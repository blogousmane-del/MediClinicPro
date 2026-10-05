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

// LIKE de PostgREST : `%` couvre n'importe quelle suite, `_` un seul caractère,
// tout le reste est littéral (le point d'une date ISO compris).
function likeToRegExp(pattern) {
  const escaped = String(pattern)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, 's');
}

// Reproduit la partie de l'API PostgREST utilisée par les routes :
// .from().select().eq().maybeSingle() / .single() / .insert() / .update() /
// .delete(),
// le tout « thenable » pour fonctionner avec await.
function queryBuilder(table) {
  const state = { op: 'select', filters: [], payload: null, singleRow: false, count: false, head: false };
  const rowMatches = (row) => state.filters.every(([column, value, op]) => {
    switch (op) {
      case 'in': return value.includes(row[column]);
      // Comparaisons de plage : les dates circulent en ISO 8601 UTC, dont
      // l'ordre lexicographique est l'ordre chronologique, donc `<` suffit et
      // se comporte comme la comparaison PostgREST.
      case 'gte': return row[column] != null && row[column] >= value;
      case 'gt': return row[column] != null && row[column] > value;
      case 'lte': return row[column] != null && row[column] <= value;
      case 'lt': return row[column] != null && row[column] < value;
      case 'like': return row[column] != null && likeToRegExp(value).test(String(row[column]));
      default: return row[column] === value;
    }
  });

  const run = () => {
    const rows = db[table];

    // `nextId` evite la collision apres un delete : `rows.length + 1` reprend
    // un identifiant deja pris des qu'une ligne a disparu. La valeur reste
    // celle d'avant tant qu'aucune suppression n'a eu lieu.
    const nextId = () => {
      let candidate = rows.length + 1;
      while (rows.some((r) => String(r.id) === String(candidate))) candidate += 1;
      return candidate;
    };

    if (state.op === 'insert') {
      // PostgREST accepte un tableau et insere autant de lignes ; le faux ne
      // gerait qu'un objet et transformait le tableau en `{0: {...}}`.
      const payloads = Array.isArray(state.payload) ? state.payload : [state.payload];
      const inserted = payloads.map((payload) => {
        const row = { id: nextId(), ...payload };
        rows.push(row);
        return row;
      });
      return { data: state.singleRow ? inserted[0] : inserted, error: null };
    }

    const hits = rows.filter(rowMatches);

    if (state.op === 'delete') {
      hits.forEach((row) => rows.splice(rows.indexOf(row), 1));
      return { data: hits, error: null };
    }

    if (state.op === 'update') {
      hits.forEach((row) => Object.assign(row, state.payload));
      return { data: state.singleRow ? hits[0] || null : hits, error: null };
    }

    // `.select('*', { count: 'exact', head: true })` : les routes s'en servent
    // pour compter sans rapatrier les lignes (limites de personnel du plan,
    // historique de paiement). Sans `count` ici, la garde comptée passait
    // toujours pour « zéro » et le test validait une protection inerte.
    if (state.count) {
      return { data: state.head ? null : hits, error: null, count: hits.length };
    }

    return { data: state.singleRow ? hits[0] || null : hits, error: null };
  };

  const builder = {
    select(_columns, options) {
      if (options && options.count) {
        state.count = true;
        state.head = options.head === true;
      }
      return builder;
    },
    eq(column, value) { state.filters.push([column, value]); return builder; },
    in(column, values) { state.filters.push([column, values, 'in']); return builder; },
    limit() { return builder; },
    order() { return builder; },
    // Les filtres de plage étaient ignorés ici, au motif que les tests
    // vérifiaient le calcul applicatif et non le filtrage PostgREST. Mais dès
    // qu'une route découpe ses données PAR la requête — le revenu du mois
    // courant contre celui du mois précédent, tous deux lus dans la même table
    // avec des bornes différentes — les ignorer rend les deux lectures
    // identiques, et un test écrit là-dessus valide une séparation qui n'existe
    // pas. Même leçon que le `count` juste au-dessus.
    gte(column, value) { state.filters.push([column, value, 'gte']); return builder; },
    gt(column, value) { state.filters.push([column, value, 'gt']); return builder; },
    lte(column, value) { state.filters.push([column, value, 'lte']); return builder; },
    lt(column, value) { state.filters.push([column, value, 'lt']); return builder; },
    like(column, pattern) { state.filters.push([column, pattern, 'like']); return builder; },
    insert(payload) { state.op = 'insert'; state.payload = payload; return builder; },
    update(payload) { state.op = 'update'; state.payload = payload; return builder; },
    delete() { state.op = 'delete'; return builder; },
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
