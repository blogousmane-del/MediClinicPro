import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Building, MapPin, UserPlus, Trash, ChevronRight, Check } from 'lucide-react';
import { PhoneInput } from '../components/PhoneInput';

export const OnboardingPage: React.FC = () => {
  const { onboardClinic } = useAuth();
  const { showToast } = useNotifications();

  const [step, setStep] = useState<number>(1);
  const [address, setAddress] = useState<string>('');
  const [phone, setPhone] = useState<string>('');

  const handleStep1Next = () => {
    if (!address.trim()) {
      showToast('error', 'Champs requis', 'Veuillez renseigner l\'adresse physique de votre clinique.');
      return;
    }
    if (!phone.trim()) {
      showToast('error', 'Champs requis', 'Veuillez renseigner le téléphone de contact.');
      return;
    }
    setStep(2);
  };

  // Step 2: Users list
  const [staffList, setStaffList] = useState<any[]>([]);
  const [newStaffName, setNewStaffName] = useState<string>('');
  const [newStaffEmail, setNewStaffEmail] = useState<string>('');
  const [newStaffPass, setNewStaffPass] = useState<string>('');
  const [newStaffRole, setNewStaffRole] = useState<'doctor'|'secretary'|'pharmacist'|'lab_tech'|'manager'>('doctor');

  // Step 3: Modules list
  const [modules, setModules] = useState<Record<string, boolean>>({
    patients: true,
    appointments: true,
    pharmacy: true,
    laboratory: true,
    accounting: true
  });

  const handleAddStaff = () => {
    if (!newStaffName || !newStaffEmail || !newStaffPass) {
      showToast('error', 'Champs requis', 'Veuillez remplir toutes les informations du collaborateur.');
      return;
    }
    
    // Simple email validation
    if (!newStaffEmail.includes('@')) {
      showToast('error', 'Format email', 'Adresse email invalide.');
      return;
    }

    setStaffList([...staffList, {
      name: newStaffName,
      email: newStaffEmail,
      password: newStaffPass,
      role: newStaffRole
    }]);

    setNewStaffName('');
    setNewStaffEmail('');
    setNewStaffPass('');
    showToast('success', 'Collaborateur ajouté', `${newStaffName} a été ajouté à la liste d'intégration.`);
  };

  const handleRemoveStaff = (index: number) => {
    setStaffList(staffList.filter((_, i) => i !== index));
  };

  const handleComplete = async () => {
    try {
      const activeModuleIds = Object.keys(modules).filter(k => modules[k]);
      await onboardClinic(address, phone, staffList, activeModuleIds);
      showToast('success', 'Configuration terminée', 'Votre clinique est maintenant prête à être utilisée.');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Erreur de configuration', err.error || 'Impossible d\'enregistrer les paramètres.');
    }
  };

  const roleLabels: Record<string, string> = {
    doctor: 'Médecin',
    secretary: 'Secrétaire',
    pharmacist: 'Pharmacien',
    lab_tech: 'Laborantin',
    manager: 'Gestionnaire'
  };

  return (
    <div style={{
      backgroundColor: '#0b0f19',
      backgroundImage: 'radial-gradient(circle at 50% 120%, rgba(13, 148, 136, 0.1), rgba(11, 15, 25, 0))',
      color: '#f9fafb',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      fontFamily: 'var(--font-primary)'
    }}>
      {/* Inline styles to bypass global light/dark variables and ensure high readability */}
      <style>{`
        .onboard-card {
          background-color: #111827 !important;
          border: 1px solid #1f2937 !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
          border-radius: 16px !important;
        }
        .onboard-input {
          background-color: #0b0f19 !important;
          border: 1px solid #1f2937 !important;
          color: #ffffff !important;
          border-radius: 8px !important;
          transition: all 0.2s ease !important;
        }
        .onboard-input:focus {
          border-color: #14b8a6 !important;
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.15) !important;
          background-color: #05080f !important;
        }
        .onboard-input::placeholder {
          color: #64748b !important;
          opacity: 1 !important;
        }
        .onboard-label {
          color: #94a3b8 !important;
          font-weight: 500 !important;
          font-size: 0.875rem !important;
          margin-bottom: 0.375rem !important;
          display: inline-block !important;
        }
        .onboard-phone .PhoneInput {
          background-color: #0b0f19 !important;
          border: 1px solid #1f2937 !important;
          border-radius: 8px !important;
        }
        .onboard-phone .PhoneInput--focus {
          border-color: #14b8a6 !important;
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.15) !important;
        }
        .onboard-phone .PhoneInputCountry {
          border-right: 1px solid #1f2937 !important;
        }
        .onboard-phone .PhoneInputCountrySelect {
          color: #ffffff !important;
        }
        .onboard-phone .PhoneInputCountrySelect option {
          color: #111827 !important;
          background-color: #ffffff !important;
        }
        .onboard-phone .PhoneInputCountrySelectArrow {
          color: #64748b !important;
        }
        .onboard-phone .PhoneInputInput {
          background: none !important;
          color: #ffffff !important;
        }
        .onboard-phone .PhoneInputInput::placeholder {
          color: #64748b !important;
        }
        /* Specific override for browser autofill background */
        .onboard-input:-webkit-autofill,
        .onboard-input:-webkit-autofill:hover, 
        .onboard-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #ffffff !important;
          -webkit-box-shadow: 0 0 0px 1000px #0b0f19 inset !important;
          transition: background-color 5000s ease-in-out 0s !important;
        }
      `}</style>

      <div className="onboard-card" style={{
        width: '100%',
        maxWidth: '750px',
        overflow: 'hidden'
      }}>
        {/* Steps header banner */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          borderBottom: '1px solid #1f2937',
          backgroundColor: '#0f172a'
        }}>
          {[
            { n: 1, label: 'Informations Clinique', icon: Building },
            { n: 2, label: 'Ajout du Personnel', icon: UserPlus },
            { n: 3, label: 'Activation des Modules', icon: Check }
          ].map(s => (
            <div
              key={s.n}
              style={{
                padding: '1.25rem',
                textAlign: 'center',
                borderBottom: step === s.n ? '3px solid rgb(13, 148, 136)' : 'none',
                color: step === s.n ? 'white' : '#6b7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '0.85rem',
                fontWeight: step === s.n ? 600 : 400
              }}
            >
              <s.icon size={16} color={step >= s.n ? 'rgb(13, 148, 136)' : '#6b7280'} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div style={{ padding: '2.5rem' }}>
          
          {/* STEP 1: General Info */}
          {step === 1 && (
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.5rem', color: 'white' }}>Parlez-nous de votre établissement</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Ces détails figureront sur l'en-tête de vos ordonnances et reçus de caisse.
              </p>

              <div className="form-group">
                <span className="onboard-label">Adresse physique de l'établissement</span>
                <div style={{ position: 'relative' }}>
                  <MapPin size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
                  <input
                    type="text"
                    placeholder="Ex: Cocody Angré 8ème Tranche, face station Shell, Abidjan"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    className="input-control onboard-input w-full"
                    style={{ paddingLeft: '38px' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <span className="onboard-label">Téléphone de contact</span>
                <div className="onboard-phone">
                  <PhoneInput value={phone} onChange={setPhone} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem' }}>
                <button
                  onClick={handleStep1Next}
                  className="btn btn-primary"
                  style={{ gap: '6px' }}
                >
                  Continuer <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Add Staff */}
          {step === 2 && (
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.5rem', color: 'white' }}>Invitez vos collaborateurs</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Invitez des praticiens, secrétaires ou pharmaciens. Vous pourrez aussi le faire plus tard dans les paramètres.
              </p>

              {/* Staff Input Area */}
              <div style={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px'
              }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <span className="onboard-label">Nom Complet</span>
                  <input
                    type="text"
                    placeholder="Ex: Dr. Yao Kouakou"
                    value={newStaffName}
                    onChange={e => setNewStaffName(e.target.value)}
                    className="input-control onboard-input w-full"
                  />
                </div>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <span className="onboard-label">Adresse Email</span>
                  <input
                    type="email"
                    placeholder="Ex: yao@mediclinic.com"
                    value={newStaffEmail}
                    onChange={e => setNewStaffEmail(e.target.value)}
                    className="input-control onboard-input w-full"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <span className="onboard-label">Mot de passe</span>
                  <input
                    type="password"
                    placeholder="Minimum 6 caractères"
                    value={newStaffPass}
                    onChange={e => setNewStaffPass(e.target.value)}
                    className="input-control onboard-input w-full"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <span className="onboard-label">Rôle / Poste</span>
                  <select
                    value={newStaffRole}
                    onChange={e => setNewStaffRole(e.target.value as any)}
                    className="input-control onboard-input w-full"
                    style={{ padding: '0.625rem 0.875rem' }}
                  >
                    <option value="doctor">Médecin / Praticien</option>
                    <option value="secretary">Secrétaire / Accueil</option>
                    <option value="pharmacist">Pharmacien interne</option>
                    <option value="lab_tech">Technicien Laboratoire</option>
                    <option value="manager">Gestionnaire Financier</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleAddStaff}
                  className="btn btn-outline"
                  style={{ gridColumn: 'span 2', marginTop: '6px' }}
                >
                  + Ajouter le collaborateur
                </button>
              </div>

              {/* Added Staff List */}
              <div style={{ marginBottom: '2rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'white', marginBottom: '8px' }}>Personnel à intégrer ({staffList.length})</h4>
                {staffList.length === 0 ? (
                  <div style={{
                    padding: '1rem',
                    textAlign: 'center',
                    border: '1px dashed #374151',
                    borderRadius: '8px',
                    color: '#6b7280',
                    fontSize: '0.9rem'
                  }}>Aucun collaborateur ajouté pour le moment.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {staffList.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          backgroundColor: '#1f2937',
                          borderRadius: '8px',
                          fontSize: '0.9rem'
                        }}
                      >
                        <div>
                          <strong style={{ color: 'white' }}>{item.name}</strong>{' '}
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>({item.email})</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="badge badge-info">{roleLabels[item.role]}</span>
                          <button
                            onClick={() => handleRemoveStaff(idx)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                <button
                  onClick={() => setStep(1)}
                  className="btn btn-secondary"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="btn btn-primary"
                  style={{ gap: '6px' }}
                >
                  Continuer <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Modules Selection */}
          {step === 3 && (
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '0.5rem', color: 'white' }}>Configurez vos modules métier</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Activez les sections correspondant à l'activité de votre cabinet.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2.5rem' }}>
                {[
                  { id: 'patients', label: 'Dossier Patient & Consultation', desc: 'Gestion des fiches de santé, des antécédents, des examens et ordonnances.' },
                  { id: 'appointments', label: 'Agenda & Rendez-vous', desc: 'Planification d\'agenda pour les praticiens, statut des visites.' },
                  { id: 'pharmacy', label: 'Pharmacie Intégrée', desc: 'Gestion du stock de médicaments, des alertes de rupture, approvisionnement.' },
                  { id: 'laboratory', label: 'Laboratoire d\'analyses', desc: 'File d\'attente des examens prescrits par les médecins, saisie des résultats.' },
                  { id: 'accounting', label: 'Comptabilité & Facturation', desc: 'Journal des recettes, tarifs de la clinique, encaissement de consultations.' }
                ].map(mod => (
                  <label
                    key={mod.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '1rem',
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={modules[mod.id]}
                      onChange={e => setModules({ ...modules, [mod.id]: e.target.checked })}
                      style={{ marginTop: '4px', width: '18px', height: '18px', accentColor: 'rgb(13, 148, 136)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: 'white', fontSize: '0.95rem' }}>{mod.label}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '2px', lineHeight: 1.4 }}>{mod.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                <button
                  onClick={() => setStep(2)}
                  className="btn btn-secondary"
                >
                  Précédent
                </button>
                <button
                  onClick={handleComplete}
                  className="btn btn-primary"
                  style={{ gap: '6px', fontWeight: 600 }}
                >
                  Terminer la configuration <Check size={16} />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
