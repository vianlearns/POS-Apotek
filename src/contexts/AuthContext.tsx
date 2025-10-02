import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { API_BASE } from '../config/api';

interface LocalUserProfile {
  id: string;
  username: string;
  name?: string;
  role: 'admin' | 'apoteker' | 'kasir';
}

interface AuthContextType {
  user: { id: string; username: string } | null;
  userProfile: LocalUserProfile | null;
  session: null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: any } | { error: null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [userProfile, setUserProfile] = useState<LocalUserProfile | null>(null);
  const [session, setSession] = useState<null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Inisialisasi backend lokal (membuat DB bila belum ada)
    fetch(`${API_BASE}/init`).catch(() => {});

    // Coba pulihkan sesi lokal dari localStorage
    const raw = localStorage.getItem('hf_local_user');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUser({ id: parsed.id, username: parsed.username });
        setUserProfile(parsed as LocalUserProfile);
      } catch {}
    }
    setLoading(false);
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const resp = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        return { error: { message: data.error || 'Login gagal' } };
      }
      const profile: LocalUserProfile = {
        id: data.user.id,
        username: data.user.username,
        name: data.user.name,
        role: data.user.role,
      };
      setUser({ id: profile.id, username: profile.username });
      setUserProfile(profile);
      localStorage.setItem('hf_local_user', JSON.stringify(profile));
      return { error: null };
    } catch (error: any) {
      console.error('Login error:', error);
      return { error: { message: 'Terjadi kesalahan saat login' } };
    }
  };


  const signOut = async () => {
    setUser(null);
    setUserProfile(null);
    setSession(null);
    localStorage.removeItem('hf_local_user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      session,
      loading,
      signIn,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};