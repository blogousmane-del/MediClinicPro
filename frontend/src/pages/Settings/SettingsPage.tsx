import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search,
  Bell,
  Check,
  Plus,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { PhoneInput } from '../../components/PhoneInput';
import { PaymentCheckoutModal } from '../../components/PaymentCheckoutModal';

interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: string;
  active: number;
}

export const SettingsPage: React.FC = () => {
  const { user: currentUser, clinic, renewSubscription, pollSubscriptionStatus, refreshProfile, setPassword } = useAuth();
  const { showToast } = useNotifications();

  const [activeSubTab, setActiveSubTab] = useState<'billing' | 'clinic' | 'users' | 'security'>('billing');
  const [loading, setLoading] = useState<boolean>(true);

  // Password / security form states
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [isSavingPassword, setIsSavingPassword] = useState<boolean>(false);

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

  // Billing & Subscription states
  const [paymentPhone, setPaymentPhone] = useState<string>('');
  const [renewMonths, setRenewMonths] = useState<number>(1);
  const [isRenewing, setIsRenewing] = useState<boolean>(false);
  const [activeCheckout, setActiveCheckout] = useState<{ checkoutUrl: string; subscriptionPaymentId: number; provider: string } | null>(null);

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

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPasswordInput.length < 6) {
      showToast('error', 'Mot de passe trop court', 'Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      showToast('error', 'Les mots de passe ne correspondent pas', 'Veuillez confirmer le même mot de passe.');
      return;
    }
    if (currentUser?.passwordSet && !currentPasswordInput) {
      showToast('error', 'Mot de passe actuel requis', 'Veuillez saisir votre mot de passe actuel.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await setPassword(currentPasswordInput, newPasswordInput);
      showToast(
        'success',
        currentUser?.passwordSet ? 'Mot de passe modifié' : 'Mot de passe défini',
        currentUser?.passwordSet
          ? 'Votre mot de passe a été mis à jour.'
          : 'Vous pouvez désormais vous connecter avec votre email et ce mot de passe, en plus de Google.'
      );
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || 'Impossible de mettre à jour le mot de passe.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsRenewing(true);
    try {
      const result = await renewSubscription(paymentPhone || undefined, renewMonths);
      setActiveCheckout(result);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec du paiement', err.error || 'Impossible d\'initialiser le renouvellement.');
    } finally {
      setIsRenewing(false);
    }
  };

  const roleLabels: Record<string, string> = {
    admin: 'Administrateur',
    doctor: 'Médecin',
    secretary: 'Secrétaire',
    pharmacist: 'Pharmacien',
    lab_tech: 'Laborantin',
    manager: 'Gestionnaire'
  };

  return (
    <>
      <style>{`
        .settings-page {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          padding: 1.25rem 1.5rem;
          background-color: var(--bg-primary);
          min-height: calc(100vh - var(--header-height));
          box-sizing: border-box;
        }

        .settings-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .settings-header-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .settings-search-box {
          position: relative;
          width: 220px;
        }
        .settings-search-box input {
          width: 100%;
          padding: 8px 12px 8px 34px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background-color: var(--bg-secondary);
          font-size: 0.85rem;
          outline: none;
          color: var(--text-primary);
        }

        .settings-nav-tabs {
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          padding-bottom: 2px;
          -webkit-overflow-scrolling: touch;
        }

        .settings-tab-btn {
          padding: 8px 16px;
          border-radius: 10px;
          border: 1px solid var(--border);
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        .settings-tab-btn.active {
          background-color: #1e4d40;
          color: #ffffff;
          border-color: #1e4d40;
        }
        .settings-tab-btn.inactive {
          background-color: var(--bg-secondary);
          color: var(--text-secondary);
        }

        .settings-billing-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
          gap: 1.25rem;
          align-items: start;
        }

        .settings-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        /* Mobile Adjustments (<= 850px) */
        @media (max-width: 850px) {
          .settings-billing-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .settings-page {
            padding: 1rem 0.875rem;
            gap: 1rem;
          }
          .settings-header {
            flex-direction: column;
            align-items: stretch;
          }
          .settings-header-right {
            justify-content: flex-end;
          }
          .settings-search-box {
            flex: 1;
            width: auto;
            max-width: 200px;
          }
          .settings-form-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="settings-page">
        
        {/* 1. Top Header */}
        <div className="settings-header">
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
              Gestion des abonnements
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '2px', margin: 0 }}>
              Lundi 14 juillet 2025
            </p>
          </div>

          <div className="settings-header-right">
            <div className="settings-search-box">
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Rechercher..."
                className="input-control"
              />
            </div>

            <div style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
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
                fontSize: '0.68rem',
                fontWeight: 700,
                width: '17px',
                height: '17px',
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
        <div className="settings-nav-tabs">
          <button
            onClick={() => setActiveSubTab('billing')}
            className={`settings-tab-btn ${activeSubTab === 'billing' ? 'active' : 'inactive'}`}
          >
            Gestion de l'abonnement
          </button>

          <button
            onClick={() => setActiveSubTab('clinic')}
            className={`settings-tab-btn ${activeSubTab === 'clinic' ? 'active' : 'inactive'}`}
          >
            Informations Clinique
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setActiveSubTab('users')}
              className={`settings-tab-btn ${activeSubTab === 'users' ? 'active' : 'inactive'}`}
            >
              Gestion des Utilisateurs
            </button>
          )}

          <button
            onClick={() => setActiveSubTab('security')}
            className={`settings-tab-btn ${activeSubTab === 'security' ? 'active' : 'inactive'}`}
          >
            Sécurité
          </button>
        </div>

        {/* TAB 1: GESTION DE L'ABONNEMENT */}
        {activeSubTab === 'billing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Main Title Section */}
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-secondary)' }}>
                Abonnement
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2px', margin: 0 }}>
                {clinic?.subscription_status === 'expired' ? (
                  <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Abonnement expiré — renouvelez ci-dessous pour réactiver l'écriture des données.</span>
                ) : clinic?.subscription_expires_at ? (
                  `Statut : ${clinic.subscription_status === 'trial' ? 'Période d\'essai' : 'Actif'} · Renouvellement le ${new Date(clinic.subscription_expires_at).toLocaleDateString('fr-FR')}`
                ) : (
                  'Statut : Actif · Renouvellement le 02/08/2026'
                )}
              </p>
            </div>

            <div className="settings-billing-grid">

              {/* Plan Card */}
              <div style={{
                backgroundColor: '#e6f4ea',
                border: '1px solid #bbf7d0',
                borderRadius: '16px',
                padding: '1.5rem 1.25rem',
                boxShadow: '0 4px 14px rgba(30, 77, 64, 0.08)'
              }}>
                <span style={{ fontSize: '0.725rem', fontWeight: 800, color: '#1e4d40', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  PLAN CLINIQUE
                </span>
                
                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px', margin: '0.4rem 0 0.8rem 0' }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e4d40', whiteSpace: 'nowrap' }}>
                    15 000 FCFA
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#1e4d40', opacity: 0.85, fontWeight: 600 }}>
                    / mois
                  </span>
                </div>

                <p style={{ fontSize: '0.8rem', color: '#1e4d40', opacity: 0.85, margin: '0 0 1rem 0' }}>
                  La solution complète pour votre clinique
                </p>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.825rem' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 600 }}>
                    <Check size={15} color="#1e4d40" style={{ flexShrink: 0 }} /> <span>Jusqu'à 15 collaborateurs</span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 600 }}>
                    <Check size={15} color="#1e4d40" style={{ flexShrink: 0 }} /> <span>Dossiers patients illimités</span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 600 }}>
                    <Check size={15} color="#1e4d40" style={{ flexShrink: 0 }} /> <span>Pharmacie & Laboratoire inclus</span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 600 }}>
                    <Check size={15} color="#1e4d40" style={{ flexShrink: 0 }} /> <span>Encaissements & Facturation FCFA</span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 600 }}>
                    <Check size={15} color="#1e4d40" style={{ flexShrink: 0 }} /> <span>Mode déconnecté basique</span>
                  </li>
                </ul>
              </div>

              {/* Renewal Form */}
              <form onSubmit={handleRenewSubmit} style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '1.25rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <span style={{ fontSize: '0.725rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  RENOUVELER PAR MOBILE MONEY
                </span>

                <div>
                  <label style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Durée
                  </label>
                  <select
                    value={renewMonths}
                    onChange={(e) => setRenewMonths(parseInt(e.target.value))}
                    className="input-control"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '0.85rem' }}
                  >
                    <option value={1}>1 mois — 15 000 FCFA</option>
                    <option value={3}>3 mois — 45 000 FCFA</option>
                    <option value={6}>6 mois — 90 000 FCFA</option>
                    <option value={12}>12 mois — 180 000 FCFA</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>
                    Numéro Mobile Money (optionnel)
                  </label>
                  <PhoneInput value={paymentPhone} onChange={setPaymentPhone} />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    Vous choisirez Wave, Orange Money ou MTN MoMo sur la page de paiement sécurisée.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isRenewing}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: '10px',
                    backgroundColor: '#1e4d40',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginTop: '4px'
                  }}
                >
                  {isRenewing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Initialisation...</span>
                    </>
                  ) : (
                    <span>Continuer vers le paiement ({(renewMonths * 15000).toLocaleString()} FCFA)</span>
                  )}
                </button>
              </form>

            </div>

          </div>
        )}

        {activeCheckout && (
          <PaymentCheckoutModal
            checkoutUrl={activeCheckout.checkoutUrl}
            provider={activeCheckout.provider}
            amountLabel={`${(renewMonths * 15000).toLocaleString()} FCFA`}
            pollStatus={() => pollSubscriptionStatus(activeCheckout.subscriptionPaymentId)}
            onSuccess={() => {
              showToast('success', 'Abonnement renouvelé', `Votre abonnement a été prolongé de ${renewMonths} mois.`);
              setActiveCheckout(null);
            }}
            onClose={() => setActiveCheckout(null)}
          />
        )}

        {/* TAB 2: INFORMATIONS CLINIQUE */}
        {activeSubTab === 'clinic' && !loading && (
          <form onSubmit={handleUpdateClinicSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '650px', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', margin: 0 }}>Détails d'identification</h3>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Raison sociale / Nom de la clinique</label>
              <input type="text" value={clinicName} onChange={e => setClinicName(e.target.value)} className="input-control" required />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Adresse physique (Lieu géographique)</label>
              <input type="text" value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} className="input-control" />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Téléphone professionnel</label>
              <PhoneInput value={clinicPhone} onChange={setClinicPhone} />
            </div>

            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginTop: '0.5rem', margin: 0 }}>Grille Tarifaire des Actes (FCFA)</h3>
            
            <div className="modal-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Consultation Générale</label>
                <input
                  type="number"
                  value={tariffs.consultation_general || 0}
                  onChange={e => setTariffs({ ...tariffs, consultation_general: parseInt(e.target.value) || 0 })}
                  className="input-control"
                />
              </div>
              
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Consultation Spécialisée</label>
                <input
                  type="number"
                  value={tariffs.consultation_specialist || 0}
                  onChange={e => setTariffs({ ...tariffs, consultation_specialist: parseInt(e.target.value) || 0 })}
                  className="input-control"
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', backgroundColor: '#1e4d40', borderRadius: '10px' }} disabled={isSavingClinic}>
              {isSavingClinic ? 'Sauvegarde...' : 'Enregistrer les paramètres'}
            </button>
          </form>
        )}

        {/* TAB 3: GESTION DES UTILISATEURS */}
        {activeSubTab === 'users' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <button onClick={() => setIsUserModalOpen(true)} className="btn btn-primary" style={{ gap: '6px', backgroundColor: '#1e4d40', borderRadius: '10px' }}>
                <Plus size={16} />
                <span>Ajouter un collaborateur</span>
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

        {/* TAB 4: SÉCURITÉ */}
        {activeSubTab === 'security' && (
          <form onSubmit={handlePasswordSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', maxWidth: '480px', width: '100%', boxSizing: 'border-box' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: '8px', margin: 0 }}>
              {currentUser?.passwordSet ? 'Changer le mot de passe' : 'Définir un mot de passe'}
            </h3>

            {!currentUser?.passwordSet && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                backgroundColor: 'var(--primary-light, #e6f4ea)', border: '1px solid #bbf7d0',
                borderRadius: '10px', padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#1e4d40'
              }}>
                <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>
                  Votre compte a été créé via Google et n'a pas encore de mot de passe. Définissez-en un
                  ci-dessous pour pouvoir aussi vous connecter avec votre email et ce mot de passe.
                </span>
              </div>
            )}

            {currentUser?.passwordSet && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Mot de passe actuel</label>
                <input
                  type="password"
                  value={currentPasswordInput}
                  onChange={e => setCurrentPasswordInput(e.target.value)}
                  className="input-control"
                  required
                />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Nouveau mot de passe</label>
              <input
                type="password"
                placeholder="Minimum 6 caractères"
                value={newPasswordInput}
                onChange={e => setNewPasswordInput(e.target.value)}
                className="input-control"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                value={confirmPasswordInput}
                onChange={e => setConfirmPasswordInput(e.target.value)}
                className="input-control"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', backgroundColor: '#1e4d40', borderRadius: '10px' }}
              disabled={isSavingPassword}
            >
              {isSavingPassword ? 'Enregistrement...' : (currentUser?.passwordSet ? 'Mettre à jour le mot de passe' : 'Définir le mot de passe')}
            </button>
          </form>
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
    </>
  );
};

export default SettingsPage;
