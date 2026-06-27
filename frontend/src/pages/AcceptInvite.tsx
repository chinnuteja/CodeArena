import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, UserPlus } from 'lucide-react';
import { acceptContestInvite } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isLoggedIn, openAuthModal } = useAuth();
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const t = searchParams.get('token');
    if (t) setToken(t);
  }, [searchParams]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      openAuthModal('login');
      return;
    }
    if (!token.trim()) {
      setError('Invite token is required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await acceptContestInvite(token.trim());
      setSuccess(result.message);
      setTimeout(() => navigate(`/contests/${result.contest.slug}`), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container fade-in" style={{ maxWidth: '480px', margin: '0 auto' }}>
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h1 className="page-title" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Join Contest</h1>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>Enter an invite token to join a friendly contest.</p>

        <form onSubmit={handleAccept} className="auth-modal-form">
          <label>
            Invite token
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste invite token" required />
          </label>
          {error && <p className="auth-modal-error">{error}</p>}
          {success && <p className="profile-modal-success">{success}</p>}
          <button type="submit" className="btn btn-primary auth-modal-submit" disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
            Accept invite
          </button>
        </form>

        <p className="auth-modal-switch">
          <Link to="/contests">Back to contests</Link>
        </p>
      </div>
    </div>
  );
}
