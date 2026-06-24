// All LLM prompt builders + high-level game operations.
// Every match/commentary/press/headline call routes through here so the
// "LLM is the referee" design stays in one place.

import { chat, chatJson } from './llm.js';
import { editionByYear } from './wcData.js';
import { posLabel } from './formations.js';
import { normalizeMatchResult } from './matchEngine.js';
import { normalizePlayerBio } from './playerBio.js';
import { stageByMatchday } from './tournament.js';

// ---------------------------------------------------------------------------
// Commentary styles (PRD 5.1)
// ---------------------------------------------------------------------------
export const COMMENTARY_STYLES = {
  passion: {
    name: '激情解说流',
    nameEn: 'Passionate Broadcast',
    hint: '狂热、战术分析透彻、足球典故信手拈来、充满激情，类似经典詹俊风格。多用感叹（"这球有了！天呐！"）。',
    hintEn: 'Energetic, tactical and story-rich, like a high-intensity TV commentator.',
  },
  savage: {
    name: '极度毒舌流',
    nameEn: 'Savage Punditry',
    hint: '英伦吐槽风，专注调侃球星失误、历史八卦和名梗，反讽幽默，损得有水平。',
    hintEn: 'British-style roasting, sharp jokes, historical references and sarcastic bite.',
  },
  retro: {
    name: '复古收音机风',
    nameEn: 'Retro Radio',
    hint: '1930年代收音机播报，单调、严肃、带时代旧词汇（如"线卫""跑卫""首席部长"），仿佛带着沙沙杂音。',
    hintEn: '1930s radio style, formal, grainy and old-fashioned.',
  },
};

function isEnglish(language) {
  return /^en/i.test(String(language || ''));
}

function outputLanguageRule(language) {
  return isEnglish(language)
    ? 'Output all human-readable text in natural English. Keep JSON keys exactly as specified.'
    : '所有给玩家看的文字都使用简体中文。JSON key 保持指定格式。';
}

// ---------------------------------------------------------------------------
// 1. Squad generation (year + country -> ~20 real players with positions)
// ---------------------------------------------------------------------------
export async function generateSquad(year, country) {
  const messages = [
    {
      role: 'system',
      content:
        '你是足球历史数据库专家。给定世界杯年份和国家队，输出该队在那届世界杯的真实参赛球员名单（尽量贴近史实）。只输出JSON。',
    },
    {
      role: 'user',
      content: `请给出 ${year} 年世界杯 ${country} 国家队的参赛球员名单。
要求：
- 列出约 18-22 名真实球员（尽量符合史实；知名球星必须准确，记忆不全时按该队该时代风格合理补全）。
- 每名球员标注主位置代码，取值范围：GK, LB, RB, CB, LWB, RWB, CDM, CM, LM, RM, CAM, LW, RW, ST。
- shirtNumber 为该届世界杯常用球衣号码；不确定时填 null，不要瞎编。
- rating 为 1-99 的能力评分（参考该球员当时水平与历史地位）。
- 同一名球员不同年份要按该届实际竞技状态分别评分，例如年轻、巅峰、老年时期不能共用同一个 rating。
- 严格输出如下JSON：
{
  "players": [
    { "name": "球员中文名", "pos": "ST", "shirtNumber": 10, "rating": 92, "note": "一句话特点" }
  ]
}`,
    },
  ];
  const data = await chatJson(messages, { maxTokens: 4000, temperature: 0.7 });
  const players = Array.isArray(data.players) ? data.players : [];
  return players
    .filter((p) => p && p.name && p.pos)
    .map((p) => ({
      name: String(p.name).slice(0, 40),
      pos: String(p.pos).toUpperCase(),
      shirtNumber: normalizeShirtNumber(p.shirtNumber ?? p.number ?? p.jerseyNumber),
      rating: Number(p.rating) || 75,
      note: String(p.note || '').slice(0, 60),
    }));
}

export async function enrichPlayerPositions({ year, country, players }) {
  const compactPlayers = (Array.isArray(players) ? players : []).map((p) => ({
    name: p.name,
    officialPosition: p.officialPosition || p.pos,
    note: p.note || '',
  }));
  const data = await chatJson(
    [
      {
        role: 'system',
        content:
          '你是严谨的足球资料校对员。任务是把世界杯官方名单里的粗略位置(DF/MF/FW)补成球员真实常用细分位置。只能根据真实足球史和球员实际位置回答；不确定时给最保守、最常见的1个位置。只输出JSON。',
      },
      {
        role: 'user',
        content: `${year}年世界杯 ${country} 队球员位置补全。
要求：
- 每名球员 positions 只能使用这些代码：GK, LB, RB, CB, LWB, RWB, CDM, CM, LM, RM, CAM, LW, RW, ST。
- 每名球员最多2个位置，按该届世界杯/国家队最常踢的位置优先排序。
- 禁止输出 DF, MF, FW，也不要编造不存在的位置。
- nameZh 使用中文常用译名，已有中文名则原样返回。
- 严格输出JSON：
{
  "players": [
    { "name": "原始英文名", "nameZh": "中文常用名", "positions": ["RB", "CB"] }
  ]
}
待补全球员：${JSON.stringify(compactPlayers)}`,
      },
    ],
    { maxTokens: 3500, temperature: 0.2 }
  );
  return data;
}

export async function enrichPlayerAppearances({ year, country, players }) {
  const compactPlayers = (Array.isArray(players) ? players : []).map((p) => ({
    name: p.name,
    nameZh: p.nameZh || '',
    year: p.year || year,
    country: p.country || country,
    pos: p.pos,
    positions: p.positions || [p.pos],
    currentOverall: p.currentOverall ?? null,
    note: p.note || '',
  }));
  const data = await chatJson(
    [
      {
        role: 'system',
        content:
          '你是严谨的世界杯球员资料校对员。根据球员在指定世界杯年份的真实状态，补全中文名、球衣号码、当届能力评分。只输出JSON；不确定号码填null，禁止编造离谱号码。',
      },
      {
        role: 'user',
        content: `${year}年世界杯 ${country} 队球员当届资料校对。
要求：
- name 必须沿用输入的原始英文名，方便系统匹配。
- nameZh 使用中文常用译名。
- shirtNumber 为该届世界杯常用球衣号码；不确定填 null。
- overall 为1-99整数，按该届世界杯前后的真实竞技状态评分，不是生涯巅峰总评。
- 同一球员不同年份不能机械复用同一个分数；年轻、巅峰、下滑期要体现差异。
- 严格输出JSON：
{
  "players": [
    { "name": "Lionel Messi", "year": 2022, "country": "阿根廷", "nameZh": "梅西", "shirtNumber": 10, "overall": 91 }
  ]
}
待校对球员：${JSON.stringify(compactPlayers)}`,
      },
    ],
    { maxTokens: 3500, temperature: 0.15 }
  );
  return data;
}

// ---------------------------------------------------------------------------
// 2. Era profile (short flavor text for the timeline slider)
// ---------------------------------------------------------------------------
export async function eraProfile(year, language = 'zh-CN') {
  const ed = editionByYear(year);
  const host = ed ? ed.host : '';
  const english = isEnglish(language);
  const raw = await chat(
    [
      { role: 'system', content: english ? 'You are a football history commentator. Describe the given World Cup in under 16 English words, vivid and era-specific. No quotation marks.' : '你是足球历史解说。用30字以内中文描述给定世界杯的经典定格画面，富有年代感，不要引号。' },
      { role: 'user', content: english ? `One classic frozen image from the ${year} World Cup (host: ${host}):` : `${year}年世界杯（主办：${host}）的一句经典历史定格描述：` },
    ],
    { maxTokens: 800, temperature: 1.0 }
  );
  return raw.replace(/^["“”]+|["“”]+$/g, '').slice(0, 60);
}

export async function playerCareerBio({ player, year, country, language = 'zh-CN' }) {
  const languageRule = outputLanguageRule(language);
  const data = await chatJson(
    [
      {
        role: 'system',
        content:
          `你是严谨、会讲故事的足球资料编辑。根据真实足球史，为游戏里的球员卡生成简洁生涯介绍。只输出JSON；不要编造不存在的重大荣誉。${languageRule}`,
      },
      {
        role: 'user',
        content: `球员：${player?.nameZh || player?.name}
英文/原名：${player?.name || ''}
抽中队伍：${year || player?.year || '?'}年 ${country || player?.country || '?'}
位置：${Array.isArray(player?.positions) ? player.positions.join('/') : player?.pos || ''}
号码：${player?.shirtNumber ?? '未知'}
总评：${player?.overall ?? player?.rating ?? '未知'}

请给经典模式生成球员生涯介绍，严格JSON：
{
  "title": "一句短标题",
  "summary": "80字以内概括生涯地位与特点",
  "career": ["生涯节点1", "生涯节点2", "生涯节点3"],
  "worldCup": ["世界杯经历1", "世界杯经历2"],
  "style": ["技术特点1", "技术特点2", "技术特点3"],
  "trivia": "一个可靠冷知识，不确定则空字符串"
}`,
      },
    ],
    { maxTokens: 1800, temperature: 0.55 }
  );
  return normalizePlayerBio({ player, data });
}

// ---------------------------------------------------------------------------
// 3. Pre-match Roguelike event (PRD 4.2) — 40% chance handled by caller
// ---------------------------------------------------------------------------
export async function preMatchEvent({ round, squad, formation, language = 'zh-CN' }) {
  const stage = stageByMatchday(round);
  const languageRule = outputLanguageRule(language);
  const squadBrief = squad
    .map((s) => `${s.player?.name || '空缺'}(${posLabel(s.pos)}, ${s.year || ''}${s.country || ''})`)
    .join('、');
  const data = await chatJson(
    [
      {
        role: 'system',
        content:
          `你是足球经理游戏的剧情编剧。生成一个赛前突发事件（Roguelike），围绕玩家阵中的某名真实球员，戏剧化、有梗。只输出JSON。${languageRule}`,
      },
      {
        role: 'user',
        content: `2026世界杯挑战 ${stage.name} 赛前。玩家阵容(${formation})：${squadBrief}。
生成一个赛前突发事件，必须点名阵中一名具体球员，给出3个抉择选项。严格JSON：
{
  "title": "事件标题",
  "desc": "事件描述（80字内，戏剧化）",
  "target_player": "涉及的球员名",
  "options": [
    { "key": "A", "label": "选项文本", "effect_hint": "对本场的潜在影响（简短）" },
    { "key": "B", "label": "选项文本", "effect_hint": "..." },
    { "key": "C", "label": "选项文本", "effect_hint": "..." }
  ]
}`,
      },
    ],
    { maxTokens: 2000, temperature: 1.1 }
  );
  return data;
}

// ---------------------------------------------------------------------------
// 4. Match simulation + 3-stage commentary (PRD 4 & 5, prompt template §7)
// ---------------------------------------------------------------------------
export async function simulateMatch({
  round,
  formation,
  squad,
  bench = [],
  opponent,
  commentaryStyle = 'passion',
  consequences = [],
  teamAssessment = null,
  matchVerdict = null,
  language = 'zh-CN',
}) {
  const style = COMMENTARY_STYLES[commentaryStyle] || COMMENTARY_STYLES.passion;
  const stage = stageByMatchday(round);
  const squadJson = squad.map((s) => ({
    slot: s.pos,
    position: posLabel(s.pos),
    player: s.player?.name || '空缺',
    from: `${s.year || '?'} ${s.country || '?'}`,
    rating: s.player?.overall ?? s.player?.rating ?? null,
    pace: s.player?.pace ?? null,
    shooting: s.player?.shooting ?? null,
    passing: s.player?.passing ?? null,
    dribbling: s.player?.dribbling ?? null,
    defending: s.player?.defending ?? null,
    physical: s.player?.physical ?? null,
    outOfPosition: !!s.outOfPosition,
  }));
  const benchJson = bench.map((s) => ({
    slot: s.slotId || 'BENCH',
    player: s.player?.nameZh || s.player?.name || '空缺',
    positions: Array.isArray(s.player?.positions) ? s.player.positions : [s.player?.pos || s.pos].filter(Boolean),
    from: `${s.year || '?'} ${s.country || '?'}`,
    rating: s.player?.overall ?? s.player?.rating ?? null,
    note: s.player?.note || '',
  }));
  const assessment = teamAssessment || null;
  const difficulty = assessment?.difficulty || { requiredScore: 80, stageName: stage.name };
  const forceHarder = assessment && !assessment.canWinWorldCup && round >= 4;
  const verdict = matchVerdict || null;
  const languageRule = outputLanguageRule(language);

  const consequenceText = consequences.length
    ? consequences.map((c) => `- ${c}`).join('\n')
    : '- 无';

  const data = await chatJson(
    [
      {
        role: 'system',
        content: `# Role
你是一位拥有40年足球战术研究经验、资深足球评论员兼幽默感十足的游戏关卡主裁判。

# Task
根据玩家组建的11人制历史梦之队和对手数据，在不使用死板数值公式的前提下，推演比赛走向，生成比分、可连续播放的详细解说、技术统计及下场发布会提问。

# Rules & Logic
1. 战术解析：评估11个槽位是否放了正确位置的球员。检查攻守平衡、中场拦截硬度、进攻线默契度。错位球员（outOfPosition=true）在其位置上会造成灾难性后果。
2. 时代大碰撞：远古踢法面对现代高位逼抢，缺乏现代体能时后半场易崩盘。
3. 性格冲突：球权分配，巨星过多导致内讧、球权不够。
4. 必须先基于 teamAssessment 深入分析玩家阵容，再决定比赛走势。解说高光必须引用具体阵容结构、球员位置、三线强弱或搭配问题，不能写成泛泛模板。
5. 比分结果：严禁出现0-0。必须分出胜负（平局自动进入加时或点球）。
6. 赛制：这是2026世界杯挑战，路径为3场小组赛+32强+16强+8强+半决赛+决赛。本场是${stage.name}，越接近决赛强度越高。
7. 难度门槛：本阶段要求综合强度约 ${difficulty.requiredScore}。如果 teamAssessment.canWinWorldCup=false，淘汰赛阶段玩家不应轻易获胜；除非阵容优势在具体战术上说得通，否则应被强队淘汰。半决赛和决赛尤其严格，数值、位置适配、防线、门将和中场控制至少要有三项达标才可能夺冠。
8. 本地裁判结论优先：如果提供了 matchVerdict，必须尊重其中 winner、suggested_score、decided_by 和 rationale；你的任务是把这个结论解释得可信，不要擅自反转胜负。
9. 替补席影响：2名替补不是首发，但要作为板凳深度、位置覆盖、落后时变招、体能后手来分析；不得把替补能力简单加到首发总评。
10. 解说风格：${style.name} —— ${style.hint}
11. 解说必须像真实电视转播，不是只吹玩家一边：
    a) highlights 生成14到18条，只写关键事件，不写普通倒脚水文；
    b) 必须覆盖双方事件：玩家关键事件至少6条，对手关键事件至少6条；如果比分悬殊，落后一方也要有威胁进攻、任意球、角球或门将扑救镜头；
    c) 事件类型要丰富，必须至少包含这些非进球事件中的6类：corner（角球）、free_kick（任意球）、save（扑救）、big_chance（重大机会）、yellow_card（黄牌）、substitution（换人）、penalty（点球/点球争议）、tactic（战术调整）；
    d) 进球事件 kind 必须写 "goal"，scorer 写 "player" 或 "opponent"；非进球事件 scorer 必须写 "none"，side 写 "player" 或 "opponent" 表示是哪一方的关键事件；
    e) 每段都要像解说员正在播比赛：交代谁拿球、谁防守、事件结果是什么。不要只写结论，不要只写情绪；
    f) 正文不要自己编造与score矛盾的数字比分；系统会按最终score补全每个进球后的实时比分；
    g) 每段正文55到120字，必须有动作链和画面，不要短句糊弄。进球、点球、红黄牌、门将神扑可以更激烈；角球和任意球要说清发球、争顶/射门、解围/扑救。
12. highlights 里 scorer="player" 的条数必须等于 score.player，scorer="opponent" 的条数必须等于 score.opponent；scorer="none" 不计入比分。
13. ${languageRule}`,
      },
      {
        role: 'user',
        content: `# Input Data
- 玩家阵型: ${formation}
- 玩家11人名单: ${JSON.stringify(squadJson, null, 0)}
- 玩家2名替补: ${JSON.stringify(benchJson, null, 0)}
- 对手: ${opponent.year}年 ${opponent.country} 国家队${opponent.tag ? `（${opponent.tag}）` : ''}${opponent.strength ? `，历史强度${opponent.strength}` : ''}${opponent.champion === false ? '，非冠军经典强队' : ''}
- 赛程: 2026世界杯挑战 · ${stage.name}
- 系统战术评估: ${JSON.stringify(assessment, null, 0)}
- 本地胜负裁判: ${JSON.stringify(verdict ? {
    player_power: verdict.playerPower,
    opponent_power: verdict.opponentPower,
    score_delta: verdict.scoreDelta,
    winner: verdict.winner,
    suggested_score: verdict.score,
    decided_by: verdict.decidedBy,
    rationale: verdict.rationale,
  } : null, null, 0)}
- 结果约束: ${forceHarder ? '玩家阵容未达本阶段夺冠门槛。本场若仍让玩家晋级，必须在analysis里给出非常具体且可信的战术理由；否则倾向对手获胜。' : '玩家阵容达到或接近本阶段门槛，可以根据具体战术优劣决定胜负。'}
- 突发事件与历史发布会影响:
${consequenceText}

# Output Format (严格JSON)
{
  "score": { "player": 3, "opponent": 2 },
  "winner": "player" 或 "opponent",
  "decided_by": "regular" | "extra_time" | "penalties",
  "analysis": {
    "lineup_read": "阵容读法：必须点出2-3名具体球员和他们所在位置",
    "player_strengths": ["具体优势1", "具体优势2"],
    "player_weaknesses": ["具体弱点1", "具体弱点2"],
    "why_result_happened": "为什么这个比分符合阵容强弱与搭配"
  },
  "match_flow": "比赛走势简述（90字内）",
  "stats": {
    "possession": { "player": 54, "opponent": 46 },
    "shots": { "player": 15, "opponent": 10 },
    "shotsOnTarget": { "player": 7, "opponent": 4 },
    "xg": { "player": 2.4, "opponent": 1.3 },
    "bigChances": { "player": 4, "opponent": 2 },
    "passes": { "player": 512, "opponent": 438 },
    "passAccuracy": { "player": 86, "opponent": 82 },
    "corners": { "player": 6, "opponent": 3 },
    "saves": { "player": 3, "opponent": 5 },
    "attacks": { "player": 118, "opponent": 91 },
    "discipline": {
      "yellowCards": { "player": 1, "opponent": 3 },
      "fouls": { "player": 11, "opponent": 15 }
    }
  },
  "highlights": [
    { "phase": "first_half", "minute": 12, "kind": "corner", "side": "opponent", "scorer": "none", "text": "对手角球开到前点，梦之队中卫和门将同时出击，第一点被蹭到后点，最后靠边后卫在门线附近解围。" },
    { "phase": "first_half", "minute": 23, "kind": "goal", "side": "player", "scorer": "player", "text": "解说词..." },
    { "phase": "second_half", "minute": 64, "kind": "free_kick", "side": "player", "scorer": "none", "text": "解说词..." },
    { "phase": "climax", "minute": 91, "kind": "save", "side": "opponent", "scorer": "none", "text": "终场前关键扑救/争议/绝杀前奏解说词..." }
  ],
  "mvp": "本场最佳球员名",
  "worst": "本场表现最差球员名",
  "press_question": "赛后记者提问（极其尖锐，针对本场最差球员或战术弱点）"
}`,
      },
    ],
    { maxTokens: 6500, temperature: 0.85 }
  );

  const fixedData = verdict ? enforceVerdict(data, verdict) : data;
  const richData = await ensureAiRichCommentary({
    data: fixedData,
    round,
    formation,
    squadJson,
    benchJson,
    opponent,
    stage,
    assessment,
    verdict,
    language,
    style,
  });

  return normalizeMatchResult({
    round,
    raw: richData,
    opponentCountry: opponent.country,
    language,
  });
}

function enforceVerdict(data, verdict) {
  return {
    ...data,
    score: verdict.score || data?.score,
    winner: verdict.winner || data?.winner,
    decided_by: verdict.decidedBy || data?.decided_by,
    analysis: {
      ...(data?.analysis || {}),
      local_verdict: verdict.rationale,
    },
  };
}

async function ensureAiRichCommentary({ data, round, formation, squadJson, benchJson, opponent, stage, assessment, verdict, language, style }) {
  const highlights = Array.isArray(data?.highlights) ? data.highlights : [];
  const score = data?.score || verdict?.score || { player: 2, opponent: 1 };
  const goalCount = highlights.filter((h) => h?.scorer === 'player' || h?.scorer === 'opponent').length;
  const nonGoalKinds = new Set(highlights.filter((h) => h?.scorer === 'none').map((h) => h.kind));
  const playerEvents = highlights.filter((h) => h?.side === 'player' || h?.scorer === 'player').length;
  const opponentEvents = highlights.filter((h) => h?.side === 'opponent' || h?.scorer === 'opponent').length;
  const needsExpansion =
    highlights.length < 14 ||
    goalCount !== Number(score.player || 0) + Number(score.opponent || 0) ||
    nonGoalKinds.size < 6 ||
    playerEvents < 6 ||
    opponentEvents < 6;
  if (!needsExpansion) return data;

  const languageRule = outputLanguageRule(language);
  const expanded = await chatJson(
    [
      {
        role: 'system',
        content: `你是电视足球转播总导演和现场解说。你的任务不是改赛果，而是把已经确定的比分扩写成完整、真实、双方都有戏份的比赛流。只输出JSON。${languageRule}

硬性规则：
1. 绝对保留给定 score、winner、decided_by、stats、mvp、worst、press_question，不得改胜负。
2. highlights 必须生成14到18条，全部是你新写的 AI 解说，不要使用固定模板。
3. scorer="player" 的 goal 条数必须等于 score.player；scorer="opponent" 的 goal 条数必须等于 score.opponent。
4. 非进球事件 scorer 必须是 "none"，side 必须是 "player" 或 "opponent"。
5. 必须至少包含6类非进球事件：corner, free_kick, save, big_chance, yellow_card, substitution, penalty, tactic 中任选至少6类。
6. 双方都要有关键事件：player 侧至少6条，opponent 侧至少6条。
7. minute 必须从1到120基本递增；text 内不要写任何比分数字，系统会自动插入比分。
8. 每条 text 55到130字，要像真实解说正在播：谁拿球、谁防守、发生什么、结果怎样。`,
      },
      {
        role: 'user',
        content: `既定比赛：
- round: ${round}
- stage: ${stage.name}
- formation: ${formation}
- commentary_style: ${style.name} / ${style.hint}
- opponent: ${opponent.year} ${opponent.country}${opponent.tag ? ` (${opponent.tag})` : ''}
- fixed_score: ${JSON.stringify(score)}
- fixed_winner: ${data?.winner || verdict?.winner}
- fixed_decided_by: ${data?.decided_by || verdict?.decidedBy || 'regular'}
- fixed_stats: ${JSON.stringify(data?.stats || {})}
- fixed_mvp: ${data?.mvp || ''}
- fixed_worst: ${data?.worst || ''}
- fixed_press_question: ${data?.press_question || ''}
- tactical_assessment: ${JSON.stringify(assessment || {})}
- squad: ${JSON.stringify(squadJson)}
- bench: ${JSON.stringify(benchJson)}
- original_analysis: ${JSON.stringify(data?.analysis || {})}
- original_match_flow: ${data?.match_flow || ''}

输出严格JSON：
{
  "score": ${JSON.stringify(score)},
  "winner": "${data?.winner || verdict?.winner || 'player'}",
  "decided_by": "${data?.decided_by || verdict?.decidedBy || 'regular'}",
  "analysis": { "lineup_read": "...", "player_strengths": ["..."], "player_weaknesses": ["..."], "why_result_happened": "..." },
  "match_flow": "90字内完整走势",
  "stats": ${JSON.stringify(data?.stats || {})},
  "highlights": [
    { "phase": "first_half", "minute": 5, "kind": "tactic", "side": "opponent", "scorer": "none", "text": "..." }
  ],
  "mvp": "${data?.mvp || ''}",
  "worst": "${data?.worst || ''}",
  "press_question": "${data?.press_question || ''}"
}`,
      },
    ],
    { maxTokens: 7000, temperature: 0.92 }
  );
  return enforceFixedMatchFields(expanded, data, score, verdict);
}

function enforceFixedMatchFields(expanded, original, score, verdict) {
  return {
    ...original,
    ...expanded,
    score,
    winner: original?.winner || verdict?.winner || expanded?.winner,
    decided_by: original?.decided_by || verdict?.decidedBy || expanded?.decided_by,
    stats: original?.stats || expanded?.stats,
    mvp: expanded?.mvp || original?.mvp,
    worst: expanded?.worst || original?.worst,
    press_question: expanded?.press_question || original?.press_question,
    highlights: Array.isArray(expanded?.highlights) && expanded.highlights.length ? expanded.highlights : original?.highlights,
  };
}

// ---------------------------------------------------------------------------
// 5. Press conference analysis (PRD 6) — free text -> butterfly effects
// ---------------------------------------------------------------------------
export async function analyzePress({ question, answer, squad, lastMatch, language = 'zh-CN' }) {
  const squadNames = squad.map((s) => s.player?.name).filter(Boolean).join('、');
  const languageRule = outputLanguageRule(language);
  const data = await chatJson(
    [
      {
        role: 'system',
        content:
          `你是足球经理游戏的舆论与更衣室引擎。分析教练在发布会的自由发言，判断其态度与意图，并转化为下一场的因果效果。只输出JSON。${languageRule}`,
      },
      {
        role: 'user',
        content: `本场比分：玩家${lastMatch?.score?.player}-${lastMatch?.score?.opponent}对手。
记者提问：${question}
教练(玩家)回答：${answer}
阵中球员：${squadNames}

分析这段发言并输出严格JSON：
{
  "sentiment": "positive" | "negative" | "neutral" | "explosive",
  "summary": "一句话总结教练的态度（甩锅/护犊子/怒喷裁判/狂言夺冠等）",
  "media_headline": "一句话媒体头条（戏剧化、夸张、像太阳报）",
  "effects": [
    { "type": "morale_up"|"morale_down"|"strike"|"referee_bias"|"team_boost", "target": "球员名或全队", "desc": "对下场的具体影响" }
  ],
  "locker_room": "更衣室反应描述（30字内）"
}`,
      },
    ],
    { maxTokens: 2500, temperature: 1.05 }
  );
  return data;
}

// ---------------------------------------------------------------------------
// 6. Endgame headline card (PRD 8) — champion or eliminated
// ---------------------------------------------------------------------------
export async function endgameHeadline({ outcome, round, squad, history, language = 'zh-CN' }) {
  const stage = stageByMatchday(round);
  const languageRule = outputLanguageRule(language);
  const squadNames = squad.map((s) => `${s.player?.name}(${posLabel(s.pos)})`).filter(Boolean).join('、');
  const campaign = summarizeEndgameCampaign({ outcome, round, history, language });
  const quotes = (history || [])
    .map((h) => h.pressAnswer)
    .filter(Boolean)
    .slice(-3)
    .join(' / ');
  const data = await chatJson(
    [
      {
        role: 'system',
        content:
          `你是《太阳报》/《队报》的标题党记者，但必须严格尊重真实赛果。根据系统给出的战绩、比分路线、最后一场比分生成长篇终局报道。禁止编造夺冠/淘汰结果，禁止写出与比分相反的结论。只输出JSON。${languageRule}`,
      },
      {
        role: 'user',
        content: `真实结果：${campaign.resultText}
最终阶段：${stage.name}
真实战绩：${campaign.recordText}
总进失球：${campaign.goalText}
最后一战：${campaign.lastMatchText}
完整比分路线：${campaign.routeText}
梦之队：${squadNames}
教练近期暴论：${quotes || '无'}

要求：
- headline 可以标题党，但必须和真实结果一致。
- subhead 必须点出最终阶段、最后一战比分或夺冠路线。
- body 写260到420字，至少包含：战绩、关键比分路线、最后一战/决赛、阵容争议或英雄、发布会余波。
- 必须写得像一篇完整体育头条，不要只有一句短评。
- 如果真实结果是 eliminated，绝对不能写成夺冠、登顶、捧杯。
- 如果真实结果是 champion，绝对不能写成出局、梦碎。

输出严格JSON：
{
  "paper": "报纸名（如 太阳报 特刊 / 队报）",
  "headline": "爆炸性主标题",
  "subhead": "副标题（更细节、更离谱）",
  "body": "正文（260到420字，必须对应真实赛果）",
  "route": "用一句话列出关键晋级/出局路线",
  "verdict": "一句最终判词，必须对应真实结果",
  "rating": "给这支队伍的传奇评级（如 S级殿堂 / 抽象之王 / 悲情亚军）"
}`,
      },
    ],
    { maxTokens: 2500, temperature: 1.1 }
  );
  return normalizeEndgameCard({ data, campaign, language });
}

function summarizeEndgameCampaign({ outcome, round, history = [], language = 'zh-CN' }) {
  const english = isEnglish(language);
  const matches = Array.isArray(history) ? history : [];
  const wins = matches.filter((m) => m.winner === 'player').length;
  const losses = matches.length - wins;
  const goalsFor = matches.reduce((sum, m) => sum + Number(m.score?.player ?? 0), 0);
  const goalsAgainst = matches.reduce((sum, m) => sum + Number(m.score?.opponent ?? 0), 0);
  const last = matches[matches.length - 1] || null;
  const lastStage = last?.stage || stageByMatchday(round).name;
  const lastOpponent = last?.opponent?.country || (english ? 'Opponent' : '对手');
  const lastScore = `${Number(last?.score?.player ?? 0)}:${Number(last?.score?.opponent ?? 0)}`;
  const route = matches.map((m) => `${m.stage} ${Number(m.score?.player ?? 0)}:${Number(m.score?.opponent ?? 0)} ${m.opponent?.country || (english ? 'Opponent' : '对手')}`);
  if (english) {
    return {
      outcome,
      resultText: outcome === 'champion' ? 'won the 2026 World Cup Challenge' : `eliminated in ${lastStage}`,
      recordText: `${wins} wins, ${losses} losses across ${matches.length} matches`,
      goalText: `${goalsFor} scored, ${goalsAgainst} conceded`,
      lastMatchText: last ? `${lastStage}: Dream XI ${lastScore} ${lastOpponent}` : `${lastStage}: no complete score recorded`,
      routeText: route.length ? route.join('; ') : 'No complete route recorded',
    };
  }
  return {
    outcome,
    resultText: outcome === 'champion' ? '2026世界杯挑战夺冠' : `${lastStage}被淘汰`,
    recordText: `${wins}胜${losses}负，共${matches.length}场`,
    goalText: `进${goalsFor}球，失${goalsAgainst}球`,
    lastMatchText: last ? `${lastStage} 我的梦之队${lastScore}${lastOpponent}` : `${lastStage}暂无完整比分记录`,
    routeText: route.length ? route.join('；') : '暂无完整路线记录',
  };
}

function normalizeEndgameCard({ data, campaign, language = 'zh-CN' }) {
  const english = isEnglish(language);
  const forbiddenChampion = /夺冠|登顶|捧杯|冠军|王朝/;
  const forbiddenEliminated = /出局|淘汰|梦碎|倒下|止步/;
  const rawHeadline = String(data?.headline || '').trim();
  let headline = rawHeadline || (campaign.outcome === 'champion'
    ? (english ? 'Dream XI complete the World Cup Challenge' : '梦之队完成世界杯挑战')
    : (english ? `Dream XI fall short: ${campaign.resultText}` : `${campaign.resultText}，梦之队倒在终点前`));
  if (campaign.outcome !== 'champion' && forbiddenChampion.test(headline)) {
    headline = english ? `Dream XI stopped by the real scoreline: ${campaign.resultText}` : `${campaign.resultText}，豪阵被现实比分拉下神坛`;
  }
  if (campaign.outcome === 'champion' && forbiddenEliminated.test(headline)) {
    headline = english ? 'Dream XI complete the challenge and write a title page' : '梦之队完成世界杯挑战，八场风暴写进冠军页';
  }
  const body = String(data?.body || '').trim();
  return {
    paper: String(data?.paper || (english ? (campaign.outcome === 'champion' ? 'L Equipe Special' : 'The Sun Special') : (campaign.outcome === 'champion' ? '队报 特刊' : '太阳报 特刊'))).slice(0, 30),
    headline: headline.slice(0, 80),
    subhead: String(data?.subhead || (english ? `${campaign.recordText}, ${campaign.goalText}. Last match: ${campaign.lastMatchText}` : `${campaign.recordText}，${campaign.goalText}，最后一战：${campaign.lastMatchText}`)).slice(0, 140),
    body: ensureLongEndgameBody(body, campaign, language),
    route: String(data?.route || campaign.routeText).slice(0, 260),
    verdict: String(data?.verdict || campaign.resultText).slice(0, 120),
    rating: String(data?.rating || (english ? (campaign.outcome === 'champion' ? 'S-tier legend' : 'Fallen contender') : (campaign.outcome === 'champion' ? 'S级殿堂' : '悲情挑战者'))).slice(0, 40),
  };
}

function ensureLongEndgameBody(body, campaign, language = 'zh-CN') {
  const english = isEnglish(language);
  const text = body.replace(/\s+/g, ' ').trim();
  const contradicts =
    (campaign.outcome !== 'champion' && /夺冠|登顶|捧杯/.test(text)) ||
    (campaign.outcome === 'champion' && /出局|淘汰|梦碎/.test(text));
  if (text.length >= 180 && !contradicts) return text.slice(0, 520);
  if (english) {
    if (campaign.outcome === 'champion') {
      return `The Dream XI's ending is not held up by a slogan, it is built from the actual score route: ${campaign.routeText}. The campaign finished with ${campaign.recordText}, ${campaign.goalText}. Every match forced famous names into a modern World Cup rhythm and judged them again. The press conferences brought noise, the knockouts brought pressure, but the route never snapped. For the player, this is not just a clear, it is a complete title document from the group stage to the final whistle.`;
    }
    return `The Dream XI story stopped at ${campaign.resultText}. That is not a newspaper trying to be cruel, it is the final score doing the writing: ${campaign.lastMatchText}. The campaign leaves ${campaign.recordText}, ${campaign.goalText}, with this route: ${campaign.routeText}. Earlier wins, superstar combinations and press-room bravado all made the team look like a contender, but knockout football recognizes the box, not the resume.`;
  }
  if (campaign.outcome === 'champion') {
    return `梦之队的终局不是靠一句口号撑起来的，而是由一串真实比分铺出来的：${campaign.routeText}。整届挑战交出${campaign.recordText}，${campaign.goalText}，每一场都把历史球星的名气放到现代世界杯节奏里重新审判。有人在发布会上放狠话，有人在淘汰赛里被逼到极限，但最后的路线没有断，决赛之后所有争议都被冠军结果压住。对于玩家来说，这不是普通通关，而是一条从小组赛到终场哨的完整王朝证词。`;
  }
  return `梦之队的故事停在了${campaign.resultText}，这不是报纸故意唱衰，而是最后一战的比分把答案写死了：${campaign.lastMatchText}。整届挑战留下${campaign.recordText}，${campaign.goalText}，路线是${campaign.routeText}。前面的胜利、巨星组合和发布会嘴硬都曾经让这支队伍像冠军候选，但世界杯淘汰赛不认履历，只认当晚禁区里的选择。最后的头条因此不该写成捧杯童话，而是一篇关于豪华阵容如何被真实比分拦住的战报。`;
}

export async function simulateOtherMatch({ stage, home, away, context = '', language = 'zh-CN' }) {
  const languageRule = outputLanguageRule(language);
  const data = await chatJson(
    [
      {
        role: 'system',
        content:
          `你是世界杯比赛数据模拟器。根据两支国家队和赛程阶段，生成可信比分和简洁技术统计。只输出JSON。${languageRule}`,
      },
      {
        role: 'user',
        content: `比赛阶段：${stage}
主队：${home}
客队：${away}
上下文：${context || '无'}

输出严格JSON：
{
  "score": { "home": 2, "away": 1 },
  "stats": { "homeShots": 13, "awayShots": 9, "homePossession": 54, "awayPossession": 46 },
  "keyPlayers": ["球员或球队关键人物"],
  "summary": "50字以内比赛摘要"
}`,
      },
    ],
    { maxTokens: 1600, temperature: 0.8 }
  );
  return normalizeOtherMatch({ stage, home, away, data });
}

export async function tournamentAwards({ outcome, squad, history, tournament, language = 'zh-CN' }) {
  const languageRule = outputLanguageRule(language);
  const squadBrief = (squad || [])
    .map((s) => `${s.player?.nameZh || s.player?.name}(${s.pos}, ${s.player?.overall ?? s.player?.rating ?? '-'})`)
    .join('、');
  const data = await chatJson(
    [
      {
        role: 'system',
        content:
          `你是世界杯颁奖典礼评委。根据完整赛事记录、玩家阵容和对手比赛统计，评出奖项。奖项不能全给玩家阵容，必须至少有2个奖项或最佳阵容席位来自非玩家球队；同时也要给玩家有成就感的战役荣誉。只输出JSON。${languageRule}`,
      },
      {
        role: 'user',
        content: `玩家结果：${outcome}
玩家阵容：${squadBrief}
玩家比赛记录：${JSON.stringify(history || [])}
赛事状态：${JSON.stringify(tournament || {})}

输出严格JSON：
{
  "goldenBall": { "winner": "球员名", "reason": "原因" },
  "goldenBoot": { "winner": "球员名", "goals": 5, "reason": "原因" },
  "goldenGlove": { "winner": "球员名", "reason": "原因" },
  "bestYoungPlayer": { "winner": "球员名", "reason": "原因" },
  "rivalStar": { "winner": "非玩家球队核心或对手球星", "team": "球队名", "reason": "原因" },
  "bestCoach": { "winner": "玩家主帅或某队主帅", "reason": "原因" },
  "fairPlay": { "winner": "球队名", "reason": "原因" },
  "teamOfTournament": ["球员名1", "球员名2", "球员名3", "球员名4", "球员名5", "球员名6"],
  "achievementBadges": [
    { "title": "战役胜场", "value": "6/8", "note": "一句成就感描述" },
    { "title": "火力指数", "value": "18球", "note": "一句成就感描述" }
  ],
  "technicalSummary": [
    { "label": "总进球", "mine": 18, "rivals": 10 },
    { "label": "总射门", "mine": 96, "rivals": 78 }
  ],
  "scoringLeaders": [
    { "player": "球员名", "team": "球队名", "goals": 6 }
  ],
  "assistLeaders": [
    { "player": "球员名", "team": "球队名", "assists": 4 }
  ],
  "mvpLeaders": [
    { "player": "球员名", "team": "球队名", "points": 9 }
  ],
  "saveLeaders": [
    { "player": "门将名", "team": "球队名", "saves": 18 }
  ],
  "teamStatsLeaders": [
    { "label": "总射门", "mine": 96, "rivals": 78, "leader": "我的梦之队" }
  ],
  "ceremony": "颁奖典礼总结，80字以内"
}`,
      },
    ],
    { maxTokens: 3000, temperature: 0.85 }
  );
  return data;
}

function normalizeOtherMatch({ stage, home, away, data }) {
  const homeGoals = clampScore(data?.score?.home);
  const awayGoals = clampScore(data?.score?.away);
  const homePossession = clampPercent(data?.stats?.homePossession ?? 50);
  return {
    stage,
    home,
    away,
    score: { home: homeGoals, away: awayGoals },
    stats: {
      homeShots: clampScore(data?.stats?.homeShots, 40),
      awayShots: clampScore(data?.stats?.awayShots, 40),
      homePossession,
      awayPossession: 100 - homePossession,
    },
    keyPlayers: Array.isArray(data?.keyPlayers) ? data.keyPlayers.slice(0, 4).map(String) : [],
    summary: String(data?.summary || '').slice(0, 80),
  };
}

function clampScore(value, max = 9) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(20, Math.min(80, Math.round(n)));
}

function normalizeShirtNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= 1 && rounded <= 99 ? rounded : null;
}
