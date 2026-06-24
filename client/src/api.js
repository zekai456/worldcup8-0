// Thin API client. All calls hit the Node backend (which holds the DeepSeek
// key + DB). Never call DeepSeek from the browser.

async function post(path, body) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${path} ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function get(path) {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

export const api = {
  config: () => get('/config'),
  era: (year, language) => get(`/era/${year}${language ? `?language=${encodeURIComponent(language)}` : ''}`),
  spin: (body) => post('/spin', body),
  squad: (body) => post('/squad', body),
  playerBio: (body) => post('/player-bio', body),
  completeDraft: (body) => post('/draft/complete', body),
  opponent: (body) => post('/opponent', body),
  event: (body) => post('/event', body),
  match: (body) => post('/match', body),
  otherMatch: (body) => post('/other-match', body),
  press: (body) => post('/press', body),
  endgame: (body) => post('/endgame', body),
  awards: (body) => post('/awards', body),
};
