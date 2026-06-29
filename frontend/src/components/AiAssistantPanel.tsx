import { useState, useCallback } from 'react';
import {
  Sparkles,
  Star,
  Lightbulb,
  FileCode2,
  Zap,
  Clock,
  HardDrive,
  Loader2,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';
import { requestAiAssist, type AiAction, type AiExecutionContext } from '../lib/api';

type Props = {
  problemSlug: string;
  language: string;
  code: string;
  isLoggedIn: boolean;
  onLoginRequired: () => void;
  isAccepted: boolean;
  hasExecuted: boolean;
  executionContext: AiExecutionContext;
  onApplySolution?: (code: string) => void;
};

type View = 'menu' | 'loading' | 'result';

function extractCodeBlock(text: string): string | null {
  const match = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

export default function AiAssistantPanel({
  problemSlug,
  language,
  code,
  isLoggedIn,
  onLoginRequired,
  isAccepted,
  hasExecuted,
  executionContext,
  onApplySolution,
}: Props) {
  const [view, setView] = useState<View>('menu');
  const [response, setResponse] = useState('');
  const [lastAction, setLastAction] = useState<AiAction | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const runAction = useCallback(
    async (action: AiAction) => {
      if (!isLoggedIn) {
        onLoginRequired();
        return;
      }
      setView('loading');
      setError('');
      setLastAction(action);
      try {
        const result = await requestAiAssist({
          problemSlug,
          language,
          source: code,
          action,
          executionContext,
        });
        setResponse(result.content);
        setView('result');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'AI request failed');
        setView('menu');
      }
    },
    [code, executionContext, isLoggedIn, language, onLoginRequired, problemSlug],
  );

  const handleCopy = async () => {
    const block = extractCodeBlock(response);
    const text = block ?? response;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    const block = extractCodeBlock(response);
    if (block && onApplySolution) {
      onApplySolution(block);
    }
  };

  const showHelpOptions = !isAccepted;
  const showPostRunOptions = hasExecuted && code.trim().length > 0;

  if (view === 'loading') {
    return (
      <div className="ai-assistant">
        <div className="ai-assistant-loading">
          <Loader2 className="animate-spin" size={28} />
          <p>Thinking...</p>
        </div>
      </div>
    );
  }

  if (view === 'result') {
    const codeBlock = lastAction === 'solution' || lastAction === 'enhance' ? extractCodeBlock(response) : null;
    return (
      <div className="ai-assistant">
        <button type="button" className="ai-back-btn" onClick={() => setView('menu')}>
          <ArrowLeft size={14} /> Back
        </button>
        <div className="ai-response">{response}</div>
        <div className="ai-result-actions">
          <button type="button" className="ai-action-btn ai-action-btn-secondary" onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {codeBlock && onApplySolution && (
            <button type="button" className="ai-action-btn ai-action-btn-primary" onClick={handleApply}>
              <FileCode2 size={14} /> Apply to editor
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="ai-assistant">
      <div className="ai-intro">
        <Sparkles size={18} color="#ffa116" />
        <div>
          <h3>AI Assist</h3>
          <p>Get feedback and guidance for your current code in {language === 'cpp' ? 'C++' : language}.</p>
        </div>
      </div>

      {error && <div className="ai-error">{error}</div>}

      <div className="ai-section">
        <div className="ai-section-label">Code quality</div>
        <button type="button" className="ai-action-btn" onClick={() => runAction('rate')}>
          <Star size={16} />
          <span>
            <strong>Rate my code</strong>
            <small>Score readability, style, and correctness likelihood</small>
          </span>
        </button>
      </div>

      {showHelpOptions && (
        <div className="ai-section">
          <div className="ai-section-label">
            {isAccepted ? '' : 'Stuck on this problem?'}
          </div>
          <p className="ai-section-hint">Do you want hints or a full solution?</p>
          <div className="ai-action-row">
            <button type="button" className="ai-action-btn ai-action-btn-half" onClick={() => runAction('hints')}>
              <Lightbulb size={16} />
              <span>
                <strong>Hints</strong>
                <small>Progressive nudges without full code</small>
              </span>
            </button>
            <button type="button" className="ai-action-btn ai-action-btn-half" onClick={() => runAction('solution')}>
              <FileCode2 size={16} />
              <span>
                <strong>Full solution</strong>
                <small>Complete answer in your language</small>
              </span>
            </button>
          </div>
        </div>
      )}

      {showPostRunOptions && (
        <div className="ai-section">
          <div className="ai-section-label">After run / submit</div>
          <button type="button" className="ai-action-btn" onClick={() => runAction('enhance')}>
            <Zap size={16} />
            <span>
              <strong>Enhance my code</strong>
              <small>Cleaner, faster, or more idiomatic version</small>
            </span>
          </button>
          <div className="ai-action-row">
            <button
              type="button"
              className="ai-action-btn ai-action-btn-half"
              onClick={() => runAction('time_complexity')}
            >
              <Clock size={16} />
              <span>
                <strong>Time complexity</strong>
                <small>Big-O analysis</small>
              </span>
            </button>
            <button
              type="button"
              className="ai-action-btn ai-action-btn-half"
              onClick={() => runAction('space_complexity')}
            >
              <HardDrive size={16} />
              <span>
                <strong>Space complexity</strong>
                <small>Memory usage analysis</small>
              </span>
            </button>
          </div>
        </div>
      )}

      {!isLoggedIn && (
        <p className="ai-login-note">Log in to use AI Assist.</p>
      )}
    </div>
  );
}
