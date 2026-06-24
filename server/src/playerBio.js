export function normalizePlayerBio({ player = {}, data = {} }) {
  return {
    name: String(player.name || data.name || '').slice(0, 80),
    nameZh: String(player.nameZh || data.nameZh || '').slice(0, 40),
    title: cleanText(data.title, 40) || '生涯速览',
    summary: cleanText(data.summary, 120),
    career: cleanList(data.career, 4, 70),
    worldCup: cleanList(data.worldCup || data.world_cup, 4, 70),
    style: cleanList(data.style, 4, 40),
    trivia: cleanText(data.trivia, 80),
  };
}

function cleanList(value, maxItems, maxLength) {
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function cleanText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}
