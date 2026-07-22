import React from 'react';
import {
  ShieldCheck,
  Calendar,
  Users,
  Activity,
  FlaskConical,
  Pill,
  Receipt,
  TrendingUp,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (tab: 'login' | 'register') => void;
}

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
}

const features: Feature[] = [
  { icon: Calendar, title: 'Rendez-vous', description: 'Planifiez facilement les rendez-vous par praticien et évitez les doublons de créneaux.' },
  { icon: Users, title: 'Dossiers Patients', description: 'Fiches médicales complètes, historique des consultations et constantes vitales accessibles en 2 clics.' },
  { icon: FlaskConical, title: 'Résultats Labo', description: 'File d\'attente des analyses prescrites et compte-rendu consultable dans le dossier patient.' },
  { icon: Pill, title: 'Pharmacie', description: 'Suivi des stocks, alertes de stock bas et alertes de péremption à 30 jours.' },
  { icon: Receipt, title: 'Facturation', description: 'Encaissements en espèces ou via mobile money, reçus imprimables au format ticket.' },
  { icon: TrendingUp, title: 'Statistiques & Recettes', description: 'Tableau de bord avec répartition des recettes et journal d\'activité de la clinique.' },
];

const FeatureCard: React.FC<Feature> = ({ icon: Icon, title, description }) => (
  <div className="landing-feature-card">
    <div className="landing-feature-icon">
      <Icon size={22} />
    </div>
    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'white' }}>{title}</h3>
    <p style={{ color: '#94a3b8', fontSize: '0.9375rem', lineHeight: 1.5 }}>{description}</p>
  </div>
);

const previewRows = [
  { icon: Users, label: 'Dossiers patients' },
  { icon: Calendar, label: 'Agenda partagé' },
  { icon: Pill, label: 'Pharmacie & stocks' },
  { icon: Activity, label: 'Consultations' },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="landing-page">
      {/* Nav */}
      <nav className="landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'rgb(13, 148, 136)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.3rem'
          }}>M</div>
          <span style={{ fontWeight: 700, fontSize: '1.25rem', fontFamily: 'var(--font-secondary)' }}>MediClinic</span>
        </div>

        <div className="landing-nav-links">
          <a href="#features">Fonctionnalités</a>
          <a href="#pricing">Tarifs</a>
        </div>

        <div className="landing-nav-actions">
          <button
            onClick={() => onNavigate('login')}
            className="btn btn-secondary"
            style={{ backgroundColor: 'transparent', border: '1px solid #374151', color: 'white' }}
          >
            Se connecter
          </button>
          <button
            onClick={() => onNavigate('register')}
            className="btn btn-primary"
          >
            Essai gratuit
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(13, 148, 136, 0.1)',
            border: '1px solid rgba(13, 148, 136, 0.2)',
            padding: '6px 16px',
            borderRadius: '9999px',
            color: 'rgb(13, 148, 136)',
            fontSize: '0.85rem',
            fontWeight: 600,
            width: 'fit-content'
          }}>
            <ShieldCheck size={16} />
            <span>Solution fiable pour les cliniques de Côte d'Ivoire</span>
          </div>

          <h1 className="landing-hero-title">
            Une plateforme,<br />
            <span style={{ color: 'rgb(13, 148, 136)' }}>une meilleure prise</span><br />
            en charge
          </h1>

          <p style={{ fontSize: '1.05rem', color: '#94a3b8', lineHeight: 1.6, maxWidth: '480px' }}>
            Dites adieu aux cahiers papier et aux fichiers Excel perdus. Centralisez vos patients, rendez-vous, pharmacie et facturation pour seulement <strong style={{ color: 'white' }}>15 000 FCFA/mois</strong>.
          </p>

          <div className="landing-cta-row">
            <button onClick={() => onNavigate('register')} className="btn btn-primary">
              Commencer l'essai gratuit <ArrowRight size={18} />
            </button>
            <a
              href="#features"
              className="btn btn-secondary"
              style={{ backgroundColor: 'transparent', border: '1px solid #374151', color: 'white', textDecoration: 'none' }}
            >
              En savoir plus <ChevronRight size={18} />
            </a>
          </div>
        </div>

        <div className="landing-hero-visual">
          <div className="landing-preview-panel">
            {previewRows.map(({ icon: Icon, label }) => (
              <div key={label} className="landing-preview-row">
                <div className="landing-preview-icon">
                  <Icon size={18} />
                </div>
                <span style={{ fontSize: '0.9375rem', fontWeight: 500, color: '#e5e7eb' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing-section">
        <h2 className="landing-section-title">Une solution tout-en-un pour votre cabinet</h2>
        <p className="landing-section-lead">
          Du suivi quotidien à la facturation, MediClinic est conçu pour les cliniques et cabinets d'Abidjan et de toute la Côte d'Ivoire.
        </p>
        <div className="grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{
        backgroundColor: '#111827',
        borderTop: '1px solid #1f2937',
        borderBottom: '1px solid #1f2937',
        padding: '3rem 1.25rem'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem', fontFamily: 'var(--font-secondary)' }}>Un tarif unique et transparent</h2>
          <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Aucun frais caché, aucun engagement. Essayez gratuitement pendant 14 jours.</p>

          <div style={{
            backgroundColor: '#0b0f19',
            border: '2px solid rgb(13, 148, 136)',
            borderRadius: '16px',
            padding: '2.5rem 1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <span style={{ fontSize: '1.1rem', color: 'rgb(13, 148, 136)', fontWeight: 600, textTransform: 'uppercase' }}>PLAN CLINIQUE</span>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px', margin: '1.5rem 0', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white' }}>15 000 FCFA</span>
              <span style={{ color: '#94a3b8' }}>/ mois</span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '2rem 0', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', color: '#e5e7eb' }}>
              <li>✓ Jusqu'à 15 collaborateurs</li>
              <li>✓ Dossiers patients illimités</li>
              <li>✓ Pharmacie & Laboratoire inclus</li>
              <li>✓ Encaissements & Facturation</li>
              <li>✓ Mode déconnecté basique</li>
            </ul>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              borderTop: '1px solid #1f2937',
              paddingTop: '1.5rem'
            }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Paiement instantané via Mobile Money :</span>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', fontWeight: 600, fontSize: '0.9rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#ff6600' }}>Orange Money</span>
                <span style={{ color: '#ffcc00' }}>MTN MoMo</span>
                <span style={{ color: '#1ebcd2' }}>Wave</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="landing-cta-band">
        <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgb(13, 148, 136)', marginBottom: '1rem' }}>
          Commencer
        </p>
        <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-secondary)', maxWidth: '480px', margin: '0 auto 1rem' }}>
          Prêt à transformer votre clinique ?
        </h2>
        <p style={{ color: '#94a3b8', maxWidth: '420px', margin: '0 auto' }}>
          Rejoignez les cliniques de Côte d'Ivoire qui ont choisi MediClinic pour simplifier leur gestion médicale au quotidien.
        </p>
        <div className="landing-cta-row">
          <button onClick={() => onNavigate('register')} className="btn btn-primary">
            Démarrer gratuitement
          </button>
          <a
            href="#pricing"
            className="btn btn-secondary"
            style={{ backgroundColor: 'transparent', border: '1px solid #374151', color: 'white', textDecoration: 'none' }}
          >
            Voir les tarifs <ChevronRight size={18} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span>© 2026 MediClinic. Développé pour les cliniques et cabinets en Côte d'Ivoire.</span>
        <div className="landing-footer-links">
          <a href="#features">Fonctionnalités</a>
          <a href="#pricing">Tarifs</a>
        </div>
      </footer>
    </div>
  );
};
