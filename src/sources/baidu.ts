/**
 * 百度热搜榜（HTML 解析源）
 * 端点：https://top.baidu.com/board?tab=realtime
 * 合规定性：top.baidu.com/robots.txt 返回 404 = 无 robots 约束
 * 注意：HTML 解析比 JSON 脆，结构变更时需对照归档样本回归
 *   样本：../../_process_数据源验证/samples/（baidu 页面未归档原始 HTML，调试时用 curl 重抓）
 */
import type { HotItem } from "../types.js";

const ENDPOINT = "https://top.baidu.com/board?tab=realtime";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

export async function fetchBaidu(count: number): Promise<HotItem[]> {
  const res = await fetch(ENDPOINT, {
    headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9" },
  });
  if (!res.ok) throw new Error(`baidu http ${res.status}`);
  const html = await res.text();

  // 条目块：<div class="content_1XXX"> <a href="...">... <div class="c-single-text-ellipsis">标题</div>
  const blockRe =
    /class="content_1[A-Za-z0-9_-]*">\s*<a href="([^"]+)"[\s\S]*?c-single-text-ellipsis"[^>]*>\s*([^<]+?)\s*</g;
  const titles: Array<{ title: string; url: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null && titles.length < count) {
    titles.push({ title: decodeEntities(m[2]).trim(), url: decodeEntities(m[1]) });
  }
  if (!titles.length) throw new Error("baidu parse failed: no items");

  // 热度分按文档顺序与条目对齐（经验对齐，结构变更时需回归验证）
  const scoreRe = /"hotScore":"(\d+)"/g;
  const scores: Array<number | null> = [];
  while ((m = scoreRe.exec(html)) !== null && scores.length < titles.length) {
    scores.push(Number(m[1]) || null);
  }

  return titles.map((t, i) => ({
    rank: i + 1,
    title: t.title,
    heat: scores[i] ?? null,
    url: t.url,
  }));
}
