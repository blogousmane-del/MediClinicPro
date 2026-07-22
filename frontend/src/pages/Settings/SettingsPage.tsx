import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Smartphone } from 'lucide-react';

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
  const [billingPlan, setBillingPlan] = useState<'starter' | 'pro' | 'expert'>('starter');
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
      await renewSubscription(billingProvider, billingPhone, billingMonths, billingPlan);
      const planPrices = { starter: 15000, pro: 30000, expert: 60000 };
      const amount = billingMonths * planPrices[billingPlan];
      showToast('success', 'Abonnement renouvelé !', `Paiement de ${amount.toLocaleString()} FCFA simulé et confirmé.`);
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

  const planPrices = { starter: 15000, pro: 30000, expert: 60000 };
  const currentPlan = clinic?.settings?.subscription_plan || 'starter';

  const planLabels: Record<string, string> = {
    starter: 'Starter (Débutant)',
    pro: 'Pro (Professionnel)',
    expert: 'Expert (Grand Établissement)'
  };

  const planColors: Record<string, string> = {
    starter: 'badge-info',
    pro: 'badge-success',
    expert: 'badge-warning' // Gold
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-secondary)' }}>Paramètres d'administration</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Configurez les informations d'établissement, les accès du personnel et l'abonnement.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '1rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch', whiteSpace: 'nowrap' }}>
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
            fontSize: '0.95rem',
            whiteSpace: 'nowrap'
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
              fontSize: '0.95rem',
              whiteSpace: 'nowrap'
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
              fontSize: '0.95rem',
              whiteSpace: 'nowrap'
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

      {/* SUBTAB 3: Billing & Subscription SaaS */}
      {activeSubTab === 'billing' && clinic && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Status summary */}
          <div className="card" style={{ display: 'flex', flexDirection: 'row', gap: '2.5rem', flexWrap: 'wrap', padding: '1.5rem', alignItems: 'center' }}>
            <div>
              <span className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>STATUT DE L'ABONNEMENT</span>
              <span className={`badge ${clinic.subscription_status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.9rem', padding: '6px 12px' }}>
                {clinic.subscription_status === 'active' ? '🔴 ABONNÉ ACTIF' : '⚠️ EXPIRÉ'}
              </span>
            </div>

            <div>
              <span className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>FORFAIT ACTUEL</span>
              <span className={`badge ${planColors[currentPlan]}`} style={{ fontSize: '0.9rem', padding: '6px 12px' }}>
                {planLabels[currentPlan].toUpperCase()}
              </span>
            </div>

            <div>
              <span className="text-xs text-muted" style={{ fontWeight: 600, display: 'block', marginBottom: '4px' }}>DATE D'EXPIRATION</span>
              <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: clinic.subscription_status === 'active' ? 'var(--text-primary)' : 'var(--danger)' }}>
                {new Date(clinic.subscription_expires_at).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
              </span>
            </div>
          </div>

          {/* Pricing Plans Grid */}
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: 'white' }}>Forfaits & Tarifs SaaS</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              
              {/* STARTER */}
              <div 
                onClick={() => setBillingPlan('starter')}
                className="card"
                style={{
                  cursor: 'pointer',
                  border: billingPlan === 'starter' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  boxShadow: billingPlan === 'starter' ? '0 0 15px rgba(13, 148, 136, 0.25)' : 'var(--shadow-sm)',
                  backgroundColor: billingPlan === 'starter' ? 'var(--bg-secondary)' : 'rgba(255,255,255,0.01)',
                  transition: 'var(--transition)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '1.1rem', color: 'white' }}>Starter</strong>
                  {billingPlan === 'starter' && <span className="badge badge-success">Sélectionné</span>}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>15 000 FCFA <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/ mois</span></div>
                <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>De 1 à 3 collaborateurs</li>
                  <li>Dossiers patients complets</li>
                  <li>Agenda & Rendez-vous</li>
                  <li>Consultations & Ordonnances</li>
                </ul>
              </div>

              {/* PRO */}
              <div 
                onClick={() => setBillingPlan('pro')}
                className="card"
                style={{
                  cursor: 'pointer',
                  border: billingPlan === 'pro' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  boxShadow: billingPlan === 'pro' ? '0 0 15px rgba(13, 148, 136, 0.25)' : 'var(--shadow-sm)',
                  backgroundColor: billingPlan === 'pro' ? 'var(--bg-secondary)' : 'rgba(255,255,255,0.01)',
                  transition: 'var(--transition)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '1.1rem', color: 'white' }}>Pro</strong>
                  {billingPlan === 'pro' && <span className="badge badge-success">Sélectionné</span>}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>30 000 FCFA <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/ mois</span></div>
                <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>De 4 à 10 collaborateurs</li>
                  <li>Tout le forfait Starter</li>
                  <li>Gestion de la Pharmacie</li>
                  <li>Facturation & Recettes</li>
                </ul>
              </div>

              {/* EXPERT */}
              <div 
                onClick={() => setBillingPlan('expert')}
                className="card"
                style={{
                  cursor: 'pointer',
                  border: billingPlan === 'expert' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  boxShadow: billingPlan === 'expert' ? '0 0 15px rgba(13, 148, 136, 0.25)' : 'var(--shadow-sm)',
                  backgroundColor: billingPlan === 'expert' ? 'var(--bg-secondary)' : 'rgba(255,255,255,0.01)',
                  transition: 'var(--transition)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '1.1rem', color: 'white' }}>Expert</strong>
                  {billingPlan === 'expert' && <span className="badge badge-success">Sélectionné</span>}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>60 000 FCFA <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/ mois</span></div>
                <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>Nombre d'utilisateurs illimités</li>
                  <li>Tout le forfait Pro</li>
                  <li>File du Laboratoire d'analyses</li>
                  <li>Exportations PDF / Excel</li>
                </ul>
              </div>

            </div>
          </div>

          {/* Payment & Simulation */}
          <div className="modal-grid" style={{ alignItems: 'start' }}>
            
            {/* MM Simulator Form */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Simuler le renouvellement par Mobile Money</h3>
              
              <form onSubmit={handleSimulateSubscription} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="modal-grid">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Forfait sélectionné</label>
                    <select
                      value={billingPlan}
                      onChange={e => setBillingPlan(e.target.value as any)}
                      className="input-control"
                    >
                      <option value="starter">Starter (15 000 FCFA/mois)</option>
                      <option value="pro">Pro (30 000 FCFA/mois)</option>
                      <option value="expert">Expert (60 000 FCFA/mois)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Durée d'engagement</label>
                    <select
                      value={billingMonths}
                      onChange={e => setBillingMonths(parseInt(e.target.value))}
                      className="input-control"
                    >
                      <option value={1}>1 mois</option>
                      <option value={3}>3 mois</option>
                      <option value={6}>6 mois</option>
                      <option value={12}>12 mois (1 an)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Opérateur Mobile Money *</label>
                  <select
                    value={billingProvider}
                    onChange={e => setBillingProvider(e.target.value)}
                    className="input-control"
                  >
                    <option value="wave">Wave Côte d'Ivoire</option>
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

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  style={{ marginTop: '6px', fontWeight: 600 }}
                  disabled={isProcessingPayment}
                >
                  {isProcessingPayment ? 'Traitement en cours...' : `Confirmer et Payer ${(billingMonths * planPrices[billingPlan]).toLocaleString()} FCFA`}
                </button>
              </form>
            </div>

            {/* Help / Pricing Guide */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>Pourquoi choisir un forfait supérieur ?</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                <p>
                  🚀 <strong>Forfait Pro :</strong> Déverrouille les modules de gestion des stocks de pharmacie, de dispensation sur ordonnance, ainsi que les rapports de caisse pour le comptable.
                </p>
                <p>
                  🔬 <strong>Forfait Expert :</strong> Conçu pour les structures médicales complètes. Il intègre la file d'attente du laboratoire d'analyses, la saisie et l'impression des comptes-rendus d'analyses, ainsi que l'assistance technique prioritaire.
                </p>
                <div style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  borderLeft: '4px solid var(--primary)',
                  marginTop: '6px'
                }}>
                  Le basculement de forfait prolonge votre durée d'abonnement selon le prorata du tarif choisi.
                </div>
              </div>
            </div>

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
export default SettingsPage;
