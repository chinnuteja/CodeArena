import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Code2, Trophy, Terminal, User, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isStaffRole } from '../lib/api';
import ProfileModal from './ProfileModal';

export default function Navbar() {
  const { user, isLoggedIn, openAuthModal, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <nav style={navStyle} className="glass-panel">
      <div style={logoContainerStyle}>
        <Terminal color="var(--primary)" size={28} />
        <Link to="/" style={logoTextStyle}>CodeArena</Link>
      </div>

      <div style={linksContainerStyle}>
        <Link to="/problems" style={linkStyle}>
          <Code2 size={18} /> Problems
        </Link>
        <Link to="/contests" style={linkStyle}>
          <Trophy size={18} /> Contests
        </Link>
        {isLoggedIn && isStaffRole(user?.role) && (
          <>
            <Link to="/admin/problems" style={linkStyle}>
              <Shield size={18} /> Admin
            </Link>
          </>
        )}
      </div>

      <div style={authContainerStyle}>
        {isLoggedIn && user ? (
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setProfileOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <User size={16} />
              <Link to={`/users/${user.username}`} style={{ color: 'inherit' }} onClick={(e) => e.stopPropagation()}>
                {user.username}
              </Link>
            </button>
            <button className="btn btn-outline" onClick={() => logout()} title="Log out">
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-outline" onClick={() => openAuthModal('login')}>
              Login
            </button>
            <button className="btn btn-primary" onClick={() => openAuthModal('register')}>
              Sign Up
            </button>
          </>
        )}
      </div>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </nav>
  );
}

const navStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem 2rem',
  margin: '1rem 2rem',
  position: 'sticky' as const,
  top: '1rem',
  zIndex: 100,
};

const logoContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
};

const logoTextStyle = {
  fontSize: '1.25rem',
  fontWeight: 700,
  fontFamily: 'var(--font-display)',
  color: 'var(--text-main)',
  letterSpacing: '-0.02em',
};

const linksContainerStyle = {
  display: 'flex',
  gap: '2rem',
};

const linkStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  color: 'var(--text-muted)',
  fontWeight: 500,
  fontSize: '0.95rem',
};

const authContainerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
};
