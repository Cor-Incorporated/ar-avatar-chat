const windows = new Map<string, { count: number; resetAt: number }>();

export function allowChatRequest(key: string, now = Date.now(), limit = 30, windowMs = 60_000): boolean {
  if (windows.size > 10_000) {
    for (const [id, entry] of windows) if (entry.resetAt <= now) windows.delete(id);
  }
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}
