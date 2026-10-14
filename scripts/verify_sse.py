# -*- coding: utf-8 -*-
"""SSE 模式 MCP 验证（McpAgent.mount）：GET /mcp 建流 -> POST /mcp/message 收发"""
import json, threading, queue, time, urllib.request, urllib.error, sys

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8787"
msg_queue: "queue.Queue[dict]" = queue.Queue()
endpoint_q: "queue.Queue[str]" = queue.Queue()


def sse_reader():
    req = urllib.request.Request(BASE + "/mcp", headers={"Accept": "text/event-stream"})
    resp = urllib.request.urlopen(req, timeout=60)
    event_type = None
    for raw in resp:
        line = raw.decode("utf-8", "replace").rstrip("\n").rstrip("\r")
        if line.startswith("event:"):
            event_type = line[6:].strip()
        elif line.startswith("data:"):
            data = line[5:].strip()
            if event_type == "endpoint":
                endpoint_q.put(data)
            elif event_type == "message":
                try:
                    msg_queue.put(json.loads(data))
                except Exception:
                    pass
            event_type = None


def post(endpoint, obj):
    url = BASE + endpoint
    req = urllib.request.Request(
        url, data=json.dumps(obj).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read().decode("utf-8", "replace")


t = threading.Thread(target=sse_reader, daemon=True)
t.start()

endpoint = endpoint_q.get(timeout=30)
print("SSE endpoint:", endpoint)

print("== initialize ==")
post(endpoint, {"jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {"protocolVersion": "2024-11-05", "capabilities": {},
                           "clientInfo": {"name": "sse-verify", "version": "0.2"}}})
r = msg_queue.get(timeout=30)
print(json.dumps(r, ensure_ascii=False)[:200])

print("== initialized ==")
post(endpoint, {"jsonrpc": "2.0", "method": "notifications/initialized"})

print("== tools/call get_hot_rank count=2 ==")
post(endpoint, {"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                "params": {"name": "get_hot_rank", "arguments": {"count": 2}}})
r = msg_queue.get(timeout=90)
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

print("== tools/list ==")
post(endpoint, {"jsonrpc": "2.0", "id": 3, "method": "tools/list"})
r = msg_queue.get(timeout=30)
print("tools:", [t["name"] for t in r.get("result", {}).get("tools", [])])
print("SSE VERIFY DONE")
