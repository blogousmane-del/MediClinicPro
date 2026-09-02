-- Désactive les sept comptes de démonstration semés par supabase_schema.sql.
--
-- POURQUOI : leurs mots de passe sont écrits en clair dans le dépôt
-- (commentaires de supabase_schema.sql, table des comptes de test de
-- CLAUDE.md) et restent devinables sans lui — « adminpassword » sur
-- admin@mediclinic.com. Un audit du 2026-08-09 les a retrouvés VIVANTS et
-- actifs dans la base de production, aux côtés de vraies cliniques.
-- Un compte admin de la clinique 1 permet la lecture et l'écriture de toutes
-- les données de cette clinique.
--
-- À EXÉCUTER UNE FOIS dans l'éditeur SQL Supabase (aucune session Claude Code
-- n'a d'accès DDL/mutation à la base live). Ne touche que ces sept emails.
-- Rejouable sans risque.
--
-- Vérifier d'abord ce qui existe :
--   SELECT id, email, role, active, clinic_id FROM users
--   WHERE email LIKE '%@mediclinic.com';
--
-- Puis désactiver :

UPDATE users
SET active = 0
WHERE email IN (
  'admin@mediclinic.com',
  'aminata@mediclinic.com',
  'ibrahim@mediclinic.com',
  'bernard@mediclinic.com',
  'moussa@mediclinic.com',
  'fatou@mediclinic.com',
  'kouassi@mediclinic.com'
);

-- CONTRÔLE DU 2026-09-02 (sonde en lecture seule sur la base live) : six des
-- sept comptes sont bien fermés, mais ibrahim@mediclinic.com (id 3, doctor,
-- clinique 1) est ressorti `active = 1`. Ce script le liste pourtant : quelque
-- chose l'a rouvert après l'exécution du 2026-08-09 — une réactivation depuis
-- Paramètres > Utilisateurs est l'explication la plus plausible. Son
-- `password_hash` est identique à celui d'aminata@mediclinic.com, dont le mot
-- de passe est publié dans CLAUDE.md : le compte se connecte réellement.
-- Refermé le même jour, seconde sonde : les sept sont à `active = 0`.
-- La leçon tient : cette fermeture peut régresser sans bruit, il faut la
-- revérifier plutôt que la supposer acquise.
--
-- Depuis le correctif du 2026-08-09, middleware/auth.js relit users.active à
-- chaque requête : la désactivation prend effet immédiatement, sans attendre
-- l'expiration des jetons JWT (24 h) déjà émis.
--
-- Si la clinique 1 (« Clinique de démonstration ») ne sert à rien en
-- production, la supprimer entièrement est plus propre — mais c'est une
-- suppression en cascade sur patients, consultations, ordonnances et
-- paiements : à faire à la main, après sauvegarde, jamais depuis un script.
