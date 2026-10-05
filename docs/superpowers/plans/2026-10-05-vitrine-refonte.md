# Refonte de la vitrine (chantier 1) : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la vitrine, la page de connexion et les CGU par la direction A validée (« Clair et précis ») : les vraies captures du logiciel, WhatsApp à portée de clic, des prix et une durée d'essai lus dans l'API, un aperçu de lien qui fonctionne.

**Architecture:** La vitrine devient un assemblage de sections React (`frontend/src/pages/Landing/`, une section par fichier) sur un système visuel à part : `frontend/src/styles/site.css`, jetons déclarés sous `.site`, classes préfixées `vt-`. Les captures sont produites par un script Playwright qui pilote l'application réelle avec une API simulée, puis converties en AVIF et WebP. Côté backend, un seul changement : `GET /settings/public/plans` renvoie la durée d'essai réellement appliquée.

**Tech Stack:** React 19, TypeScript, Vite, CSS natif, `@fontsource-variable/geist` et `@fontsource-variable/geist-mono` 5.3.0, `lucide-react`, `playwright-core` (développement) avec le Chrome du poste, `sharp` (existant), `node --test`.

**Références :** spec `docs/superpowers/specs/2026-10-05-vitrine-refonte-design.md`, maquette `docs/superpowers/specs/assets/2026-10-05-vitrine/maquette-direction-a.html`.

## Global Constraints

- Textes visibles en français. Aucun tiret cadratin (—) dans un texte visible. Une intention, un libellé : l'inscription s'écrit toujours « Essayer gratuitement », le contact toujours « Écrire sur WhatsApp ». Un seul surtitre sur la page, celui du héros.
- Prix, limites de comptes et durée d'essai viennent de `GET /settings/public/plans`. Le repli statique (`FALLBACK_CATALOG`) ne sert que si l'API ne répond pas. Aucun autre fichier de la vitrine n'écrit un prix.
- Rien n'est inventé : aucun chiffre d'usage, témoignage ni badge non fondé (« Populaire » disparaît). Les blocs fondateur, raison sociale et photo réelle restent masqués tant que `SITE` ne les renseigne pas.
- CSS natif, ni Tailwind ni CSS modules (convention du dépôt). Jetons déclarés une seule fois sous `.site` dans `frontend/src/styles/site.css`. Toutes les classes de la vitrine portent le préfixe `vt-` : `index.css` définit déjà `.btn` et `.btn-primary`.
- `index.css` pose `font-family` sur chaque élément (`*`) et une couleur sur `h1`-`h6` : la vitrine les redéclare sous `.site` (`.site, .site *` et `.site :is(h1, h2, h3, h4)`), sans quoi Geist ne s'appliquerait à aucun enfant et les titres deviendraient blancs en thème sombre.
- Formes : 10 px pour les contrôles, 16 px pour les panneaux, 12 px pour les captures, 20 px pour le panneau d'appel final. Aucun bouton en pilule. Ombres teintées vert (`rgba(20, 62, 50, …)`), jamais noires.
- Icônes `lucide-react` avec `strokeWidth={1.75}`. Logo WhatsApp : tracé officiel de simple-icons dans `frontend/public/brand/whatsapp.svg`, appliqué en masque CSS, jamais redessiné.
- Vitrine en clair uniquement. Mouvement en CSS seulement, entièrement désactivé sous `prefers-reduced-motion: reduce`. Points de rupture en requêtes média : `max-width: 1080px` (tablette) et `max-width: 640px` (téléphone).
- La CSP de production (`vercel.json`) est appliquée : aucune nouvelle origine, aucun script ni gestionnaire inline, polices auto-hébergées.
- `App.tsx` ne change pas de contrat : `LandingPage` garde `onNavigate('login' | 'register' | 'terms')`, `AuthPage` garde toute sa logique (connexion, inscription, mot de passe oublié, Google, visibilité du mot de passe, états de chargement).
- Les captures n'envoient aucune requête à l'API ni à un service tiers : chaque appel `/api/*` reçoit une réponse locale, et seules les polices Google de l'application sont téléchargées.
- Le dépôt est public : ce plan ne décrit aucune faille ouverte.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `backend/routes/settings.js` | `GET /public/plans` renvoie la durée d'essai effective |
| `backend/tests/public-plans.test.js` | test de ce point |
| `frontend/src/config/site.ts` | identité et contact (étendu : moyens de paiement, fondateur, raison sociale, photo) |
| `frontend/src/utils/frenchList.ts` (+ test) | énumération « a, b et c » / « a, b ou c » |
| `frontend/src/utils/publicPlans.ts` (+ test) | catalogue public : repli, fusion avec l'API, format FCFA |
| `frontend/src/utils/medicalAccess.ts` | réutilise `frenchList` |
| `frontend/src/styles/site.css` | tout le système visuel : vitrine, connexion, CGU |
| `frontend/public/brand/whatsapp.svg` | logo officiel |
| `frontend/src/pages/Landing/*.tsx`, `usePublicCatalog.ts` | une section par fichier, plus les briques partagées |
| `frontend/src/pages/LandingPage.tsx` | réécrit : assemblage des sections |
| `frontend/src/pages/Auth/AuthPage.tsx` | restyle, logique inchangée |
| `frontend/src/pages/TermsOfServicePage.tsx` | restyle, contenu juridique inchangé |
| `frontend/src/pages/Accounting/AccountingPage.tsx` | la facture d'encaissement nomme qui encaisse |
| `frontend/scripts/capture-data.mjs`, `capture-screens.mjs` | captures de l'application réelle |
| `frontend/scripts/optimize-images.mjs` | variantes AVIF et WebP des captures, image de partage |
| `frontend/public/captures/*`, `frontend/public/og-image.png` | images produites |
| `frontend/index.html`, `public/robots.txt`, `public/sitemap.xml` | vrai domaine, image de partage |
| `frontend/src/index.css` | blocs `.landing-*`, `.pricing-cards-grid`, `.auth-*`, `.terms-*`, `--lp-*`, `--tp-*` retirés |
| `CLAUDE.md` | documentation de la vitrine |

---

### Task 0: Mettre la spec à jour

La spec date d'avant les correctifs de sécurité du 2026-10-05, qui ont déjà livré les défauts 6 et 7 et créé `config/site.ts`.

**Files:**
- Modify: `docs/superpowers/specs/2026-10-05-vitrine-refonte-design.md`

- [ ] **Step 1: Appliquer les remplacements**

1. Défaut 6 : ajouter à la fin du paragraphe « Corrigé avant ce chantier, avec le défaut 7. »
2. Défaut 7 : remplacer tout le paragraphe par :
   > 7. **Les modèles d'impression n'échappaient pas les valeurs saisies.** Corrigé avant ce chantier par les correctifs de sécurité du 2026-10-05 (`frontend/src/utils/print.ts`, voir CLAUDE.md, « Printed documents »).
3. Objectif : « corriger les défauts 3, 6, 7 et 8. » devient « corriger les défauts 3 et 8 (6 et 7 l'ont été avant ce chantier). »
4. Système visuel : ajouter sous le tableau des jetons « Toutes les classes de la vitrine portent le préfixe `vt-` : `index.css` définit déjà `.btn` et `.btn-primary`, et un nom générique finirait par entrer en collision. »
5. Section 5, cellule Rôles : le texte devient « Sept rôles, chacun avec ses écrans. Le pharmacien n'a pas accès à la comptabilité, le laborantin ne voit pas la caisse, et le contenu médical est réservé à l'équipe soignante. »
6. FAQ, « Mes données médicales sont-elles protégées ? » : ajouter « contenu médical réservé à l'équipe soignante » à la liste.
7. Configuration du site : « Nouveau fichier `frontend/src/config/site.ts` » devient « `frontend/src/config/site.ts` existe depuis les correctifs de sécurité (numéro WhatsApp de la page de connexion). Il est étendu : », et le bloc de code reçoit `subscriptionPaymentMethods: ['Orange Money', 'MTN MoMo', 'Wave', 'carte bancaire']`.
8. « Correctifs d'impression (défauts 6 et 7) » : remplacer le corps par « Livrés avant ce chantier. `frontend/src/utils/print.ts` sert les quatre impressions, et l'ordonnance porte l'en-tête de la clinique connectée. Un écart reste à corriger ici, parce que la section Documents le rendrait faux : la facture imprimée à l'encaissement ne nomme pas la personne qui encaisse, seule la réimpression le fait. »
9. Fichiers : retirer `frontend/src/utils/print.ts` des créés ; déplacer `frontend/src/config/site.ts` vers les modifiés ; remplacer « `AccountingPage.tsx`, `PatientDetailPage.tsx`, `OrdonnancesPage.tsx` (impression seulement) » par « `AccountingPage.tsx` (la facture nomme qui encaisse) ».
10. Traçabilité : la source de « Pharmacien sans comptabilité, laborantin sans caisse » devient « `Sidebar.tsx` et `checkRole` côté serveur (`role-restrictions.test.js`) » ; ajouter la ligne « Contenu médical réservé à l'équipe soignante | `backend/utils/medicalAccess.js` (`medical-access.test.js`) » et la ligne « Le nom de qui encaisse sur chaque reçu | facture d'encaissement et réimpression, `AccountingPage.tsx` ».
11. Vérification : la ligne « Impression : un patient nommé … » devient « Impression : couverte par `utils/print.test.ts` depuis les correctifs de sécurité. »

- [ ] **Step 2: Vérifier qu'aucune description d'exploitation ne reste**

Run: `grep -nE "onerror|window\.opener|s'emparer" docs/superpowers/specs/2026-10-05-vitrine-refonte-design.md`
Expected: aucune ligne.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-10-05-vitrine-refonte-design.md
git commit -m "docs(vitrine): la spec tient compte des correctifs deja livres"
```

---

### Task 1: La durée d'essai annoncée est celle qu'applique l'inscription (défaut 8)

**Files:**
- Create: `backend/tests/public-plans.test.js`
- Modify: `backend/routes/settings.js` (imports, route `GET /public/plans`)

**Interfaces:**
- Produces: `GET /api/settings/public/plans` → `{ plans: PLANS }`, avec `plans.starter.trialDays` égal au réglage `starter_trial_days` effectif (repli `PLANS.starter.trialDays`).

- [ ] **Step 1: Écrire le test**

```js
// La vitrine annonce la durée d'essai que lui donne GET /settings/public/plans.
// Elle doit être celle qu'applique l'inscription (auth.js : réglage
// starter_trial_days de Platform Admin, repli sur PLANS), pas le 7 écrit en dur
// dans utils/plans.js.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub({ userId: 1, clinicId: 1, role: 'admin' }));

const settings = require(path.join(BACKEND, 'routes', 'settings.js'));
const { PLANS } = require(path.join(BACKEND, 'utils', 'plans.js'));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api/settings', settings]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const getPlans = async () => {
  const res = await fetch(`${baseUrl}/api/settings/public/plans`);
  assert.strictEqual(res.status, 200);
  return (await res.json()).plans;
};

test('la durée d\'essai suit le réglage de la plateforme', async () => {
  resetDb();
  db.platform_settings.push({ key: 'starter_trial_days', value: '14' });
  const plans = await getPlans();
  assert.strictEqual(plans.starter.trialDays, 14);
  assert.strictEqual(plans.clinique.price, PLANS.clinique.price);
  assert.strictEqual(PLANS.starter.trialDays, 7, 'PLANS lui-même ne change pas');
});

test('sans réglage, ou avec un réglage illisible, la durée par défaut', async () => {
  resetDb();
  assert.strictEqual((await getPlans()).starter.trialDays, PLANS.starter.trialDays);
  db.platform_settings.push({ key: 'starter_trial_days', value: 'quatorze' });
  assert.strictEqual((await getPlans()).starter.trialDays, PLANS.starter.trialDays);
});
```

- [ ] **Step 2: Le lancer, il échoue**

Run: `cd backend && node --test tests/public-plans.test.js`
Expected: FAIL sur le premier test, `7 !== 14`.

- [ ] **Step 3: Implémenter**

Dans `backend/routes/settings.js`, après l'import de `../utils/plans` :

```js
const { getSettings } = require('../utils/platformSettings');
```

Remplacer la route :

```js
// La durée d'essai renvoyée est celle qu'applique l'inscription (réglage
// starter_trial_days de Platform Admin, lu comme dans auth.js) : PLANS tel
// quel annonçait 7 jours même quand l'exploitant en accordait 14. Si les
// réglages sont illisibles, la vitrine garde PLANS plutôt qu'une erreur.
router.get('/public/plans', async (req, res) => {
  let trialDays = PLANS.starter.trialDays;
  try {
    const { values } = await getSettings();
    trialDays = values.starter_trial_days || trialDays;
  } catch (error) {
    console.error('Public Plans Settings Error:', error);
  }
  res.json({ plans: { ...PLANS, starter: { ...PLANS.starter, trialDays } } });
});
```

- [ ] **Step 4: Les tests passent**

Run: `cd backend && npm test`
Expected: tous les tests passent, dont les 2 nouveaux.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/settings.js backend/tests/public-plans.test.js
git commit -m "fix(vitrine): les tarifs publics annoncent la duree d'essai reellement appliquee"
```

---

### Task 2: Fondations (dépendances, configuration, catalogue, styles, briques partagées)

**Files:**
- Modify: `frontend/package.json`, `frontend/package-lock.json` (par `npm install`)
- Modify: `frontend/src/config/site.ts`
- Create: `frontend/src/utils/frenchList.ts`, `frontend/src/utils/frenchList.test.ts`
- Modify: `frontend/src/utils/medicalAccess.ts`
- Create: `frontend/src/utils/publicPlans.ts`, `frontend/src/utils/publicPlans.test.ts`
- Create: `frontend/public/brand/whatsapp.svg`
- Create: `frontend/src/styles/site.css`
- Create: `frontend/src/pages/Landing/usePublicCatalog.ts`, `WhatsApp.tsx`, `Capture.tsx`

**Interfaces:**
- Produces:
  - `SITE` : `{ url, whatsapp: { display, e164, message }, subscriptionPaymentMethods: string[], founder: Founder | null, legal: Legal | null, fieldPhoto: FieldPhoto | null }`, et `whatsappUrl(text?: string): string` (inchangé).
  - `frenchList(items: readonly string[], conjunction?: 'et' | 'ou'): string`
  - `type PlanId = 'starter' | 'clinique' | 'hopital'`, `interface PublicPlan { price: number; staffLimit: number | null; trialDays: number | null }`, `type PublicCatalog = Record<PlanId, PublicPlan>`, `FALLBACK_CATALOG`, `mergeCatalog(live: unknown): PublicCatalog`, `trialDaysOf(catalog: PublicCatalog): number`, `formatFcfa(amount: number): string`
  - `usePublicCatalog(): PublicCatalog`
  - `<WhatsAppIcon />`, `<WhatsAppLink className? label? message? onClick? />`
  - `<Capture name alt sizes phoneSizes? priority? />`, `<PhoneCapture name alt sizes />`, `<ReceiptCapture alt />`

- [ ] **Step 1: Installer les dépendances**

```bash
cd frontend
npm install @fontsource-variable/geist@^5.3.0 @fontsource-variable/geist-mono@^5.3.0
npm install -D playwright-core@^1.63.0
```

Vérifier les noms de famille déclarés : `grep -h "font-family" node_modules/@fontsource-variable/geist/index.css node_modules/@fontsource-variable/geist-mono/index.css | sort -u`
Expected : `'Geist Variable'` et `'Geist Mono Variable'` (sinon reporter les noms réels dans `site.css`).

- [ ] **Step 2: Tests de `frenchList` et `publicPlans`**

`frontend/src/utils/frenchList.test.ts` :

```ts
// Lancé par `npm test` (node --test, retrait des types natif à Node 26).
import test from 'node:test';
import assert from 'node:assert/strict';
import { frenchList } from './frenchList.ts';

test('énumère à la française, avec « et » ou « ou » avant le dernier élément', () => {
  assert.equal(frenchList([]), '');
  assert.equal(frenchList(['Wave']), 'Wave');
  assert.equal(frenchList(['Wave', 'carte bancaire'], 'ou'), 'Wave ou carte bancaire');
  assert.equal(frenchList(['consultations', 'ordonnances', 'examens']), 'consultations, ordonnances et examens');
});
```

`frontend/src/utils/publicPlans.test.ts` :

```ts
// Lancé par `npm test` (node --test, retrait des types natif à Node 26).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK_CATALOG, mergeCatalog, trialDaysOf, formatFcfa } from './publicPlans.ts';

test('sans réponse exploitable, le catalogue de repli', () => {
  assert.deepEqual(mergeCatalog(undefined), FALLBACK_CATALOG);
  assert.deepEqual(mergeCatalog('erreur'), FALLBACK_CATALOG);
  assert.equal(trialDaysOf(mergeCatalog(null)), 7);
});

test('les valeurs de l\'API remplacent le repli, y compris la durée d\'essai', () => {
  const catalog = mergeCatalog({
    starter: { id: 'starter', price: 0, trialDays: 14, staffLimit: 3 },
    clinique: { id: 'clinique', price: 9500, trialDays: null, staffLimit: 6 },
    hopital: { id: 'hopital', price: 15000, trialDays: null, staffLimit: null }
  });
  assert.equal(trialDaysOf(catalog), 14);
  assert.deepEqual(catalog.clinique, { price: 9500, staffLimit: 6, trialDays: null });
  assert.equal(catalog.hopital.staffLimit, null);
});

test('une valeur malformée garde le repli plutôt qu\'afficher « NaN FCFA »', () => {
  const catalog = mergeCatalog({ clinique: { price: '9000', staffLimit: 'cinq' }, starter: { trialDays: 0 } });
  assert.deepEqual(catalog.clinique, FALLBACK_CATALOG.clinique);
  assert.equal(trialDaysOf(catalog), 7);
});

test('les montants s\'écrivent avec une espace fine insécable entre les milliers', () => {
  assert.equal(formatFcfa(0), '0');
  assert.equal(formatFcfa(9000), '9 000');
  assert.equal(formatFcfa(14500), '14 500');
  assert.equal(formatFcfa(1234567), '1 234 567');
});
```

Run: `cd frontend && npm test`
Expected: FAIL, modules introuvables.

- [ ] **Step 3: `frenchList.ts`, `publicPlans.ts`, et `medicalAccess.ts` qui réutilise `frenchList`**

`frontend/src/utils/frenchList.ts` :

```ts
// Énumération à la française : « a », « a et b », « a, b et c » (ou « ou »).
export const frenchList = (items: readonly string[], conjunction: 'et' | 'ou' = 'et'): string => {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
};
```

`frontend/src/utils/publicPlans.ts` :

```ts
// Catalogue public des formules, lu par la vitrine et la page d'inscription
// dans GET /settings/public/plans (backend/utils/plans.js, durée d'essai
// effective comprise). Le repli ne sert que si l'API ne répond pas : la
// vitrine doit s'afficher backend éteint, sans devenir la référence des prix.
export type PlanId = 'starter' | 'clinique' | 'hopital';

export interface PublicPlan {
  price: number;
  staffLimit: number | null;
  trialDays: number | null;
}

export type PublicCatalog = Record<PlanId, PublicPlan>;

export const FALLBACK_CATALOG: PublicCatalog = {
  starter: { price: 0, staffLimit: 3, trialDays: 7 },
  clinique: { price: 9000, staffLimit: 5, trialDays: null },
  hopital: { price: 14500, staffLimit: null, trialDays: null },
};

const PLAN_IDS = Object.keys(FALLBACK_CATALOG) as PlanId[];

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const nullableCount = (value: unknown, fallback: number | null): number | null =>
  value === null || isCount(value) ? value : fallback;

// Chaque valeur reçue n'est retenue que si elle est plausible : une réponse
// partielle ou malformée garde le repli plutôt qu'afficher « NaN FCFA ».
export const mergeCatalog = (live: unknown): PublicCatalog => {
  const source = live !== null && typeof live === 'object' ? (live as Record<string, unknown>) : {};
  const merged = {} as PublicCatalog;
  for (const id of PLAN_IDS) {
    const fallback = FALLBACK_CATALOG[id];
    const raw = source[id];
    const plan = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    merged[id] = {
      price: isCount(plan.price) ? plan.price : fallback.price,
      staffLimit: nullableCount(plan.staffLimit, fallback.staffLimit),
      trialDays: nullableCount(plan.trialDays, fallback.trialDays),
    };
  }
  return merged;
};

// Durée de l'essai gratuit, en jours : jamais zéro ni vide à l'écran.
export const trialDaysOf = (catalog: PublicCatalog): number => {
  const days = catalog.starter.trialDays;
  return days !== null && days > 0 ? days : (FALLBACK_CATALOG.starter.trialDays as number);
};

// 9000 → « 9 000 », avec l'espace fine insécable de la typographie française :
// un prix ne se coupe jamais en fin de ligne.
export const formatFcfa = (amount: number): string =>
  String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
```

Dans `frontend/src/utils/medicalAccess.ts`, ajouter `import { frenchList } from './frenchList.ts';` en tête et remplacer les trois lignes qui construisent `list` par :

```ts
  return `Réservé à l'équipe soignante : ${frenchList(labels)}.`;
```

Run: `cd frontend && npm test`
Expected: PASS (dont les 3 tests existants de `medicalAccess.test.ts`).

- [ ] **Step 4: `config/site.ts` étendu**

```ts
// Coordonnées et identité publiques de MediClinic : seule source pour la
// vitrine, la page de connexion et les CGU. Un bloc dont la donnée vaut null
// n'est pas affiché : rien n'est inventé en attendant que le propriétaire la
// fournisse.
export interface Founder {
  name: string;
  role: string; // « fondateur de MediClinic »
  photo: string; // chemin sous public/, portrait 4:5
  quote: string; // deux ou trois phrases à la première personne
}

export interface Legal {
  name: string; // raison sociale
  rccm: string;
}

export interface FieldPhoto {
  src: string;
  alt: string;
}

export const SITE = {
  url: 'https://mediclinicpro.com',
  whatsapp: {
    display: '+225 07 88 81 81 18',
    e164: '2250788818118',
    message: 'Bonjour, je souhaite en savoir plus sur MediClinic.',
  },
  // Moyens de paiement de l'abonnement, tels que les accepte la boutique
  // Chariow : la vitrine les affiche tels quels, à tenir identiques.
  subscriptionPaymentMethods: ['Orange Money', 'MTN MoMo', 'Wave', 'carte bancaire'] as readonly string[],
  founder: null as Founder | null,
  legal: null as Legal | null,
  fieldPhoto: null as FieldPhoto | null,
};

export const whatsappUrl = (text: string = SITE.whatsapp.message): string =>
  `https://wa.me/${SITE.whatsapp.e164}?text=${encodeURIComponent(text)}`;
```

- [ ] **Step 5: Logo WhatsApp officiel**

Le tracé vient du paquet `simple-icons`, sans modification :

```bash
cd "$SCRATCH" && npm pack simple-icons@latest --silent
tar -xzf simple-icons-*.tgz package/icons/whatsapp.svg
mkdir -p <repo>/frontend/public/brand && cp package/icons/whatsapp.svg <repo>/frontend/public/brand/whatsapp.svg
```

Vérifier : le fichier contient `<title>WhatsApp</title>` et un seul `<path d="…">`, `viewBox="0 0 24 24"`.

- [ ] **Step 6: `frontend/src/styles/site.css`**

Voir l'annexe A (fichier complet).

- [ ] **Step 7: Briques partagées**

`frontend/src/pages/Landing/usePublicCatalog.ts` :

```ts
import { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import { FALLBACK_CATALOG, mergeCatalog, type PublicCatalog } from '../../utils/publicPlans';

// Catalogue réel, chargé une fois. Un échec est silencieux : le repli reste
// affiché plutôt qu'une page tarifs vide ou une erreur montrée à un visiteur.
export const usePublicCatalog = (): PublicCatalog => {
  const [catalog, setCatalog] = useState<PublicCatalog>(FALLBACK_CATALOG);
  useEffect(() => {
    let cancelled = false;
    api.get('/settings/public/plans')
      .then((data: { plans?: unknown }) => { if (!cancelled) setCatalog(mergeCatalog(data?.plans)); })
      .catch(() => { /* repli sur FALLBACK_CATALOG */ });
    return () => { cancelled = true; };
  }, []);
  return catalog;
};
```

`frontend/src/pages/Landing/WhatsApp.tsx` :

```tsx
import { whatsappUrl } from '../../config/site';

// Logo officiel (public/brand/whatsapp.svg) appliqué en masque CSS : sa
// couleur suit celle du bouton qui le porte.
export const WhatsAppIcon = () => <span className="vt-wa" aria-hidden="true" />;

interface WhatsAppLinkProps {
  className?: string;
  label?: string;
  message?: string;
  onClick?: () => void;
}

// Tous les liens WhatsApp ouvrent wa.me dans un nouvel onglet, message prérempli.
export const WhatsAppLink = ({ className, label = 'Écrire sur WhatsApp', message, onClick }: WhatsAppLinkProps) => (
  <a className={className} href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer" onClick={onClick}>
    <WhatsAppIcon />
    {label}
  </a>
);
```

`frontend/src/pages/Landing/Capture.tsx` :

```tsx
// Captures de l'application réelle (npm run captures), en AVIF et WebP à deux
// largeurs. Sous 640 px, la version téléphone remplace la capture de bureau :
// un écran de 1440 px réduit à 350 px ne se lit plus.
const DESKTOP_WIDTHS = [900, 1800];
const MOBILE_WIDTHS = [390, 780];
const RECEIPT_WIDTHS = [520, 1040];
const PHONE_QUERY = '(max-width: 640px)';

const srcSet = (name: string, widths: number[], ext: 'avif' | 'webp') =>
  widths.map((width) => `/captures/${name}-${width}.${ext} ${width}w`).join(', ');

interface CaptureProps {
  name: string;
  alt: string;
  sizes: string;
  phoneSizes?: string;
  priority?: boolean;
}

export const Capture = ({ name, alt, sizes, phoneSizes = '80vw', priority = false }: CaptureProps) => (
  <picture>
    <source media={PHONE_QUERY} type="image/avif" srcSet={srcSet(`${name}-mobile`, MOBILE_WIDTHS, 'avif')} sizes={phoneSizes} />
    <source media={PHONE_QUERY} type="image/webp" srcSet={srcSet(`${name}-mobile`, MOBILE_WIDTHS, 'webp')} sizes={phoneSizes} />
    <source type="image/avif" srcSet={srcSet(name, DESKTOP_WIDTHS, 'avif')} sizes={sizes} />
    <img
      src={`/captures/${name}-${DESKTOP_WIDTHS[0]}.webp`}
      srcSet={srcSet(name, DESKTOP_WIDTHS, 'webp')}
      sizes={sizes}
      alt={alt}
      width={1440}
      height={900}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
    />
  </picture>
);

// Capture téléphone seule, pour la cellule « Sur ordinateur comme sur téléphone ».
export const PhoneCapture = ({ name, alt, sizes }: { name: string; alt: string; sizes: string }) => (
  <picture>
    <source type="image/avif" srcSet={srcSet(`${name}-mobile`, MOBILE_WIDTHS, 'avif')} sizes={sizes} />
    <img
      src={`/captures/${name}-mobile-${MOBILE_WIDTHS[0]}.webp`}
      srcSet={srcSet(`${name}-mobile`, MOBILE_WIDTHS, 'webp')}
      sizes={sizes}
      alt={alt}
      width={390}
      height={844}
      loading="lazy"
      decoding="async"
    />
  </picture>
);

// Le reçu imprimé réel, photographié dans sa fenêtre d'impression.
export const ReceiptCapture = ({ alt }: { alt: string }) => (
  <picture>
    <source type="image/avif" srcSet={srcSet('receipt', RECEIPT_WIDTHS, 'avif')} sizes="(max-width: 1080px) 86vw, 412px" />
    <img
      src={`/captures/receipt-${RECEIPT_WIDTHS[0]}.webp`}
      srcSet={srcSet('receipt', RECEIPT_WIDTHS, 'webp')}
      sizes="(max-width: 1080px) 86vw, 412px"
      alt={alt}
      width={1640}
      height={2200}
      loading="lazy"
      decoding="async"
    />
  </picture>
);
```

- [ ] **Step 8: Vérifier et commiter**

Run: `cd frontend && npm test && npm run build && npm run lint`
Expected: tests verts, build sans erreur, nombre d'avertissements de lint inchangé (24).

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/config/site.ts frontend/src/utils/frenchList.ts frontend/src/utils/frenchList.test.ts frontend/src/utils/medicalAccess.ts frontend/src/utils/publicPlans.ts frontend/src/utils/publicPlans.test.ts frontend/public/brand/whatsapp.svg frontend/src/styles/site.css frontend/src/pages/Landing
git commit -m "feat(vitrine): fondations (Geist, systeme visuel, catalogue public, briques partagees)"
```

---
### Task 3: Captures de l'application réelle

La section Documents promet que le nom de la personne qui encaisse figure sur chaque reçu. C'est vrai de la réimpression, pas de la facture imprimée à l'encaissement : on corrige d'abord ce point, puis on produit les captures.

**Files:**
- Modify: `frontend/src/pages/Accounting/AccountingPage.tsx`
- Create: `frontend/scripts/capture-data.mjs`, `frontend/scripts/capture-screens.mjs`
- Modify: `frontend/scripts/optimize-images.mjs` (réécrit), `frontend/package.json` (script `captures`), `.gitignore`
- Create (produits) : `frontend/public/captures/*.avif|webp`, `frontend/public/og-image.png`

**Interfaces:**
- Consumes: l'application telle qu'elle est (`npm run dev` n'a pas besoin de tourner, le script démarre Vite lui-même).
- Produces: `/captures/<écran>-900|1800.(avif|webp)`, `/captures/<écran>-mobile-390|780.(avif|webp)` pour `dashboard`, `patients`, `patient-detail`, `laboratory`, `pharmacy`, `accounting` ; `/captures/receipt-520|1040.(avif|webp)` ; `/og-image.png` (1200 × 630). Ce sont les noms que lit `Capture.tsx`.

- [ ] **Step 1: La facture d'encaissement nomme qui encaisse**

Dans `AccountingPage.tsx`, `const { clinic } = useAuth();` devient `const { user, clinic } = useAuth();`, et dans `buildInvoiceReceiptHtml` la ligne du mode de paiement devient :

```ts
        <strong>Mode de paiement :</strong> ${escapeHtml(paymentMethodLabel(paymentMethod))}<br>
        <strong>Encaissé par :</strong> ${escapeHtml(user?.name || '')}
```

Le serveur enregistre l'encaissement au nom de l'utilisateur connecté (`user_id`) : c'est le même nom que la réimpression lira dans `cashier_name`.

Dans le même fichier, la répartition par mode de paiement affichait la valeur brute (`cash`) : `{d.method} :` devient `{paymentMethodLabel(d.method)} :`, et le `textTransform: 'capitalize'` de ce `span` disparaît.

- [ ] **Step 2: Données d'exemple, `frontend/scripts/capture-data.mjs`**

```js
// Données d'exemple des captures de la vitrine (capture-screens.mjs) : une
// clinique fictive, son équipe, ses patients, son stock et sa caisse du jour.
// Tout est inventé, et la vitrine le dit sous les captures (« données
// d'exemple »). Les dates partent d'aujourd'hui : le tableau de bord montre
// toujours la journée en cours.
const now = new Date();
const year = now.getFullYear();
const at = (hour, minute, dayOffset = 0) => {
  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};
const isoDay = (dayOffset) => at(12, 0, dayOffset).slice(0, 10);

const CLINIC = {
  id: 7,
  name: 'Cabinet Médical Les Palmiers',
  address: 'Cocody Riviera 3, Abidjan',
  phone: '+2250701020304',
  logo: '',
  plan: 'hopital',
  subscription_status: 'active',
  subscription_expires_at: at(9, 0, 120),
  // Clinique exonérée de TVA : les reçus montrent le total encaissé, sans ligne de TVA.
  settings: { vat_enabled: false },
};

const ME = {
  user: { id: 1, name: 'Mariam Koné', email: 'direction@palmiers.example', role: 'admin', passwordSet: true, availabilityStatus: 'available' },
  clinic: CLINIC,
  suspended: false,
};

const STAFF = [
  { id: 1, name: 'Mariam Koné', role: 'admin', specialty: null },
  { id: 2, name: 'Dr Serge Konan', role: 'doctor', specialty: 'Médecine générale' },
  { id: 3, name: 'Dr Awa Traoré', role: 'doctor', specialty: 'Pédiatrie' },
  { id: 4, name: 'Grâce Aka', role: 'secretary', specialty: null },
  { id: 5, name: 'Yves Ehui', role: 'pharmacist', specialty: null },
  { id: 6, name: 'Fatou Diabaté', role: 'lab_tech', specialty: null },
  { id: 7, name: 'Christelle Gnahoré', role: 'nurse', specialty: null },
].map((member) => ({
  ...member,
  clinic_id: CLINIC.id,
  active: 1,
  email: `equipe${member.id}@palmiers.example`,
  availability_status: 'available',
  work_schedule: null,
}));

const PATIENTS = [
  ['Aya', "N'Guessan", 'F', '1991-04-12', '+2250707112233', 'Pénicilline'],
  ['Mamadou', 'Coulibaly', 'M', '1978-09-03', '+2250505443322', ''],
  ['Adjoua', 'Kouassi', 'F', '2016-02-21', '+2250102334455', ''],
  ['Koffi', 'Yao', 'M', '1965-11-30', '+2250708991122', 'Aspirine'],
  ['Fatoumata', 'Bamba', 'F', '1988-07-17', '+2250545667788', ''],
  ['Jean-Baptiste', 'Kouamé', 'M', '1983-01-09', '+2250777889900', ''],
  ['Marie-Laure', 'Assi', 'F', '1995-05-25', '+2250103445566', 'Sulfamides'],
  ['Ibrahim', 'Touré', 'M', '2001-12-02', '+2250506778899', ''],
  ['Rose', 'Dosso', 'F', '1972-03-14', '+2250709223344', ''],
].map(([first_name, last_name, gender, birth_date, phone, allergies], index) => ({
  id: index + 1,
  clinic_id: CLINIC.id,
  folder_number: `MED-${year}-${String(412 - index * 37).padStart(4, '0')}`,
  first_name,
  last_name,
  gender,
  birth_date,
  phone,
  allergies,
  antecedents: '',
  email: '',
  address: 'Abidjan',
  archived: 0,
  created_at: at(8, 30, -index * 9),
}));

const byName = (a, b) => a.last_name.localeCompare(b.last_name, 'fr') || a.first_name.localeCompare(b.first_name, 'fr');
const staffName = (id) => STAFF.find((member) => member.id === id).name;

const APPOINTMENTS = [
  [8, 30, 0, 2, 'Consultation de suivi', 'completed'],
  [9, 15, 2, 3, 'Fièvre et toux', 'completed'],
  [10, 0, 3, 2, 'Contrôle de tension', 'scheduled'],
  [10, 45, 4, 3, 'Vaccination', 'scheduled'],
  [11, 30, 5, 2, 'Douleurs abdominales', 'scheduled'],
  [14, 0, 6, 2, "Résultats d'analyses", 'scheduled'],
].map(([hour, minute, patientIndex, practitionerId, motif, status], index) => {
  const patient = PATIENTS[patientIndex];
  return {
    id: index + 1,
    clinic_id: CLINIC.id,
    patient_id: patient.id,
    practitioner_id: practitionerId,
    date_time: at(hour, minute),
    duration: 30,
    motif,
    status,
    priority: 'normal',
    room: null,
    notes: '',
    patient_first_name: patient.first_name,
    patient_last_name: patient.last_name,
    patient_phone: patient.phone,
    patient_birth_date: patient.birth_date,
    practitioner_name: staffName(practitionerId),
  };
});

const LAB_EXAMS = [
  [0, 'Numération formule sanguine (NFS)', 2, 8, 50],
  [3, 'Glycémie à jeun', 2, 9, 5],
  [2, 'Goutte épaisse (paludisme)', 3, 9, 35],
  [5, 'Créatininémie', 2, 10, 10],
  [8, 'Bilan lipidique', 2, 10, 20],
].map(([patientIndex, test_name, doctorId, hour, minute], index) => {
  const patient = PATIENTS[patientIndex];
  return {
    id: index + 1,
    clinic_id: CLINIC.id,
    patient_id: patient.id,
    consultation_id: 30 + index,
    doctor_id: doctorId,
    technician_id: null,
    test_name,
    status: 'pending',
    results_json: null,
    results_text: null,
    created_at: at(hour, minute),
    patient_first_name: patient.first_name,
    patient_last_name: patient.last_name,
    folder_number: patient.folder_number,
    birth_date: patient.birth_date,
    gender: patient.gender,
    doctor_name: staffName(doctorId),
  };
});

// Fabricants et grossistes fictifs : aucun nom réel de la profession.
const MEDICATIONS = [
  ['Paracétamol', '500 mg', 'Comprimé', 'boîte', 'Labo Lagune', 420, 50, 450, 800, 'Grossiste Plateau', 300],
  ['Amoxicilline', '1 g', 'Comprimé', 'boîte', 'Labo Savane', 64, 30, 1850, 2600, 'Grossiste Yopougon', 210],
  ['Artéméther-Luméfantrine', '80/480 mg', 'Comprimé', 'boîte', 'Labo Atlantique', 12, 25, 2400, 3500, 'Grossiste Plateau', 160],
  ['Métronidazole', '250 mg', 'Comprimé', 'boîte', 'Labo Lagune', 88, 30, 900, 1400, 'Grossiste Yopougon', 25],
  ['Sérum salé isotonique', '500 ml', 'Flacon', 'flacon', 'Labo Savane', 140, 40, 650, 1000, 'Grossiste Plateau', 400],
  ['Ibuprofène', '400 mg', 'Comprimé', 'boîte', 'Labo Atlantique', 18, 30, 700, 1100, 'Grossiste Plateau', 240],
  ['Oméprazole', '20 mg', 'Gélule', 'boîte', 'Labo Lagune', 52, 20, 1200, 1900, 'Grossiste Yopougon', 330],
  ['Vitamine C', '500 mg', 'Comprimé', 'boîte', 'Labo Savane', 75, 20, 800, 1300, 'Grossiste Plateau', 40],
  ['Cotrimoxazole', '480 mg', 'Comprimé', 'boîte', 'Labo Atlantique', 9, 20, 950, 1500, 'Grossiste Yopougon', 280],
].map(([name, dosage, form, unit, manufacturer, stock_quantity, min_stock_threshold, price_purchase, price_sale, supplier, expiresInDays], index) => ({
  id: index + 1,
  clinic_id: CLINIC.id,
  name,
  dosage,
  form,
  unit,
  manufacturer,
  batch_number: `LOT-${year}-${1040 + index * 7}`,
  expiry_date: isoDay(expiresInDays),
  stock_quantity,
  min_stock_threshold,
  price_purchase,
  price_sale,
  supplier,
}));

// Caisse du jour, la plus récente en premier : son reçu est celui de la capture.
const PAYMENTS = [
  [0, 11, 10, 'Grâce Aka', [['Consultation', 'Consultation de suivi', 15000], ['Laboratoire', 'Numération formule sanguine (NFS)', 6500], ['Pharmacie', 'Fer + acide folique, 30 jours', 6900]]],
  [1, 10, 58, 'Yves Ehui', [['Pharmacie', 'Amoxicilline 1 g, 2 boîtes', 5200], ['Pharmacie', 'Paracétamol 500 mg, 4 boîtes', 3200]]],
  [3, 10, 25, 'Grâce Aka', [['Consultation', 'Contrôle de tension', 10000]]],
  [2, 9, 44, 'Grâce Aka', [['Laboratoire', 'Goutte épaisse (paludisme)', 5000]]],
  [2, 9, 40, 'Grâce Aka', [['Consultation', 'Consultation pédiatrique', 12000]]],
  [4, 8, 52, 'Grâce Aka', [['Soins', 'Vaccination', 7500]]],
].map(([patientIndex, hour, minute, cashier, lines], index) => {
  const patient = PATIENTS[patientIndex];
  const id = 42 - index;
  const items = lines.map(([type, name, cost]) => ({ type, name, cost }));
  return {
    id,
    clinic_id: CLINIC.id,
    patient_id: patient.id,
    user_id: STAFF.find((member) => member.name === cashier).id,
    amount_total: items.reduce((sum, item) => sum + item.cost, 0),
    payment_method: 'cash',
    reference_number: `FAC-${year}-${String(id).padStart(5, '0')}`,
    status: 'paid',
    provider: 'manual',
    items,
    created_at: at(hour, minute),
    patient_first_name: patient.first_name,
    patient_last_name: patient.last_name,
    folder_number: patient.folder_number,
    cashier_name: cashier,
  };
});

const todayRevenue = PAYMENTS.reduce((sum, payment) => sum + payment.amount_total, 0);
const STATS = {
  patientsTotal: 248,
  todayRevenue,
  totalRevenue: 1846500,
  lowStockCount: MEDICATIONS.filter((m) => m.stock_quantity < m.min_stock_threshold).length,
  nearExpiryCount: 2,
  distribution: [{ method: 'cash', total: todayRevenue }],
  logs: [],
};

// Dossier d'Aya N'Guessan : deux consultations, une ordonnance, une analyse
// et un encaissement, dans la forme que renvoie GET /patients/:id.
const recordOf = (patient) => {
  const doctor = staffName(2);
  const consultations = [
    { id: 31, patient_id: patient.id, doctor_id: 2, date_time: at(8, 40), motif: 'Consultation de suivi', symptoms: 'Fatigue, vertiges en fin de journée', diagnosis: 'Anémie légère', notes: 'Contrôle de la NFS dans un mois.', constants: { tension: '11/7', temp: '36.8', weight: '61', heartRate: '78' }, doctor_name: doctor },
    { id: 22, patient_id: patient.id, doctor_id: 2, date_time: at(10, 15, -21), motif: 'Fièvre depuis deux jours', symptoms: 'Fièvre, courbatures', diagnosis: 'Accès palustre simple', notes: 'Traitement de trois jours, revoir si la fièvre persiste.', constants: { tension: '12/7', temp: '38.9', weight: '62', heartRate: '96' }, doctor_name: doctor },
  ];
  const prescriptions = [
    { id: 18, patient_id: patient.id, consultation_id: 31, doctor_id: 2, date_time: at(8, 55), status: 'pending', doctor_name: doctor, items: [{ id: 1, prescription_id: 18, medication_name: 'Fer + acide folique', dosage: '1 comprimé', frequency: '1 fois par jour', duration: '30 jours', quantity_prescribed: 1, quantity_dispensed: 0 }] },
  ];
  const labExams = [
    { id: 9, patient_id: patient.id, consultation_id: 31, test_name: 'Numération formule sanguine (NFS)', status: 'completed', results_text: 'Hémoglobine 10,8 g/dl, globules blancs normaux.', results_json: null, created_at: at(9, 5), doctor_name: doctor, technician_name: staffName(6) },
  ];
  const payments = PAYMENTS.filter((payment) => payment.patient_id === patient.id);
  const timeline = [
    ...consultations.map((c) => ({ id: `c-${c.id}`, type: 'consultation', date: c.date_time, title: `Consultation : ${c.motif}`, subtitle: `Par ${c.doctor_name}`, details: c })),
    ...prescriptions.map((p) => ({ id: `p-${p.id}`, type: 'prescription', date: p.date_time, title: 'Ordonnance', subtitle: `Par ${p.doctor_name} (En attente)`, details: p })),
    ...labExams.map((e) => ({ id: `le-${e.id}`, type: 'lab', date: e.created_at, title: `Examen de Laboratoire : ${e.test_name}`, subtitle: 'Statut : Résultats saisis', details: e })),
    ...payments.map((p) => ({ id: `pay-${p.id}`, type: 'payment', date: p.created_at, title: 'Facture & Paiement', subtitle: `Montant : ${p.amount_total} FCFA (Espèces)`, details: p })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  return { patient, hiddenSections: [], timeline, consultations, prescriptions, labExams, payments };
};

// Réponse locale à un GET /api/* : le chemin suffit, la méthode est filtrée en amont.
export const respond = (pathname, params) => {
  if (pathname.endsWith('/auth/me')) return ME;
  if (pathname.endsWith('/notifications')) return { notifications: [], unreadCount: 0 };
  if (pathname.endsWith('/financials/stats')) return STATS;
  if (pathname.endsWith('/financials/payments')) return PAYMENTS;
  if (pathname.endsWith('/appointments')) return APPOINTMENTS;
  if (pathname.endsWith('/settings/users')) return STAFF;
  if (pathname.endsWith('/settings/clinic')) return CLINIC;
  const record = pathname.match(/\/patients\/(\d+)$/);
  if (record) return recordOf(PATIENTS.find((p) => p.id === Number(record[1])) ?? PATIENTS[0]);
  if (pathname.endsWith('/patients')) return [...PATIENTS].sort(byName);
  if (pathname.endsWith('/laboratory/exams')) return params.get('status') === 'completed' ? [] : LAB_EXAMS;
  if (pathname.endsWith('/pharmacy/medications')) return MEDICATIONS;
  if (/\/(pharmacy\/prescriptions|deposits)$/.test(pathname)) return [];
  return {};
};
```

- [ ] **Step 3: Le script, `frontend/scripts/capture-screens.mjs`**

```js
// Captures de l'application réelle pour la vitrine. Le script démarre Vite sur
// le code de src/, répond à chaque appel /api/* avec les données d'exemple de
// capture-data.mjs, et photographie les écrans dans le Chrome du poste. Seules
// les polices Google de l'application sont téléchargées : toute autre requête
// sortante, API comprise, est bloquée.
//
// Lancement : npm run captures (les variantes AVIF et WebP sont tirées ensuite
// par optimize-images.mjs). À relancer quand l'interface change.
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { respond } from './capture-data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(here, '.captures');
const PORT = 5199;

const executablePath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((path) => path && existsSync(path));
if (!executablePath) throw new Error('Chrome introuvable : indiquez son chemin dans CHROME_PATH.');

const FONT_HOSTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const SCREENS = [
  { name: 'dashboard', tab: null },
  { name: 'patients', tab: 'Patients' },
  { name: 'patient-detail', tab: 'Patients', then: (page) => page.locator('[title="Consulter le dossier"]:visible').first().click() },
  { name: 'laboratory', tab: 'Laboratoire' },
  { name: 'pharmacy', tab: 'Pharmacie' },
  { name: 'accounting', tab: 'Comptabilité', then: (page) => page.getByText('Grand Livre & Journal des Recettes').first().click() },
];

await mkdir(outDir, { recursive: true });
const vite = await createServer({ root, logLevel: 'error', server: { port: PORT, strictPort: true } });
await vite.listen();
const browser = await chromium.launch({ executablePath, headless: true });
const errors = [];

const openApp = async (device) => {
  const context = await browser.newContext({ ...DEVICES[device], locale: 'fr-FR', timezoneId: 'Africa/Abidjan', colorScheme: 'light', reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    localStorage.setItem('mediclinic_token', 'jeton-de-capture');
    localStorage.setItem('theme', 'light');
    window.print = () => {};
  });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/api/')) {
      const body = route.request().method() === 'GET' ? respond(url.pathname, url.searchParams) : { success: true };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    if (url.hostname === 'localhost' || FONT_HOSTS.test(url.href)) return route.continue();
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${device} : ${error.message}`));
  page.setDefaultTimeout(10000);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  return { context, page };
};

const openTab = async (page, device, tab) => {
  if (!tab) return;
  if (device === 'mobile') {
    await page.getByRole('button', { name: 'Menu principal' }).click();
    await page.waitForTimeout(400);
  }
  await page.getByRole('button', { name: tab, exact: true }).first().click();
  await page.waitForTimeout(1200);
};

for (const device of Object.keys(DEVICES)) {
  for (const screen of SCREENS) {
    const { context, page } = await openApp(device);
    await openTab(page, device, screen.tab);
    if (screen.then) {
      await screen.then(page);
      await page.waitForTimeout(1200);
    }
    await page.mouse.move(0, 0);
    const file = join(outDir, `${screen.name}${device === 'mobile' ? '-mobile' : ''}.png`);
    await page.screenshot({ path: file });
    console.log(file);
    await context.close();
  }
}

// Le reçu réimprimé depuis le grand livre, dans sa propre fenêtre d'impression.
{
  const { context, page } = await openApp('desktop');
  await openTab(page, 'desktop', 'Comptabilité');
  await page.getByText('Grand Livre & Journal des Recettes').first().click();
  await page.waitForTimeout(900);
  const [popup] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: /Reçu/ }).first().click()]);
  await popup.waitForLoadState('load');
  await popup.setViewportSize({ width: 820, height: 1100 });
  await popup.waitForTimeout(500);
  await popup.screenshot({ path: join(outDir, 'receipt.png') });
  console.log(join(outDir, 'receipt.png'));
  await context.close();
}

// Image de partage 1200 × 630 : logo, titre du héros et capture réelle.
{
  const dataUrl = async (file, type) => `data:${type};base64,${(await readFile(file)).toString('base64')}`;
  const font = await dataUrl(join(root, 'node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2'), 'font/woff2');
  const logo = await dataUrl(join(root, 'public/logo-horizontal.svg'), 'image/svg+xml');
  const shot = await dataUrl(join(outDir, 'dashboard.png'), 'image/png');
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
    @font-face { font-family: Geist; src: url(${font}) format('woff2'); font-weight: 100 900; }
    * { box-sizing: border-box; margin: 0; }
    body { width: 1200px; height: 630px; overflow: hidden; position: relative; background: #f5f7f6; color: #0f1a17; font-family: Geist, sans-serif; }
    .copy { position: absolute; left: 72px; top: 80px; width: 480px; }
    .copy img { height: 34px; width: auto; }
    h1 { margin-top: 58px; font-size: 56px; line-height: 1.03; letter-spacing: -0.042em; font-weight: 600; }
    p { margin-top: 26px; font-size: 22px; color: #3a4743; }
    .shot { position: absolute; left: 610px; top: 92px; width: 780px; border-radius: 14px; overflow: hidden; border: 1px solid #ccd6d1; background: #fff; box-shadow: 0 40px 80px -30px rgba(20, 62, 50, 0.35); }
    .bar { height: 30px; background: #eef2f0; border-bottom: 1px solid #e0e6e3; }
    .shot img { display: block; width: 100%; }
  </style></head><body>
    <div class="copy"><img src="${logo}" alt=""><h1>Toute votre clinique, de l'accueil à la caisse.</h1><p>Logiciel de gestion de clinique pour la Côte d'Ivoire.</p></div>
    <div class="shot"><div class="bar"></div><img src="${shot}" alt=""></div>
  </body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(outDir, 'og-image.png') });
  console.log(join(outDir, 'og-image.png'));
  await context.close();
}

await browser.close();
await vite.close();
if (errors.length) {
  console.error(`\n${errors.length} erreur(s) JavaScript pendant les captures :\n${errors.join('\n')}`);
  process.exit(1);
}
```

- [ ] **Step 4: Variantes, `frontend/scripts/optimize-images.mjs` (réécrit)**

```js
// Génère les variantes AVIF et WebP des captures de la vitrine, et l'image de
// partage. Les sources sont les PNG de scripts/.captures/, produits par
// capture-screens.mjs : npm run captures enchaîne les deux scripts.
//
// Chaque capture donne deux largeurs, celle du rendu et son double pour les
// écrans à haute densité, dans les deux formats. Les PNG restent hors de
// public/ : à 2880 px de large, ils pèseraient plusieurs mégaoctets chacun, sur
// une page servie le plus souvent en connexion mobile.
//
// Lancement seul : npm run images (sharp est une dépendance de développement,
// elle ne part pas dans le bundle).
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = join(here, '.captures');
const publicDir = join(here, '..', 'public');
const outDir = join(publicDir, 'captures');

// Largeurs choisies sur le rendu réel : 900 px pour la capture du héros, 390 px
// pour un téléphone, 412 px pour le reçu posé sur son panneau. Ce sont les
// largeurs que lit frontend/src/pages/Landing/Capture.tsx.
const SCREENS = ['dashboard', 'patients', 'patient-detail', 'laboratory', 'pharmacy', 'accounting'];
const SOURCES = [
  ...SCREENS.flatMap((name) => [
    { name, widths: [900, 1800] },
    { name: `${name}-mobile`, widths: [390, 780] },
  ]),
  { name: 'receipt', widths: [520, 1040] },
];

const kb = (bytes) => `${Math.round(bytes / 1024)} Ko`;

await mkdir(outDir, { recursive: true });

for (const { name, widths } of SOURCES) {
  const src = join(sourceDir, `${name}.png`);
  for (const width of widths) {
    const pipeline = sharp(src).resize({ width, withoutEnlargement: true });
    const avifPath = join(outDir, `${name}-${width}.avif`);
    await pipeline.clone().avif({ quality: 60, effort: 6 }).toFile(avifPath);
    const webpPath = join(outDir, `${name}-${width}.webp`);
    await pipeline.clone().webp({ quality: 76 }).toFile(webpPath);
    console.log(`${name}-${width}  avif ${kb((await stat(avifPath)).size)}  webp ${kb((await stat(webpPath)).size)}`);
  }
}

// Image de partage (WhatsApp, Facebook) : un PNG 1200 × 630, le format le mieux
// lu par les aperçus de lien.
const ogPath = join(publicDir, 'og-image.png');
await sharp(join(sourceDir, 'og-image.png')).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(ogPath);
console.log(`og-image.png  ${kb((await stat(ogPath)).size)}`);
```

Dans `frontend/package.json`, ajouter le script :

```json
"captures": "node scripts/capture-screens.mjs && node scripts/optimize-images.mjs",
```

Dans `.gitignore` (racine), ajouter :

```
# Captures brutes de la vitrine (frontend/scripts/capture-screens.mjs) : seules
# leurs variantes AVIF et WebP, dans frontend/public/captures/, sont versionnées.
frontend/scripts/.captures/
```

- [ ] **Step 5: Produire et relire les captures**

Run: `cd frontend && npm run captures`
Expected: 14 PNG listés, puis 26 lignes de variantes et `og-image.png`, aucune erreur JavaScript.

Ouvrir chaque PNG de `frontend/scripts/.captures/` et vérifier :
- tableau de bord : « Bonjour, Mariam », rendez-vous du jour, recettes, alertes de stock, aucune bannière d'abonnement ;
- registre, dossier d'Aya N'Guessan (consultations, ordonnance, analyse, encaissement), laboratoire (5 demandes), pharmacie (alertes visibles), journal des recettes (6 lignes, colonne Caissier) ;
- reçu : en-tête du Cabinet Médical Les Palmiers, « Encaissé par : Grâce Aka », trois lignes, total 28 400 FCFA ;
- versions téléphone lisibles, sans débordement ;
- image de partage : logo, titre et capture, rien de coupé.

Si un écran affiche une erreur ou un champ vide, compléter `capture-data.mjs` (forme de la réponse de la route réelle) et relancer.

- [ ] **Step 6: Commit**

```bash
git add .gitignore frontend/package.json frontend/scripts/capture-data.mjs frontend/scripts/capture-screens.mjs frontend/scripts/optimize-images.mjs frontend/public/captures frontend/public/og-image.png frontend/src/pages/Accounting/AccountingPage.tsx
git commit -m "feat(vitrine): captures de l'application reelle, et la facture nomme qui encaisse"
```

---
### Task 4: Vitrine, première moitié (navigation, héros, faits, parcours, documents, pied de page)

**Files:**
- Create: `frontend/src/pages/Landing/SiteNav.tsx`, `Hero.tsx`, `FactsBand.tsx`, `Journey.tsx`, `DocumentsSection.tsx`, `FieldPhotoBand.tsx`, `SiteFooter.tsx`
- Rewrite: `frontend/src/pages/LandingPage.tsx`

**Interfaces:**
- Consumes: `usePublicCatalog`, `trialDaysOf`, `WhatsAppLink`, `Capture`, `ReceiptCapture`, `SITE`, `whatsappUrl` (tâche 2) ; classes de l'annexe A.
- Produces: `SECTION_LINKS` (exporté par `SiteNav.tsx`, repris par le pied de page) ; `LandingPage({ onNavigate })`, contrat inchangé.

- [ ] **Step 1: `SiteNav.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { WhatsAppLink } from './WhatsApp';

export const SECTION_LINKS = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#questions', label: 'Questions' },
];

interface SiteNavProps {
  onLogin: () => void;
  onRegister: () => void;
}

export const SiteNav = ({ onLogin, onRegister }: SiteNavProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  // Échap ferme le menu du téléphone.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header className="vt-nav">
      <div className="vt-wrap vt-nav-bar">
        <a className="vt-nav-logo" href="#top">
          <img src="/logo-horizontal.svg" alt="MediClinic" width={103} height={28} />
        </a>
        <nav className="vt-nav-links" aria-label="Sections">
          {SECTION_LINKS.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
        </nav>
        <div className="vt-nav-right">
          <button type="button" className="vt-nav-login" onClick={onLogin}>Connexion</button>
          <button type="button" className="vt-btn vt-btn-primary vt-btn-sm" onClick={onRegister}>Essayer gratuitement</button>
          <button
            type="button"
            className="vt-nav-burger"
            aria-expanded={menuOpen}
            aria-controls="vt-menu"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} strokeWidth={1.75} aria-hidden="true" /> : <Menu size={20} strokeWidth={1.75} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div id="vt-menu" className="vt-menu" hidden={!menuOpen}>
        <nav className="vt-wrap" aria-label="Menu">
          {SECTION_LINKS.map((link) => <a key={link.href} href={link.href} onClick={closeMenu}>{link.label}</a>)}
          <button type="button" onClick={() => { closeMenu(); onLogin(); }}>Connexion</button>
          <WhatsAppLink onClick={closeMenu} />
        </nav>
      </div>
    </header>
  );
};
```

- [ ] **Step 2: `Hero.tsx`**

```tsx
import type { CSSProperties } from 'react';
import { Capture } from './Capture';
import { WhatsAppLink } from './WhatsApp';

// Ordre d'entrée du héros (.vt-rise dans site.css) : surtitre, titre, texte, boutons.
const step = (index: number) => ({ '--i': index }) as CSSProperties;

export const Hero = ({ onRegister }: { onRegister: () => void }) => (
  <section className="vt-hero" id="top">
    <div className="vt-wrap vt-hero-grid">
      <div className="vt-hero-copy">
        <p className="vt-hero-eyebrow vt-rise" style={step(0)}>Logiciel de gestion de clinique</p>
        <h1 className="vt-rise" style={step(1)}>Toute votre clinique, de l'accueil à la caisse.</h1>
        <p className="vt-lead vt-rise" style={step(2)}>
          Dossiers patients, rendez-vous, ordonnances, pharmacie, laboratoire et encaissements, pensés pour les cliniques de Côte d'Ivoire.
        </p>
        <div className="vt-hero-ctas vt-rise" style={step(3)}>
          <button type="button" className="vt-btn vt-btn-primary" onClick={onRegister}>Essayer gratuitement</button>
          <WhatsAppLink className="vt-btn vt-btn-ghost" />
        </div>
      </div>
      {/* La capture n'a pas d'animation d'entrée : c'est l'image LCP. */}
      <figure className="vt-shot vt-hero-shot">
        <div className="vt-shot-bar" aria-hidden="true"><span>mediclinicpro.com</span></div>
        <Capture
          name="dashboard"
          alt="Tableau de bord MediClinic : rendez-vous du jour, recettes et alertes de stock"
          sizes="(max-width: 1080px) 92vw, 900px"
          phoneSizes="86vw"
          priority
        />
      </figure>
    </div>
  </section>
);
```

- [ ] **Step 3: `FactsBand.tsx`**

```tsx
import { Banknote, CalendarCheck, MessageCircle, ShieldCheck } from 'lucide-react';

export const FactsBand = ({ trialDays }: { trialDays: number }) => {
  const facts = [
    { icon: CalendarCheck, title: `${trialDays} jours gratuits`, text: 'Sans carte bancaire ni engagement' },
    { icon: Banknote, title: 'Prix en FCFA', text: 'Abonnement payable par Mobile Money' },
    { icon: ShieldCheck, title: 'Données séparées', text: 'Chaque clinique ne voit que ses dossiers' },
    { icon: MessageCircle, title: 'Aide sur WhatsApp', text: 'On vous aide à démarrer, en français' },
  ];
  return (
    <section className="vt-facts" aria-label="En bref">
      <div className="vt-wrap">
        <ul>
          {facts.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              <div><strong>{title}</strong><span>{text}</span></div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
```

- [ ] **Step 4: `Journey.tsx`**

```tsx
import { useRef, useState, type KeyboardEvent } from 'react';
import { Check, FlaskConical, Pill, Receipt, Stethoscope, Users } from 'lucide-react';
import { Capture } from './Capture';

const STEPS = [
  {
    id: 'accueil', label: 'Accueil', icon: Users, capture: 'patients', alt: 'Registre des patients',
    title: 'Le registre des patients, toujours à jour.',
    points: ['Numéro de dossier attribué automatiquement', "Allergies visibles d'un coup d'œil", 'Rendez-vous et orientation vers le médecin disponible'],
  },
  {
    id: 'consultation', label: 'Consultation', icon: Stethoscope, capture: 'patient-detail', alt: 'Dossier patient et son historique',
    title: "Le médecin voit tout l'historique avant de consulter.",
    points: ['Constantes, diagnostic et notes dans le dossier', 'Ordonnance et analyses prescrites depuis la consultation', 'Résultats et factures dans la même chronologie'],
  },
  {
    id: 'labo', label: 'Laboratoire', icon: FlaskConical, capture: 'laboratory', alt: 'Analyses en attente au laboratoire',
    title: "Les demandes d'analyses arrivent directement au labo.",
    points: ['Chaque demande avec son heure, son patient et son médecin', 'Résultats saisis une fois, lus par le médecin', 'Plus de bon papier qui se perd entre deux bureaux'],
  },
  {
    id: 'pharmacie', label: 'Pharmacie', icon: Pill, capture: 'pharmacy', alt: 'Inventaire de la pharmacie',
    title: 'Un stock qui ne disparaît plus.',
    points: ['Alertes de stock bas et de péremption proche', "Délivrance liée à l'ordonnance : le stock baisse tout seul", "Prix d'achat, prix de vente et marge par produit"],
  },
  {
    id: 'caisse', label: 'Caisse', icon: Receipt, capture: 'accounting', alt: 'Journal des recettes',
    title: 'Chaque franc encaissé a son reçu.',
    points: ["Reçu numéroté à l'en-tête de la clinique", 'Journal des recettes et total du jour', 'Le nom de la personne qui a encaissé, sur chaque ligne'],
  },
];

export const Journey = () => {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Onglets ARIA : flèches gauche et droite, Début et Fin ; la sélection suit le focus.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = STEPS.length - 1;
    const moves: Record<string, number> = {
      ArrowRight: active === last ? 0 : active + 1,
      ArrowLeft: active === 0 ? last : active - 1,
      Home: 0,
      End: last,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="vt-section" id="fonctionnalites">
      <div className="vt-wrap vt-reveal">
        <h2>Un seul dossier patient, partagé par toute l'équipe.</h2>
        <p className="vt-lead">
          La secrétaire l'ouvre, le médecin le complète, le laboratoire et la pharmacie s'en servent, la caisse encaisse. Personne ne ressaisit.
        </p>
        <div className="vt-tabs" role="tablist" aria-label="Postes de la clinique" onKeyDown={onKeyDown}>
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                ref={(element) => { tabRefs.current[index] = element; }}
                type="button"
                role="tab"
                id={`vt-tab-${step.id}`}
                aria-controls={`vt-panel-${step.id}`}
                aria-selected={index === active}
                tabIndex={index === active ? 0 : -1}
                className="vt-tab"
                onClick={() => setActive(index)}
              >
                <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
                {step.label}
              </button>
            );
          })}
        </div>
        {STEPS.map((step, index) => (
          <div
            key={step.id}
            className="vt-panel"
            role="tabpanel"
            id={`vt-panel-${step.id}`}
            aria-labelledby={`vt-tab-${step.id}`}
            hidden={index !== active}
          >
            <div>
              <h3>{step.title}</h3>
              <ul>
                {step.points.map((point) => (
                  <li key={point}><Check size={18} strokeWidth={1.75} aria-hidden="true" />{point}</li>
                ))}
              </ul>
            </div>
            <figure className="vt-shot">
              <div className="vt-shot-bar" aria-hidden="true"><span>mediclinicpro.com</span></div>
              <Capture name={step.capture} alt={step.alt} sizes="(max-width: 1080px) 92vw, 760px" phoneSizes="78vw" />
            </figure>
          </div>
        ))}
        <p className="vt-caption">Captures de l'application, avec des données d'exemple.</p>
      </div>
    </section>
  );
};
```

- [ ] **Step 5: `DocumentsSection.tsx` et `FieldPhotoBand.tsx`**

```tsx
import { ReceiptCapture } from './Capture';

export const DocumentsSection = () => (
  <section className="vt-section vt-docs">
    <div className="vt-wrap vt-docs-grid vt-reveal">
      <div>
        <h2>Vos patients repartent avec un reçu à votre nom.</h2>
        <p className="vt-lead">
          Chaque encaissement produit un reçu numéroté, imprimé à l'en-tête de votre clinique. Les ordonnances aussi.
        </p>
        <dl className="vt-docs-points">
          <div>
            <dt>L'en-tête de votre clinique</dt>
            <dd>Nom, adresse et téléphone, repris de vos paramètres.</dd>
          </div>
          <div>
            <dt>Un numéro unique</dt>
            <dd>
              <span className="vt-mono">FAC-{new Date().getFullYear()}-00042</span> est attribué par le système : deux reçus ne peuvent pas porter le même.
            </dd>
          </div>
          <div>
            <dt>Qui a encaissé</dt>
            <dd>Le nom de la personne à la caisse figure sur chaque reçu.</dd>
          </div>
        </dl>
      </div>
      <div className="vt-paper-stage">
        <figure className="vt-paper">
          <ReceiptCapture alt="Reçu imprimé par MediClinic à l'en-tête du Cabinet Médical Les Palmiers" />
        </figure>
      </div>
    </div>
  </section>
);
```

```tsx
import { SITE } from '../../config/site';

// Photo réelle d'une clinique ou de l'équipe, fournie par le propriétaire. Sans
// elle, rien n'est ajouté : aucune image générée ne la remplace.
export const FieldPhotoBand = () => {
  const photo = SITE.fieldPhoto;
  if (!photo) return null;
  return (
    <figure className="vt-field-photo">
      <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
    </figure>
  );
};
```

- [ ] **Step 6: `SiteFooter.tsx`**

```tsx
import { SITE, whatsappUrl } from '../../config/site';
import { SECTION_LINKS } from './SiteNav';

interface SiteFooterProps {
  onLogin: () => void;
  onRegister: () => void;
  onTerms: () => void;
}

export const SiteFooter = ({ onLogin, onRegister, onTerms }: SiteFooterProps) => {
  const year = new Date().getFullYear();
  // La raison sociale et le RCCM ne s'affichent qu'une fois renseignés dans SITE.
  const legal = SITE.legal ? `${SITE.legal.name}. RCCM ${SITE.legal.rccm}.` : 'MediClinic.';
  return (
    <footer className="vt-footer">
      <div className="vt-wrap">
        <div className="vt-footer-grid">
          <div className="vt-footer-brand">
            <img src="/logo-horizontal.svg" alt="MediClinic" width={96} height={26} />
            <p>Logiciel de gestion de clinique pour la Côte d'Ivoire.</p>
          </div>
          <div>
            <h2 className="vt-footer-title">Produit</h2>
            <ul>{SECTION_LINKS.map((link) => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul>
          </div>
          <div>
            <h2 className="vt-footer-title">Compte</h2>
            <ul>
              <li><button type="button" onClick={onLogin}>Connexion</button></li>
              <li><button type="button" onClick={onRegister}>Essayer gratuitement</button></li>
            </ul>
          </div>
          <div>
            <h2 className="vt-footer-title">Contact</h2>
            <ul>
              <li><a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">WhatsApp : {SITE.whatsapp.display}</a></li>
              <li><button type="button" onClick={onTerms}>Conditions d'utilisation</button></li>
            </ul>
          </div>
        </div>
        <div className="vt-footer-legal">
          <span>© {year} {legal}</span>
          <span>Côte d'Ivoire</span>
        </div>
      </div>
    </footer>
  );
};
```

- [ ] **Step 7: `LandingPage.tsx` réécrit (première moitié)**

```tsx
import { useEffect, useRef } from 'react';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../styles/site.css';
import { trialDaysOf } from '../utils/publicPlans';
import { usePublicCatalog } from './Landing/usePublicCatalog';
import { SiteNav } from './Landing/SiteNav';
import { Hero } from './Landing/Hero';
import { FactsBand } from './Landing/FactsBand';
import { Journey } from './Landing/Journey';
import { DocumentsSection } from './Landing/DocumentsSection';
import { FieldPhotoBand } from './Landing/FieldPhotoBand';
import { SiteFooter } from './Landing/SiteFooter';

interface LandingPageProps {
  onNavigate: (tab: 'login' | 'register' | 'terms') => void;
}

// Vitrine publique : un assemblage de sections (pages/Landing/, une par
// fichier) sur le système visuel de styles/site.css. Conception et textes :
// docs/superpowers/specs/2026-10-05-vitrine-refonte-design.md.
export const LandingPage = ({ onNavigate }: LandingPageProps) => {
  const catalog = usePublicCatalog();
  const rootRef = useRef<HTMLDivElement>(null);
  const trialDays = trialDaysOf(catalog);
  const onLogin = () => onNavigate('login');
  const onRegister = () => onNavigate('register');

  // Apparition au défilement, une fois par bloc. La classe vt-js n'est posée
  // qu'ici : sans JavaScript, ou sans IntersectionObserver, tout reste visible.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window)) return;
    root.classList.add('vt-js');
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    root.querySelectorAll('.vt-reveal').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="site">
      <a className="vt-skip" href="#contenu">Aller au contenu</a>
      <SiteNav onLogin={onLogin} onRegister={onRegister} />
      <main id="contenu" tabIndex={-1}>
        <Hero onRegister={onRegister} />
        <FactsBand trialDays={trialDays} />
        <Journey />
        <DocumentsSection />
        <FieldPhotoBand />
      </main>
      <SiteFooter onLogin={onLogin} onRegister={onRegister} onTerms={() => onNavigate('terms')} />
    </div>
  );
};
```

- [ ] **Step 8: Vérifier**

Run: `cd frontend && npm run build && npm run lint`
Expected: build sans erreur ; lint à 24 avertissements au plus (le retrait de l'ancienne vitrine peut en faire disparaître).

Run: `npm run dev`, ouvrir `http://localhost:5173/` en 1440 px puis en 390 px :
- héros avec la capture qui déborde à droite, version téléphone dans son cadre ;
- onglets au clic et aux flèches, capture de chaque poste ;
- reçu sur son panneau vert pâle ;
- menu du téléphone ouvert puis refermé par Échap ;
- « Essayer gratuitement » et « Connexion » mènent aux bons écrans.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/Landing frontend/src/pages/LandingPage.tsx
git commit -m "feat(vitrine): navigation, heros, faits, parcours, documents et pied de page"
```

---

### Task 5: Vitrine, seconde moitié (« Fait pour les cliniques d'ici », tarifs, fondateur, questions, appel final)

**Files:**
- Create: `frontend/src/pages/Landing/LocalFit.tsx`, `Pricing.tsx`, `Founder.tsx`, `Faq.tsx`, `FinalCta.tsx`
- Modify: `frontend/src/pages/LandingPage.tsx`

**Interfaces:**
- Consumes: `PublicCatalog`, `trialDaysOf`, `formatFcfa` (tâche 2), `frenchList`, `SITE`, `WhatsAppLink`, `PhoneCapture`.

- [ ] **Step 1: `LocalFit.tsx`**

```tsx
import { Building2, Lock, UserX } from 'lucide-react';
import { SITE } from '../../config/site';
import { formatFcfa } from '../../utils/publicPlans';
import { frenchList } from '../../utils/frenchList';
import { PhoneCapture } from './Capture';

const ROLES = ['Administrateur', 'Médecin', 'Infirmier', 'Secrétaire', 'Pharmacien', 'Laborantin', 'Gestionnaire'];

export const LocalFit = ({ cliniquePrice }: { cliniquePrice: number }) => (
  <section className="vt-section">
    <div className="vt-wrap vt-reveal">
      <h2>Fait pour les cliniques d'ici.</h2>
      <div className="vt-bento">
        <article className="vt-cell vt-cell-phone">
          <h3>Sur ordinateur comme sur téléphone</h3>
          <p>Rien à installer. La caisse travaille sur l'ordinateur de l'accueil, le médecin suit sa journée depuis son téléphone.</p>
          <figure className="vt-phone-shot">
            <PhoneCapture name="dashboard" alt="Tableau de bord MediClinic sur téléphone" sizes="(max-width: 640px) 70vw, 300px" />
          </figure>
        </article>
        <article className="vt-cell vt-cell-roles">
          <h3>Chacun voit ce qui le concerne</h3>
          <p>
            Sept rôles, chacun avec ses écrans. Le pharmacien n'a pas accès à la comptabilité, le laborantin ne voit pas la caisse, et le contenu médical est réservé à l'équipe soignante.
          </p>
          <ul className="vt-chips">{ROLES.map((role) => <li key={role}>{role}</li>)}</ul>
        </article>
        <article className="vt-cell vt-cell-money">
          <h3>En FCFA, sans conversion</h3>
          <p>Abonnement réglé par {frenchList(SITE.subscriptionPaymentMethods, 'ou')}.</p>
          <p className="vt-amount"><small>dès</small> {formatFcfa(cliniquePrice)} <small>FCFA / mois</small></p>
        </article>
        <article className="vt-cell vt-cell-secure">
          <h3>Vos données restent les vôtres</h3>
          <ul>
            <li><Building2 size={18} strokeWidth={1.75} aria-hidden="true" />Chaque clinique a son propre espace</li>
            <li><Lock size={18} strokeWidth={1.75} aria-hidden="true" />Connexion chiffrée</li>
            <li><UserX size={18} strokeWidth={1.75} aria-hidden="true" />Un compte désactivé perd l'accès immédiatement</li>
          </ul>
        </article>
      </div>
    </div>
  </section>
);
```

- [ ] **Step 2: `Pricing.tsx`**

```tsx
import { Check } from 'lucide-react';
import { SITE } from '../../config/site';
import { formatFcfa, trialDaysOf, type PublicCatalog, type PublicPlan } from '../../utils/publicPlans';
import { frenchList } from '../../utils/frenchList';

const INCLUDED = [
  'Patients illimités', 'Rendez-vous et dossiers', 'Ordonnances',
  'Pharmacie et stock', 'Laboratoire', 'Caisse et reçus',
  'Dépôts de garantie', 'Mises à jour', 'Assistance WhatsApp',
];

const PlanCard = ({ name, audience, plan }: { name: string; audience: string; plan: PublicPlan }) => (
  <article className="vt-plan">
    <h3>{name}</h3>
    <p className="vt-plan-for">{audience}</p>
    <p className="vt-price">
      <span className="vt-price-amount">{formatFcfa(plan.price)}</span>
      <span className="vt-price-unit">FCFA / mois</span>
    </p>
    <ul>
      <li><Check size={18} strokeWidth={1.75} aria-hidden="true" />{plan.staffLimit === null ? 'Comptes illimités' : `Jusqu'à ${plan.staffLimit} comptes`}</li>
      <li><Check size={18} strokeWidth={1.75} aria-hidden="true" />Les 7 rôles, dont pharmacien et laborantin</li>
    </ul>
  </article>
);

export const Pricing = ({ catalog, onRegister }: { catalog: PublicCatalog; onRegister: () => void }) => {
  const trialDays = trialDaysOf(catalog);
  return (
    <section className="vt-section vt-pricing" id="tarifs">
      <div className="vt-wrap vt-reveal">
        <h2>Un prix clair, en FCFA.</h2>
        <p className="vt-lead">
          Toute l'équipe essaie gratuitement pendant {trialDays} jours. Ensuite, vous choisissez la formule qui correspond à la taille de votre clinique.
        </p>
        <div className="vt-trial">
          <div>
            <strong>Essai gratuit de {trialDays} jours</strong>
            <span>{catalog.starter.staffLimit ?? 3} comptes (administrateur, médecin, secrétaire), sans carte bancaire</span>
          </div>
          <button type="button" className="vt-btn vt-btn-primary" onClick={onRegister}>Essayer gratuitement</button>
        </div>
        <div className="vt-plans">
          <PlanCard name="Clinique" audience="Cabinets et petites cliniques" plan={catalog.clinique} />
          <PlanCard name="Hôpital" audience="Cliniques avec plusieurs services" plan={catalog.hopital} />
        </div>
        <div className="vt-included">
          <h3>Inclus dans les deux formules</h3>
          <ul>{INCLUDED.map((item) => <li key={item}><Check size={17} strokeWidth={1.75} aria-hidden="true" />{item}</li>)}</ul>
        </div>
        <p className="vt-pay-note">
          Paiement par {frenchList(SITE.subscriptionPaymentMethods, 'ou')}, pour 1, 3, 6 ou 12 mois. Changement de formule à tout moment depuis l'application.
        </p>
      </div>
    </section>
  );
};
```

- [ ] **Step 3: `Founder.tsx`**

```tsx
import { SITE } from '../../config/site';
import { WhatsAppLink } from './WhatsApp';

// Bloc rendu seulement quand le propriétaire a fourni nom, photo et texte : un
// fondateur inventé serait pire qu'aucun.
export const Founder = () => {
  const founder = SITE.founder;
  if (!founder) return null;
  return (
    <section className="vt-section vt-founder">
      <div className="vt-wrap vt-founder-grid vt-reveal">
        <figure className="vt-portrait">
          <img src={founder.photo} alt={`${founder.name}, ${founder.role}`} width={600} height={750} loading="lazy" decoding="async" />
        </figure>
        <div>
          <blockquote>«&nbsp;{founder.quote}&nbsp;»</blockquote>
          <p className="vt-who"><strong>{founder.name}</strong>, {founder.role}</p>
          <WhatsAppLink className="vt-btn vt-btn-ghost" />
        </div>
      </div>
    </section>
  );
};
```

- [ ] **Step 4: `Faq.tsx`**

```tsx
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { SITE, whatsappUrl } from '../../config/site';
import { trialDaysOf, type PublicCatalog } from '../../utils/publicPlans';
import { frenchList } from '../../utils/frenchList';

const WhatsAppInline = ({ children }: { children: ReactNode }) => (
  <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">{children}</a>
);

export const Faq = ({ catalog }: { catalog: PublicCatalog }) => {
  const trialDays = trialDaysOf(catalog);
  const { starter, clinique, hopital } = catalog;
  const limit = (count: number | null) => (count === null ? 'sans limite' : `${count} comptes`);
  const questions: { question: string; answer: ReactNode }[] = [
    {
      question: 'Faut-il installer un logiciel ?',
      answer: "Non. MediClinic s'utilise dans le navigateur, sur ordinateur, tablette ou téléphone. Il suffit d'une connexion internet.",
    },
    {
      question: `Que se passe-t-il à la fin des ${trialDays} jours d'essai ?`,
      answer: "Vous choisissez la formule Clinique ou Hôpital et la réglez depuis l'application. Sans paiement, vos dossiers restent consultables 3 jours, puis l'accès est suspendu jusqu'au règlement. Vos données sont conservées.",
    },
    {
      question: 'Mes données médicales sont-elles protégées ?',
      answer: "Chaque clinique dispose de son propre espace : aucune autre clinique ne voit vos patients. La connexion est chiffrée, chaque membre de l'équipe n'accède qu'aux écrans de son rôle, le contenu médical est réservé à l'équipe soignante, et un compte désactivé perd l'accès immédiatement.",
    },
    {
      question: 'Faut-il une connexion internet en permanence ?',
      answer: 'Oui, MediClinic fonctionne en ligne. Une connexion mobile suffit.',
    },
    {
      question: "Combien de personnes peuvent l'utiliser ?",
      answer: `${limit(starter.staffLimit)} pendant l'essai, ${limit(clinique.staffLimit)} avec la formule Clinique, ${limit(hopital.staffLimit)} avec la formule Hôpital. Le nombre de patients est illimité dans tous les cas.`,
    },
    {
      question: "Comment payer l'abonnement ?",
      answer: `Par ${frenchList(SITE.subscriptionPaymentMethods, 'ou')}, pour 1, 3, 6 ou 12 mois, depuis la rubrique Paramètres de l'application.`,
    },
    {
      question: 'Pouvez-vous nous aider à démarrer ?',
      answer: (
        <>Oui. Écrivez-nous sur WhatsApp au <WhatsAppInline>{SITE.whatsapp.display}</WhatsAppInline> : nous vous aidons à configurer la clinique et à créer les comptes de votre équipe.</>
      ),
    },
  ];

  return (
    <section className="vt-section vt-section-tight" id="questions">
      <div className="vt-wrap vt-faq-grid vt-reveal">
        <div className="vt-faq-side">
          <h2>Questions fréquentes</h2>
          <p>Une autre question ? <WhatsAppInline>Écrivez-nous sur WhatsApp</WhatsAppInline>, on vous répond en français.</p>
        </div>
        <div className="vt-faq">
          {questions.map(({ question, answer }, index) => (
            <details key={question} open={index === 0}>
              <summary>{question}<Plus size={20} strokeWidth={1.75} aria-hidden="true" /></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};
```

La réponse sur le nombre de personnes se construit à partir du catalogue (« 3 comptes pendant l'essai, 5 comptes avec la formule Clinique, sans limite avec la formule Hôpital ») : elle reste juste si les limites changent dans `plans.js`.

- [ ] **Step 5: `FinalCta.tsx`**

```tsx
import { WhatsAppLink } from './WhatsApp';

export const FinalCta = ({ trialDays, onRegister }: { trialDays: number; onRegister: () => void }) => (
  <section className="vt-section vt-section-tight">
    <div className="vt-wrap vt-reveal">
      <div className="vt-closing-panel">
        <div>
          <h2>Essayez MediClinic dans votre clinique cette semaine.</h2>
          <p className="vt-lead">{trialDays} jours gratuits, sans carte bancaire. Une question avant de commencer ? On vous répond sur WhatsApp.</p>
        </div>
        <div className="vt-closing-ctas">
          <button type="button" className="vt-btn vt-btn-primary" onClick={onRegister}>Essayer gratuitement</button>
          <WhatsAppLink className="vt-btn vt-btn-ghost" />
        </div>
      </div>
    </div>
  </section>
);
```

- [ ] **Step 6: Assembler**

Dans `LandingPage.tsx`, ajouter les imports :

```tsx
import { LocalFit } from './Landing/LocalFit';
import { Pricing } from './Landing/Pricing';
import { Founder } from './Landing/Founder';
import { Faq } from './Landing/Faq';
import { FinalCta } from './Landing/FinalCta';
```

et compléter `<main>` :

```tsx
      <main id="contenu" tabIndex={-1}>
        <Hero onRegister={onRegister} />
        <FactsBand trialDays={trialDays} />
        <Journey />
        <DocumentsSection />
        <FieldPhotoBand />
        <LocalFit cliniquePrice={catalog.clinique.price} />
        <Pricing catalog={catalog} onRegister={onRegister} />
        <Founder />
        <Faq catalog={catalog} />
        <FinalCta trialDays={trialDays} onRegister={onRegister} />
      </main>
```

- [ ] **Step 7: Vérifier**

Run: `cd frontend && npm run build && npm run lint`
Expected: sans erreur, lint inchangé ou en baisse.

Le `backend/.env` local pointe sur la base de production : on ne change aucun réglage pour tester. La durée d'essai se vérifie avec une API simulée (le script de vérification de la tâche 9 intercepte `/api/settings/public/plans`) :
- sans réponse de l'API : les tarifs du repli s'affichent (9 000 et 14 500 FCFA, 7 jours), sans erreur visible ;
- réponse simulée avec `starter.trialDays: 14` : « 14 jours » partout (faits, tarifs, questions, appel final) ;
- aucun bloc fondateur (`SITE.founder` vaut `null`).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/Landing frontend/src/pages/LandingPage.tsx
git commit -m "feat(vitrine): cliniques d'ici, tarifs lus dans l'API, fondateur, questions et appel final"
```

---
### Task 6: Connexion, inscription et CGU au même style

**Files:**
- Modify: `frontend/src/pages/Auth/AuthPage.tsx` (imports, rendu ; logique intacte)
- Rewrite: `frontend/src/pages/TermsOfServicePage.tsx` (rendu ; tableau `sections` intact)
- Modify: `frontend/src/App.tsx` (titres d'onglet des pages publiques, sans tiret cadratin)

**Interfaces:**
- Consumes: `usePublicCatalog`, `trialDaysOf`, `Capture`, `SITE`, `whatsappUrl`, classes `vt-auth-*` et `vt-terms-*` de l'annexe A.
- Produces: `AuthPage({ initialTab, onNavigate })` et `TermsOfServicePage({ onBack, onRegister })`, signatures inchangées.

- [ ] **Step 1: Imports et données de `AuthPage.tsx`**

Le bloc d'imports devient :

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  Mail,
  ArrowLeft,
  Loader2,
  Building2,
  User,
  Eye,
  EyeOff,
  CalendarCheck,
  Lock,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import '@fontsource-variable/geist';
import '../../styles/site.css';
import { PhoneInput } from '../../components/PhoneInput';
import { SITE, whatsappUrl } from '../../config/site';
import { trialDaysOf } from '../../utils/publicPlans';
import { usePublicCatalog } from '../Landing/usePublicCatalog';
import { Capture } from '../Landing/Capture';
```

La constante `brandFeatures` disparaît. Juste après `const { showToast } = useNotifications();` :

```tsx
  const trialDays = trialDaysOf(usePublicCatalog());
```

Rien d'autre ne change avant le `return` : états, effet Google, `handleLoginSubmit`, `handleRegisterSubmit`, `handleRecoverySubmit`.

- [ ] **Step 2: Le rendu de `AuthPage.tsx`**

Le `return (…)` entier, bloc `<style>` compris, devient :

```tsx
  return (
    <div className="site vt-auth">
      <aside className="vt-auth-aside">
        <img className="vt-auth-logo" src="/logo-horizontal.svg" alt="MediClinic" width={103} height={28} />
        <div>
          <h1>Toute votre clinique, de l'accueil à la caisse.</h1>
          <p className="vt-auth-trial">
            <CalendarCheck size={18} strokeWidth={1.75} aria-hidden="true" />
            {trialDays} jours gratuits, sans carte bancaire
          </p>
        </div>
        <figure className="vt-shot vt-auth-shot">
          <div className="vt-shot-bar" aria-hidden="true"><span>mediclinicpro.com</span></div>
          <Capture name="dashboard" alt="Tableau de bord MediClinic" sizes="720px" />
        </figure>
      </aside>

      <main className="vt-auth-main">
        <button type="button" className="vt-auth-back" onClick={() => onNavigate('landing')}>
          <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
          Retour à l'accueil
        </button>

        <div className="vt-auth-card">
          <div>
            <h2>{isForgotView ? 'Récupération' : activeTab === 'register' ? 'Créer un compte' : 'Connexion'}</h2>
            <p className="vt-auth-sub">
              {isForgotView
                ? 'Nous réinitialisons votre accès sur WhatsApp, après vérification.'
                : activeTab === 'register'
                ? 'Enregistrez votre cabinet en 1 minute'
                : 'Entrez vos identifiants pour accéder à votre espace.'}
            </p>
          </div>

          {!isForgotView && (
            <div className="vt-auth-switch" role="group" aria-label="Connexion ou création de compte">
              <button type="button" aria-pressed={activeTab === 'login'} onClick={() => setActiveTab('login')}>Connexion</button>
              <button type="button" aria-pressed={activeTab === 'register'} onClick={() => setActiveTab('register')}>Créer un compte</button>
            </div>
          )}

          {isForgotView ? (
            <form onSubmit={handleRecoverySubmit} className="vt-form">
              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-recovery-email">Adresse e-mail</label>
                <div className="vt-field-control">
                  <Mail size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-recovery-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Ex : docteur@gmail.com"
                    value={recoveryEmail}
                    onChange={e => setRecoveryEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>
              <p className="vt-auth-text">
                La réinitialisation par e-mail n'est pas encore disponible. Envoyez-nous votre demande sur
                WhatsApp au {SITE.whatsapp.display} : nous vérifions votre identité, puis vous transmettons
                un mot de passe temporaire.
              </p>
              <button type="submit" className="vt-btn vt-btn-primary vt-btn-block">Demander sur WhatsApp</button>
              <button type="button" className="vt-link vt-link-center" onClick={() => setIsForgotView(false)}>
                Retour à la connexion
              </button>
            </form>
          ) : activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="vt-form">
              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-login-email">Adresse e-mail</label>
                <div className="vt-field-control">
                  <Mail size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Ex : contact@clinique.ci"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-login-password">Mot de passe</label>
                <div className="vt-field-control">
                  <Lock size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-login-password"
                    className="vt-has-toggle"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    className="vt-field-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {showPassword
                      ? <EyeOff size={16} strokeWidth={1.75} aria-hidden="true" />
                      : <Eye size={16} strokeWidth={1.75} aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <button type="button" className="vt-link" onClick={() => setIsForgotView(true)}>Mot de passe oublié ?</button>

              <button type="submit" className="vt-btn vt-btn-primary vt-btn-block" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={18} aria-label="Connexion en cours" />
                ) : (
                  <>
                    <Lock size={16} strokeWidth={1.75} aria-hidden="true" />
                    Se connecter
                  </>
                )}
              </button>

              {GOOGLE_CLIENT_ID && (
                <>
                  <p className="vt-or">ou</p>
                  <div className="vt-google"><div ref={googleButtonRef} /></div>
                </>
              )}

              <p className="vt-auth-note">
                <HelpCircle size={14} strokeWidth={1.75} aria-hidden="true" />
                Problème de connexion ? Contactez l'administrateur de votre clinique.
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="vt-form">
              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-register-clinic">Nom de la clinique *</label>
                <div className="vt-field-control">
                  <Building2 size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-register-clinic"
                    type="text"
                    autoComplete="organization"
                    placeholder="Ex : Cabinet Médical Saint-Jean"
                    value={clinicName}
                    onChange={e => setClinicName(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-register-admin">Nom du responsable *</label>
                <div className="vt-field-control">
                  <User size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-register-admin"
                    type="text"
                    autoComplete="name"
                    placeholder="Ex : Dr Koné Aminata"
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-register-email">Adresse e-mail *</label>
                <div className="vt-field-control">
                  <Mail size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-register-email"
                    type="email"
                    autoComplete="email"
                    placeholder="Ex : contact@saintjean.ci"
                    value={registerEmail}
                    onChange={e => setRegisterEmail(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              {/* PhoneInput ne transmet pas d'id à son champ : le groupe porte le libellé. */}
              <div className="vt-field" role="group" aria-labelledby="vt-register-phone-label">
                <span className="vt-field-label" id="vt-register-phone-label">Téléphone (Mobile Money) *</span>
                <div className="vt-field-phone">
                  <PhoneInput value={phone} onChange={setPhone} disabled={isSubmitting} required />
                </div>
              </div>

              <div className="vt-field">
                <label className="vt-field-label" htmlFor="vt-register-password">Mot de passe *</label>
                <div className="vt-field-control">
                  <Lock size={17} strokeWidth={1.75} aria-hidden="true" />
                  <input
                    id="vt-register-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Minimum 8 caractères"
                    value={registerPassword}
                    onChange={e => setRegisterPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="vt-btn vt-btn-primary vt-btn-block" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" size={18} aria-label="Inscription en cours" /> : "S'inscrire et commencer"}
              </button>
            </form>
          )}

          <p className="vt-auth-secure">
            <ShieldCheck size={16} strokeWidth={1.75} aria-hidden="true" />
            Connexion chiffrée et données protégées
          </p>
          <p className="vt-auth-help">
            Besoin d'aide ? <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">Écrivez-nous sur WhatsApp</a>
          </p>
        </div>
      </main>
    </div>
  );
```

Les états, gestionnaires, champs, leur ordre et leurs noms sont ceux d'avant. Ajouts sans effet sur la logique : `id`/`htmlFor` qui relient chaque libellé à son champ, `autoComplete`, et un `aria-label` sur le bouton qui montre le mot de passe.

- [ ] **Step 3: `TermsOfServicePage.tsx`**

Le tableau `sections` (et ses commentaires) reste tel quel. Le reste du fichier devient :

```tsx
import { ArrowLeft, Info, Mail, Phone } from 'lucide-react';
import '@fontsource-variable/geist';
import '../styles/site.css';
import { SITE } from '../config/site';

interface TermsOfServicePageProps {
  onBack: () => void;
  onRegister: () => void;
}

interface Section {
  id: string;
  title: string;
  content: string;
}

const sections: Section[] = [
  // … inchangé …
];

export const TermsOfServicePage = ({ onBack, onRegister }: TermsOfServicePageProps) => {
  const year = new Date().getFullYear();
  const legal = SITE.legal ? `${SITE.legal.name}. RCCM ${SITE.legal.rccm}.` : 'MediClinic.';
  return (
    <div className="site vt-terms">
      <header className="vt-nav">
        <div className="vt-wrap vt-nav-bar">
          <button type="button" className="vt-plain vt-nav-logo" onClick={onBack} aria-label="MediClinic, retour à l'accueil">
            <img src="/logo-horizontal.svg" alt="" width={103} height={28} />
          </button>
          <div className="vt-nav-right">
            <button type="button" className="vt-terms-back" onClick={onBack}>
              <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              Retour
            </button>
            <button type="button" className="vt-btn vt-btn-primary vt-btn-sm" onClick={onRegister}>Essayer gratuitement</button>
          </div>
        </div>
      </header>

      <main className="vt-wrap vt-terms-main">
        <header className="vt-terms-header">
          <h1>Conditions générales d'utilisation</h1>
          <p>Dernière mise à jour : [date de dernière mise à jour]. Document provisoire, en attente de validation juridique.</p>
        </header>

        <div className="vt-terms-layout">
          <nav className="vt-terms-toc" aria-label="Sommaire">
            <p className="vt-terms-toc-title">Sommaire</p>
            {sections.map((s) => <a key={s.id} href={`#section-${s.id}`}>{s.title}</a>)}
          </nav>

          <div className="vt-terms-content">
            <div className="vt-terms-warning">
              <Info size={18} strokeWidth={1.75} aria-hidden="true" />
              <p>
                Ce document est un modèle de structure généré automatiquement et contient des sections à compléter (entre crochets). Il ne doit pas être publié tel quel : il doit être relu et complété avec les informations juridiques réelles de l'entreprise avant toute mise en ligne.
              </p>
            </div>

            {sections.map((s) => (
              <section key={s.id} id={`section-${s.id}`} className="vt-terms-section">
                <h2>{s.title}</h2>
                <p>{s.content}</p>
              </section>
            ))}

            <div className="vt-terms-contact">
              <h2>Des questions sur ces conditions ?</h2>
              <p>Notre équipe est disponible pour répondre à vos questions.</p>
              <ul>
                <li>
                  <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
                  {/* Adresse de contact des CGU : elle doit rester relevée, une
                      adresse morte ici vaut moins que pas d'adresse du tout.
                      `contact@mediclinicpro.com` a été essayée puis abandonnée,
                      la boîte n'étant pas exploitable. */}
                  <a href="mailto:blog.ousmane@gmail.com">blog.ousmane@gmail.com</a>
                </li>
                <li>
                  <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>{SITE.whatsapp.display}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <footer className="vt-footer">
        <div className="vt-wrap vt-footer-legal vt-terms-footer">
          <span>© {year} {legal}</span>
          <span>Logiciel de gestion de clinique pour la Côte d'Ivoire.</span>
        </div>
      </footer>
    </div>
  );
};
```

Le contenu juridique ne change pas, crochets compris : le compléter est l'affaire du propriétaire et d'un juriste.

- [ ] **Step 4: Titres d'onglet des pages publiques (`App.tsx`)**

```tsx
      const loggedOutTitles: Record<string, string> = {
        landing: "MediClinic, logiciel de gestion de clinique en Côte d'Ivoire",
        login: 'Connexion · MediClinic',
        register: 'Créer un compte · MediClinic',
        terms: "Conditions générales d'utilisation · MediClinic"
      };
```

Les titres de l'application connectée ne changent pas : ils relèvent du chantier 3.

- [ ] **Step 5: Vérifier**

Run: `cd frontend && npm run build && npm run lint`

Avec `npm run dev`, à 1440 puis 390 px : connexion, bascule vers « Créer un compte », « Mot de passe oublié ? » puis retour, œil du mot de passe, bouton Google (si `VITE_GOOGLE_CLIENT_ID` est défini), « Retour à l'accueil » ; CGU, sommaire, retour. Une connexion réelle échoue proprement avec le backend arrêté (message d'erreur affiché, bouton réactivé).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Auth/AuthPage.tsx frontend/src/pages/TermsOfServicePage.tsx frontend/src/App.tsx
git commit -m "feat(vitrine): connexion, inscription et CGU au style de la vitrine, logique inchangee"
```

---

### Task 7: Métadonnées, vrai domaine et image de partage (défaut 3)

**Files:**
- Modify: `frontend/index.html`, `frontend/public/robots.txt`, `frontend/public/sitemap.xml`

- [ ] **Step 1: `index.html`**

- `<title>` devient `MediClinic, logiciel de gestion de clinique en Côte d'Ivoire`.
- Le commentaire sur le prix gagne une phrase : « La durée d'essai, « 7 jours », est écrite à la main pour la même raison : la vitrine lit la durée réelle dans l'API (réglage `starter_trial_days` de Platform Admin), ces métadonnées non. Si ce réglage change, les mettre à jour. »
- Le commentaire `TODO: replace https://mediclinicpro.example…` disparaît.
- `canonical` et `og:url` : `https://mediclinicpro.com/`.
- `og:title` et `twitter:title` : `MediClinic, logiciel de gestion de clinique en Côte d'Ivoire`.
- `og:image` et `twitter:image` : `https://mediclinicpro.com/og-image.png`, suivis de :

```html
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="MediClinic : toute votre clinique, de l'accueil à la caisse" />
```

- [ ] **Step 2: `robots.txt` et `sitemap.xml`**

`Sitemap: https://mediclinicpro.com/sitemap.xml` et `<loc>https://mediclinicpro.com/</loc>`.

- [ ] **Step 3: Vérifier**

Run: `grep -rn "mediclinicpro.example\|—" frontend/index.html frontend/public/robots.txt frontend/public/sitemap.xml`
Expected: aucune ligne.

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html frontend/public/robots.txt frontend/public/sitemap.xml
git commit -m "fix(vitrine): metadonnees sur le vrai domaine, image de partage reelle"
```

---

### Task 8: Retirer l'ancienne vitrine

**Files:**
- Delete: `frontend/src/components/AppPreview.tsx`, `frontend/public/doctor_hero.png`, `frontend/public/lab_showcase.png`, `frontend/public/clinic_hero.png`, `frontend/public/optimized/`
- Modify: `frontend/src/index.css`

- [ ] **Step 1: Vérifier que rien ne les référence plus**

Run: `grep -rnE "AppPreview|doctor_hero|lab_showcase|clinic_hero|/optimized/" frontend/src frontend/index.html frontend/scripts`
Expected: aucune ligne (sinon, retirer la référence avant de supprimer).

- [ ] **Step 2: Supprimer les fichiers**

```bash
git rm frontend/src/components/AppPreview.tsx frontend/public/doctor_hero.png frontend/public/lab_showcase.png frontend/public/clinic_hero.png
git rm -r frontend/public/optimized
```

- [ ] **Step 3: Retirer les règles de l'ancienne vitrine de `index.css`**

Règles à retirer : toute règle dont **chaque** sélecteur commence par `.landing-`, `.pricing-cards-grid`, `.auth-` ou `.terms-`, y compris à l'intérieur des `@media` (un `@media` vidé disparaît avec), et les blocs qui ne déclarent que des jetons `--lp-*` ou `--tp-*`. Une règle qui mêle un de ces sélecteurs et un autre garde l'autre.

Procédure : un script de nettoyage dans le dossier temporaire de la session (hors dépôt), qui parcourt le CSS au niveau des accolades et n'écrit qu'après avoir listé ce qu'il retire. Relire la liste avant d'écrire.

Run ensuite : `grep -cE "\.(landing|auth|terms)-|pricing-cards-grid|--(lp|tp)-" frontend/src/index.css`
Expected: `0`.

Run: `grep -rnoE "class(Name)?=\"[^\"]*(landing|auth|terms)-" frontend/src`
Expected: aucune ligne (sinon, une classe encore utilisée a perdu son style).

- [ ] **Step 4: Vérifier**

Run: `cd frontend && npm run build && npm run lint && npm test`
Puis parcourir l'application connectée avec `npm run dev` (tableau de bord, patients, paramètres) : rien n'a changé d'aspect.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/index.css
git commit -m "chore(vitrine): retrait de l'ancienne vitrine, de ses images generees et de ses styles"
```

---

### Task 9: Vérification complète, documentation, PR

**Files:**
- Modify: `CLAUDE.md`
- Scripts de vérification : dossier temporaire de la session, hors dépôt.

- [ ] **Step 1: Captures relues une par une**

Servir `frontend/dist` avec les en-têtes de `vercel.json` (CSP appliquée), sous un nom d'hôte autre que `localhost` (`--host-resolver-rules=MAP mediclinic.test 127.0.0.1`), `/api/settings/public/plans` simulé. Capturer en pleine page, mouvement réduit : vitrine à 1440, 1024, 768 et 390 px ; connexion, inscription, mot de passe oublié et CGU à 1440 et 390 px. Contrôles automatiques, puis relecture de chaque image :
- aucun débordement horizontal (`scrollWidth` égal à la largeur de la fenêtre) ;
- titres sur deux lignes au plus sur ordinateur ; aucun bouton sur deux lignes ;
- aucune violation CSP, aucune erreur JavaScript ;
- API absente : repli affiché ; API à `trialDays: 14` : « 14 jours » partout.

- [ ] **Step 2: Clavier**

Ordre de tabulation (lien d'évitement, logo, ancres, Connexion, Essayer gratuitement…), focus visible partout, onglets aux flèches, Début et Fin, accordéon à Entrée et Espace, menu du téléphone fermé par Échap.

- [ ] **Step 3: Contrastes**

Calculer le rapport de chaque couple texte/fond des jetons (`--ink`, `--ink-2`, `--muted` sur `--bg`, `--surface`, `--brand-soft` ; blanc et `--on-brand-muted` sur `--brand`). Exigé : 4,5:1 pour le texte courant, 3:1 au-dessus de 18 px.

- [ ] **Step 4: Performance**

Lighthouse mobile sur `npm run preview` : performance ≥ 90, LCP < 2,5 s, CLS < 0,1. Si l'outil n'est pas disponible sur le poste, mesurer LCP et CLS dans Chrome avec ralentissement processeur ×4 et réseau « 4G lente », et le dire dans la PR.

- [ ] **Step 5: Grille du skill `design-taste-frontend`**

Relire la section 14 du skill, case par case, et corriger ce qui ne passe pas.

- [ ] **Step 6: Documentation**

Dans `CLAUDE.md` :
- section « Frontend structure » : la vitrine (`pages/LandingPage.tsx` qui assemble `pages/Landing/`, une section par fichier), `styles/site.css` (jetons sous `.site`, préfixe `vt-`, pourquoi : `.btn` existe déjà, `*` et `h1-h6` d'`index.css` à redéclarer), `config/site.ts` (blocs masqués tant que `null`), `utils/publicPlans.ts` (repli et fusion), et la règle « aucun prix écrit en dur dans la vitrine » ;
- les captures : `npm run captures` (Vite, API simulée, polices Google seules autorisées), les noms produits, et quand les relancer ;
- `GET /settings/public/plans` renvoie la durée d'essai effective ;
- le paragraphe SEO : le domaine est réel, l'image de partage est `og-image.png`, la durée d'essai des métadonnées reste écrite à la main ;
- la liste des tests : `public-plans.test.js`, `utils/frenchList.test.ts`, `utils/publicPlans.test.ts`.

- [ ] **Step 7: Tests complets, push, PR**

Run: `cd backend && npm test` puis `cd frontend && npm test && npm run build && npm run lint`

```bash
git push -u origin feat/vitrine-refonte
gh pr create --base main --head feat/vitrine-refonte --title "feat(vitrine): refonte de la vitrine, de la connexion et des CGU (direction A)" --body-file <corps en français : résumé, captures relues, tests, points à fournir par le propriétaire>
```

Le corps de PR liste aussi ce que le propriétaire doit fournir : fondateur, raison sociale et RCCM, photo réelle, confirmation des moyens de paiement de la boutique Chariow.

---

## Annexe A : `frontend/src/styles/site.css`

```css
/* Vitrine, connexion et CGU : un système visuel à part, déclaré sous .site.
   Rien ici ne s'applique à l'application connectée, qui garde index.css.
   Toutes les classes portent le préfixe vt- : index.css définit déjà .btn et
   .btn-primary, et un nom générique finirait par entrer en collision.
   Conception : docs/superpowers/specs/2026-10-05-vitrine-refonte-design.md */

.site {
  --bg: #f5f7f6;
  --surface: #ffffff;
  --surface-2: #eef2f0;
  --ink: #0f1a17;
  --ink-2: #3a4743;
  --muted: #5b6762;
  --line: #e0e6e3;
  --line-2: #ccd6d1;
  --brand: #1e4d40;
  --brand-hover: #163a30;
  --brand-soft: #e4eee9;
  --brand-soft-2: #d3e5dc;
  --on-brand-muted: #c4dbd1;
  --r-ctl: 10px;
  --r-panel: 16px;
  --r-shot: 12px;
  --gutter: 56px;
  --shot-shadow: 0 44px 90px -36px rgba(20, 62, 50, 0.3), 0 10px 26px -14px rgba(20, 62, 50, 0.14);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  --font: 'Geist Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'Geist Mono Variable', ui-monospace, 'SFMono-Regular', Menlo, monospace;
  min-height: 100vh;
  background: var(--bg);
  color: var(--ink);
  font-size: 17px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  color-scheme: light;
}

/* index.css pose la police de l'application sur chaque élément (*) et une
   couleur sur les titres : sans ces deux règles, Geist ne s'appliquerait à
   aucun enfant, et les titres deviendraient blancs en thème sombre. */
.site,
.site * { font-family: var(--font); }
.site :is(h1, h2, h3, h4) { color: var(--ink); font-weight: 600; line-height: 1.2; }
.site img { display: block; max-width: 100%; height: auto; }
.site button { cursor: pointer; }
.site :focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; box-shadow: none; }
.site .vt-mono { font-family: var(--font-mono); font-size: 0.92em; color: var(--ink); }

/* Ancres : la barre collante ne masque pas le titre visé. index.css met
   overflow-x: hidden sur html et body, ce qui fait de body un conteneur de
   défilement et décolle la navigation ; clip coupe sans cet effet. */
html:has(.site) { scroll-padding-top: 84px; }
html:has(.site),
html:has(.site) body { overflow-x: clip; }
@media (prefers-reduced-motion: reduce) {
  html:has(.site) { scroll-behavior: auto; }
}

.vt-skip { position: absolute; left: 16px; top: -60px; z-index: 100; padding: 10px 14px; border-radius: var(--r-ctl); background: var(--brand); color: #fff; font-weight: 500; }
.vt-skip:focus { top: 12px; }
.vt-plain { background: none; border: 0; padding: 0; }

.vt-wrap { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 var(--gutter); }
.vt-section { padding: 120px 0; }
.vt-section-tight { padding-top: 0; }
.site h2 { font-size: 44px; line-height: 1.08; letter-spacing: -0.035em; text-wrap: balance; max-width: 22ch; }
.site h3 { font-size: 20px; line-height: 1.3; letter-spacing: -0.015em; }
.vt-lead { margin-top: 18px; font-size: 19px; line-height: 1.55; color: var(--ink-2); max-width: 58ch; text-wrap: pretty; }

/* ----- Boutons : une seule forme, 10 px partout ----- */
.vt-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; height: 50px; padding: 0 22px; border-radius: var(--r-ctl); border: 1px solid transparent; font-size: 16px; font-weight: 500; line-height: 1; white-space: nowrap; transition: background-color 0.2s var(--ease), border-color 0.2s var(--ease), transform 0.12s var(--ease); }
.vt-btn:active { transform: translateY(1px); }
.vt-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
.vt-btn-primary { background: var(--brand); color: #fff; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 1px 2px rgba(15, 26, 23, 0.25); }
.vt-btn-primary:hover { background: var(--brand-hover); }
.vt-btn-ghost { background: var(--surface); color: var(--ink); border-color: var(--line-2); }
.vt-btn-ghost:hover { border-color: #9fb0a8; }
.vt-btn-sm { height: 38px; padding: 0 15px; font-size: 14px; border-radius: 8px; }
.vt-btn-block { width: 100%; }

/* Logo WhatsApp officiel en masque : il prend la couleur qu'on lui donne. */
.vt-wa { display: inline-block; width: 18px; height: 18px; flex-shrink: 0; background-color: currentColor; -webkit-mask: url('/brand/whatsapp.svg') center / contain no-repeat; mask: url('/brand/whatsapp.svg') center / contain no-repeat; }
.vt-btn-ghost .vt-wa { background-color: var(--brand); }

/* ----- Navigation ----- */
.vt-nav { position: sticky; top: 0; z-index: 50; background: rgba(245, 247, 246, 0.86); -webkit-backdrop-filter: saturate(160%) blur(14px); backdrop-filter: saturate(160%) blur(14px); border-bottom: 1px solid var(--line); }
.vt-nav-bar { height: 68px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.vt-nav-logo { flex-shrink: 0; }
.vt-nav-logo img { height: 28px; width: auto; }
.vt-nav-links { display: flex; gap: 32px; font-size: 15px; font-weight: 500; color: var(--ink-2); }
.vt-nav-right { display: flex; align-items: center; gap: 20px; }
.vt-nav-login,
.vt-terms-back { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; padding: 0; font-size: 15px; font-weight: 500; color: var(--ink-2); }
.vt-nav-links a:hover,
.vt-nav-login:hover,
.vt-terms-back:hover { color: var(--ink); }
.vt-nav-burger { display: none; width: 42px; height: 42px; align-items: center; justify-content: center; border-radius: var(--r-ctl); border: 1px solid var(--line-2); background: var(--surface); color: var(--ink); }
.vt-menu { border-top: 1px solid var(--line); background: var(--surface); }
.vt-menu nav { display: grid; padding-top: 8px; padding-bottom: 16px; }
.vt-menu a,
.vt-menu button { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0; border: 0; border-bottom: 1px solid var(--line); background: none; font-size: 16px; font-weight: 500; color: var(--ink); text-align: left; }
.vt-menu nav > :last-child { border-bottom: 0; }
.vt-menu .vt-wa { background-color: var(--brand); }

/* ----- Héros ----- */
.vt-hero { overflow: hidden; padding: 88px 0 96px; }
.vt-hero-grid { display: grid; grid-template-columns: minmax(0, 560px) minmax(0, 1fr); gap: 64px; align-items: start; }
.vt-hero-eyebrow { margin-bottom: 22px; font-size: 15px; font-weight: 500; color: var(--brand); }
.site .vt-hero h1 { font-size: 56px; line-height: 1.02; letter-spacing: -0.042em; text-wrap: balance; }
.vt-hero .vt-lead { margin-top: 24px; }
.vt-hero-ctas { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 36px; }
.vt-hero-shot { width: 900px; margin-top: -8px; }

/* ----- Captures dans leur cadre de navigateur ----- */
.vt-shot { margin: 0; border-radius: var(--r-shot); overflow: hidden; border: 1px solid var(--line-2); background: var(--surface); box-shadow: var(--shot-shadow); }
.vt-shot-bar { height: 30px; display: flex; align-items: center; justify-content: center; background: var(--surface-2); border-bottom: 1px solid var(--line); }
.site .vt-shot-bar span { padding: 3px 16px; border-radius: 6px; background: var(--surface); font-family: var(--font-mono); font-size: 11px; color: #69766f; }
.vt-shot picture,
.vt-shot img { display: block; width: 100%; }
.vt-shot img { aspect-ratio: 1440 / 900; object-fit: cover; object-position: top; }

/* ----- Mouvement : entrée du héros, apparition au défilement, onglets ----- */
@media (prefers-reduced-motion: no-preference) {
  .vt-rise { opacity: 0; transform: translateY(10px); animation: vt-rise 0.7s var(--ease) forwards; animation-delay: calc(var(--i, 0) * 70ms + 80ms); }
  @keyframes vt-rise { to { opacity: 1; transform: none; } }
  .site.vt-js .vt-reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.6s var(--ease), transform 0.6s var(--ease); }
  .site.vt-js .vt-reveal.is-visible { opacity: 1; transform: none; }
  .vt-panel:not([hidden]) { animation: vt-fade 0.45s var(--ease); }
  @keyframes vt-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
}

/* ----- Faits ----- */
.vt-facts { background: var(--surface); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.vt-facts ul { list-style: none; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.vt-facts li { display: flex; gap: 14px; padding: 30px 28px; border-left: 1px solid var(--line); }
.vt-facts li:first-child { border-left: 0; padding-left: 0; }
.vt-facts svg { flex-shrink: 0; margin-top: 3px; color: var(--brand); }
.vt-facts strong { display: block; font-size: 16px; font-weight: 600; line-height: 1.35; }
.vt-facts span { display: block; margin-top: 3px; font-size: 14.5px; line-height: 1.45; color: var(--muted); }

/* ----- Parcours (onglets) ----- */
.vt-tabs { display: inline-flex; gap: 4px; max-width: 100%; margin-top: 44px; padding: 4px; overflow-x: auto; scrollbar-width: none; background: var(--surface-2); border: 1px solid var(--line); border-radius: 12px; }
.vt-tab { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border: 0; border-radius: 9px; background: transparent; font-size: 15px; font-weight: 500; color: var(--ink-2); white-space: nowrap; transition: background-color 0.2s var(--ease), color 0.2s var(--ease); }
.vt-tab[aria-selected='true'] { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(15, 26, 23, 0.08), 0 0 0 1px var(--line); }
.vt-panel { display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 1fr); gap: 56px; align-items: center; margin-top: 40px; }
.vt-panel[hidden] { display: none; }
.site .vt-panel h3 { font-size: 26px; line-height: 1.2; letter-spacing: -0.025em; }
.vt-panel ul { list-style: none; display: grid; gap: 14px; margin-top: 22px; }
.vt-panel li { display: flex; gap: 12px; font-size: 16px; line-height: 1.5; color: var(--ink-2); }
.vt-panel li svg { flex-shrink: 0; margin-top: 3px; color: var(--brand); }
.vt-caption { margin-top: 22px; font-size: 14px; color: var(--muted); }

/* ----- Documents ----- */
.vt-docs { background: var(--surface); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.vt-docs-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 500px); gap: 64px; align-items: center; }
.vt-docs-points { display: grid; gap: 22px; margin-top: 36px; }
.vt-docs-points div { padding-left: 18px; border-left: 2px solid var(--brand-soft-2); }
.vt-docs-points dt { font-size: 16px; font-weight: 600; }
.vt-docs-points dd { margin-top: 2px; font-size: 15.5px; color: var(--muted); }
.vt-paper-stage { padding: 44px 44px 0; overflow: hidden; border-radius: var(--r-panel); background: var(--brand-soft); }
.vt-paper { margin: 0; aspect-ratio: 1640 / 1080; overflow: hidden; border-radius: 8px 8px 0 0; background: #fff; box-shadow: 0 30px 60px -28px rgba(20, 62, 50, 0.35), 0 0 0 1px rgba(20, 62, 50, 0.06); }
.vt-paper picture,
.vt-paper img { width: 100%; height: 100%; }
.vt-paper img { object-fit: cover; object-position: top; }

/* ----- Photo réelle (facultative) ----- */
.vt-field-photo { margin: 0; }
.vt-field-photo img { width: 100%; aspect-ratio: 21 / 9; object-fit: cover; }

/* ----- « Fait pour les cliniques d'ici » ----- */
.vt-bento { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-areas: 'phone roles roles' 'phone money secure'; gap: 16px; margin-top: 48px; }
.vt-cell { display: flex; flex-direction: column; gap: 10px; padding: 32px; overflow: hidden; border-radius: var(--r-panel); border: 1px solid var(--line); background: var(--surface); }
.vt-cell p { font-size: 15.5px; line-height: 1.55; color: var(--muted); }
.vt-cell-phone { grid-area: phone; padding-bottom: 0; background: var(--brand); border-color: var(--brand); }
.site .vt-cell-phone h3 { color: #fff; }
.vt-cell-phone p { color: var(--on-brand-muted); }
.vt-phone-shot { align-self: center; width: 78%; margin: 26px 0 0; aspect-ratio: 390 / 560; overflow: hidden; border: 6px solid #0f2a22; border-bottom: 0; border-radius: 22px 22px 0 0; box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.25); }
.vt-phone-shot picture,
.vt-phone-shot img { width: 100%; height: 100%; }
.vt-phone-shot img { object-fit: cover; object-position: top; }
.vt-cell-roles { grid-area: roles; }
.vt-chips { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.vt-chips li { padding: 7px 12px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface-2); font-size: 14px; font-weight: 500; color: var(--ink-2); }
.vt-cell-money { grid-area: money; background: var(--brand-soft); border-color: var(--brand-soft-2); }
.vt-cell .vt-amount { margin-top: auto; padding-top: 18px; font-size: 34px; font-weight: 600; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; color: var(--ink); }
.vt-amount small { font-size: 15px; font-weight: 500; letter-spacing: 0; color: var(--ink-2); }
.vt-cell-secure { grid-area: secure; }
.vt-cell-secure ul { list-style: none; display: grid; gap: 12px; margin-top: 8px; }
.vt-cell-secure li { display: flex; gap: 10px; font-size: 15px; line-height: 1.45; color: var(--ink-2); }
.vt-cell-secure li svg { flex-shrink: 0; margin-top: 2px; color: var(--brand); }

/* ----- Tarifs ----- */
.vt-pricing { background: var(--surface); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.vt-trial { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-top: 48px; padding: 26px 30px; border-radius: var(--r-panel); border: 1px solid var(--brand-soft-2); background: var(--brand-soft); }
.vt-trial strong { display: block; font-size: 18px; font-weight: 600; }
.vt-trial span { display: block; margin-top: 2px; font-size: 15.5px; color: var(--ink-2); }
.vt-plans { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
.vt-plan { padding: 34px 30px; border-radius: var(--r-panel); border: 1px solid var(--line-2); background: var(--surface); }
.vt-plan-for { margin-top: 4px; font-size: 15.5px; color: var(--muted); }
.vt-price { display: flex; align-items: baseline; gap: 8px; margin-top: 26px; }
.vt-price-amount { font-size: 52px; font-weight: 600; line-height: 1; letter-spacing: -0.045em; font-variant-numeric: tabular-nums; }
.vt-price-unit { font-size: 15.5px; font-weight: 500; color: var(--muted); }
.vt-plan ul { list-style: none; display: grid; gap: 10px; margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--line); }
.vt-plan li,
.vt-included li { display: flex; gap: 10px; font-size: 16px; color: var(--ink-2); }
.vt-plan li svg,
.vt-included li svg { flex-shrink: 0; margin-top: 3px; color: var(--brand); }
.vt-included { display: grid; grid-template-columns: minmax(0, 260px) minmax(0, 1fr); gap: 40px; margin-top: 48px; }
.site .vt-included h3 { font-size: 17px; }
.vt-included ul { list-style: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 24px; }
.vt-included li { font-size: 15.5px; }
.vt-pay-note { margin-top: 36px; padding-top: 22px; border-top: 1px solid var(--line); font-size: 15px; color: var(--muted); }

/* ----- Fondateur ----- */
.vt-founder-grid { display: grid; grid-template-columns: minmax(0, 300px) minmax(0, 1fr); gap: 72px; align-items: center; }
.vt-portrait { margin: 0; aspect-ratio: 4 / 5; overflow: hidden; border-radius: var(--r-panel); background: var(--surface-2); }
.vt-portrait img { width: 100%; height: 100%; object-fit: cover; }
.vt-founder blockquote { margin: 0; max-width: 30ch; font-size: 30px; font-weight: 500; line-height: 1.3; letter-spacing: -0.025em; text-wrap: balance; color: var(--ink); }
.vt-who { margin-top: 26px; color: var(--ink-2); }
.vt-who strong { font-weight: 600; color: var(--ink); }
.vt-founder .vt-btn { margin-top: 28px; }

/* ----- Questions ----- */
.vt-faq-grid { display: grid; grid-template-columns: minmax(0, 360px) minmax(0, 1fr); gap: 72px; align-items: start; }
.vt-faq-side { position: sticky; top: 108px; }
.vt-faq-side p { margin-top: 16px; font-size: 16px; color: var(--muted); }
.vt-faq-side a,
.vt-faq details a { font-weight: 500; color: var(--brand); text-decoration: underline; text-underline-offset: 3px; }
.vt-faq details { border-bottom: 1px solid var(--line); }
.vt-faq details:first-child { border-top: 1px solid var(--line); }
.vt-faq summary { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 22px 0; list-style: none; cursor: pointer; font-size: 17.5px; font-weight: 500; letter-spacing: -0.01em; color: var(--ink); }
.vt-faq summary::-webkit-details-marker { display: none; }
.vt-faq summary svg { flex-shrink: 0; color: var(--muted); transition: transform 0.25s var(--ease); }
.vt-faq details[open] summary svg { transform: rotate(45deg); }
.vt-faq details p { padding: 0 48px 24px 0; font-size: 16px; line-height: 1.65; color: var(--ink-2); }

/* ----- Appel final ----- */
.vt-closing-panel { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 48px; align-items: end; padding: 72px 64px; border-radius: 20px; background: var(--brand); }
.site .vt-closing-panel h2 { max-width: 24ch; color: #fff; }
.vt-closing-panel .vt-lead { color: var(--on-brand-muted); }
.vt-closing-ctas { display: flex; flex-direction: column; gap: 12px; min-width: 260px; }
.vt-closing-panel .vt-btn-primary { background: #fff; color: var(--brand); box-shadow: none; }
.vt-closing-panel .vt-btn-primary:hover { background: #eef5f1; }
.vt-closing-panel .vt-btn-ghost { background: transparent; color: #fff; border-color: rgba(255, 255, 255, 0.28); }
.vt-closing-panel .vt-btn-ghost:hover { border-color: rgba(255, 255, 255, 0.6); }
.vt-closing-panel .vt-btn-ghost .vt-wa { background-color: currentColor; }

/* ----- Pied de page ----- */
.vt-footer { padding: 64px 0 40px; border-top: 1px solid var(--line); }
.vt-footer-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(0, 1fr)); gap: 40px; }
.vt-footer-brand img { height: 26px; width: auto; }
.vt-footer-brand p { max-width: 32ch; margin-top: 16px; font-size: 15px; color: var(--muted); }
.site .vt-footer-title { max-width: none; margin-bottom: 14px; font-size: 14px; line-height: 1.4; letter-spacing: 0; }
.vt-footer ul { list-style: none; display: grid; gap: 10px; }
.vt-footer ul a,
.vt-footer ul button { padding: 0; border: 0; background: none; font-size: 15px; color: var(--ink-2); text-align: left; }
.vt-footer ul a:hover,
.vt-footer ul button:hover { color: var(--ink); }
.vt-footer-legal { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 24px; margin-top: 56px; padding-top: 24px; border-top: 1px solid var(--line); font-size: 14px; color: var(--muted); }

/* ----- Connexion et inscription ----- */
.vt-auth { display: grid; grid-template-columns: minmax(0, 44fr) minmax(0, 56fr); }
.vt-auth-aside { display: flex; flex-direction: column; justify-content: space-between; gap: 40px; padding: 48px 0 0 48px; overflow: hidden; background: var(--surface); border-right: 1px solid var(--line); }
.vt-auth-logo { height: 28px; width: auto; }
.site .vt-auth-aside h1 { max-width: 15ch; padding-right: 48px; font-size: 40px; line-height: 1.06; letter-spacing: -0.04em; text-wrap: balance; }
.vt-auth-trial { display: flex; align-items: center; gap: 8px; margin-top: 18px; font-size: 15px; color: var(--ink-2); }
.vt-auth-trial svg { color: var(--brand); }
.vt-auth-shot { width: 720px; max-width: none; border-bottom: 0; border-right: 0; border-radius: var(--r-shot) 0 0 0; }
.vt-auth-main { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 96px 24px 48px; }
.vt-auth-back { position: absolute; top: 28px; left: 28px; display: inline-flex; align-items: center; gap: 6px; padding: 0; border: 0; background: none; font-size: 14px; font-weight: 500; color: var(--ink-2); }
.vt-auth-back:hover { color: var(--ink); }
.vt-auth-card { display: flex; flex-direction: column; gap: 20px; width: 100%; max-width: 420px; }
.site .vt-auth-card h2 { font-size: 30px; line-height: 1.15; letter-spacing: -0.03em; }
.vt-auth-sub { margin-top: 6px; font-size: 15px; color: var(--muted); }
.vt-auth-switch { display: flex; gap: 4px; padding: 4px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2); }
.vt-auth-switch button { flex: 1; height: 38px; border: 0; border-radius: 9px; background: transparent; font-size: 15px; font-weight: 500; color: var(--ink-2); }
.vt-auth-switch button[aria-pressed='true'] { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(15, 26, 23, 0.08), 0 0 0 1px var(--line); }
.vt-form { display: flex; flex-direction: column; gap: 16px; }
.vt-field { display: flex; flex-direction: column; gap: 6px; }
.vt-field-label { font-size: 14px; font-weight: 500; color: var(--ink-2); }
.vt-field-control { position: relative; display: flex; align-items: center; }
.vt-field-control > svg { position: absolute; left: 14px; color: var(--muted); pointer-events: none; }
.vt-field-control input { width: 100%; height: 48px; padding: 0 14px 0 42px; border-radius: var(--r-ctl); border: 1px solid var(--line-2); background: var(--surface); font-size: 16px; color: var(--ink); transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease); }
.vt-field-control input.vt-has-toggle { padding-right: 48px; }
.vt-field-control input::placeholder { color: #8a9590; }
.vt-field-control input:focus { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(30, 77, 64, 0.14); }
.vt-field-toggle { position: absolute; right: 6px; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border: 0; border-radius: 8px; background: none; color: var(--muted); }
.vt-field-phone { padding: 4px; border-radius: var(--r-ctl); border: 1px solid var(--line-2); background: var(--surface); }
.vt-link { align-self: flex-end; padding: 0; border: 0; background: none; font-size: 14px; font-weight: 500; color: var(--brand); text-decoration: underline; text-underline-offset: 3px; }
.vt-link-center { align-self: center; }
.vt-or { display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--muted); }
.vt-or::before,
.vt-or::after { content: ''; flex: 1; height: 1px; background: var(--line); }
.vt-google { display: flex; justify-content: center; min-height: 44px; }
.vt-auth-text { font-size: 15px; line-height: 1.55; color: var(--ink-2); }
.vt-auth-note { display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 14px; color: var(--muted); text-align: center; }
.vt-auth-secure { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 12px; border-radius: var(--r-ctl); border: 1px solid var(--brand-soft-2); background: var(--brand-soft); font-size: 13.5px; font-weight: 500; color: var(--brand); }
.vt-auth-help { font-size: 14px; color: var(--ink-2); text-align: center; }
.vt-auth-help a { font-weight: 500; color: var(--brand); text-decoration: underline; text-underline-offset: 3px; }

/* ----- CGU ----- */
.vt-terms-main { padding-top: 64px; padding-bottom: 96px; }
.vt-terms-header { max-width: 720px; padding-bottom: 40px; border-bottom: 1px solid var(--line); }
.site .vt-terms-header h1 { font-size: 44px; line-height: 1.08; letter-spacing: -0.035em; text-wrap: balance; }
.vt-terms-header p { margin-top: 14px; font-size: 15px; color: var(--muted); }
.vt-terms-layout { display: grid; grid-template-columns: minmax(0, 260px) minmax(0, 1fr); gap: 64px; align-items: start; margin-top: 48px; }
.vt-terms-toc { position: sticky; top: 100px; display: grid; gap: 8px; font-size: 14.5px; }
.vt-terms-toc-title { margin-bottom: 4px; font-size: 13px; font-weight: 600; color: var(--muted); }
.vt-terms-toc a { color: var(--ink-2); }
.vt-terms-toc a:hover { color: var(--brand); }
.vt-terms-content { display: grid; gap: 36px; max-width: 72ch; }
.vt-terms-warning { display: flex; gap: 12px; padding: 18px 20px; border-radius: var(--r-panel); border: 1px solid var(--brand-soft-2); background: var(--brand-soft); }
.vt-terms-warning svg { flex-shrink: 0; margin-top: 3px; color: var(--brand); }
.vt-terms-warning p { font-size: 15px; line-height: 1.6; color: var(--ink-2); }
.site .vt-terms-section h2,
.site .vt-terms-contact h2 { max-width: none; font-size: 20px; line-height: 1.3; letter-spacing: -0.015em; }
.vt-terms-section p { margin-top: 10px; font-size: 16px; line-height: 1.7; color: var(--ink-2); }
.vt-terms-contact { padding: 26px 28px; border-radius: var(--r-panel); border: 1px solid var(--line); background: var(--surface); }
.vt-terms-contact > p { margin-top: 8px; font-size: 15px; color: var(--muted); }
.vt-terms-contact ul { list-style: none; display: flex; flex-wrap: wrap; gap: 12px 28px; margin-top: 14px; font-size: 15px; }
.vt-terms-contact li { display: flex; align-items: center; gap: 8px; color: var(--ink-2); }
.vt-terms-contact svg { color: var(--brand); }
.vt-terms-contact a { font-weight: 500; color: var(--brand); }
.vt-terms-footer { margin-top: 0; padding-top: 0; border-top: 0; }

/* ===================== Tablette ===================== */
@media (max-width: 1080px) {
  .site h2 { font-size: 38px; }
  .site .vt-hero h1 { font-size: 48px; }
  .vt-hero-grid { grid-template-columns: 1fr; gap: 48px; }
  .vt-hero-copy { max-width: 640px; }
  .vt-hero-shot { width: 100%; margin: 0; }
  .vt-facts ul { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .vt-facts li { border-left: 0; padding: 22px 0; }
  .vt-panel,
  .vt-docs-grid,
  .vt-faq-grid,
  .vt-founder-grid { grid-template-columns: 1fr; gap: 40px; }
  .vt-faq-side { position: static; }
  .vt-bento { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-areas: 'phone roles' 'phone money' 'phone secure'; }
  .vt-included { grid-template-columns: 1fr; gap: 20px; }
  .vt-closing-panel { grid-template-columns: 1fr; }
  .vt-footer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .vt-terms-layout { grid-template-columns: 1fr; gap: 32px; }
  .vt-terms-toc { position: static; }
}

@media (max-width: 960px) {
  .vt-auth { grid-template-columns: 1fr; }
  .vt-auth-aside { display: none; }
}

@media (min-width: 641px) {
  .vt-menu { display: none; }
}

/* ===================== Téléphone ===================== */
@media (max-width: 640px) {
  .site { --gutter: 20px; font-size: 16px; }
  .vt-section { padding: 72px 0; }
  .vt-section-tight { padding-top: 0; }
  .site h2 { font-size: 30px; line-height: 1.12; }
  .vt-lead { font-size: 17px; }
  .vt-nav-bar { height: 60px; }
  .vt-nav-links,
  .vt-nav-login { display: none; }
  .vt-nav-burger { display: inline-flex; }
  .vt-nav-right { gap: 10px; }
  .vt-hero { padding: 40px 0 0; }
  .vt-hero-eyebrow { margin-bottom: 14px; font-size: 14px; }
  .site .vt-hero h1 { font-size: 38px; line-height: 1.05; }
  .vt-hero .vt-lead { margin-top: 18px; }
  .vt-hero-ctas { flex-direction: column; margin-top: 28px; }
  .vt-hero-ctas .vt-btn { width: 100%; }
  /* Sous 640 px, les captures passent en version téléphone, dans un cadre de téléphone. */
  .vt-shot .vt-shot-bar { display: none; }
  .vt-shot img { aspect-ratio: 390 / 620; }
  .vt-hero-shot { width: 86%; margin: 8px auto 0; border: 7px solid #13241f; border-bottom: 0; border-radius: 26px 26px 0 0; box-shadow: 0 -12px 40px -10px rgba(20, 62, 50, 0.35); }
  .vt-panel .vt-shot { width: 78%; margin: 0 auto; border: 6px solid #13241f; border-bottom: 0; border-radius: 22px 22px 0 0; }
  .vt-facts ul { grid-template-columns: 1fr 1fr; gap: 0 16px; }
  .vt-facts li { flex-direction: column; gap: 8px; padding: 20px 0; }
  .vt-facts span { font-size: 13.5px; }
  .vt-tabs { width: calc(100% + 2 * var(--gutter)); margin: 32px 0 0 calc(-1 * var(--gutter)); padding: 4px var(--gutter); border-radius: 0; border-left: 0; border-right: 0; }
  .vt-panel { margin-top: 28px; gap: 28px; }
  .site .vt-panel h3 { font-size: 22px; }
  .vt-paper-stage { padding: 24px 24px 0; }
  .vt-bento { grid-template-columns: 1fr; grid-template-areas: 'phone' 'roles' 'money' 'secure'; }
  .vt-cell { padding: 26px 22px; }
  .vt-cell-phone { padding-bottom: 0; }
  .vt-trial { flex-direction: column; align-items: stretch; padding: 22px; }
  .vt-trial .vt-btn { width: 100%; }
  .vt-plans { grid-template-columns: 1fr; }
  .vt-price-amount { font-size: 44px; }
  .vt-included ul { grid-template-columns: 1fr; }
  .vt-founder blockquote { font-size: 23px; }
  .vt-portrait { max-width: 240px; }
  .vt-faq summary { padding: 18px 0; font-size: 16.5px; }
  .vt-faq details p { padding-right: 0; }
  .vt-closing-panel { padding: 40px 24px; border-radius: 16px; }
  .vt-closing-ctas { min-width: 0; }
  .vt-closing-ctas .vt-btn { width: 100%; }
  .vt-footer-grid { grid-template-columns: 1fr 1fr; }
  .vt-footer-brand { grid-column: 1 / -1; }
  .vt-auth-main { padding: 80px 20px 32px; }
  .vt-auth-back { top: 20px; left: 20px; }
  .vt-terms-main { padding-top: 40px; }
  .site .vt-terms-header h1 { font-size: 30px; }
}
```
