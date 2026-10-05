import { Building2, Lock, UserX } from 'lucide-react';
import { SITE } from '../../config/site';
import { formatFcfa } from '../../utils/publicPlans';
import { frenchList } from '../../utils/frenchList';
import { PhoneCapture } from './Capture';

const ROLES = ['Administrateur', 'Médecin', 'Infirmier', 'Secrétaire', 'Pharmacien', 'Laborantin', 'Gestionnaire'];

export const LocalFit = ({ cliniquePrice }: { cliniquePrice: number }) => (
  <section className="vt-section">
    <div className="vt-wrap vt-reveal">
      <h2>Fait pour les cliniques d'ici.</h2>
      <div className="vt-bento">
        <article className="vt-cell vt-cell-phone">
          <h3>Sur ordinateur comme sur téléphone</h3>
          <p>Rien à installer. La caisse travaille sur l'ordinateur de l'accueil, le médecin suit sa journée depuis son téléphone.</p>
          <figure className="vt-phone-shot">
            <PhoneCapture name="dashboard" alt="Tableau de bord MediClinic sur téléphone" sizes="(max-width: 640px) 70vw, 300px" />
          </figure>
        </article>
        <article className="vt-cell vt-cell-roles">
          <h3>Chacun voit ce qui le concerne</h3>
          <p>
            Sept rôles, chacun ses écrans&nbsp;: la comptabilité est fermée au pharmacien, la caisse au laborantin, et le contenu médical est réservé à l'équipe soignante.
          </p>
          <ul className="vt-chips">{ROLES.map((role) => <li key={role}>{role}</li>)}</ul>
        </article>
        <article className="vt-cell vt-cell-money">
          <h3>En FCFA, sans conversion</h3>
          <p>Abonnement réglé par {frenchList(SITE.subscriptionPaymentMethods, 'ou')}.</p>
          <p className="vt-amount"><small>dès</small> {formatFcfa(cliniquePrice)} <small>FCFA / mois</small></p>
        </article>
        <article className="vt-cell vt-cell-secure">
          <h3>Vos données restent les vôtres</h3>
          <ul>
            <li><Building2 size={18} strokeWidth={1.75} aria-hidden="true" />Chaque clinique a son propre espace</li>
            <li><Lock size={18} strokeWidth={1.75} aria-hidden="true" />Connexion chiffrée</li>
            <li><UserX size={18} strokeWidth={1.75} aria-hidden="true" />Un compte désactivé perd l'accès immédiatement</li>
          </ul>
        </article>
      </div>
    </div>
  </section>
);
