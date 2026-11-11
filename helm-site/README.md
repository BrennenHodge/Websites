# Helm landing page

Static marketing site for the Helm Chrome extension (`../helm-newtab`). There's no build tooling, just `index.html`, `styles.css`, `app.js` and `assets/`.

- `./build.sh` refreshes `helm.zip` (the extension download) and the icons from `../helm-newtab`.
- `./deploy.sh` builds and publishes this folder to the `gh-pages` branch, which GitHub Pages serves at <https://brennenhodge.github.io/Websites/>.

The screenshots in `assets/` and `assets/og.png` were captured from the real extension with demo data, using Playwright.

To preview locally, run `python3 -m http.server -d helm-site 8000`.
