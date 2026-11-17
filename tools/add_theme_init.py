"""Put the tiny dark-mode starter script at the top of every page's <head>, so a visitor who chose
dark mode never sees a white flash while the page loads. Safe to re-run.

Usage:  python -I tools/add_theme_init.py public
"""
import re
import sys
from pathlib import Path

SNIP = ('<script id="ap-theme-init">try{if(localStorage.getItem("ap_theme")==="dark")'
        'document.documentElement.setAttribute("data-theme","dark")}catch(e){}</script>')

root = Path(sys.argv[1] if len(sys.argv) > 1 else "public")
files = list(root.glob("*.html")) + list(root.glob("_tpl/*.html")) + list(root.glob("product/*.html"))
done = 0
for f in files:
    t = f.read_text(encoding="utf-8")
    if "ap-theme-init" in t:
        continue
    t2, k = re.subn(r"(<head[^>]*>)", lambda m: m.group(1) + "\n" + SNIP, t, count=1)
    if k:
        f.write_text(t2, encoding="utf-8", newline="")
        done += 1
    else:
        print("no <head> in", f)
print(f"updated {done} of {len(files)} pages")
