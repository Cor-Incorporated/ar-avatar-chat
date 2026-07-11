import { readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

export async function findApiFiles(apiRoot) {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(relative(apiRoot, path).split('\\').join('/'));
    }
  }
  await walk(apiRoot);
  return files.sort();
}

export async function assertVercelFunctions(apiRoot = resolve('api')) {
  const apiFiles = await findApiFiles(apiRoot);
  if (apiFiles.join(',') !== 'chat.js') {
    throw new Error(`Unexpected Vercel function candidates: ${apiFiles.join(', ') || '(none)'}`);
  }
  return apiFiles;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  await assertVercelFunctions();
  console.log('✓ Vercel function candidates: api/chat.js only');
}
