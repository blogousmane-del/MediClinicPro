import React from 'react';
import { ShieldCheck, Info, Mail, Phone, ArrowLeft } from 'lucide-react';

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
    content: "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme MediClinic, éditée par [Nom de l'entité légale], [forme juridique] ayant son siège à [adresse du siège]. Toute utilisation de la plateforme implique l'acceptation pleine et entière des présentes conditions."
  },
  {
    id: '2',
    title: '2. Accès à la plateforme',
    content: "L'accès à MediClinic est réservé aux professionnels de santé, structures médicales et personnels administratifs dûment enregistrés. L'abonné est responsable de la confidentialité de ses identifiants de connexion. Toute utilisation non autorisée du compte devra être signalée sans délai à l'équipe MediClinic."
  },
  {
    id: '3',
    title: '3. Données de santé et confidentialité',
    content: "Les données de santé traitées via MediClinic sont des données à caractère sensible. [Nom de l'entité légale] s'engage à ne jamais revendre ni exploiter commercialement les données patients et à mettre en œuvre les mesures techniques et organisationnelles nécessaires à leur protection. [Préciser ici le lieu d'hébergement des données et le cadre réglementaire applicable.] L'abonné reste responsable du traitement de ses propres données patients."
  },
  {
    id: '4',
    title: '4. Abonnement et facturation',
    content: "MediClinic est proposé pour 15 000 FCFA par mois. [Préciser ici les modalités de renouvellement, de résiliation et de remboursement applicables.]"
  },
  {
    id: '5',
    title: '5. Disponibilité et maintenance',
    content: "[Préciser ici l'engagement de disponibilité de la plateforme, les modalités de notification des maintenances planifiées, et les recours possibles en cas d'indisponibilité prolongée.]"
  },
  {
    id: '6',
    title: '6. Propriété intellectuelle',
    content: "L'ensemble des éléments composant la plateforme MediClinic (interfaces, base de code, marques, logos, contenus) sont la propriété exclusive de [Nom de l'entité légale]. Toute reproduction, distribution ou exploitation sans autorisation préalable est strictement interdite. L'abonné conserve la pleine propriété de ses données patients et des documents générés via la plateforme."
  },
  {
    id: '7',
    title: '7. Responsabilité',
    content: "MediClinic est un outil d'aide à la gestion et ne se substitue en aucun cas au jugement clinique du professionnel de santé. [Nom de l'entité légale] ne saurait être tenu responsable de décisions médicales prises sur la base des informations enregistrées dans la plateforme. [Préciser ici les limites de responsabilité applicables.]"
  },
  {
    id: '8',
    title: '8. Résiliation',
    content: "[Préciser ici les modalités de résiliation par l'abonné et les cas de résiliation par l'éditeur.]"
  },
  {
    id: '9',
    title: '9. Modifications des CGU',
    content: "[Nom de l'entité légale] se réserve le droit de modifier les présentes CGU à tout moment. L'abonné sera informé par email de toute modification substantielle avant son entrée en vigueur. La poursuite de l'utilisation de la plateforme après cette date vaut acceptation des nouvelles conditions."
  },
  {
    id: '10',
    title: '10. Droit applicable et litiges',
    content: "[Préciser ici le droit applicable et la juridiction compétente en cas de litige.]"
  }
];

export const TermsOfServicePage: React.FC<TermsOfServicePageProps> = ({ onBack, onRegister }) => {
  return (
    <div className="terms-page">
      {/* Nav */}
      <nav className="terms-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={onBack}>
          <img src="/logo-icon.svg" alt="MediClinic" width={32} height={32} style={{ display: 'block', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: 'var(--font-secondary)', color: 'var(--tp-fg)' }}>MediClinic</span>
        </div>

        <div className="terms-nav-actions">
          <a onClick={onBack}><ArrowLeft size={14} /> Retour</a>
          <button
            onClick={onRegister}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'var(--tp-primary)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Essai gratuit
          </button>
        </div>
      </nav>

      {/* Page header */}
      <div className="terms-header">
        <div style={{ maxWidth: '720px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <ShieldCheck size={14} color="var(--tp-primary)" />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tp-primary)' }}>Légal</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-secondary)', color: '#ffffff', marginBottom: '0.75rem' }}>Conditions Générales d'Utilisation</h1>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
            Dernière mise à jour : [date de dernière mise à jour] · Document provisoire — en attente de validation juridique
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="terms-layout">
        {/* TOC (desktop only) */}
        <aside className="terms-toc">
          <div className="terms-toc-inner">
            <p style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tp-muted)', marginBottom: '0.75rem' }}>
              Sommaire
            </p>
            {sections.map((s) => (
              <a key={s.id} href={`#section-${s.id}`}>{s.title}</a>
            ))}
          </div>
        </aside>

        {/* Sections */}
        <div className="terms-content">
          <div style={{
            backgroundColor: 'var(--tp-secondary)',
            border: '1px solid rgba(61, 107, 94, 0.3)',
            borderRadius: '10px',
            padding: '1.1rem',
            display: 'flex',
            gap: '10px'
          }}>
            <Info size={16} color="var(--tp-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--tp-fg)', lineHeight: 1.6 }}>
              Ce document est un modèle de structure généré automatiquement et contient des sections à compléter (entre crochets). Il ne doit pas être publié tel quel : il doit être relu et complété avec les informations juridiques réelles de l'entreprise avant toute mise en ligne.
            </p>
          </div>

          {sections.map((s) => (
            <div key={s.id} id={`section-${s.id}`} className="terms-section">
              <h2 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-secondary)', color: 'var(--tp-fg)', fontWeight: 700 }}>{s.title}</h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--tp-muted)', lineHeight: 1.7 }}>{s.content}</p>
            </div>
          ))}

          <div style={{
            backgroundColor: 'var(--tp-input)',
            border: '1px solid var(--tp-border)',
            borderRadius: '10px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-secondary)', color: 'var(--tp-fg)', fontWeight: 700 }}>Des questions sur ces conditions ?</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--tp-muted)' }}>Notre équipe est disponible pour répondre à vos questions.</p>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} color="var(--tp-primary)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--tp-primary)' }}>blog.ousmane@gmail.com</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Phone size={14} color="var(--tp-muted)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--tp-muted)' }}>+225 07 88 81 81 18</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer — only real destinations (no Confidentialité/Contact pages exist) */}
      <footer className="terms-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/logo-icon.svg" alt="MediClinic" width={22} height={22} style={{ display: 'block' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--tp-fg)' }}>MediClinic</span>
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--tp-muted)' }}>© 2026 MediClinic. Développé pour les cliniques et cabinets en Côte d'Ivoire.</span>
      </footer>
    </div>
  );
};
