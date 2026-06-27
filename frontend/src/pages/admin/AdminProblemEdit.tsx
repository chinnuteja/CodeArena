import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  createTestCase,
  deleteTestCase,
  fetchProblem,
  fetchTestCases,
  updateProblem,
  updateTestCase,
  type TestCaseItem,
} from '../../lib/api';

export default function AdminProblemEdit() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [title, setTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [testcases, setTestcases] = useState<TestCaseItem[]>([]);
  const [newTc, setNewTc] = useState({ input: '', expectedOutput: '', isSample: false });

  const load = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const [problem, tcs] = await Promise.all([fetchProblem(slug), fetchTestCases(slug)]);
      setTitle(problem.title);
      setStatement(problem.statement);
      setDifficulty(problem.difficulty);
      setTestcases(tcs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [slug]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await updateProblem(slug, { title, statement, difficulty });
      setSuccess('Problem saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTestcase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setSaving(true);
    setError('');
    try {
      const tc = await createTestCase(slug, newTc);
      setTestcases((prev) => [...prev, tc]);
      setNewTc({ input: '', expectedOutput: '', isSample: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add testcase');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTc = async (id: string) => {
    if (!slug || !confirm('Delete this test case?')) return;
    try {
      await deleteTestCase(slug, id);
      setTestcases((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const toggleSample = async (tc: TestCaseItem) => {
    if (!slug) return;
    try {
      const updated = await updateTestCase(slug, tc._id, { isSample: !tc.isSample });
      setTestcases((prev) => prev.map((t) => (t._id === tc._id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  if (loading) {
    return <div className="page-container center-cell" style={{ padding: '4rem' }}><Loader2 className="animate-spin" size={32} /></div>;
  }

  return (
    <div className="page-container fade-in">
      <Link to="/admin/problems" className="btn btn-outline btn-sm" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={14} /> Back
      </Link>

      <h1 className="page-title">Edit: {slug}</h1>
      {error && <p className="auth-modal-error">{error}</p>}
      {success && <p className="profile-modal-success">{success}</p>}

      <form onSubmit={handleSave} className="glass-panel auth-modal-form" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <label>Title <input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label>
          Difficulty
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
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
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            rows={6}
            style={{ background: '#1e1e1e', border: '1px solid #444', borderRadius: 4, padding: '0.5rem', color: '#eff1f6', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save problem'}
        </button>
      </form>

      <h2 style={{ marginBottom: '1rem' }}>Test cases</h2>

      <form onSubmit={handleAddTestcase} className="glass-panel auth-modal-form" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <label>
          Input
          <textarea
            value={newTc.input}
            onChange={(e) => setNewTc({ ...newTc, input: e.target.value })}
            rows={3}
            required
            style={{ background: '#1e1e1e', border: '1px solid #444', borderRadius: 4, padding: '0.5rem', color: '#eff1f6', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
          />
        </label>
        <label>
          Expected output
          <textarea
            value={newTc.expectedOutput}
            onChange={(e) => setNewTc({ ...newTc, expectedOutput: e.target.value })}
            rows={3}
            required
            style={{ background: '#1e1e1e', border: '1px solid #444', borderRadius: 4, padding: '0.5rem', color: '#eff1f6', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
          />
        </label>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <input type="checkbox" checked={newTc.isSample} onChange={(e) => setNewTc({ ...newTc, isSample: e.target.checked })} />
          Sample test case
        </label>
        <button type="submit" className="btn btn-outline" disabled={saving}>
          <Plus size={14} /> Add test case
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {testcases.map((tc, idx) => (
          <div key={tc._id} className="glass-panel" style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <strong>#{idx + 1} {tc.isSample && <span className="badge badge-warning">Sample</span>}</strong>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => toggleSample(tc)}>
                  {tc.isSample ? 'Unmark sample' : 'Mark sample'}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => handleDeleteTc(tc._id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <pre style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
              IN: {tc.input}{'\n'}OUT: {tc.expectedOutput}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
