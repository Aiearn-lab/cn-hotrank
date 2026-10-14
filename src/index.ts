#!/usr/bin/env node
/**
 * cn-hotrank MCP server 入口（stdio 传输）
 * 纪律：stdio 模式下日志一律走 stderr（console.error），绝不写 stdout——stdout 是协议通道。
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { getHotRank, SOURCES } from "./sources/index.js";
import { SUSPENDED } from "./sources/suspended.js";
import type { HotRankResponse } from "./types.js";

const PLATFORM_IDS = SOURCES.map((s) => s.platform);

const server = new Server(
  { name: "cn-hotrank", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_hot_rank",
      description:
        "获取中文平台实时热榜（今日头条/抖音/微博/百度热搜），返回结构化热点：排名、标题、热度值、标签、链接。数据为各平台公开热榜，10 分钟缓存；仅用于 AI 输入（ai-input），禁止用于模型训练或转售原始数据。",
      inputSchema: {
        type: "object",
        properties: {
          platform: {
            type: "string",
            enum: [...PLATFORM_IDS, "all"],
            default: "all",
            description: "目标平台；all = 全部四个平台",
          },
          count: {
            type: "number",
            minimum: 1,
            maximum: 50,
            default: 20,
            description: "每平台返回条数（1-50，默认 20）",
          },
          force: {
            type: "boolean",
            default: false,
            description: "跳过缓存强制刷新（慎用：遵守 robots 频率纪律）",
          },
        },
      },
    },
    {
      name: "list_platforms",
      description:
        "列出 cn-hotrank 支持的热榜平台、数据口径与合规状态（含 robots 全禁而暂缓的平台及解禁路径）",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;

  if (name === "get_hot_rank") {
    const platform = typeof args?.platform === "string" ? args.platform : "all";
    const count = typeof args?.count === "number" ? Math.min(Math.max(Math.trunc(args.count), 1), 50) : 20;
    const force = args?.force === true;
    const results = await getHotRank(platform, count, force);
    const resp: HotRankResponse = { generatedAt: new Date().toISOString(), results };
    return {
      content: [{ type: "text", text: JSON.stringify(resp, null, 2) }],
    };
  }

  if (name === "list_platforms") {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              active: SOURCES.map((s) => ({ platform: s.platform, label: s.label, ttlMs: s.ttlMs })),
              suspended: SUSPENDED,
              notice: "公开数据，仅限 ai-input 用途；不训练、不转售原始数据。",
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  throw new Error(`unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[cn-hotrank] MCP server v0.1.0 started (stdio)");
