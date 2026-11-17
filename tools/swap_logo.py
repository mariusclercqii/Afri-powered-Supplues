"""Point every header logo (<img class="custom-logo">) and the admin login logo at the new logo file.

Usage:  python -I tools/swap_logo.py public /assets/afri-powered-logo.png 1007 300
"""
import re
import sys
from pathlib import Path

root, src, w, h = Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]


def fix(tag):
    tag = re.sub(r'src="[^"]*"', f'src="{src}"', tag, count=1)
    tag = re.sub(r'\swidth="\d+"', f' width="{w}"', tag, count=1)
    tag = re.sub(r'\sheight="\d+"', f' height="{h}"', tag, count=1)
    tag = re.sub(r'\ssrcset="[^"]*"', "", tag)
    return tag


files = [p for p in root.rglob("*.html")]
changed = 0
for f in files:
    t = f.read_text(encoding="utf-8")
    n = re.sub(r'<img\b[^>]*class="custom-logo"[^>]*>', lambda m: fix(m.group(0)), t)
    n = re.sub(r'<img\b[^>]*class="login-logo"[^>]*>', lambda m: re.sub(r'src="[^"]*"', f'src="{src}"', m.group(0)), n)
    if n != t:
        f.write_text(n, encoding="utf-8", newline="")
        changed += 1
print(f"logo updated in {changed} of {len(files)} pages")
