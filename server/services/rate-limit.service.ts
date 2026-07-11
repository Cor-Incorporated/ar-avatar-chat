const windows = new Map<string, { count: number; resetAt: number }>();
const MAX_WINDOWS = 10_000;

// Vercel instanceごとのbest-effort防御。厳密な全体制限には外部のatomic KV limiterが必要。

function evictWindows(now: number): void {
  for (const [id, entry] of windows) if (entry.resetAt <= now) windows.delete(id);
  while (windows.size >= MAX_WINDOWS) {
    let oldestKey: string | undefined;
    let oldestReset = Infinity;
    for (const [id, entry] of windows) {
      if (entry.resetAt < oldestReset) {
        oldestKey = id;
        oldestReset = entry.resetAt;
      }
    }
    if (!oldestKey) break;
    windows.delete(oldestKey);
  }
}

export function normalizeClientIp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.split(',')[0]?.trim();
  if (!candidate) return null;
  const normalized = candidate.replace(/^::ffff:(?=\d{1,3}(?:\.\d{1,3}){3}$)/i, '');
  return isIP(normalized) ? normalized : null;
}

export function allowChatRequest(key: string, now = Date.now(), limit = 30, windowMs = 60_000): boolean {
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    if (!entry && windows.size >= MAX_WINDOWS) evictWindows(now);
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}
import { isIP } from 'node:net';
