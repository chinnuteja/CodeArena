import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isStaffRole } from '../lib/api';
import type { ReactNode } from 'react';

export default function StaffRoute({ children }: { children: ReactNode }) {
  const { user, loading, isLoggedIn } = useAuth();

  if (loading) return null;
  if (!isLoggedIn || !isStaffRole(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
