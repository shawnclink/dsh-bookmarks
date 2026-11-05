#!/usr/bin/env python3
"""
把本机浏览器里的登录态取出来，写成插件能直接用的本地凭证文件。

为什么需要单独跑一次：
  macOS 会拦截「App 读取其它 App 的浏览器数据目录」。DeepSeek Harness 没有
  Full Disk Access 权限，所以在它内部调用 twitter/bili 时读不到 Chrome 的 cookie。
  终端是另一回事——第一次会弹一个授权框，允许之后就能读。

跑完之后：
  ~/.dsh-bookmarks/credentials.json   X 的 auth_token / ct0
  ~/.bilibili-cli/credential.json     B 站的 SESSDATA 等

全部写在本机，不联网、不上传。
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

HOME = Path.home()
CRED_DIR = HOME / ".dsh-bookmarks"
CRED_FILE = CRED_DIR / "credentials.json"
BILI_DIR = HOME / ".bilibili-cli"
BILI_FILE = BILI_DIR / "credential.json"

BROWSERS = ["chrome", "arc", "brave", "edge", "chromium", "firefox", "safari"]


def load_browser_cookie3():
    try:
        import browser_cookie3  # noqa: F401
        return browser_cookie3
    except ImportError:
        pass
    # 退化：借用 twitter-cli 的 pipx 虚拟环境，里面有 browser_cookie3
    candidates = [
        HOME / ".local/pipx/venvs/twitter-cli/bin/python",
        HOME / ".local/pipx/venvs/bilibili-cli/bin/python",
    ]
    for python in candidates:
        if not python.exists():
            continue
        probe = subprocess.run(
            [str(python), "-c", "import browser_cookie3; print('ok')"],
            capture_output=True,
            text=True,
        )
        if probe.returncode == 0:
            # 用那个解释器把自己重跑一遍
            os.execv(str(python), [str(python), __file__, *sys.argv[1:]])
    print("✗ 找不到 browser_cookie3。先跑：pipx inject twitter-cli browser-cookie3")
    sys.exit(1)


def cookies_for(domain: str):
    """遍历本机浏览器，返回 (browser_name, {name: value}) 或 (None, {})。"""
    browser_cookie3 = load_browser_cookie3()
    for name in BROWSERS:
        loader = getattr(browser_cookie3, name, None)
        if loader is None:
            continue
        try:
            jar = loader(domain_name=domain)
        except Exception as error:  # 浏览器没装 / 没登录 / 权限被拒
            reason = str(error).splitlines()[0][:120] if str(error) else error.__class__.__name__
            print(f"  · {name:<9} 跳过：{reason}")
            continue
        found = {}
        for cookie in jar:
            host = cookie.domain.lstrip(".") if cookie.domain else ""
            if host.endswith("x.com") or host.endswith("twitter.com") or host.endswith("bilibili.com"):
                if cookie.value:
                    found[cookie.name] = cookie.value
        if found:
            return name, found
        print(f"  · {name:<9} 没有 {domain} 的登录态")
    return None, {}


def mask(value: str) -> str:
    if not value:
        return "(空)"
    if len(value) <= 10:
        return value[:2] + "***"
    return f"{value[:4]}…{value[-4:]}（{len(value)} 位）"


def write_private(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    path.chmod(0o600)


def collect_x(report: dict) -> None:
    print("\n[X / Twitter]")
    browser, jar = cookies_for("x.com")
    token = jar.get("auth_token")
    ct0 = jar.get("ct0")
    if not (token and ct0):
        print("  ✗ 没拿到 auth_token / ct0 —— 在浏览器里登录 x.com 之后再跑一次")
        report["x"] = False
        return
    payload = {"TWITTER_AUTH_TOKEN": token, "TWITTER_CT0": ct0}
    existing = {}
    if CRED_FILE.exists():
        try:
            existing = json.loads(CRED_FILE.read_text(encoding="utf-8"))
        except Exception:
            existing = {}
    write_private(CRED_FILE, {**existing, **payload})
    print(f"  ✓ 来自 {browser}：auth_token={mask(token)} ct0={mask(ct0)}")
    print(f"  → {CRED_FILE}")
    report["x"] = True


def collect_bilibili(report: dict) -> None:
    print("\n[Bilibili]")
    browser, jar = cookies_for("bilibili.com")
    sessdata = jar.get("SESSDATA")
    if not sessdata:
        print("  ✗ 没拿到 SESSDATA —— 在浏览器里登录 bilibili.com 之后再跑一次")
        report["bilibili"] = False
        return
    payload = {
        "sessdata": sessdata,
        "bili_jct": jar.get("bili_jct", ""),
        "ac_time_value": jar.get("ac_time_value", ""),
        "buvid3": jar.get("buvid3", ""),
        "buvid4": jar.get("buvid4", ""),
        "dedeuserid": jar.get("DedeUserID", ""),
        "saved_at": time.time(),
    }
    write_private(BILI_FILE, payload)
    print(f"  ✓ 来自 {browser}：SESSDATA={mask(sessdata)}")
    print(f"  → {BILI_FILE}")
    report["bilibili"] = True


def verify(binary: Path, args: list[str], env: dict | None = None) -> None:
    if not binary.exists():
        return
    try:
        result = subprocess.run(
            [str(binary), *args],
            capture_output=True,
            text=True,
            timeout=60,
            env={**os.environ, **(env or {})},
        )
    except Exception as error:
        print(f"  ! 验证没跑起来：{error}")
        return
    output = (result.stdout or "") + (result.stderr or "")
    ok = '"ok": true' in output or '"ok":true' in output
    print(f"  {'✓' if ok else '✗'} {binary.name} {' '.join(args)} → {'登录态有效' if ok else '仍然没通过'}")


def main() -> None:
    print("扫描本机浏览器的登录态（只看 x.com / bilibili.com，别的 cookie 一个都不碰）")
    report = {"x": False, "bilibili": False}
    collect_x(report)
    collect_bilibili(report)

    print("\n[验证]")
    env = {}
    if CRED_FILE.exists():
        data = json.loads(CRED_FILE.read_text(encoding="utf-8"))
        env = {k: v for k, v in data.items() if k.startswith("TWITTER_")}
    verify(HOME / ".local/bin/twitter", ["status", "--json"], env)
    verify(HOME / ".local/bin/bili", ["status", "--json"])

    print("\n" + "─" * 46)
    print("X        ", "✓ 已就绪" if report["x"] else "✗ 还需要登录")
    print("Bilibili ", "✓ 已就绪" if report["bilibili"] else "✗ 还需要登录")
    print("YouTube / Reddit / 知乎 → 装 opencli 的 Chrome 扩展后可用")
    print("小红书   → 没有公开的收藏接口，用插件的「+ 链接」手动塞")
    if all(report.values()):
        print("\n回 DeepSeek Harness，点收藏夹页面的「同步」。")
    else:
        print("\n浏览器里登好对应站点后，重跑这个脚本即可。")


if __name__ == "__main__":
    main()
