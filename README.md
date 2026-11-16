# Afri-Powered (static site)
No build step. Everything is in `public/`.
- Products: edit `public/data/products.json` (set `pay_url` to a payment link to show a Pay now button).
- Specials slider: edit `public/data/promos.json` (title, text, image, link, optional start/end dates YYYY-MM-DD). Put images in `public/images/`.
- Images: product photos currently load from the old site (`IMG` in `public/app.js`). Download the old `wp-content/uploads` folder into `public/images/` and set `IMG` to `"images/"` before the old site is switched off.
- Deploy: connect this repo to Cloudflare (Workers Static Assets). Branches get preview links; the live site only changes when you switch the domain.
