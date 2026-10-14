/**
 * 共享工具核心：与传输层（stdio / Cloudflare Worker）无关
 * 工具定义 + 执行逻辑都在这里，两个入口各自注册，杜绝双份维护。
 */
import { getHotRank, SOURCES } from "./sources/index.js";
import { SUSPENDED } from "./sources/suspended.js";

const PLATFORM_IDS = SOURCES.map((s) => s.platform);

export const TOOL_DEFS = [
  {
    name: "get_hot_rank",
    description:
      "获取中文平台实时热榜（今日头条/抖音/微博/百度热搜），返回结构化热点：排名、标题、热度值、标签、链接。数据为各平台公开热榜，10 分钟缓存；仅用于 AI 输入（ai-input），禁止用于模型训练或转售原始数据。",
    inputSchema: {
      type: "object" as const,
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
    inputSchema: { type: "object" as const, properties: {} },
  },
];

/** 执行工具调用，返回 MCP content 数组 */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<Array<{ type: "text"; text: string }>> {
  if (name === "get_hot_rank") {
    const platform = typeof args?.platform === "string" ? args.platform : "all";
    const count =
      typeof args?.count === "number"
        ? Math.min(Math.max(Math.trunc(args.count), 1), 50)
        : 20;
    const force = args?.force === true;
    const results = await getHotRank(platform, count, force);
    return [
      {
        type: "text",
        text: JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
      },
    ];
  }

  if (name === "list_platforms") {
    return [
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
    ];
  }

  throw new Error(`unknown tool: ${name}`);
}
