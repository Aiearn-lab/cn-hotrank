# -*- coding: utf-8 -*-
"""生产环境端到端验证：公网 URL 走 MCP Streamable HTTP 协议拉真实热榜"""
import json, urllib.request, urllib.error, time

BASE = "https://cn-hotrank.7388603.workers.dev"
UA = {"Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "User-Agent": "cn-hotrank-verify/0.2"}

session_id = None


def rpc(method, params=None, is_notification=False, timeout=45):
    global session_id
    body = {"jsonrpc": "2.0", "method": method}
    if not is_notification:
        body["id"] = int(time.time() * 1000) % 100000
    if params:
        body["params"] = params
    headers = dict(UA)
    if session_id:
        headers["mcp-session-id"] = session_id
    req = urllib.request.Request(BASE + "/mcp", data=json.dumps(body).encode(),
                                 headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            sid = r.headers.get("mcp-session-id")
            if sid:
                session_id = sid
            raw = r.read().decode("utf-8", "replace")
            # SSE 格式: data: {...}
            for line in raw.splitlines():
                if line.startswith("data:"):
                    return json.loads(line[5:].strip())
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        return {"__error": "HTTP %d: %s" % (e.code, e.read()[:200].decode("utf-8", "replace"))}
    except Exception as e:
        return {"__error": "%s: %s" % (type(e).__name__, e)}


print("== 1. initialize ==")
r = rpc("initialize", {"protocolVersion": "2024-11-05", "capabilities": {},
                       "clientInfo": {"name": "verify", "version": "0.2"}})
print(json.dumps(r, ensure_ascii=False)[:300])

print("== 2. notifications/initialized ==")
rpc("notifications/initialized", is_notification=True)

print("== 3. tools/call get_hot_rank (count=2) ==")
r = rpc("tools/call", {"name": "get_hot_rank", "arguments": {"count": 2}})
if "__error" in r:
    print("ERROR:", r["__error"])
else:
    text = r.get("result", {}).get("content", [{}])[0].get("text", "")
    try:
        data = json.loads(text)
        for p in data.get("results", []):
            top = p["items"][0] if p["items"] else None
            print("%-8s ok=%s stale=%s n=%s top1=%s%s" % (
                p["platform"], p["ok"], p["stale"], len(p["items"]),
                (top["title"] if top else "-"),
                (" | err=" + p["error"][:80]) if p.get("error") else ""))
    except Exception as e:
        print("parse fail:", e, "| raw:", text[:300])
