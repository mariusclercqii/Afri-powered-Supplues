(function () {
"use strict";

/* ============ basics ============ */
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var WA = "27718111466";
var PAGES = [["/", "Home"], ["/about-us", "About us"], ["/contact", "Contact"], ["/shop", "Shop"], ["/blog", "Blog"],
  ["/shipping-policy", "Shipping policy"], ["/refund-returns", "Refunds & returns"], ["/privacy-policy", "Privacy policy"],
  ["/terms-conditions", "Terms & conditions"]];
var TAB_KEY = { products: "products", categories: "categories", banners: "promos", pages: "content", delivery: "settings" };

var S = { data: null, saved: {}, tab: "dashboard", q: "", cat: "", showHidden: true, page: "/", pageFields: null };

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function money(n) {
  if (n == null || n === "" || isNaN(n)) return "–";
  var neg = n < 0; n = Math.abs(Math.round(n));
  return (neg ? "-R" : "R") + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function numOrNull(v) { if (v === "" || v == null) return null; var n = Number(v); return isFinite(n) ? n : null; }
function slugify(s) {
  return String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "item";
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function toast(msg, isErr) {
  var t = $("#toast"); t.textContent = msg; t.className = "toast" + (isErr ? " err" : ""); t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, isErr ? 6000 : 2500);
}

function api(path, opts) {
  opts = opts || {};
  var h = { "X-AP-Admin": "1" };
  if (opts.json !== undefined) { h["Content-Type"] = "application/json"; opts.body = JSON.stringify(opts.json); }
  if (opts.type) h["Content-Type"] = opts.type;
  return fetch(path, { method: opts.method || "GET", headers: h, body: opts.body, credentials: "same-origin", cache: "no-store" })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (r.status === 401 && path.indexOf("/api/admin/") === 0) { showLogin("Your session has ended. Please log in again."); }
        if (!r.ok) { var e = new Error(d.error || ("Error " + r.status)); e.status = r.status; throw e; }
        return d;
      });
    });
}

/* ============ margins ============ */
function margin(p) {
  var price = numOrNull(p.price), cost = numOrNull(p.cost);
  if (price == null || cost == null) return null;
  var profit = price - cost;
  return { profit: profit, pct: price ? profit / price * 100 : 0, markup: cost ? profit / cost * 100 : null };
}
function marginClass(m) { return !m ? "none" : m.pct < 10 ? "bad" : m.pct < 20 ? "ok" : "good"; }
function marginHtml(p) {
  var m = margin(p);
  if (!m) return '<span class="margin none">Add cost</span>';
  return '<span class="margin ' + marginClass(m) + '">' + money(m.profit) + "<small>" + m.pct.toFixed(1) + "%</small></span>";
}

/* ============ dirty state ============ */
function snapshot(k) { S.saved[k] = JSON.stringify(S.data[k]); }
function isDirty(k) { return k && S.data && JSON.stringify(S.data[k]) !== S.saved[k]; }
function anyDirty() { return Object.keys(TAB_KEY).some(function (t) { return isDirty(TAB_KEY[t]); }); }
function updateBar() { $("#savebar").hidden = !isDirty(TAB_KEY[S.tab]); }
window.addEventListener("beforeunload", function (e) { if (anyDirty()) { e.preventDefault(); e.returnValue = ""; } });

function saveKey(k) {
  var btn = $("#save"); btn.disabled = true; btn.textContent = "Saving…";
  return api("/api/admin/data/" + k, { method: "PUT", json: S.data[k] }).then(function (d) {
    S.data[k] = d[k]; snapshot(k); updateBar(); toast("Saved. The website updates within a minute.");
    return d;
  }).catch(function (e) { toast(e.message, true); throw e; })
    .finally(function () { btn.disabled = false; btn.textContent = "Save changes"; });
}
$("#save").addEventListener("click", function () {
  var k = TAB_KEY[S.tab]; if (!k) return;
  saveKey(k).then(function () { if (S.tab === "pages") loadPage(S.page); else render(); }).catch(function () {});
});
$("#discard").addEventListener("click", function () {
  var k = TAB_KEY[S.tab]; if (!k) return;
  S.data[k] = JSON.parse(S.saved[k]); updateBar();
  if (S.tab === "pages") loadPage(S.page); else render();
});

/* ============ login ============ */
function showLogin(msg) {
  $("#app").hidden = true; $("#login").hidden = false; $("#login-msg").textContent = msg || "";
  setTimeout(function () { $("#pw").focus(); }, 30);
}
$("#login-form").addEventListener("submit", function (e) {
  e.preventDefault();
  var b = $("#login-form button"); b.disabled = true; $("#login-msg").textContent = "";
  api("/api/login", { method: "POST", json: { password: $("#pw").value } })
    .then(function () { $("#pw").value = ""; start(); })
    .catch(function (er) { $("#login-msg").textContent = er.message; })
    .finally(function () { b.disabled = false; });
});
$("#logout").addEventListener("click", function () {
  if (anyDirty() && !confirm("You have unsaved changes. Log out anyway?")) return;
  api("/api/logout", { method: "POST" }).finally(function () { S.data = null; showLogin("You are logged out."); });
});

function start() {
  $("#login").hidden = true; $("#app").hidden = false;
  $("#view").innerHTML = '<div class="loading">Loading…</div>';
  api("/api/admin/data").then(function (d) {
    S.data = d; Object.keys(d).forEach(snapshot); go(location.hash.slice(1) || "dashboard");
  }).catch(function (e) {
    if (e.status === 401) return;
    $("#view").innerHTML = '<div class="card"><h2>Admin is not ready yet</h2><p>' + esc(e.message) + "</p></div>";
  });
}

/* ============ tabs ============ */
$("#tabs").addEventListener("click", function (e) {
  var b = e.target.closest("button[data-tab]"); if (b) go(b.dataset.tab);
});
window.addEventListener("hashchange", function () { var t = location.hash.slice(1); if (t && t !== S.tab && S.data) go(t); });
function go(tab) {
  if (!VIEWS[tab]) tab = "dashboard";
  if (tab !== S.tab && isDirty(TAB_KEY[S.tab])) {
    if (!confirm("You have unsaved changes on this screen. Leave without saving?")) { location.hash = S.tab; return; }
    var k = TAB_KEY[S.tab]; S.data[k] = JSON.parse(S.saved[k]);
  }
  S.tab = tab; if (location.hash.slice(1) !== tab) history.replaceState(null, "", "#" + tab);
  $$("#tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === tab); });
  render(); window.scrollTo(0, 0);
}
function render() { VIEWS[S.tab](); updateBar(); }

/* ============ images ============ */
function pickFile(accept) {
  return new Promise(function (res) {
    var i = document.createElement("input"); i.type = "file"; i.accept = accept || "image/*";
    i.onchange = function () { res(i.files && i.files[0]); }; i.click();
  });
}
// Shrink big photos before upload so the site stays fast. Small PNGs keep their transparency.
function prepareImage(file, maxW) {
  if (!file) return Promise.reject(new Error("No file chosen."));
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return Promise.reject(new Error("Please choose a JPG, PNG, WebP or GIF image."));
  if (file.type === "image/gif") return Promise.resolve(file);
  return createImageBitmap(file).then(function (bmp) {
    var w = bmp.width, h = bmp.height;
    if (file.type === "image/png" && file.size < 700 * 1024 && w <= maxW) return file;
    if (file.size < 400 * 1024 && w <= maxW && file.type !== "image/png") return file;
    var scale = Math.min(1, maxW / w), c = document.createElement("canvas");
    c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(function (res) { c.toBlob(function (b) { res(b); }, "image/jpeg", 0.85); });
  });
}
function uploadImage(maxW) {
  return pickFile().then(function (f) {
    if (!f) return null;
    toast("Uploading image…");
    return prepareImage(f, maxW).then(function (blob) {
      return api("/api/admin/upload", { method: "POST", body: blob, type: blob.type || f.type });
    }).then(function (d) { toast("Image uploaded."); return d.url; });
  }).catch(function (e) { toast(e.message, true); return null; });
}

/* ============ modal ============ */
function openModal(html) { $("#modal-card").innerHTML = html; $("#modal").hidden = false; document.body.style.overflow = "hidden"; }
function closeModal() { $("#modal").hidden = true; $("#modal-card").innerHTML = ""; document.body.style.overflow = ""; }
$("#modal").addEventListener("mousedown", function (e) { if (e.target.id === "modal") closeModal(); });
document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });

/* ============ dashboard ============ */
function dashboard() {
  var P = S.data.products, live = P.filter(function (p) { return p.active !== false; });
  var withCost = live.filter(function (p) { return margin(p); });
  var avg = withCost.length ? withCost.reduce(function (a, p) { return a + margin(p).pct; }, 0) / withCost.length : null;
  var tracked = live.filter(function (p) { return p.stock != null; });
  var costVal = 0, retailVal = 0;
  tracked.forEach(function (p) { retailVal += p.stock * (p.price || 0); if (p.cost != null) costVal += p.stock * p.cost; });
  var out = live.filter(function (p) { return p.stock === 0; });
  var low = live.filter(function (p) { return p.stock != null && p.stock > 0 && p.stock <= 2; });
  var noCost = live.filter(function (p) { return p.cost == null; });
  var lowM = withCost.filter(function (p) { return margin(p).pct < 15; });
  var now = new Date().toISOString().slice(0, 10);
  var bannersLive = S.data.promos.filter(function (b) { return (!b.start || b.start <= now) && (!b.end || b.end >= now); }).length;

  function list(title, items, why) {
    if (!items.length) return "";
    return '<div class="card"><h3>' + title + ' <span class="tag">' + items.length + "</span></h3><div class=\"table-wrap\"><table><tbody>" +
      items.slice(0, 12).map(function (p) {
        return "<tr><td>" + (p.image ? '<img class="thumb" src="' + esc(p.image) + '" alt="">' : "") + '</td><td class="pname">' + esc(p.name) +
          '</td><td class="num">' + why(p) + '</td><td class="num"><button class="btn small" data-edit="' + esc(p.slug) + '">Edit</button></td></tr>';
      }).join("") + "</tbody></table></div>" + (items.length > 12 ? '<p class="sub">and ' + (items.length - 12) + " more…</p>" : "") + "</div>";
  }

  $("#view").innerHTML =
    '<div class="head"><h2>Dashboard</h2><a class="btn" href="/" target="_blank" rel="noopener">View website ↗</a></div>' +
    '<div class="stats">' +
    stat("Products on the site", live.length, (P.length - live.length) + " hidden") +
    stat("Average profit margin", avg == null ? "–" : avg.toFixed(1) + "%", withCost.length + " of " + live.length + " have a cost price") +
    stat("Stock value at cost", money(costVal), tracked.length + " products with stock counts") +
    stat("Stock value at selling price", money(retailVal), "Possible profit " + money(retailVal - costVal)) +
    stat("Out of stock", out.length, low.length + " running low (2 or fewer)") +
    stat("Banners showing", bannersLive + " of " + S.data.promos.length, "on the home page") +
    "</div>" +
    '<div class="stack">' +
    list("Out of stock", out, function () { return '<span class="tag red">0 left</span>'; }) +
    list("Running low", low, function (p) { return '<span class="tag amber">' + p.stock + " left</span>"; }) +
    list("Low profit margin (under 15%)", lowM, function (p) { return marginHtml(p); }) +
    list("Missing cost price (margin unknown)", noCost, function (p) { return money(p.price); }) +
    (!out.length && !low.length && !lowM.length && !noCost.length ? '<div class="card empty">Everything looks good.</div>' : "") +
    "</div>";
  $$("[data-edit]").forEach(function (b) { b.onclick = function () { editProduct(b.dataset.edit); }; });
}
function stat(label, val, sub) { return '<div class="stat"><small>' + esc(label) + "</small><b>" + esc(val) + "</b><em>" + esc(sub) + "</em></div>"; }

/* ============ products ============ */
function catName(slug) { var c = S.data.categories.find(function (c) { return c.slug === slug; }); return c ? c.name : slug || "–"; }

function products() {
  $("#view").innerHTML =
    '<div class="head"><h2>Products</h2><button class="btn primary" id="add-product">+ Add product</button></div>' +
    '<p class="hint">Change prices, cost prices and stock straight in the table, then press <b>Save changes</b>. Click a product name for images, description and delivery. Cost prices and stock numbers are never shown on the website.</p>' +
    '<div class="toolbar"><input type="search" id="p-q" placeholder="Search products" value="' + esc(S.q) + '">' +
    '<select id="p-cat"><option value="">All categories</option>' + S.data.categories.map(function (c) {
      return '<option value="' + esc(c.slug) + '"' + (S.cat === c.slug ? " selected" : "") + ">" + esc(c.name) + "</option>";
    }).join("") + "</select>" +
    '<label class="check"><input type="checkbox" id="p-hidden"' + (S.showHidden ? " checked" : "") + "> Show hidden</label></div>" +
    '<div class="table-wrap"><table><thead><tr><th></th><th>Product</th><th>Category</th><th class="num">Selling price</th><th class="num">Cost price</th><th class="num">Profit</th><th class="num">Stock</th><th></th></tr></thead><tbody id="p-rows"></tbody></table></div>';
  $("#p-q").oninput = function () { S.q = this.value; productRows(); };
  $("#p-cat").onchange = function () { S.cat = this.value; productRows(); };
  $("#p-hidden").onchange = function () { S.showHidden = this.checked; productRows(); };
  $("#add-product").onclick = function () { editProduct(null); };
  productRows();
}
function productRows() {
  var q = S.q.trim().toLowerCase();
  var rows = S.data.products.map(function (p, i) { return [p, i]; }).filter(function (x) {
    var p = x[0];
    return (!q || (p.name + " " + p.brand + " " + catName(p.cat)).toLowerCase().indexOf(q) > -1) &&
      (!S.cat || p.cat === S.cat) && (S.showHidden || p.active !== false);
  });
  var tb = $("#p-rows");
  if (!rows.length) { tb.innerHTML = '<tr><td colspan="8" class="empty">No products found.</td></tr>'; return; }
  tb.innerHTML = rows.map(function (x) {
    var p = x[0], i = x[1];
    var st = p.stock === 0 ? ' <span class="tag red">Out of stock</span>' : p.stock != null && p.stock <= 2 ? ' <span class="tag amber">Low</span>' : "";
    return '<tr data-i="' + i + '"><td>' + (p.image ? '<img class="thumb" src="' + esc(p.image) + '" alt="" loading="lazy">' : '<div class="thumb"></div>') + "</td>" +
      '<td class="pname"><a href="#" data-act="edit">' + esc(p.name) + "</a>" + (p.active === false ? ' <span class="tag">Hidden</span>' : "") + st +
      "<small>" + esc(p.brand || "") + "</small></td><td>" + esc(catName(p.cat)) + "</td>" +
      '<td class="num"><input class="cell" type="number" min="0" step="1" data-f="price" value="' + (p.price ?? "") + '" aria-label="Selling price"></td>' +
      '<td class="num"><input class="cell" type="number" min="0" step="1" data-f="cost" value="' + (p.cost ?? "") + '" placeholder="–" aria-label="Cost price"></td>' +
      '<td class="num" data-m>' + marginHtml(p) + "</td>" +
      '<td class="num"><input class="cell stock" type="number" min="0" step="1" data-f="stock" value="' + (p.stock ?? "") + '" placeholder="–" aria-label="Stock"></td>' +
      '<td class="num"><a class="btn small" href="/product/' + esc(p.slug) + '" target="_blank" rel="noopener" title="View on website">↗</a></td></tr>';
  }).join("");
}
document.addEventListener("input", function (e) {
  var inp = e.target; if (!inp.matches("#p-rows input.cell")) return;
  var tr = inp.closest("tr"), p = S.data.products[+tr.dataset.i], f = inp.dataset.f;
  if (f === "price") p.price = numOrNull(inp.value) ?? 0; else p[f] = numOrNull(inp.value);
  if (f === "stock" && p.stock != null) p.stock = Math.round(p.stock);
  $("[data-m]", tr).innerHTML = marginHtml(p); updateBar();
});
document.addEventListener("click", function (e) {
  var a = e.target.closest("#p-rows [data-act=edit]"); if (!a) return;
  e.preventDefault(); editProduct(S.data.products[+a.closest("tr").dataset.i].slug);
});

function editProduct(slug) {
  var isNew = !slug;
  var orig = isNew ? null : S.data.products.find(function (p) { return p.slug === slug; });
  var p = isNew ? { name: "", slug: "", cat: S.cat || (S.data.categories[0] || {}).slug || "", brand: "", kw: null, voltage: null, price: 0, was: null, cost: null, stock: null, delivery: null, image: "", description: "", active: true } : clone(orig);
  var slugTouched = !isNew;
  function v(x) { return x == null ? "" : esc(x); }
  openModal(
    "<h2>" + (isNew ? "Add product" : "Edit product") + "</h2>" +
    '<div class="stack">' +
    '<div class="img-edit"><img id="e-img" src="' + v(p.image) + '" alt=""><div><button class="btn" id="e-upload">Upload image</button><p class="sub">Square photos on a white background look best. Big photos are shrunk automatically.</p></div></div>' +
    '<div><label for="e-name">Product name</label><input id="e-name" value="' + v(p.name) + '"></div>' +
    '<div class="grid2"><div><label for="e-cat">Category</label><select id="e-cat">' + S.data.categories.map(function (c) {
      return '<option value="' + esc(c.slug) + '"' + (c.slug === p.cat ? " selected" : "") + ">" + esc(c.name) + "</option>";
    }).join("") + '</select></div><div><label for="e-brand">Brand</label><input id="e-brand" value="' + v(p.brand) + '"></div></div>' +
    '<div class="grid4"><div><label for="e-price">Selling price (R)</label><input id="e-price" type="number" min="0" value="' + v(p.price) + '"></div>' +
    '<div><label for="e-was">Was price (R) <span class="sub">optional</span></label><input id="e-was" type="number" min="0" value="' + v(p.was) + '"></div>' +
    '<div><label for="e-cost">Cost price (R) <span class="sub">private</span></label><input id="e-cost" type="number" min="0" value="' + v(p.cost) + '"></div>' +
    '<div><label for="e-stock">Stock <span class="sub">blank = not counted</span></label><input id="e-stock" type="number" min="0" step="1" value="' + v(p.stock) + '"></div></div>' +
    '<div class="calc" id="e-calc"></div>' +
    '<div class="grid3"><div><label for="e-kw">Size (kW) <span class="sub">for shop filter</span></label><input id="e-kw" type="number" min="0" step="0.1" value="' + v(p.kw) + '"></div>' +
    '<div><label for="e-volt">Voltage (V)</label><input id="e-volt" type="number" min="0" value="' + v(p.voltage) + '"></div>' +
    '<div><label for="e-del">Own delivery fee (R) <span class="sub">blank = use area fees</span></label><input id="e-del" type="number" min="0" value="' + v(p.delivery) + '"></div></div>' +
    '<div><label for="e-desc">Description <span class="sub">leave a blank line between paragraphs</span></label><textarea id="e-desc" rows="6">' + v(p.description) + "</textarea></div>" +
    '<div class="grid2"><div><label for="e-slug">Web address</label><input id="e-slug" value="' + v(p.slug) + '"><p class="sub">afripowered.co.za/product/<span id="e-slug-show">' + v(p.slug) + "</span></p></div>" +
    '<div><label>&nbsp;</label><label class="check"><input type="checkbox" id="e-active"' + (p.active !== false ? " checked" : "") + "> Show on the website</label></div></div>" +
    '<p class="msg" id="e-msg"></p></div>' +
    '<div class="foot">' + (isNew ? "" : '<button class="btn danger left" id="e-del-btn">Delete product</button>') +
    '<button class="btn" id="e-cancel">Cancel</button><button class="btn primary" id="e-save">' + (isNew ? "Add product" : "Save product") + "</button></div>"
  );
  function read() {
    p.name = $("#e-name").value.trim(); p.cat = $("#e-cat").value; p.brand = $("#e-brand").value.trim();
    p.price = numOrNull($("#e-price").value); p.was = numOrNull($("#e-was").value); p.cost = numOrNull($("#e-cost").value);
    p.stock = numOrNull($("#e-stock").value); if (p.stock != null) p.stock = Math.round(p.stock);
    p.kw = numOrNull($("#e-kw").value); p.voltage = numOrNull($("#e-volt").value); p.delivery = numOrNull($("#e-del").value);
    p.description = $("#e-desc").value; p.slug = slugify($("#e-slug").value); p.active = $("#e-active").checked;
  }
  function calc() {
    read(); var m = margin(p);
    $("#e-calc").innerHTML = m
      ? '<div><small>Profit per sale</small><b class="' + marginClass(m) + '">' + money(m.profit) + "</b></div><div><small>Profit margin</small><b class=\"" + marginClass(m) + '">' + m.pct.toFixed(1) + "%</b></div><div><small>Markup on cost</small><b>" + (m.markup == null ? "–" : m.markup.toFixed(1) + "%") + "</b></div>"
      : '<div style="grid-column:1/-1" class="sub">Enter the cost price to see your profit on this product.</div>';
  }
  $("#e-name").addEventListener("input", function () { if (!slugTouched) { $("#e-slug").value = slugify(this.value); $("#e-slug-show").textContent = $("#e-slug").value; } });
  $("#e-slug").addEventListener("input", function () { slugTouched = true; $("#e-slug-show").textContent = slugify(this.value); });
  ["#e-price", "#e-cost"].forEach(function (s) { $(s).addEventListener("input", calc); });
  calc();
  $("#e-upload").onclick = function () { uploadImage(1200).then(function (u) { if (u) { p.image = u; $("#e-img").src = u; } }); };
  $("#e-cancel").onclick = closeModal;
  if (!isNew) $("#e-del-btn").onclick = function () {
    if (!confirm('Delete "' + orig.name + '"? This removes it from the website. Tip: untick "Show on the website" to hide it instead.')) return;
    var idx = S.data.products.indexOf(orig);
    S.data.products.splice(idx, 1);
    saveKey("products").then(function () { closeModal(); render(); }).catch(function () { S.data.products.splice(idx, 0, orig); });
  };
  $("#e-save").onclick = function () {
    read();
    var msg = !p.name ? "Please enter a product name." : p.price == null ? "Please enter a selling price." : !p.cat ? "Please choose a category." :
      S.data.products.some(function (x) { return x !== orig && x.slug === p.slug; }) ? "Another product already uses this web address. Please change it." : "";
    if (msg) { $("#e-msg").textContent = msg; return; }
    var idx = isNew ? -1 : S.data.products.indexOf(orig);
    var before = clone(S.data.products);
    if (isNew) S.data.products.unshift(p); else S.data.products[idx] = p;
    saveKey("products").then(function () { closeModal(); render(); })
      .catch(function (e) { S.data.products = before; $("#e-msg").textContent = e.message; });
  };
  setTimeout(function () { $("#e-name").focus(); }, 30);
}

/* ============ categories ============ */
function categories() {
  var C = S.data.categories;
  $("#view").innerHTML =
    '<div class="head"><h2>Categories</h2><button class="btn primary" id="add-cat">+ Add category</button></div>' +
    '<p class="hint">These are the "Our Categories" cards on the home page and the categories in the shop filter. Click a picture to change it. Use the arrows to change the order.</p>' +
    '<div class="rows" id="cat-rows">' + C.map(function (c, i) {
      var n = S.data.products.filter(function (p) { return p.cat === c.slug; }).length;
      return '<div class="row" data-i="' + i + '">' +
        '<div class="moves"><button class="icon-btn" data-act="up" title="Move up"' + (i ? "" : " disabled") + '>▲</button><button class="icon-btn" data-act="down" title="Move down"' + (i < C.length - 1 ? "" : " disabled") + ">▼</button></div>" +
        '<img class="cat-img" data-act="img" src="' + esc(c.image) + '" alt="Change picture" title="Click to change picture">' +
        '<div class="grow"><label>Name</label><input data-f="name" value="' + esc(c.name) + '"><p class="sub">/shop?cat=' + esc(c.slug) + " · " + n + " product" + (n === 1 ? "" : "s") + "</p></div>" +
        '<label class="check"><input type="checkbox" data-f="show"' + (c.show !== false ? " checked" : "") + "> Show on home page</label>" +
        '<button class="btn small danger" data-act="del"' + (n ? ' disabled title="Move or delete its products first"' : "") + ">Delete</button></div>";
    }).join("") + "</div>";
  $("#add-cat").onclick = function () {
    var name = prompt("Name of the new category:"); if (!name || !name.trim()) return;
    var s = slugify(name), base = s, k = 2;
    while (C.some(function (c) { return c.slug === s; })) s = base + "-" + k++;
    C.push({ slug: s, name: name.trim(), image: "", show: true }); render();
  };
  var rows = $("#cat-rows");
  rows.oninput = function (e) {
    var r = e.target.closest(".row"); if (!r) return; var c = C[+r.dataset.i];
    if (e.target.dataset.f === "name") c.name = e.target.value;
    if (e.target.dataset.f === "show") c.show = e.target.checked;
    updateBar();
  };
  rows.onchange = rows.oninput;
  rows.onclick = function (e) {
    var b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
    var i = +b.closest(".row").dataset.i, a = b.dataset.act;
    if (a === "up" || a === "down") { var j = a === "up" ? i - 1 : i + 1; var t = C[i]; C[i] = C[j]; C[j] = t; render(); }
    if (a === "del" && confirm('Delete the category "' + C[i].name + '"?')) { C.splice(i, 1); render(); }
    if (a === "img") uploadImage(600).then(function (u) { if (u) { C[i].image = u; render(); } });
  };
}

/* ============ banners ============ */
function waLink(text) { return "https://wa.me/" + WA + "?text=" + encodeURIComponent("Hi Afri-Powered, I'm interested in " + (text || "your special")); }
function bannerStatus(b) {
  var now = new Date().toISOString().slice(0, 10);
  if (b.start && b.start > now) return '<span class="status ok">Starts ' + esc(b.start) + "</span>";
  if (b.end && b.end < now) return '<span class="status bad">Ended ' + esc(b.end) + "</span>";
  return '<span class="status good">Showing now</span>';
}
function banners() {
  var B = S.data.promos;
  $("#view").innerHTML =
    '<div class="head"><h2>Banners</h2><button class="btn primary" id="add-banner">+ Upload banner</button></div>' +
    '<p class="hint">These slide across the top of the home page. Best size: <b>2048 × 768 pixels</b> (wide). Customers who tap a banner go to its link. A WhatsApp link opens a chat with your number. Add dates to show a special only for a set time.</p>' +
    (B.length ? "" : '<div class="card empty">No banners yet. The banner area is hidden on the website until you add one.</div>') +
    B.map(function (b, i) {
      return '<div class="banner" data-i="' + i + '"><img src="' + esc(b.image) + '" alt="">' +
        '<div class="body"><div class="wide"><label>What the banner shows <span class="sub">for screen readers and Google</span></label><input data-f="alt" value="' + esc(b.alt) + '"></div>' +
        '<div class="wide"><label>Link when tapped</label><input data-f="link" value="' + esc(b.link) + '" placeholder="https://wa.me/… or /shop"><button class="btn small" data-act="wa" style="margin-top:6px">Use WhatsApp link</button></div>' +
        '<div><label>Start date <span class="sub">optional</span></label><input type="date" data-f="start" value="' + esc(b.start) + '"></div>' +
        '<div><label>End date <span class="sub">optional</span></label><input type="date" data-f="end" value="' + esc(b.end) + '"></div>' +
        '<div class="acts">' + bannerStatus(b) + "</div></div>" +
        '<div class="body" style="padding-top:0;display:flex;gap:6px;flex-wrap:wrap">' +
        '<button class="btn small" data-act="up"' + (i ? "" : " disabled") + ">▲ Move up</button>" +
        '<button class="btn small" data-act="down"' + (i < B.length - 1 ? "" : " disabled") + ">▼ Move down</button>" +
        '<button class="btn small" data-act="img">Replace image</button>' +
        '<button class="btn small danger" data-act="del" style="margin-left:auto">Remove banner</button></div></div>';
    }).join("");
  $("#add-banner").onclick = function () {
    uploadImage(2048).then(function (u) {
      if (!u) return; B.push({ image: u, alt: "", link: waLink("your special"), start: "", end: "" }); render();
      toast("Banner added. Fill in the details, then press Save changes.");
    });
  };
  var v = $("#view");
  v.oninput = function (e) {
    var el = e.target.closest(".banner"); if (!el || !e.target.dataset.f) return;
    B[+el.dataset.i][e.target.dataset.f] = e.target.value; updateBar();
  };
  v.onchange = v.oninput;
  v.onclick = function (e) {
    var b = e.target.closest("[data-act]"); if (!b || b.disabled) return;
    var card = b.closest(".banner"); if (!card) return;
    var i = +card.dataset.i, a = b.dataset.act;
    if (a === "up" || a === "down") { var j = a === "up" ? i - 1 : i + 1; var t = B[i]; B[i] = B[j]; B[j] = t; render(); }
    if (a === "del" && confirm("Remove this banner from the home page?")) { B.splice(i, 1); render(); }
    if (a === "img") uploadImage(2048).then(function (u) { if (u) { B[i].image = u; render(); } });
    if (a === "wa") { B[i].link = waLink(B[i].alt || "your special"); render(); }
  };
}

/* ============ page content ============ */
var LABELS = { h1: "Heading", h2: "Heading", h3: "Heading", h4: "Small heading", h5: "Small heading", h6: "Label", p: "Paragraph", list: "List item", btn: "Button", img: "Image", body: "Page text", title: "Page title" };

function pages() {
  $("#view").innerHTML =
    '<div class="head"><h2>Page content</h2><select id="pg" style="width:auto">' + PAGES.map(function (p) {
      return '<option value="' + p[0] + '"' + (p[0] === S.page ? " selected" : "") + ">" + p[1] + "</option>";
    }).join("") + '</select><a class="btn" id="pg-view" href="' + S.page + '" target="_blank" rel="noopener">View page ↗</a></div>' +
    '<p class="hint">Change the words and pictures on each page. Fields are listed from the top of the page to the bottom. The layout, menu and footer stay as they are. Edited fields have a blue border.</p>' +
    '<div id="pg-fields"><div class="loading">Loading page…</div></div>';
  $("#pg").onchange = function () {
    if (isDirty("content") && !confirm("You have unsaved changes on this page. Switch anyway?")) { this.value = S.page; return; }
    if (isDirty("content")) S.data.content = JSON.parse(S.saved.content);
    S.page = this.value; $("#pg-view").href = S.page; updateBar(); loadPage(S.page);
  };
  loadPage(S.page);
}

function simpleWrap(el) {
  // Returns the element whose text we edit, or null when it holds more complex markup.
  var kids = Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 1 && n.tagName !== "BR"; });
  function plain(x) { return Array.prototype.every.call(x.childNodes, function (n) { return n.nodeType === 3 || n.tagName === "BR"; }); }
  if (!kids.length) return el;
  if (kids.length === 1 && /^(A|STRONG|B|EM|I|SPAN)$/.test(kids[0].tagName) && plain(kids[0]) &&
    Array.prototype.every.call(el.childNodes, function (n) { return n === kids[0] || (n.nodeType === 3 && !n.textContent.trim()); })) return kids[0];
  return null;
}
function textOf(el) {
  // Line breaks in the page source are just spaces; only <br> is a real line break.
  var c = el.cloneNode(true); $$("br", c).forEach(function (b) { b.replaceWith("\u0001"); });
  return c.textContent.replace(/\s+/g, " ").replace(/ ?\u0001 ?/g, "\n").trim();
}
function htmlFromText(t) { return esc(t).replace(/\n/g, "<br>"); }

function loadPage(path) {
  var box = $("#pg-fields"); if (!box) return;
  box.innerHTML = '<div class="loading">Loading page…</div>';
  fetch(path, { cache: "no-store", credentials: "same-origin" }).then(function (r) { return r.text(); }).then(function (html) {
    if (S.tab !== "pages" || S.page !== path) return;
    var doc = new DOMParser().parseFromString(html, "text/html");
    var edits = (S.data.content[path] = S.data.content[path] || {});
    var savedEdits = (JSON.parse(S.saved.content || "{}")[path]) || {};
    var els = $$("[data-ap]", doc);
    if (!els.length) { box.innerHTML = '<div class="card empty">This page has no editable content.</div>'; return; }
    box.innerHTML = '<div class="fields">' + els.map(function (el) {
      var k = el.getAttribute("data-ap"), pre = k.split("-")[0], label = LABELS[pre] || LABELS[el.tagName.toLowerCase()] || "Text";
      var edited = savedEdits[k] ? ' <span class="tag blue">Edited</span>' : "";
      var undo = savedEdits[k] ? '<button class="btn small" data-act="undo">Undo my edit</button>' : "";
      var head = '<div class="f-head"><b>' + label + "</b>" + edited + '<span class="sp"></span>' + undo + "</div>";
      if (el.tagName === "IMG") {
        var src = (edits[k] && edits[k].src) || el.getAttribute("src"), alt = (edits[k] && edits[k].alt != null) ? edits[k].alt : (el.getAttribute("alt") || "");
        return '<div class="field' + (savedEdits[k] ? " edited" : "") + '" data-k="' + esc(k) + '" data-type="img">' + head +
          '<div class="img-row"><img src="' + esc(src) + '" alt=""><div class="grow" style="flex:1"><button class="btn small" data-act="img">Replace image</button>' +
          '<label style="margin-top:10px">Picture description</label><input data-f="alt" value="' + esc(alt) + '"></div></div></div>';
      }
      if (el.getAttribute("data-ap-type") === "rich") {
        var inner = (edits[k] && edits[k].html != null) ? edits[k].html : el.innerHTML;
        return '<div class="field' + (savedEdits[k] ? " edited" : "") + '" data-k="' + esc(k) + '" data-type="rich">' + head +
          '<div class="rte-bar"><button data-cmd="bold"><b>B</b></button><button data-cmd="italic"><i>I</i></button><button data-cmd="h2">Heading</button><button data-cmd="h3">Subheading</button><button data-cmd="p">Normal text</button><button data-cmd="insertUnorderedList">• List</button><button data-cmd="link">Link</button><button data-cmd="unlink">Remove link</button></div>' +
          '<div class="rte" contenteditable="true">' + inner + "</div></div>";
      }
      var w = simpleWrap(el);
      if (!w) return '<div class="field" data-k="' + esc(k) + '">' + head + '<p class="sub">' + esc(textOf(el)) + " (this text has special formatting and can't be edited here)</p></div>";
      var txt = (edits[k] && edits[k].html != null) ? textOf(Object.assign(document.createElement("div"), { innerHTML: edits[k].html })) : textOf(w);
      var rows = Math.min(8, Math.max(1, Math.ceil(txt.length / 90) + (txt.match(/\n/g) || []).length));
      var wrapAttr = w !== el ? ' data-wrap="' + esc(w.outerHTML.replace(/>[\s\S]*<\/[a-z]+>$/i, ">")) + '" data-wrap-tag="' + w.tagName.toLowerCase() + '"' : "";
      return '<div class="field' + (savedEdits[k] ? " edited" : "") + '" data-k="' + esc(k) + '" data-type="text"' + wrapAttr + ">" + head +
        '<textarea rows="' + rows + '">' + esc(txt) + "</textarea></div>";
    }).join("") + "</div>";
    if (!Object.keys(edits).length) delete S.data.content[path];
    wirePage(box, path);
  }).catch(function () { box.innerHTML = '<div class="card empty">Could not load this page.</div>'; });
}

function wirePage(box, path) {
  function edits() { return (S.data.content[path] = S.data.content[path] || {}); }
  function setField(k, val) { edits()[k] = Object.assign({}, edits()[k] || {}, val); updateBar(); }
  box.oninput = function (e) {
    var f = e.target.closest(".field"); if (!f) return; var k = f.dataset.k;
    if (f.dataset.type === "text" && e.target.tagName === "TEXTAREA") {
      var h = htmlFromText(e.target.value.trim());
      if (f.dataset.wrap) h = f.dataset.wrap + h + "</" + f.dataset.wrapTag + ">";
      setField(k, { html: h });
    }
    if (f.dataset.type === "img" && e.target.dataset.f === "alt") setField(k, { alt: e.target.value });
    if (f.dataset.type === "rich" && e.target.classList.contains("rte")) setField(k, { html: e.target.innerHTML });
  };
  box.onclick = function (e) {
    var f = e.target.closest(".field"); if (!f) return; var k = f.dataset.k;
    var cmd = e.target.closest("[data-cmd]");
    if (cmd) {
      e.preventDefault(); var ed = $(".rte", f); ed.focus(); var c = cmd.dataset.cmd;
      if (c === "h2" || c === "h3" || c === "p") document.execCommand("formatBlock", false, c);
      else if (c === "link") { var u = prompt("Link address (https://…, mailto:…, tel:… or /page):", "https://"); if (u) document.execCommand("createLink", false, u); }
      else document.execCommand(c, false, null);
      setField(k, { html: ed.innerHTML }); return;
    }
    var b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "img") uploadImage(1600).then(function (u) { if (u) { setField(k, { src: u }); $(".img-row img", f).src = u; f.classList.add("edited"); } });
    if (b.dataset.act === "undo" && confirm("Put back the original content for this field? (Press Save changes afterwards.)")) {
      delete edits()[k]; if (!Object.keys(edits()).length) delete S.data.content[path];
      updateBar(); b.textContent = "Will be undone when you save"; b.disabled = true;
    }
  };
  // keep pasted text plain inside the rich editor
  $$(".rte", box).forEach(function (ed) {
    ed.addEventListener("paste", function (e) {
      e.preventDefault(); var t = (e.clipboardData || window.clipboardData).getData("text/plain");
      document.execCommand("insertText", false, t);
    });
  });
}

/* ============ delivery ============ */
function delivery() {
  var s = S.data.settings; s.zones = s.zones || [];
  var own = S.data.products.filter(function (p) { return p.delivery != null; });
  $("#view").innerHTML =
    '<div class="head"><h2>Delivery charges</h2></div>' +
    '<p class="hint">Set what delivery costs in each area. These fees show on every product page. A product with its own delivery fee (for example a heavy battery) uses that fee instead, for every area except free ones like collection.</p>' +
    '<div class="card stack"><h3>Delivery areas</h3><div class="rows" id="zones">' + s.zones.map(function (z, i) {
      return '<div class="row" data-i="' + i + '"><div class="grow"><label>Area</label><input data-f="name" value="' + esc(z.name) + '" placeholder="e.g. Gauteng"></div>' +
        '<div style="width:160px"><label>Fee (R)</label><input type="number" min="0" data-f="fee" value="' + esc(z.fee) + '"></div>' +
        '<button class="btn small danger" data-act="del" style="align-self:flex-end">Remove</button></div>';
    }).join("") + '</div><button class="btn" id="add-zone">+ Add area</button>' +
    '<div style="max-width:320px"><label for="free">Free delivery on orders over (R) <span class="sub">blank = never</span></label><input id="free" type="number" min="0" value="' + (s.freeOver ?? "") + '"></div></div>' +
    '<div class="card" style="margin-top:16px"><h3>Products with their own delivery fee</h3>' + (own.length
      ? '<div class="table-wrap"><table><tbody>' + own.map(function (p) {
        return '<tr><td class="pname">' + esc(p.name) + '</td><td class="num">' + money(p.delivery) + '</td><td class="num"><button class="btn small" data-edit="' + esc(p.slug) + '">Edit</button></td></tr>';
      }).join("") + "</tbody></table></div>"
      : '<p class="sub">None. Open a product and fill in "Own delivery fee" to set one.</p>') + "</div>";
  var z = $("#zones");
  z.oninput = function (e) {
    var r = e.target.closest(".row"); if (!r) return; var f = e.target.dataset.f;
    s.zones[+r.dataset.i][f] = f === "fee" ? (numOrNull(e.target.value) ?? 0) : e.target.value; updateBar();
  };
  z.onclick = function (e) { var b = e.target.closest("[data-act=del]"); if (b) { s.zones.splice(+b.closest(".row").dataset.i, 1); render(); } };
  $("#add-zone").onclick = function () { s.zones.push({ name: "", fee: 0 }); render(); $$("#zones input[data-f=name]").pop().focus(); };
  $("#free").oninput = function () { s.freeOver = numOrNull(this.value); updateBar(); };
  $$("[data-edit]").forEach(function (b) { b.onclick = function () { editProduct(b.dataset.edit); }; });
}

var VIEWS = { dashboard: dashboard, products: products, categories: categories, banners: banners, pages: pages, delivery: delivery };

/* ============ go ============ */
api("/api/admin/session").then(start).catch(function (e) { if (e.status !== 401) showLogin(e.message); });
})();
