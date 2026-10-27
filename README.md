# Mobile Refine

Check whether a phone layout makes sense, as well as whether it fits. A desktop sidebar stacked above the task can produce zero horizontal overflow and still leave users scrolling through navigation before reaching the page.

Mobile Refine is a shared skill for **Codex and Claude Code**, with a portable Playwright audit CLI. It compares desktop and narrow layouts, tracks secondary columns, measures content placement, and guides a visual and interactive verification pass. It works with arbitrary HTTP(S) routes and has no dependency on a private project registry or account.

## Install the skill

### Claude Code plugin

Inside Claude Code:

```text
/plugin marketplace add kyisaiah47/mobile-refine
/plugin install mobile-refine@mobile-refine
```

Start a new session and invoke `/mobile-refine:mobile-refine`, or ask for a mobile layout review. Repository-scoped installation is also possible by copying `skills/mobile-refine` into your project's `.claude/skills/` directory. Do not overwrite an existing skill without reviewing the differences.

### Codex

Clone this repository and copy `skills/mobile-refine` into your project's `.agents/skills/` directory, or into `~/.agents/skills/` for personal use. Keep the folder named `mobile-refine`. Start a new session and invoke `$mobile-refine`.

```sh
git clone https://github.com/kyisaiah47/mobile-refine.git
mkdir -p YOUR_PROJECT/.agents/skills
cp -R mobile-refine/skills/mobile-refine YOUR_PROJECT/.agents/skills/
```

The repository also contains a portable plugin manifest for OpenAI plugin distribution. Official directory availability depends on listing review; a manifest alone is not a public listing.

## Run the measurements

The instructions can be used with either assistant's browser tools. To run the bundled CLI, install Node.js 22+, dependencies, and Playwright's bundled Chromium:

```sh
cd mobile-refine
npm ci
npx playwright install chromium
npm run audit -- http://localhost:3000/ --widths 320,390,430,768
```

For a copied standalone skill, run `npm install` inside its folder, then `npx playwright install chromium`, and run `node scripts/audit.mjs URL`. The CLI launches an isolated headless browser. It never connects to your personal browser or imports its authentication.

JSON output includes element selectors, measurements, heuristic thresholds, warnings, and page errors. Optional screenshots stay in an explicitly chosen directory:

```sh
npm run audit -- http://localhost:3000/dashboard \
  --main '#primary-content' --sidebars 'aside' \
  --ready '[data-ready="true"]' --artifacts /tmp/mobile-refine-review
```

Review and delete temporary screenshots/report files when finished unless you intend to retain them. Keep private captures out of public repositories. See [measurement configuration](skills/mobile-refine/references/measurement.md) for thresholds, readiness, selector overrides, exit codes, and limitations.

## Example requests

- “Use mobile-refine to audit this dashboard at 320, 390, and 768 pixels. Report findings without editing.”
- “The filters stack above the results on phones. Improve their placement using our existing components, then verify the open and closed states.”
- “Check this populated table and expanded detail panel on narrow screens. Preserve the data relationships and keyboard access.”

## What is checked

| Area | Automated evidence | Follow-up review |
|---|---|---|
| Desktop sidebar placement | Same element tracked after resize | Whether its mobile placement serves the task |
| First-screen content | Primary-content vertical position | Deliberate hero/intro vs unnecessary furniture |
| Header density | Pinned height and visible navigation count | Priority, discoverability, wrapping |
| Fit | Document overflow and controls outside the viewport | Scrolling exceptions, clipping and overlap |
| Interaction | Not activated by the audit CLI | Drawer focus, Escape, touch, loading/error, reduced motion |

Thresholds are configurable review heuristics. They are **not WCAG requirements**. A clean run is not an accessibility certification. Authentication, iframe/shadow-DOM content, dynamic breakpoint replacement, real device keyboards, and browser-specific behavior require additional review.

## Development and validation

```sh
npm ci
npx playwright install chromium
npm test
```

Tests serve temporary good/bad layouts on an ephemeral loopback port. They verify real findings for stacked navigation, buried content, header density and overflow; calibrated thresholds; `display: contents`; navigation failures; and a representative mobile drawer's focus/Escape behavior. No production system is contacted by the tests.

## License and dependencies

Copyright 2026 Compound Labs. All rights reserved. [License](LICENSE) permits installation, execution, and private adaptation for personal or internal business workflows. Playwright and Chromium are separate dependencies with their own licenses; their binaries are not bundled here.
