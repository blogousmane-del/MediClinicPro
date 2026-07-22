import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';

// Pages
import { LandingPage } from './pages/LandingPage';
import { TermsOfServicePage } from './pages/TermsOfServicePage';
import { AuthPage } from './pages/Auth/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { Dashboard } from './pages/Dashboard';
import { PatientsPage } from './pages/Patients/PatientsPage';
import { PatientDetailPage } from './pages/Patients/PatientDetailPage';
import { AppointmentsPage } from './pages/Appointments/AppointmentsPage';
import { PharmacyPage } from './pages/Pharmacy/PharmacyPage';
import { OrdonnancesPage } from './pages/Prescriptions/OrdonnancesPage';
import { LaboratoryPage } from './pages/Laboratory/LaboratoryPage';
import { AccountingPage } from './pages/Accounting/AccountingPage';
import { SettingsPage } from './pages/Settings/SettingsPage';

const MainAppContent: React.FC = () => {
  const { user, clinic, loading } = useAuth();
  
  // Navigation tabs
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  // Auth pages switching states (when not logged in)
  const [loggedOutTab, setLoggedOutTab] = useState<'landing' | 'login' | 'register' | 'terms'>('landing');

  // Quick Action modal triggers
  const [openPatientModal, setOpenPatientModal] = useState<boolean>(false);
  const [openApptModal, setOpenApptModal] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  if (loading) {
    return (
      <div style={{
        backgroundColor: '#0b0f19',
        color: 'white',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.2rem',
        fontWeight: 600
      }}>
        Initialisation de MediClinic...
      </div>
    );
  }

  // 1. Unauthenticated workflow
  if (!user) {
    if (loggedOutTab === 'login' || loggedOutTab === 'register') {
      return <AuthPage initialTab={loggedOutTab} onNavigate={setLoggedOutTab} />;
    }
    if (loggedOutTab === 'terms') {
      return <TermsOfServicePage onBack={() => setLoggedOutTab('landing')} onRegister={() => setLoggedOutTab('register')} />;
    }
    return <LandingPage onNavigate={setLoggedOutTab} />;
  }

  // 2. Onboarding workflow (If clinic address is not configured yet)
  const needsOnboarding = !clinic?.address || clinic.address.trim() === '';
  if (needsOnboarding && user.role === 'admin') {
    return <OnboardingPage />;
  }

  // 3. Main Authenticated Interface
  const tabTitles: Record<string, string> = {
    dashboard: 'Tableau de bord',
    appointments: 'Gestion des Rendez-vous',
    patients: selectedPatientId ? 'Dossier Patient' : 'Registre des Patients',
    pharmacy: 'Gestion de Pharmacie',
    prescriptions: 'Gestion des Ordonnances',
    laboratory: 'File du Laboratoire',
    accounting: 'Grand Livre & Recettes',
    settings: 'Paramètres du cabinet'
  };

  const handleQuickAction = (action: string) => {
    if (action === 'new_patient') {
      setSelectedPatientId(null);
      setCurrentTab('patients');
      setOpenPatientModal(true);
    } else if (action === 'new_appt') {
      setCurrentTab('appointments');
      setOpenApptModal(true);
    }
  };

  return (
    <div className="app-container">
      {/* Navigation Drawer */}
      <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={(tab) => {
          // Reset sub pages
          if (tab === 'patients') {
            setSelectedPatientId(null);
          }
          setCurrentTab(tab);
          setSidebarOpen(false);
        }} 
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Container */}
      <main className="main-content">
        <Header 
          title={tabTitles[currentTab]} 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        
        {/* Render Tab components */}
        {currentTab === 'dashboard' && (
          <Dashboard setCurrentTab={setCurrentTab} onQuickAction={handleQuickAction} />
        )}
        
        {currentTab === 'appointments' && (
          <AppointmentsPage 
            triggerOpenModal={openApptModal} 
            onModalClosed={() => setOpenApptModal(false)} 
          />
        )}
        
        {currentTab === 'patients' && (
          selectedPatientId ? (
            <PatientDetailPage 
              patientId={selectedPatientId} 
              onBack={() => setSelectedPatientId(null)} 
            />
          ) : (
            <PatientsPage 
              onSelectPatient={setSelectedPatientId} 
              triggerOpenModal={openPatientModal} 
              onModalClosed={() => setOpenPatientModal(false)} 
            />
          )
        )}
        
        {currentTab === 'pharmacy' && <PharmacyPage />}
        {currentTab === 'prescriptions' && <OrdonnancesPage />}
        {currentTab === 'laboratory' && <LaboratoryPage />}
        {currentTab === 'accounting' && <AccountingPage />}
        {currentTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
};

function App() {
  return (
    <NotificationProvider>
      <OfflineProvider>
        <AuthProvider>
          <MainAppContent />
        </AuthProvider>
      </OfflineProvider>
    </NotificationProvider>
  );
}

export default App;
