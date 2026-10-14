/**
 * 聚合调度层：缓存闸 + 顺序错峰 + 失败降级
 * 纪律（与验证报告一致）：
 *   - 单平台 TTL 缓存 ≥10 分钟
 *   - 平台间顺序抓取、间隔 ≥3 秒（满足微博 robots Crawl-delay: 1）
 *   - 降级链：主源失败 → 备用端点 → 缓存旧数据标 stale=true → 绝不无限重试
 */
import { TTLCache } from "../cache.js";
import type { HotItem, PlatformResult, SourceDef } from "../types.js";
import { fetchToutiao } from "./toutiao.js";
import { fetchDouyin } from "./douyin.js";
import { fetchWeibo } from "./weibo.js";
import { fetchBaidu } from "./baidu.js";

const TEN_MIN = 10 * 60 * 1000;
const STAGGER_MS = 3000;

export const SOURCES: SourceDef[] = [
  { platform: "toutiao", label: "今日头条", fetch: fetchToutiao, ttlMs: TEN_MIN },
  { platform: "douyin", label: "抖音热搜", fetch: fetchDouyin, ttlMs: TEN_MIN },
  { platform: "weibo", label: "微博热搜", fetch: fetchWeibo, ttlMs: TEN_MIN },
  { platform: "baidu", label: "百度热搜", fetch: fetchBaidu, ttlMs: TEN_MIN },
];

const caches = new Map<string, TTLCache<HotItem[]>>(
  SOURCES.map((s) => [s.platform, new TTLCache<HotItem[]>(s.ttlMs)]),
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOne(src: SourceDef, count: number, force: boolean): Promise<PlatformResult> {
  const cache = caches.get(src.platform)!;
  const now = new Date().toISOString();

  if (!force) {
    const hit = cache.get(src.platform);
    if (hit) {
      return { platform: src.platform, label: src.label, ok: true, stale: false, fetchedAt: now, items: hit };
    }
  }

  try {
    const items = await src.fetch(count);
    cache.set(src.platform, items);
    return { platform: src.platform, label: src.label, ok: true, stale: false, fetchedAt: now, items };
  } catch (e) {
    const stale = cache.getStale(src.platform);
    if (stale) {
      return {
        platform: src.platform, label: src.label, ok: true, stale: true, fetchedAt: now,
        items: stale, error: `fetch failed, served stale cache: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    return {
      platform: src.platform, label: src.label, ok: false, stale: false, fetchedAt: now,
      items: [], error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** 顺序抓取 + 平台间隔 STAGGER_MS */
export async function getHotRank(platform: string, count: number, force = false): Promise<PlatformResult[]> {
  const targets = platform === "all" ? SOURCES : SOURCES.filter((s) => s.platform === platform);
  if (!targets.length) throw new Error(`unknown platform: ${platform}`);
  const results: PlatformResult[] = [];
  for (const src of targets) {
    results.push(await fetchOne(src, count, force));
    if (src !== targets[targets.length - 1]) await sleep(STAGGER_MS);
  }
  return results;
}
