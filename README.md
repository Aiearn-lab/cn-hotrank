# cn-hotrank · 中文社媒实时热榜 MCP Server

> 超紧急划时代AI赚钱计划 · A 线旗舰产品 1 号
> 定位：给全球 AI agent 喂中文世界的热点数据（「数据海关」第一个口岸）

## 是什么

一个 MCP（Model Context Protocol）server，把 4 个中文平台的公开实时热榜聚合成结构化数据，任何支持 MCP 的 AI agent（Claude、Cursor 等）装上一键调用。

| 平台 | 端点 | 数据 | 合规定性 |
|---|---|---|---|
| 今日头条 | toutiao.com/hot-event/hot-board/ | 50 条（标题+热度值） | robots 明确允许 |
| 抖音 | douyin.com/aweme/v1/web/hot/search/list/ | 50 条（词+热度值） | robots 无 * UA 约束 |
| 微博 | weibo.com/ajax/side/hotSearch | 51 条（词+热度+标签） | Content-Signal: ai-input=yes（不训练不转售） |
| 百度热搜 | top.baidu.com/board?tab=realtime | 20+ 条（标题+热度分） | 无 robots 文件 |
| ~~知乎~~ | api.zhihu.com/topstory/hot-list | — | **robots 全禁，暂缓** |
| ~~B站~~ | api.bilibili.com/x/web-interface/ranking | — | **robots 全禁，暂缓** |

完整验证报告：`../../热榜数据源可抓取性验证报告_20261014.md`

## 工具（Tools）

### `get_hot_rank`
获取中文平台实时热榜。

参数：
- `platform`: `toutiao` | `douyin` | `weibo` | `baidu` | `all`（默认 all）
- `count`: 每平台条数 1-50（默认 20）
- `force`: 跳过缓存强制刷新（默认 false，慎用——守频率纪律）

返回：每平台 `{ platform, label, ok, stale, fetchedAt, items[{rank, title, heat, tag, url}] }`

### `list_platforms`
列出支持的平台、数据口径与合规状态（含暂缓平台原因）。

## 抓取纪律（写死在代码里）

1. 单平台 TTL 缓存 ≥10 分钟；平台间顺序抓取、间隔 ≥3 秒（满足微博 Crawl-delay: 1）
2. 只用公开数据，不碰登录墙后数据，不批量恶意抓取
3. 微博数据用途边界：ai-input（给 agent 供数）✅ / ai-train（训练）❌ / 转售原始数据 ❌
4. 降级链：主源失败 → 备用端点（抖音有 iesdouyin 备用）→ 返回缓存旧数据并标 `stale=true`
5. stdio 模式下日志一律走 stderr，绝不污染 stdout 协议通道

## 开发

```bash
npm install
npm run build     # tsc → dist/
npm start         # stdio 模式本地跑
npm run inspect   # MCP Inspector 调试
```

## 路线图

- **v0.1（2026-10-14 已完成）**：stdio 本地版，4 平台聚合 + 缓存 + 降级，冒烟通过
- **v0.2（2026-10-14 已部署）**：Cloudflare Workers 上线（SSE MCP）——本地全链路验证通过（四平台真实数据从 Workers 出口拉到）；公网地址 https://cn-hotrank.7388603.workers.dev
- **v0.3**：MCP Marketplace 付费版 + x402 按次计费
- **v1.0**：5-8 平台（知乎/B站走官方渠道解禁后）+ 趋势对比工具 + 自定义域名（墙内可达，B 线国内客户需要）

## 部署与验证（v0.2）

- 部署：`npm run deploy`（wrangler，Cloudflare 账号已授权）
- 端点（v0.2.1 起双协议）：
  - `GET/SSE https://cn-hotrank.7388603.workers.dev/mcp`（SSE 模式，标准 MCP 客户端）
  - `POST https://cn-hotrank.7388603.workers.dev/http`（Streamable HTTP，单次 POST，Accept: application/json, text/event-stream）——隧道/curl/x402 按次计费友好
- 验证脚本：
  - `scripts/verify_sse.py <base_url>` —— SSE 模式 MCP 全协议（initialize→tools/call→tools/list）
  - `scripts/verify_remote.py` —— GitHub 远端双通道验证（API + ls-remote，带重试）
  - `scripts/dns_probe.py` —— workers.dev DNS 污染诊断（TCP DNS + DoH + --resolve）
- **验证结论【实，2026-10-14】**：
  - 本地 dev 全链路通过（SSE + Streamable HTTP 双协议）
  - **墙内公网验证通过**：trycloudflare 隧道域名下 initialize + tools/call 全通（微博 top1 实时返回）——SSE 长连接会被 Quick Tunnel 缓冲，Streamable HTTP 单 POST 无此问题
  - 生产 workers.dev 地址墙内不可达（DNS 污染+SNI 阻断双层，见下），海外 agent 用户无感
- **网络真相【实，2026-10-14 实测】**：workers.dev 被 GFW 全面封锁——DNS 全路径（UDP/TCP/DoH）注入 Facebook/Twitter 假 IP，且真实 CF IP（104.x/2606:4700::）下 TLS SNI=workers.dev 被即时 RST（同 IP 下 dash.cloudflare.com 正常）；github.com 为间歇性通行；api.github.com/codeload/Cloudflare API 域稳定。国内场景需自定义域名（见 v1.0）；墙内临时验证可用 `wrangler dev --tunnel`

## 依赖说明（v0.2 踩坑记录）

- agents@0.28.1 + @modelcontextprotocol/server@2.3.1 + @modelcontextprotocol/client@2.3.1（后两者是 agents 的 devDeps，需显式安装，否则 wrangler 打包报 "Could not resolve"）
- 安装需 `--legacy-peer-deps`（agents 要 zod4 peer，MCP SDK 用 zod3，运行时兼容）
- agents 0.0.x 的 McpAgent 有重复 connect bug，0.28.1 已修；挂载必须用 `McpAgent.mount()` 而非 `routeAgentRequest`

## 目录

```
src/
  index.ts          # MCP server 入口（stdio）
  types.ts          # HotItem / PlatformResult
  cache.ts          # TTL 缓存
  sources/
    index.ts        # 聚合调度（缓存+顺序+降级）
    toutiao.ts      # 头条（JSON 主源）
    douyin.ts       # 抖音（主源+iesdouyin 备用）
    weibo.ts        # 微博（JSON 主源）
    baidu.ts        # 百度热搜（HTML 解析）
    suspended.ts    # 知乎/B站 stub（合规暂缓，记录解禁路径）
```

---

## About / 关于

Maintained by **Zhiwei Studio (知微工作室)** — an AI-first engineering studio.

本服务由 **知微工作室** 维护。我们是一支 AI 参与交付的工程小队，承接 AI 工程外包：
连接器/数据接口、知识图谱与 RAG 检索、RBAC 与租户隔离、Trace 与评测看板、
SFT/DPO 数据管线、灰度发布与运维移交等。

- 能力总览 / Capability card: **https://ai-eng-capability.app.workbuddy.host/**
- 商务合作：cqsj6667@agent.qq.com
