import React from 'react';
import { ShieldCheck, Calendar, Users, Activity, FileText, Pill, CreditCard, ChevronRight } from 'lucide-react';

interface LandingPageProps {
  onNavigate: (tab: 'login' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div style={{
      backgroundColor: '#0b0f19',
      color: '#f9fafb',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-primary)'
    }}>
      {/* Header */}
      <header style={{
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        padding: '1.5rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #1f2937'
      }}>
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
        <div style={{ display: 'flex', gap: '1rem' }}>
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
      </header>

      {/* Hero Section */}
      <section style={{
        maxWidth: '1000px',
        width: '100%',
        margin: '5rem auto 3rem auto',
        textAlign: 'center',
        padding: '0 2rem'
      }}>
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
          marginBottom: '2rem'
        }}>
          <ShieldCheck size={16} />
          <span>Solution Clinique n°1 en Côte d'Ivoire</span>
        </div>
        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: 800,
          lineHeight: 1.15,
          fontFamily: 'var(--font-secondary)',
          background: 'linear-gradient(to right, #ffffff, #94a3b8)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '1.5rem'
        }}>
          Gérez votre clinique en toute simplicité
        </h1>
        <p style={{
          fontSize: '1.25rem',
          color: '#94a3b8',
          maxWidth: '700px',
          margin: '0 auto 2.5rem auto',
          lineHeight: 1.6
        }}>
          Dites adieu aux cahiers papier et aux fichiers Excel perdus. Centralisez vos patients, rendez-vous, pharmacie et facturation pour seulement <strong style={{ color: 'white' }}>15 000 FCFA/mois</strong>.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <button 
            onClick={() => onNavigate('register')}
            className="btn btn-primary"
            style={{ padding: '0.8rem 2rem', fontSize: '1.1rem', borderRadius: '10px' }}
          >
            Commencer l'essai gratuit <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{
        maxWidth: '1200px',
        width: '100%',
        margin: '4rem auto',
        padding: '0 2rem'
      }}>
        <h2 style={{
          textAlign: 'center',
          fontSize: '2rem',
          marginBottom: '3rem',
          fontFamily: 'var(--font-secondary)'
        }}>Une solution tout-en-un pour votre cabinet</h2>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem'
        }}>
          {/* Card 1 */}
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid #1f2937',
            borderRadius: '12px',
            padding: '2rem'
          }}>
            <div style={{ backgroundColor: 'rgba(13, 148, 136, 0.1)', color: 'rgb(13, 148, 136)', width: '48px', height: '48px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Users size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'white' }}>Dossiers Patients</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9375rem', lineHeight: 1.5 }}>Fiches médicales complètes, historique des consultations, constantes vitales, allergies et antécédents accessibles en 2 clics.</p>
          </div>

          {/* Card 2 */}
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid #1f2937',
            borderRadius: '12px',
            padding: '2rem'
          }}>
            <div style={{ backgroundColor: 'rgba(13, 148, 136, 0.1)', color: 'rgb(13, 148, 136)', width: '48px', height: '48px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Calendar size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'white' }}>Agenda Partagé</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9375rem', lineHeight: 1.5 }}>Planifiez facilement les rendez-vous par praticien, évitez les doublons et réduisez le temps d'attente en salle.</p>
          </div>

          {/* Card 3 */}
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid #1f2937',
            borderRadius: '12px',
            padding: '2rem'
          }}>
            <div style={{ backgroundColor: 'rgba(13, 148, 136, 0.1)', color: 'rgb(13, 148, 136)', width: '48px', height: '48px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <Pill size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'white' }}>Gestion de Pharmacie</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9375rem', lineHeight: 1.5 }}>Suivi des stocks de médicaments, alertes automatiques de stock bas et alertes de péremption à 30 jours.</p>
          </div>

          {/* Card 4 */}
          <div style={{
            backgroundColor: '#111827',
            border: '1px solid #1f2937',
            borderRadius: '12px',
            padding: '2rem'
          }}>
            <div style={{ backgroundColor: 'rgba(13, 148, 136, 0.1)', color: 'rgb(13, 148, 136)', width: '48px', height: '48px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <CreditCard size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'white' }}>Recettes & Comptabilité</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9375rem', lineHeight: 1.5 }}>Enregistrez les paiements en espèces ou via mobile money en temps réel et visualisez les statistiques de recettes.</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section style={{
        backgroundColor: '#111827',
        borderTop: '1px solid #1f2937',
        borderBottom: '1px solid #1f2937',
        padding: '5rem 2rem',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '2.25rem', marginBottom: '1rem', fontFamily: 'var(--font-secondary)' }}>Un tarif unique et transparent</h2>
          <p style={{ color: '#94a3b8', marginBottom: '2.5rem' }}>Aucun frais caché, aucun engagement. Essayez gratuitement pendant 14 jours.</p>
          
          <div style={{
            backgroundColor: '#0b0f19',
            border: '2px solid rgb(13, 148, 136)',
            borderRadius: '16px',
            padding: '3rem 2rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <span style={{ fontSize: '1.1rem', color: 'rgb(13, 148, 136)', fontWeight: 600, textTransform: 'uppercase' }}>PLAN CLINIQUE</span>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '8px', margin: '1.5rem 0' }}>
              <span style={{ fontSize: '3rem', fontWeight: 800, color: 'white' }}>15 000 FCFA</span>
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
              <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', fontWeight: 600, fontSize: '0.9rem' }}>
                <span style={{ color: '#ff6600' }}>Orange Money</span>
                <span style={{ color: '#ffcc00' }}>MTN MoMo</span>
                <span style={{ color: '#1ebcd2' }}>Wave</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '2.5rem 2rem',
        color: '#6b7280',
        fontSize: '0.875rem',
        marginTop: 'auto',
        borderTop: '1px solid #1f2937'
      }}>
        © 2026 MediClinic. Tous droits réservés. Développé pour les cliniques et cabinets en Côte d'Ivoire.
      </footer>
    </div>
  );
};
