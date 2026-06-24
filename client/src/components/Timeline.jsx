import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { GAME_MODES } from '../gameModes.js';
import { apiLanguage, modeText } from '../i18n.js';

// Step 1: choose an era window. The spin is hard-
// restricted to editions inside this window, so picking 2002–2026 can never
// surface a 1930s team.
export default function Timeline({ years, gameMode, onModeChange, onConfirm, language = 'zh', t }) {
  const [minIdx, setMinIdx] = useState(0);
  const [maxIdx, setMaxIdx] = useState(years.length - 1);
  const [profile, setProfile] = useState('');
  const [loading, setLoading] = useState(false);

  const minYear = years[minIdx];
  const maxYear = years[maxIdx];
  const span = maxIdx - minIdx + 1;

  // flavor text follows the latest year in the window
  useEffect(() => {
    let alive = true;
    setProfile('');
    setLoading(true);
    api
      .era(maxYear, apiLanguage(language))
      .then((r) => alive && setProfile(language === 'en' ? r.profileEn || r.profile : r.profile))
      .catch(() => alive && setProfile(''))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [maxYear, language]);

  function changeMin(v) {
    const n = Number(v);
    setMinIdx(n);
    if (n > maxIdx) setMaxIdx(n); // push the upper bound along
  }
  function changeMax(v) {
    const n = Number(v);
    setMaxIdx(n);
    if (n < minIdx) setMinIdx(n);
  }

  return (
    <div className="card timeline-card">
      <div className="hero-kicker">{t('timelineKicker')}</div>
      <h1 className="title">{t('timelineTitle')}</h1>
      <p className="muted center">{t('timelineSub')}</p>

      <div className="mode-grid">
        {Object.values(GAME_MODES).map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`mode-card ${gameMode === mode.id ? 'active' : ''}`}
            onClick={() => onModeChange(mode.id)}
          >
            <span>{modeText(mode, 'name', language)}</span>
            <small>{modeText(mode, 'desc', language)}</small>
          </button>
        ))}
      </div>

      <div className="era-display">
        <div className="era-year">{minYear} — {maxYear}</div>
        <div className="era-profile">
          {loading ? <span className="dots">{t('eraLoading')}</span> : profile || ' '}
        </div>
      </div>

      <div className="range-group">
        <label className="range-label">{t('minEra', { year: minYear })}</label>
        <input
          className="slider"
          type="range"
          min={0}
          max={years.length - 1}
          value={minIdx}
          onChange={(e) => changeMin(e.target.value)}
        />
        <label className="range-label">{t('maxEra', { year: maxYear })}</label>
        <input
          className="slider"
          type="range"
          min={0}
          max={years.length - 1}
          value={maxIdx}
          onChange={(e) => changeMax(e.target.value)}
        />
      </div>
      <div className="slider-ends">
        <span>{years[0]}</span>
        <span>{years[years.length - 1]}</span>
      </div>

      <div className="center" style={{ marginTop: 18 }}>
        <button className="btn" onClick={() => onConfirm({ minYear, maxYear }, gameMode)}>
          {span === 1
            ? `${t('lockYear', { year: minYear })} →`
            : `${t('lockRange', { min: minYear, max: maxYear })} →`}
        </button>
      </div>
    </div>
  );
}
