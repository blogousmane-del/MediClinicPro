const test = require('node:test');
const assert = require('node:assert');
const { db, resetDb, makeSupabaseStub } = require('./harness');

test('le faux Supabase insere puis relit une ligne', async () => {
  resetDb();
  const supabase = makeSupabaseStub();

  const inserted = await supabase.from('clinics').insert({ name: 'Test' }).select().single();
  assert.strictEqual(inserted.error, null);
  assert.strictEqual(inserted.data.id, 1);

  const read = await supabase.from('clinics').select('*').eq('id', 1).maybeSingle();
  assert.strictEqual(read.data.name, 'Test');
  assert.strictEqual(db.clinics.length, 1);
});

test('resetDb vide toutes les tables', async () => {
  resetDb();
  const supabase = makeSupabaseStub();
  await supabase.from('clinics').insert({ name: 'X' });
  resetDb();
  assert.strictEqual(db.clinics.length, 0);
});
