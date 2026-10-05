// Documents imprimés : factures, reçus, journal des recettes, ordonnances,
// éléments du dossier patient.
//
// Ils s'ouvrent dans une fenêtre `window.open('')` remplie par document.write.
// Cette fenêtre partage l'origine de l'application : un script qui s'y exécute
// lit `window.opener.localStorage`, donc le jeton de session. Toute valeur
// saisie par un utilisateur (nom de patient, motif, diagnostic, notes, nom de
// clinique, nom du caissier) passe par escapeHtml avant d'être insérée. Audit
// du 2026-10-05 : un patient nommé `<img src=x onerror=…>` volait la session
// de la personne qui imprimait son reçu.
//
// La fenêtre ne voit pas les variables CSS de l'application : styles littéraux.

export type PrintClinic = { name?: string | null; address?: string | null; phone?: string | null } | null | undefined;

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PRINT_STYLES = `
  body { font-family: Arial, Helvetica, sans-serif; padding: 30px; color: #1f2933; line-height: 1.6; }
  .header { text-align: center; border-bottom: 2px solid #1e4d40; padding-bottom: 15px; margin-bottom: 20px; }
  .title { font-size: 1.5rem; font-weight: bold; color: #1e4d40; }
  .clinic-meta { font-size: 0.85rem; color: #555; }
  .box { background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; }
  .details { border: 1px solid #cbd5e1; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 0.9rem; }
  th { background: #f1f5f9; text-align: left; }
  .right { text-align: right; }
  .center { text-align: center; }
  .totals { margin-left: auto; width: 280px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .grand-total { font-weight: bold; font-size: 1.1rem; border-top: 1px solid #333; margin-top: 6px; padding-top: 8px; }
  .rx-title { font-size: 1.2rem; font-weight: bold; margin: 10px 0 15px; text-transform: uppercase; letter-spacing: 1px; color: #1e4d40; }
  .item-row { border-bottom: 1px solid #e2e8f0; padding: 10px 0; }
  .item-name { font-weight: bold; }
  .item-posology { font-size: 0.875rem; color: #475569; margin-top: 2px; }
  .signature { margin-top: 50px; text-align: right; font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 20px; }
  .footer { text-align: center; margin-top: 40px; font-size: 0.8rem; color: #888; border-top: 1px solid #cbd5e1; padding-top: 10px; }
`;

/** En-tête commun : la clinique connectée, jamais un nom écrit en dur. */
export function clinicHeaderHtml(clinic: PrintClinic, subtitle: string): string {
  const name = (clinic?.name || 'Clinique').toUpperCase();
  const meta = [clinic?.address, clinic?.phone].filter(Boolean).join(' · ');
  return `
    <div class="header">
      <div class="title">${escapeHtml(name)}</div>
      ${meta ? `<div class="clinic-meta">${escapeHtml(meta)}</div>` : ''}
      <div>${escapeHtml(subtitle)}</div>
    </div>`;
}

/** Document complet. `bodyHtml` doit déjà avoir échappé ses valeurs. */
export function buildPrintDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="fr">
  <head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_STYLES}</style></head>
  <body>
    ${bodyHtml}
    <div class="footer">Document généré par MediClinic.</div>
  </body>
</html>`;
}

/** Ouvre la boîte d'impression. `false` si le navigateur a bloqué la fenêtre. */
export function openPrintWindow(html: string): boolean {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
  return true;
}
