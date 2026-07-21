const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "⚠️  SUPABASE_URL ou SUPABASE_KEY manquant(e). En local, renseignez backend/.env. " +
    "Sur Vercel, ajoutez ces variables dans Project Settings > Environment Variables."
  );
}

// Initialize Supabase Client with service role key for administrative bypass of RLS on backend
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

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
