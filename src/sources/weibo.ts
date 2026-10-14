/**
 * 微博热搜（JSON 主源）
 * 端点：https://weibo.com/ajax/side/hotSearch
 * 合规定性：robots User-agent:* 为 Disallow:/，但同段 Content-Signal: search=yes, ai-input=yes, ai-train=no
 *   → 用途边界：给 AI agent 供数（ai-input）✅ / 模型训练 ❌ / 转售原始数据 ❌
 *   → 纪律：缓存 ≥10 分钟、只取公开字段、不碰登录墙后数据
 */
import type { HotItem } from "../types.js";

const ENDPOINT = "https://weibo.com/ajax/side/hotSearch";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

interface RealtimeItem {
  word?: string;
  num?: number | string;
  realpos?: number;
  label_name?: string;
}

export async function fetchWeibo(count: number): Promise<HotItem[]> {
  const res = await fetch(ENDPOINT, {
    headers: {
      "User-Agent": UA,
      Referer: "https://weibo.com/",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`weibo http ${res.status}`);
  const j = (await res.json()) as { data?: { realtime?: RealtimeItem[] } };
  const list = j?.data?.realtime ?? [];
  if (!Array.isArray(list) || !list.length) throw new Error("weibo empty realtime");
  return list.slice(0, count).map((it, i) => {
    const word = String(it.word ?? "").trim();
    return {
      rank: typeof it.realpos === "number" && it.realpos > 0 ? it.realpos : i + 1,
      title: word,
      heat: Number(it.num) || null,
      tag: typeof it.label_name === "string" && it.label_name ? it.label_name : undefined,
      url: word ? `https://s.weibo.com/weibo?q=${encodeURIComponent(word)}` : undefined,
    };
  });
}
