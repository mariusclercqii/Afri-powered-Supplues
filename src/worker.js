// Afri-Powered site worker.
// Serves the static site in ./public and adds the private admin backend:
//   /admin            admin app (static files, data only after login)
//   /api/login        password login (ADMIN_PASSWORD secret), /api/logout
//   /api/admin/...    load/save products, categories, banners, page text, delivery; upload images
//   /media/<file>     images uploaded from the admin (stored in KV)
//   /data/*.json      public data for the shop and banner (no cost prices or stock numbers)
//   /product/<slug>   product pages built from the saved product data
// All data lives in the KV namespace bound as STORE. Until STORE exists the site
// keeps working from the static files in public/data.

const KEYS = ["products", "categories", "promos", "content", "settings"];
const PAGES = ["/", "/about-us", "/blog", "/contact", "/shop", "/privacy-policy",
  "/refund-returns", "/shipping-policy", "/terms-conditions"];
const WA = "27718111466";
const SESSION_SECONDS = 12 * 3600;
const MAX_TRIES = 5, LOCK_SECONDS = 900;
const IMG_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

const DEFAULT_CATEGORIES = [
  { slug: "air-conditioning", name: "Air Conditioning", image: "/assets/Aircon-Thumbnail-e1725971821197.jpg" },
  { slug: "batteries", name: "Batteries", image: "/assets/image1-e1710794829802.jpeg" },
  { slug: "inverters", name: "Inverters", image: "/assets/image2.jpeg" },
  { slug: "pbs", name: "Portable Backup Systems", image: "/assets/WhatsApp-Image-2024-02-14-at-09.37.49-e1708942516353.jpeg" },
  { slug: "solar-geysers", name: "Solar Geysers", image: "/assets/WhatsApp-Image-2023-12-18-at-13.43.07-e1710794708594.jpeg" },
  { slug: "solar-lights-accessories", name: "Solar Lights & Accessories", image: "/assets/Solar-ligts-accessories-Thum.jpeg" },
  { slug: "solar-panels", name: "Solar Panels", image: "/assets/image0-e1710794955623.jpeg" },
].map(c => ({ ...c, show: true }));

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (err) {
      console.error(err && err.stack || err);
      return new Response("Something went wrong. Please try again.", { status: 500 });
    }
  },
};

async function route(req, env) {
  const url = new URL(req.url);
  const p = url.pathname;

  if (p.startsWith("/api/")) return api(req, env, url);
  if (p.startsWith("/media/")) return media(req, env, p.slice(7));
  if (p.startsWith("/_tpl/") || p === "/_tpl") return notFound(req, env);

  if (p === "/data/products.json") return json(publicProducts(await load(env, "products"), await load(env, "categories")), 60);
  if (p === "/data/categories.json") return json(publicCategories(await load(env, "categories"), await load(env, "products")), 60);
  if (p === "/data/promos.json") return json(await load(env, "promos"), 60);
  if (p === "/data/settings.json") return json(publicSettings(await load(env, "settings")), 60);
  if (p === "/sitemap.xml" && env.STORE) return sitemap(env, url.origin);

  if (p === "/admin" || p.startsWith("/admin/")) {
    const res = await env.ASSETS.fetch(req);
    return headers(res, {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
  }

  const m = p.match(/^\/product\/([a-z0-9-]+?)(?:\.html)?\/?$/);
  if (m && (req.method === "GET" || req.method === "HEAD")) return productPage(req, env, m[1]);

  return page(req, env, p);
}

/* ---------------- storage ---------------- */

async function load(env, key) {
  if (env.STORE) {
    const v = await env.STORE.get(key, { type: "json" });
    if (v != null) return v;
  }
  return seed(env, key);
}

async function asset(env, path) {
  return env.ASSETS.fetch(new Request("https://assets.local" + path));
}

async function seed(env, key) {
  if (key === "products") {
    const r = await asset(env, "/data/products.json");
    const list = r.ok ? await r.json() : [];
    return list.map(p => ({
      slug: p.slug, name: p.name, cat: p.cat, brand: p.brand || "", kw: p.kw ?? null, voltage: p.voltage ?? null,
      price: p.price, was: p.was ?? null, cost: null, stock: null, delivery: null, image: p.image || "",
      description: "", active: true,
    }));
  }
  if (key === "promos") {
    const r = await asset(env, "/data/promos.json");
    return r.ok ? r.json() : [];
  }
  if (key === "categories") return DEFAULT_CATEGORIES;
  if (key === "content") return {};
  if (key === "settings") return { zones: [], freeOver: null };
  return null;
}

/* ---------------- public data ---------------- */

function catNames(cats) {
  return Object.fromEntries(cats.map(c => [c.slug, c.name]));
}

function publicProducts(list, cats) {
  const names = catNames(cats);
  return list.filter(p => p.active !== false).map(p => ({
    name: p.name, slug: p.slug, cat: p.cat, category: names[p.cat] || p.cat, brand: p.brand || "",
    kw: p.kw ?? null, voltage: p.voltage ?? null, price: p.price, was: p.was ?? null,
    image: p.image || "", stock: p.stock === 0 ? "out" : "in",
  }));
}

function publicCategories(cats, products) {
  return cats.map(c => ({
    slug: c.slug, name: c.name, image: c.image || "", show: c.show !== false,
    count: products.filter(p => p.active !== false && p.cat === c.slug).length,
  }));
}

function publicSettings(s) {
  return { zones: s.zones || [], freeOver: s.freeOver ?? null };
}

/* ---------------- pages ---------------- */

function pageKey(path) {
  let k = path.replace(/\.html$/, "").replace(/\/+$/, "") || "/";
  if (k === "/index") k = "/";
  return k;
}

// Ask the asset server for a fresh copy (no 304s), so saved edits always show.
function freshRequest(req, url) {
  const h = new Headers(req.headers);
  h.delete("If-None-Match");
  h.delete("If-Modified-Since");
  return new Request(url || req.url, { method: req.method, headers: h, redirect: "manual" });
}

function noCache(res) {
  const r = new Response(res.body, res);
  r.headers.delete("ETag");
  r.headers.delete("Last-Modified");
  r.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  return r;
}

async function page(req, env, path) {
  const key = pageKey(path);
  if (!PAGES.includes(key) || (req.method !== "GET" && req.method !== "HEAD")) return env.ASSETS.fetch(req);
  const res = await env.ASSETS.fetch(freshRequest(req));
  if (!res.ok || !(res.headers.get("content-type") || "").includes("text/html")) return res;

  const content = (await load(env, "content"))[key] || {};
  let rw = new HTMLRewriter();
  if (Object.keys(content).length) {
    rw = rw.on("[data-ap]", {
      element(el) {
        const o = content[el.getAttribute("data-ap")];
        if (!o) return;
        if (el.tagName === "img") {
          if (o.src) {
            el.setAttribute("src", o.src);
            el.removeAttribute("srcset");
            el.removeAttribute("sizes");
          }
          if (o.alt != null) el.setAttribute("alt", o.alt);
        } else if (o.html != null) {
          el.setInnerContent(o.html, { html: true });
        }
      },
    });
  }
  if (key === "/") {
    const [cats, prods] = await Promise.all([load(env, "categories"), load(env, "products")]);
    const grid = categoryGrid(publicCategories(cats, prods));
    rw = rw.on(".elementor-widget-shortcode ul.products", { element(el) { el.setInnerContent(grid, { html: true }); } });
  }
  return noCache(rw.transform(res));
}

function categoryGrid(cats) {
  return cats.filter(c => c.show).map((c, i) => {
    const pos = i % 5 === 0 ? " first" : i % 5 === 4 ? " last" : "";
    const count = c.count ? `<mark class="count">${c.count} Product${c.count === 1 ? "" : "s"}</mark>` : "";
    return `<li class="product-category product${pos}"><a aria-label="Visit product category ${esc(c.name)}" href="/shop?cat=${encodeURIComponent(c.slug)}">` +
      `<img alt="${esc(c.name)}" decoding="async" height="300" loading="lazy" src="${esc(c.image)}" width="300"/> ` +
      `<h2 class="woocommerce-loop-category__title">${esc(c.name)}${count} </h2></a></li>`;
  }).join("\n");
}

function money(n) {
  return "R" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function absUrl(origin, u) {
  if (!u) return origin + "/assets/Vector-Logo-e1710787362928.png";
  return /^https?:\/\//.test(u) ? u : origin + (u.startsWith("/") ? u : "/" + u);
}

async function productPage(req, env, slug) {
  if (!env.STORE) return env.ASSETS.fetch(req); // not set up yet: use the static product pages
  const url = new URL(req.url);
  const [prods, cats, settings] = await Promise.all([load(env, "products"), load(env, "categories"), load(env, "settings")]);
  const p = prods.find(x => x.slug === slug && x.active !== false);
  if (!p) return notFound(req, env);
  if (url.pathname !== `/product/${slug}`) return Response.redirect(`${url.origin}/product/${slug}`, 301);

  const tpl = await env.ASSETS.fetch(freshRequest(req, url.origin + "/_tpl/product"));
  if (!tpl.ok) return tpl;

  const catName = catNames(cats)[p.cat] || p.cat || "Products";
  const catLink = `/shop?cat=${encodeURIComponent(p.cat || "")}`;
  const img = p.image || "/assets/Vector-Logo-e1710787362928.png";
  const desc = (p.description || "").trim();
  const metaDesc = (desc ? desc.replace(/\s+/g, " ").slice(0, 155) : `${p.name} at ${money(p.price)}. Order on WhatsApp from Afri-Powered Supplies.`);
  const out = p.stock === 0;
  const waText = `Hi Afri-Powered, I would like to order: ${p.name} (${money(p.price)})`;
  const descHtml = desc
    ? desc.split(/\n{2,}/).map(par => `<p>${esc(par).replace(/\n/g, "<br>")}</p>`).join("")
    : `<p>${esc(p.name)}. ${esc(catName)} supplied by Afri-Powered Supplies. WhatsApp us for stock, delivery and installation.</p>`;
  const ld = JSON.stringify({
    "@context": "https://schema.org", "@type": "Product", name: p.name, image: absUrl(url.origin, img),
    brand: { "@type": "Brand", name: p.brand || "Afri-Powered" }, description: metaDesc,
    offers: { "@type": "Offer", priceCurrency: "ZAR", price: String(p.price),
      availability: out ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" },
  }).replace(/</g, "\\u003c");

  const setContent = v => ({ element(el) { el.setAttribute("content", v); } });
  const rw = new HTMLRewriter()
    .on("head > title", { element(el) { el.setInnerContent(`${p.name} | Afri-Powered Supplies`); } })
    .on('meta[name="description"]', setContent(metaDesc))
    .on('meta[property="og:description"]', setContent(metaDesc))
    .on('meta[name="twitter:description"]', setContent(metaDesc))
    .on('meta[property="og:title"]', setContent(`${p.name} - AfriPowered`))
    .on('meta[name="twitter:title"]', setContent(`${p.name} - AfriPowered`))
    .on('meta[property="og:type"]', setContent("product"))
    .on('meta[property="og:url"]', setContent(`${url.origin}/product/${p.slug}`))
    .on('meta[property="og:image"]', setContent(absUrl(url.origin, img)))
    .on('meta[property="og:image:secure_url"]', setContent(absUrl(url.origin, img)))
    .on('meta[name="twitter:image"]', setContent(absUrl(url.origin, img)))
    .on('link[rel="canonical"]', { element(el) { el.setAttribute("href", `${url.origin}/product/${p.slug}`); } })
    .on(".woocommerce-product-gallery__image img", { element(el) { el.setAttribute("src", img); el.setAttribute("alt", p.name); el.removeAttribute("srcset"); } })
    .on("nav.woocommerce-breadcrumb", { element(el) {
      el.setInnerContent(`<a href="/">Home</a>&nbsp;/&nbsp;<a href="${esc(catLink)}">${esc(catName)}</a>&nbsp;/&nbsp;${esc(p.name)}`, { html: true });
    } })
    .on("span.single-product-category", { element(el) { el.setInnerContent(`<a href="${esc(catLink)}" rel="tag">${esc(catName)}</a>`, { html: true }); } })
    .on("h1.product_title", { element(el) { el.setInnerContent(p.name); } })
    .on("p.price", { element(el) {
      const was = p.was ? `<del class="ap-was">${money(p.was)}</del> ` : "";
      el.setInnerContent(`${was}<span class="woocommerce-Price-amount amount"><bdi>${money(p.price)}</bdi></span>`, { html: true });
      el.after(out
        ? `<p class="ap-stock ap-out">Out of stock. WhatsApp us for the next delivery date.</p>`
        : `<p class="ap-stock ap-in">In stock</p>`, { html: true });
    } })
    .on(".ap-buy", { element(el) {
      el.setInnerContent(`<a class="ap-btn ap-wa-btn" href="https://wa.me/${WA}?text=${encodeURIComponent(waText)}" rel="noopener" target="_blank">${out ? "Ask about stock on WhatsApp" : "Order on WhatsApp"}</a>`, { html: true });
      const d = deliveryHtml(p, settings);
      if (d) el.after(d, { html: true });
    } })
    .on("#tab-description", { element(el) { el.setInnerContent(descHtml, { html: true }); } })
    .on('main script[type="application/ld+json"]', { element(el) { el.setInnerContent(ld, { html: true }); } });
  return noCache(rw.transform(tpl));
}

// Delivery fee per area; a product's own fee replaces the area fee (collection stays free).
function deliveryHtml(p, s) {
  const zones = (s.zones || []).filter(z => z.name);
  if (!zones.length) return "";
  const free = s.freeOver != null && Number(p.price) >= Number(s.freeOver);
  const rows = zones.map(z => {
    let fee = Number(z.fee) || 0;
    if (fee > 0 && p.delivery != null) fee = Number(p.delivery);
    const label = fee === 0 || free ? "Free" : money(fee);
    return `<li><span>${esc(z.name)}</span><strong>${label}</strong></li>`;
  }).join("");
  const note = s.freeOver != null && !free ? `<small>Free delivery on orders over ${money(s.freeOver)}.</small>` : "";
  return `<div class="ap-delivery"><h4>Delivery</h4><ul>${rows}</ul>${note}</div>`;
}

// Pages plus every visible product, so new products are found by Google.
async function sitemap(env, origin) {
  const prods = (await load(env, "products")).filter(p => p.active !== false);
  const urls = PAGES.map(p => origin + (p === "/" ? "/" : p))
    .concat(prods.map(p => `${origin}/product/${p.slug}`));
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => `<url><loc>${esc(u)}</loc></url>`).join("\n") + "\n</urlset>\n";
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

async function notFound(req, env) {
  const r = await env.ASSETS.fetch(new Request(new URL("/404", req.url)));
  return new Response(r.ok ? r.body : "Not found", { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function media(req, env, name) {
  if (!env.STORE || !/^[a-f0-9]{24}\.(jpg|png|webp|gif)$/.test(name)) return notFound(req, env);
  const { value, metadata } = await env.STORE.getWithMetadata("media:" + name, { type: "arrayBuffer", cacheTtl: 86400 });
  if (!value) return notFound(req, env);
  return new Response(value, {
    headers: {
      "Content-Type": (metadata && metadata.type) || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/* ---------------- API ---------------- */

async function api(req, env, url) {
  const p = url.pathname;
  const m = req.method;

  if (m !== "GET" && m !== "HEAD") {
    // Same-site check: the admin app always sends this header and the matching Origin.
    const origin = req.headers.get("Origin");
    if (req.headers.get("X-AP-Admin") !== "1" || (origin && origin !== url.origin)) return err(403, "Request blocked.");
  }

  if (p === "/api/login" && m === "POST") return login(req, env);
  if (p === "/api/logout" && m === "POST") return json({ ok: true }, 0, { "Set-Cookie": cookie("", 0) });

  if (!p.startsWith("/api/admin/")) return err(404, "Not found.");
  if (!(await authed(req, env))) return err(401, "Please log in again.");
  if (!env.STORE) return err(503, "Storage is not set up yet. Add the STORE KV namespace in wrangler.jsonc.");

  if (p === "/api/admin/session" && m === "GET") return json({ ok: true }, 0);

  if (p === "/api/admin/data" && m === "GET") {
    const vals = await Promise.all(KEYS.map(k => load(env, k)));
    return json(Object.fromEntries(KEYS.map((k, i) => [k, vals[i]])), 0);
  }

  const save = p.match(/^\/api\/admin\/data\/([a-z]+)$/);
  if (save && m === "PUT" && KEYS.includes(save[1])) {
    const body = await readJson(req, 2_000_000);
    if (body === undefined) return err(400, "That data could not be read.");
    let clean;
    try {
      clean = await CLEAN[save[1]](body, env);
    } catch (e) {
      return err(400, e.message || "Some details are not valid.");
    }
    await env.STORE.put(save[1], JSON.stringify(clean));
    return json({ ok: true, [save[1]]: clean }, 0);
  }

  if (p === "/api/admin/upload" && m === "POST") {
    const type = (req.headers.get("Content-Type") || "").split(";")[0].trim();
    const ext = IMG_TYPES[type];
    if (!ext) return err(415, "Please upload a JPG, PNG, WebP or GIF image.");
    const buf = await req.arrayBuffer();
    if (!buf.byteLength) return err(400, "The image is empty.");
    if (buf.byteLength > 8 * 1024 * 1024) return err(413, "That image is too big (8 MB max).");
    const id = [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(16).padStart(2, "0")).join("");
    const name = `${id}.${ext}`;
    await env.STORE.put("media:" + name, buf, { metadata: { type, size: buf.byteLength, at: Date.now() } });
    return json({ ok: true, url: "/media/" + name }, 0);
  }

  return err(404, "Not found.");
}

async function readJson(req, max) {
  const t = await req.text();
  if (t.length > max) return undefined;
  try { return JSON.parse(t); } catch { return undefined; }
}

/* ---------------- login ---------------- */

const enc = new TextEncoder();

async function sha256(s) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

function sameBytes(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

async function sessionKey(env) {
  const raw = await sha256("ap-session:" + (env.SESSION_SECRET || env.ADMIN_PASSWORD));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function hex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function cookie(value, maxAge) {
  return `ap_admin=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

async function login(req, env) {
  if (!env.ADMIN_PASSWORD) return err(503, "The admin password has not been set up in Cloudflare yet.");
  const ip = req.headers.get("CF-Connecting-IP") || "local";
  const rlKey = "rl:" + ip;
  const tries = env.STORE ? Number(await env.STORE.get(rlKey)) || 0 : 0;
  if (tries >= MAX_TRIES) return err(429, "Too many wrong passwords. Please wait 15 minutes and try again.");

  const body = await readJson(req, 2000);
  const pw = body && typeof body.password === "string" ? body.password : "";
  const ok = sameBytes(await sha256(pw), await sha256(env.ADMIN_PASSWORD));
  if (!ok) {
    if (env.STORE) await env.STORE.put(rlKey, String(tries + 1), { expirationTtl: LOCK_SECONDS });
    const left = MAX_TRIES - tries - 1;
    return err(401, left > 0 ? `Wrong password. ${left} ${left === 1 ? "try" : "tries"} left.` : "Wrong password. Please wait 15 minutes and try again.");
  }
  if (env.STORE && tries) await env.STORE.delete(rlKey);

  const exp = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const sig = hex(await crypto.subtle.sign("HMAC", await sessionKey(env), enc.encode(exp)));
  return json({ ok: true }, 0, { "Set-Cookie": cookie(`${exp}.${sig}`, SESSION_SECONDS) });
}

async function authed(req, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const c = (req.headers.get("Cookie") || "").match(/(?:^|;\s*)ap_admin=(\d+)\.([a-f0-9]{64})/);
  if (!c || Number(c[1]) < Date.now() / 1000) return false;
  const sig = new Uint8Array(c[2].match(/../g).map(h => parseInt(h, 16)));
  return crypto.subtle.verify("HMAC", await sessionKey(env), sig, enc.encode(c[1]));
}

/* ---------------- validation ---------------- */

function str(v, max, field) {
  if (v == null) return "";
  if (typeof v !== "string" && typeof v !== "number") throw new Error(`${field} is not valid.`);
  const s = String(v).trim();
  if (s.length > max) throw new Error(`${field} is too long (max ${max} characters).`);
  return s;
}

function num(v, field, { int = false, allowNull = true } = {}) {
  if (v === "" || v == null) {
    if (allowNull) return null;
    throw new Error(`${field} is required.`);
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new Error(`${field} must be a number of 0 or more.`);
  return int ? Math.round(n) : Math.round(n * 100) / 100;
}

function link(v, field, max = 1000) {
  const s = str(v, max, field);
  if (s && !/^(https:\/\/|http:\/\/localhost|\/(?!\/))/.test(s)) throw new Error(`${field} must start with https:// or /`);
  return s;
}

function slug(v, field) {
  const s = str(v, 120, field);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) throw new Error(`${field} may only use lowercase letters, numbers and dashes.`);
  return s;
}

function list(v, max, field) {
  if (!Array.isArray(v)) throw new Error(`${field} must be a list.`);
  if (v.length > max) throw new Error(`Too many ${field} (max ${max}).`);
  return v;
}

function date(v, field) {
  const s = str(v, 10, field);
  if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${field} must be a date like 2026-11-30.`);
  return s;
}

const CLEAN = {
  async products(v) {
    const seen = new Set();
    return list(v, 3000, "products").map((p, i) => {
      const name = str(p.name, 200, `Product ${i + 1} name`);
      if (!name) throw new Error(`Product ${i + 1} needs a name.`);
      const s = slug(p.slug, `Web address for "${name}"`);
      if (seen.has(s)) throw new Error(`Two products use the web address "${s}".`);
      seen.add(s);
      return {
        slug: s, name, cat: slug(p.cat, `Category for "${name}"`), brand: str(p.brand, 80, "Brand"),
        kw: num(p.kw, "kW"), voltage: num(p.voltage, "Voltage"),
        price: num(p.price, `Price for "${name}"`, { allowNull: false }), was: num(p.was, "Was price"),
        cost: num(p.cost, "Cost price"), stock: num(p.stock, "Stock", { int: true }),
        delivery: num(p.delivery, "Delivery fee"), image: link(p.image, `Image for "${name}"`),
        description: str(p.description, 8000, "Description"), active: p.active !== false,
      };
    });
  },
  async categories(v) {
    const seen = new Set();
    return list(v, 100, "categories").map((c, i) => {
      const name = str(c.name, 80, `Category ${i + 1} name`);
      if (!name) throw new Error(`Category ${i + 1} needs a name.`);
      const s = slug(c.slug, `Web address for "${name}"`);
      if (seen.has(s)) throw new Error(`Two categories use "${s}".`);
      seen.add(s);
      return { slug: s, name, image: link(c.image, `Image for "${name}"`), show: c.show !== false };
    });
  },
  async promos(v) {
    return list(v, 30, "banners").map((b, i) => {
      const image = link(b.image, `Banner ${i + 1} image`);
      if (!image) throw new Error(`Banner ${i + 1} needs an image.`);
      const l = str(b.link, 1000, `Banner ${i + 1} link`);
      if (l && !/^(https:\/\/|\/(?!\/)|#)/.test(l)) throw new Error(`Banner ${i + 1} link must start with https:// or /`);
      return { image, alt: str(b.alt, 300, "Banner description"), link: l, start: date(b.start, "Start date"), end: date(b.end, "End date") };
    });
  },
  async settings(v) {
    if (!v || typeof v !== "object") throw new Error("Delivery settings are not valid.");
    return {
      zones: list(v.zones || [], 30, "delivery areas").map((z, i) => ({
        name: str(z.name, 60, `Delivery area ${i + 1}`), fee: num(z.fee, `Fee for delivery area ${i + 1}`, { allowNull: false }),
      })).filter(z => z.name),
      freeOver: num(v.freeOver, "Free delivery amount"),
    };
  },
  async content(v) {
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Page content is not valid.");
    const out = {};
    for (const [page, fields] of Object.entries(v)) {
      if (!PAGES.includes(page)) throw new Error(`Unknown page ${page}.`);
      if (!fields || typeof fields !== "object") continue;
      const f = {};
      for (const [k, o] of Object.entries(fields)) {
        if (!/^[a-z0-9-]{1,40}$/.test(k) || !o || typeof o !== "object") continue;
        const item = {};
        if (o.html != null) item.html = await sanitize(str(o.html, 50000, "Page text"));
        if (o.src != null) item.src = link(o.src, "Image");
        if (o.alt != null) item.alt = str(o.alt, 300, "Image description");
        if (Object.keys(item).length) f[k] = item;
      }
      if (Object.keys(f).length) out[page] = f;
    }
    return out;
  },
};

// Keep only simple formatting in edited page text.
const ALLOWED = {
  p: [], br: [], strong: [], b: [], em: [], i: [], u: [], a: ["href"], ul: [], ol: [], li: [],
  h2: [], h3: [], h4: [], span: ["class"], mark: ["class"],
};
const DROP = new Set(["script", "style", "iframe", "object", "embed", "template", "noscript", "svg", "math", "form",
  "input", "textarea", "select", "button", "link", "meta", "base", "title", "xmp", "plaintext", "noembed", "noframes", "frame", "frameset"]);

async function sanitize(html) {
  const out = await new HTMLRewriter()
    .on("*", {
      element(el) {
        const t = el.tagName;
        if (DROP.has(t)) { el.remove(); return; }
        const allow = ALLOWED[t];
        if (!allow) { el.removeAndKeepContent(); return; }
        for (const [n] of [...el.attributes]) if (!allow.includes(n)) el.removeAttribute(n);
        if (t === "a") {
          const h = (el.getAttribute("href") || "").trim();
          if (!/^(https?:|mailto:|tel:|\/|#)/i.test(h)) el.removeAttribute("href");
          else if (/^https?:/i.test(h)) { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener"); }
        }
      },
      comments(c) { c.remove(); },
    })
    .transform(new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } }))
    .text();
  return out.trim();
}

/* ---------------- helpers ---------------- */

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function json(data, maxAge, extra = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": maxAge ? `public, max-age=${maxAge}` : "no-store",
      ...extra,
    },
  });
}

function err(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function headers(res, h) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(h)) r.headers.set(k, v);
  return r;
}
