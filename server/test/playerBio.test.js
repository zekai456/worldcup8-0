import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePlayerBio } from '../src/playerBio.js';

test('normalizePlayerBio returns concise structured profile', () => {
  const bio = normalizePlayerBio({
    player: { name: 'Lionel Messi', nameZh: '梅西' },
    data: {
      title: '阿根廷十号',
      summary: '技术、视野与终结结合的历史级前场核心。',
      career: ['巴塞罗那生涯长期统治西甲', '带领阿根廷赢得大赛冠军', '晚年转战迈阿密国际'],
      worldCup: ['2006初登世界杯', '2014进入决赛', '2022夺冠'],
      style: ['左脚内切', '小空间摆脱', '最后一传'],
      trivia: '小时候接受生长激素治疗。',
    },
  });

  assert.equal(bio.name, 'Lionel Messi');
  assert.equal(bio.nameZh, '梅西');
  assert.equal(bio.title, '阿根廷十号');
  assert.equal(bio.career.length, 3);
  assert.equal(bio.worldCup.length, 3);
  assert.equal(bio.style.length, 3);
  assert.ok(bio.summary.length <= 120);
});

test('normalizePlayerBio fills safe defaults for sparse model output', () => {
  const bio = normalizePlayerBio({
    player: { name: 'Unknown Player' },
    data: {},
  });

  assert.equal(bio.name, 'Unknown Player');
  assert.equal(bio.title, '生涯速览');
  assert.deepEqual(bio.career, []);
  assert.deepEqual(bio.worldCup, []);
  assert.deepEqual(bio.style, []);
});
