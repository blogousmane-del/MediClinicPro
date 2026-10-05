// Tout mot de passe est haché par hashPassword() (utils/password.js), en coût
// 12, et nulle part ailleurs. Les hachages existants en coût 10 restent
// valides : bcrypt lit le coût dans le hachage lui-même.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');

const BACKEND = path.join(__dirname, '..');
const PASSWORD_MODULE = path.join(BACKEND, 'utils', 'password.js');
const { hashPassword } = require(PASSWORD_MODULE);

test('hashPassword hache en coût 12', async () => {
  const hash = await hashPassword('MotDePasse2026');
  assert.strictEqual(bcrypt.getRounds(hash), 12);
  assert.strictEqual(await bcrypt.compare('MotDePasse2026', hash), true);
});

// Un appel direct à bcrypt.hash ailleurs reviendrait au coût que son auteur a
// tapé : le coût 10 était écrit en dur à huit endroits.
test('aucun autre fichier du backend ne hache un mot de passe lui-même', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'tests') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js') && full !== PASSWORD_MODULE
        && /bcrypt\.hash(Sync)?\(/.test(fs.readFileSync(full, 'utf8'))) {
        offenders.push(path.relative(BACKEND, full));
      }
    }
  };
  walk(BACKEND);
  assert.deepStrictEqual(offenders, []);
});
