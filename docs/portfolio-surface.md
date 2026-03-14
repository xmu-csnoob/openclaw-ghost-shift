# Ghost Shift Portfolio Surface

Ghost Shift now exposes three presentation surfaces instead of a single raw demo shell:

- `public office demo`: the primary live product surface
- `summary card`: a compact iframe target for `me.wenfei4288.com`
- `case study layer`: an explanation layer that frames the privacy boundary

## Summary Card Embed

Use the dedicated embed path:

```text
/embed/card
```

If Ghost Shift is mounted under `/office`, the card lives at:

```text
/office/embed/card
```

Example iframe:

```html
<iframe
  src="/office/embed/card"
  title="Ghost Shift summary card"
  loading="lazy"
  style="width:100%;max-width:440px;height:360px;border:0;"
></iframe>
```

## Recommended Copy

### Hero copy

> Make live agent work legible without publishing the internals.

Supporting paragraph:

> Ghost Shift packages a privacy-safe public snapshot as a featured office demo, a portfolio-sized summary card, and a case study layer that explains the privacy boundary.

### Summary card description

> Built for `me.wenfei4288.com`: enough live signal to prove the product is running, without turning the embed into a dense operator panel.

### Case study layer

- `What the demo is`
  Ghost Shift renders a public snapshot as a live office. Visitors see room-level activity, public aliases, coarse roles, model families, and activity bands.
- `What stays hidden`
  Prompts, transcripts, approvals, tool arguments, exact token counts, device identity, and internal session keys stay out of the surface.
- `Update cadence`
  The public surface refreshes every 3 seconds, which keeps the demo feeling live without turning it into an operator console.

## Presentation Notes

- Make the public office demo visually dominant in the portfolio.
- Use the summary card as the teaser surface above the fold or inside project grids.
- Keep the case study explanation near the demo so readers understand the privacy contract immediately.
