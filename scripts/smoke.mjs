#!/usr/bin/env node
/**
 * cn-hotrank 冒烟测试：起 stdio server → initialize → tools/list → get_hot_rank → list_platforms
 * 用法：node scripts/smoke.mjs
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const child = spawn(process.execPath, [path.join(root, "dist", "index.js")], {
  cwd: root,
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
const messages = [];
child.stdout.on("data", (d) => {
  buffer += d.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      messages.push(JSON.parse(line));
    } catch {
      /* 半行 */
    }
  }
});
child.stderr.on("data", (d) => process.stderr.write("[server] " + d.toString()));

const send = (obj) => child.stdin.write(JSON.stringify(obj) + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const waitFor = (id, timeoutMs = 60000) =>
  new Promise((resolve, reject) => {
    const t0 = Date.now();
    const timer = setInterval(() => {
      const m = messages.find((x) => x.id === id);
      if (m) {
        clearInterval(timer);
        resolve(m);
      } else if (Date.now() - t0 > timeoutMs) {
        clearInterval(timer);
        reject(new Error("timeout waiting id " + id));
      }
    }, 200);
  });

try {
  send({
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "smoke", version: "0.1.0" } },
  });
  const init = await waitFor(1);
  console.log("initialize ->", JSON.stringify(init.result?.serverInfo ?? init.error));
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  await sleep(300);

  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const tools = await waitFor(2);
  console.log("tools ->", (tools.result?.tools ?? []).map((t) => t.name).join(", "));

  send({
    jsonrpc: "2.0", id: 3, method: "tools/call",
    params: { name: "get_hot_rank", arguments: { count: 2 } },
  });
  const hot = await waitFor(3, 90000);
  const text = hot.result?.content?.[0]?.text ?? "";
  const data = JSON.parse(text);
  for (const r of data.results) {
    const top = r.items[0];
    console.log(
      `${r.platform.padEnd(8)} ok=${r.ok} stale=${r.stale} n=${r.items.length} ` +
        `top1=${top ? `${top.rank}. ${top.title} (heat=${top.heat})` : "-"}` +
        (r.error ? ` | err=${r.error}` : ""),
    );
  }

  send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "list_platforms" } });
  const lp = await waitFor(4);
  console.log("list_platforms ->", (lp.result?.content?.[0]?.text ?? "").slice(0, 300));

  console.log("SMOKE OK");
} catch (e) {
  console.error("SMOKE FAIL:", e.message);
  process.exitCode = 1;
} finally {
  child.kill();
}
