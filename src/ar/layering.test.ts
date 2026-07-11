import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AR layer ordering', () => {
  it('keeps the renderer stage above ARToolkitSource video', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toMatch(/#ar-stage\s*\{[^}]*z-index:\s*1/s);
    expect(html).toMatch(/#arjs-video\s*\{[^}]*z-index:\s*0\s*!important/s);
  });

  it('keeps ARToolkit orientation and cover projection in the render path', () => {
    const runtime = readFileSync(new URL('./ARRuntime.ts', import.meta.url), 'utf8');
    expect(runtime).toContain('controller.options.orientation = orientation');
    expect(runtime).toContain('projectionMatrix.fromArray(controller.getCameraMatrix())');
    expect(runtime).toContain('projectionMatrix.elements[0] *= correction.x');
    expect(runtime).toContain('projectionMatrix.elements[5] *= correction.y');
  });
});
