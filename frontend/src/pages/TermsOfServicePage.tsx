import { ArrowLeft, Info, Mail, Phone } from 'lucide-react';
import '@fontsource-variable/geist';
import '../styles/site.css';
import { SITE } from '../config/site';

interface TermsOfServicePageProps {
  onBack: () => void;
  onRegister: () => void;
}

interface Section {
  id: string;
  title: string;
  content: string;
}

const sections: Section[] = [
  {
    id: '1',
    title: "1. Objet et champ d'application",
    content: "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme MediClinic, éditée par GSM TECHNOLOGIE CYBER SHOP, [forme juridique] ayant son siège à [adresse du siège]. Toute utilisation de la plateforme implique l'acceptation pleine et entière des présentes conditions."
  },
  {
    id: '2',
    title: '2. Accès à la plateforme',
    content: "L'accès à MediClinic est réservé aux professionnels de santé, structures médicales et personnels administratifs dûment enregistrés. L'abonné est responsable de la confidentialité de ses identifiants de connexion. Toute utilisation non autorisée du compte devra être signalée sans délai à l'équipe MediClinic."
  },
  {
    id: '3',
    title: '3. Données de santé et confidentialité',
    // Hébergeur nommé (Supabase), mais NI région NI conformité affirmées : la
    // région d'un projet Supabase se choisit à sa création et n'est pas lisible
    // depuis le code, et une déclaration de conformité non vérifiée dans une
    // clause sur des données de santé est un engagement qu'on ne peut pas
    // tenir. Même règle que le refus des allégations de résidence des données
    // fabriquées par Banani (voir CLAUDE.md).
    content: "Les données de santé traitées via MediClinic sont des données à caractère sensible. GSM TECHNOLOGIE CYBER SHOP s'engage à ne jamais revendre ni exploiter commercialement les données patients et à mettre en œuvre les mesures techniques et organisationnelles nécessaires à leur protection. Les données sont hébergées sur l'infrastructure de Supabase, prestataire technique agissant en qualité de sous-traitant. [Préciser ici la région d'hébergement des données et le cadre réglementaire applicable, notamment les formalités auprès de l'ARTCI au titre de la loi n° 2013-450 du 19 juin 2013 relative à la protection des données à caractère personnel.] L'abonné reste responsable du traitement de ses propres données patients."
  },
  {
    id: '4',
    title: '4. Abonnement et facturation',
    // Le tarif annoncé ici était « 15 000 FCFA par mois », un prix qui
    // n'existe dans aucun plan — dans un document contractuel. Remplacé par la
    // grille réelle de backend/utils/plans.js. Les crochets restants sont des
    // mentions à faire rédiger, pas des textes à inventer.
    content: "MediClinic propose trois formules : Starter, gratuite et limitée à 7 jours d'utilisation ; Clinique, à 9 000 FCFA par mois ; et Hôpital, à 14 500 FCFA par mois. Le détail des limites de chaque formule figure sur la page tarifs. [Préciser ici les modalités de renouvellement, de résiliation et de remboursement applicables.]"
  },
  {
    id: '5',
    title: '5. Disponibilité et maintenance',
    content: "[Préciser ici l'engagement de disponibilité de la plateforme, les modalités de notification des maintenances planifiées, et les recours possibles en cas d'indisponibilité prolongée.]"
  },
  {
    id: '6',
    title: '6. Propriété intellectuelle',
    content: "L'ensemble des éléments composant la plateforme MediClinic (interfaces, base de code, marques, logos, contenus) sont la propriété exclusive de GSM TECHNOLOGIE CYBER SHOP. Toute reproduction, distribution ou exploitation sans autorisation préalable est strictement interdite. L'abonné conserve la pleine propriété de ses données patients et des documents générés via la plateforme."
  },
  {
    id: '7',
    title: '7. Responsabilité',
    content: "MediClinic est un outil d'aide à la gestion et ne se substitue en aucun cas au jugement clinique du professionnel de santé. GSM TECHNOLOGIE CYBER SHOP ne saurait être tenu responsable de décisions médicales prises sur la base des informations enregistrées dans la plateforme. [Préciser ici les limites de responsabilité applicables.]"
  },
  {
    id: '8',
    title: '8. Résiliation',
    content: "[Préciser ici les modalités de résiliation par l'abonné et les cas de résiliation par l'éditeur.]"
  },
  {
    id: '9',
    title: '9. Modifications des CGU',
    content: "GSM TECHNOLOGIE CYBER SHOP se réserve le droit de modifier les présentes CGU à tout moment. L'abonné sera informé par email de toute modification substantielle avant son entrée en vigueur. La poursuite de l'utilisation de la plateforme après cette date vaut acceptation des nouvelles conditions."
  },
  {
    id: '10',
    title: '10. Droit applicable et litiges',
    content: "[Préciser ici le droit applicable et la juridiction compétente en cas de litige.]"
  }
];

export const TermsOfServicePage = ({ onBack, onRegister }: TermsOfServicePageProps) => {
  const year = new Date().getFullYear();
  const legal = SITE.legal ? `${SITE.legal.name}. RCCM ${SITE.legal.rccm}.` : 'MediClinic.';
  return (
    <div className="site vt-terms">
      <header className="vt-nav">
        <div className="vt-wrap vt-nav-bar">
          <button type="button" className="vt-plain vt-nav-logo" onClick={onBack} aria-label="MediClinic, retour à l'accueil">
            <img src="/logo-horizontal.svg" alt="" width={103} height={28} />
          </button>
          <div className="vt-nav-right">
            <button type="button" className="vt-terms-back" onClick={onBack} aria-label="Retour à l'accueil">
              <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>Retour</span>
            </button>
            <button type="button" className="vt-btn vt-btn-primary vt-btn-sm" onClick={onRegister}>Essayer gratuitement</button>
          </div>
        </div>
      </header>

      <main className="vt-wrap vt-terms-main">
        <header className="vt-terms-header">
          <h1>Conditions générales d'utilisation</h1>
          <p>Dernière mise à jour : [date de dernière mise à jour]. Document provisoire, en attente de validation juridique.</p>
        </header>

        <div className="vt-terms-layout">
          <nav className="vt-terms-toc" aria-label="Sommaire">
            <p className="vt-terms-toc-title">Sommaire</p>
            {sections.map((s) => <a key={s.id} href={`#section-${s.id}`}>{s.title}</a>)}
          </nav>

          <div className="vt-terms-content">
            <div className="vt-terms-warning">
              <Info size={18} strokeWidth={1.75} aria-hidden="true" />
              <p>
                Ce document est un modèle de structure généré automatiquement et contient des sections à compléter (entre crochets). Il ne doit pas être publié tel quel : il doit être relu et complété avec les informations juridiques réelles de l'entreprise avant toute mise en ligne.
              </p>
            </div>

            {sections.map((s) => (
              <section key={s.id} id={`section-${s.id}`} className="vt-terms-section">
                <h2>{s.title}</h2>
                <p>{s.content}</p>
              </section>
            ))}

            <div className="vt-terms-contact">
              <h2>Des questions sur ces conditions ?</h2>
              <p>Notre équipe est disponible pour répondre à vos questions.</p>
              <ul>
                <li>
                  <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
                  {/* Adresse de contact des CGU : elle doit rester relevée, une
                      adresse morte ici vaut moins que pas d'adresse du tout.
                      `contact@mediclinicpro.com` a été essayée puis abandonnée,
                      la boîte n'étant pas exploitable. */}
                  <a href="mailto:blog.ousmane@gmail.com">blog.ousmane@gmail.com</a>
                </li>
                <li>
                  <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span>{SITE.whatsapp.display}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <footer className="vt-footer">
        <div className="vt-wrap vt-footer-legal vt-terms-footer">
          <span>© {year} {legal}</span>
          <span>Logiciel de gestion de clinique pour la Côte d'Ivoire.</span>
        </div>
      </footer>
    </div>
  );
};
