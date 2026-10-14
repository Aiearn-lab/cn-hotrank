#!/usr/bin/env node
/**
 * cn-hotrank MCP server 入口（stdio 传输，本地版）
 * 纪律：stdio 模式下日志一律走 stderr，绝不写 stdout——stdout 是协议通道。
 * 工具逻辑在 tools-core.ts，与 Worker 版共用。
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerHandlers } from "./tools-core.js";

const server = new Server(
  { name: "cn-hotrank", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

registerHandlers(server);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[cn-hotrank] MCP server v0.1.0 started (stdio)");
