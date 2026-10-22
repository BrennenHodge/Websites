# Woodstock Sports website

A static redesign of [woodstocksports.org](https://www.woodstocksports.org/) for Woodstock Sports, 30 Central Street, Woodstock, VT 05091.

There is no build step. Open `index.html` in a browser, or serve the folder with any static host (Netlify, GitHub Pages, Squarespace code injection, etc.).

```
woodstock-sports/
  index.html   page markup and copy
  styles.css   design tokens (light + dark), layout and components
  app.js       brand data, brand directory filters/search, open-now status
```

## Editing content

- **Brands**: edit the `BRANDS` array in `app.js`. Each brand has a `name`, a wordmark `style` (`serif`, `italic`, `caps`, `wide`, `heavy`, `mono`), optional `origin`, the categories it appears under (`cats`), and a one-line description (`what`). The filter chips, counts, ticker and department lists all update from this array.
- **Spotlight**: the six featured brands are in `SPOTLIGHT` in `app.js`.
- **Hours**: the table is in `index.html`. The "Open now" check in `app.js` uses Mon–Sat 8:30–5:00 Eastern; update both if hours change.

## Sources

The brand list comes from the logos on the current site's `/brands` page. History, hours, address and phone come from the current site and its Yelp listing. Brand descriptions summarize what each label is known for.

Three items on the current brands page weren't added because the brand couldn't be identified from the file name alone: `mdc.png`, `selawa.jpg`, and an untitled screenshot. Add them to `BRANDS` once confirmed.

## Photos

Photos are placeholder lifestyle images hotlinked from Unsplash. If an image fails to load, its frame falls back to a spruce-green contour pattern with a label, so the layout never breaks. Before launch, replace them with the shop's own photos: the storefront, the floor, the bike shop. Save them in an `images/` folder and update the `src` attributes in `index.html`.
