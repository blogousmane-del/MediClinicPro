const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "⚠️  SUPABASE_URL ou SUPABASE_KEY manquant(e). En local, renseignez backend/.env. " +
    "Sur Vercel, ajoutez ces variables dans Project Settings > Environment Variables."
  );
}

// createClient() throws synchronously if url/key are missing/malformed. Since
// this module is required at the top of server.js, an unguarded throw here
// used to crash the entire Vercel serverless function on cold start — for
// EVERY route, including /health — surfacing only as an opaque
// FUNCTION_INVOCATION_FAILED with no message. Guarding it turns a missing
// env var into a clean, diagnosable 503 (see server.js) instead.
let supabase = null;
try {
  // Initialize Supabase Client with service role key for administrative bypass of RLS on backend
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false
    }
  });
} catch (err) {
  console.error("⚠️  Échec de l'initialisation du client Supabase:", err.message);
}

async function initDb() {
  try {
    // Perform a lightweight query to test connection
    const { error } = await supabase.from('clinics').select('id').limit(1);
    if (error) {
      throw error;
    }
    console.log("Connexion à Supabase PostgreSQL réussie.");
  } catch (err) {
    console.error("Échec de la connexion à Supabase. Assurez-vous d'avoir exécuté le script supabase_schema.sql et configuré le fichier .env.");
    throw err;
  }
}

module.exports = {
  supabase,
  initDb
};
