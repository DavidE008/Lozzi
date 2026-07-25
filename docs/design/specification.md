# Approved production design specification

The five supplied concepts are the production reference. Their archived files
live in `docs/design/concepts`.

## Visual system

- Deep navy `#0D1B2A`: shell, headings, primary actions.
- Slate `#334A68`: secondary text and supportive surfaces.
- Teal `#1FAE9A`: active, positive, and progress emphasis.
- Gold `#D4A017`: crest accent and small institutional highlights.
- Ivory `#FAF8F3`: page canvas.
- Light stone `#E9ECEF`: borders and quiet fills.
- Lora Semibold for display typography; Inter Regular/Medium/Semibold for UI.
- Restrained crest SVG, one-pixel borders, 8–12px radii, open lists/tables,
  clear keyboard focus, text-plus-color statuses, and no decorative charts.

## Student dashboard contract

Desktop uses a narrow navy rail, a spacious ivory content canvas, a compact
utility header, four summary cards, a two-column schedule/action region,
degree progress, and recent activity. The current synthetic truth is Aisha
Rahman, Computer Science, GPA 4.00, 3 of 120 credits, 3% progress, and one
current CS 2305 section.

Mobile collapses navigation behind an accessible menu, retains all copy and
actions, and stacks cards without horizontal scrolling. Every navigation item
has a real read-only destination and every async boundary has loading, empty,
and error UI.
