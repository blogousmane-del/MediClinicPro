import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { SITE, whatsappUrl } from '../../config/site';
import { trialDaysOf, type PublicCatalog } from '../../utils/publicPlans';
import { frenchList } from '../../utils/frenchList';

const WhatsAppInline = ({ children }: { children: ReactNode }) => (
  <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">{children}</a>
);

export const Faq = ({ catalog }: { catalog: PublicCatalog }) => {
  const trialDays = trialDaysOf(catalog);
  const { starter, clinique, hopital } = catalog;
  const limit = (count: number | null) => (count === null ? 'sans limite' : `${count} comptes`);
  const questions: { question: string; answer: ReactNode }[] = [
    {
      question: 'Faut-il installer un logiciel\u00a0?',
      answer: "Non. MediClinic s'utilise dans le navigateur, sur ordinateur, tablette ou téléphone. Il suffit d'une connexion internet.",
    },
    {
      question: `Que se passe-t-il à la fin des ${trialDays} jours d'essai\u00a0?`,
      answer: "Vous choisissez la formule Clinique ou Hôpital et la réglez depuis l'application. Sans paiement, vos dossiers restent consultables 3 jours, puis l'accès est suspendu jusqu'au règlement. Vos données sont conservées.",
    },
    {
      question: 'Mes données médicales sont-elles protégées\u00a0?',
      answer: "Chaque clinique dispose de son propre espace\u00a0: aucune autre clinique ne voit vos patients. La connexion est chiffrée, chaque membre de l'équipe n'accède qu'aux écrans de son rôle, le contenu médical est réservé à l'équipe soignante, et un compte désactivé perd l'accès immédiatement.",
    },
    {
      question: 'Faut-il une connexion internet en permanence\u00a0?',
      answer: 'Oui, MediClinic fonctionne en ligne. Une connexion mobile suffit.',
    },
    {
      question: "Combien de personnes peuvent l'utiliser\u00a0?",
      answer: `${limit(starter.staffLimit)} pendant l'essai, ${limit(clinique.staffLimit)} avec la formule Clinique, ${limit(hopital.staffLimit)} avec la formule Hôpital. Le nombre de patients est illimité dans tous les cas.`,
    },
    {
      question: "Comment payer l'abonnement\u00a0?",
      answer: `Par ${frenchList(SITE.subscriptionPaymentMethods, 'ou')}, pour 1, 3, 6 ou 12 mois, depuis la rubrique Paramètres de l'application.`,
    },
    {
      question: 'Pouvez-vous nous aider à démarrer\u00a0?',
      answer: (
        <>Oui. Écrivez-nous sur WhatsApp au <WhatsAppInline><span className="vt-nowrap">{SITE.whatsapp.display}</span></WhatsAppInline>&nbsp;: nous vous aidons à configurer la clinique et à créer les comptes de votre équipe.</>
      ),
    },
  ];

  return (
    <section className="vt-section" id="questions">
      <div className="vt-wrap vt-faq-grid vt-reveal">
        <div className="vt-faq-side">
          <h2>Questions fréquentes</h2>
          <p>Une autre question ? <WhatsAppInline>Écrivez-nous sur WhatsApp</WhatsAppInline>, on vous répond en français.</p>
        </div>
        <div className="vt-faq">
          {questions.map(({ question, answer }, index) => (
            <details key={question} open={index === 0}>
              <summary>{question}<Plus size={20} strokeWidth={1.75} aria-hidden="true" /></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};
