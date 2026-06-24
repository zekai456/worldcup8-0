// Match broadcast: auto-streamed score-aware commentary with post-match stats.
import { useEffect, useMemo, useRef, useState } from 'react';

const PHASE_LABEL = {
  zh: {
    first_half: '上半场',
    second_half: '下半场',
    climax: '终场',
  },
  en: {
    first_half: 'First Half',
    second_half: 'Second Half',
    climax: 'Full Time',
  },
};

const EVENT_LABEL = {
  goal: 'GOAL',
  corner: 'CORNER',
  free_kick: 'FREE KICK',
  save: 'SAVE',
  big_chance: 'CHANCE',
  yellow_card: 'YELLOW',
  substitution: 'SUB',
  penalty: 'PENALTY',
  tactic: 'TACTICS',
  setup: 'KICK OFF',
  recap: 'FULL TIME',
  texture: 'LIVE',
};

const SIDE_LABEL = {
  zh: {
    player: '梦之队',
    opponent: '对手',
    neutral: '双方',
  },
  en: {
    player: 'Dream XI',
    opponent: 'Opponent',
    neutral: 'Both sides',
  },
};

export default function Match({ result, onContinue, language = 'zh', t }) {
  const highlights = useMemo(
    () => normalizeBroadcast(result.broadcast || result.highlights || [], language),
    [result.broadcast, result.highlights, language]
  );
  const [stage, setStage] = useState(0); // index into highlights
  const [shown, setShown] = useState(''); // typed text for current stage
  const [revealed, setRevealed] = useState(false); // score revealed
  const timer = useRef(null);
  const pauseTimer = useRef(null);

  // typewriter for the current stage
  useEffect(() => {
    clearInterval(timer.current);
    clearTimeout(pauseTimer.current);
    if (stage >= highlights.length) {
      setRevealed(true);
      return;
    }
    const full = lineText(highlights[stage], language);
    setShown('');
    let i = 0;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      i++;
      setShown(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(timer.current);
        pauseTimer.current = setTimeout(() => {
          setStage((s) => s + 1);
        }, 520);
      }
    }, 28);
    return () => {
      clearInterval(timer.current);
      clearTimeout(pauseTimer.current);
    };
  }, [stage, highlights]);

  const win = result.winner === 'player';
  const decidedBy = (language === 'en'
    ? { regular: 'Regular Time', extra_time: 'Extra Time', penalties: 'Penalties' }
    : { regular: '常规时间', extra_time: '加时赛', penalties: '点球大战' })[result.decided_by] || '';
  const currentScore = revealed
    ? result.score
    : highlights[Math.max(0, Math.min(stage, highlights.length - 1))]?.scoreAfter;
  const activeLine = highlights[Math.max(0, Math.min(stage, highlights.length - 1))];
  const progress = highlights.length ? Math.min(100, Math.round(((Math.min(stage, highlights.length - 1) + (revealed ? 1 : 0)) / highlights.length) * 100)) : 0;

  return (
    <div className="match fifa-match">
      <div className="fifa-hero">
        <div className="stadium-lights" aria-hidden="true" />
        <div className="fifa-topline">
          <span>{language === 'en' ? result.stage?.englishName || 'World Cup Challenge' : result.stage?.name || '世界杯挑战'}</span>
          <b>{activeLine?.minute ? `${activeLine.minute}'` : 'LIVE'}</b>
          <span>{PHASE_LABEL[language][activeLine?.phase] || (language === 'en' ? 'Live' : '比赛中')}</span>
        </div>
        <div className="fifa-scoreboard">
          <TeamBlock name={t('dreamTeam')} side="home" />
          <div className={`fifa-score ${activeLine?.kind === 'goal' ? 'goal-flash' : ''}`}>
            <strong>{currentScore ? currentScore.player : '?'}</strong>
            <span>:</span>
            <strong>{currentScore ? currentScore.opponent : '?'}</strong>
          </div>
          <TeamBlock name={t('opponent')} side="away" />
        </div>
        <div className="broadcast-progress" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="fifa-layout">
        <div className="broadcast fifa-feed">
          <div className="feed-header">
            <span>Match Feed</span>
            <b>{EVENT_LABEL[activeLine?.kind] || 'LIVE'}</b>
          </div>
        {highlights.slice(0, stage + 1).map((h, idx) => (
          <div key={idx} className={`bc-line ${h.phase} ${h.kind || 'texture'} ${h.side || 'neutral'} ${idx === stage && !revealed ? 'active' : ''}`}>
            <span className="bc-phase">
              <b className="event-chip">{EVENT_LABEL[h.kind] || 'LIVE'}</b>
              <span>{SIDE_LABEL[language][h.side] || SIDE_LABEL[language][h.scorer] || t('bothSides')} · {PHASE_LABEL[language][h.phase] || h.phase} · {h.minute}'</span>
              {(h.scoreText || h.scoreAfter) && <b>{h.scoreText || `${h.scoreAfter.player}:${h.scoreAfter.opponent}`}</b>}
            </span>
            <p className="bc-text">{idx === stage ? shown : lineText(h, language)}</p>
          </div>
        ))}
        </div>
        <div className="fifa-side">
          <MiniPitch active={activeLine} language={language} t={t} />
          <StatsBoard stats={result.stats} compact={!revealed} language={language} t={t} />
        </div>
      </div>

      {!revealed && (
        <div className="streaming-note" aria-live="polite">
          <span />
          {language === 'en' ? 'Live commentary is streaming. The score updates automatically with each goal.' : '实时解说流正在播报，比分会随进球自动刷新'}
        </div>
      )}

      {revealed && (
        <div className="match-result fifa-result">
          <div className="result-hero-line">
            <div>
              <p className="mr-kicker">Full Time Report</p>
              <p className="mr-verdict">
                {win ? (language === 'en' ? 'Victory!' : '胜利！') : (language === 'en' ? 'Defeat' : '失利')} {decidedBy && <span className="muted">（{decidedBy}）</span>}
              </p>
              {result.recap?.scoreline && <p className="scoreline-text">{result.recap.scoreline}</p>}
            </div>
            <div className="result-score-lock">
              <strong>{result.score.player}</strong>
              <span>:</span>
              <strong>{result.score.opponent}</strong>
            </div>
          </div>
          {result.recap?.summary || result.match_flow ? <p className="mr-flow">{result.recap?.summary || result.match_flow}</p> : null}
          <div className="postmatch-grid">
            <section className="postmatch-panel">
              <h3>{language === 'en' ? 'Team Stats' : '球队技术统计'}</h3>
              <StatsBoard stats={result.stats} compact={false} language={language} t={t} variant="postmatch" />
            </section>
            <section className="postmatch-panel player-stat-panel">
              <h3>{language === 'en' ? 'Player Stats' : '球员数据统计'}</h3>
              <PlayerStats result={result} language={language} t={t} />
            </section>
            <section className="postmatch-panel awards-mini">
              <h3>{language === 'en' ? 'Match Honors' : '本场荣誉'}</h3>
              <div className="mr-tags stacked">
                {result.mvp && <span className="tag good">MVP: {result.mvp}</span>}
                {result.worst && <span className="tag bad">{language === 'en' ? 'Lowest: ' : '最差：'}{result.worst}</span>}
                <span className="tag">{language === 'en' ? `${highlights.length} key events` : `${highlights.length} 条关键解说`}</span>
              </div>
              <button className="btn" onClick={() => onContinue(result)}>
                {win ? (language === 'en' ? 'Enter Press Conference →' : '进入赛后发布会 →') : (language === 'en' ? 'Face the Media →' : '面对媒体 →')}
              </button>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeBroadcast(lines, language = 'zh') {
  return (Array.isArray(lines) ? lines : []).map((line) => ({
    ...line,
    text: lineText(line, language),
  }));
}

function lineText(line = {}, language = 'zh') {
  const text = line.text || line.commentary || line.description || line.detail || line.body || line.narration;
  if (text && String(text).trim()) return String(text);
  return language === 'en'
    ? 'Commentary text is being restored for this event.'
    : '这条事件的解说正文缺失，系统正在保留事件节点。';
}

function TeamBlock({ name, side }) {
  return (
    <div className={`team-block ${side}`}>
      <span>{side === 'home' ? 'HOME' : 'AWAY'}</span>
      <strong>{name}</strong>
    </div>
  );
}

function MiniPitch({ active, language = 'zh', t }) {
  return (
    <div className={`mini-live-pitch ${active?.kind === 'goal' ? 'goal' : ''}`}>
      <div className="pitch-orbit" />
      <div className="attack-lane lane-a" />
      <div className="attack-lane lane-b" />
      <div className="ball-pulse" />
      <div className="pitch-caption">
        <span>{EVENT_LABEL[active?.kind] || 'LIVE'}</span>
        <em>{SIDE_LABEL[language][active?.side] || SIDE_LABEL[language][active?.scorer] || t('bothSides')}{language === 'en' ? ' key event' : '关键事件'}</em>
        <b>{active?.title || (language === 'en' ? 'Live Match View' : '比赛实时画面')}</b>
      </div>
    </div>
  );
}

function StatsBoard({ stats, compact = false, language = 'zh', t, variant = '' }) {
  if (!stats) return null;
  const rows = [
    [language === 'en' ? 'Possession' : '控球率', percent(stats.possession?.player), percent(stats.possession?.opponent)],
    [language === 'en' ? 'Shots' : '射门', stats.shots?.player, stats.shots?.opponent],
    [language === 'en' ? 'On Target' : '射正', stats.shotsOnTarget?.player, stats.shotsOnTarget?.opponent],
    [language === 'en' ? 'xG' : '预期进球', stats.xg?.player, stats.xg?.opponent],
    [language === 'en' ? 'Big Chances' : '绝佳机会', stats.bigChances?.player, stats.bigChances?.opponent],
    [language === 'en' ? 'Passes' : '传球', stats.passes?.player, stats.passes?.opponent],
    [language === 'en' ? 'Pass Acc.' : '传球成功率', percent(stats.passAccuracy?.player), percent(stats.passAccuracy?.opponent)],
    [language === 'en' ? 'Corners' : '角球', stats.corners?.player, stats.corners?.opponent],
    [language === 'en' ? 'Saves' : '扑救', stats.saves?.player, stats.saves?.opponent],
    [language === 'en' ? 'Attacks' : '危险进攻', stats.attacks?.player, stats.attacks?.opponent],
    [language === 'en' ? 'Fouls' : '犯规', stats.discipline?.fouls?.player, stats.discipline?.fouls?.opponent],
    [language === 'en' ? 'Yellow' : '黄牌', stats.discipline?.yellowCards?.player, stats.discipline?.yellowCards?.opponent],
  ].slice(0, compact ? 6 : 12);
  return (
    <div className={`stats-board ${compact ? 'compact' : ''} ${variant}`}>
      <div className="stats-head">
        <b>{t('dreamTeam')}</b>
        <span>{language === 'en' ? 'Match Stats' : '技术统计'}</span>
        <b>{t('opponent')}</b>
      </div>
      {rows.map(([label, mine, theirs]) => (
        <div key={label} className="stats-row">
          <strong>{formatValue(mine)}</strong>
          <span>{label}</span>
          <strong>{formatValue(theirs)}</strong>
          <StatBars mine={mine} theirs={theirs} />
        </div>
      ))}
    </div>
  );
}

function PlayerStats({ result, language = 'zh', t }) {
  const stats = result.stats || {};
  const playerGoals = Number(result.score?.player || 0);
  const opponentGoals = Number(result.score?.opponent || 0);
  const playerShots = Number(stats.shots?.player || 0);
  const opponentShots = Number(stats.shots?.opponent || 0);
  const playerSaves = Number(stats.saves?.player || 0);
  const opponentSaves = Number(stats.saves?.opponent || 0);
  const rows = [
    {
      label: language === 'en' ? 'Top performer' : '本方最佳',
      name: result.mvp || (language === 'en' ? 'Dream XI core' : '梦之队核心'),
      team: t('dreamTeam'),
      value: language === 'en'
        ? `${playerGoals} goals team output`
        : `球队${playerGoals}球`,
    },
    {
      label: language === 'en' ? 'Opponent threat' : '对手威胁点',
      name: result.worst && opponentGoals > 0 ? result.worst : (language === 'en' ? 'Opponent attacker' : '对手攻击手'),
      team: t('opponent'),
      value: language === 'en'
        ? `${opponentGoals} goals`
        : `${opponentGoals}球`,
    },
    {
      label: language === 'en' ? 'Shot leader side' : '射门主导方',
      name: playerShots >= opponentShots ? t('dreamTeam') : t('opponent'),
      team: language === 'en' ? 'Team' : '球队',
      value: `${Math.max(playerShots, opponentShots)} ${language === 'en' ? 'shots' : '脚射门'}`,
    },
    {
      label: language === 'en' ? 'Keeper workload' : '门将工作量',
      name: playerSaves >= opponentSaves ? (language === 'en' ? 'Dream XI keeper' : '梦之队门将') : (language === 'en' ? 'Opponent keeper' : '对手门将'),
      team: playerSaves >= opponentSaves ? t('dreamTeam') : t('opponent'),
      value: `${Math.max(playerSaves, opponentSaves)} ${language === 'en' ? 'saves' : '次扑救'}`,
    },
  ];
  return (
    <div className="player-stat-list">
      {rows.map((row) => (
        <div className="player-stat-row" key={row.label}>
          <span>{row.label}</span>
          <strong>{row.name}</strong>
          <small>{row.team}</small>
          <b>{row.value}</b>
        </div>
      ))}
    </div>
  );
}

function StatBars({ mine, theirs }) {
  const left = numeric(mine);
  const right = numeric(theirs);
  const total = Math.max(1, left + right);
  return (
    <div className="stat-bars" aria-hidden="true">
      <span style={{ width: `${Math.max(4, (left / total) * 100)}%` }} />
      <span style={{ width: `${Math.max(4, (right / total) * 100)}%` }} />
    </div>
  );
}

function percent(value) {
  return value == null ? value : `${value}%`;
}

function formatValue(value) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function numeric(value) {
  const n = Number(String(value ?? '').replace('%', ''));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}
