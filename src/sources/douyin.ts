/**
 * 抖音热搜榜（JSON 主源 + iesdouyin 备用源）
 * 主：https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383
 * 备：https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/?aid=2913
 * 合规定性：robots 只约束具名搜索引擎 UA，无 User-agent:* 段 → 对我们无约束
 */
import type { HotItem } from "../types.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

interface WordItem {
  word?: string;
  hot_value?: number | string;
  position?: number;
  label?: number;
}

const ENDPOINTS: Array<{ url: string; referer?: string }> = [
  {
    url: "https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383",
    referer: "https://www.douyin.com/",
  },
  { url: "https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/?aid=2913" },
];

function parse(j: unknown, count: number): HotItem[] {
  const obj = j as { data?: { word_list?: WordItem[] }; word_list?: WordItem[] };
  const list = obj?.data?.word_list ?? obj?.word_list ?? [];
  if (!Array.isArray(list) || !list.length) throw new Error("douyin empty word_list");
  return list.slice(0, count).map((it, i) => ({
    rank: typeof it.position === "number" && it.position > 0 ? it.position : i + 1,
    title: String(it.word ?? "").trim(),
    heat: Number(it.hot_value) || null,
    tag: typeof it.label === "number" && it.label > 0 ? String(it.label) : undefined,
    url: it.word
      ? `https://www.douyin.com/search/${encodeURIComponent(String(it.word))}`
      : undefined,
  }));
}

export async function fetchDouyin(count: number): Promise<HotItem[]> {
  const errors: string[] = [];
  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(ep.url, {
        headers: {
          "User-Agent": UA,
          ...(ep.referer ? { Referer: ep.referer } : {}),
          "Accept-Language": "zh-CN,zh;q=0.9",
        },
      });
      if (!res.ok) {
        errors.push(`${ep.url} -> http ${res.status}`);
        continue;
      }
      return parse(await res.json(), count);
    } catch (e) {
      errors.push(`${ep.url} -> ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`douyin all endpoints failed: ${errors.join("; ")}`);
}
