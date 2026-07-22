import React, { useState } from 'react';
import {
  ShieldCheck,
  Calendar,
  Users,
  FlaskConical,
  Pill,
  Receipt,
  BarChart3,
  ArrowRight,
  ChevronRight,
  Check,
  Star,
  Plus,
  Menu,
  X
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (tab: 'login' | 'register' | 'terms') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  return (
    <div style={{
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            backgroundColor: '#1e4d40',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '1.2rem',
            boxShadow: '0 2px 8px rgba(30, 77, 64, 0.25)'
          }}>M</div>
          <span style={{
            fontWeight: 800,
            fontSize: '1.35rem',
            color: '#0f172a',
            fontFamily: 'var(--font-secondary)',
            letterSpacing: '-0.5px'
          }}>MediClinic</span>
        </div>

        {/* Desktop Nav Links */}
        <nav className="landing-nav-desktop" style={{ fontSize: '0.925rem', fontWeight: 600 }}>
          <a href="#features" style={{ color: '#475569', textDecoration: 'none' }}>Fonctionnalités</a>
          <a href="#testimonials" style={{ color: '#475569', textDecoration: 'none' }}>Témoignages</a>
          <a href="#pricing" style={{ color: '#475569', textDecoration: 'none' }}>Tarifs</a>
          <a href="#about" style={{ color: '#475569', textDecoration: 'none' }}>À propos</a>
        </nav>

        {/* Desktop Right Action Buttons */}
        <div className="landing-nav-actions-desktop">
          <button
            onClick={() => onNavigate('login')}
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
          <a href="#testimonials" onClick={() => setMobileMenuOpen(false)} style={{ color: '#0f172a', textDecoration: 'none', fontWeight: 600, fontSize: '1rem' }}>Témoignages</a>
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
          <div>
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
                  boxShadow: '0 6px 20px rgba(30, 77, 64, 0.25)',
                  transition: 'all 0.2s'
                }}
              >
                <span>Découvrir nos offres</span>
              </button>

              <a
                href="#features"
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

            {/* Social Proof Stack */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex' }}>
                {['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
                  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80'
                ].map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt="Doctor avatar"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      border: '2px solid #ffffff',
                      marginLeft: i > 0 ? '-10px' : 0,
                      objectFit: 'cover'
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#64748b', maxWidth: '280px' }}>
                Approuvé par des hôpitaux, cliniques & équipes de santé
              </span>
            </div>
          </div>

          {/* Right Hero Handsome African Doctor Image Card */}
          <div style={{ position: 'relative', width: '100%' }}>
            <div style={{
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

            {/* Overlay AI Health Badge matching Figma */}
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
              justifyContent: 'space-between',
              gap: '12px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
            }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#99f6e4', fontWeight: 700, display: 'block' }}>
                  Prédictions de santé
                </span>
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#f8fafc', marginTop: '2px', display: 'block', lineHeight: 1.3 }}>
                  Diagnostic plus rapide grâce au suivi de soins intelligent
                </span>
              </div>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '10px',
                padding: '6px 10px',
                fontSize: '1.1rem',
                fontWeight: 800,
                color: '#5eead4',
                flexShrink: 0
              }}>
                82%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Dark Stat Banner Bar */}
      <section style={{
        backgroundColor: '#162a26',
        color: '#ffffff',
        padding: '2.5rem 1.5rem'
      }}>
        <div className="landing-stats-grid" style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '2rem',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-secondary)' }}>1 200+</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px', fontWeight: 500 }}>Patients gérés</div>
          </div>

          <div>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-secondary)' }}>98%</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px', fontWeight: 500 }}>Satisfaction</div>
          </div>

          <div>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-secondary)' }}>40%</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px', fontWeight: 500 }}>Gain de temps</div>
          </div>

          <div>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-secondary)' }}>3 min</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '4px', fontWeight: 500 }}>Prise en charge</div>
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
          {/* Left Microscope Image */}
          <div style={{
            borderRadius: '28px',
            overflow: 'hidden',
            boxShadow: '0 16px 36px rgba(0,0,0,0.06)',
            height: '380px',
            backgroundColor: '#e2e8f0'
          }}>
            <img
              src="https://images.unsplash.com/photo-1579154204601-01588f351e67?w=800&auto=format&fit=crop&q=80"
              alt="Laboratoire médical MediClinic"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </div>

          {/* Right Showcase Content */}
          <div>
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
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                <Calendar size={18} color="#0d9488" />
                <span>Rendez-vous</span>
              </div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                <Users size={18} color="#0d9488" />
                <span>Dossiers patients</span>
              </div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                <FlaskConical size={18} color="#0d9488" />
                <span>Résultats labo</span>
              </div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                <Pill size={18} color="#0d9488" />
                <span>Pharmacie</span>
              </div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                <Receipt size={18} color="#0d9488" />
                <span>Facturation</span>
              </div>

              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                <BarChart3 size={18} color="#0d9488" />
                <span>Rapports BI</span>
              </div>
            </div>

            <button
              onClick={() => onNavigate('register')}
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

      {/* 5. Testimonials Section */}
      <section id="testimonials" style={{
        backgroundColor: '#f8fafc',
        padding: '4.5rem 1.5rem',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#0d9488' }}>
            TÉMOIGNAGES
          </span>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-secondary)', margin: '8px 0 3rem' }}>
            Ce que disent nos praticiens
          </h2>

          <div className="landing-testimonials-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.75rem'
          }}>
            {/* Testimonial 1 */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '1.75rem',
              textAlign: 'left',
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', gap: '4px', color: '#f59e0b', marginBottom: '1rem' }}>
                  {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="#f59e0b" />)}
                </div>
                <p style={{ fontSize: '0.925rem', color: '#334155', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '1.5rem' }}>
                  "MediClinic a révolutionné notre façon de travailler. Les dossiers patients sont instantanés et plus aucune ordonnance n'est perdue."
                </p>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Dr. Aminata Koné</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Médecin-fondatrice, Cabinet Saint-Luc (Cocody)</div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '1.75rem',
              textAlign: 'left',
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', gap: '4px', color: '#f59e0b', marginBottom: '1rem' }}>
                  {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="#f59e0b" />)}
                </div>
                <p style={{ fontSize: '0.925rem', color: '#334155', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '1.5rem' }}>
                  "La gestion du stock pharmacie nous évite enfin les ruptures imprévues. Un vrai gain de sérénité au quotidien pour toute l'équipe."
                </p>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Kouassi Bernard</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Gestionnaire, Clinique Médicale de l'Avenir (Yopougon)</div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '1.75rem',
              textAlign: 'left',
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', gap: '4px', color: '#f59e0b', marginBottom: '1rem' }}>
                  {[...Array(5)].map((_, i) => <Star key={i} size={16} fill="#f59e0b" />)}
                </div>
                <p style={{ fontSize: '0.925rem', color: '#334155', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '1.5rem' }}>
                  "Nos patients adorent la fluidité des rendez-vous et la clarté des bulletins labo. Ce logiciel vaut largement son investissement."
                </p>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Dr. Ibrahim Traoré</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Directeur, Clinique Polyvalente (Bouaké)</div>
              </div>
            </div>
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
            Des offres adaptées à chaque établissement
          </h2>
          <p style={{ color: '#64748b', maxWidth: '600px', margin: '0 auto 3rem', fontSize: '1rem' }}>
            Choisissez la formule qui convient le mieux à la taille de votre clinique. Essai gratuit de 14 jours sans engagement.
          </p>

          <div className="landing-pricing-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '2rem',
            alignItems: 'stretch'
          }}>
            {/* Plan 1: Essentiel */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '24px',
              padding: '2.25rem 1.75rem',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
            }}>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Essentiel</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>Pour les cabinets et petits praticiens</div>
                
                <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a' }}>25 000</span>
                  <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>FCFA / mois</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem', color: '#334155' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#0d9488" /> 1 praticien</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#0d9488" /> Jusqu'à 300 patients</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#0d9488" /> Gestion des RDV</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#0d9488" /> Ordonnances numériques</li>
                </ul>
              </div>

              <button
                onClick={() => onNavigate('register')}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Choisir ce plan
              </button>
            </div>

            {/* Plan 2: Clinique (Featured) */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '2px solid #1e4d40',
              borderRadius: '24px',
              padding: '2.25rem 1.75rem',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 12px 32px rgba(30, 77, 64, 0.12)',
              position: 'relative'
            }}>
              <span style={{
                position: 'absolute',
                top: '-14px',
                right: '24px',
                backgroundColor: '#1e4d40',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 800,
                padding: '4px 14px',
                borderRadius: '20px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Populaire
              </span>

              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Clinique</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>La solution complète pour les cliniques</div>
                
                <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#1e4d40' }}>75 000</span>
                  <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>FCFA / mois</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem', color: '#334155' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#1e4d40" /> Jusqu'à 10 praticiens</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#1e4d40" /> Patients & Dossiers illimités</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#1e4d40" /> Pharmacie & Gestion de stock</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#1e4d40" /> Laboratoire & Examens</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#1e4d40" /> Encaissements Mobile Money</li>
                </ul>
              </div>

              <button
                onClick={() => onNavigate('register')}
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

            {/* Plan 3: Hôpital */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '24px',
              padding: '2.25rem 1.75rem',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
            }}>
              <div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>Hôpital</div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>Pour les grands établissements de santé</div>
                
                <div style={{ margin: '1.5rem 0', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a' }}>180 000</span>
                  <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>FCFA / mois</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '1.5rem 0', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem', color: '#334155' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#0d9488" /> Praticiens illimités</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#0d9488" /> Multi-sites & multi-cliniques</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#0d9488" /> API & Intégrations sur-mesure</li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Check size={16} color="#0d9488" /> Support dédié 24/7</li>
                </ul>
              </div>

              <button
                onClick={() => onNavigate('register')}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Contactez-nous
              </button>
            </div>
          </div>

          {/* Payment Providers Row */}
          <div style={{ marginTop: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Accepté en Côte d'Ivoire via Mobile Money :</span>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
              <span style={{ backgroundColor: '#fff7ed', color: '#ea580c', padding: '5px 12px', borderRadius: '20px', border: '1px solid #ffedd5' }}>Orange Money</span>
              <span style={{ backgroundColor: '#fefce8', color: '#ca8a04', padding: '5px 12px', borderRadius: '20px', border: '1px solid #fef08a' }}>MTN MoMo</span>
              <span style={{ backgroundColor: '#f0f9ff', color: '#0284c7', padding: '5px 12px', borderRadius: '20px', border: '1px solid #e0f2fe' }}>Wave</span>
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
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#1e4d40',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '1rem'
            }}>M</div>
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#ffffff' }}>MediClinic</span>
          </div>

          <span style={{ fontSize: '0.85rem' }}>
            © 2026 MediClinic. Développé pour les cliniques et cabinets en Côte d'Ivoire.
          </span>

          <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.85rem' }}>
            <a href="#features" style={{ color: '#94a3b8', textDecoration: 'none' }}>Fonctionnalités</a>
            <a href="#pricing" style={{ color: '#94a3b8', textDecoration: 'none' }}>Tarifs</a>
            <span onClick={() => onNavigate('terms')} style={{ color: '#94a3b8', cursor: 'pointer' }}>Conditions d'utilisation</span>
          </div>
        </div>
      </footer>

    </div>
  );
};
