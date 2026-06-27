import { useEffect, useState } from 'react';
import { X, Loader2, Settings } from 'lucide-react';
import { changePassword, fetchMe, updateProfile, type UserProfile } from '../lib/api';
import { getAccessToken } from '../lib/auth';
import { useAuth } from '../context/AuthContext';

type Tab = 'profile' | 'password';

export default function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout, onAuthSuccess } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab('profile');
    setError('');
    setSuccess('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setLoading(true);
    fetchMe()
      .then((me) => {
        setProfile(me);
        setFullName(me.fullName ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const updated = await updateProfile({ fullName: fullName.trim() || undefined });
      setProfile(updated);
      onAuthSuccess(getAccessToken() || '', updated);
      setSuccess('Profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      onClose();
      await logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h2>
            <Settings size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Settings
          </h2>
          <button type="button" className="lc-icon-btn-small" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="profile-modal-tabs">
          <button
            type="button"
            className={tab === 'profile' ? 'profile-tab active' : 'profile-tab'}
            onClick={() => { setTab('profile'); setError(''); setSuccess(''); }}
          >
            Profile
          </button>
          <button
            type="button"
            className={tab === 'password' ? 'profile-tab active' : 'profile-tab'}
            onClick={() => { setTab('password'); setError(''); setSuccess(''); }}
          >
            Password
          </button>
        </div>

        {loading && !profile && tab === 'profile' ? (
          <div className="center-cell" style={{ padding: '2rem' }}>
            <Loader2 size={24} className="animate-spin text-muted" />
          </div>
        ) : tab === 'profile' ? (
          <form onSubmit={handleProfileSave} className="auth-modal-form">
            <label>
              Username
              <input value={profile?.username ?? ''} disabled />
            </label>
            <label>
              Email
              <input value={profile?.email ?? ''} disabled />
            </label>
            <label>
              Full name
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Optional display name"
              />
            </label>
            {profile?.role && (
              <label>
                Role
                <input value={profile.role} disabled />
              </label>
            )}
            {profile?.rating != null && (
              <label>
                Rating
                <input value={String(profile.rating)} disabled />
              </label>
            )}

            {error && <p className="auth-modal-error">{error}</p>}
            {success && <p className="profile-modal-success">{success}</p>}

            <button type="submit" className="btn btn-primary auth-modal-submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Save changes'}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordChange} className="auth-modal-form">
            <label>
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>

            {error && <p className="auth-modal-error">{error}</p>}

            <button type="submit" className="btn btn-primary auth-modal-submit" disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Change password'}
            </button>
            <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
              You will be signed out after changing your password.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
