# -*- coding: utf-8 -*-
"""GitHub 远端验证闭环：API 元数据 + git ls-remote，双通道失败自动重试"""
import subprocess, time, json, urllib.request

REPO = r"E:\AImakemoney\02_MCP\_".replace("_", "")
REPO = r"E:\AImakemoney\02_MCP情报套件\cn-hotrank"
UA = {"User-Agent": "cn-hotrank-verify"}

# ---- 通道 1：GitHub API（api.github.com 较稳）----
print("=== 通道1: GitHub API 元数据 ===")
api_ok = False
for i in range(6):
    try:
        req = urllib.request.Request(
            "https://api.github.com/repos/Aiearn-lab/cn-hotrank", headers=UA)
        with urllib.request.urlopen(req, timeout=12) as r:
            d = json.load(r)
        print("API OK: full_name=%s | default_branch=%s | size=%sKB | pushed_at=%s"
              % (d.get("full_name"), d.get("default_branch"), d.get("size"), d.get("pushed_at")))
        api_ok = True
        break
    except Exception as e:
        print("  try %d fail: %s" % (i + 1, e))
        time.sleep(6)

# ---- 通道 2：git ls-remote（抓 github.com 通行窗口）----
print("=== 通道2: git ls-remote 重试 ===")
ls_ok = False
for i in range(12):
    try:
        r = subprocess.run(["git", "ls-remote", "origin"], cwd=REPO,
                           capture_output=True, text=True, timeout=40)
        if r.returncode == 0 and r.stdout.strip():
            print("LS-REMOTE OK (第 %d 次):" % (i + 1))
            print(r.stdout.strip()[:400])
            ls_ok = True
            break
        print("  try %d fail: %s" % (i + 1, (r.stderr or "empty").strip()[:120]))
    except Exception as e:
        print("  try %d exc: %s" % (i + 1, e))
    time.sleep(8)

print("=== 结论 ===")
print("API 验证: %s | git 验证: %s" % ("通过" if api_ok else "未通过",
                                     "通过" if ls_ok else "未通过"))
