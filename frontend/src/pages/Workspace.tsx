import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  Play,
  CloudUpload,
  Code2,
  RotateCcw,
  Maximize2,
  Minimize2,
  CheckSquare,
  Terminal as TerminalIcon,
  Loader2,
  ChevronLeft,
  ArrowLeft,
} from 'lucide-react';
import { fetchProblem, runCode, submitCode, streamVerdict, getSubmission, type VerdictUpdate } from '../lib/api';
import { codeStorageKey, getCodeTemplate } from '../lib/codeTemplates';
import { useAuth } from '../context/AuthContext';

type RunResult = {
  status: string;
  runtime: string;
  memory: string;
  output: string;
  input: string;
};

export default function Workspace() {
  const { problemSlug } = useParams();
  const [searchParams] = useSearchParams();
  const contestId = searchParams.get('contestId') ?? undefined;
  const { isLoggedIn, user, openAuthModal } = useAuth();
  const editorPaneRef = useRef<HTMLDivElement>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState(() => getCodeTemplate('python'));
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'testcase' | 'result'>('testcase');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runResults, setRunResults] = useState<RunResult[]>([]);
  const [submitResult, setSubmitResult] = useState<VerdictUpdate | null>(null);
  const [resultMode, setResultMode] = useState<'run' | 'submit'>('run');
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const [testcases, setTestcases] = useState<string[]>(['']);
  const [activeTestCaseIdx, setActiveTestCaseIdx] = useState(0);
  const [problem, setProblem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });

  const loadCodeForLanguage = useCallback(
    (lang: string) => {
      if (!problemSlug) return getCodeTemplate(lang);
      const saved = localStorage.getItem(codeStorageKey(problemSlug, lang));
      return saved ?? getCodeTemplate(lang, problemSlug);
    },
    [problemSlug],
  );

  useEffect(() => {
    if (!problemSlug) return;
    setCode(loadCodeForLanguage(language));
  }, [problemSlug, language, loadCodeForLanguage]);

  useEffect(() => {
    if (!problemSlug || !code) return;
    localStorage.setItem(codeStorageKey(problemSlug, language), code);
  }, [code, language, problemSlug]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    return () => stopStreamRef.current?.();
  }, []);

  useEffect(() => {
    if (!problemSlug) return;
    fetchProblem(problemSlug)
      .then((data) => {
        setProblem(data);
        const samples = data.sampleTestCases?.map((tc: { input: string }) => tc.input) ?? [''];
        setTestcases(samples.length ? samples : ['']);
        if (data.allowedLanguages?.length) {
          setLanguage((prev) =>
            data.allowedLanguages.includes(prev) ? prev : data.allowedLanguages[0],
          );
        }
      })
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : 'Failed to load problem'),
      )
      .finally(() => setLoading(false));
  }, [problemSlug]);

  const handleRunCode = async () => {
    if (!problemSlug) return;
    setConsoleOpen(true);
    setActiveConsoleTab('result');
    setResultMode('run');
    setIsRunning(true);
    setRunResults([]);
    setSubmitResult(null);
    setActiveResultIdx(0);

    const newResults: RunResult[] = [];
    for (const tc of testcases) {
      try {
        const res = await runCode(problemSlug, {
          language,
          source: code,
          input: tc.replace(/\\n/g, '\n'),
        });
        newResults.push({ ...res, input: tc });
      } catch (err) {
        newResults.push({
          status: 'Error',
          runtime: 'N/A',
          memory: 'N/A',
          output: err instanceof Error ? err.message : 'Run failed',
          input: tc,
        });
      }
    }
    setRunResults(newResults);
    setIsRunning(false);
  };

  const handleSubmit = async () => {
    if (!problemSlug) return;
    if (!isLoggedIn) {
      openAuthModal('login');
      return;
    }

    setConsoleOpen(true);
    setActiveConsoleTab('result');
    setResultMode('submit');
    setIsSubmitting(true);
    setSubmitResult(null);
    setCompileError(null);
    setRunResults([]);
    stopStreamRef.current?.();

    try {
      const { submissionId } = await submitCode({ problemSlug, language, source: code, contestId });
      setSubmitResult({ submissionId, status: 'PENDING', verdict: null });

      stopStreamRef.current = streamVerdict(
        submissionId,
        async (update) => {
          setSubmitResult(update);
          if (update.status === 'DONE' || update.status === 'SYSTEM_ERROR') {
            setIsSubmitting(false);
            if (update.verdict === 'CE') {
              try {
                const detail = await getSubmission(submissionId);
                setCompileError(detail.compileError ?? null);
              } catch {
                // ignore
              }
            }
          }
        },
        () => setIsSubmitting(false),
      );
    } catch (err) {
      setIsSubmitting(false);
      setSubmitResult({
        submissionId: '',
        status: 'SYSTEM_ERROR',
        verdict: null,
      });
      setRunResults([
        {
          status: 'Error',
          runtime: 'N/A',
          memory: 'N/A',
          output: err instanceof Error ? err.message : 'Submit failed',
          input: '',
        },
      ]);
      setResultMode('run');
    }
  };

  const handleReset = () => {
    const template = getCodeTemplate(language, problemSlug);
    setCode(template);
    if (problemSlug) {
      localStorage.removeItem(codeStorageKey(problemSlug, language));
    }
  };

  const toggleFullscreen = async () => {
    if (!editorPaneRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await editorPaneRef.current.requestFullscreen();
    }
  };

  const verdictLabel = (verdict: string | null) => {
    if (!verdict) return 'Pending';
    const labels: Record<string, string> = {
      AC: 'Accepted',
      WA: 'Wrong Answer',
      TLE: 'Time Limit Exceeded',
      MLE: 'Memory Limit Exceeded',
      RE: 'Runtime Error',
      CE: 'Compile Error',
    };
    return labels[verdict] ?? verdict;
  };

  const verdictColor = (verdict: string | null) => {
    if (verdict === 'AC') return 'var(--success)';
    if (!verdict) return '#9e9e9e';
    return 'var(--error)';
  };

  if (loading) {
    return (
      <div className="page-container center-cell">
        <Loader2 className="animate-spin text-muted" size={48} />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="page-container center-cell">
        <p className="text-muted">{loadError}</p>
        <Link to="/problems" className="btn btn-outline" style={{ marginTop: '1rem' }}>
          Back to problems
        </Link>
      </div>
    );
  }
  if (!problem) {
    return <div className="page-container center-cell">Problem not found.</div>;
  }

  return (
    <div className="lc-workspace fade-in">
      <div className="lc-navbar">
        <div className="lc-nav-left">
          <Link to="/problems" className="lc-icon-btn" title="Back to problems">
            <ArrowLeft size={16} />
          </Link>
          <button
            className="lc-icon-btn"
            onClick={handleRunCode}
            disabled={isRunning || isSubmitting}
            title="Run code"
          >
            {isRunning ? (
              <Loader2 size={16} className="animate-spin text-muted" />
            ) : (
              <Play size={16} color="var(--success)" />
            )}
          </button>
          <button
            className="lc-btn lc-btn-submit"
            onClick={handleSubmit}
            disabled={isRunning || isSubmitting}
            title="Submit solution"
          >
            {isSubmitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CloudUpload size={16} />
            )}
            Submit
          </button>
        </div>

        <div className="lc-nav-center lc-workspace-title">{problem.title}</div>

        <div className="lc-nav-right">
          {isLoggedIn && user ? (
            <span className="lc-workspace-user">{user.username}</span>
          ) : (
            <button className="lc-btn lc-btn-outline" onClick={() => openAuthModal('login')}>
              Log in
            </button>
          )}
        </div>
      </div>

      <div className="lc-workspace-content">
        <div className="lc-pane lc-left-pane">
          <div className="lc-pane-header">
            <div className="lc-tabs">
              <div className="lc-tab active">
                <Code2 size={14} /> Description
              </div>
            </div>
          </div>
          <div className="lc-pane-body problem-description">
            <div dangerouslySetInnerHTML={{ __html: problem.statement }} />
          </div>
        </div>

        <div className="lc-right-pane">
          <div className="lc-pane lc-editor-pane" ref={editorPaneRef}>
            <div className="lc-pane-header">
              <div className="lc-tabs">
                <div className="lc-tab active">
                  <Code2 size={14} color="var(--success)" /> Code
                </div>
              </div>
            </div>

            <div className="lc-editor-toolbar">
              <div className="lc-toolbar-left">
                <div className="lc-lang-select-wrapper">
                  <select
                    className="lc-lang-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    {(problem.allowedLanguages?.length
                      ? problem.allowedLanguages
                      : ['cpp', 'java', 'python']
                    ).map((lang: string) => (
                      <option key={lang} value={lang}>
                        {lang === 'cpp' ? 'C++' : lang === 'python' ? 'Python3' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="lc-toolbar-right">
                <button
                  className="lc-icon-btn-small"
                  onClick={handleReset}
                  title="Reset to template"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  className="lc-icon-btn-small"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen editor'}
                >
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
            </div>

            <div className="monaco-wrapper">
              <Editor
                height="100%"
                language={language === 'cpp' ? 'cpp' : language}
                theme="vs-dark"
                value={code}
                onChange={(value) => setCode(value || '')}
                onMount={(editor) => {
                  const updatePos = () => {
                    const pos = editor.getPosition();
                    if (pos) setCursorPos({ line: pos.lineNumber, column: pos.column });
                  };
                  editor.onDidChangeCursorPosition(updatePos);
                  updatePos();
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: 'var(--font-mono)',
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  roundedSelection: true,
                }}
              />
            </div>
            <div className="lc-editor-footer">
              <span className="text-muted">
                Ln {cursorPos.line}, Col {cursorPos.column}
              </span>
            </div>
          </div>

          {!isLoggedIn && (
            <div className="lc-auth-banner">
              <button type="button" className="lc-auth-banner-btn" onClick={() => openAuthModal('login')}>
                Log in or sign up to submit your solution
              </button>
            </div>
          )}

          <div className="lc-pane lc-console-pane" style={{ height: consoleOpen ? '40%' : '40px' }}>
            <div className="lc-pane-header" style={{ cursor: 'pointer' }}>
              <div
                className="lc-tabs"
                onClick={(e) => {
                  e.stopPropagation();
                  setConsoleOpen(true);
                }}
              >
                <div
                  className={`lc-tab ${activeConsoleTab === 'testcase' ? 'active' : ''}`}
                  onClick={() => setActiveConsoleTab('testcase')}
                >
                  <CheckSquare size={14} color="var(--success)" /> Testcase
                </div>
                <div
                  className={`lc-tab ${activeConsoleTab === 'result' ? 'active' : ''}`}
                  onClick={() => setActiveConsoleTab('result')}
                >
                  <TerminalIcon size={14} color="var(--success)" /> Test Result
                </div>
              </div>
              <ChevronLeft
                size={16}
                className="text-muted"
                onClick={() => setConsoleOpen(!consoleOpen)}
                style={{
                  transform: consoleOpen ? 'rotate(-90deg)' : 'rotate(90deg)',
                  transition: 'transform 0.2s',
                  marginRight: '1rem',
                }}
              />
            </div>
            {consoleOpen && (
              <div
                className="lc-pane-body lc-console-body"
                style={{ alignItems: 'flex-start', justifyContent: 'flex-start', padding: '1rem' }}
              >
                {activeConsoleTab === 'testcase' && (
                  <div className="testcase-tab" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      {testcases.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveTestCaseIdx(i)}
                          style={{
                            background: activeTestCaseIdx === i ? 'rgba(255,255,255,0.1)' : 'transparent',
                            border: 'none',
                            color: activeTestCaseIdx === i ? '#fff' : '#9e9e9e',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                          }}
                        >
                          Case {i + 1}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setTestcases([...testcases, '']);
                          setActiveTestCaseIdx(testcases.length);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px dashed #444',
                          color: '#9e9e9e',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        + Add
                      </button>
                    </div>
                    <div className="tc-label mb-2" style={{ color: '#9e9e9e', fontSize: '0.85rem' }}>
                      Input
                    </div>
                    <textarea
                      className="tc-input"
                      value={testcases[activeTestCaseIdx] ?? ''}
                      onChange={(e) => {
                        const newCases = [...testcases];
                        newCases[activeTestCaseIdx] = e.target.value;
                        setTestcases(newCases);
                      }}
                      style={{
                        width: '100%',
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        color: '#eff1f6',
                        padding: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        minHeight: '80px',
                        resize: 'vertical',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}
                {activeConsoleTab === 'result' && (
                  <div className="result-tab" style={{ width: '100%' }}>
                    {isRunning || isSubmitting ? (
                      <div
                        style={{
                          color: '#9e9e9e',
                          fontSize: '0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        <Loader2 className="animate-spin" size={16} />
                        {isSubmitting ? 'Judging submission...' : 'Running testcases...'}
                      </div>
                    ) : resultMode === 'submit' && submitResult ? (
                      <div>
                        <h3 style={{ color: verdictColor(submitResult.verdict), marginBottom: '1rem' }}>
                          {submitResult.status === 'JUDGING'
                            ? 'Judging...'
                            : verdictLabel(submitResult.verdict)}
                        </h3>
                        {submitResult.execMs != null && (
                          <div
                            style={{
                              display: 'flex',
                              gap: '2rem',
                              marginBottom: '1rem',
                              color: '#9e9e9e',
                              fontSize: '0.85rem',
                            }}
                          >
                            <div>
                              Runtime:{' '}
                              <span style={{ color: '#eff1f6' }}>{submitResult.execMs} ms</span>
                            </div>
                            {submitResult.memKb != null && (
                              <div>
                                Memory:{' '}
                                <span style={{ color: '#eff1f6' }}>{submitResult.memKb} KB</span>
                              </div>
                            )}
                            {submitResult.score != null && (
                              <div>
                                Score: <span style={{ color: '#eff1f6' }}>{submitResult.score}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {submitResult.totalTestCases != null && (
                          <div style={{ color: '#eff1f6', fontSize: '1rem', marginBottom: '1rem' }}>
                            Passed <span style={{ color: submitResult.status === 'DONE' && submitResult.verdict === 'AC' ? 'var(--success)' : 'var(--error)' }}>{submitResult.passedTestCases} / {submitResult.totalTestCases}</span> testcases
                          </div>
                        )}
                        {submitResult.failedTestCase && (
                          <div style={{ marginTop: '1.5rem' }}>
                            <div className="tc-label mb-2" style={{ color: '#9e9e9e', fontSize: '0.85rem' }}>
                              Input
                            </div>
                            <div
                              style={{
                                background: 'rgba(0,0,0,0.2)',
                                padding: '0.75rem',
                                borderRadius: '4px',
                                border: '1px solid #333',
                                fontFamily: 'var(--font-mono)',
                                marginBottom: '1rem',
                                whiteSpace: 'pre-wrap',
                                color: '#eff1f6',
                              }}
                            >
                              {submitResult.failedTestCase.input}
                            </div>
                            <div className="tc-label mb-2" style={{ color: '#9e9e9e', fontSize: '0.85rem' }}>
                              Expected Output
                            </div>
                            <div
                              style={{
                                background: 'rgba(0,0,0,0.2)',
                                padding: '0.75rem',
                                borderRadius: '4px',
                                border: '1px solid #333',
                                fontFamily: 'var(--font-mono)',
                                marginBottom: '1rem',
                                whiteSpace: 'pre-wrap',
                                color: '#eff1f6',
                              }}
                            >
                              {submitResult.failedTestCase.expectedOutput}
                            </div>
                            {submitResult.failedTestCase.actualOutput !== undefined && (
                              <>
                                <div className="tc-label mb-2" style={{ color: '#9e9e9e', fontSize: '0.85rem' }}>
                                  Actual Output
                                </div>
                                <div
                                  style={{
                                    background: 'rgba(0,0,0,0.2)',
                                    padding: '0.75rem',
                                    borderRadius: '4px',
                                    border: '1px solid #333',
                                    fontFamily: 'var(--font-mono)',
                                    whiteSpace: 'pre-wrap',
                                    color: 'var(--error)',
                                  }}
                                >
                                  {submitResult.failedTestCase.actualOutput || 'Empty Output'}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        {compileError && (
                          <div style={{ marginTop: '1.5rem' }}>
                            <div className="tc-label mb-2" style={{ color: '#9e9e9e', fontSize: '0.85rem' }}>
                              Compiler Output
                            </div>
                            <pre className="lc-compile-error">{compileError}</pre>
                          </div>
                        )}
                      </div>
                    ) : runResults.length > 0 ? (
                      <div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                          {runResults.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setActiveResultIdx(i)}
                              style={{
                                background: activeResultIdx === i ? 'rgba(255,255,255,0.1)' : 'transparent',
                                border: 'none',
                                color: activeResultIdx === i ? '#fff' : '#9e9e9e',
                                padding: '0.25rem 0.75rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                              }}
                            >
                              Case {i + 1}
                            </button>
                          ))}
                        </div>
                        <h3
                          style={{
                            color:
                              runResults[activeResultIdx].status === 'Finished'
                                ? 'var(--success)'
                                : 'var(--error)',
                            marginBottom: '1rem',
                          }}
                        >
                          {runResults[activeResultIdx].status}
                        </h3>
                        <div
                          style={{
                            display: 'flex',
                            gap: '2rem',
                            marginBottom: '1rem',
                            color: '#9e9e9e',
                            fontSize: '0.85rem',
                          }}
                        >
                          <div>
                            Runtime:{' '}
                            <span style={{ color: '#eff1f6' }}>{runResults[activeResultIdx].runtime}</span>
                          </div>
                          <div>
                            Memory:{' '}
                            <span style={{ color: '#eff1f6' }}>{runResults[activeResultIdx].memory}</span>
                          </div>
                        </div>
                        <div className="tc-label mb-2" style={{ color: '#9e9e9e', fontSize: '0.85rem' }}>
                          Input
                        </div>
                        <div
                          style={{
                            background: 'rgba(0,0,0,0.2)',
                            padding: '0.75rem',
                            borderRadius: '4px',
                            border: '1px solid #333',
                            fontFamily: 'var(--font-mono)',
                            marginBottom: '1rem',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {runResults[activeResultIdx].input}
                        </div>
                        <div className="tc-label mb-2" style={{ color: '#9e9e9e', fontSize: '0.85rem' }}>
                          Output
                        </div>
                        <div
                          style={{
                            background: 'rgba(0,0,0,0.2)',
                            padding: '0.75rem',
                            borderRadius: '4px',
                            border: '1px solid #333',
                            fontFamily: 'var(--font-mono)',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {runResults[activeResultIdx].output}
                        </div>
                      </div>
                    ) : (
                      <div className="lc-empty-state">Run or submit your code to see results</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
