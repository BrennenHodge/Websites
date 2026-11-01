# Group bootcamp landing page (archived, not published)

The AI App Boot Camp version of the site: $497, three hours, live online, one date for everyone. It's parked here while the private one-on-one coaching offer is being tested. The plan is to bring it back later.

This folder sits outside `public/`, so none of it is deployed. The same version is also saved as the git tag `group-bootcamp-v1`.

What it has that the coaching page doesn't:
- Hero "Turn your idea into a working app in 3 hours," with headline angles `idea`, `developer`, `shortcuts`
- The App Factory method (Hour 1 Shape it, Hour 2 Build it, Hour 3 Launch it, After Repeat it)
- Offer stack, countdown to the date, seat cap and fast-action bonus (all set in `app.js` → `CONFIG`)
- The Live App Guarantee ("your app is live on a URL, or you pay nothing")
- `thanks.html` with Stripe Purchase tracking and add-to-calendar buttons

To bring it back, copy these four files into `public/`, then fill in the real date, seats, bonus and the Stripe Payment Link in `CONFIG`. The lead form and `functions/api/lead.js` work with both versions.
