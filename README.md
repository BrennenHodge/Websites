# AI Build Club website

Ad landing page (Meta ads) for one offer: a **private, one-on-one AI app-building session**, two hours, $697, live online. The client brings an idea and leaves with a working prototype, plus Brennen's guidance from 16 years of building software and companies.

Funnel: ad → sales page (`/`) → booking tool (pick a time + pay) → thank-you page (`/thanks`) with the idea questionnaire. Visitors who don't book can leave an email (inline form under the offer, plus an exit-intent popup on desktop).

No build step. Deploys to Cloudflare Pages (`wrangler.toml` holds the config):

```
npx wrangler pages deploy --branch main
```

```
public/            everything that gets published
  index.html       the sales page
  thanks.html      after-booking page: Purchase event and the idea questionnaire
  styles.css       design tokens (light + dark), layout and components
  app.js           CONFIG (price, booking link, videos, pixel, headline angles) and page behavior
  img/             instructor photo, app screenshots (img/apps/)
functions/api/lead.js     POST /api/lead: saves "not ready yet" emails to KV
functions/api/intake.js   POST /api/intake: saves the idea questionnaire to KV
model.html         internal revenue model calculator (not published)
```

## Placeholders to fill (in `public/app.js` → `CONFIG`)

1. `booking`: the booking link. Use Cal.com or Calendly with Stripe payment turned on, so clients pick a time and pay in one step. Set the after-booking redirect to
   `https://ai-build-club.pages.dev/thanks?booked=1`
   Ad parameters (utm_*, fbclid) pass through, and the email is prefilled if the visitor left one.
2. `video` (personal intro) and `demo` (45-second build): .mp4 URLs.
3. `metaPixelId`: loads the pixel on `pixelHosts` only. Events: PageView, ViewContent, Lead, InitiateCheckout (book click), Purchase (on `/thanks`, once per booking).

Also: the satisfaction guarantee (TODO in the offer section, once its terms are defined) and which tools or plans clients need (TODO in the FAQ and on `/thanks`).

Headline per ad: `/?angle=experience`, `/?angle=idea`, `/?angle=developer` (see `CONFIG.angles`).

## Leads and questionnaires

Both are stored in the KV namespace `ai-build-club-leads`, with a summary in each key's metadata:

```
npx wrangler kv key list --namespace-id b2bc4c59e09d40df813e9163d79918a0 --remote --prefix lead:
npx wrangler kv key list --namespace-id b2bc4c59e09d40df813e9163d79918a0 --remote --prefix intake:
```

Optional Pages secrets (`npx wrangler pages secret put NAME --project-name ai-build-club`):

- `LEAD_WEBHOOK_URL`: forwards each lead as JSON (Zapier, Make, or your email tool) to start the follow-up emails.
- `INTAKE_WEBHOOK_URL`: forwards each questionnaire as JSON (email, Slack or your CRM).
- `META_CAPI_TOKEN` and `META_PIXEL_ID`: sends a server-side Lead event to Meta, deduplicated with the browser pixel.
