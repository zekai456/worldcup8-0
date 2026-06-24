export const LANGUAGE_STORAGE_KEY = 'worldcup8.language';

export const LANGUAGES = {
  zh: { id: 'zh', label: '中文', api: 'zh-CN' },
  en: { id: 'en', label: 'EN', api: 'en-US' },
};

const TEXT = {
  zh: {
    dreamTeam: '我的梦之队',
    opponent: '对手',
    bothSides: '双方',
    loading: '加载中...',
    backendError: '无法连接后端：',
    challenge: '2026 挑战',
    modeSuffix: '模式',
    squadId: '阵容',
    commentaryStyle: '解说风格',
    preMatchEvent: '赛前突发事件',
    matchup: '对阵',
    opponentLabel: '对手：',
    strength: '强度',
    legendaryTier: '传奇级',
    eliteTier: '豪强级',
    contenderTier: '挑战者级',
    nonChampionClassic: '非冠军经典强队',
    commentaryHint: '解说风格：{style}（可在上方切换）',
    simulatingMatch: '比赛推演中',
    simSteps: ['读取阵容', '计算胜负走势', '生成比分流式解说', '整理技术统计'],
    simBusy: '推演中，请稍等',
    kickoff: '开球',
    enteringMatch: '正在进入比赛',
    enteringSteps: ['赛前事件抽取', '确认赛程对手', '生成比赛日信息'],
    finalReport: '正在整理最终战报',
    finalSteps: ['汇总战绩', '评选赛事奖项', '生成报纸头条'],
    otherMatchContext: '同组另一场比赛，需影响积分榜',
    eventChoice: '赛前事件「{title}」：选择了「{label}」（{hint}）',
    pressCarry: '{stage}发布会舆论：{summary}。{effects}',
    fallbackPaper: '号外',
    championHeadline: '2026 挑战登顶！',
    eliminatedHeadline: '{stage}梦碎出局',
    fallbackSubhead: '{count}场战役已经记录，最终赛果以比赛历史为准。',
    championVerdict: '冠军路线成立，最终结果为夺冠。',
    eliminatedVerdict: '挑战终止，最终结果为淘汰出局。',
    championRating: 'S级殿堂',
    eliminatedRating: '悲情挑战者',
    timelineKicker: '2026 FIFA WORLD CUP CHALLENGE',
    timelineTitle: '组一支历史梦之队，挑战今年世界杯',
    timelineSub: '48 队、12 个小组、32 强淘汰赛。你要从小组赛一路踢到决赛。',
    eraLoading: '解说员正在回忆...',
    minEra: '最早年代：{year}',
    maxEra: '最晚年代：{year}',
    lockYear: '锁定 {year} 年出战',
    lockRange: '在 {min}-{max} 区间出战',
    formationTitle: '选择阵型',
    formationSub: '不同阵型决定战术板上的 11 个槽位分布。',
    pressTitle: '赛后新闻发布会',
    pressPlaceholder: '畅所欲言... 甩锅、护犊子、发疯暴论、怒喷裁判，你的每一句话都会引发蝴蝶效应。',
    pressLoading: '记者正在记录...',
    pressSubmit: '发表言论',
    pressProcessing: '新闻发布会处理中',
    pressSteps: ['记录发言', '分析舆论反应', '模拟同组比赛', '更新积分榜'],
    languageToggle: '语言',
  },
  en: {
    dreamTeam: 'Dream XI',
    opponent: 'Opponent',
    bothSides: 'Both sides',
    loading: 'Loading...',
    backendError: 'Cannot reach backend: ',
    challenge: '2026 Challenge',
    modeSuffix: 'mode',
    squadId: 'Squad',
    commentaryStyle: 'Commentary',
    preMatchEvent: 'Pre-match Incident',
    matchup: 'Matchup',
    opponentLabel: 'Opponent: ',
    strength: 'Power',
    legendaryTier: 'Legendary',
    eliteTier: 'Elite',
    contenderTier: 'Contender',
    nonChampionClassic: 'Classic non-champion side',
    commentaryHint: 'Commentary: {style} (switchable above)',
    simulatingMatch: 'Simulating Match',
    simSteps: ['Reading squad', 'Calculating match flow', 'Generating live score commentary', 'Compiling stats'],
    simBusy: 'Simulating...',
    kickoff: 'Kick Off',
    enteringMatch: 'Entering Match',
    enteringSteps: ['Rolling pre-match incident', 'Confirming opponent', 'Building matchday data'],
    finalReport: 'Preparing Final Report',
    finalSteps: ['Summarizing campaign', 'Selecting awards', 'Writing newspaper headline'],
    otherMatchContext: 'Other group match, must affect the table',
    eventChoice: 'Pre-match incident "{title}": chose "{label}" ({hint})',
    pressCarry: '{stage} press reaction: {summary}. {effects}',
    fallbackPaper: 'Extra',
    championHeadline: '2026 Challenge Completed!',
    eliminatedHeadline: 'Eliminated in {stage}',
    fallbackSubhead: '{count} matches recorded. The final result follows the match history.',
    championVerdict: 'The title route is complete. Final outcome: champion.',
    eliminatedVerdict: 'The challenge is over. Final outcome: eliminated.',
    championRating: 'S-tier legend',
    eliminatedRating: 'Fallen contender',
    timelineKicker: '2026 FIFA WORLD CUP CHALLENGE',
    timelineTitle: 'Build a historic Dream XI and challenge this World Cup',
    timelineSub: '48 teams, 12 groups, a 32-team knockout path. Your squad must survive every round.',
    eraLoading: 'Commentator is digging through history...',
    minEra: 'Earliest era: {year}',
    maxEra: 'Latest era: {year}',
    lockYear: 'Lock {year} and start',
    lockRange: 'Play from {min}-{max}',
    formationTitle: 'Choose Formation',
    formationSub: 'Your formation defines all 11 tactical slots on the board.',
    pressTitle: 'Post-match Press Conference',
    pressPlaceholder: 'Say anything. Defend players, blame tactics, challenge the referee. Every word can ripple through the campaign.',
    pressLoading: 'Reporters are writing...',
    pressSubmit: 'Submit Statement',
    pressProcessing: 'Processing Press Conference',
    pressSteps: ['Recording answer', 'Reading media reaction', 'Simulating group match', 'Updating table'],
    languageToggle: 'Language',
  },
};

export function normalizeLanguage(value) {
  return LANGUAGES[value]?.id || LANGUAGES.zh.id;
}

export function apiLanguage(lang) {
  return LANGUAGES[normalizeLanguage(lang)].api;
}

export function loadLanguage() {
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return LANGUAGES.zh.id;
  }
}

export function saveLanguage(lang) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguage(lang));
  } catch {
    // ignore storage failures
  }
}

export function makeTranslator(lang) {
  const normalized = normalizeLanguage(lang);
  return (key, params = {}) => {
    const value = TEXT[normalized]?.[key] ?? TEXT.zh[key] ?? key;
    if (Array.isArray(value)) return value;
    return interpolate(value, params);
  };
}

export function stageName(stage, lang = 'zh') {
  if (!stage) return '';
  if (lang === 'en') return stage.englishName || stage.nameEn || translateStageName(stage.name);
  return stage.name;
}

export function modeText(mode, key, lang = 'zh') {
  if (!mode) return '';
  if (lang === 'en') return mode[`${key}En`] || mode[key];
  return mode[key];
}

export function statSummary(player, lang = 'zh') {
  const labels = lang === 'en'
    ? [['PAC', player?.pace], ['SHO', player?.shooting], ['PAS', player?.passing], ['DRI', player?.dribbling], ['DEF', player?.defending], ['PHY', player?.physical]]
    : [['速', player?.pace], ['射', player?.shooting], ['传', player?.passing], ['盘', player?.dribbling], ['防', player?.defending], ['体', player?.physical]];
  return labels.map(([label, value]) => `${label}${value ?? '-'}`).join(' ');
}

export function tierLabel(tier, lang = 'zh') {
  if (tier === 'legendary') return lang === 'en' ? 'Legendary' : '传奇级';
  if (tier === 'elite') return lang === 'en' ? 'Elite' : '豪强级';
  return lang === 'en' ? 'Contender' : '挑战者级';
}

function interpolate(template, params) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? '');
}

function translateStageName(name = '') {
  const map = {
    '小组赛第1场': 'Group Match 1',
    '小组赛第2场': 'Group Match 2',
    '小组赛第3场': 'Group Match 3',
    '32强': 'Round of 32',
    '16强': 'Round of 16',
    '8强': 'Quarter-final',
    '半决赛': 'Semi-final',
    '决赛': 'Final',
  };
  return map[name] || name;
}
