"""Build cart.html, checkout.html and quote.html from shop.html so they share the
site's exact header, footer and styles. Re-run after changing the shop page chrome.

Usage:  python -I tools/make_cart_pages.py public
"""
import re
import sys
from pathlib import Path

WA = "27718111466"
PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga",
             "North West", "Northern Cape", "Western Cape"]


def steps(active):
    items = [("01", "Request", "Review your cart and details"),
             ("02", "Confirm", "Stock, pricing and delivery"),
             ("03", "Pay", "When your quote is ready")]
    out = []
    for i, (n, t, s) in enumerate(items, 1):
        cls = "on" if i == active else ("done" if i < active else "")
        out.append(f'<li class="{cls}"><b>{n}</b><span><strong>{t}</strong><small>{s}</small></span></li>')
    return '<ol class="ap-steps" aria-label="Checkout steps">' + "".join(out) + "</ol>"


def field(fid, label, typ="text", auto="", half=False, required=True, hint="", extra=""):
    req = " required" if required else ""
    opt = "" if required else ' <span class="ap-opt">(optional)</span>'
    h = f'<small class="ap-hint">{hint}</small>' if hint else ""
    return (f'<div class="ap-f{" ap-half" if half else ""}"><label for="{fid}">{label}{opt}</label>'
            f'<input id="{fid}" name="{fid}" type="{typ}" autocomplete="{auto}"{req}{extra}>{h}</div>')


HELP = (f'<div class="ap-card ap-help"><p class="ap-kicker">Real people · practical help</p><h3>Need advice?</h3>'
        f'<p>Not sure which inverter, battery or panels you need? Let\'s check the details together.</p>'
        f'<a class="ap-btn-line" href="https://wa.me/{WA}?text=Hi%20Afri-Powered%2C%20I%20need%20some%20advice" target="_blank" rel="noopener">'
        f'<span class="ap-wa-ico" aria-hidden="true"></span>Chat to us on WhatsApp ↗</a></div>')

CART = (
    '<div class="ap-co" id="ap-cart-page">'
    '<header class="ap-co-head"><h1>Your cart</h1><p>Add everything you need, then request a quote. '
    'We confirm stock, final pricing and delivery before you pay.</p></header>'
    + steps(1) +
    '<div class="ap-co-grid"><div class="ap-card ap-cart-box"><ul class="ap-lines" id="ap-cart-lines"><li class="ap-muted">Loading your cart…</li></ul></div>'
    '<aside class="ap-co-side"><div class="ap-card"><p class="ap-kicker">Summary</p><h2>Order review</h2>'
    '<div class="ap-sum-row"><span>Listed price</span><strong id="ap-cart-listed">–</strong></div>'
    '<div class="ap-sum-row ap-sum-total"><span>Final total</span><strong class="ap-tbc">To be confirmed</strong></div>'
    '<p class="ap-small">Stock, final pricing and delivery are confirmed in your quote. You are not charged now.</p>'
    '<a class="ap-btn ap-btn-main" id="ap-cart-next" href="/checkout">Request quote →</a>'
    '<a class="ap-link" href="/shop">← Continue shopping</a></div>' + HELP + '</aside></div></div>'
)

CHECKOUT = (
    '<div class="ap-co" id="ap-checkout">'
    '<header class="ap-co-head"><h1>Checkout</h1><p>Review your products and delivery details. '
    'We confirm stock and send your final quote before payment.</p>'
    '<p class="ap-co-tag">Guest checkout · no account required</p></header>'
    + steps(1) +
    '<div class="ap-co-grid"><form class="ap-co-form" id="ap-co-form" novalidate>'
    # 01
    '<section class="ap-card ap-co-sec"><div class="ap-co-sh"><span class="ap-num">01</span><div><h2>Your details</h2>'
    '<p>How we\'ll contact you about your order.</p></div></div><div class="ap-fields">'
    + field("name", "Full name", auto="name")
    + field("email", "Email address", "email", "email", half=True)
    + field("phone", "Phone / WhatsApp", "tel", "tel", half=True, extra=' inputmode="tel"')
    + '</div></section>'
    # 02
    '<section class="ap-card ap-co-sec"><div class="ap-co-sh"><span class="ap-num">02</span><div><h2>Delivery details</h2>'
    '<p>Tell us where in South Africa the order needs to go.</p></div></div>'
    '<div class="ap-choice" role="radiogroup" aria-label="Delivery or collection">'
    '<label><input type="radio" name="method" value="delivery" checked><span><strong>Deliver to me</strong><small>Courier to your address</small></span></label>'
    '<label><input type="radio" name="method" value="collect"><span><strong>I\'ll collect</strong><small>We\'ll send the collection address</small></span></label></div>'
    '<div class="ap-fields" id="ap-addr">'
    + field("street", "Street address", auto="address-line1")
    + field("unit", "Apartment, building or unit", auto="address-line2", required=False)
    + field("suburb", "Suburb", auto="address-level3", half=True)
    + field("city", "City / town", auto="address-level2", half=True)
    + '<div class="ap-f ap-half"><label for="province">Province</label><select id="province" name="province" autocomplete="address-level1" required>'
      '<option value="">Select province</option>' + "".join(f"<option>{p}</option>" for p in PROVINCES) + '</select></div>'
    + field("postal", "Postal code", auto="postal-code", half=True, hint="Four-digit South African postal code.",
            extra=' inputmode="numeric" maxlength="4" pattern="[0-9]{4}"')
    + '</div><div class="ap-note-box"><div><p class="ap-kicker">Delivery fee</p>'
      '<p>We book the courier once your stock is reserved. The delivery charge is included in your final quote.</p></div>'
      '<strong>Confirmed before payment</strong></div></section>'
    # 03
    '<section class="ap-card ap-co-sec"><div class="ap-co-sh"><span class="ap-num">03</span><div><h2>Before you send</h2>'
    '<p>We confirm the details before requesting payment.</p></div></div><div class="ap-fields">'
    '<div class="ap-f"><label for="note">Order note <span class="ap-opt">(optional)</span></label>'
    '<textarea id="note" name="note" rows="3" maxlength="1000" placeholder="Anything we should know about your setup or delivery?"></textarea></div>'
    '<div class="ap-hp" aria-hidden="true"><label for="website">Website</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>'
    '<label class="ap-consent"><input type="checkbox" id="consent" name="consent" required>'
    '<span>I understand that availability, final pricing and delivery are confirmed before payment.</span></label>'
    '<p class="ap-small">Please read our <a href="/terms-conditions">terms</a> and <a href="/privacy-policy">privacy policy</a>.</p>'
    '<p class="ap-err" id="ap-co-err" role="alert"></p>'
    '<button type="submit" class="ap-btn ap-btn-main" id="ap-co-send">Request quote →</button>'
    '<p class="ap-small ap-center">You are not charged on this screen.</p></div></section></form>'
    '<aside class="ap-co-side"><div class="ap-card"><p class="ap-kicker">Your products</p><h2>Order review</h2>'
    '<p class="ap-small" id="ap-co-count"></p><ul class="ap-mini" id="ap-co-items"></ul>'
    '<div class="ap-sum-row ap-sum-total"><span>Final total</span><strong class="ap-tbc">To be confirmed</strong></div>'
    '<p class="ap-small">Availability and delivery are confirmed with your quote.</p>'
    '<a class="ap-btn-line" href="/cart">Edit cart →</a></div>' + HELP + '</aside></div>'
    '<div id="ap-co-done" hidden></div></div>'
)

QUOTE = '<div class="ap-co" id="ap-quote"><p class="ap-muted">Loading your quote…</p></div>'

PAGES = {
    "cart": ("Your cart", "Your Afri-Powered cart.", CART),
    "checkout": ("Checkout", "Request a quote from Afri-Powered Supplies.", CHECKOUT),
    "quote": ("Your quote", "Your Afri-Powered Supplies quote.", QUOTE),
}


def build(root):
    src = (root / "shop.html").read_text(encoding="utf-8")
    for name, (title, desc, body) in PAGES.items():
        main = ('<main class="site-content" id="content"><div class="ast-container"><div class="content-area primary" id="primary">'
                f'<div class="site-main" id="main">{body}<script defer src="/cart.js"></script></div></div></div></main>')
        html = re.sub(r"<main\b.*?</main>", lambda m: main, src, count=1, flags=re.S)
        html = re.sub(r"<title>[^<]*</title>", f"<title>{title} | Afri-Powered Supplies</title>", html, count=1)
        html = re.sub(r'<meta content="[^"]*" name="description"/>', f'<meta content="{desc}" name="description"/>', html, count=1)
        html = html.replace("<head>", '<head>\n<meta name="robots" content="noindex, nofollow">', 1)
        (root / f"{name}.html").write_text(html, encoding="utf-8", newline="")
        print(f"{name}.html written")


if __name__ == "__main__":
    build(Path(sys.argv[1] if len(sys.argv) > 1 else "public"))
