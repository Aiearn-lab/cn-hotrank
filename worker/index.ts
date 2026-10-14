/**
 * cn-hotrank Cloudflare Worker 入口（HTTP MCP，v0.2）
 * 挂载方式：McpAgent.mount("/mcp") —— SSE 模式（MCP 2024-11-05）
 *   GET  /mcp                      -> 建立 SSE 流，返回 endpoint 事件（含 sessionId）
 *   POST /mcp/message?sessionId=xx -> 发送 JSON-RPC 消息
 * 工具逻辑与 stdio 版共用 tools-core.ts。
 */
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callTool, TOOL_DEFS } from "../src/tools-core.js";
import { SOURCES } from "../src/sources/index.js";

const PLATFORM_IDS = SOURCES.map((s) => s.platform);

interface Env {
  HOTRANK_MCP: DurableObjectNamespace<HotRankMCP>;
}

export class HotRankMCP extends McpAgent<Env> {
  server = new McpServer({ name: "cn-hotrank", version: "0.2.0" });

  async init() {
    this.server.tool(
      "get_hot_rank",
      TOOL_DEFS[0].description,
      {
        platform: z
          .enum([...PLATFORM_IDS, "all"] as unknown as [string, ...string[]])
          .default("all")
          .describe("目标平台；all = 全部四个平台"),
        count: z.number().min(1).max(50).default(20).describe("每平台返回条数（1-50）"),
        force: z.boolean().default(false).describe("跳过缓存强制刷新（慎用）"),
      },
      async ({ platform, count, force }) => {
        const content = await callTool("get_hot_rank", { platform, count, force });
        return { content };
      },
    );

    this.server.tool("list_platforms", TOOL_DEFS[1].description, {}, async () => {
      const content = await callTool("list_platforms", {});
      return { content };
    });
  }
}

export default HotRankMCP.mount("/mcp", { binding: "HOTRANK_MCP" });
