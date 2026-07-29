import React, { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MobileQuickActionsBar } from './components/MobileQuickActionsBar';
import { initRippleEffect } from './utils/ripple';

// Logged-out entry pages: kept eager (small, must render instantly on first paint).
import { LandingPage } from './pages/LandingPage';
import { TermsOfServicePage } from './pages/TermsOfServicePage';
import { AuthPage } from './pages/Auth/AuthPage';

// Authenticated pages: code-split so the initial bundle doesn't ship every
// tab's code upfront. Each is only fetched the first time its tab is opened.
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const PatientsPage = lazy(() => import('./pages/Patients/PatientsPage').then(m => ({ default: m.PatientsPage })));
const PatientDetailPage = lazy(() => import('./pages/Patients/PatientDetailPage').then(m => ({ default: m.PatientDetailPage })));
const AppointmentsPage = lazy(() => import('./pages/Appointments/AppointmentsPage').then(m => ({ default: m.AppointmentsPage })));
const PharmacyPage = lazy(() => import('./pages/Pharmacy/PharmacyPage').then(m => ({ default: m.PharmacyPage })));
const OrdonnancesPage = lazy(() => import('./pages/Prescriptions/OrdonnancesPage').then(m => ({ default: m.OrdonnancesPage })));
const LaboratoryPage = lazy(() => import('./pages/Laboratory/LaboratoryPage').then(m => ({ default: m.LaboratoryPage })));
const AccountingPage = lazy(() => import('./pages/Accounting/AccountingPage').then(m => ({ default: m.AccountingPage })));
const DepositsPage = lazy(() => import('./pages/Deposits/DepositsPage').then(m => ({ default: m.DepositsPage })));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PlatformAdminPage = lazy(() => import('./pages/PlatformAdmin/PlatformAdminPage').then(m => ({ default: m.PlatformAdminPage })));
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage').then(m => ({ default: m.ProfilePage })));

const TabFallback: React.FC = () => (
  <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.6 }}>Chargement...</div>
);

const MainAppContent: React.FC = () => {
  const { user, clinic, loading } = useAuth();
  
  // Navigation tabs
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  // Tabs stay mounted (hidden via CSS) once visited instead of unmounting on
  // switch, so their data fetches aren't repeated every time the user comes back.
  const visitedTabsRef = useRef<Set<string>>(new Set(['dashboard']));
  visitedTabsRef.current.add(currentTab);

  // Auth pages switching states (when not logged in)
  const [loggedOutTab, setLoggedOutTab] = useState<'landing' | 'login' | 'register' | 'terms'>('landing');

  // Quick Action modal triggers
  const [openPatientModal, setOpenPatientModal] = useState<boolean>(false);
  const [openApptModal, setOpenApptModal] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const tabTitles: Record<string, string> = {
    dashboard: 'Tableau de bord',
    appointments: 'Gestion des Rendez-vous',
    patients: selectedPatientId ? 'Dossier Patient' : 'Registre des Patients',
    pharmacy: 'Gestion de Pharmacie',
    prescriptions: 'Gestion des Ordonnances',
    laboratory: 'File du Laboratoire',
    accounting: 'Grand Livre & Recettes',
    deposits: 'Dépôts de garantie',
    settings: 'Paramètres du cabinet',
    profile: 'Mon profil',
    'platform-admin': 'Administration plateforme'
  };

  // Keep the browser tab title in sync with the current view (no real routing,
  // so this doesn't create separately indexable URLs — just a UX/share-context nicety).
  useEffect(() => {
    if (!user) {
      const loggedOutTitles: Record<string, string> = {
        landing: "MediClinic — Logiciel de gestion de clinique en Côte d'Ivoire",
        login: 'Connexion — MediClinic',
        register: 'Créer un compte — MediClinic',
        terms: "Conditions générales d'utilisation — MediClinic"
      };
      document.title = loggedOutTitles[loggedOutTab] || 'MediClinic';
      return;
    }
    document.title = tabTitles[currentTab] ? `${tabTitles[currentTab]} — MediClinic` : 'MediClinic';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loggedOutTab, currentTab, selectedPatientId]);

  if (loading) {
    return (
      <div style={{
        backgroundColor: '#0b0f19',
        color: 'white',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.25rem',
        fontSize: '1.2rem',
        fontWeight: 600
      }}>
        <img src="/logo-icon.svg" alt="MediClinic" width={56} height={56} className="app-loading-logo" />
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
    return <Suspense fallback={<TabFallback />}><OnboardingPage /></Suspense>;
  }

  // 3. Cross-clinic platform admin — a wholly separate console, not a tab
  // inside the normal clinic app (no Patients/Rendez-vous/Ordonnances here).
  if (currentTab === 'platform-admin') {
    return (
      <Suspense fallback={<TabFallback />}>
        <PlatformAdminPage onExit={() => setCurrentTab('dashboard')} />
      </Suspense>
    );
  }

  // 4. Main Authenticated Interface
  const handleQuickAction = (action: string) => {
    if (action === 'new_patient') {
      setSelectedPatientId(null);
      setCurrentTab('patients');
      setOpenPatientModal(true);
    } else if (action === 'new_appt') {
      setCurrentTab('appointments');
      setOpenApptModal(true);
    } else if (action === 'new_deposit') {
      setCurrentTab('deposits');
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
        
        {/* Render Tab components. Once a tab has been visited it stays mounted
            (hidden via CSS) instead of unmounting, so switching back doesn't
            re-run its data fetch. */}
        <Suspense fallback={<TabFallback />}>
          {visitedTabsRef.current.has('dashboard') && (
            <div style={{ display: currentTab === 'dashboard' ? undefined : 'none' }}>
              <Dashboard setCurrentTab={setCurrentTab} onQuickAction={handleQuickAction} />
            </div>
          )}

          {visitedTabsRef.current.has('appointments') && (
            <div style={{ display: currentTab === 'appointments' ? undefined : 'none' }}>
              <AppointmentsPage
                triggerOpenModal={openApptModal}
                onModalClosed={() => setOpenApptModal(false)}
                onViewPatient={(patientId) => { setSelectedPatientId(patientId); setCurrentTab('patients'); }}
              />
            </div>
          )}

          {visitedTabsRef.current.has('patients') && (
            <div style={{ display: currentTab === 'patients' ? undefined : 'none' }}>
              {selectedPatientId ? (
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
              )}
            </div>
          )}

          {visitedTabsRef.current.has('pharmacy') && (
            <div style={{ display: currentTab === 'pharmacy' ? undefined : 'none' }}><PharmacyPage /></div>
          )}
          {visitedTabsRef.current.has('prescriptions') && (
            <div style={{ display: currentTab === 'prescriptions' ? undefined : 'none' }}><OrdonnancesPage /></div>
          )}
          {visitedTabsRef.current.has('laboratory') && (
            <div style={{ display: currentTab === 'laboratory' ? undefined : 'none' }}><LaboratoryPage /></div>
          )}
          {visitedTabsRef.current.has('accounting') && (
            <div style={{ display: currentTab === 'accounting' ? undefined : 'none' }}><AccountingPage /></div>
          )}
          {visitedTabsRef.current.has('deposits') && (
            <div style={{ display: currentTab === 'deposits' ? undefined : 'none' }}><DepositsPage /></div>
          )}
          {visitedTabsRef.current.has('settings') && (
            <div style={{ display: currentTab === 'settings' ? undefined : 'none' }}><SettingsPage /></div>
          )}
          {visitedTabsRef.current.has('profile') && (
            <div style={{ display: currentTab === 'profile' ? undefined : 'none' }}><ProfilePage /></div>
          )}
        </Suspense>
      </main>

      {/* Mobile-only quick action bar (hidden on desktop) */}
      <MobileQuickActionsBar onQuickAction={handleQuickAction} />
    </div>
  );
};

function App() {
  useEffect(() => initRippleEffect(), []);

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
