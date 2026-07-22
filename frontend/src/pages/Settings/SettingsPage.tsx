import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search,
  Bell,
  Check,
  CreditCard,
  Download,
  FileText,
  Plus,
  Smartphone,
  Edit3
} from 'lucide-react';

interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: string;
  active: number;
}

export const SettingsPage: React.FC = () => {
  const { user: currentUser, clinic, renewSubscription, refreshProfile } = useAuth();
  const { showToast } = useNotifications();

  const [activeSubTab, setActiveSubTab] = useState<'billing' | 'clinic' | 'users'>('billing');
  const [loading, setLoading] = useState<boolean>(true);

  // Clinic config form states
  const [clinicName, setClinicName] = useState<string>('');
  const [clinicAddress, setClinicAddress] = useState<string>('');
  const [clinicPhone, setClinicPhone] = useState<string>('');
  const [tariffs, setTariffs] = useState<any>({});
  const [isSavingClinic, setIsSavingClinic] = useState<boolean>(false);

  // Staff users states
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPass, setNewUserPass] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<string>('doctor');
  const [isSavingUser, setIsSavingUser] = useState<boolean>(false);

  // Billing & Subscription states matching Image 1
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'clinique' | 'hopital'>('clinique');
  const [paymentProvider, setPaymentProvider] = useState<string>('wave');
  const [paymentPhone, setPaymentPhone] = useState<string>('+225 07 12 34 56 78');

  const fetchClinicDetails = async () => {
    try {
      setLoading(true);
      const data = await api.get('/settings/clinic');
      setClinicName(data.name);
      setClinicAddress(data.address || '');
      setClinicPhone(data.phone || '');
      setTariffs(data.settings?.tariffs || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get('/settings/users');
      setStaff(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'clinic') {
      fetchClinicDetails();
    } else if (activeSubTab === 'users') {
      fetchStaffUsers();
    } else {
      setLoading(false);
    }
  }, [activeSubTab]);

  const handleUpdateClinicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingClinic(true);
    try {
      const payload = {
        name: clinicName,
        address: clinicAddress,
        phone: clinicPhone,
        settings: {
          ...clinic?.settings,
          tariffs
        }
      };

      await api.put('/settings/clinic', payload);
      showToast('success', 'Paramètres mis à jour', 'Les informations de la clinique ont été enregistrées.');
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur de sauvegarde', err.error || 'Impossible d\'enregistrer les modifications.');
    } finally {
      setIsSavingClinic(false);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPass || !newUserRole) {
      showToast('error', 'Champs requis', 'Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    setIsSavingUser(true);
    try {
      const payload = {
        name: newUserName,
        email: newUserEmail,
        password: newUserPass,
        role: newUserRole
      };

      await api.post('/settings/users', payload);
      showToast('success', 'Compte créé', `Le compte de ${newUserName} a été configuré.`);
      setIsUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPass('');
      fetchStaffUsers();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur de création', err.error || 'Impossible d\'ajouter l\'utilisateur.');
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleToggleUserStatus = async (userId: number, currentActive: number) => {
    try {
      const nextActive = currentActive === 1 ? 0 : 1;
      await api.put(`/settings/users/${userId}`, { active: nextActive });
      showToast('success', 'Statut modifié', 'Le statut d\'accès a été mis à jour.');
      fetchStaffUsers();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || 'Impossible de modifier le statut.');
    }
  };

  const handleSelectPlan = (plan: 'starter' | 'clinique' | 'hopital') => {
    setSelectedPlan(plan);
    showToast('info', 'Plan sélectionné', `Vous avez sélectionné le plan ${plan.toUpperCase()}.`);
  };

  const handleExportInvoices = () => {
    showToast('success', 'Exportation', 'L\'historique de vos factures MediClinic a été téléchargé.');
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrateur',
    doctor: 'Médecin',
    secretary: 'Secrétaire',
    pharmacist: 'Pharmacien',
    lab_tech: 'Laborantin',
    manager: 'Gestionnaire'
  };

  // Mock invoice history rows matching Image 1
  const invoiceHistory = [
    { id: 1, date: '14 juin 2025', plan: 'Plan Clinique', amount: '75 000 FCFA', status: 'Payée' },
    { id: 2, date: '14 mai 2025', plan: 'Plan Clinique', amount: '75 000 FCFA', status: 'Payée' },
    { id: 3, date: '14 avril 2025', plan: 'Plan Clinique', amount: '75 000 FCFA', status: 'Payée' },
    { id: 4, date: '14 mars 2025', plan: 'Plan Clinique', amount: '75 000 FCFA', status: 'Payée' },
    { id: 5, date: '14 février 2025', plan: 'Plan Clinique', amount: '75 000 FCFA', status: 'Payée' },
  ];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      padding: '1.5rem 2rem',
      backgroundColor: 'var(--bg-primary)',
      minHeight: 'calc(100vh - var(--header-height))',
      boxSizing: 'border-box'
    }}>
      
      {/* 1. Top Header Breadcrumb matching Image 1 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
            Gestion des abonnements
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px', margin: 0 }}>
            Lundi 14 juillet 2025
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Rechercher un patient..."
              className="input-control"
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-secondary)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <div style={{ position: 'relative', cursor: 'pointer' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)'
            }}>
              <Bell size={18} />
            </div>
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#ef4444',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 700,
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--bg-primary)'
            }}>3</span>
          </div>
        </div>
      </div>

      {/* Subtab Navigation Pills */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => setActiveSubTab('billing')}
          style={{
            padding: '8px 18px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: activeSubTab === 'billing' ? '#1e4d40' : 'var(--bg-secondary)',
            color: activeSubTab === 'billing' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          Gestion de l'abonnement
        </button>

        <button
          onClick={() => setActiveSubTab('clinic')}
          style={{
            padding: '8px 18px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            backgroundColor: activeSubTab === 'clinic' ? '#1e4d40' : 'var(--bg-secondary)',
            color: activeSubTab === 'clinic' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 700,
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          Informations Clinique
        </button>

        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setActiveSubTab('users')}
            style={{
              padding: '8px 18px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              backgroundColor: activeSubTab === 'users' ? '#1e4d40' : 'var(--bg-secondary)',
              color: activeSubTab === 'users' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            Gestion des Utilisateurs
          </button>
        )}
      </div>

      {/* TAB 1: GESTION DES ABONNEMENTS MATCHING IMAGE 1 TARGET DESIGN */}
      {activeSubTab === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          
          {/* Main Title Section */}
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-secondary)' }}>
              Abonnement
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px', margin: 0 }}>
              Plan actuel : Clinique · Renouvellement le 14 juillet 2025
            </p>
          </div>

          {/* Section: Choisir un plan (3 Cards Grid matching Image 1) */}
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Choisir un plan
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              
              {/* STARTER */}
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '1.75rem 1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.25rem'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    STARTER
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '0.5rem 0' }}>
                    <span style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>25 000</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>FCFA / mois</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0' }}>
                    Pour les petites structures et cabinets solo
                  </p>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Check size={16} color="#10b981" /> <span>1 praticien</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Check size={16} color="#10b981" /> <span>Jusqu'à 200 patients</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Check size={16} color="#10b981" /> <span>Gestion RDV</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Check size={16} color="#10b981" /> <span>Ordonnances</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Check size={16} color="#10b981" /> <span>Support email</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => handleSelectPlan('starter')}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Choisir ce plan
                </button>
              </div>

              {/* CLINIQUE (ACTIVE PLAN MATCHING IMAGE 1) */}
              <div style={{
                backgroundColor: '#e6f4ea',
                border: '1px solid #bbf7d0',
                borderRadius: '16px',
                padding: '1.75rem 1.5rem',
                boxShadow: '0 4px 14px rgba(30, 77, 64, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.25rem',
                position: 'relative'
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e4d40', textTransform: 'uppercase' }}>
                      CLINIQUE
                    </span>
                    <span style={{
                      backgroundColor: '#1e4d40',
                      color: '#ffffff',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: 700
                    }}>
                      Plan actuel
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '0.5rem 0' }}>
                    <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e4d40' }}>75 000</span>
                    <span style={{ fontSize: '0.85rem', color: '#1e4d40', opacity: 0.8 }}>FCFA / mois</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#1e4d40', opacity: 0.85, margin: '0 0 1.25rem 0' }}>
                    La solution complète pour les cliniques
                  </p>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 500 }}>
                      <Check size={16} color="#1e4d40" /> <span>Jusqu'à 10 praticiens</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 500 }}>
                      <Check size={16} color="#1e4d40" /> <span>Patients illimités</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 500 }}>
                      <Check size={16} color="#1e4d40" /> <span>Pharmacie & Labo</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 500 }}>
                      <Check size={16} color="#1e4d40" /> <span>Facturation & comptabilité</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 500 }}>
                      <Check size={16} color="#1e4d40" /> <span>Support prioritaire</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 500 }}>
                      <Check size={16} color="#1e4d40" /> <span>Rapports avancés</span>
                    </li>
                  </ul>
                </div>

                <button
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid #bbf7d0',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    color: '#1e4d40',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'default'
                  }}
                >
                  Plan actuel
                </button>
              </div>

              {/* HÔPITAL */}
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '1.75rem 1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.25rem'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    HÔPITAL
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '0.5rem 0' }}>
                    <span style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>180 000</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>FCFA / mois</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0' }}>
                    Pour les établissements à grande échelle
                  </p>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Check size={16} color="#10b981" /> <span>Praticiens illimités</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Check size={16} color="#10b981" /> <span>Multi-sites</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Check size={16} color="#10b981" /> <span>API & intégrations</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Check size={16} color="#10b981" /> <span>Tableaux de bord BI</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Check size={16} color="#10b981" /> <span>Account manager dédié</span>
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                      <Check size={16} color="#10b981" /> <span>SLA 99,9%</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => handleSelectPlan('hopital')}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Choisir ce plan
                </button>
              </div>

            </div>
          </div>

          {/* Section: Bottom Grid (~35% Left: Payment Method, ~65% Right: Invoices History) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.2fr)',
            gap: '1.5rem',
            alignItems: 'start'
          }}>
            {/* LEFT COLUMN: Payment Method & Renewal */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* MOYEN DE PAIEMENT */}
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  MOYEN DE PAIEMENT
                </span>

                <div style={{
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      backgroundColor: '#1e4d40',
                      color: '#ffffff',
                      padding: '8px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CreditCard size={18} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Wave Business</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>+225 07 12 34 56 78</div>
                    </div>
                  </div>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    border: '1px solid #10b981',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={12} />
                  </div>
                </div>

                <button
                  onClick={() => showToast('info', 'Paiement', 'Modifiez votre numéro Mobile Money.')}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Plus size={15} />
                  <span>Modifier le paiement</span>
                </button>
              </div>

              {/* PROCHAIN RENOUVELLEMENT */}
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  PROCHAIN RENOUVELLEMENT
                </span>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  14 juillet 2025
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Renouvellement automatique par Wave Business
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Historique des factures */}
            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Historique des factures
                </h3>

                <button
                  onClick={handleExportInvoices}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={14} />
                  <span>Tout exporter</span>
                </button>
              </div>

              {/* Invoices List matching Image 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {invoiceHistory.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-primary)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileText size={18} color="var(--text-muted)" />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                          Facture {inv.date}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {inv.plan}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {inv.amount}
                      </span>
                      
                      <span style={{
                        backgroundColor: '#e6f4ea',
                        color: '#1e4d40',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.725rem',
                        fontWeight: 700
                      }}>
                        {inv.status}
                      </span>

                      <button
                        onClick={() => showToast('info', 'Téléchargement', `Facture du ${inv.date} téléchargée.`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '4px'
                        }}
                        title="Télécharger la facture"
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: INFORMATIONS CLINIQUE */}
      {activeSubTab === 'clinic' && !loading && (
        <form onSubmit={handleUpdateClinicSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '650px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>Détails d'identification</h3>
          
          <div className="form-group">
            <label>Raison sociale / Nom de la clinique</label>
            <input type="text" value={clinicName} onChange={e => setClinicName(e.target.value)} className="input-control" required />
          </div>

          <div className="form-group">
            <label>Adresse physique (Lieu géographique)</label>
            <input type="text" value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} className="input-control" />
          </div>

          <div className="form-group">
            <label>Téléphone professionnel</label>
            <input type="text" value={clinicPhone} onChange={e => setClinicPhone(e.target.value)} className="input-control" />
          </div>

          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginTop: '1rem' }}>Grille Tarifaire des Actes (FCFA)</h3>
          
          <div className="modal-grid">
            <div className="form-group">
              <label>Consultation Générale</label>
              <input
                type="number"
                value={tariffs.consultation_general || 0}
                onChange={e => setTariffs({ ...tariffs, consultation_general: parseInt(e.target.value) || 0 })}
                className="input-control"
              />
            </div>
            
            <div className="form-group">
              <label>Consultation Spécialisée</label>
              <input
                type="number"
                value={tariffs.consultation_specialist || 0}
                onChange={e => setTariffs({ ...tariffs, consultation_specialist: parseInt(e.target.value) || 0 })}
                className="input-control"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', backgroundColor: '#1e4d40' }} disabled={isSavingClinic}>
            {isSavingClinic ? 'Sauvegarde...' : 'Enregistrer les paramètres'}
          </button>
        </form>
      )}

      {/* TAB 3: GESTION DES UTILISATEURS */}
      {activeSubTab === 'users' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button onClick={() => setIsUserModalOpen(true)} className="btn btn-primary" style={{ gap: '6px', backgroundColor: '#1e4d40' }}>
              <Plus size={16} />
              <span>Ajouter un compte collaborateur</span>
            </button>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Nom Complet</th>
                  <th>Email d'identification</th>
                  <th>Poste / Rôle</th>
                  <th>Statut d'accès</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(st => (
                  <tr key={st.id} style={{ opacity: st.active === 0 ? 0.6 : 1 }}>
                    <td style={{ fontWeight: 600 }}>{st.name}</td>
                    <td>{st.email}</td>
                    <td><span className="badge badge-info">{roleLabels[st.role]}</span></td>
                    <td>
                      {st.active === 1 ? (
                        <span className="badge badge-success">Actif</span>
                      ) : (
                        <span className="badge badge-danger">Désactivé</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {st.id !== currentUser?.id && (
                        <button
                          onClick={() => handleToggleUserStatus(st.id, st.active)}
                          className="btn btn-outline"
                          style={{ 
                            padding: '4px 8px', 
                            fontSize: '0.75rem',
                            borderColor: st.active === 1 ? 'var(--danger)' : 'var(--success)',
                            color: st.active === 1 ? 'var(--danger)' : 'var(--success)'
                          }}
                        >
                          {st.active === 1 ? 'Désactiver' : 'Activer'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* CREATE STAFF USER MODAL */}
      {isUserModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsUserModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Nouveau Compte Collaborateur</h3>
              <button onClick={() => setIsUserModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleCreateUserSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>Nom Complet *</label>
                  <input type="text" placeholder="Nom et Prénoms" value={newUserName} onChange={e => setNewUserName(e.target.value)} className="input-control" required />
                </div>
                
                <div className="form-group">
                  <label>Email d'identification *</label>
                  <input type="email" placeholder="Ex: collaborateur@saintjean.ci" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="input-control" required />
                </div>

                <div className="form-group">
                  <label>Mot de passe initial *</label>
                  <input type="password" placeholder="Minimum 6 caractères" value={newUserPass} onChange={e => setNewUserPass(e.target.value)} className="input-control" required />
                </div>

                <div className="form-group">
                  <label>Rôle / Profil d'accès *</label>
                  <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)} className="input-control" required>
                    <option value="doctor">Médecin / Praticien</option>
                    <option value="secretary">Secrétaire / Accueil</option>
                    <option value="pharmacist">Pharmacien interne</option>
                    <option value="lab_tech">Technicien Laboratoire</option>
                    <option value="manager">Gestionnaire Financier</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="btn btn-secondary">Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isSavingUser} style={{ backgroundColor: '#1e4d40' }}>
                  {isSavingUser ? 'Création...' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SettingsPage;
