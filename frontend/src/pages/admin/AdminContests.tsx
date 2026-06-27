import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { createContest, fetchContests, fetchProblems, type Contest } from '../../lib/api';

export default function AdminContests() {
  const [contests, setContests] = useState<Contest[]>([]);
  const [problems, setProblems] = useState<Array<{ _id: string; title: string; slug: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    kind: 'global' as 'global' | 'friendly',
    scoringMode: 'icpc' as 'icpc' | 'ioi',
    startAt: '',
    endAt: '',
    problemIds: [] as string[],
  });

  useEffect(() => {
    Promise.all([
      fetchContests().then((r) => setContests(r.contests)),
      fetchProblems().then((ps) => setProblems(ps as Array<{ _id: string; title: string; slug: string }>)),
    ])
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await createContest({
        ...form,
        problemIds: form.problemIds,
      });
      const res = await fetchContests();
      setContests(res.contests);
      setShowCreate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const toggleProblem = (id: string) => {
    setForm((f) => ({
      ...f,
      problemIds: f.problemIds.includes(id) ? f.problemIds.filter((x) => x !== id) : [...f.problemIds, id],
    }));
  };

  return (
    <div className="page-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="page-title">Admin — Contests</h1>
          <p className="page-subtitle">Create and manage contests.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} /> New contest
        </button>
      </div>

      {error && <p className="auth-modal-error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {showCreate && (
        <form onSubmit={handleCreate} className="glass-panel auth-modal-form" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <label>Title <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></label>
          <label>Slug <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} pattern="[a-z0-9-]+" required /></label>
          <label>Description <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label>
            Kind
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'global' | 'friendly' })} style={{ background: '#1e1e1e', border: '1px solid #444', borderRadius: 4, padding: '0.5rem', color: '#eff1f6' }}>
              <option value="global">Global</option>
              <option value="friendly">Friendly</option>
            </select>
          </label>
          <label>
            Scoring
            <select value={form.scoringMode} onChange={(e) => setForm({ ...form, scoringMode: e.target.value as 'icpc' | 'ioi' })} style={{ background: '#1e1e1e', border: '1px solid #444', borderRadius: 4, padding: '0.5rem', color: '#eff1f6' }}>
              <option value="icpc">ICPC</option>
              <option value="ioi">IOI</option>
            </select>
          </label>
          <label>Start <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} required /></label>
          <label>End <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} required /></label>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#9e9e9e' }}>Problems</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
              {problems.map((p) => (
                <label key={p.slug} style={{ flexDirection: 'row', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={form.problemIds.includes(p._id)} onChange={() => toggleProblem(p._id)} />
                  {p.title}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? <Loader2 size={16} className="animate-spin" /> : 'Create contest'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="center-cell"><Loader2 className="animate-spin" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {contests.map((c) => (
            <div key={c._id} className="glass-panel contest-card">
              <div className="contest-card-header">
                <div>
                  <h3><Link to={`/contests/${c.slug}`}>{c.title}</Link></h3>
                  <p className="text-muted contest-card-desc">{c.slug}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
