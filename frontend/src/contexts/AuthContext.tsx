import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'secretary' | 'pharmacist' | 'lab_tech' | 'manager';
}

export interface Clinic {
  id: number;
  name: string;
  address: string;
  phone: string;
  logo: string;
  subscription_status: 'active' | 'expired' | 'trial';
  subscription_expires_at: string;
  settings?: any;
}

interface AuthContextType {
  user: User | null;
  clinic: Clinic | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  register: (clinicName: string, adminName: string, email: string, password: string, phone: string) => Promise<void>;
  logout: () => void;
  onboardClinic: (address: string, phone: string, staff: any[], modules: string[]) => Promise<void>;
  renewSubscription: (provider: string, phone: string, months: number, plan: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshProfile = async () => {
    const token = localStorage.getItem('mediclinic_token');
    if (!token) {
      setUser(null);
      setClinic(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setClinic(data.clinic);
    } catch (error) {
      console.error("Token verification failed. Logging out.", error);
      localStorage.removeItem('mediclinic_token');
      setUser(null);
      setClinic(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProfile();
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

  const renewSubscription = async (provider: string, phone: string, months: number, plan: string) => {
    try {
      const data = await api.post('/financials/subscription-pay', {
        provider,
        phoneNumber: phone,
        months,
        plan
      });
      if (data.success) {
        setClinic(data.clinic);
      }
    } catch (err) {
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        clinic,
        isAuthenticated: !!user,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        onboardClinic,
        renewSubscription,
        refreshProfile
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
