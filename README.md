# AI Build Club website

Marketing site for two offers under one brand:

- **AI App Boot Camp**: $497, three hours, leave with a working first version of your own app.
- **AI Build Club**: $79/month, weekly live build and help sessions, a private community on Skool, and a monthly Demo Day.

There's no build step. Open `index.html` in a browser, or deploy the folder to any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).

```
index.html   public site: hero, two-step path, boot camp, club, FAQ, pricing
styles.css   design tokens (light + dark), layout and components
app.js       button links, build-log animation
model.html   internal revenue model calculator (not linked from the site)
```

## Before launch

1. **Connect the buttons.** In `app.js`, set `LINKS.bootcamp` to your $497 checkout page and `LINKS.club` to your Skool group invite link. Until you do, the buttons scroll to the pricing and FAQ sections.
2. **Decide on `model.html`.** It's the internal economics page. It has `noindex` set and isn't linked anywhere, but anyone with the URL can still open it. Delete it from the deployed copy if you don't want it public.
3. **Add what only you can add**: an instructor section with your photo and background, real boot camp dates and times, the location (or "online"), and, once you have them, member demos and quotes. The "What will you build?" cards are example ideas, not testimonials.
4. **Check the boot camp agenda.** The hour-by-hour outline in `#bootcamp` is a draft. Edit it to match how you actually run the session.
