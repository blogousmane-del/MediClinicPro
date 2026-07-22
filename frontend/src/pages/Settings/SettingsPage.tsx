import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search,
  Bell,
  Check,
  CreditCard,
  Plus,
  Loader2
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

  // Billing & Subscription states
  const [paymentProvider, setPaymentProvider] = useState<string>('wave');
  const [paymentPhone, setPaymentPhone] = useState<string>('');
  const [renewMonths, setRenewMonths] = useState<number>(1);
  const [isRenewing, setIsRenewing] = useState<boolean>(false);

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

  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentPhone) {
      showToast('error', 'Numéro requis', 'Veuillez saisir votre numéro Mobile Money.');
      return;
    }

    setIsRenewing(true);
    try {
      await renewSubscription(paymentProvider, paymentPhone, renewMonths, 'starter');
      showToast('success', 'Abonnement renouvelé', `Paiement confirmé via ${paymentProvider.toUpperCase()}. Votre abonnement a été prolongé de ${renewMonths} mois.`);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec du paiement', err.error || 'Impossible de traiter le renouvellement.');
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

      {/* TAB 1: GESTION DE L'ABONNEMENT */}
      {activeSubTab === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

          {/* Main Title Section */}
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-secondary)' }}>
              Abonnement
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px', margin: 0 }}>
              {clinic?.subscription_status === 'expired' ? (
                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Abonnement expiré — renouvelez ci-dessous pour réactiver l'écriture des données.</span>
              ) : clinic?.subscription_expires_at ? (
                `Statut : ${clinic.subscription_status === 'trial' ? 'Période d\'essai' : 'Actif'} · Renouvellement le ${new Date(clinic.subscription_expires_at).toLocaleDateString('fr-FR')}`
              ) : (
                'Statut abonnement non disponible.'
              )}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: '1.5rem', alignItems: 'start' }}>

            {/* Plan card — single real plan, matches Landing Page pricing */}
            <div style={{
              backgroundColor: '#e6f4ea',
              border: '1px solid #bbf7d0',
              borderRadius: '16px',
              padding: '1.75rem 1.5rem',
              boxShadow: '0 4px 14px rgba(30, 77, 64, 0.08)'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e4d40', textTransform: 'uppercase' }}>
                PLAN CLINIQUE
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', margin: '0.5rem 0' }}>
                <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#1e4d40' }}>15 000</span>
                <span style={{ fontSize: '0.85rem', color: '#1e4d40', opacity: 0.8 }}>FCFA / mois</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#1e4d40', opacity: 0.85, margin: '0 0 1.25rem 0' }}>
                La solution complète pour votre clinique
              </p>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 500 }}>
                  <Check size={16} color="#1e4d40" /> <span>Jusqu'à 15 collaborateurs</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 500 }}>
                  <Check size={16} color="#1e4d40" /> <span>Dossiers patients illimités</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 500 }}>
                  <Check size={16} color="#1e4d40" /> <span>Pharmacie & Laboratoire inclus</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 500 }}>
                  <Check size={16} color="#1e4d40" /> <span>Encaissements & Facturation</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e4d40', fontWeight: 500 }}>
                  <Check size={16} color="#1e4d40" /> <span>Mode déconnecté basique</span>
                </li>
              </ul>
            </div>

            {/* Real renewal form, wired to renewSubscription() -> POST /financials/subscription-pay */}
            <form onSubmit={handleRenewSubmit} style={{
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
                RENOUVELER PAR MOBILE MONEY
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Opérateur</label>
                  <select
                    value={paymentProvider}
                    onChange={(e) => setPaymentProvider(e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px' }}
                  >
                    <option value="wave">Wave</option>
                    <option value="orange">Orange Money</option>
                    <option value="mtn">MTN MoMo</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Durée</label>
                  <select
                    value={renewMonths}
                    onChange={(e) => setRenewMonths(parseInt(e.target.value))}
                    className="input-control"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px' }}
                  >
                    <option value={1}>1 mois — 15 000 FCFA</option>
                    <option value={3}>3 mois — 45 000 FCFA</option>
                    <option value={6}>6 mois — 90 000 FCFA</option>
                    <option value={12}>12 mois — 180 000 FCFA</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Numéro Mobile Money</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px' }}>
                  <CreditCard size={16} color="var(--text-muted)" />
                  <input
                    type="tel"
                    placeholder="Ex: +225 07 12 34 56 78"
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value)}
                    style={{ border: 'none', outline: 'none', background: 'none', flex: 1, fontSize: '0.875rem', color: 'var(--text-primary)' }}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isRenewing}
                className="btn btn-primary"
                style={{ backgroundColor: '#1e4d40', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {isRenewing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Traitement du paiement...</span>
                  </>
                ) : (
                  <span>Payer et renouveler ({(renewMonths * 15000).toLocaleString()} FCFA)</span>
                )}
              </button>
            </form>

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
