import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const directory = new URL('../src/assets/animations/', import.meta.url);
const files = (await readdir(directory)).filter((name) => extname(name).toLowerCase() === '.vrma');
const failures = [];
const warnings = [];
const runtimeAssets = new Set([
  'VRMA_01.vrma', 'VRMA_02.vrma', 'happy.vrma', 'angry.vrma',
  'relaxed.vrma', 'surprised.vrma', 'thinking.vrma',
]);

for (const name of files) {
  try {
    const data = await readFile(join(directory.pathname, name));
    if (data.toString('ascii', 0, 4) !== 'glTF') throw new Error('not a binary glTF file');
    const jsonLength = data.readUInt32LE(12);
    const chunkType = data.toString('ascii', 16, 20);
    if (chunkType !== 'JSON') throw new Error('first GLB chunk is not JSON');
    const gltf = JSON.parse(data.toString('utf8', 20, 20 + jsonLength).replace(/\0+$/u, ''));
    const used = gltf.extensionsUsed ?? [];
    if (!used.includes('VRMC_vrm_animation')) throw new Error('VRMC_vrm_animation extension is missing');
    const animations = gltf.animations ?? [];
    const trackCount = animations.reduce((sum, animation) => sum + (animation.channels?.length ?? 0), 0);
    if (trackCount === 0) throw new Error('animation has no tracks');
    const humanoid = gltf.extensions?.VRMC_vrm_animation?.humanoid?.humanBones;
    const boneCount = humanoid ? Object.keys(humanoid).length : 0;
    if (boneCount === 0) throw new Error('humanoid bone mapping is empty');
    const inputAccessors = animations.flatMap((animation) => animation.samplers ?? []).map((sampler) => sampler.input);
    const duration = Math.max(0, ...inputAccessors.map((index) => gltf.accessors?.[index]?.max?.[0] ?? 0));
    if (!(duration > 0)) throw new Error('animation duration is not positive');
    console.log(`✓ ${name}: ${duration.toFixed(2)}s, ${trackCount} tracks, ${boneCount} humanoid bones`);
  } catch (error) {
    const message = `${name}: ${error instanceof Error ? error.message : String(error)}`;
    (runtimeAssets.has(name) ? failures : warnings).push(message);
  }
}

if (files.length === 0) failures.push('no VRMA assets were found');
if (warnings.length) console.warn(warnings.map((warning) => `! ${warning} (unused asset)`).join('\n'));
if (failures.length) {
  console.error(failures.map((failure) => `✗ ${failure}`).join('\n'));
  process.exitCode = 1;
}
