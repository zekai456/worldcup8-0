export const GAME_MODES = {
  classic: {
    id: 'classic',
    name: '经典模式',
    nameEn: 'Classic Mode',
    shortName: '经典',
    shortNameEn: 'Classic',
    desc: '完整显示球员总评和六项数据，组建你能打造的最强阵容。',
    descEn: 'Show overall ratings and six attributes to build the strongest squad possible.',
  },
  expert: {
    id: 'expert',
    name: '专家模式',
    nameEn: 'Expert Mode',
    shortName: '专家',
    shortNameEn: 'Expert',
    desc: '隐藏评分和数据，只看姓名与位置，依靠足球知识完成选秀。',
    descEn: 'Hide ratings and attributes. Draft using football knowledge only.',
  },
};

export function normalizeGameMode(value) {
  return GAME_MODES[value]?.id || GAME_MODES.classic.id;
}

export function shouldHidePlayerStats(mode) {
  return normalizeGameMode(mode) === GAME_MODES.expert.id;
}

export function playerStatSummary(player, lang = 'zh') {
  const labels = lang === 'en'
    ? [['PAC', player?.pace], ['SHO', player?.shooting], ['PAS', player?.passing], ['DRI', player?.dribbling], ['DEF', player?.defending], ['PHY', player?.physical]]
    : [['速', player?.pace], ['射', player?.shooting], ['传', player?.passing], ['盘', player?.dribbling], ['防', player?.defending], ['体', player?.physical]];
  return labels.map(([label, value]) => `${label}${value ?? '-'}`).join(' ');
}
