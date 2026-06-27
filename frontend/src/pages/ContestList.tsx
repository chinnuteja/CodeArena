import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Timer, ArrowRight, Loader2, Calendar } from 'lucide-react';
import { fetchContests, type Contest } from '../lib/api';

function contestStatus(contest: Contest): 'upcoming' | 'live' | 'ended' {
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
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${fmt.format(new Date(startAt))} – ${fmt.format(new Date(endAt))}`;
}

export default function ContestList() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchContests()
      .then((res) => setContests(res.contests))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load contests'))
      .finally(() => setLoading(false));
  }, []);

  const live = contests.filter((c) => contestStatus(c) === 'live');
  const upcoming = contests.filter((c) => contestStatus(c) === 'upcoming');
  const ended = contests.filter((c) => contestStatus(c) === 'ended');

  return (
    <div className="page-container fade-in">
      <div className="header-section text-center" style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto 4rem auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <Trophy color="var(--warning)" size={48} />
        </div>
        <h1 className="page-title">Contests</h1>
        <p className="page-subtitle">Compete in timed events and track your contest performance.</p>
      </div>

      {loading ? (
        <div className="center-cell" style={{ padding: '3rem' }}>
          <Loader2 className="animate-spin text-muted" size={32} />
        </div>
      ) : error ? (
        <div className="glass-panel center-cell text-muted" style={{ padding: '3rem' }}>{error}</div>
      ) : contests.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', border: '1px dashed var(--border-subtle)' }}>
          <Timer size={32} color="var(--text-muted)" style={{ margin: '0 auto 1rem auto' }} />
          <h2 style={{ marginBottom: '1rem' }}>No Contests Yet</h2>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>
            No contests have been scheduled. Practice in the Problem Archive while you wait.
          </p>
          <Link to="/problems" className="btn btn-primary">
            Practice Problems <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {live.length > 0 && <ContestSection title="Live Now" contests={live} badgeClass="badge-success" badge="LIVE" />}
          {upcoming.length > 0 && <ContestSection title="Upcoming" contests={upcoming} badgeClass="badge-warning" badge="UPCOMING" />}
          {ended.length > 0 && <ContestSection title="Past Contests" contests={ended} badgeClass="badge-muted" badge="ENDED" />}
        </div>
      )}
    </div>
  );
}

function ContestSection({
  title,
  contests,
  badge,
  badgeClass,
}: {
  title: string;
  contests: Contest[];
  badge: string;
  badgeClass: string;
}) {
  return (
    <section>
      <h2 style={{ marginBottom: '1rem' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {contests.map((contest) => (
          <Link key={contest._id} to={`/contests/${contest.slug}`} className="glass-panel contest-card contest-card-link">
            <div className="contest-card-header">
              <div>
                <h3>{contest.title}</h3>
                {contest.description && <p className="text-muted contest-card-desc">{contest.description}</p>}
              </div>
              <span className={`badge ${badgeClass}`}>{badge}</span>
            </div>
            <div className="contest-card-meta">
              <Calendar size={14} />
              <span>{formatDateRange(contest.startAt, contest.endAt)}</span>
              <span className="text-muted">· {contest.scoringMode.toUpperCase()}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
