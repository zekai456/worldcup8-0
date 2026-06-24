import { useState } from 'react';
import { api } from '../api.js';
import { positionMatches } from '../positionRules.js';
import { playerStatSummary, shouldHidePlayerStats } from '../gameModes.js';
import { RosterSkeleton, SlotMachine } from './LoadingStates.jsx';
import { apiLanguage } from '../i18n.js';

const BENCH_SLOTS = [
  { id: 'BENCH_1', pos: 'SUB', label: '替补1', labelEn: 'Sub 1', bench: true },
  { id: 'BENCH_2', pos: 'SUB', label: '替补2', labelEn: 'Sub 2', bench: true },
];

export default function Draft({ formation, centerYear, eraWindow, gameMode, language = 'zh', onComplete }) {
  const slots = formation.slots;
  const allSlots = [...slots, ...BENCH_SLOTS];
  const [squad, setSquad] = useState({});
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [spin, setSpin] = useState(null);
  const [roster, setRoster] = useState([]);
  const [spinning, setSpinning] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [bioPlayer, setBioPlayer] = useState(null);
  const [bio, setBio] = useState(null);
  const [bioLoading, setBioLoading] = useState(false);
  const [bioErr, setBioErr] = useState('');
  const [savingDraft, setSavingDraft] = useState(false);
  const [reYear, setReYear] = useState(2);
  const [reCountry, setReCountry] = useState(3);
  const [err, setErr] = useState('');

  const startersFilled = slots.filter((slot) => squad[slot.id]).length;
  const benchFilled = BENCH_SLOTS.filter((slot) => squad[slot.id]).length;
  const filled = startersFilled + benchFilled;
  const done = startersFilled === slots.length && benchFilled === BENCH_SLOTS.length;

  async function doSpin({ lockYear, lockCountry } = {}) {
    setSpinning(true);
    setErr('');
    setRoster([]);
    setSelectedPlayer(null);
    setSelectedSlotId(null);
    setBioPlayer(null);
    setBio(null);
    setBioErr('');
    try {
      const res = await api.spin({
        minYear: eraWindow?.minYear,
        maxYear: eraWindow?.maxYear,
        centerYear,
        lockYear: lockYear || undefined,
        lockCountry: lockCountry || undefined,
      });
      setSpin(res);
      await loadRoster(res);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSpinning(false);
    }
  }

  async function loadRoster(nextSpin) {
    setLoadingRoster(true);
    try {
      const res = await api.squad({ year: nextSpin.year, country: nextSpin.country });
      setRoster(res.players || []);
    } catch (e) {
      setErr((language === 'en' ? 'Failed to load roster: ' : '名单获取失败：') + e.message);
      setRoster([]);
    } finally {
      setLoadingRoster(false);
    }
  }

  function respinCountry() {
    if (reCountry <= 0 || !spin) return;
    setReCountry((n) => n - 1);
    doSpin({ lockYear: spin.year, lockCountry: spin.country });
  }

  function respinYear() {
    if (reYear <= 0 || !spin) return;
    setReYear((n) => n - 1);
    doSpin({ lockCountry: spin.country });
  }

  function assignToSlot(slot) {
    const existing = squad[slot.id];
    if (selectedSlotId) {
      if (selectedSlotId === slot.id) {
        setSelectedSlotId(null);
        return;
      }
      const fromCell = squad[selectedSlotId];
      if (!fromCell) {
        setSelectedSlotId(null);
        return;
      }
      if (existing) {
        swapSlots(selectedSlotId, slot.id);
        return;
      }
      movePlacedPlayer(selectedSlotId, slot.id);
      return;
    }
    if (!selectedPlayer) {
      if (existing) {
        setErr('');
        setSelectedSlotId(slot.id);
      }
      return;
    }
    if (!canPlacePlayerInSlot(selectedPlayer, slot)) {
      setErr(language === 'en' ? `${selectedPlayer.name} cannot play ${slot.pos}` : `${selectedPlayer.name} 不能踢 ${slot.pos}`);
      return;
    }
    setErr('');
    const picked = selectedPlayer;
    const from = spin;
    setSquad((prev) => {
      const next = { ...prev };
      // a player can only occupy one slot — vacate any earlier placement of them
      for (const [slotId, cell] of Object.entries(next)) {
        if (cell.player.name === picked.name && cell.year === from.year && cell.country === from.country) {
          delete next[slotId];
        }
      }
      next[slot.id] = {
        slotId: slot.id,
        pos: slot.pos,
        year: from.year,
        country: from.country,
        host: from.host,
        player: picked,
        outOfPosition: false,
      };
      return next;
    });
    setSelectedPlayer(null);
    setSelectedSlotId(null);
    // one pick per roll: clear the current squad so the next slot needs a fresh spin
    setSpin(null);
    setRoster([]);
  }

  function clearSlot(slotId) {
    setSquad((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  }

  function movePlacedPlayer(fromSlotId, toSlotId) {
    const fromSlot = allSlots.find((sl) => sl.id === fromSlotId);
    const toSlot = allSlots.find((sl) => sl.id === toSlotId);
    const fromCell = squad[fromSlotId];
    if (!fromCell || !fromSlot || !toSlot) return;
    if (!canPlacePlayerInSlot(fromCell.player, toSlot)) {
      setErr(language === 'en' ? `${fromCell.player.name} cannot play ${toSlot.pos}` : `${fromCell.player.name} 不能踢 ${toSlot.pos}`);
      return;
    }
    setErr('');
    setSquad((prev) => {
      const next = { ...prev };
      delete next[fromSlotId];
      next[toSlotId] = { ...fromCell, slotId: toSlotId, pos: toSlot.pos, outOfPosition: false };
      return next;
    });
    setSelectedSlotId(null);
  }

  function swapSlots(fromSlotId, toSlotId) {
    const fromSlot = allSlots.find((sl) => sl.id === fromSlotId);
    const toSlot = allSlots.find((sl) => sl.id === toSlotId);
    const fromCell = squad[fromSlotId];
    const toCell = squad[toSlotId];
    if (!fromSlot || !toSlot || !fromCell || !toCell) return;
    const fromCanMove = canPlacePlayerInSlot(fromCell.player, toSlot);
    const toCanMove = canPlacePlayerInSlot(toCell.player, fromSlot);
    if (!fromCanMove || !toCanMove) {
      setErr(language === 'en'
        ? `Invalid swap: ${fromCell.player.name} must be able to play ${toSlot.pos}, and ${toCell.player.name} must be able to play ${fromSlot.pos}`
        : `不能这样换位：${fromCell.player.name} 要能踢 ${toSlot.pos}，${toCell.player.name} 要能踢 ${fromSlot.pos}`);
      return;
    }
    setErr('');
    setSquad((prev) => ({
      ...prev,
      [fromSlotId]: { ...toCell, slotId: fromSlotId, pos: fromSlot.pos, outOfPosition: false },
      [toSlotId]: { ...fromCell, slotId: toSlotId, pos: toSlot.pos, outOfPosition: false },
    }));
    setSelectedSlotId(null);
  }

  async function finish() {
    const arr = slots.map((sl) => squad[sl.id]).filter(Boolean);
    const substitutes = BENCH_SLOTS.map((sl) => squad[sl.id]).filter(Boolean);
    setSavingDraft(true);
    setErr('');
    let draftId = null;
    try {
      const saved = await api.completeDraft({
        formation: formation.name,
        centerYear,
        squad: [...arr, ...substitutes],
      });
      draftId = saved.draftId;
    } catch (e) {
      console.warn('draft save failed; continuing without draft id', e);
    } finally {
      setSavingDraft(false);
    }
    onComplete(arr, draftId, substitutes);
  }

  return (
    <div className="draft draft-board">
      <div className="draft-head">
        <h2 className="title sm">{language === 'en' ? 'Tactical Board' : '战术板'} · {formation.name}</h2>
        <div className="draft-progress">{language === 'en' ? 'XI' : '首发'} {startersFilled}/{slots.length} · {language === 'en' ? 'Subs' : '替补'} {benchFilled}/{BENCH_SLOTS.length}</div>
      </div>
      {selectedSlotId && squad[selectedSlotId] && (
        <div className="swap-hint">
          {language === 'en' ? 'Adjusting: ' : '正在调整：'}<b>{displayName(squad[selectedSlotId].player)}</b>
              <span>{language === 'en' ? 'Tap another legal slot or the bench to move. Tap the same player to cancel.' : '点击另一个合法位置或替补席完成调整，再点本人取消。'}</span>
        </div>
      )}

      <div className="draft-layout">
        <section className="draft-side">
          <RosterPanel
            spin={spin}
            roster={roster}
            selectedPlayer={selectedPlayer}
            spinning={spinning}
            loadingRoster={loadingRoster}
            reCountry={reCountry}
            reYear={reYear}
            placed={squad}
            gameMode={gameMode}
            language={language}
            onSpin={() => doSpin()}
            onRespinCountry={respinCountry}
            onRespinYear={respinYear}
            onSelect={setSelectedPlayer}
            onInspect={inspectPlayer}
          />
        </section>

        <section className="pitch board-pitch">
          <div className="pitch-lines" />
          {slots.map((sl) => {
            const cell = squad[sl.id];
            const movingCell = selectedSlotId ? squad[selectedSlotId] : null;
            const canDrop = selectedPlayer && canPlacePlayerInSlot(selectedPlayer, sl);
            const canSwap = movingCell && selectedSlotId !== sl.id && (
              cell
                ? canPlacePlayerInSlot(movingCell.player, sl) && canPlacePlayerInSlot(cell.player, allSlots.find((s) => s.id === selectedSlotId))
                : canPlacePlayerInSlot(movingCell.player, sl)
            );
            return (
              <button
                key={sl.id}
                className={`slot ${cell ? 'filled' : ''} ${canDrop || canSwap ? 'active' : ''} ${selectedSlotId === sl.id ? 'moving' : ''}`}
                style={{ left: `${sl.x}%`, bottom: `${sl.y}%` }}
                onClick={() => assignToSlot(sl)}
                title={cell ? (language === 'en' ? 'Tap to swap' : '点击选择换位') : (language === 'en' ? `Place at ${sl.pos}` : `放到 ${sl.pos}`)}
              >
                <span className="slot-pos">{sl.pos}</span>
                {cell ? (
                  <span className="slot-player">
                    <b>{cell.player.name}</b>
                    <small>{cell.year} {cell.country}</small>
                  </span>
                ) : (
                  <span className="slot-empty">+</span>
                )}
              </button>
            );
          })}
        </section>
      </div>

      <section className="bench-strip" aria-label={language === 'en' ? 'Bench' : '替补席'}>
        <div className="bench-title">
          <b>{language === 'en' ? 'Bench' : '替补席'}</b>
          <span>{language === 'en' ? 'Substitutes enter the simulation and affect depth plus tactical changes.' : '替补会进入比赛模拟，影响板凳深度和变招。'}</span>
        </div>
        <div className="bench-slots">
          {BENCH_SLOTS.map((sl) => {
            const cell = squad[sl.id];
            const movingCell = selectedSlotId ? squad[selectedSlotId] : null;
            const canDrop = !!selectedPlayer;
            const canSwap = movingCell && selectedSlotId !== sl.id;
            return (
              <button
                key={sl.id}
                className={`bench-slot ${cell ? 'filled' : ''} ${canDrop || canSwap ? 'active' : ''} ${selectedSlotId === sl.id ? 'moving' : ''}`}
                onClick={() => assignToSlot(sl)}
                title={cell ? (language === 'en' ? 'Tap to swap' : '点击选择换位') : (language === 'en' ? 'Place on bench' : '放到替补席')}
              >
                <span className="slot-pos">{language === 'en' ? sl.labelEn : sl.label}</span>
                {cell ? (
                  <span className="slot-player">
                    <b>{displayName(cell.player)}</b>
                    <small>{displayPositions(cell.player)}</small>
                  </span>
                ) : (
                  <span className="slot-empty">+</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <div className="place-actions">
        {done && (
          <button className="btn" onClick={finish} disabled={savingDraft}>
            {savingDraft ? (language === 'en' ? 'Entering match...' : '正在进入比赛…') : (language === 'en' ? 'Confirm Squad, Enter Match →' : '确认阵容，进入比赛 →')}
          </button>
        )}
      </div>

      {err && <p className="err">{err}</p>}
      {bioPlayer && (
        <PlayerBioPanel
          player={bioPlayer}
          spin={spin}
          bio={bio}
          loading={bioLoading}
          error={bioErr}
          onPick={() => {
            setSelectedPlayer(bioPlayer);
            setBioPlayer(null);
          }}
          onClose={() => setBioPlayer(null)}
          language={language}
        />
      )}
    </div>
  );

  async function inspectPlayer(player) {
    if (shouldHidePlayerStats(gameMode)) {
      setSelectedPlayer(selectedPlayer?.name === player.name ? null : player);
      return;
    }
    setSelectedPlayer(player);
    setBioPlayer(player);
    setBio(null);
    setBioErr('');
    setBioLoading(true);
    try {
      const result = await api.playerBio({
        player,
        year: spin?.year,
        country: spin?.country,
        language: apiLanguage(language),
      });
      setBio(result);
    } catch (e) {
      setBioErr((language === 'en' ? 'Failed to generate bio: ' : '生涯介绍生成失败：') + e.message);
    } finally {
      setBioLoading(false);
    }
  }
}

function RosterPanel({
  spin,
  roster,
  selectedPlayer,
  spinning,
  loadingRoster,
  reCountry,
  reYear,
  placed,
  gameMode,
  language,
  onSpin,
  onRespinCountry,
  onRespinYear,
  onSelect,
  onInspect,
}) {
  const hideStats = shouldHidePlayerStats(gameMode);
  return (
    <div className="slot-panel">
      {!spin && !spinning && (
        <>
          <p className="muted">{language === 'en' ? 'Roll an era team first, then pick players from its roster onto the pitch.' : '先摇出一个年代队伍，再从这支队的完整名单里选人放到右侧球场。'}</p>
          <button className="btn" onClick={onSpin}>{language === 'en' ? 'Spin Team' : '摇号 Spin'}</button>
        </>
      )}
      {spinning && <SlotMachine title={language === 'en' ? 'Spinning' : undefined} subtitle={language === 'en' ? 'Matching era, nation and roster' : undefined} lang={language} />}

      {spin && !spinning && (
        <>
          <div>
            <p className="muted sm">{language === 'en' ? 'Current Team' : '当前队伍'}</p>
            <h3>{spin.country} · {spin.year}</h3>
          </div>
          <div className="respin-row">
            <button className="btn ghost sm" onClick={onRespinCountry} disabled={reCountry <= 0}>
              {language === 'en' ? 'Reroll Nation' : '换国家'} ({reCountry})
            </button>
            <button className="btn ghost sm" onClick={onRespinYear} disabled={reYear <= 0}>
              {language === 'en' ? 'Reroll Era' : '换年代'} ({reYear})
            </button>
          </div>

          {loadingRoster && <RosterSkeleton lang={language} />}
          {!loadingRoster && (
            <div className="roster">
              {roster.map((p, i) => {
                const used = Object.values(placed).some((cell) => cell.player.name === p.name);
                return (
                  <button
                    key={`${p.name}-${i}`}
                    className={`fut-card ${hideStats ? 'no-stats' : ''} ${selectedPlayer?.name === p.name ? 'sel' : ''} ${used ? 'placed' : ''}`}
                    onClick={() => (hideStats ? onSelect(selectedPlayer?.name === p.name ? null : p) : onInspect(p))}
                    style={{ transform: selectedPlayer?.name === p.name ? 'scale(1.05)' : '', borderColor: selectedPlayer?.name === p.name ? 'var(--accent)' : '' }}
                  >
                    <div className="card-top">
                      <div className="rating-box">
                        <span className="rating">{!hideStats ? ratingText(p) : '-'}</span>
                        <span className="position">{displayPositions(p)}</span>
                      </div>
                    </div>
                    <div className="player-name">{displayName(p)}</div>
                    {!hideStats && (
                      <div className="stats-grid">
                        <div className="stat-row"><span className="stat-lbl">PAC</span><span className="stat-val">{p.pac || ratingText(p)}</span></div>
                        <div className="stat-row"><span className="stat-lbl">DRI</span><span className="stat-val">{p.dri || ratingText(p)}</span></div>
                        <div className="stat-row"><span className="stat-lbl">SHO</span><span className="stat-val">{p.sho || ratingText(p)}</span></div>
                        <div className="stat-row"><span className="stat-lbl">DEF</span><span className="stat-val">{p.def || ratingText(p)}</span></div>
                        <div className="stat-row"><span className="stat-lbl">PAS</span><span className="stat-val">{p.pas || ratingText(p)}</span></div>
                        <div className="stat-row"><span className="stat-lbl">PHY</span><span className="stat-val">{p.phy || ratingText(p)}</span></div>
                      </div>
                    )}
                    {hideStats && <div className="pc-meta" style={{marginTop:'10px'}}>{shirtNumberText(p) ? `#${shirtNumberText(p)}` : ''}</div>}
                    {used && <div style={{position:'absolute', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px', fontWeight:'bold', color:'var(--accent)'}}>{language === 'en' ? 'SELECTED' : '已上阵'}</div>}
                  </button>
                );
              })}
              {roster.length === 0 && <p className="muted">{language === 'en' ? 'No imported roster for this side. Reroll nation or era.' : '这支队伍暂无导入名单，请换国家或年代。'}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PlayerBioPanel({ player, spin, bio, loading, error, onPick, onClose, language = 'zh' }) {
  return (
    <div className="bio-backdrop" role="dialog" aria-modal="true">
      <section className="bio-panel">
        <div className="bio-head">
          <div>
            <span className="bio-kicker">{spin?.year || player.year || ''} {spin?.country || player.country || ''}</span>
            <h3>{displayName(player)} {shirtNumberText(player) && <small>#{shirtNumberText(player)}</small>}</h3>
          </div>
          <button className="btn ghost sm" onClick={onClose}>{language === 'en' ? 'Close' : '关闭'}</button>
        </div>
        <div className="bio-meta">
          <span>{displayPositions(player)}</span>
          <span>{language === 'en' ? 'OVR' : '总评'} {ratingText(player)}</span>
          <span>{playerStatSummary(player, language)}</span>
        </div>
        {loading && (
          <div className="bio-loading">
            <b>{language === 'en' ? 'Generating career profile' : '正在生成生涯介绍'}</b>
            <span>{language === 'en' ? 'Checking World Cup memories, club path and playing style...' : '检索世界杯经历、俱乐部轨迹与技术特点…'}</span>
          </div>
        )}
        {error && <p className="err">{error}</p>}
        {bio && (
          <div className="bio-body">
            <h4>{bio.title}</h4>
            {bio.summary && <p>{bio.summary}</p>}
            <BioList title={language === 'en' ? 'Career Notes' : '生涯节点'} items={bio.career} />
            <BioList title={language === 'en' ? 'World Cup Memory' : '世界杯记忆'} items={bio.worldCup} />
            <BioList title={language === 'en' ? 'Style Tags' : '技术标签'} items={bio.style} compact />
            {bio.trivia && <p className="bio-trivia">{bio.trivia}</p>}
          </div>
        )}
        <div className="bio-actions">
          <button className="btn" onClick={onPick}>{language === 'en' ? 'Add to Squad' : '加入阵容'}</button>
        </div>
      </section>
    </div>
  );
}

function BioList({ title, items = [], compact = false }) {
  if (!items.length) return null;
  return (
    <div className={`bio-list ${compact ? 'compact' : ''}`}>
      <strong>{title}</strong>
      <div>
        {items.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
      </div>
    </div>
  );
}

function canPlacePlayerInSlot(player, slot) {
  if (!slot || slot.bench || slot.pos === 'SUB') return true;
  return canPlayPosition(player, slot.pos);
}

function canPlayPosition(player, slotPos) {
  const positions = Array.isArray(player.positions) && player.positions.length
    ? player.positions
    : [player.pos];
  return positions.some((p) => positionMatches(String(p).toUpperCase(), slotPos));
}

function ratingText(player) {
  const rating = player.overall ?? player.rating;
  return rating == null ? '-' : rating;
}

function shirtNumberText(player) {
  const number = player.shirtNumber ?? player.number ?? player.jerseyNumber;
  return number == null ? '' : String(number);
}

function displayPositions(player) {
  const positions = Array.isArray(player.positions) && player.positions.length
    ? player.positions
    : [player.pos];
  return positions.slice(0, 3).join('/');
}

function displayName(player) {
  return player.nameZh || player.name;
}
