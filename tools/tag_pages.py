"""Mark the editable text and images on each page with data-ap="<key>".

The admin "Page content" screen edits elements by these keys and the worker
swaps in the saved text/images when the page is served. Safe to re-run: elements
that already have a key keep it, and new ones get the next free number.

Only <main> is tagged, so the site header and footer (including the
"(c) Afri-Powered 2024" line) can never be changed from the admin.

Usage:  python -I tools/tag_pages.py public
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

PAGES = ["index", "about-us", "blog", "contact", "shop", "privacy-policy",
         "refund-returns", "shipping-policy", "terms-conditions"]
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}
TEXT = {"h1", "h2", "h3", "h4", "h5", "h6", "p"}
SKIP_TAGS = {"script", "style", "svg", "form", "nav", "noscript", "template"}
SKIP_IDS = {"ap-promos", "ap-filters", "ap-list", "ap-count"}


class Tagger(HTMLParser):
    def __init__(self, counters):
        super().__init__(convert_charrefs=True)
        self.stack = []          # (tag, excludes_children)
        self.inserts = []        # (line, col, text)
        self.in_main = 0
        self.counters = counters

    def _blocked(self):
        return any(ex for _, ex in self.stack)

    def _key(self, prefix):
        self.counters[prefix] = self.counters.get(prefix, 0) + 1
        return f"{prefix}-{self.counters[prefix]}"

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        blocked = self._blocked()
        excl = (tag in SKIP_TAGS or a.get("id") in SKIP_IDS
                or any(c.startswith("grw") for c in cls)
                or (tag == "ul" and "products" in cls)
                or (tag == "div" and "ap-page" in cls and "data-ap" in a))
        key = extra = None
        if tag == "main":
            self.in_main += 1
        elif self.in_main and not blocked and not excl and "data-ap" not in a:
            if tag == "div" and "ap-page" in cls:
                key, extra, excl = "body", ' data-ap-type="rich"', True
            elif tag == "h1" and "entry-title" in cls:
                key = "title"
            elif tag in TEXT:
                key = self._key(tag)
            elif tag == "span" and "elementor-icon-list-text" in cls:
                key = self._key("list")
            elif tag == "span" and "elementor-button-text" in cls:
                key = self._key("btn")
            elif tag == "img":
                key = self._key("img")
        if key:
            line, col = self.getpos()
            self.inserts.append((line, col + 1 + len(tag), f' data-ap="{key}"{extra or ""}'))
        if tag not in VOID:
            self.stack.append((tag, excl))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID and self.stack and self.stack[-1][0] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        if tag == "main":
            self.in_main = max(0, self.in_main - 1)
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break


def tag_file(path):
    raw = path.read_text(encoding="utf-8", newline="")
    counters = {}
    for m in re.finditer(r'data-ap="([a-z0-9]+)-(\d+)"', raw):
        counters[m.group(1)] = max(counters.get(m.group(1), 0), int(m.group(2)))
    t = Tagger(counters)
    t.feed(raw)
    t.close()
    if not t.inserts:
        return 0
    starts = [0]
    for m in re.finditer("\n", raw):
        starts.append(m.end())
    out, last = [], 0
    for line, col, text in sorted(t.inserts, key=lambda x: (x[0], x[1])):
        pos = starts[line - 1] + col
        out.append(raw[last:pos])
        out.append(text)
        last = pos
    out.append(raw[last:])
    path.write_text("".join(out), encoding="utf-8", newline="")
    return len(t.inserts)


if __name__ == "__main__":
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "public")
    for name in PAGES:
        f = root / f"{name}.html"
        if f.exists():
            print(f"{name}.html: {tag_file(f)} new keys")
