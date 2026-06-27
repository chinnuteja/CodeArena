import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { fetchProblems } from '../lib/api';

function formatDifficulty(value: string) {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function difficultyClass(value: string) {
  const d = value.toLowerCase();
  if (d === 'easy') return 'badge-success';
  if (d === 'medium') return 'badge-warning';
  return 'badge-error';
}

export default function ProblemList() {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [problems, setProblems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProblems()
      .then(setProblems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load problems'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container fade-in">
      <div className="header-section">
        <h1 className="page-title">Problem Archive</h1>
        <p className="page-subtitle">Master your algorithmic skills. Solve problems and submit for instant judging.</p>
        <div className="stats-row mt-4">
          <div className="stat-card glass-panel">
            <CheckCircle2 color="var(--success)" />
            <div>
              <div className="stat-value">{problems.length}</div>
              <div className="stat-label">Problems Available</div>
            </div>
          </div>
        </div>
      </div>

      <div className="table-container glass-panel mt-8">
        <table className="problem-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>Status</th>
              <th>Title</th>
              <th style={{ width: '120px' }}>Difficulty</th>
              <th style={{ width: '100px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="center-cell">
                  <Loader2 className="animate-spin text-muted" /> Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={4} className="center-cell text-muted">{error}</td>
              </tr>
            ) : problems.length === 0 ? (
              <tr>
                <td colSpan={4} className="center-cell text-muted">
                  No problems found. Run <code>npx tsx seed.ts</code> in the backend folder.
                </td>
              </tr>
            ) : (
              problems.map((p) => (
                <tr
                  key={p.slug}
                  onMouseEnter={() => setHoveredRow(p.slug)}
                  onMouseLeave={() => setHoveredRow(null)}
                  className="table-row"
                >
                  <td className="center-cell">
                    {p.solved ? (
                      <CheckCircle2 color="var(--success)" size={20} />
                    ) : (
                      <Circle color="var(--border-subtle)" size={20} />
                    )}
                  </td>
                  <td className="font-medium">
                    <Link to={`/workspace/${p.slug}`} className="problem-link">
                      {p.title}
                    </Link>
                  </td>
                  <td>
                    <span className={`badge ${difficultyClass(p.difficulty)}`}>
                      {formatDifficulty(p.difficulty)}
                    </span>
                  </td>
                  <td>
                    <Link to={`/workspace/${p.slug}`}>
                      <button className={`btn ${hoveredRow === p.slug ? 'btn-primary' : 'btn-outline'} btn-sm`}>
                        <Play size={14} /> Solve
                      </button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
