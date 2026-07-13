const productionUrl = process.env.PRODUCTION_URL;
const expectedCommit = process.env.EXPECTED_COMMIT_SHA;

if (!productionUrl || !expectedCommit) throw new Error('PRODUCTION_URL and EXPECTED_COMMIT_SHA are required');
if (!/^[a-f0-9]{7,40}$/i.test(expectedCommit)) throw new Error('EXPECTED_COMMIT_SHA must be a Git SHA');

const endpoint = new URL('/api/chat', productionUrl);
if (endpoint.protocol !== 'https:') throw new Error('Production probe requires HTTPS');

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-request-id': `production-probe-${Date.now()}` },
  body: JSON.stringify({ message: 'こんにちは', timezone: 'Asia/Tokyo', attachments: [] }),
  signal: AbortSignal.timeout(15_000),
});
if (!response.ok) throw new Error(`Production chat returned HTTP ${response.status}`);

const deployedCommit = response.headers.get('x-deployment-commit');
if (!deployedCommit?.startsWith(expectedCommit)) {
  throw new Error(`Production commit mismatch: expected ${expectedCommit.slice(0, 12)}, received ${deployedCommit?.slice(0, 12) || 'missing'}`);
}

const body = await response.json();
if (typeof body.message !== 'string' || body.message.length === 0) throw new Error('Production chat message is missing');
if (!['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised', 'thinking'].includes(body.emotion)) throw new Error('Production emotion is invalid');
if (body.calendar != null) throw new Error('Greeting unexpectedly returned Calendar metadata');
if (/カレンダー|Calendar|OAuth|認証/i.test(body.message)) throw new Error('Greeting unexpectedly mentioned Calendar authentication');

console.log(JSON.stringify({ status: 'ok', commit: deployedCommit.slice(0, 12), calendar: null }));
