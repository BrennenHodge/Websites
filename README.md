# AI Build Club website

Live at https://aibuildclub.co (Cloudflare Pages project `ai-build-club`; www and ai-build-club.pages.dev redirect there via `functions/_middleware.js`).

Ad landing page (Meta ads) for one offer: **private, one-on-one AI coaching**, two hours, $697, live online, with Brennen Hodge (16 years building software and companies). Each session is tailored to the client's goals: learning the AI tools, automating work, building something, or using AI in their business. No technical experience needed.

Funnel: ad → sales page (`/`) → booking tool (pick a time + pay) → thank-you page (`/thanks`) with a short goals questionnaire. Visitors who don't book can leave an email (inline form under the offer, plus an exit-intent popup on desktop).

The earlier **group bootcamp** version ($497, three hours, one date) is archived in `archive/group-bootcamp/` and the git tag `group-bootcamp-v1`. It's not published; see that folder's README to bring it back.

No build step. Deploys to Cloudflare Pages (`wrangler.toml` holds the config):

```
npx wrangler pages deploy --branch main
```

```
public/            everything that gets published
  index.html       the sales page
  thanks.html      after-booking page: Purchase event and the goals questionnaire
  terms.html       Terms of Service (/terms), linked in every footer
  privacy.html     Privacy Policy (/privacy): keep it in sync with what the site collects (forms, pixel, booking)
  styles.css       design tokens (light + dark), layout and components
  app.js           CONFIG (price, booking link, videos, pixel, headline angles) and page behavior
  img/             coach photo, app screenshots (img/apps/)
functions/api/lead.js     POST /api/lead: saves "not ready yet" emails to KV
functions/api/intake.js   POST /api/intake: saves the goals questionnaire to KV
archive/group-bootcamp/   the group bootcamp page, parked for later (not published)
model.html         internal revenue model calculator (not published)
```

## Placeholders to fill (in `public/app.js` → `CONFIG`)

1. `booking`: the booking link. Use Cal.com with payment turned on (currently Cal Pay), so clients pick a time and pay in one step. Set the after-booking redirect to
   `https://aibuildclub.co/thanks?booked=1`
   Ad parameters (utm_*, fbclid) pass through, and the email is prefilled if the visitor left one.
2. `video` (personal intro, set: `/video/intro.mp4`, vertical 9:16, with `videoPoster`): an .mp4 URL. (The 45-second build demo was removed 2026-11-02; to bring it back, add a `[data-video="demo"]` frame and `CONFIG.demo`.)
3. `metaPixelId` (set: 1114694707846383, ad account "AI Build Club" 1128940419856906 in the DB Vantage portfolio): loads the pixel on `pixelHosts` only. Events: PageView, ViewContent, Lead, InitiateCheckout (book click), Purchase (on `/thanks`, once per booking).

Booking: `CONFIG.booking` is the Cal.com page `brennenhodge/ai-build-club`.

Guarantee (set 2026-11-01): love your session or a full $697 refund, requested by email within 7 days after the session, no other conditions.

Also: the rescheduling and required-tools FAQ answers (TODO, once those policies are set).

Headline per ad: `/?angle=experience`, `business`, `build`, `automate`, `beginner` (see `CONFIG.angles`). Every angle leads to the same session.

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
