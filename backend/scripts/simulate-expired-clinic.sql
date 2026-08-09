-- Éprouver le verrou d'abonnement sans attendre sept jours et sans toucher à
-- une clinique réelle.
--
-- MODE D'EMPLOI
-- 1. Créez un compte neuf depuis la page d'inscription (une clinique d'essai
--    Starter, avec une adresse email que vous contrôlez).
-- 2. Relevez son id :
--      SELECT id, name, plan, subscription_expires_at FROM clinics
--      ORDER BY created_at DESC LIMIT 5;
-- 3. Remplacez <CLINIC_ID> ci-dessous, puis exécutez le bloc voulu dans
--    l'éditeur SQL Supabase.
-- 4. Rechargez l'application connectée à ce compte.
--
-- N'exécutez JAMAIS ces requêtes sur la clinique d'un vrai client.

-- A. Délai de grâce (expiré depuis 1 jour) — attendu : les dossiers restent
--    consultables, toute écriture est refusée, l'en-tête annonce le nombre de
--    jours avant blocage.
UPDATE clinics
SET subscription_expires_at = NOW() - INTERVAL '1 day'
WHERE id = <CLINIC_ID>;

-- B. Verrou (expiré depuis 5 jours, au-delà des 3 jours de grâce) — attendu :
--    Patients, Rendez-vous, Ordonnances, Laboratoire, Pharmacie, Comptabilité
--    et Dépôts affichent l'écran de paiement ; le tableau de bord aussi ;
--    Paramètres > Abonnez-vous et le profil restent accessibles.
UPDATE clinics
SET subscription_expires_at = NOW() - INTERVAL '5 days'
WHERE id = <CLINIC_ID>;

-- C. Retour à la normale.
UPDATE clinics
SET subscription_expires_at = NOW() + INTERVAL '7 days',
    subscription_status = 'trial'
WHERE id = <CLINIC_ID>;

-- Contrôle direct de l'API, sans navigateur (remplacez le jeton par celui de
-- localStorage.mediclinic_token) :
--   curl -H "Authorization: Bearer <TOKEN>" https://<domaine>/api/patients
-- Verrouillé, la réponse est 403 avec "code":"SUBSCRIPTION_LOCKED".
