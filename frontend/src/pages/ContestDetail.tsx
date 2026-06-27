import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Loader2, Trophy, UserPlus, BarChart3 } from 'lucide-react';
import {
  fetchContest,
  fetchMyContestRegistration,
  registerForContest,
  createContestInvite,
  isStaffRole,
  type ContestDetail as ContestDetailType,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';

function contestStatus(contest: ContestDetailType): 'upcoming' | 'live' | 'ended' {
  const now = Date.now();
  const start = new Date(contest.startAt).getTime();
  const end = new Date(contest.endAt).getTime();
  if (now < start) return 'upcoming';
  if (now >= start && now < end) return 'live';
  return 'ended';
}

function formatDateRange(startAt: string, endAt: string) {
  const fmt = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${fmt.format(new Date(startAt))} – ${fmt.format(new Date(endAt))}`;
}

export default function ContestDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { isLoggedIn, user, openAuthModal } = useAuth();
  const [contest, setContest] = useState<ContestDetailType | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');
    fetchContest(slug)
      .then(setContest)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load contest'))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!slug || !isLoggedIn) {
      setIsRegistered(false);
      return;
    }
    fetchMyContestRegistration(slug)
      .then((res) => setIsRegistered(res.isRegistered))
      .catch(() => setIsRegistered(false));
  }, [slug, isLoggedIn]);

  const handleRegister = async () => {
    if (!slug) return;
    if (!isLoggedIn) {
      openAuthModal('login');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await registerForContest(slug);
      setIsRegistered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!slug) return;
    setActionLoading(true);
    setError('');
    try {
      const token = await createContestInvite(slug);
      setInviteToken(token);
      setInviteCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container center-cell" style={{ padding: '4rem' }}>
        <Loader2 className="animate-spin text-muted" size={32} />
      </div>
    );
  }

  if (error && !contest) {
    return (
      <div className="page-container fade-in">
        <Link to="/contests" className="btn btn-outline btn-sm" style={{ marginBottom: '1.5rem' }}>
          <ArrowLeft size={14} /> Back to contests
        </Link>
        <div className="glass-panel center-cell text-muted" style={{ padding: '3rem' }}>{error}</div>
      </div>
    );
  }

  if (!contest) return null;

  const status = contestStatus(contest);
  const canRegister = contest.kind === 'global' && status !== 'ended' && !isRegistered;
  const staff = isStaffRole(user?.role);

  return (
    <div className="page-container fade-in">
      <Link to="/contests" className="btn btn-outline btn-sm" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={14} /> Back to contests
      </Link>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Trophy color="var(--warning)" size={28} />
              <h1 className="page-title" style={{ margin: 0 }}>{contest.title}</h1>
            </div>
            {contest.description && <p className="text-muted" style={{ marginTop: '0.5rem' }}>{contest.description}</p>}
          </div>
          <span className={`badge ${status === 'live' ? 'badge-success' : status === 'upcoming' ? 'badge-warning' : 'badge-muted'}`}>
            {status.toUpperCase()}
          </span>
        </div>

        <div className="contest-card-meta" style={{ marginTop: '1.25rem' }}>
          <Calendar size={14} />
          <span>{formatDateRange(contest.startAt, contest.endAt)}</span>
          <span className="text-muted">· {contest.scoringMode.toUpperCase()}</span>
          <span className="text-muted">· {contest.kind}</span>
        </div>

        {error && <p className="auth-modal-error" style={{ marginTop: '1rem' }}>{error}</p>}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          {canRegister && (
            <button type="button" className="btn btn-primary" onClick={handleRegister} disabled={actionLoading}>
              {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
              Register
            </button>
          )}
          {isRegistered && (
            <span className="badge badge-success">Registered</span>
          )}
          <Link to={`/contests/${slug}/leaderboard`} className="btn btn-outline">
            <BarChart3 size={16} /> Leaderboard
          </Link>
          {staff && (
            <Link to="/admin/contests" className="btn btn-outline">Manage contests</Link>
          )}
        </div>

        {staff && contest.kind === 'friendly' && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleCreateInvite} disabled={actionLoading}>
              Generate invite link
            </button>
            {inviteToken && (
              <div style={{ marginTop: '0.75rem' }}>
                <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                  {window.location.origin}/contests/invite?token={inviteToken}
                </code>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ marginLeft: '0.5rem' }}
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/contests/invite?token=${inviteToken}`);
                    setInviteCopied(true);
                  }}
                >
                  {inviteCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <section>
        <h2 style={{ marginBottom: '1rem' }}>Problems</h2>
        {contest.problemIds.length === 0 ? (
          <div className="glass-panel text-muted" style={{ padding: '2rem', textAlign: 'center' }}>
            No problems assigned to this contest yet.
          </div>
        ) : (
          <div className="table-container glass-panel">
            <table className="problem-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>#</th>
                  <th>Title</th>
                  <th style={{ width: '120px' }}>Difficulty</th>
                  <th style={{ width: '100px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {contest.problemIds.map((problem, idx) => (
                  <tr key={problem._id} className="table-row">
                    <td className="center-cell text-muted">{String.fromCharCode(65 + idx)}</td>
                    <td className="font-medium">
                      <Link
                        to={`/workspace/${problem.slug}?contestId=${contest._id}`}
                        className="problem-link"
                      >
                        {problem.title}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge badge-${problem.difficulty === 'easy' ? 'success' : problem.difficulty === 'medium' ? 'warning' : 'error'}`}>
                        {problem.difficulty}
                      </span>
                    </td>
                    <td>
                      <Link to={`/workspace/${problem.slug}?contestId=${contest._id}`} className="btn btn-outline btn-sm">
                        Solve
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
