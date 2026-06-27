import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, User } from 'lucide-react';
import { fetchPublicProfile, type PublicUserProfile } from '../lib/api';

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    fetchPublicProfile(username)
      .then(setProfile)
      .catch((err) => setError(err instanceof Error ? err.message : 'User not found'))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="page-container center-cell" style={{ padding: '4rem' }}>
        <Loader2 className="animate-spin text-muted" size={32} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="page-container fade-in">
        <Link to="/" className="btn btn-outline btn-sm" style={{ marginBottom: '1.5rem' }}>
          <ArrowLeft size={14} /> Home
        </Link>
        <div className="glass-panel center-cell text-muted" style={{ padding: '3rem' }}>{error || 'User not found'}</div>
      </div>
    );
  }

  const joined = profile.createdAt
    ? new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(profile.createdAt))
    : null;

  return (
    <div className="page-container fade-in">
      <Link to="/" className="btn btn-outline btn-sm" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={14} /> Home
      </Link>

      <div className="glass-panel" style={{ padding: '2rem', maxWidth: '480px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-surface-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <User size={28} color="var(--primary)" />
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0, fontSize: '1.5rem' }}>{profile.username}</h1>
            {profile.fullName && <p className="text-muted" style={{ margin: 0 }}>{profile.fullName}</p>}
          </div>
        </div>

        <div className="stats-row">
          {profile.rating != null && (
            <div className="stat-card glass-panel" style={{ flex: 1 }}>
              <div>
                <div className="stat-value">{profile.rating}</div>
                <div className="stat-label">Rating</div>
              </div>
            </div>
          )}
          {joined && (
            <div className="stat-card glass-panel" style={{ flex: 1 }}>
              <div>
                <div className="stat-value" style={{ fontSize: '1rem' }}>{joined}</div>
                <div className="stat-label">Joined</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
