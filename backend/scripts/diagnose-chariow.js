#!/usr/bin/env node
// Diagnostic Chariow — à lancer à la main quand « la clé ne marche pas ».
//
//   cd backend
//   node scripts/diagnose-chariow.js <votre_cle_api>
//
// La clé est lue depuis l'argument ou depuis CHARIOW_DIAG_KEY, jamais depuis la
// base : le but est justement de savoir si la clé elle-même est acceptée, sans
// dépendre de ce qui est enregistré.
//
// Rien n'est écrit nulle part. Aucune vente n'est créée. Uniquement des GET.
// La clé n'est jamais affichée en entier — la sortie de ce script est faite
// pour être copiée dans une conversation de support.

const apiKey = (process.argv[2] || process.env.CHARIOW_DIAG_KEY || '').trim();
const apiUrl = (process.env.CHARIOW_API_URL || 'https://api.chariow.com/v1').replace(/\/+$/, '');

if (!apiKey) {
  console.error('Usage : node scripts/diagnose-chariow.js <votre_cle_api>');
  process.exit(1);
}

// Empreinte, pas la valeur : assez pour vérifier qu'on teste bien la même clé
// des deux côtés, inutilisable pour quiconque la lirait.
const masked = `${apiKey.slice(0, 4)}…${apiKey.slice(-2)} (${apiKey.length} caractères)`;

function looksSuspicious(key) {
  const notes = [];
  if (/\s/.test(key)) notes.push('elle contient un espace ou un saut de ligne — probable copier-coller de trop');
  if (/^["']|["']$/.test(key)) notes.push('elle commence ou finit par un guillemet');
  if (/^https?:\/\//i.test(key)) notes.push("c'est une adresse web, pas une clé");
  if (key.length < 16) notes.push('elle est très courte pour une clé API');
  return notes;
}

async function probe(pathname) {
  const started = Date.now();
  try {
    const res = await fetch(`${apiUrl}${pathname}`, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });
    const raw = await res.text();
    return { ok: res.ok, status: res.status, raw, ms: Date.now() - started };
  } catch (err) {
    return { networkError: err.message, ms: Date.now() - started };
  }
}

(async () => {
  console.log('--- Diagnostic Chariow ---');
  console.log(`API      : ${apiUrl}`);
  console.log(`Clé      : ${masked}`);

  const suspicions = looksSuspicious(apiKey);
  for (const note of suspicions) console.log(`ATTENTION: ${note}`);

  const result = await probe('/products');

  if (result.networkError) {
    console.log(`Réseau   : ÉCHEC après ${result.ms} ms — ${result.networkError}`);
    console.log("\nChariow est injoignable depuis cette machine. Ce n'est pas un problème de clé.");
    process.exit(2);
  }

  console.log(`HTTP     : ${result.status} en ${result.ms} ms`);

  let body = null;
  try {
    body = JSON.parse(result.raw);
  } catch {
    console.log('Corps    : réponse NON JSON (extrait ci-dessous)');
    console.log(result.raw.slice(0, 400));
    console.log("\nUne passerelle ou un pare-feu répond à la place de l'API.");
    process.exit(2);
  }

  if (!result.ok) {
    console.log(`Corps    : ${JSON.stringify(body).slice(0, 400)}`);
    if (result.status === 401) console.log('\n401 : clé refusée. Vérifiez qu\'elle vient bien de Chariow > API.');
    if (result.status === 403) console.log('\n403 : clé reconnue mais sans les droits nécessaires.');
    if (result.status === 404) console.log(`\n404 : l'endpoint ${apiUrl}/products n'existe pas. L'URL d'API est peut-être différente pour votre compte.`);
    process.exit(2);
  }

  const rows = Array.isArray(body.data) ? body.data : (body.data && body.data.products) || body.products || [];
  console.log(`Produits : ${rows.length} trouvé(s)`);

  for (const p of rows) {
    const price = p.price && p.price.value !== undefined ? p.price.value : p.price;
    const currency = (p.price && p.price.currency) || p.currency || '?';
    console.log(`  ${p.id}  ${String(price).padStart(8)} ${currency}  ${p.name || ''}`);
  }

  const foreign = rows.filter((p) => {
    const c = (p.price && p.price.currency) || p.currency;
    return c && String(c).toUpperCase() !== 'XOF';
  });
  if (foreign.length) {
    console.log(`\nATTENTION: ${foreign.length} produit(s) hors XOF. MediClinic n'accepte que le XOF.`);
  }

  console.log('\nLa clé fonctionne. Si l\'écran de configuration la refuse malgré ça, le problème est côté serveur, pas côté Chariow.');
})();
