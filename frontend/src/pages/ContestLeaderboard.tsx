import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Radio } from 'lucide-react';
import {
  fetchContest,
  fetchLeaderboard,
  fetchMyLeaderboardRank,
  streamLeaderboard,
  type ContestDetail,
  type LeaderboardStanding,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function ContestLeaderboard() {
  const { slug } = useParams<{ slug: string }>();
  const { isLoggedIn } = useAuth();
  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [standings, setStandings] = useState<LeaderboardStanding[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const stopStreamRef = useRef<(() => void) | null>(null);

  const loadLeaderboard = useCallback(async () => {
    if (!slug) return;
    const [lb, mine] = await Promise.all([
      fetchLeaderboard(slug),
      isLoggedIn ? fetchMyLeaderboardRank(slug).catch(() => ({ rank: null, standing: null })) : Promise.resolve({ rank: null, standing: null }),
    ]);
    setStandings(lb.standings);
    setMyRank(mine.rank);
  }, [slug, isLoggedIn]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');
    Promise.all([fetchContest(slug), loadLeaderboard()])
      .then(([c]) => setContest(c))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load leaderboard'))
      .finally(() => setLoading(false));
  }, [slug, loadLeaderboard]);

  useEffect(() => {
    if (!slug || !isLoggedIn) return;
    stopStreamRef.current?.();
    stopStreamRef.current = streamLeaderboard(
      slug,
      () => {
        setLive(true);
        loadLeaderboard().catch(() => {});
      },
      () => setLive(false),
    );
    return () => stopStreamRef.current?.();
  }, [slug, isLoggedIn, loadLeaderboard]);

  if (loading) {
    return (
      <div className="page-container center-cell" style={{ padding: '4rem' }}>
        <Loader2 className="animate-spin text-muted" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container fade-in">
        <Link to={slug ? `/contests/${slug}` : '/contests'} className="btn btn-outline btn-sm" style={{ marginBottom: '1.5rem' }}>
          <ArrowLeft size={14} /> Back
        </Link>
        <div className="glass-panel center-cell text-muted" style={{ padding: '3rem' }}>{error}</div>
      </div>
    );
  }

  const isIcpc = contest?.scoringMode === 'icpc';

  return (
    <div className="page-container fade-in">
      <Link to={`/contests/${slug}`} className="btn btn-outline btn-sm" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={14} /> Back to contest
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">{contest?.title} — Leaderboard</h1>
          {myRank != null && <p className="text-muted">Your rank: #{myRank}</p>}
        </div>
        {isLoggedIn && (
          <span className={`badge ${live ? 'badge-success' : 'badge-muted'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Radio size={12} /> {live ? 'Live' : 'Polling'}
          </span>
        )}
      </div>

      <div className="table-container glass-panel">
        <table className="problem-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Rank</th>
              <th>User</th>
              {isIcpc ? (
                <>
                  <th style={{ width: '100px' }}>Solved</th>
                  <th style={{ width: '120px' }}>Penalty</th>
                </>
              ) : (
                <th style={{ width: '120px' }}>Points</th>
              )}
            </tr>
          </thead>
          <tbody>
            {standings.length === 0 ? (
              <tr>
                <td colSpan={isIcpc ? 4 : 3} className="center-cell text-muted">
                  No standings yet. Solve problems to appear here.
                </td>
              </tr>
            ) : (
              standings.map((s, idx) => (
                <tr key={s._id} className="table-row">
                  <td className="center-cell font-medium">#{idx + 1}</td>
                  <td>
                    <Link to={`/users/${s.userId.username}`} className="problem-link">
                      {s.userId.username}
                    </Link>
                  </td>
                  {isIcpc ? (
                    <>
                      <td className="center-cell">{s.solvedCount}</td>
                      <td className="center-cell">{s.penaltyMinutes}</td>
                    </>
                  ) : (
                    <td className="center-cell">{s.totalPoints}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
