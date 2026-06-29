import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isStaffRole } from '../lib/api';
import type { ReactNode } from 'react';

export default function StaffRoute({ children }: { children: ReactNode }) {
  const { user, loading, isLoggedIn } = useAuth();

  if (loading) {
    return (
      <div className="page-container center-cell" style={{ minHeight: '40vh' }}>
        <Loader2 className="animate-spin text-muted" size={32} />
      </div>
    );
  }

  if (!isLoggedIn || !isStaffRole(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
