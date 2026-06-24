import test from 'node:test';
import assert from 'node:assert/strict';
import { listFormations, positionMatches, posLabel } from '../src/formations.js';

test('positionMatches allows broad official categories only within their line', () => {
  assert.equal(positionMatches('DF', 'CB'), true);
  assert.equal(positionMatches('DF', 'ST'), false);
  assert.equal(positionMatches('MF', 'CAM'), true);
  assert.equal(positionMatches('MF', 'GK'), false);
  assert.equal(positionMatches('FW', 'LW'), true);
  assert.equal(positionMatches('FW', 'LB'), false);
});

test('positionMatches allows adjacent flank and midfield roles without changing displayed position', () => {
  assert.equal(positionMatches('LW', 'LM'), true);
  assert.equal(positionMatches('LM', 'LW'), true);
  assert.equal(positionMatches('RW', 'RM'), true);
  assert.equal(positionMatches('RM', 'RW'), true);
  assert.equal(positionMatches('LWB', 'LB'), true);
  assert.equal(positionMatches('LB', 'LWB'), true);
  assert.equal(positionMatches('RWB', 'RB'), true);
  assert.equal(positionMatches('RB', 'RWB'), true);
  assert.equal(positionMatches('CAM', 'CM'), true);
  assert.equal(positionMatches('CM', 'CDM'), true);
  assert.equal(positionMatches('CB', 'LB'), false);
  assert.equal(positionMatches('LW', 'RB'), false);
});

test('positionMatches does not treat every winger as a striker', () => {
  assert.equal(positionMatches('LW', 'ST'), false);
  assert.equal(positionMatches('RW', 'ST'), false);
  assert.equal(positionMatches('ST', 'LW'), false);
  assert.equal(positionMatches('ST', 'RW'), false);
});

test('posLabel labels broad official categories', () => {
  assert.equal(posLabel('DF'), '后卫');
  assert.equal(posLabel('MF'), '中场');
  assert.equal(posLabel('FW'), '前锋');
});

test('listFormations includes expanded tactical options', () => {
  const names = listFormations().map((f) => f.name);

  assert.ok(names.includes('4-2-3-1'));
  assert.ok(names.includes('4-1-2-1-2'));
  assert.ok(names.includes('3-4-3'));
  assert.ok(names.includes('5-3-2'));
  assert.equal(listFormations().every((f) => f.slots.length === 11), true);
});
