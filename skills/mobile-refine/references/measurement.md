# Measurement setup and interpretation

From the repository root, run `npm ci`, then `npx playwright install chromium`. When only the skill directory was copied, run `npm install` inside that directory, then `npx playwright install chromium`. Node.js 22 or newer is required. Linux may need Playwright's documented system dependencies (`npx playwright install --with-deps chromium`). These commands install dependencies and a browser; do not run them automatically in an environment that prohibits package installation.

Run from the repository root:

```sh
node skills/mobile-refine/scripts/audit.mjs http://localhost:3000/ \
  --widths 320,390,430,768 --main '#primary-content' \
  --sidebars '[data-secondary-navigation]' --ready '[data-ready="true"]' \
  --artifacts /tmp/mobile-refine-review
```

Omit selector flags when semantic landmarks and automatic geometry discovery work. `--main` must select primary content itself, not the entire grid that also contains sidebars. Desktop geometry identifies side columns; stable DOM selectors track those same elements after resizing. Closed dialogs and hidden regions are excluded.

The CLI launches only Playwright's bundled Chromium with a fresh ephemeral context. It does not attach to an existing personal browser, import sign-ins, click controls, submit forms, or open previews. Loading a URL still runs that page's own scripts and normal requests. Use a safe route and test environment when the page itself can have side effects. Authentication and action testing require a separate authorized harness.

Output is JSON. Exit 0 means measurements completed, even if findings exist. `--fail-on-findings` returns 1 when any finding exists, including heuristic review items; use it only after calibrating your app's budgets. Execution/configuration failures return 2 and never produce a passing report.

| Code | Meaning | Interpretation |
|---|---|---|
| `SIDEBAR_BEFORE_CONTENT` | A desktop side column moved ahead of primary content | Heuristic; decide whether it serves the mobile task |
| `CONTENT_BURIED` | Primary content begins below the first-screen budget | Heuristic; a deliberate preceding hero may explain it |
| `CHROME_DENSE` | Top pinned content occupies much of the viewport | Heuristic; includes fixed content such as consent banners |
| `NAV_DENSE` | Many header destinations are simultaneously visible | Heuristic; inspect wrapping and priority |
| `PAGE_OVERFLOW` | Document is wider than viewport | Measurement; identify cause and applicable reflow exceptions |
| `CONTROL_OUTSIDE_VIEWPORT` | A control extends past the viewport | Measurement; a deliberately scrollable region may explain it |

Default heuristic budgets are `buriedFraction: 0.5`, `chromeFraction: 0.15`, `maxNavLinks: 6`, and `minSidebarHeight: 160`. They are configurable conventions, not WCAG requirements. Example configuration:

```json
{
  "widths": [320, 390, 430, 768, 1024],
  "desktopWidth": 1440,
  "mainSelector": "#primary-content",
  "sidebarSelector": "aside",
  "buriedFraction": 0.7,
  "chromeFraction": 0.2,
  "maxNavLinks": 7,
  "settleMs": 500
}
```

Pass it with `--config config.json`. Flags and configuration are applied in command order. `--ready` waits for a visible element; increase `--settle-ms` only for known layout stabilization. Fonts are awaited. Reduced motion is requested, but that does not guarantee animations have settled. A new navigation at every width is not performed: resizing deliberately tracks a single DOM. If the application replaces its DOM on breakpoint changes, missing selectors must be reviewed or each width tested with a separate custom harness.

Screenshots and `report.json` are written only with `--artifacts`. The caller owns and deletes them. Avoid persistent generated-media caches. A large page can make full-page capture expensive; omit captures for initial measurement and capture relevant states separately.

Limitations: DOM inspection covers the first 15,000 elements, not closed shadow roots or iframe contents. CSS clipping, overlapping layers, expanded pseudo-element hit areas, semantic equivalence, real device keyboards, screen readers, and dynamic interaction cannot be fully established from this geometry pass. No conformance claim should follow from the absence of findings.
