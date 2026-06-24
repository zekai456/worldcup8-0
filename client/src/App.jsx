// Central game state machine. Drives the 2026 World Cup challenge:
// timeline -> formation -> draft -> (event) -> match -> press -> next/endgame.
import { useEffect, useState } from 'react';
import { api } from './api.js';
import Timeline from './components/Timeline.jsx';
import FormationPicker from './components/FormationPicker.jsx';
import Draft from './components/Draft.jsx';
import Match from './components/Match.jsx';
import Press from './components/Press.jsx';
import Headline from './components/Headline.jsx';
import TournamentPanel from './components/TournamentPanel.jsx';
import { LoadingSteps } from './components/LoadingStates.jsx';
import { WORLD_CUP_2026_PATH, stageByMatchday } from './tournament.js';
import { GAME_MODES, normalizeGameMode } from './gameModes.js';
import { apiLanguage, loadLanguage, makeTranslator, modeText, saveLanguage, stageName, tierLabel } from './i18n.js';
import {
  buildAwards,
  championOpponentsForGroup,
  clearTournamentState,
  createTournamentState,
  fixtureForMatchday,
  loadTournamentState,
  recordMatch,
  saveTournamentState,
  updateKnockoutFixture,
} from './tournamentState.js';

const TOTAL_MATCHDAYS = WORLD_CUP_2026_PATH.length;

// phases: loading | timeline | formation | draft | event | preparing | match | press | endgame
export default function App() {
  const [config, setConfig] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // run state
  const [centerYear, setCenterYear] = useState(2002);
  const [gameMode, setGameMode] = useState(GAME_MODES.classic.id);
  const [eraWindow, setEraWindow] = useState({ minYear: 1930, maxYear: 2026 });
  const [formation, setFormation] = useState(null);
  const [squad, setSquad] = useState([]); // starting XI
  const [bench, setBench] = useState([]); // 2 substitutes
  const [draftId, setDraftId] = useState(null);
  const [round, setRound] = useState(1);
  const [commentaryStyle, setCommentaryStyle] = useState('passion');
  const [language, setLanguage] = useState(loadLanguage);
  const [consequences, setConsequences] = useState([]); // carry-over effects
  const [history, setHistory] = useState([]); // per-round records
  const [tournament, setTournament] = useState(null);
  const [awards, setAwards] = useState(null);

  // transient per-round
  const [event, setEvent] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [endgame, setEndgame] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const t = makeTranslator(language);

  useEffect(() => {
    api
      .config()
      .then((c) => {
        setConfig(c);
        const savedTournament = loadTournamentState();
        if (savedTournament) setTournament(savedTournament);
        if (c.commentaryStyles?.length) setCommentaryStyle(c.commentaryStyles[0].id);
        setPhase('timeline');
      })
      .catch((e) => setErr(t('backendError') + e.message));
  }, []);

  function switchLanguage(nextLanguage) {
    setLanguage(nextLanguage);
    saveLanguage(nextLanguage);
  }

  function resetRun() {
    setFormation(null);
    setGameMode(GAME_MODES.classic.id);
    setEraWindow({ minYear: 1930, maxYear: 2026 });
    setSquad([]);
    setBench([]);
    setDraftId(null);
    setRound(1);
    setConsequences([]);
    setHistory([]);
    setTournament(null);
    setAwards(null);
    clearTournamentState();
    setEvent(null);
    setOpponent(null);
    setMatchResult(null);
    setEndgame(null);
    setOutcome(null);
    setErr('');
    setPhase('timeline');
  }

  // --- step transitions ---------------------------------------------------
  function onTimeline(window, selectedMode) {
    setGameMode(normalizeGameMode(selectedMode));
    setEraWindow(window);
    setCenterYear(Math.round((window.minYear + window.maxYear) / 2));
    setTournament(null);
    clearTournamentState();
    setPhase('formation');
  }

  function onFormation(f) {
    setFormation(f);
    setPhase('draft');
  }

  // squad complete -> roll pre-match event for round 1
  async function onDraftComplete(arr, savedDraftId, substitutes = []) {
    setSquad(arr);
    setBench(substitutes);
    setDraftId(savedDraftId || null);
    const initialTournament = createTournamentState({
      groupOpponents: championOpponentsForGroup(),
    });
    setTournament(initialTournament);
    saveTournamentState(initialTournament);
    setOpponent(null);
    setPhase('preparing');
    await startRound(arr, 1, [], initialTournament);
  }

  // Begin a round: roll event (40%), then opponent, then go to match prep.
  async function startRound(currentSquad, rnd, carry, tournamentState = tournament) {
    setBusy(true);
    setErr('');
    try {
      const ev = await api.event({ round: rnd, squad: currentSquad, formation: formation.name, language: apiLanguage(language) });
      if (ev.triggered) {
        setEvent(ev.event);
        setPhase('event');
      } else {
        await rollOpponentAndPrep(currentSquad, rnd, carry, tournamentState);
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function chooseEventOption(opt) {
    const carry = [...consequences, t('eventChoice', { title: event.title, label: opt.label, hint: opt.effect_hint || '' })];
    setConsequences(carry);
    setEvent(null);
    await rollOpponentAndPrep(squad, round, carry, tournament);
  }

  async function rollOpponentAndPrep(currentSquad, rnd, carry, tournamentState = tournament) {
    setBusy(true);
    try {
      const fixture = fixtureForMatchday(tournamentState, rnd);
      let nextTournament = tournamentState;
      const opp = fixture?.away && fixture.away !== '待定'
        ? {
            year: fixture.opponentYear || 2026,
            country: fixture.away,
            round: rnd,
            champion: !!fixture.championOpponent,
            tier: fixture.opponentTier || '',
            strength: fixture.opponentStrength || null,
            tag: fixture.opponentTag || '',
            label: `${fixture.opponentYear || 2026} ${fixture.away}`,
          }
        : await api.opponent({ round: rnd });
      if (stageByMatchday(rnd).type === 'knockout' && (!fixture?.away || fixture.away === '待定')) {
        nextTournament = updateKnockoutFixture(tournamentState || createTournamentState(), rnd, opp);
        setTournament(nextTournament);
        saveTournamentState(nextTournament);
      }
      setOpponent(opp);
      setPhase('preparing');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  // kick off the match simulation (from the prep screen)
  async function kickoff() {
    setBusy(true);
    setErr('');
    try {
      const result = await api.match({
        round,
        formation: formation.name,
        squad,
        bench,
        opponent,
        commentaryStyle,
        consequences,
        language: apiLanguage(language),
      });
      setMatchResult(result);
      setPhase('match');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  // after the broadcast finishes
  function afterMatch(result) {
    if (result.winner === 'player') {
      setPhase('press');
    } else {
      // loss -> still get one press, then endgame(eliminated)
      setPhase('press');
    }
  }

  async function submitPress(answer) {
    setBusy(true);
    setErr('');
    try {
      const analysis = await api.press({
        question: matchResult.press_question,
        answer,
        squad,
        bench,
        lastMatch: matchResult,
        language: apiLanguage(language),
      });
      const rec = {
        round,
        stage: stageByMatchday(round).name,
        opponent,
        score: matchResult.score,
        winner: matchResult.winner,
        decidedBy: matchResult.decided_by,
        recap: matchResult.recap || null,
        matchFlow: matchResult.match_flow || '',
        stats: matchResult.stats || null,
        mvp: matchResult.mvp || '',
        worst: matchResult.worst || '',
        pressQuestion: matchResult.press_question,
        pressAnswer: answer,
        mediaHeadline: analysis.media_headline,
      };
      const newHistory = [...history, rec];
      setHistory(newHistory);
      let nextTournament = recordMatch(tournament || createTournamentState(), {
        id: fixtureForMatchday(tournament, round)?.id || `player-${round}`,
        matchday: round,
        stage: stageByMatchday(round).name,
        home: t('dreamTeam'),
        away: opponent.country,
        playerMatch: true,
        score: { home: matchResult.score.player, away: matchResult.score.opponent, player: matchResult.score.player, opponent: matchResult.score.opponent },
        stats: matchResult.stats || null,
      });
      nextTournament = await simulateOtherMatchesForMatchday(nextTournament, round, language, t);
      setTournament(nextTournament);
      saveTournamentState(nextTournament);

      const won = matchResult.winner === 'player';
      if (!won) {
        await finishGame('eliminated', newHistory, nextTournament);
        return;
      }
      if (round >= TOTAL_MATCHDAYS) {
        await finishGame('champion', newHistory, nextTournament);
        return;
      }

      // carry press effects into next round
      const effectText = (analysis.effects || [])
        .map((ef) => `${ef.target}：${ef.desc}`)
        .join('；');
      const carry = [
        t('pressCarry', { stage: stageName(stageByMatchday(round), language), summary: analysis.summary || '', effects: effectText }),
      ];
      setConsequences(carry);

      // advance
      const next = round + 1;
      setRound(next);
      setMatchResult(null);
      setOpponent(null);
      await startRound(squad, next, carry, nextTournament);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function finishGame(result, hist, tournamentState = tournament) {
    setOutcome(result);
    setBusy(true);
    try {
      const [card, aiAwards] = await Promise.all([
        api.endgame({
          outcome: result,
          round,
          squad,
          bench,
          history: hist || history,
          language: apiLanguage(language),
        }),
        api.awards({
          outcome: result,
          squad,
          bench,
          history: hist || history,
          tournament: tournamentState,
          language: apiLanguage(language),
        }).catch(() => buildAwards({ state: tournamentState || createTournamentState(), squad })),
      ]);
      setEndgame(card);
      setAwards(mergeAwards(buildAwards({ state: tournamentState || createTournamentState(), squad }), aiAwards));
    } catch (e) {
      setEndgame({
        paper: t('fallbackPaper'),
        headline: result === 'champion' ? t('championHeadline') : t('eliminatedHeadline', { stage: stageName(stageByMatchday(round), language) }),
        subhead: t('fallbackSubhead', { count: hist?.length || history.length }),
        body: buildFallbackEndgameBody({ result, hist: hist || history, language }),
        route: buildFallbackRoute(hist || history, language),
        verdict: result === 'champion' ? t('championVerdict') : t('eliminatedVerdict'),
        rating: result === 'champion' ? t('championRating') : t('eliminatedRating'),
      });
      setAwards(buildAwards({ state: tournamentState || createTournamentState(), squad }));
    } finally {
      setBusy(false);
      setPhase('endgame');
    }
  }

  // --- render -------------------------------------------------------------
  if (phase === 'loading') {
    return (
      <div className="app center">
        {err ? <p className="err">{err}</p> : <p className="muted">{t('loading')}</p>}
      </div>
    );
  }

  return (
    <div className="app">
      {phase !== 'timeline' && (
        <div className="topbar">
          <span className="round-pill">{stageName(stageByMatchday(round), language)}</span>
          <span className="round-pill">{t('challenge')} {round}/{TOTAL_MATCHDAYS}</span>
          <span className="round-pill">{modeText(GAME_MODES[gameMode], 'shortName', language) || modeText(GAME_MODES.classic, 'shortName', language)} {t('modeSuffix')}</span>
          {draftId && <span className="round-pill">{t('squadId')} #{draftId}</span>}
          {formation && <span className="topbar-formation">{formation.name}</span>}
          <LanguageToggle value={language} onChange={switchLanguage} label={t('languageToggle')} />
          <CommentaryToggle
            styles={config.commentaryStyles}
            value={commentaryStyle}
            onChange={setCommentaryStyle}
            disabled={phase === 'match'}
            language={language}
          />
        </div>
      )}

      {err && phase !== 'loading' && <p className="err banner">{err}</p>}
      {tournament && ['event', 'preparing', 'match', 'press', 'endgame'].includes(phase) && <TournamentPanel state={tournament} language={language} t={t} />}

      {phase === 'timeline' && <Timeline years={config.years} gameMode={gameMode} onModeChange={setGameMode} onConfirm={onTimeline} language={language} t={t} onLanguageChange={switchLanguage} />}

      {phase === 'formation' && (
        <FormationPicker formations={config.formations} onConfirm={onFormation} language={language} t={t} />
      )}

      {phase === 'draft' && formation && (
        <Draft formation={formation} centerYear={centerYear} eraWindow={eraWindow} gameMode={gameMode} language={language} onComplete={onDraftComplete} />
      )}

      {phase === 'event' && event && (
        <div className="card event-card">
          <h2 className="section-title">{t('preMatchEvent')}</h2>
          <h3 className="event-title">{event.title}</h3>
          <p className="event-desc">{event.desc}</p>
          <div className="event-opts">
            {event.options.map((o) => (
              <button key={o.key} className="event-opt" onClick={() => chooseEventOption(o)} disabled={busy}>
                <span className="ek">{o.key}</span>
                {o.label}
                {o.effect_hint && <span className="eh">{o.effect_hint}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === 'preparing' && opponent && (
        <div className="card center prep-card">
          <h2 className="section-title">{stageName(stageByMatchday(round), language)} · {t('matchup')}</h2>
          <p className="prep-opp">
            {t('opponentLabel')}<b>{opponent.year} {opponent.country}</b>
          </p>
          {(opponent.tag || opponent.strength || opponent.tier) && (
            <div className="opponent-scout">
              {opponent.tag && <span>{opponent.tag}</span>}
              {opponent.strength && <span>{t('strength')} {opponent.strength}</span>}
              {opponent.tier && <span>{tierLabel(opponent.tier, language)}</span>}
              {!opponent.champion && <span>{t('nonChampionClassic')}</span>}
            </div>
          )}
          <p className="muted">{t('commentaryHint', { style: commentaryStyleName(config.commentaryStyles.find((s) => s.id === commentaryStyle), language) })}</p>
          {consequences.length > 0 && (
            <div className="carry-note">
              {consequences.map((c, i) => <p key={i}>📌 {c}</p>)}
            </div>
          )}
          {busy && (
            <LoadingSteps
              title={t('simulatingMatch')}
              steps={t('simSteps')}
            />
          )}
          <button className="btn big" onClick={kickoff} disabled={busy}>
            {busy ? t('simBusy') : t('kickoff')}
          </button>
        </div>
      )}

      {phase === 'preparing' && !opponent && (
        <div className="card center prep-card">
          <h2 className="section-title">{t('enteringMatch')}</h2>
          <LoadingSteps
            steps={t('enteringSteps')}
          />
        </div>
      )}

      {phase === 'match' && matchResult && (
        <Match result={matchResult} onContinue={afterMatch} language={language} t={t} />
      )}

      {phase === 'press' && matchResult && (
        <Press question={matchResult.press_question} onSubmit={submitPress} loading={busy} t={t} />
      )}

      {phase === 'endgame' && endgame && (
        <Headline card={endgame} awards={awards} outcome={outcome} onRestart={resetRun} gameMode={gameMode} squad={squad} history={history} language={language} t={t} />
      )}

      {phase === 'endgame' && !endgame && (
        <div className="card center prep-card">
          <h2 className="section-title">{t('finalReport')}</h2>
          <LoadingSteps
            steps={t('finalSteps')}
          />
        </div>
      )}
    </div>
  );
}

async function simulateOtherMatchesForMatchday(state, matchday, language, t) {
  let next = state;
  const fixtures = (state.fixtures || []).filter((f) => f.matchday === matchday && !f.playerMatch);
  for (const fixture of fixtures) {
    if ((next.matches || []).some((m) => m.id === fixture.id)) continue;
    const result = await api.otherMatch({
      stage: fixture.stage,
      home: fixture.home,
      away: fixture.away,
      context: t('otherMatchContext'),
      language: apiLanguage(language),
    });
    next = recordMatch(next, {
      id: fixture.id,
      matchday,
      stage: fixture.stage,
      home: fixture.home,
      away: fixture.away,
      playerMatch: false,
      score: result.score,
      stats: result.stats,
      summary: result.summary,
      keyPlayers: result.keyPlayers,
    });
  }
  return next;
}

function LanguageToggle({ value, onChange, label }) {
  return (
    <div className="language-toggle" title={label}>
      <button type="button" className={value === 'zh' ? 'active' : ''} onClick={() => onChange('zh')}>中文</button>
      <button type="button" className={value === 'en' ? 'active' : ''} onClick={() => onChange('en')}>EN</button>
    </div>
  );
}

function CommentaryToggle({ styles, value, onChange, disabled, language = 'zh' }) {
  return (
    <select
      className="commentary-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      title="Commentary"
    >
      {styles.map((s) => (
        <option key={s.id} value={s.id}>🎙 {commentaryStyleName(s, language)}</option>
      ))}
    </select>
  );
}

function commentaryStyleName(style, language = 'zh') {
  if (!style) return '';
  return language === 'en' ? style.nameEn || style.name : style.name;
}

function buildFallbackEndgameBody({ result, hist = [], language = 'zh' }) {
  const matches = Array.isArray(hist) ? hist : [];
  const wins = matches.filter((m) => m.winner === 'player').length;
  const goalsFor = matches.reduce((sum, m) => sum + Number(m.score?.player ?? 0), 0);
  const goalsAgainst = matches.reduce((sum, m) => sum + Number(m.score?.opponent ?? 0), 0);
  const last = matches[matches.length - 1];
  const route = matches
    .map((m) => `${stageName({ name: m.stage }, language)} ${m.score?.player ?? 0}:${m.score?.opponent ?? 0} ${m.opponent?.country || (language === 'en' ? 'Opponent' : '对手')}`)
    .join(language === 'en' ? '; ' : '；');
  if (language === 'en') {
    if (result === 'champion') {
      return `This is not just a loud headline, it is a complete title route: ${route || 'route unavailable'}. The Dream XI finished with ${wins} wins, ${goalsFor} goals scored and ${goalsAgainst} conceded. After the final, nobody in the dressing room talked about draw luck, because every score was already on the screen.`;
    }
    return `The Dream XI stopped at ${stageName({ name: last?.stage || '' }, language) || 'an unknown stage'}, losing the last match ${last?.score?.player ?? 0}:${last?.score?.opponent ?? 0} against ${last?.opponent?.country || 'Opponent'}. The campaign ends with ${wins} wins, ${matches.length - wins} losses, ${goalsFor} goals scored and ${goalsAgainst} conceded. Route: ${route || 'route unavailable'}.`;
  }
  if (result === 'champion') {
    return `这不是一张靠标题吓人的号外，而是一条完整冠军路线：${route || '赛程记录缺失'}。梦之队最终${wins}胜，进${goalsFor}球失${goalsAgainst}球，决赛之后更衣室没有人再讨论抽签运气，因为每一轮比分都写在屏幕上。媒体最爱的是传奇拼盘，真正决定冠军的是关键场次能不能把机会变成进球。`;
  }
  return `梦之队的旅程停在${last?.stage || '未知阶段'}，最后一战是${last?.score?.player ?? 0}:${last?.score?.opponent ?? 0}面对${last?.opponent?.country || '对手'}。整届挑战留下${wins}胜${matches.length - wins}负，进${goalsFor}球失${goalsAgainst}球。路线并不寒酸：${route || '赛程记录缺失'}。但淘汰赛的残酷就在这里，前面所有高光都不能抵消最后那个比分。`;
}

function buildFallbackRoute(hist = [], language = 'zh') {
  return (Array.isArray(hist) ? hist : [])
    .map((m) => `${stageName({ name: m.stage }, language)} ${m.score?.player ?? 0}:${m.score?.opponent ?? 0} ${m.opponent?.country || (language === 'en' ? 'Opponent' : '对手')}`)
    .join(language === 'en' ? '; ' : '；') || (language === 'en' ? 'No complete route recorded' : '暂无完整路线记录');
}

function mergeAwards(fallback, aiAwards) {
  if (!aiAwards || typeof aiAwards !== 'object') return fallback;
  const merged = { ...fallback };
  for (const [key, value] of Object.entries(aiAwards)) {
    if (hasAwardValue(value)) merged[key] = value;
  }
  for (const key of ['goldenBall', 'goldenBoot', 'goldenGlove', 'bestYoungPlayer', 'rivalStar', 'bestCoach', 'fairPlay']) {
    if (fallback[key] && aiAwards[key] && typeof aiAwards[key] === 'object') {
      merged[key] = { ...fallback[key], ...removeEmptyFields(aiAwards[key]) };
    }
  }
  return merged;
}

function hasAwardValue(value) {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() && value.trim() !== '暂无';
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.values(value).some(hasAwardValue);
  return true;
}

function removeEmptyFields(obj) {
  return Object.fromEntries(Object.entries(obj || {}).filter(([, value]) => hasAwardValue(value)));
}
