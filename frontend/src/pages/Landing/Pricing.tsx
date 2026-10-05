import { Check } from 'lucide-react';
import { SITE } from '../../config/site';
import { formatFcfa, trialDaysOf, type PublicCatalog, type PublicPlan } from '../../utils/publicPlans';
import { frenchList } from '../../utils/frenchList';

const INCLUDED = [
  'Patients illimités', 'Rendez-vous et dossiers', 'Ordonnances',
  'Pharmacie et stock', 'Laboratoire', 'Caisse et reçus',
  'Dépôts de garantie', 'Mises à jour', 'Assistance WhatsApp',
];

const PlanCard = ({ name, audience, plan }: { name: string; audience: string; plan: PublicPlan }) => (
  <article className="vt-plan">
    <h3>{name}</h3>
    <p className="vt-plan-for">{audience}</p>
    <p className="vt-price">
      <span className="vt-price-amount">{formatFcfa(plan.price)}</span>
      <span className="vt-price-unit">FCFA / mois</span>
    </p>
    <ul>
      <li><Check size={18} strokeWidth={1.75} aria-hidden="true" />{plan.staffLimit === null ? 'Comptes illimités' : `Jusqu'à ${plan.staffLimit} comptes`}</li>
      <li><Check size={18} strokeWidth={1.75} aria-hidden="true" />Les 7 rôles, dont pharmacien et laborantin</li>
    </ul>
  </article>
);

export const Pricing = ({ catalog, onRegister }: { catalog: PublicCatalog; onRegister: () => void }) => {
  const trialDays = trialDaysOf(catalog);
  return (
    <section className="vt-section vt-pricing" id="tarifs">
      <div className="vt-wrap vt-reveal">
        <h2>Un prix clair, en FCFA.</h2>
        <p className="vt-lead">
          Toute l'équipe essaie gratuitement pendant {trialDays} jours. Ensuite, vous choisissez la formule qui correspond à la taille de votre clinique.
        </p>
        <div className="vt-trial">
          <div>
            <strong>Essai gratuit de {trialDays} jours</strong>
            <span>{catalog.starter.staffLimit ?? 3} comptes (administrateur, médecin, secrétaire), sans carte bancaire</span>
          </div>
          <button type="button" className="vt-btn vt-btn-primary" onClick={onRegister}>Essayer gratuitement</button>
        </div>
        <div className="vt-plans">
          <PlanCard name="Clinique" audience="Cabinets et petites cliniques" plan={catalog.clinique} />
          <PlanCard name="Hôpital" audience="Cliniques avec plusieurs services" plan={catalog.hopital} />
        </div>
        <div className="vt-included">
          <h3>Inclus dans les deux formules</h3>
          <ul>{INCLUDED.map((item) => <li key={item}><Check size={17} strokeWidth={1.75} aria-hidden="true" />{item}</li>)}</ul>
        </div>
        <p className="vt-pay-note">
          Paiement par {frenchList(SITE.subscriptionPaymentMethods, 'ou')}, pour 1, 3, 6 ou 12 mois. Changement de formule à tout moment depuis l'application.
        </p>
      </div>
    </section>
  );
};
