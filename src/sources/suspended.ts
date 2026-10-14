/**
 * 合规暂缓平台登记处（知乎 / B站）
 *
 * 这两个平台的公开热榜端点技术上可抓，但 robots.txt 明确全禁：
 *   - 知乎：www.zhihu.com 与 api.zhihu.com  robots 均有 User-agent:* → Disallow: /
 *   - B站：api.bilibili.com robots = User-agent:* → Disallow: /（30 字节全文）
 * 按计划书红线「爬虫守 robots 协议」，v0.1 不抓取，仅登记解禁路径：
 *   1. 第三方已获授权的内容聚合渠道
 *   2. 官方开放平台接口（知乎开放平台 / B站开放平台 openapi.bilibili.com，需开发者资质+实名）
 *   3. 客户端自带凭证模式（终端用户自己的 cookie，服务端不代抓）
 * 解禁需哥哥拍板，不在知微权限内。
 */

export interface SuspendedPlatform {
  platform: string;
  label: string;
  reason: string;
  evidence: string;
  unlockPaths: string[];
}

export const SUSPENDED: SuspendedPlatform[] = [
  {
    platform: "zhihu",
    label: "知乎热榜",
    reason: "robots 全禁（www + api 双域 User-agent:* → Disallow: /）",
    evidence: "www.zhihu.com/robots.txt 与 api.zhihu.com/robots.txt 第 113 行均实锤",
    unlockPaths: ["授权聚合渠道", "知乎开放平台", "客户端自带凭证模式"],
  },
  {
    platform: "bilibili",
    label: "B站排行榜",
    reason: "robots 全禁（api.bilibili.com User-agent:* → Disallow: /）",
    evidence: "api.bilibili.com/robots.txt 全文仅 30 字节；www 排行榜页无 SSR 数据绕不过",
    unlockPaths: ["B站开放平台（需资质）", "客户端自带凭证模式"],
  },
];
