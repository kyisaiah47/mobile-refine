# Responsive review checklist

Apply the checks relevant to the changed surface. Preserve the requested scope; avoid a full redesign during a narrow repair.

**Structure.** Confirm primary-task content is discoverable, secondary regions have intentional placement, and reading/focus order follows the meaningful visual order. Test intermediate widths as well as phone and desktop endpoints. Prefer component-level adaptation when the same component appears in differently sized containers.

**Navigation and overlays.** Check control labels, expanded state, focus visibility, Escape, focus return, background interaction, scroll locking, and any existing back-button contract. A drawer is an option, not a mandatory treatment for every desktop sidebar. Reuse the app's established icon component and transitions.

**Data.** Inspect a populated table or register. Confirm headings remain associated with values, horizontal scrolling is contained to the intended region, and keyboard users can reach the content. Check an expanded row/card and its spacing. Do not change table semantics casually to achieve stacked styling.

**Controls and forms.** Check real hit areas and adjacency, not just icon size. WCAG 2.5.8 includes spacing, equivalent-control, inline, user-agent-control, and essential exceptions; a simple 24px bounding-box test cannot establish compliance. Test labels, error text, keyboard type, focus, and the on-screen keyboard on a real device when relevant.

**Content and motion.** Check enlarged text, zoom, long labels, realistic data, empty/error/loading states, reduced motion, and portrait/landscape when supported. Review hover-only affordances on a touch device. Do not force desktop visual density onto every phone task.

Primary references verified while preparing this package:

- [W3C: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): the 320 CSS px condition and exceptions for content requiring two-dimensional layout.
- [W3C: Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): target size, spacing geometry, and exceptions.
- [Playwright: Emulation](https://playwright.dev/docs/emulation): what viewport and device emulation can simulate.

These references guide review. The CLI does not implement a full WCAG evaluation.
