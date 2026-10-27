---
name: mobile-refine
description: Audit or improve responsive web layouts by comparing desktop and mobile structure, primary-content placement, navigation, overflow, and interactive states. Use for mobile UX refinement or responsive QA; a viewport-fit check alone is insufficient.
---

# Mobile refine

A sidebar stacked above primary content can fit perfectly and still make a poor phone layout. Compare what each region does at desktop and mobile sizes, then verify both geometry and the actual user task.

## Establish the requested outcome

Identify the route, primary task, supported widths, and whether the user wants an audit or implementation. An audit request produces findings; it does not authorize edits or deployment. Preserve the app's components, icon pack, design tokens, and ownership boundaries. Inspect build hooks before editing generated stylesheets.

## Measure the current route

Use the bundled [audit CLI](scripts/audit.mjs) when local Node.js and Playwright execution are available. Its setup and configuration are in [measurement notes](references/measurement.md). Resolve scripts relative to this skill's actual directory, never to an assumed home folder.

Run a desktop baseline and representative narrow widths, including 320 CSS px when testing reflow. Supply explicit primary-content and sidebar selectors if automatic discovery is wrong. Wait for the application's actual ready state; a successful HTTP response alone does not establish a populated route.

Record the URL, state, width, affected element, observed measurement, and a screenshot for each important issue. Use a temporary artifact directory and remove review artifacts when finished unless the user asks to retain them. Never put private page screenshots in a public repository.

The CLI reports measurements and configurable heuristics. A clean result is not an accessibility certification or proof that interactions work. Review the screenshot and page context before calling a heuristic a defect. If the host cannot execute browser code, use its available browser tools to gather the same evidence and disclose unmeasured checks.

## Make a responsive decision

For each affected region, state its intended behavior before changing CSS:

- Secondary navigation might become a labelled drawer, a sheet, a smaller priority navigation, or a section at a deliberate location. A sidebar above content can also be intentional; judge the task rather than imposing a universal ban.
- A dense table might keep a labelled horizontal scroll region, expose priority columns with details, or become a purposeful record view. Preserve meaningful relationships and accessibility semantics.
- Header controls must leave room for the primary task. Density thresholds are review prompts, not standards.
- A scrollable strip needs a discoverable continuation and keyboard access. Avoid clipping the whole document to conceal overflow.

Keep the available application width. Apply reading measures to long prose itself, rather than arbitrarily narrowing a dashboard, grid, or expanded panel. Give rows explicit balanced padding and reset inner semantic margins where those margins distort row geometry. Reuse existing component patterns rather than introducing a new visual system during a responsive fix.

## Verify the changed behavior

Re-run the same routes, widths, and states. Inspect actual rendered desktop and narrow screenshots, including populated tables and open cards when present. Exercise changed controls: tap/click, keyboard focus, Enter/Space, Escape, expanded/collapsed, disabled, loading/error, and reduced-motion states as applicable. For a modal drawer, check focus entry, containment, background interaction, scroll behavior, close controls, and focus return. Test on a real mobile browser when platform behavior matters; Chromium emulation cannot prove Safari behavior.

Read [review checklist](references/review.md) for changes involving navigation, data tables, or forms. Respect audit-only scope and existing authorization for external actions. Report what was verified, remaining limitations, and the reason for each responsive decision; distinguish measured issues from design judgments.

## Codex and Claude Code

The workflow and scripts are shared. Codex can invoke `$mobile-refine`; Claude Code can invoke the installed plugin's `mobile-refine` skill. Use the host's available file, shell, browser, and image-inspection tools. Neither platform requires a specific connector, account, permanent browser profile, or background service.
