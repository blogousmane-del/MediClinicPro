import React, { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  Calendar,
  Users,
  FlaskConical,
  Pill,
  Receipt,
  BarChart3,
  ChevronRight,
  Check,
  Plus,
  Menu,
  X,
  LayoutDashboard,
  FileText
} from 'lucide-react';

const marqueeModules = [
  { icon: LayoutDashboard, label: 'Tableau de bord' },
  { icon: Users, label: 'Patients' },
  { icon: Calendar, label: 'Rendez-vous' },
  { icon: FileText, label: 'Ordonnances' },
  { icon: FlaskConical, label: 'Laboratoire' },
  { icon: Pill, label: 'Pharmacie' },
  { icon: Receipt, label: 'Comptabilité' }
];

interface LandingPageProps {
  onNavigate: (tab: 'login' | 'register' | 'terms') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Scroll-reveal: fade/slide sections into view once as they enter the viewport
  useEffect(() => {
    const els = rootRef.current?.querySelectorAll<HTMLElement>('.landing-reveal');
    if (!els || els.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} style={{
      fontFamily: 'var(--font-primary, sans-serif)',
      backgroundColor: '#f8fafc',
      color: '#0f172a',
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box',
      overflowX: 'hidden'
    }}>

      {/* 1. Header Navigation Bar */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.85rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Logo */}
        <div className="landing-logo-mark" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img src="/logo-horizontal.svg" alt="MediClinic" style={{ height: '32px', width: 'auto', display: 'block' }} />
        </div>

        {/* Desktop Nav Links */}
        <nav className="landing-nav-desktop" style={{ fontSize: '0.925rem', fontWeight: 600 }}>
          <a href="#features" className="landing-link" style={{ color: '#475569', textDecoration: 'none' }}>Fonctionnalités</a>
          <a href="#pricing" className="landing-link" style={{ color: '#475569', textDecoration: 'none' }}>Tarifs</a>
          <a href="#about" className="landing-link" style={{ color: '#475569', textDecoration: 'none' }}>À propos</a>
        </nav>

        {/* Desktop Right Action Buttons */}
        <div className="landing-nav-actions-desktop">
          <button
            onClick={() => onNavigate('login')}
            className="landing-btn-lift"
            style={{
              background: 'none',
              border: 'none',
              color: '#0f172a',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              padding: '8px 16px'
            }}
          >
            Connexion
          </button>

          <button
            onClick={() => onNavigate('register')}
            className="landing-btn-lift"
            style={{
              backgroundColor: '#1e4d40',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(30, 77, 64, 0.2)',
              transition: 'all 0.2s ease'
            }}
          >
            Prendre un rendez-vous
          </button>
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="landing-mobile-toggle">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'none',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '6px',
              color: '#0f172a',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Menu Mobile"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          top: '60px',
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          zIndex: 99,
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
        }}>
          <a href="#features" onClick={() => setMobileMenuOpen(false)} style={{ color: '#0f172a', textDecoration: 'none', fontWeight: 600, fontSize: '1rem' }}>Fonctionnalités</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)} style={{ color: '#0f172a', textDecoration: 'none', fontWeight: 600, fontSize: '1rem' }}>Tarifs</a>
          <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '0.5rem 0' }} />
          <button
            onClick={() => { setMobileMenuOpen(false); onNavigate('login'); }}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#f1f5f9',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              color: '#0f172a',
              fontSize: '0.95rem'
            }}
          >
            Connexion
          </button>
          <button
            onClick={() => { setMobileMenuOpen(false); onNavigate('register'); }}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#1e4d40',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              color: '#ffffff',
              fontSize: '0.95rem'
            }}
          >
            Prendre un rendez-vous
          </button>
        </div>
      )}

      {/* 2. Hero Section with Handsome African Doctor Image */}
      <section style={{
        backgroundColor: '#ffffff',
        padding: '3.5rem 1.5rem 4.5rem',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div className="landing-hero-grid" style={{
          maxWidth: '1200px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
          gap: '3.5rem',
          alignItems: 'center'
        }}>
          {/* Left Hero Column */}
          <div className="landing-entrance">
            {/* Pill Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#e6f4ea',
              border: '1px solid #bbf7d0',
              padding: '6px 16px',
              borderRadius: '9999px',
              color: '#1e4d40',
              fontSize: '0.85rem',
              fontWeight: 700,
              marginBottom: '1.25rem'
            }}>
              <ShieldCheck size={16} />
              <span>Solution fiable pour votre clinique</span>
            </div>

            {/* Title */}
            <h1 className="landing-hero-title" style={{
              fontSize: '3.25rem',
              fontWeight: 800,
              lineHeight: 1.15,
              color: '#0f172a',
              fontFamily: 'var(--font-secondary)',
              margin: '0 0 1.25rem 0',
              letterSpacing: '-1px'
            }}>
              Une plateforme,<br />
              une meilleure prise<br />
              <span style={{ color: '#0d9488' }}>en charge</span>
            </h1>

            {/* Description */}
            <p style={{
              fontSize: '1.05rem',
              color: '#475569',
              lineHeight: 1.6,
              maxWidth: '500px',
              margin: '0 0 2rem 0'
            }}>
              Du soin quotidien aux insights de santé avancés, notre plateforme est conçue pour les cliniques d'Abidjan et de toute la Côte d'Ivoire.
            </p>

            {/* CTA Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
              <button
                onClick={() => onNavigate('register')}
                className="landing-btn-lift"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#1e4d40',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 28px',
                  fontWeight: 700,
                  fontSize: '0.975rem',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(30, 77, 64, 0.25)'
                }}
              >
                <span>Découvrir nos offres</span>
              </button>

              <a
                href="#features"
                className="landing-btn-lift"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  padding: '14px 24px',
                  fontWeight: 700,
                  fontSize: '0.975rem',
                  textDecoration: 'none'
                }}
              >
                <span>En savoir plus</span>
                <ChevronRight size={18} color="#64748b" />
              </a>
            </div>

            {/* Trust line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldCheck size={18} color="#0d9488" />
              <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#64748b', maxWidth: '320px' }}>
                Essai gratuit de 14 jours, sans engagement, sans carte bancaire
              </span>
            </div>
          </div>

          {/* Right Hero Handsome African Doctor Image Card */}
          <div className="landing-reveal landing-reveal-right" style={{ position: 'relative', width: '100%' }}>
            <div className="landing-img-zoom" style={{
              borderRadius: '28px',
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
              backgroundColor: '#e2e8f0',
              maxHeight: '520px',
              width: '100%'
            }}>
              <img
                src="/doctor_hero.png"
                alt="Beau docteur africain MediClinic Côte d'Ivoire"
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '380px',
                  objectFit: 'cover',
                  objectPosition: 'top',
                  display: 'block'
                }}
              />
            </div>

            {/* Overlay Badge: real subscription fact */}
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              right: '16px',
              backgroundColor: 'rgba(30, 77, 64, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '16px',
              padding: '0.9rem 1.15rem',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
            }}>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <ShieldCheck size={20} color="#5eead4" />
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#99f6e4', fontWeight: 700, display: 'block' }}>
                  Un seul abonnement
                </span>
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px', display: 'block', lineHeight: 1.3 }}>
                  Accès complet à tous les modules, 15 000 FCFA / mois
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2b. Infinite Scrolling Module Marquee */}
      <section style={{
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
        padding: '1.75rem 0'
      }}>
        <div className="landing-marquee-wrapper">
          <div className="landing-marquee-track">
            {[...marqueeModules, ...marqueeModules].map((mod, i) => {
              const Icon = mod.icon;
              return (
                <div
                  key={i}
                  className="landing-marquee-card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '0.9rem 1.4rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '9px',
                    backgroundColor: '#e6f4ea',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Icon size={17} color="#1e4d40" />
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                    {mod.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Dark Stat Banner Bar */}
      <section style={{
        backgroundColor: '#162a26',
        color: '#ffffff',
        padding: '2.5rem 1.5rem'
      }}>
        <div className="landing-stats-grid landing-reveal" style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '2rem',
          textAlign: 'center'
        }}>
          <div className="landing-highlight">
            <ShieldCheck size={22} color="#5eead4" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>Données isolées par clinique</div>
          </div>

          <div className="landing-highlight">
            <LayoutDashboard size={22} color="#5eead4" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>Tous les modules inclus</div>
          </div>

          <div className="landing-highlight">
            <Receipt size={22} color="#5eead4" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>Paiement Mobile Money</div>
          </div>

          <div className="landing-highlight">
            <Users size={22} color="#5eead4" style={{ marginBottom: '6px' }} />
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', fontWeight: 600 }}>Support en français</div>
          </div>
        </div>
      </section>

      {/* 4. Feature Showcase Section */}
      <section id="features" style={{
        backgroundColor: '#ffffff',
        padding: '4.5rem 1.5rem',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div className="landing-showcase-grid" style={{
          maxWidth: '1200px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)',
          gap: '3.5rem',
          alignItems: 'center'
        }}>
          {/* Left Laboratory Image */}
          <div className="landing-reveal landing-reveal-left landing-img-zoom" style={{
            borderRadius: '28px',
            overflow: 'hidden',
            boxShadow: '0 16px 36px rgba(0,0,0,0.06)',
            height: '380px',
            backgroundColor: '#e2e8f0'
          }}>
            <img
              src="/lab_showcase.png"
              alt="Laboratoire médical MediClinic"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </div>

          {/* Right Showcase Content */}
          <div className="landing-reveal landing-reveal-right">
            <h2 style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              color: '#0f172a',
              fontFamily: 'var(--font-secondary)',
              margin: '0 0 1rem 0',
              lineHeight: 1.2
            }}>
              Un système pour tout votre <span style={{ color: '#0d9488' }}>flux de soins</span>
            </h2>

            <p style={{
              fontSize: '1rem',
              color: '#64748b',
              lineHeight: 1.6,
              margin: '0 0 2rem 0'
            }}>
              Réduisez les attentes, automatisez les plannings, suivez les médicaments, réduisez les erreurs et envoyez des ordonnances en un instant.
            </p>

            {/* Feature Pills */}
            <div className="landing-feature-pills" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div className="landing-pill-hover" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                <Calendar size={18} color="#0d9488" />
                <span>Rendez-vous</span>
              </div>

              <div className="landing-pill-hover" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                <Users size={18} color="#0d9488" />
                <span>Dossiers patients</span>
              </div>

              <div className="landing-pill-hover" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                <FlaskConical size={18} color="#0d9488" />
                <span>Résultats labo</span>
              </div>

              <div className="landing-pill-hover" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                <Pill size={18} color="#0d9488" />
                <span>Pharmacie</span>
              </div>

              <div className="landing-pill-hover" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                <Receipt size={18} color="#0d9488" />
                <span>Facturation</span>
              </div>

              <div className="landing-pill-hover" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                <BarChart3 size={18} color="#0d9488" />
                <span>Rapports BI</span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('register')}
              className="landing-btn-lift"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: '#1e4d40',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontWeight: 700,
                fontSize: '0.925rem',
                cursor: 'pointer'
              }}
            >
              <span>Toutes les fonctionnalités</span>
              <Plus size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* 6. Pricing Section */}
      <section id="pricing" style={{
        backgroundColor: '#ffffff',
        padding: '4.5rem 1.5rem',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{ maxWidth: '1200px', width: '100%', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#0d9488' }}>
            TARIFS TRANSPARENTS
          </span>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-secondary)', margin: '8px 0 1rem' }}>
            Un seul abonnement, tous les modules inclus
          </h2>
          <p style={{ color: '#64748b', maxWidth: '600px', margin: '0 auto 3rem', fontSize: '1rem' }}>
            Pas de paliers cachés ni de fonctionnalités verrouillées. Essai gratuit de 14 jours, sans engagement.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="landing-reveal landing-card-lift" style={{
              backgroundColor: '#ffffff',
              border: '2px solid #1e4d40',
              borderRadius: '24px',
              padding: '2.5rem 2.25rem',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 12px 32px rgba(30, 77, 64, 0.12)',
              maxWidth: '420px',
              width: '100%'
            }}>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>MediClinic</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>Pour les cabinets, cliniques et centres de santé</div>

                <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#1e4d40' }}>15 000</span>
                  <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>FCFA / mois</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem', color: '#334155' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#1e4d40" /> Utilisateurs & rôles illimités</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#1e4d40" /> Patients & Dossiers illimités</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#1e4d40" /> Rendez-vous, Ordonnances & Pharmacie</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#1e4d40" /> Laboratoire & Comptabilité</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#1e4d40" /> Encaissements Mobile Money</li>
                </ul>
              </div>

              <button
                onClick={() => onNavigate('register')}
                className="landing-btn-lift"
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#1e4d40',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(30, 77, 64, 0.25)'
                }}
              >
                Commencer l'essai gratuit
              </button>
            </div>
          </div>

          {/* Payment Providers Row */}
          <div className="landing-reveal" style={{ marginTop: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Accepté en Côte d'Ivoire via Mobile Money :</span>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
              <span className="landing-payment-badge" style={{ backgroundColor: '#fff7ed', color: '#ea580c', padding: '5px 12px', borderRadius: '20px', border: '1px solid #ffedd5' }}>Orange Money</span>
              <span className="landing-payment-badge" style={{ backgroundColor: '#fefce8', color: '#ca8a04', padding: '5px 12px', borderRadius: '20px', border: '1px solid #fef08a' }}>MTN MoMo</span>
              <span className="landing-payment-badge" style={{ backgroundColor: '#f0f9ff', color: '#0284c7', padding: '5px 12px', borderRadius: '20px', border: '1px solid #e0f2fe' }}>Wave</span>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Dark Footer */}
      <footer style={{
        backgroundColor: '#0f172a',
        color: '#94a3b8',
        padding: '2.5rem 1.5rem',
        borderTop: '1px solid #1e293b'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo-icon.svg" alt="MediClinic" width={32} height={32} style={{ display: 'block', flexShrink: 0 }} />
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#ffffff' }}>MediClinic</span>
          </div>

          <span style={{ fontSize: '0.85rem' }}>
            © 2026 MediClinic. Développé pour les cliniques et cabinets en Côte d'Ivoire.
          </span>

          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.85rem' }}>
            <a href="#features" className="landing-footer-link" style={{ color: '#94a3b8', textDecoration: 'none' }}>Fonctionnalités</a>
            <a href="#pricing" className="landing-footer-link" style={{ color: '#94a3b8', textDecoration: 'none' }}>Tarifs</a>
            <span onClick={() => onNavigate('terms')} className="landing-footer-link" style={{ color: '#94a3b8', cursor: 'pointer' }}>Conditions d'utilisation</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
