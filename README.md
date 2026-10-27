# AI Build Club website

Ad landing page (Meta ads) for one offer: the **AI App Boot Camp**, $497, three hours, live online. Attendees leave with a working MVP live on a URL, or their money back.

No build step. Deploys to Cloudflare Pages:

```
npx wrangler pages deploy . --project-name ai-build-club --branch main
```

```
index.html   the landing page: hero + demo video, what you leave with, the three hours,
             who it's for, instructor, offer + guarantee, FAQ, final call
styles.css   design tokens (light + dark), layout and components
app.js       CONFIG: event date, checkout URL, demo video, Meta Pixel
img/         instructor photo
model.html   internal revenue model calculator (not linked from the site)
```

## Placeholders to fill (all in `app.js` → `CONFIG`)

1. `event`: the date is a placeholder until the real one is set.
2. `checkout`: the $497 checkout URL. Until then every button scrolls to the offer. UTM and `fbclid` parameters are passed through to checkout.
3. `video`: the 45-second screen recording (.mp4). Until then the hero shows a placeholder frame.
4. `metaPixelId`: loads the Meta Pixel (PageView, plus InitiateCheckout on seat buttons).

Also confirm which Replit plan attendees need (see the TODO in the FAQ).
