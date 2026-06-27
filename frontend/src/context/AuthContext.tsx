import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearAccessToken, getAccessToken, setAccessToken } from '../lib/auth';
import { fetchMe, logout as apiLogout, refreshAccessToken, type UserProfile } from '../lib/api';

type User = Pick<UserProfile, 'id' | 'username'> & Partial<Pick<UserProfile, 'email' | 'role' | 'rating' | 'fullName'>>;

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isLoggedIn: boolean;
  authModalOpen: boolean;
  authModalMode: 'login' | 'register';
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
  onAuthSuccess: (accessToken: string, user: User) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    async function restoreSession() {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        setUser(await fetchMe());
      } catch {
        try {
          const { accessToken } = await refreshAccessToken();
          setAccessToken(accessToken);
          setUser(await fetchMe());
        } catch {
          clearAccessToken();
        }
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  const openAuthModal = useCallback((mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  const onAuthSuccess = useCallback((accessToken: string, nextUser: User) => {
    setAccessToken(accessToken);
    setUser(nextUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // clear local session even if request fails
    }
    clearAccessToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoggedIn: !!user,
        authModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        onAuthSuccess,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
