// Secret médical : le serveur ne renvoie à chaque rôle que le contenu médical
// dont son travail a besoin (backend/utils/medicalAccess.js), et GET
// /patients/:id liste dans `hiddenSections` ce qu'il a retenu. La fiche le dit,
// plutôt que de laisser croire le dossier vide.
import { frenchList } from './frenchList.ts';

const SECTION_LABELS: Record<string, string> = {
  consultations: 'consultations',
  antecedents: 'antécédents',
  prescriptions: 'ordonnances',
  labExams: 'examens de laboratoire',
};

export const hiddenSectionsNotice = (sections: unknown): string | null => {
  if (!Array.isArray(sections)) return null;
  const labels = sections.map((section) => SECTION_LABELS[String(section)]).filter(Boolean);
  if (labels.length === 0) return null;
  return `Réservé à l'équipe soignante : ${frenchList(labels)}.`;
};
