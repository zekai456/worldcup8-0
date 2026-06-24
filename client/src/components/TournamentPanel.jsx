import { groupStandings } from '../tournamentState.js';
import { stageName } from '../i18n.js';

export default function TournamentPanel({ state, language = 'zh' }) {
  if (!state) return null;
  const table = groupStandings(state);
  return (
    <section className="tournament-panel">
      <div className="mini-table">
        <h3>{language === 'en' ? 'Group Table' : '小组积分榜'}</h3>
        <div className="standings-head">
          <span>{language === 'en' ? 'Team' : '球队'}</span>
          <span>{language === 'en' ? 'P' : '赛'}</span>
          <span>{language === 'en' ? 'W' : '胜'}</span>
          <span>{language === 'en' ? 'D' : '平'}</span>
          <span>{language === 'en' ? 'L' : '负'}</span>
          <span>{language === 'en' ? 'GD' : '净'}</span>
          <span>{language === 'en' ? 'Pts' : '分'}</span>
        </div>
        {table.map((row) => (
          <div key={row.team} className={`standings-row ${row.team === state.playerTeam ? 'mine' : ''}`}>
            <span>{row.team}</span>
            <span>{row.played}</span>
            <span>{row.win}</span>
            <span>{row.draw}</span>
            <span>{row.loss}</span>
            <span>{row.gf - row.ga}</span>
            <b>{row.pts}</b>
          </div>
        ))}
      </div>
      <div className="fixture-list">
        <h3>{language === 'en' ? 'Fixtures' : '对阵表'}</h3>
        {state.fixtures.slice(0, 11).map((fixture) => {
          const played = (state.matches || []).find((m) => m.id === fixture.id);
          return (
            <div key={fixture.id} className={`fixture-row ${fixture.playerMatch ? 'mine' : ''}`}>
              <span>{stageName({ name: fixture.stage }, language)}</span>
              <strong>{teamLabel(fixture, 'home')} vs {teamLabel(fixture, 'away')}</strong>
              <b>{played ? scoreText(played) : (language === 'en' ? 'TBD' : '未赛')}</b>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function teamLabel(fixture, side) {
  const name = fixture[side];
  const year = side === 'home' ? fixture.homeYear : fixture.opponentYear || fixture.awayYear;
  const tag = side === 'home' ? fixture.homeTag : fixture.opponentTag || fixture.awayTag;
  if (!year || name === '我的梦之队' || name === '待定') return name;
  return `${year} ${name}${tag ? ` · ${tag}` : ''}`;
}

function scoreText(match) {
  const home = match.score?.home ?? match.score?.player ?? 0;
  const away = match.score?.away ?? match.score?.opponent ?? 0;
  return `${home}:${away}`;
}
