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

- **v0.1（本周）**：stdio 本地跑通，4 平台聚合 + 缓存 + 降级 ✅ 骨架已建
- **v0.2（下周）**：Cloudflare Workers 部署（HTTP 传输）+ mcp.so / PulseMCP / Smithery 上架
- **v0.3**：MCP Marketplace 付费版 + x402 按次计费
- **v1.0**：5-8 平台（知乎/B站走官方渠道解禁后）+ 趋势对比工具

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
