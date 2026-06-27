import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { createProblem, deleteProblem, fetchProblems } from '../../lib/api';

export default function AdminProblems() {
  const [problems, setProblems] = useState<Array<{ slug: string; title: string; difficulty: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ title: string; statement: string; difficulty: 'easy' | 'medium' | 'hard' }>({
    title: '',
    statement: '<p>Problem statement</p>',
    difficulty: 'easy',
  });

  const load = () => {
    setLoading(true);
    fetchProblems()
      .then(setProblems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const created = await createProblem(form);
      setShowCreate(false);
      setForm({ title: '', statement: '<p>Problem statement</p>', difficulty: 'easy' });
      window.location.href = `/admin/problems/${created.slug}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!confirm(`Delete problem "${slug}"?`)) return;
    try {
      await deleteProblem(slug);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="page-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Admin — Problems</h1>
          <p className="page-subtitle">Create and manage problems and test cases. <Link to="/admin/contests">Manage contests</Link></p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} /> New problem
        </button>
      </div>

      {error && <p className="auth-modal-error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {showCreate && (
        <form onSubmit={handleCreate} className="glass-panel auth-modal-form" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <label>
            Title
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          <label>
            Difficulty
            <select
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })}
              style={{ background: '#1e1e1e', border: '1px solid #444', borderRadius: 4, padding: '0.5rem', color: '#eff1f6' }}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label>
            Statement (HTML)
            <textarea
              value={form.statement}
              onChange={(e) => setForm({ ...form, statement: e.target.value })}
              rows={4}
              style={{ background: '#1e1e1e', border: '1px solid #444', borderRadius: 4, padding: '0.5rem', color: '#eff1f6', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? <Loader2 size={16} className="animate-spin" /> : 'Create'}
          </button>
        </form>
      )}

      <div className="table-container glass-panel">
        <table className="problem-table">
          <thead>
            <tr>
              <th>Title</th>
              <th style={{ width: '120px' }}>Difficulty</th>
              <th style={{ width: '140px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="center-cell"><Loader2 className="animate-spin" /></td></tr>
            ) : problems.map((p) => (
              <tr key={p.slug} className="table-row">
                <td>{p.title}</td>
                <td><span className="badge badge-muted">{p.difficulty}</span></td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <Link to={`/admin/problems/${p.slug}`} className="btn btn-outline btn-sm"><Pencil size={14} /></Link>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => handleDelete(p.slug)}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
