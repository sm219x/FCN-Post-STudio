# First Class Ninjas (FCN) — Social Post Studio

This project is FCN's post factory. The user gives a **topic**; you produce on-brand
WhatsApp / Instagram posts (image + caption) and, when asked, LinkedIn copy.
Always follow the system below. Reference `uploads/FCN_Brand_Analysis.pdf` for the full
rationale; this file is the operating summary.

## What FCN is
Discounted Business & First Class flights + luxury hotels, sold mostly over WhatsApp.
Audience: smart, successful Indians (28–45) who respond to directness, wit, and being
"in the know." Most pricing is ex-Delhi (DEL); Mumbai (BOM) and Bangalore (BLR) are
under-served and worth posts of their own.

## Voice (most important)
Sound like a sharp friend who knows how to get business class at half price — NOT a
travel-agency FAQ. Confident, witty, a little cheeky. Sentence case always; never ALL
CAPS headlines. No emoji. Never use "Message us to book now."
- Rotate CTAs: "Ask us what this route actually costs" · "Find out before you book
  elsewhere" · "You know where to find us" · "DM us your route" · "Ask us for a quote"
  · "Join the group".
- Aim for ~20% humour/attitude posts. Festive posts must tie back to travel, never a
  generic greeting card.

## Visual system
- **Format:** 1080 × 1350 (4:5) portrait for WhatsApp/IG. In the review canvas, display
  each poster scaled (~0.42) inside a fixed box, but keep the inner frame at true
  1080×1350 so export stays full-res. Captions sit in a small white card under each.
- **Imagery:** full-bleed photography as texture with type laid on top. NO phone
  mockups, NO airplane-window cutouts, NO clip art, NO illustrated maps. Use the
  `<image-slot>` component (`posts/image-slot.js`, loaded in `<helmet>`) so the user
  drops their own photo; always include a protective scrim gradient so white text reads
  on any photo. Add a "↻ Change photo" / "Remove" toolbar ABOVE each poster (editor
  chrome, not in the exported image) wired via the logic class.
- **PNG export:** every poster carries a "↓ PNG" button (in the same toolbar) that
  renders the true 1080×1350 frame to a downloadable PNG via `posts/poster-export.js`
  (a canvas renderer — load it in `<helmet>`). Do NOT use html-to-image / modern-
  screenshot for export: they hang on full-res output in this preview.
- **Airline-specific deals:** when a post is about one or more named airlines, show the
  airline logo(s) on the poster. Add a dedicated `<image-slot>` (fit=contain,
  `pointer-events:auto`, ~260×78) ABOVE the pricing block so the user drops the
  official logo (white PNG for dark posters). Name the airline in the headline/sub too.
- **Logo library:** 28 airline + hotel logos (mono, white-bg knocked out, trimmed) live in
  `site/logos/<slug>.png` (see the `LOGOS` array in `site/index.html`). On posters they sit
  on a cream `#F5EFE0` rounded plate (align-self:flex-start, ~20×28 padding) so the grey/
  black marks read on any photo. Re-use these for `.dc.html` posters too.
- **Palette (lock to these):** deep navy `#0C1F35`, brand deep blue `#1E4874`, cream/
  off-white `#F5EFE0`, warm accent amber `#E0935A` (or terracotta `#C0563A`). No light-
  blue gradients, no flat reds, no template greens.
- **Type:** DM Serif Display (headline, sentence case, tight leading; it only ships 400,
  so don't ask for heavier weights) + Glacial Indifference (body/labels, loaded from
  cdnfonts). Avoid two different body sizes in one poster — keep sub-copy a single size.
- **Headline colour rotates** for natural variety across the feed — don't make every
  headline cream. Pick per poster from: cream `#F5EFE0`, amber `#E0935A`, white, or brand
  blue `#1E4874`. Brand blue only reads on bright/light imagery (snow, sky, light wash);
  use cream/amber/white on dark photos.
- **Logo:** top-right anchor — mark + letter-spaced "FIRST CLASS NINJAS" (0.34em).
  Marks live in `posts/`: `fcn-mark-white.png` (dark bg), `fcn-mark-color.png` (brand
  blue, light bg), `fcn-mark-navy.png`. Originals in `uploads/`.

## Two reusable layout directions
- **A · Moody / headline-led:** dark photo, heavy top+bottom scrim, big 3-line Playfair
  headline top-left, one-size sub-copy, then a pricing table (uppercase Hanken label +
  amber Playfair price, hairline dividers).
- **B · Bright / editorial:** brighter photo, lighter scrim, amber kicker line
  ("Introducing …"), Playfair headline, sub-copy, same pricing table.
Both use cream/white type. Differentiate by mood + composition, not by switching to
navy-on-photo (risky legibility).

## Build conventions
- Build as a single `Name.dc.html` Design Component, inline styles only. Multiple topics
  can live in one file as stacked, labelled sections (each a flex row of 2 poster
  columns) on the same scrolling canvas.
- Text on posters must be clickable to edit: the content overlay is `pointer-events:none`
  (so empty areas accept photo drops) but every text element + logo gets
  `pointer-events:auto`.
- The user can edit any copy and any single colour directly in the editor — don't add
  tweaks for those. Reserve tweaks for cross-cutting toggles.
- File path stays at project root (image-slot persistence requires it).
- Default to 2 variations per topic unless told otherwise.

## Pricing block pattern
Region (uppercase, Hanken) → price (Playfair, amber, "from ₹__"). Keep ex-city out of
the image; put it in the caption.

## Self-serve site (site/)
`site/` is a static Netlify app (team-facing) for self-serving posts. Password-gated
(client-side, `const PASSWORD` in index.html). Form → live FCN poster preview → Download
PNG (canvas exporter `poster-export.js`) + Copy caption. 28 logos in `site/logos/`.
- **Key points → Generate:** team types the deal in plain words; `localGenerate()` (deterministic
  parser: prices like 79k/1.49L, ex-city, urgency→kicker, airline/hotel name→logo, route) fills
  headline/sub/kicker/prices/exCity. Pricing, kicker, ex-city only appear if present in the input.
- **Post types:** flight, airline, hotel, and **lastmin** (last-minute). lastmin parses labeled
  bullets (one per line: `Route`/`DEL - WAW - LHR`, `Date`, `Timing`, `Layover`, `Stops`, `Seats`,
  `Non-refundable`, airline name, `Price - 89k`): date→kicker, first airport code→ex-city,
  destination code→witty headline + seats, and a pipe-joined detail line as the sub. Airport→city
  map + `parseLabeled`/`findRoute`/`parseDate` live in index.html. Airline logo picker shows for
  every type except hotel (which shows hotels).
- **AI upgrade:** `generatePost()` calls `/.netlify/functions/generate` first, falls back to
  `localGenerate` if the function/key is missing. The function (`site/netlify/functions/generate.js`)
  reads `ANTHROPIC_API_KEY` (Netlify env var) and also accepts an uploaded airline-ad image
  (vision) to auto-extract a deal. Deploying functions needs a Git/CLI-linked Netlify site, not
  pure drag-drop. Keep the function's LOGOS array in sync with index.html.
- **Image input:** ad upload/drag/paste is downscaled client-side (`downscaleImage`) before
  POSTing — Netlify functions have a hard 10s sync limit, so keep the vision model fast
  (`claude-3-5-sonnet-20241022`) and images small. Errors now surface in a toast.

## Deployment facts (current setup)
- Live site: `aquamarine-wisp-4fd36c.netlify.app` (Netlify site id `94c840f1-835b-4aab-b5bc-170b3367b155`).
  Password is `ninja` (top of `site/index.html`). Anthropic key is set as the `ANTHROPIC_API_KEY`
  Netlify env var (user opted not to rotate; it's fine — app is password-gated, no sensitive data).
- Repo: `github.com/sm219x/FCN-Post-STudio` (branch `main`), auto-deploys to the site. The whole
  project sits nested under a top folder `First Class Ninjas Post Studio Git/`, and the app is in
  its `site/` subfolder — so Netlify build settings are: Base = empty, Publish =
  `First Class Ninjas Post Studio Git/site`, Functions = `First Class Ninjas Post Studio Git/site/netlify/functions`.
  Paths are case-sensitive on the build server.
- Claude can READ the repo (github_* tools) but cannot PUSH. To ship changes: user re-syncs the
  updated project folder to the repo (same folder name) → Netlify auto-rebuilds (~30s). Netlify
  CLI is the friction-free alternative.
