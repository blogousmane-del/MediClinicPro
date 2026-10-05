// Lancé par `npm test` (node --test, retrait des types natif à Node 26).
import test from 'node:test';
import assert from 'node:assert/strict';
import { hiddenSectionsNotice } from './medicalAccess.ts';

test('rien à signaler quand le rôle lit tout le dossier', () => {
  assert.equal(hiddenSectionsNotice([]), null);
  assert.equal(hiddenSectionsNotice(undefined), null);
});

test('les sections masquées sont nommées en français', () => {
  assert.equal(hiddenSectionsNotice(['labExams']), "Réservé à l'équipe soignante : examens de laboratoire.");
  assert.equal(
    hiddenSectionsNotice(['consultations', 'antecedents', 'prescriptions', 'labExams']),
    "Réservé à l'équipe soignante : consultations, antécédents, ordonnances et examens de laboratoire."
  );
});

test('une section inconnue est ignorée', () => {
  assert.equal(hiddenSectionsNotice(['inconnue']), null);
  assert.equal(hiddenSectionsNotice(['inconnue', 'consultations']), "Réservé à l'équipe soignante : consultations.");
});
