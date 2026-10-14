/**
 * cn-hotrank Cloudflare Worker 入口（HTTP MCP，v0.2）
 * 挂载方式：McpAgent.mount("/mcp") —— SSE 模式（MCP 2024-11-05）
 *   GET  /mcp                      -> 建立 SSE 流，返回 endpoint 事件（含 sessionId）
 *   POST /mcp/message?sessionId=xx -> 发送 JSON-RPC 消息
 * 工具逻辑与 stdio 版共用 tools-core.ts。
 */
import { routeAgentRequest } from "agents";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { callTool, registerHandlers, TOOL_DEFS } from "../src/tools-core.js";
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

const mounted = HotRankMCP.mount("/mcp", { binding: "HOTRANK_MCP" });

/** /http 端点：Streamable HTTP（单次 POST，无 session 模式）——隧道/curl/按次计费友好 */
async function handleStreamable(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("cn-hotrank Streamable HTTP: POST JSON-RPC here", { status: 200 });
  }
  const server = new Server({ name: "cn-hotrank", version: "0.2.1" }, { capabilities: { tools: {} } });
  registerHandlers(server);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/http") {
      return handleStreamable(request);
    }
    return mounted.fetch(request, env, ctx);
  },
};
