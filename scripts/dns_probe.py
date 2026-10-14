# -*- coding: utf-8 -*-
"""TCP DNS 查询（绕过 GFW 的 UDP 53 污染）+ curl --resolve 验证生产 worker"""
import socket, struct, random, subprocess, sys


def dns_query_tcp(server, name, qtype=1, timeout=8):
    qname = b"".join(bytes([len(p)]) + p.encode() for p in name.split(".")) + b"\x00"
    tid = random.randint(0, 65535)
    header = struct.pack(">HHHHHH", tid, 0x0100, 1, 0, 0, 0)
    q = header + qname + struct.pack(">HH", qtype, 1)
    s = socket.create_connection((server, 53), timeout=timeout)
    s.sendall(struct.pack(">H", len(q)) + q)
    ln = struct.unpack(">H", s.recv(2))[0]
    data = b""
    while len(data) < ln:
        chunk = s.recv(ln - len(data))
        if not chunk:
            break
        data += chunk
    s.close()
    ancount = struct.unpack(">H", data[6:8])[0]
    i = 12
    while data[i] != 0:
        i += data[i] + 1
    i += 5
    ips = []
    for _ in range(ancount):
        if data[i] & 0xC0 == 0xC0:
            i += 2
        else:
            while data[i] != 0:
                i += data[i] + 1
            i += 1
        rtype, rclass, ttl, rdlen = struct.unpack(">HHIH", data[i:i + 10])
        i += 10
        rdata = data[i:i + rdlen]
        i += rdlen
        if rtype == 1 and rdlen == 4:
            ips.append(socket.inet_ntoa(rdata))
        elif rtype == 28 and rdlen == 16:
            ips.append(socket.inet_ntop(socket.AF_INET6, rdata))
    return ips


HOST = "cn-hotrank.7388603.workers.dev"
ips = []
for server in ("223.5.5.5", "114.114.114.114", "119.29.29.29"):
    try:
        got = dns_query_tcp(server, HOST)
        print("%s -> %s" % (server, got))
        for ip in got:
            if ip not in ips:
                ips.append(ip)
    except Exception as e:
        print("%s -> FAIL %s" % (server, e))

print("candidate IPs:", ips)

for ip in ips:
    r = subprocess.run(
        ["curl", "-s", "--noproxy", "*", "--resolve", "%s:443:%s" % (HOST, ip),
         "--max-time", "12", "-o", "/dev/null", "-w",
         "%{http_code} %{time_total}s",
         "https://%s/" % HOST],
        capture_output=True, text=True)
    print("IP %s -> %s" % (ip, r.stdout.strip() or r.stderr.strip()[:80]))
