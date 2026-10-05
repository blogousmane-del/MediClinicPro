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

// POST /consultations clôt le rendez-vous du jour avec
// `.like('date_time', '2026-10-05%')`. Sans `like`, la route levait une
// TypeError dans le harnais et aucun test ne pouvait atteindre son chemin
// nominal.
test('le faux Supabase applique like avec % et _', async () => {
  resetDb();
  const supabase = makeSupabaseStub();
  db.appointments.push({ id: 1, date_time: '2026-10-05T09:00:00.000Z' });
  db.appointments.push({ id: 2, date_time: '2026-10-06T09:00:00.000Z' });

  const day = await supabase.from('appointments').select('*').like('date_time', '2026-10-05%');
  assert.deepStrictEqual(day.data.map((r) => r.id), [1]);

  const single = await supabase.from('appointments').select('*').like('date_time', '2026-10-0_T09%');
  assert.deepStrictEqual(single.data.map((r) => r.id), [1, 2]);

  const literalDot = await supabase.from('appointments').select('*').like('date_time', '2026-10-05T09:00:00.000Z');
  assert.deepStrictEqual(literalDot.data.map((r) => r.id), [1], 'le point reste un caractere litteral');
});

test('resetDb vide toutes les tables', async () => {
  resetDb();
  const supabase = makeSupabaseStub();
  await supabase.from('clinics').insert({ name: 'X' });
  resetDb();
  assert.strictEqual(db.clinics.length, 0);
});
