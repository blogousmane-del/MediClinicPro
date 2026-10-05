// Secret médical : qui lit quel contenu du dossier patient. Chaque rôle ne lit
// que le médical dont son travail a besoin, et c'est le serveur qui filtre :
// jusqu'au 2026-10-05, la fiche patient renvoyait tout à tous les rôles et seul
// le menu masquait certains onglets. L'admin lit tout, comme checkRole le
// laisse toujours passer.
//
// L'identité, les allergies, les rendez-vous et les paiements restent lisibles
// par tous les rôles : le pharmacien a besoin des allergies pour délivrer, et
// la secrétaire les saisit à l'accueil.
const MEDICAL_READERS = {
  consultations: ['doctor', 'nurse'],
  antecedents: ['doctor', 'nurse'],
  prescriptions: ['doctor', 'nurse', 'pharmacist'],
  labExams: ['doctor', 'nurse', 'lab_tech']
};

function canRead(role, section) {
  return role === 'admin' || MEDICAL_READERS[section].includes(role);
}

// Sections que la fiche patient ne contient pas pour ce rôle : l'écran le dit,
// plutôt que de laisser croire le dossier vide.
function hiddenSections(role) {
  return Object.keys(MEDICAL_READERS).filter((section) => !canRead(role, section));
}

// Une ligne `patients` sans ses antécédents, pour un rôle qui ne les lit pas.
function withoutAntecedents(patient, role) {
  if (!patient || canRead(role, 'antecedents')) return patient;
  const { antecedents, ...rest } = patient;
  return rest;
}

module.exports = { MEDICAL_READERS, canRead, hiddenSections, withoutAntecedents };
