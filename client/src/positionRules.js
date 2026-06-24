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

export function positionMatches(playerPos, slotPos) {
  const pos = String(playerPos || '').toUpperCase();
  const slot = String(slotPos || '').toUpperCase();
  return (COMPATIBLE_POSITIONS[pos] || [pos]).includes(slot);
}
