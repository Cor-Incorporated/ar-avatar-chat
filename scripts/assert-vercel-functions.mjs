import { readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const apiRoot = resolve('api');
const entries = await readdir(apiRoot, { withFileTypes: true });
const apiFiles = entries
  .filter((entry) => entry.isFile())
  .map((entry) => relative(process.cwd(), resolve(apiRoot, entry.name)))
  .sort();

if (apiFiles.join(',') !== 'api/chat.js') {
  throw new Error(`Unexpected Vercel function candidates: ${apiFiles.join(', ') || '(none)'}`);
}
console.log('✓ Vercel function candidates: api/chat.js only');
