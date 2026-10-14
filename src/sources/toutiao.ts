/**
 * 今日头条热榜（JSON 主源）
 * 端点：https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc
 * 合规定性：robots User-agent:* 的 Disallow 列表不含 /hot-event/ → 允许（详见验证报告）
 */
import type { HotItem } from "../types.js";

const ENDPOINT = "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export async function fetchToutiao(count: number): Promise<HotItem[]> {
  const res = await fetch(ENDPOINT, {
    headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9" },
  });
  if (!res.ok) throw new Error(`toutiao http ${res.status}`);
  const j = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const list = Array.isArray(j?.data) ? j.data : [];
  if (!list.length) throw new Error("toutiao empty data");
  return list.slice(0, count).map((it, i) => ({
    rank: i + 1,
    title: String(it.Title ?? "").trim(),
    heat: Number(it.HotValue) || null,
    tag: typeof it.Label === "string" && it.Label ? it.Label : undefined,
    url: typeof it.Url === "string" && it.Url ? it.Url : undefined,
  }));
}
