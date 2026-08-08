const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const KEY = 'a'.repeat(64); // 32 octets en hexadécimal
const MODULE = path.join(__dirname, '..', 'utils', 'secretBox.js');

function freshModule(key) {
  delete require.cache[require.resolve(MODULE)];
  if (key === null) delete process.env.CONFIG_ENCRYPTION_KEY;
  else process.env.CONFIG_ENCRYPTION_KEY = key;
  return require(MODULE);
}

test('un secret chiffré se relit à l identique', () => {
  const box = freshModule(KEY);
  const stored = box.encrypt('cle-api-chariow-123');
  assert.notStrictEqual(stored, 'cle-api-chariow-123', 'la valeur stockée ne doit pas être en clair');
  assert.ok(stored.startsWith('v1:'), 'le format stocké doit être versionné');
  assert.strictEqual(box.decrypt(stored), 'cle-api-chariow-123');
});

test('deux chiffrements du même secret diffèrent (IV aléatoire)', () => {
  const box = freshModule(KEY);
  assert.notStrictEqual(box.encrypt('meme-secret'), box.encrypt('meme-secret'));
});

test('un secret altéré ne se déchiffre pas et ne lève pas', () => {
  const box = freshModule(KEY);
  const stored = box.encrypt('cle-api-chariow-123');
  const tampered = stored.slice(0, -4) + 'AAAA';
  assert.strictEqual(box.decrypt(tampered), null);
});

test('sans CONFIG_ENCRYPTION_KEY : pas de chiffrement, et jamais de stockage en clair', () => {
  const box = freshModule(null);
  assert.strictEqual(box.isEncryptionConfigured(), false);
  assert.throws(() => box.encrypt('secret'), /CONFIG_ENCRYPTION_KEY/);
  assert.strictEqual(box.decrypt('v1:x:y:z'), null);
});
