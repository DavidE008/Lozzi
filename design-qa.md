# Milestone 4 instructor grade-entry design QA

## Comparison target

- Approved reference:
  `C:\Users\datat\Documents\Lozzi\docs\design\concepts\instructor-grade-entry.png`
- Browser-rendered desktop:
  `C:\Users\datat\Documents\Lozzi\docs\design\qa\milestone-4-instructor-desktop.png`
- Side-by-side comparison:
  `C:\Users\datat\Documents\Lozzi\docs\design\qa\milestone-4-instructor-comparison.png`
- Mobile evidence:
  `C:\Users\datat\Documents\Lozzi\docs\design\qa\milestone-4-instructor-mobile.png`

## Viewport and state

- Reference and desktop CSS viewport: `1536 × 1024`.
- Mobile CSS viewport: `390 × 844`.
- Authenticated role: synthetic instructor Elena Martinez.
- Hosted section: CS 2305 Data Structures, Fall 2026, one enrolled synthetic
  student.
- Lifecycle: draft, with saved `9 / 88 / 90` components producing `89.2` and
  `B+`.

## Fidelity checks

No actionable P0, P1, or P2 finding remains.

1. Layout: the implementation preserves the compact navy instructor rail,
   institutional top bar, breadcrumb/title/assignment header, four-stage
   lifecycle, open grade table, and right-hand submission summary.
2. Copy and state: lifecycle labels, publication warning, assignment boundary,
   table labels, summary counts, audit note, and action language match the
   approved information hierarchy while reflecting hosted synthetic rows.
3. Typography and color: locally bundled Lora and Inter maintain the
   institutional serif/sans hierarchy. Navy, teal, ivory, slate, stone, and
   restrained gold status treatments use the approved Lozzi tokens.
4. Spacing, borders, and icons: fine borders, small radii, quiet elevation,
   measured whitespace, and one Lucide outline icon family align with the
   source. The real Lozzi crest is used in both shell locations.
5. Responsiveness and behavior: at `390 × 844`, the header collapses to
   icon controls, the lifecycle becomes a readable two-by-two grid, the grade
   table scrolls horizontally, and the submission summary remains below the
   main workflow. The mobile navigation opens and closes correctly.
6. Accessibility: all three numeric inputs have student-specific accessible
   names and bounded minimum/maximum values. Primary actions are keyboard
   reachable, status is not color-only, and browser checks found no console
   warnings or errors.

## Functional verification

- Confirmed the three hosted component values render as `9`, `88`, and `90`.
- Changed participation to `10` without saving and observed immediate,
  deterministic recalculation to `90.2` and `A-`.
- Reloaded the page and confirmed the unchanged hosted draft returned.
- Confirmed Save draft, Submit grades, Export, and Keyboard shortcuts are
  enabled in the valid draft state.
- Opened and closed the mobile instructor navigation.
- Verified the active term header resolves to Fall 2026 and legacy schedule
  typography is normalized to `Mon 10:00 AM–11:15 AM · Wed 10:00 AM–11:15 AM`.

## Expected data deviations

- The approved concept uses a twelve-student illustrative roster and shows
  three sample rows. Milestone 4 renders the one real hosted synthetic student
  assigned to CS 2305; additional client-only students were not invented.
- Pagination controls and the blocked-error sample row are absent because the
  single hosted row fits on one page and is complete. Empty and invalid states
  remain covered by unit, database, and lifecycle tests.

final result: passed
