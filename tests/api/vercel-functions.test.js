import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertVercelFunctions } from '../../scripts/assert-vercel-functions.mjs';

describe('Vercel function allowlist', () => {
  it('rejects a nested API helper that Vercel would publish', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vercel-functions-'));
    await writeFile(join(root, 'chat.js'), 'export default () => {}');
    await mkdir(join(root, 'nested'));
    await writeFile(join(root, 'nested', 'helper.js'), 'export const helper = true');
    await expect(assertVercelFunctions(root)).rejects.toThrow('nested/helper.js');
  });
});
