# Registrar workspace fidelity review

The approved registrar concept remains the production design reference for
Milestone 2. The final implementation was inspected in the in-app browser at
desktop and mobile breakpoints and compared directly with the reference in one
side-by-side image.

## Evidence

- [Approved registrar concept](concepts/registrar-workspace.png)
- [Desktop implementation](registrar-workspace-implementation-desktop.png)
- [Direct side-by-side comparison](registrar-workspace-comparison.png)
- [Mobile implementation](registrar-workspace-implementation-mobile.png)
- [Mobile navigation state](registrar-workspace-implementation-mobile-nav.png)

## Fidelity checks

1. **Layout:** The 212-pixel fixed navy rail, slim institutional header,
   four-part summary, records/term split, and full-width activity region preserve
   the concept's hierarchy. Browser QA found and fixed an intrinsic-width issue
   so the desktop canvas no longer overflows horizontally.
2. **Copy and data:** The production UI keeps the approved registrar language
   while using hosted synthetic Northstar rows: Jordan Lee, Fall 2026, three
   students, two sections, and one approved record awaiting a later workflow.
3. **Typography:** Locally bundled Lora supplies institutional headings and
   Inter supplies navigation, controls, tables, and supporting copy.
4. **Colour:** Deep navy, slate, teal, gold, ivory, and light stone match the
   approved brand tokens. Teal is reserved for positive/open states and gold
   distinguishes the pending publication item.
5. **Spacing and surfaces:** Fine borders, small radii, open table rows, quiet
   shadows, and generous section spacing retain the reference's restrained
   administrative density.
6. **Icons:** The crest asset and Lucide line icons provide the same visual
   vocabulary for navigation, summary metrics, terms, records, and actions.
7. **Responsiveness:** At 390 pixels the rail becomes an accessible sheet,
   summary metrics stack without clipping, and the menu exposes every registrar
   destination with a clear close affordance.
8. **State behaviour:** The active destination is visibly selected, keyboard
   semantics are preserved, and record publication is deliberately disabled
   because that mutation belongs to Milestone 4.

## Controlled differences

The reference illustrates three attention rows, filtering, and an enabled
publication action. Milestone 2 renders the single real seeded attention row,
omits controls that have no implemented query behaviour, and disables
publication with an explicit Milestone 4 boundary. This avoids fabricated data
or misleading workflow success while preserving the approved design language.
