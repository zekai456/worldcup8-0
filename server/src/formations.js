// Formation definitions. Each slot has a unique id, a position code, and an
// (x, y) coordinate on a 0-100 pitch grid (y=0 is own goal line, y=100 is
// opponent goal line) used to lay out the tactical board.

const POS_LABEL = {
  GK: '守门员',
  DF: '后卫',
  MF: '中场',
  FW: '前锋',
  LB: '左后卫',
  RB: '右后卫',
  CB: '中后卫',
  LWB: '左翼卫',
  RWB: '右翼卫',
  CDM: '后腰',
  CM: '中前卫',
  LM: '左前卫',
  RM: '右前卫',
  CAM: '前腰',
  LW: '左边锋',
  RW: '右边锋',
  ST: '前锋',
};

const COMPATIBLE_POSITIONS = {
  GK: ['GK'],
  DF: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  MF: ['CDM', 'CM', 'LM', 'RM', 'CAM'],
  FW: ['ST', 'LW', 'RW', 'CAM', 'LM', 'RM'],
  LB: ['LB', 'LWB'],
  LWB: ['LWB', 'LB', 'LM'],
  LM: ['LM', 'LW', 'LWB', 'CM'],
  LW: ['LW', 'LM'],
  RB: ['RB', 'RWB'],
  RWB: ['RWB', 'RB', 'RM'],
  RM: ['RM', 'RW', 'RWB', 'CM'],
  RW: ['RW', 'RM'],
  CB: ['CB'],
  CDM: ['CDM', 'CM'],
  CM: ['CM', 'CDM', 'CAM', 'LM', 'RM'],
  CAM: ['CAM', 'CM', 'ST'],
  ST: ['ST', 'CAM'],
};

export const FORMATIONS = {
  '4-4-2': {
    name: '4-4-2',
    desc: '经典平衡，攻守稳健',
    slots: [
      { id: 'GK', pos: 'GK', x: 50, y: 6 },
      { id: 'LB', pos: 'LB', x: 18, y: 28 },
      { id: 'CB1', pos: 'CB', x: 39, y: 22 },
      { id: 'CB2', pos: 'CB', x: 61, y: 22 },
      { id: 'RB', pos: 'RB', x: 82, y: 28 },
      { id: 'LM', pos: 'LM', x: 18, y: 56 },
      { id: 'CM1', pos: 'CM', x: 39, y: 52 },
      { id: 'CM2', pos: 'CM', x: 61, y: 52 },
      { id: 'RM', pos: 'RM', x: 82, y: 56 },
      { id: 'ST1', pos: 'ST', x: 40, y: 82 },
      { id: 'ST2', pos: 'ST', x: 60, y: 82 },
    ],
  },
  '4-3-3': {
    name: '4-3-3',
    desc: '全攻全守，边路狂飙',
    slots: [
      { id: 'GK', pos: 'GK', x: 50, y: 6 },
      { id: 'LB', pos: 'LB', x: 18, y: 28 },
      { id: 'CB1', pos: 'CB', x: 39, y: 22 },
      { id: 'CB2', pos: 'CB', x: 61, y: 22 },
      { id: 'RB', pos: 'RB', x: 82, y: 28 },
      { id: 'CDM', pos: 'CDM', x: 50, y: 44 },
      { id: 'CM1', pos: 'CM', x: 33, y: 56 },
      { id: 'CM2', pos: 'CM', x: 67, y: 56 },
      { id: 'LW', pos: 'LW', x: 18, y: 80 },
      { id: 'ST', pos: 'ST', x: 50, y: 86 },
      { id: 'RW', pos: 'RW', x: 82, y: 80 },
    ],
  },
  '3-5-2': {
    name: '3-5-2',
    desc: '中场绞杀，控制力强',
    slots: [
      { id: 'GK', pos: 'GK', x: 50, y: 6 },
      { id: 'CB1', pos: 'CB', x: 30, y: 22 },
      { id: 'CB2', pos: 'CB', x: 50, y: 20 },
      { id: 'CB3', pos: 'CB', x: 70, y: 22 },
      { id: 'LWB', pos: 'LWB', x: 12, y: 50 },
      { id: 'CM1', pos: 'CM', x: 35, y: 50 },
      { id: 'CDM', pos: 'CDM', x: 50, y: 42 },
      { id: 'CM2', pos: 'CM', x: 65, y: 50 },
      { id: 'RWB', pos: 'RWB', x: 88, y: 50 },
      { id: 'ST1', pos: 'ST', x: 40, y: 82 },
      { id: 'ST2', pos: 'ST', x: 60, y: 82 },
    ],
  },
  '5-4-1': {
    name: '5-4-1',
    desc: '防守反击，大巴战术',
    slots: [
      { id: 'GK', pos: 'GK', x: 50, y: 6 },
      { id: 'LWB', pos: 'LWB', x: 12, y: 30 },
      { id: 'CB1', pos: 'CB', x: 32, y: 20 },
      { id: 'CB2', pos: 'CB', x: 50, y: 18 },
      { id: 'CB3', pos: 'CB', x: 68, y: 20 },
      { id: 'RWB', pos: 'RWB', x: 88, y: 30 },
      { id: 'LM', pos: 'LM', x: 20, y: 56 },
      { id: 'CM1', pos: 'CM', x: 40, y: 52 },
      { id: 'CM2', pos: 'CM', x: 60, y: 52 },
      { id: 'RM', pos: 'RM', x: 80, y: 56 },
      { id: 'ST', pos: 'ST', x: 50, y: 84 },
    ],
  },
  '4-2-3-1': {
    name: '4-2-3-1',
    desc: '双后腰保护，三前腰支援单箭头',
    slots: [
      { id: 'GK', pos: 'GK', x: 50, y: 6 },
      { id: 'LB', pos: 'LB', x: 18, y: 28 },
      { id: 'CB1', pos: 'CB', x: 39, y: 22 },
      { id: 'CB2', pos: 'CB', x: 61, y: 22 },
      { id: 'RB', pos: 'RB', x: 82, y: 28 },
      { id: 'CDM1', pos: 'CDM', x: 40, y: 45 },
      { id: 'CDM2', pos: 'CDM', x: 60, y: 45 },
      { id: 'LW', pos: 'LW', x: 20, y: 66 },
      { id: 'CAM', pos: 'CAM', x: 50, y: 66 },
      { id: 'RW', pos: 'RW', x: 80, y: 66 },
      { id: 'ST', pos: 'ST', x: 50, y: 86 },
    ],
  },
  '4-1-2-1-2': {
    name: '4-1-2-1-2',
    desc: '菱形中场，双前锋压迫禁区',
    slots: [
      { id: 'GK', pos: 'GK', x: 50, y: 6 },
      { id: 'LB', pos: 'LB', x: 18, y: 28 },
      { id: 'CB1', pos: 'CB', x: 39, y: 22 },
      { id: 'CB2', pos: 'CB', x: 61, y: 22 },
      { id: 'RB', pos: 'RB', x: 82, y: 28 },
      { id: 'CDM', pos: 'CDM', x: 50, y: 42 },
      { id: 'CM1', pos: 'CM', x: 34, y: 55 },
      { id: 'CM2', pos: 'CM', x: 66, y: 55 },
      { id: 'CAM', pos: 'CAM', x: 50, y: 68 },
      { id: 'ST1', pos: 'ST', x: 40, y: 84 },
      { id: 'ST2', pos: 'ST', x: 60, y: 84 },
    ],
  },
  '3-4-3': {
    name: '3-4-3',
    desc: '三中卫托底，前场三叉戟',
    slots: [
      { id: 'GK', pos: 'GK', x: 50, y: 6 },
      { id: 'CB1', pos: 'CB', x: 30, y: 22 },
      { id: 'CB2', pos: 'CB', x: 50, y: 20 },
      { id: 'CB3', pos: 'CB', x: 70, y: 22 },
      { id: 'LM', pos: 'LM', x: 18, y: 52 },
      { id: 'CM1', pos: 'CM', x: 40, y: 50 },
      { id: 'CM2', pos: 'CM', x: 60, y: 50 },
      { id: 'RM', pos: 'RM', x: 82, y: 52 },
      { id: 'LW', pos: 'LW', x: 22, y: 80 },
      { id: 'ST', pos: 'ST', x: 50, y: 86 },
      { id: 'RW', pos: 'RW', x: 78, y: 80 },
    ],
  },
  '4-3-1-2': {
    name: '4-3-1-2',
    desc: '三中场覆盖，前腰连接双前锋',
    slots: [
      { id: 'GK', pos: 'GK', x: 50, y: 6 },
      { id: 'LB', pos: 'LB', x: 18, y: 28 },
      { id: 'CB1', pos: 'CB', x: 39, y: 22 },
      { id: 'CB2', pos: 'CB', x: 61, y: 22 },
      { id: 'RB', pos: 'RB', x: 82, y: 28 },
      { id: 'CM1', pos: 'CM', x: 32, y: 50 },
      { id: 'CM2', pos: 'CM', x: 50, y: 45 },
      { id: 'CM3', pos: 'CM', x: 68, y: 50 },
      { id: 'CAM', pos: 'CAM', x: 50, y: 66 },
      { id: 'ST1', pos: 'ST', x: 40, y: 84 },
      { id: 'ST2', pos: 'ST', x: 60, y: 84 },
    ],
  },
  '5-3-2': {
    name: '5-3-2',
    desc: '五后卫稳守，双前锋反击',
    slots: [
      { id: 'GK', pos: 'GK', x: 50, y: 6 },
      { id: 'LWB', pos: 'LWB', x: 12, y: 32 },
      { id: 'CB1', pos: 'CB', x: 32, y: 21 },
      { id: 'CB2', pos: 'CB', x: 50, y: 18 },
      { id: 'CB3', pos: 'CB', x: 68, y: 21 },
      { id: 'RWB', pos: 'RWB', x: 88, y: 32 },
      { id: 'CM1', pos: 'CM', x: 35, y: 54 },
      { id: 'CDM', pos: 'CDM', x: 50, y: 46 },
      { id: 'CM2', pos: 'CM', x: 65, y: 54 },
      { id: 'ST1', pos: 'ST', x: 40, y: 84 },
      { id: 'ST2', pos: 'ST', x: 60, y: 84 },
    ],
  },
};

export function posLabel(pos) {
  return POS_LABEL[pos] || pos;
}

export function positionMatches(playerPos, slotPos) {
  const pos = String(playerPos || '').toUpperCase();
  const slot = String(slotPos || '').toUpperCase();
  return (COMPATIBLE_POSITIONS[pos] || [pos]).includes(slot);
}

// Defensive positions where playing an out-of-position attacker is catastrophic.
export const DEFENSIVE_POS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'LWB', 'RWB'];
export const ATTACKING_POS = ['ST', 'LW', 'RW', 'CAM'];

export function listFormations() {
  return Object.values(FORMATIONS).map((f) => ({
    name: f.name,
    desc: f.desc,
    slots: f.slots,
  }));
}
