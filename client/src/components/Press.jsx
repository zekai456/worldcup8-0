// Post-match press conference: free-text answer -> LLM butterfly effects.
import { useState } from 'react';
import { LoadingSteps } from './LoadingStates.jsx';

export default function Press({ question, onSubmit, loading, t }) {
  const [answer, setAnswer] = useState('');

  return (
    <div className="press card">
      <h2 className="section-title">{t('pressTitle')}</h2>
      <div className="reporter">
        <div className="reporter-avatar">📰</div>
        <p className="reporter-q">{question}</p>
      </div>
      <textarea
        className="press-input"
        placeholder={t('pressPlaceholder')}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={4}
        maxLength={300}
      />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="muted">{answer.length}/300</span>
        <button
          className="btn"
          disabled={loading || !answer.trim()}
          onClick={() => onSubmit(answer.trim())}
        >
          {loading ? t('pressLoading') : t('pressSubmit')}
        </button>
      </div>
      {loading && (
        <LoadingSteps
          compact
          title={t('pressProcessing')}
          steps={t('pressSteps')}
        />
      )}
    </div>
  );
}
