/** 简易 TTL 缓存：抓取纪律的第一道闸（单平台 10 分钟内不重复请求） */

export class TTLCache<T> {
  private store = new Map<string, { value: T; at: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | null {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > this.ttlMs) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }

  /** 写入缓存（即使数据过期也保留，供降级时返回 stale 数据） */
  set(key: string, value: T): void {
    this.store.set(key, { value, at: Date.now() });
  }

  /** 取旧数据（不管是否过期），供抓取失败时降级 */
  getStale(key: string): T | null {
    return this.store.get(key)?.value ?? null;
  }

  clear(): void {
    this.store.clear();
  }
}
