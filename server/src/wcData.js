// World Cup editions and participant pools.
// Used to ground the "spin" (year + country) so the LLM only fills rosters,
// never invents which tournaments/teams existed.

// Each edition: year, host, and a pool of notable participating nations.
// Pools are curated to be historically plausible (not exhaustive squads).
export const EDITIONS = [
  { year: 1930, host: '乌拉圭', teams: ['乌拉圭', '阿根廷', '巴西', '美国', '南斯拉夫', '智利', '巴拉圭', '秘鲁', '比利时', '法国', '罗马尼亚', '墨西哥'] },
  { year: 1934, host: '意大利', teams: ['意大利', '捷克斯洛伐克', '德国', '奥地利', '西班牙', '匈牙利', '瑞士', '瑞典', '阿根廷', '巴西', '荷兰', '法国'] },
  { year: 1938, host: '法国', teams: ['意大利', '匈牙利', '巴西', '瑞典', '捷克斯洛伐克', '德国', '法国', '瑞士', '荷兰', '比利时', '波兰', '挪威'] },
  { year: 1950, host: '巴西', teams: ['乌拉圭', '巴西', '瑞典', '西班牙', '英格兰', '意大利', '瑞士', '智利', '美国', '巴拉圭', '墨西哥', '玻利维亚'] },
  { year: 1954, host: '瑞士', teams: ['西德', '匈牙利', '奥地利', '乌拉圭', '巴西', '英格兰', '法国', '意大利', '南斯拉夫', '瑞士', '土耳其', '苏格兰'] },
  { year: 1958, host: '瑞典', teams: ['巴西', '瑞典', '法国', '西德', '北爱尔兰', '苏联', '威尔士', '南斯拉夫', '匈牙利', '阿根廷', '英格兰', '苏格兰'] },
  { year: 1962, host: '智利', teams: ['巴西', '捷克斯洛伐克', '智利', '南斯拉夫', '苏联', '匈牙利', '西德', '英格兰', '意大利', '阿根廷', '西班牙', '墨西哥'] },
  { year: 1966, host: '英格兰', teams: ['英格兰', '西德', '葡萄牙', '苏联', '阿根廷', '匈牙利', '乌拉圭', '巴西', '意大利', '西班牙', '智利', '墨西哥'] },
  { year: 1970, host: '墨西哥', teams: ['巴西', '意大利', '西德', '乌拉圭', '英格兰', '苏联', '墨西哥', '秘鲁', '比利时', '保加利亚', '罗马尼亚', '瑞典'] },
  { year: 1974, host: '西德', teams: ['西德', '荷兰', '波兰', '巴西', '瑞典', '南斯拉夫', '阿根廷', '东德', '意大利', '苏格兰', '智利', '乌拉圭'] },
  { year: 1978, host: '阿根廷', teams: ['阿根廷', '荷兰', '巴西', '意大利', '波兰', '西德', '奥地利', '秘鲁', '法国', '匈牙利', '苏格兰', '瑞典'] },
  { year: 1982, host: '西班牙', teams: ['意大利', '西德', '波兰', '法国', '巴西', '英格兰', '苏联', '阿根廷', '比利时', '西班牙', '奥地利', '北爱尔兰'] },
  { year: 1986, host: '墨西哥', teams: ['阿根廷', '西德', '法国', '比利时', '巴西', '墨西哥', '西班牙', '英格兰', '丹麦', '苏联', '意大利', '乌拉圭'] },
  { year: 1990, host: '意大利', teams: ['西德', '阿根廷', '意大利', '英格兰', '巴西', '南斯拉夫', '捷克斯洛伐克', '喀麦隆', '荷兰', '爱尔兰', '西班牙', '比利时'] },
  { year: 1994, host: '美国', teams: ['巴西', '意大利', '瑞典', '保加利亚', '德国', '罗马尼亚', '荷兰', '西班牙', '尼日利亚', '阿根廷', '墨西哥', '美国'] },
  { year: 1998, host: '法国', teams: ['法国', '巴西', '克罗地亚', '荷兰', '意大利', '德国', '阿根廷', '英格兰', '丹麦', '尼日利亚', '西班牙', '葡萄牙'] },
  { year: 2002, host: '韩国/日本', teams: ['巴西', '德国', '土耳其', '韩国', '西班牙', '英格兰', '塞内加尔', '美国', '日本', '意大利', '阿根廷', '葡萄牙'] },
  { year: 2006, host: '德国', teams: ['意大利', '法国', '德国', '葡萄牙', '巴西', '阿根廷', '英格兰', '乌克兰', '西班牙', '荷兰', '加纳', '瑞士'] },
  { year: 2010, host: '南非', teams: ['西班牙', '荷兰', '德国', '乌拉圭', '巴西', '阿根廷', '加纳', '巴拉圭', '英格兰', '葡萄牙', '智利', '法国'] },
  { year: 2014, host: '巴西', teams: ['德国', '阿根廷', '荷兰', '巴西', '哥伦比亚', '比利时', '法国', '哥斯达黎加', '智利', '乌拉圭', '墨西哥', '西班牙'] },
  { year: 2018, host: '俄罗斯', teams: ['法国', '克罗地亚', '比利时', '英格兰', '巴西', '乌拉圭', '俄罗斯', '瑞典', '西班牙', '阿根廷', '葡萄牙', '丹麦'] },
  { year: 2022, host: '卡塔尔', teams: ['阿根廷', '法国', '克罗地亚', '摩洛哥', '巴西', '荷兰', '英格兰', '葡萄牙', '西班牙', '德国', '日本', '韩国'] },
  { year: 2026, host: '美加墨', teams: ['阿根廷', '法国', '巴西', '英格兰', '西班牙', '葡萄牙', '德国', '荷兰', '比利时', '克罗地亚', '乌拉圭', '美国'] },
];

export const YEARS = EDITIONS.map((e) => e.year);

export function editionByYear(year) {
  return EDITIONS.find((e) => e.year === Number(year));
}

// Pick a random edition from a list, optionally biased toward a center year.
// bias=0 → uniform; higher bias → tighter clustering around centerYear.
function randomEditionFrom(list, centerYear, bias = 0) {
  if (!list.length) return null;
  if (!centerYear || bias <= 0) {
    return list[Math.floor(Math.random() * list.length)];
  }
  const weights = list.map((e) => {
    const dist = Math.abs(e.year - centerYear);
    return 1 / (1 + Math.pow(dist / 20, 2) * bias);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i];
  }
  return list[list.length - 1];
}

// Pick a random edition, optionally biased toward a center year (the slider value).
export function randomEdition(centerYear, bias = 0) {
  return randomEditionFrom(EDITIONS, centerYear, bias);
}

// Pick a random edition that fielded the given country (so we can reroll the
// YEAR while keeping the same nation). Returns null if no other edition has it.
export function randomEditionWithTeam(country, centerYear, bias = 0) {
  const list = EDITIONS.filter((e) => e.teams.includes(country));
  return randomEditionFrom(list, centerYear, bias);
}

// Pick a random team from an edition. Pass `exclude` to avoid re-drawing the
// same nation on a "换国家" reroll (falls back to the full pool if it's the
// only team available).
export function randomTeamFromEdition(edition, exclude) {
  const pool = exclude ? edition.teams.filter((t) => t !== exclude) : edition.teams;
  const list = pool.length ? pool : edition.teams;
  return list[Math.floor(Math.random() * list.length)];
}
