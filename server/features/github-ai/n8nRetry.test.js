const test = require('node:test');
const assert = require('node:assert/strict');
const { _internal } = require('./aiService');

const { callN8nWebhook, classifyN8nFailure, setSleep } = _internal;

// Builds a fake fetch that replays the given responses in order and records each call.
function fakeFetch(responses) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (next instanceof Error) throw next;
    const { status = 200, body = '', headers = {} } = next;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: `status ${status}`,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
      headers: { get: (name) => headers[name.toLowerCase()] ?? null }
    };
  };
  fn.calls = calls;
  return fn;
}

let sleeps;
const originalFetch = global.fetch;
const originalEnv = { ...process.env };

test.beforeEach(() => {
  sleeps = [];
  setSleep(async (ms) => { sleeps.push(ms); });
  process.env.N8N_WEBHOOK_URL = 'https://n8n.example.test/webhook/fake';
  delete process.env.N8N_MAX_RETRIES;
  test.mock.method(console, 'log', () => {});
  test.mock.method(console, 'error', () => {});
});

test.afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  test.mock.restoreAll();
});

const OK_BODY = { output: { overall_picture: { push_summary: 'ok' } } };

test('retries a transient 503 once, then returns the successful result', async () => {
  global.fetch = fakeFetch([{ status: 503, body: { error: true, message: 'Service unavailable', retryable: true } }, { status: 200, body: OK_BODY }]);
  const result = await callN8nWebhook({ analysisType: 'commit_review' });
  assert.deepEqual(result, OK_BODY.output);
  assert.equal(global.fetch.calls.length, 2);
  assert.deepEqual(sleeps, [30000]);
});

test('does not retry a 422 marked retryable:false and surfaces the n8n message', async () => {
  global.fetch = fakeFetch([{ status: 422, body: { error: true, message: 'No prompt specified', retryable: false } }]);
  const diagnostics = {};
  const result = await callN8nWebhook({ analysisType: 'commit_review' }, diagnostics);
  assert.equal(result, null);
  assert.equal(global.fetch.calls.length, 1);
  assert.deepEqual(sleeps, []);
  assert.equal(diagnostics.lastError, 'n8n 422: No prompt specified');
});

test('stops after the configured number of attempts (default 2) and honours retryAfter', async () => {
  global.fetch = fakeFetch([{ status: 503, body: { message: 'Service unavailable', retryable: true, retryAfter: 10 } }]);
  const diagnostics = {};
  const result = await callN8nWebhook({ analysisType: 'repository_review' }, diagnostics);
  assert.equal(result, null);
  assert.equal(global.fetch.calls.length, 2);
  assert.deepEqual(sleeps, [10000]);
  assert.match(diagnostics.lastError, /^n8n 503: Service unavailable/);
});

test('waits for the Retry-After header on a 429 without a JSON body', async () => {
  global.fetch = fakeFetch([{ status: 429, body: 'Too Many Requests', headers: { 'retry-after': '5' } }, { status: 200, body: OK_BODY }]);
  await callN8nWebhook({ analysisType: 'commit_review' });
  assert.deepEqual(sleeps, [5000]);
});

test('falls back to 60s for a 429 and 30s for a 5xx when no hint is given', () => {
  assert.deepEqual(classifyN8nFailure({ status: 429 }), { retryable: true, delayMs: 60000 });
  assert.deepEqual(classifyN8nFailure({ status: 502 }), { retryable: true, delayMs: 30000 });
  assert.deepEqual(classifyN8nFailure({ status: 400 }), { retryable: false, delayMs: 30000 });
  assert.equal(classifyN8nFailure({ status: 503, body: { retryAfter: 600 } }).delayMs, 90000);
  assert.equal(classifyN8nFailure({ status: 503, body: { retryable: false } }).retryable, false);
});

test('retries a network error but not a 2xx response with a broken body', async () => {
  global.fetch = fakeFetch([new TypeError('fetch failed'), { status: 200, body: OK_BODY }]);
  assert.deepEqual(await callN8nWebhook({ analysisType: 'commit_review' }), OK_BODY.output);
  assert.equal(global.fetch.calls.length, 2);

  global.fetch = fakeFetch([{ status: 200, body: '<html>not json</html>' }]);
  test.mock.method(console, 'error', () => {});
  const diagnostics = {};
  assert.equal(await callN8nWebhook({ analysisType: 'commit_review' }, diagnostics), null);
  assert.equal(global.fetch.calls.length, 1);
  assert.match(diagnostics.lastError, /JSON không hợp lệ/);
});

test('N8N_MAX_RETRIES=0 makes a single attempt; a missing URL makes none', async () => {
  process.env.N8N_MAX_RETRIES = '0';
  global.fetch = fakeFetch([{ status: 503, body: { retryable: true } }]);
  assert.equal(await callN8nWebhook({ analysisType: 'commit_review' }), null);
  assert.equal(global.fetch.calls.length, 1);

  delete process.env.N8N_WEBHOOK_URL;
  global.fetch = fakeFetch([{ status: 200, body: OK_BODY }]);
  const diagnostics = {};
  assert.equal(await callN8nWebhook({ analysisType: 'commit_review' }, diagnostics), null);
  assert.equal(global.fetch.calls.length, 0);
  assert.match(diagnostics.lastError, /N8N_WEBHOOK_URL/);
});
