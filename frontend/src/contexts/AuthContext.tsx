import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { parsePhoneNumber } from 'libphonenumber-js';
import { api, setSubscriptionErrorHandler } from '../utils/api';
import { deriveSubscriptionState, type SubscriptionState } from '../utils/subscription';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'secretary' | 'pharmacist' | 'lab_tech' | 'manager' | 'nurse';
  passwordSet?: boolean;
  availabilityStatus?: 'available' | 'busy' | 'away';
}

export interface Clinic {
  id: number;
  name: string;
  address: string;
  phone: string;
  logo: string;
  subscription_status: 'active' | 'expired' | 'trial';
  subscription_expires_at: string;
  plan?: 'starter' | 'clinique' | 'hopital';
  settings?: any;
}

interface AuthContextType {
  user: User | null;
  clinic: Clinic | null;
  /** Bandeau piloté depuis Platform Admin > Config. système. Vide = aucun bandeau. */
  maintenanceMessage: string;
  /** État d'abonnement calculé par le serveur : expiration, verrou, délai de grâce. */
  subscription: SubscriptionState;
  /** Suspension décidée par la plateforme — distincte d'un impayé, le paiement ne la lève pas. */
  suspended: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (clinicName: string, adminName: string, email: string, password: string, phone: string) => Promise<void>;
  logout: () => void;
  onboardClinic: (address: string, phone: string, staff: any[], modules: string[]) => Promise<void>;
  renewSubscription: (
    phone: string | undefined,
    months: number,
    planId?: 'clinique' | 'hopital'
  ) => Promise<{ checkoutUrl: string; subscriptionPaymentId: number; provider: string }>;
  pollSubscriptionStatus: (subscriptionPaymentId: number) => Promise<{ status: 'pending' | 'paid' | 'failed' | 'unknown' }>;
  activateFreePlan: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setPassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [serverSubscription, setServerSubscription] = useState<SubscriptionState | null>(null);
  const [suspended, setSuspended] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Le serveur fait foi ; le calcul local ne sert que si /auth/me ne renvoie pas
  // encore le bloc (onglet resté ouvert pendant un déploiement).
  const subscription = serverSubscription || deriveSubscriptionState(clinic);

  const refreshProfile = async () => {
    const token = localStorage.getItem('mediclinic_token');
    if (!token) {
      setUser(null);
      setClinic(null);
      setServerSubscription(null);
      setSuspended(false);
      setLoading(false);
      return;
    }

    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setClinic(data.clinic);
      setServerSubscription(data.subscription || null);
      setSuspended(Boolean(data.suspended));
      setMaintenanceMessage(data.maintenanceMessage || '');
    } catch (error) {
      console.error("Token verification failed. Logging out.", error);
      localStorage.removeItem('mediclinic_token');
      setUser(null);
      setClinic(null);
      setServerSubscription(null);
      setSuspended(false);
      setMaintenanceMessage('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
  }, []);

  // Un refus lié à l'abonnement veut dire que l'état chargé au montage a vieilli
  // — l'expiration tombe à une heure précise, souvent en pleine session. On
  // relit le profil pour que le verrou s'affiche sans rechargement. La garde
  // évite qu'une page enchaînant dix appels refusés déclenche dix relectures.
  const refreshingRef = useRef(false);
  useEffect(() => {
    setSubscriptionErrorHandler(() => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      refreshProfile().finally(() => {
        refreshingRef.current = false;
      });
    });
    return () => setSubscriptionErrorHandler(null);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { email, password });
      localStorage.setItem('mediclinic_token', data.token);
      setUser(data.user);
      setClinic(data.clinic);
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string) => {
    setLoading(true);
    try {
      const data = await api.post('/auth/google', { idToken });
      localStorage.setItem('mediclinic_token', data.token);
      setUser(data.user);
      setClinic(data.clinic);
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (clinicName: string, adminName: string, email: string, password: string, phone: string) => {
    setLoading(true);
    try {
      const data = await api.post('/auth/register', { clinicName, adminName, email, password, phone });
      localStorage.setItem('mediclinic_token', data.token);
      setUser(data.user);
      setClinic(data.clinic);
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('mediclinic_token');
    setUser(null);
    setClinic(null);
    setServerSubscription(null);
    setSuspended(false);
  };

  const onboardClinic = async (address: string, phone: string, staff: any[], modules: string[]) => {
    try {
      await api.post('/auth/onboarding', {
        clinicAddress: address,
        clinicPhone: phone,
        staff,
        activeModules: modules
      });
      await refreshProfile();
    } catch (err) {
      throw err;
    }
  };

  const setPassword = async (currentPassword: string, newPassword: string) => {
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      await refreshProfile();
    } catch (err) {
      throw err;
    }
  };

  const renewSubscription = async (
    phone: string | undefined,
    months: number,
    planId?: 'clinique' | 'hopital'
  ) => {
    // Les trois champs téléphone partent ensemble et sans pré-nettoyage :
    // Chariow exige un numéro national + un ISO2, jamais un E.164 brut, et
    // c'est le serveur qui normalise. Le repli serveur ne sait déduire le pays
    // que des indicatifs africains, d'où l'envoi systématique de phoneCountry.
    const parsed = phone ? parsePhoneNumber(phone) : null;
    const data = await api.post('/financials/subscription/checkout', {
      months,
      planId,
      phone: phone || undefined,
      phoneCountry: parsed?.country,
      phoneLocal: parsed?.nationalNumber
    });
    return {
      checkoutUrl: data.checkoutUrl,
      subscriptionPaymentId: data.subscriptionPaymentId,
      provider: data.provider
    };
  };

  const activateFreePlan = async () => {
    await api.put('/settings/plan', { planId: 'starter' });
    await refreshProfile();
  };

  // Interroge la vérification côté serveur, qui redemande elle-même son statut
  // à Chariow avant de créditer. Volontairement PAS la lecture simple de la
  // ligne (/subscription/status) : celle-ci se contenterait d'observer un
  // 'pending' indéfiniment si le webhook ne parvient jamais.
  const pollSubscriptionStatus = async (subscriptionPaymentId: number) => {
    const data = await api.post('/financials/subscription/verify', { subscriptionPaymentId });
    if (data.status === 'paid') {
      await refreshProfile();
    }
    return { status: data.status };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        clinic,
        maintenanceMessage,
        subscription,
        suspended,
        isAuthenticated: !!user,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        onboardClinic,
        renewSubscription,
        pollSubscriptionStatus,
        activateFreePlan,
        refreshProfile,
        setPassword
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
