import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { Settings, Users, CreditCard, Plus, Check, ShieldAlert, Smartphone } from 'lucide-react';

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

  const [activeSubTab, setActiveSubTab] = useState<'clinic' | 'users' | 'billing'>('clinic');
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

  // Billing states
  const [billingProvider, setBillingProvider] = useState<string>('wave');
  const [billingPhone, setBillingPhone] = useState<string>('');
  const [billingMonths, setBillingMonths] = useState<number>(1);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);

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
      showToast('error', 'Erreur', 'Impossible de charger les paramètres de la clinique.');
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
      // Reset Form
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
      showToast('success', 'Statut modifié', 'Le statut d\'activité de l\'utilisateur a été mis à jour.');
      fetchStaffUsers();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur', err.error || 'Impossible de modifier le statut.');
    }
  };

  const handleSimulateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingPhone) {
      showToast('error', 'Champs requis', 'Veuillez saisir votre numéro mobile money.');
      return;
    }

    setIsProcessingPayment(true);
    try {
      await renewSubscription(billingProvider, billingPhone, billingMonths);
      showToast('success', 'Abonnement renouvelé !', `Paiement de ${(billingMonths * 15000).toLocaleString()} FCFA simulé et confirmé.`);
      setBillingPhone('');
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec du renouvellement', err.error || 'Erreur lors de la simulation de paiement.');
    } finally {
      setIsProcessingPayment(false);
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
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>Paramètres d'administration</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Configurez les informations d'établissement, les accès du personnel et l'abonnement.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '1.5rem' }}>
        <button
          onClick={() => setActiveSubTab('clinic')}
          style={{
            background: 'none',
            border: 'none',
            padding: '12px 6px',
            color: activeSubTab === 'clinic' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: activeSubTab === 'clinic' ? 600 : 400,
            borderBottom: activeSubTab === 'clinic' ? '3px solid var(--primary)' : 'none',
            cursor: 'pointer',
            fontSize: '0.95rem'
          }}
        >
          Informations Clinique
        </button>
        
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setActiveSubTab('users')}
            style={{
              background: 'none',
              border: 'none',
              padding: '12px 6px',
              color: activeSubTab === 'users' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeSubTab === 'users' ? 600 : 400,
              borderBottom: activeSubTab === 'users' ? '3px solid var(--primary)' : 'none',
              cursor: 'pointer',
              fontSize: '0.95rem'
            }}
          >
            Gestion des Utilisateurs
          </button>
        )}

        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setActiveSubTab('billing')}
            style={{
              background: 'none',
              border: 'none',
              padding: '12px 6px',
              color: activeSubTab === 'billing' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeSubTab === 'billing' ? 600 : 400,
              borderBottom: activeSubTab === 'billing' ? '3px solid var(--primary)' : 'none',
              cursor: 'pointer',
              fontSize: '0.95rem'
            }}
          >
            Abonnement & Factures
          </button>
        )}
      </div>

      {/* SUBTAB 1: Clinic settings */}
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
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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

            <div className="form-group">
              <label>Examen NFS / Hémogramme</label>
              <input
                type="number"
                value={tariffs.nfs || 0}
                onChange={e => setTariffs({ ...tariffs, nfs: parseInt(e.target.value) || 0 })}
                className="input-control"
              />
            </div>

            <div className="form-group">
              <label>Test Paludisme (TDR/Goutte Épaisse)</label>
              <input
                type="number"
                value={tariffs.malaria_test || 0}
                onChange={e => setTariffs({ ...tariffs, malaria_test: parseInt(e.target.value) || 0 })}
                className="input-control"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={isSavingClinic}>
            {isSavingClinic ? 'Sauvegarde...' : 'Enregistrer les paramètres'}
          </button>
        </form>
      )}

      {/* SUBTAB 2: Users Management */}
      {activeSubTab === 'users' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button onClick={() => setIsUserModalOpen(true)} className="btn btn-primary" style={{ gap: '6px' }}>
              <Plus size={16} />
              <span>Ajouter un compte collaborateur</span>
            </button>
          </div>

          <div className="table-container">
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Chargement des utilisateurs...</div>
            ) : staff.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucun collaborateur enregistré.</div>
            ) : (
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
            )}
          </div>
        </>
      )}

      {/* SUBTAB 3: Billing & Subscription Simulator */}
      {activeSubTab === 'billing' && clinic && (
        <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Subscription details card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>État de votre abonnement</h3>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              backgroundColor: 'var(--bg-tertiary)',
              padding: '16px',
              borderRadius: '8px'
            }}>
              <div>
                <span className="text-xs text-muted" style={{ fontWeight: 600 }}>STATUT</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <span className={`badge ${clinic.subscription_status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                    {clinic.subscription_status === 'active' ? 'ABONNÉ ACTIF' : 'EXPIRÉ'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs text-muted" style={{ fontWeight: 600 }}>DATE D'EXPIRATION</span>
                <div style={{ fontWeight: 'bold', fontSize: '1rem', marginTop: '2px', color: clinic.subscription_status === 'active' ? 'inherit' : 'var(--danger)' }}>
                  {new Date(clinic.subscription_expires_at).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                </div>
              </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              MediClinic coûte <strong>15 000 FCFA/mois</strong>. Lorsque votre abonnement expire, l'application repasse en lecture seule.
            </div>
          </div>

          {/* Simulator Form */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Bac à sable : Simulation Mobile Money</h3>
            
            <form onSubmit={handleSimulateSubscription} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Opérateur Mobile Money *</label>
                <select
                  value={billingProvider}
                  onChange={e => setBillingProvider(e.target.value)}
                  className="input-control"
                >
                  <option value="wave">Wave CI</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="mtn_momo">MTN Mobile Money</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Numéro de téléphone payeur *</label>
                <div style={{ position: 'relative' }}>
                  <Smartphone size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                  <input
                    type="tel"
                    placeholder="Ex: +225 0707..."
                    value={billingPhone}
                    onChange={e => setBillingPhone(e.target.value)}
                    className="input-control w-full"
                    style={{ paddingLeft: '38px' }}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Durée d'abonnement</label>
                <select
                  value={billingMonths}
                  onChange={e => setBillingMonths(parseInt(e.target.value))}
                  className="input-control"
                >
                  <option value={1}>1 mois (15 000 FCFA)</option>
                  <option value={3}>3 mois (45 000 FCFA)</option>
                  <option value={6}>6 mois (90 000 FCFA)</option>
                  <option value={12}>12 mois (180 000 FCFA)</option>
                </select>
              </div>

              <div style={{
                backgroundColor: 'var(--bg-tertiary)',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '0.85rem',
                borderLeft: '4px solid var(--primary)'
              }}>
                <strong>Simulateur :</strong> En cliquant, un Push OTP sera simulé vers l'opérateur et le compte sera instantanément renouvelé de {billingMonths} mois.
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? 'Traitement simulation...' : `Payer ${(billingMonths * 15000).toLocaleString()} FCFA`}
              </button>
            </form>
          </div>
        </div>
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
                <button type="submit" className="btn btn-primary" disabled={isSavingUser}>
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
