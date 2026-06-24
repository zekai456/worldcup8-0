import test from 'node:test';
import assert from 'node:assert/strict';
import { llmConfig } from '../src/llm.js';

test('llmConfig loads server .env regardless of process cwd', () => {
  const config = llmConfig();

  assert.equal(config.baseUrl, 'https://api.deepseek.com');
  assert.equal(config.model, 'deepseek-v4-flash');
  assert.equal(config.hasApiKey, true);
  assert.equal(config.apiKeyPrefix, 'sk-6a1');
});
