// Chiffrement symétrique d'un secret unique, pour les valeurs de
// platform_settings que l'exploitant saisit depuis la console (clé API
// Chariow, secret de webhook). AES-256-GCM via node:crypto — pas de
// dépendance ajoutée, et GCM authentifie : un enregistrement altéré échoue au
// déchiffrement au lieu de rendre des octets faux.
//
// La clé maîtresse reste une variable d'environnement : on déplace le secret
// applicatif vers la base, on ne supprime pas le besoin d'un secret racine.
const crypto = require('node:crypto');

const FORMAT_VERSION = 'v1';
const IV_BYTES = 12; // taille recommandée pour GCM

function readKey() {
  const raw = String(process.env.CONFIG_ENCRYPTION_KEY || '').trim();
  // Format strict : 64 caractères hexadécimaux = 32 octets. Une phrase de
  // passe courte serait acceptée silencieusement par Buffer.from(..., 'hex')
  // en produisant une clé tronquée, donc faible.
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) return null;
  return Buffer.from(raw, 'hex');
}

function isEncryptionConfigured() {
  return readKey() !== null;
}

function encrypt(plaintext) {
  const key = readKey();
  if (!key) {
    throw new Error('CONFIG_ENCRYPTION_KEY absente ou invalide (64 caractères hexadécimaux attendus).');
  }
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT_VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

// Ne lève jamais : une clé changée, un enregistrement corrompu ou un format
// inattendu doivent dégrader l'écran de configuration, pas casser une requête.
function decrypt(stored) {
  const key = readKey();
  if (!key || typeof stored !== 'string') return null;

  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) return null;

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64'));
    decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

module.exports = { isEncryptionConfigured, encrypt, decrypt };
