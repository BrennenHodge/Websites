# AI Build Club website

Ad landing page (Meta ads) for one offer: the **AI App Boot Camp**, $497, three hours, live online. Attendees leave with a working MVP live on a URL, or their money back.

Funnel: ad → sales page (`/`) → Stripe checkout → thank-you page (`/thanks`). Visitors who don't buy can leave an email (inline form under the offer, plus an exit-intent popup on desktop).

No build step. Deploys to Cloudflare Pages (`wrangler.toml` holds the config):

```
npx wrangler pages deploy --branch main
```

```
public/            everything that gets published
  index.html       the sales page
  thanks.html      Stripe confirmation page: Purchase event, calendar links, next steps
  styles.css       design tokens (light + dark), layout and components
  app.js           CONFIG (date, seats, bonus, checkout, videos, pixel, headline angles) and page behavior
  img/             instructor photo, app screenshots (img/apps/)
functions/api/lead.js   POST /api/lead: saves "not ready yet" emails to KV
model.html         internal revenue model calculator (not published)
```

## Placeholders to fill (in `public/app.js` → `CONFIG`)

1. `event`: the date is a placeholder. `start` and `end` drive the countdown and calendar links.
2. `seats`: the seat cap shown under the price. `0` hides it.
3. `bonus`: the fast-action bonus. `null` hides it. Only offer what you'll deliver.
4. `checkout`: the Stripe Payment Link. Set its confirmation page to
   `https://ai-build-club.pages.dev/thanks?session_id={CHECKOUT_SESSION_ID}`.
   Ad parameters (utm_*, fbclid) pass through, and the email is prefilled if the visitor left one.
5. `video` (2–4 minute sales video) and `demo` (45-second build): .mp4 URLs.
6. `metaPixelId`: loads the pixel on `pixelHosts` only. Events: PageView, ViewContent, Lead, InitiateCheckout, Purchase (on `/thanks`, deduplicated by Stripe session).

Also: testimonials in `index.html` are placeholders (approved quotes only), the Replit plan TODO in the FAQ, and how the join link gets sent (TODO on `/thanks`).

Headline per ad: `/?angle=idea`, `/?angle=developer`, `/?angle=shortcuts` (see `CONFIG.angles`).

## Leads

Stored in the KV namespace `ai-build-club-leads`, one key per email, with the details in the key metadata. List them:

```
npx wrangler kv key list --namespace-id b2bc4c59e09d40df813e9163d79918a0 --remote
```

Optional Pages secrets (`npx wrangler pages secret put NAME --project-name ai-build-club`):

- `LEAD_WEBHOOK_URL`: forwards each lead as JSON (Zapier, Make, or your email tool) to start the follow-up emails.
- `META_CAPI_TOKEN` and `META_PIXEL_ID`: sends a server-side Lead event to Meta, deduplicated with the browser pixel.
