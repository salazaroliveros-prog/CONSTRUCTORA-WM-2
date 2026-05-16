const CACHE_PREFIX = 'app_cache_v1_';

export function cacheCollection(name: string, data: any[]): void {
  try {
    const entry = { data, timestamp: Date.now(), v: 1 };
    localStorage.setItem(CACHE_PREFIX + name, JSON.stringify(entry));
  } catch (e) {
    console.warn('[cache] Failed to cache', name, e);
  }
}

export function getCachedCollection(name: string): any[] | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + name);
    if (!raw) return null;
    return JSON.parse(raw).data ?? null;
  } catch {
    return null;
  }
}

export function clearCache(name?: string): void {
  if (name) {
    localStorage.removeItem(CACHE_PREFIX + name);
  } else {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) localStorage.removeItem(key);
    }
  }
}

export function hasCache(name: string): boolean {
  return localStorage.getItem(CACHE_PREFIX + name) !== null;
}
