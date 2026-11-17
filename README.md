# Afri-Powered website

- `public/` is the website. Cloudflare serves this folder.
- `src/worker.js` is a small Cloudflare Worker in front of it. It runs the admin, saves your changes, and adds them to the pages.
- **WhatsApp number** is 27718111466. The footer keeps "© Afri-Powered 2024".

## Admin: afripowered.co.za/admin

Log in with your admin password to manage:

| Screen | What you can do |
|---|---|
| Dashboard | Profit margins, stock value, out of stock / low stock, products missing a cost price |
| Products | Add, edit, hide or delete products: price, "was" price, cost price, stock, images, description, own delivery fee. Price, cost and stock can be edited straight in the table |
| Categories | Names, pictures, order, show/hide on the home page |
| Banners | Upload the sliding home-page banners (best size 2048 × 768), links, start/end dates, order |
| Page content | Text and pictures on every page (header, menu and footer are locked) |
| Delivery | Fee per area, free delivery above an amount |

Changes show on the website within about a minute. Cost prices and stock numbers stay private: the public site only gets "in stock" / "out of stock".

## One-time setup in Cloudflare

1. **Create the storage.** Cloudflare dashboard → *Storage & Databases* → *KV* → *Create* → name it `afri-powered-store`. Copy its **ID**.
2. **Connect it.** In `wrangler.jsonc`, uncomment the `kv_namespaces` line and paste the ID in place of `PASTE_KV_NAMESPACE_ID_HERE`. Commit and push to GitHub.
3. **Set the password.** Cloudflare dashboard → *Workers & Pages* → `afri-powered-supplues` → *Settings* → *Variables and Secrets* → *Add* → type **Secret**, name `ADMIN_PASSWORD`, value = your password (use a long one). Save and deploy.
4. Open `https://afripowered.co.za/admin` and log in.

To change the password later, edit the `ADMIN_PASSWORD` secret. Everyone logged in is then logged out.
After 5 wrong passwords, that internet connection is locked out for 15 minutes.

## How it fits together

- Until the storage exists, the site runs from the files in `public/data/` exactly as before.
- After the first save, the admin's data in KV is used instead of `public/data/*.json`. Those files are then only the starting point.
- Product pages (`/product/<name>`) are built from the product data using `public/_tpl/product.html`. The old files in `public/product/` are only used before setup.
- Editable page parts are marked with `data-ap="…"` in the HTML. If you add new content to a page, run `python tools/tag_pages.py public` to make it editable.
- Uploaded images are stored in KV and served from `/media/…`.
