// DeepSeek (OpenAI-compatible) client.
// NOTE: deepseek-v4-flash is a reasoning model — it spends tokens on hidden
// `reasoning_content` before emitting `content`. We must request a generous
// max_tokens or `content` comes back empty. We read message.content only.
import './env.js';

const API_KEY = process.env.OPENAI_API_KEY;
const BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const MODEL = process.env.OPENAI_MODEL || 'deepseek-v4-flash';

export function llmConfig() {
  return {
    baseUrl: BASE_URL,
    model: MODEL,
    hasApiKey: !!API_KEY,
    apiKeyPrefix: API_KEY ? API_KEY.slice(0, 6) : '',
  };
}

export async function chat(messages, { json = false, maxTokens = 4000, temperature = 1.0 } = {}) {
  const body = {
    model: MODEL,
    messages,
    max_tokens: maxTokens,
    temperature,
  };
  if (json) body.response_format = { type: 'json_object' };

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  return content.trim();
}

// Parse a JSON object out of an LLM response, tolerating ```json fences and
// surrounding prose.
export function parseJson(raw) {
  if (!raw) throw new Error('empty LLM response');
  let s = raw.trim();
  // strip code fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  // grab the outermost {...}
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return JSON.parse(s);
}

// Call chat with JSON mode and retry once on parse failure.
export async function chatJson(messages, opts = {}) {
  const raw = await chat(messages, { ...opts, json: true });
  try {
    return parseJson(raw);
  } catch {
    // one retry with a stricter nudge
    const retry = await chat(
      [...messages, { role: 'system', content: '上次输出无法解析为JSON。请只输出一个合法的JSON对象，不要任何额外文字或解释。' }],
      { ...opts, json: true }
    );
    return parseJson(retry);
  }
}
