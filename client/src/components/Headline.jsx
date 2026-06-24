import { shouldHidePlayerStats, playerStatSummary } from '../gameModes.js';

// Endgame newspaper card (champion or eliminated) + shareable.
export default function Headline({ card, awards, outcome, onRestart, gameMode, squad = [], history = [], language = 'zh', t }) {
  if (!card) return null;
  const revealStats = shouldHidePlayerStats(gameMode);
  return (
    <div className="endgame">
      <div className={`newspaper ${outcome === 'champion' ? 'champ' : 'doom'}`}>
        <div className="paper-name">{card.paper || '号外'}</div>
        <h1 className="headline">{card.headline}</h1>
        {card.subhead && <p className="subhead">{card.subhead}</p>}
        <div className="news-rule" />
        {card.verdict && <p className="news-verdict">{card.verdict}</p>}
        <p className="news-body">{card.body}</p>
        {card.route && (
          <div className="news-route">
            <span>{language === 'en' ? 'Actual Route' : '真实路线'}</span>
            <p>{card.route}</p>
          </div>
        )}
        {card.rating && (
          <div className="rating-stamp">{language === 'en' ? 'Legend Rating: ' : '传奇评级：'}{card.rating}</div>
        )}
      </div>
      {awards && (
        <section className="card awards-card">
          <h2 className="section-title">{language === 'en' ? 'Tournament Awards' : '赛事评奖'}</h2>
          <div className="award-grid">
            <Award title={language === 'en' ? 'Golden Ball' : '金球奖'} value={awardName(awards.goldenBall)} note={awards.goldenBall?.reason} language={language} />
            <Award title={language === 'en' ? 'Golden Boot' : '金靴奖'} value={awardName(awards.goldenBoot)} note={awards.goldenBoot?.reason || goalsText(awards.goldenBoot, language)} language={language} />
            <Award title={language === 'en' ? 'Golden Glove' : '金手套'} value={awardName(awards.goldenGlove)} note={awards.goldenGlove?.reason} language={language} />
            <Award title={language === 'en' ? 'Best Young Player' : '最佳年轻球员'} value={awardName(awards.bestYoungPlayer)} note={awards.bestYoungPlayer?.reason} language={language} />
            <Award title={language === 'en' ? 'Best Rival Star' : '对手最佳球星'} value={awardName(awards.rivalStar)} note={awards.rivalStar?.reason} language={language} />
            <Award title={language === 'en' ? 'Best Coach' : '最佳主帅'} value={awardName(awards.bestCoach)} note={awards.bestCoach?.reason} language={language} />
            <Award title={language === 'en' ? 'Fair Play' : '公平竞赛奖'} value={awardName(awards.fairPlay)} note={awards.fairPlay?.reason} language={language} />
          </div>
          <div className="leaderboard-grid">
            <Leaderboard title={language === 'en' ? 'Scoring Leaders' : '射手榜'} rows={awards.scoringLeaders} valueKey="goals" suffix={language === 'en' ? ' G' : '球'} language={language} />
            <Leaderboard title={language === 'en' ? 'Assist Leaders' : '助攻榜'} rows={awards.assistLeaders} valueKey="assists" suffix={language === 'en' ? ' A' : '助'} language={language} />
            <Leaderboard title={language === 'en' ? 'MVP Table' : 'MVP榜'} rows={awards.mvpLeaders} valueKey="points" suffix={language === 'en' ? ' pts' : '分'} language={language} />
            <Leaderboard title={language === 'en' ? 'Save Leaders' : '扑救榜'} rows={awards.saveLeaders} valueKey="saves" suffix={language === 'en' ? ' saves' : '扑'} language={language} />
          </div>
          {awards.ceremony && <p className="ceremony">{awards.ceremony}</p>}
          {Array.isArray(awards.teamOfTournament) && (
            <p className="team-awards">{language === 'en' ? 'Team of the Tournament: ' : '最佳阵容：'}{awards.teamOfTournament.join(language === 'en' ? ', ' : '、')}</p>
          )}
          {Array.isArray(awards.achievementBadges) && (
            <div className="badge-grid">
              {awards.achievementBadges.map((badge) => (
                <div key={badge.title} className="achievement-badge">
                  <span>{badge.title}</span>
                  <strong>{badge.value}</strong>
                  {badge.note && <small>{badge.note}</small>}
                </div>
              ))}
            </div>
          )}
          {Array.isArray(awards.technicalSummary) && (
            <div className="technical-summary">
              <div className="summary-head">
                <b>{t('dreamTeam')}</b>
                <span>{language === 'en' ? 'Tournament Stats' : '赛事技术汇总'}</span>
                <b>{language === 'en' ? 'Opponents' : '对手合计'}</b>
              </div>
              {awards.technicalSummary.map((row) => (
                <div key={row.label} className="summary-row">
                  <strong>{row.mine}</strong>
                  <span>{row.label}</span>
                  <strong>{row.rivals}</strong>
                </div>
              ))}
            </div>
          )}
          {Array.isArray(awards.teamStatsLeaders) && (
            <div className="team-stat-board">
              <h3>{language === 'en' ? 'Team Stat Leaders' : '球队技术榜'}</h3>
              {awards.teamStatsLeaders.map((row) => (
                <div key={row.label} className="team-stat-row">
                  <strong>{row.label}</strong>
                  <span>{row.mine}</span>
                  <b>{row.leader || (language === 'en' ? 'Tied' : '并列')}</b>
                  <span>{row.rivals}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      {revealStats && (
        <section className="card reveal-card">
          <h2 className="section-title">{language === 'en' ? 'Expert Mode Data Reveal' : '专家模式数据揭晓'}</h2>
          <div className="record-row">
            <span>{language === 'en' ? 'Final Record' : '最终战绩'}</span>
            <b>{history.filter((h) => h.winner === 'player').length} {language === 'en' ? 'wins' : '胜'} / {history.length} {language === 'en' ? 'matches' : '场'}</b>
          </div>
          <div className="reveal-list">
            {squad.map((cell) => (
              <div key={`${cell.slotId}-${cell.player?.name}`} className="reveal-player">
                <span className="rp-pos">{cell.pos}</span>
                <strong>
                  {cell.player?.nameZh || cell.player?.name}
                  {shirtNumberText(cell.player) && <small>#{shirtNumberText(cell.player)}</small>}
                </strong>
                <b>{cell.player?.overall ?? cell.player?.rating ?? '-'}</b>
                <small>{playerStatSummary(cell.player || {}, language)}</small>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="row center" style={{ justifyContent: 'center', marginTop: 20 }}>
        <button className="btn" onClick={onRestart}>
          {outcome === 'champion' ? (language === 'en' ? 'Build Another Dynasty' : '再创王朝') : (language === 'en' ? 'Restart' : '一键重开')}
        </button>
      </div>
    </div>
  );
}

function Award({ title, value, note, language = 'zh' }) {
  return (
    <div className="award-card">
      <span>{title}</span>
      <strong>{value || (language === 'en' ? 'Pending' : '待评定')}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function Leaderboard({ title, rows = [], valueKey, suffix, language = 'zh' }) {
  const list = Array.isArray(rows) ? rows.filter(Boolean).slice(0, 6) : [];
  if (!list.length) return null;
  return (
    <div className="leaderboard-card">
      <h3>{title}</h3>
      {list.map((row, index) => (
        <div key={`${title}-${row.player || row.name || index}`} className="leader-row">
          <em>{index + 1}</em>
          <span>
            <strong>{row.player || row.name || row.winner || (language === 'en' ? 'Pending player' : '待定球员')}</strong>
            <small>{row.team || (language === 'en' ? 'World Cup' : '世界杯')}</small>
          </span>
          <b>{row[valueKey] ?? 0}{suffix}</b>
        </div>
      ))}
    </div>
  );
}

function awardName(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.winner || value.name || value.team || '';
}

function goalsText(value, language = 'zh') {
  return value?.goals != null ? `${value.goals}${language === 'en' ? ' goals' : ' 球'}` : '';
}

function shirtNumberText(player = {}) {
  const number = player.shirtNumber ?? player.number ?? player.jerseyNumber;
  return number == null ? '' : String(number);
}
