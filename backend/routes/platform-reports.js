// Section Rapports du console Super Admin. Deux vues en lecture seule :
// Revenus et Adoption. Aucune donnée inventée — chaque chiffre remonte à des
// lignes réelles, et tout ce qui est un indice plutôt qu'une mesure est
// libellé comme tel côté interface.
//
// Agrégation en JS à partir de select simples, comme /api/platform/overview.
// Dette identifiée : au-delà de ~10 000 lignes, ramener patients/consultations
// pour compter en mémoire ne tiendra plus et devra passer par une fonction RPC
// Postgres.
const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/superAdmin');
const { getPlan } = require('../utils/plans');

router.use(auth, superAdminOnly);

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MONTH_LABELS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

// Douze compartiments mensuels, du plus ancien au mois courant.
function emptyMonthBuckets() {
  const buckets = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: MONTH_LABELS[date.getMonth()],
      value: 0
    });
  }
  return buckets;
}

// `_weight` absent = on compte les lignes ; présent = on somme ce poids.
function fillMonthBuckets(rows, dateField) {
  const buckets = emptyMonthBuckets();
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const row of rows) {
    const raw = row[dateField];
    if (!raw) continue;
    const date = new Date(raw);
    const bucket = byKey.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (bucket) bucket.value += row._weight === undefined ? 1 : row._weight;
  }
  return buckets.map(({ label, value }) => ({ label, value }));
}

const countBy = (rows, key) => {
  const map = new Map();
  for (const row of rows) map.set(row[key], (map.get(row[key]) || 0) + 1);
  return map;
};

const toPairs = (map) => [...map.entries()].map(([label, value]) => ({ label: String(label), value }));

// GET /api/platform/reports/revenue
router.get('/reports/revenue', async (req, res) => {
  try {
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, plan, subscription_status, subscription_expires_at, created_at');
    if (clinicsError) throw clinicsError;

    const { data: payments, error: paymentsError } = await supabase
      .from('subscription_payments')
      .select('id, clinic_id, plan, months, amount, provider, status, created_at, paid_at');
    if (paymentsError) throw paymentsError;

    const clinicNameById = new Map((clinics || []).map((c) => [c.id, c.name]));
    const now = Date.now();
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    const paid = (payments || []).filter((p) => p.status === 'paid');

    // Revenu mensuel : somme encaissée, datée du RÈGLEMENT (paid_at) et non de
    // l'initiation du checkout — un paiement initié en mars et réglé en avril
    // appartient à avril.
    const monthlyRevenue = fillMonthBuckets(
      paid.map((p) => ({ paid_at: p.paid_at, _weight: Number(p.amount) || 0 })),
      'paid_at'
    );

    // Récurrent : dérivé des cliniques ACTIVES et de leur plan, jamais de la
    // somme encaissée. Les abonnements se paient d'avance sur 1 à 12 mois ;
    // encaisser 12 mois en janvier ne fait pas un janvier à 174 000 FCFA de
    // récurrent. Starter vaut 0, donc les cliniques gratuites n'y contribuent
    // pas d'elles-mêmes.
    const mrr = (clinics || [])
      .filter((c) => c.subscription_status === 'active')
      .reduce((sum, c) => sum + (getPlan(c.plan).price || 0), 0);

    const collectedThisMonth = paid
      .filter((p) => p.paid_at && new Date(p.paid_at).getTime() >= startOfMonth)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const planCounts = new Map();
    for (const clinic of clinics || []) {
      const name = getPlan(clinic.plan).name;
      planCounts.set(name, (planCounts.get(name) || 0) + 1);
    }

    const toRow = (clinic) => ({
      clinicId: clinic.id,
      clinicName: clinic.name,
      plan: getPlan(clinic.plan).name,
      expiresAt: clinic.subscription_expires_at
    });

    res.json({
      monthlyRevenue,
      mrr,
      collectedThisMonth,
      planDistribution: toPairs(planCounts),
      renewalsDue: (clinics || [])
        .filter((c) => {
          if (!c.subscription_expires_at) return false;
          const expiry = new Date(c.subscription_expires_at).getTime();
          return expiry >= now && expiry <= now + 30 * DAY_MS;
        })
        .sort((a, b) => new Date(a.subscription_expires_at) - new Date(b.subscription_expires_at))
        .map(toRow),
      expiredNotRenewed: (clinics || [])
        .filter((c) => {
          if (!c.subscription_expires_at) return false;
          return new Date(c.subscription_expires_at).getTime() < now && c.subscription_status !== 'active';
        })
        .map(toRow),
      // Détecteur du scénario « argent pris, rien crédité » : une ligne pending
      // de plus d'une heure signifie qu'aucun webhook fournisseur n'est jamais
      // arrivé. C'est exactement ce qu'un webhook mal configuré produit.
      stuckPayments: (payments || [])
        .filter((p) => p.status === 'pending' && now - new Date(p.created_at).getTime() > HOUR_MS)
        .map((p) => ({
          id: p.id,
          clinicId: p.clinic_id,
          clinicName: clinicNameById.get(p.clinic_id) || `Clinique ${p.clinic_id}`,
          amount: Number(p.amount) || 0,
          provider: p.provider,
          createdAt: p.created_at
        })),
      failedThisMonth: (payments || []).filter(
        (p) => p.status === 'failed' && new Date(p.created_at).getTime() >= startOfMonth
      ).length,
      providerMix: toPairs(countBy(paid, 'provider'))
    });
  } catch (error) {
    console.error('[PLATFORM-REPORTS] Erreur de calcul des revenus:', error);
    res.status(500).json({ error: 'Erreur lors du calcul des revenus.' });
  }
});

// GET /api/platform/reports/adoption
router.get('/reports/adoption', async (req, res) => {
  try {
    const [clinicsRes, usersRes, patientsRes, consultationsRes, logsRes, ticketsRes] = await Promise.all([
      supabase.from('clinics').select('id, name, plan, created_at'),
      supabase.from('users').select('id, clinic_id, role, active'),
      supabase.from('patients').select('id, clinic_id, archived'),
      // Cette table n'a PAS de created_at : toute tendance repose sur
      // date_time, la date du rendez-vous, pas celle de la saisie.
      supabase.from('consultations').select('id, clinic_id, date_time'),
      supabase.from('activity_logs').select('clinic_id, created_at'),
      supabase.from('support_tickets').select('id, category, status')
    ]);

    for (const result of [clinicsRes, usersRes, patientsRes, consultationsRes, logsRes, ticketsRes]) {
      if (result.error) throw result.error;
    }

    const clinics = clinicsRes.data || [];
    const users = usersRes.data || [];
    const activeUsers = users.filter((u) => u.active === 1);
    const now = Date.now();
    const activeSince = now - 30 * DAY_MS;

    const lastActivityByClinic = new Map();
    for (const log of logsRes.data || []) {
      const at = new Date(log.created_at).getTime();
      if (at > (lastActivityByClinic.get(log.clinic_id) || 0)) {
        lastActivityByClinic.set(log.clinic_id, at);
      }
    }

    const patientsByClinic = countBy(patientsRes.data || [], 'clinic_id');
    const consultationsByClinic = countBy(consultationsRes.data || [], 'clinic_id');
    const activeUsersByClinic = countBy(activeUsers, 'clinic_id');

    const activeClinics = clinics.filter((c) => (lastActivityByClinic.get(c.id) || 0) >= activeSince);

    res.json({
      activeClinics: activeClinics.length,
      dormantClinics: clinics.length - activeClinics.length,
      perClinic: clinics.map((clinic) => ({
        clinicId: clinic.id,
        clinicName: clinic.name,
        plan: getPlan(clinic.plan).name,
        patients: patientsByClinic.get(clinic.id) || 0,
        consultations: consultationsByClinic.get(clinic.id) || 0,
        activeUsers: activeUsersByClinic.get(clinic.id) || 0,
        lastActivityAt: lastActivityByClinic.has(clinic.id)
          ? new Date(lastActivityByClinic.get(clinic.id)).toISOString()
          : null
      })),
      newClinicsPerMonth: fillMonthBuckets(clinics, 'created_at'),
      // INDICE, PAS MESURE : rien dans ce dépôt ne trace l'usage par module.
      // Un compte pharmacien actif suggère que la pharmacie sert, sans le
      // prouver. L'interface doit le libeller comme tel, jamais le présenter
      // comme de la télémétrie.
      rolesFilled: toPairs(countBy(activeUsers, 'role')),
      ticketsByCategory: toPairs(countBy(ticketsRes.data || [], 'category')),
      ticketsByStatus: toPairs(countBy(ticketsRes.data || [], 'status'))
    });
  } catch (error) {
    console.error("[PLATFORM-REPORTS] Erreur de calcul de l'adoption:", error);
    res.status(500).json({ error: "Erreur lors du calcul de l'adoption." });
  }
});

module.exports = router;
