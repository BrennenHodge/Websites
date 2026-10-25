# Growth company website

A one-page site for the new growth company being built from DVantage's capabilities. It presents the company as a business growth and performance partner, not as a web, software or AI agency. The copy follows the strategy and positioning brief.

There is no build step. Open `index.html` in a browser, or serve the folder from any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).

```
growth-company/
  index.html   page markup and copy
  styles.css   design tokens (light + dark), layout and components
  app.js       site settings, throughput model, comparison matrix, contact form
```

## Before launch

1. **Name.** "Headway" is a working name only, because the company name hasn't been chosen. Change `BRAND` at the top of `app.js`. Every element marked `data-brand` updates from it. Also update the `<title>`, the meta description and the logo's `aria-label` in `index.html`, since they're read before the script runs.
2. **Contact email.** Set `CONTACT_EMAIL` in `app.js`. It's shown in the contact section and is where the form sends enquiries.
3. **Form delivery.** With `FORM_ENDPOINT` empty, the form opens the visitor's email app with their message filled in. For direct delivery, set `FORM_ENDPOINT` to a form service or CRM webhook URL (Formspree, Basin, HubSpot, Pipedrive web forms). The form POSTs JSON with `name`, `email`, `company`, `role`, `areas` and `message`.
4. **Logo.** The mark in the header is a placeholder (three ascending bars). Replace the inline `<svg class="logo__mark">` once the identity is set.

## Page structure

The page follows the narrative in the brief:

| Section | Anchor | Content |
| --- | --- | --- |
| Hero | `#top` | "Your next stage of growth starts here." Primary CTA: Explore growth opportunities. Includes the interactive throughput model. |
| The problem | `#problem` | Where constraints hide (marketing, sales, operations, processes, technology) and the core positioning statement. |
| Four dimensions of growth | `#growth` | Revenue, operations, profit, strategy, with the revenue-vs-profit example and how each dimension is measured. |
| Capabilities | `#capabilities` | Six capabilities, each tagged with the dimensions it typically moves. |
| How we work | `#approach` | Discover, prioritize, build and execute, measure and improve. |
| Our difference | `#difference` | Strategy and execution under one roof, with a comparison against typical firm types. |
| Who we work with | `#clients` | Decision-makers and their concerns, plus the two engagement models (fractional growth leadership, focused initiatives). |
| Call to action | `#contact` | "Let's find your next growth opportunity." and the contact form. |

## Editing content

- **Throughput model** (hero): `MODEL_START` sets each stage's starting capacity and `MODEL_STEPS` sets what each click of "Remove the constraint" changes. The numbers are an illustrative example, and the panel says so.
- **Profit chart** (growth section): the three scenarios are in `index.html`. Bar widths are each scenario's profit as a share of the largest ($1.155M), set with the `--w` style on each bar.
- **Comparison matrix**: the `MATRIX` array in `app.js`. 2 = core focus, 1 = partial, 0 = typically outside scope. The last column is the company.
- **Colors and type**: tokens at the top of `styles.css`. Petrol and amber are the brand colors. Type is Schibsted Grotesk with IBM Plex Mono for labels and figures, both from Google Fonts.
