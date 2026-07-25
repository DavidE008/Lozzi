# Milestone 3 registration design QA

final result: passed

## Comparison target

- Source visual truth:
  `C:\Users\datat\Documents\Lozzi\docs\design\concepts\registration.png`
- Browser-rendered implementation:
  `C:\Users\datat\Documents\Lozzi\docs\design\qa\milestone-3-registration-desktop-final.png`
- Normalized implementation:
  `C:\Users\datat\Documents\Lozzi\docs\design\qa\milestone-3-registration-desktop-final-normalized.png`
- Full-view comparison:
  `C:\Users\datat\Documents\Lozzi\docs\design\qa\milestone-3-registration-comparison-final.png`
- Focused expanded-course comparison:
  `C:\Users\datat\Documents\Lozzi\docs\design\qa\milestone-3-registration-focus-comparison.png`
- Mobile evidence:
  `C:\Users\datat\Documents\Lozzi\docs\design\qa\milestone-3-registration-mobile.png`

## Viewport and normalization

- Source pixels: `1536 × 1024`.
- Desktop CSS viewport: `1536 × 1024`, device scale factor approximately `1`.
- Raw in-app browser capture: `1521 × 1014`. The capture excludes the
  browser's scrollbar/gutter area even though `window.innerWidth` and
  `window.innerHeight` report the requested CSS viewport.
- The raw implementation was bicubically normalized to `1536 × 1024` before
  the final side-by-side comparison. The source was not resampled.
- Mobile CSS viewport: `390 × 844`; visible capture: `375 × 834`.
- State: authenticated synthetic student Aisha Rahman, Fall 2026 registration,
  CS 2305 expanded, empty planned schedule.

## Findings

No actionable P0, P1, or P2 findings remain.

- Fonts and typography: locally bundled Lora and Inter preserve the approved
  serif display/sans UI hierarchy. Heading scale, table density, line height,
  and compact labels are visually aligned in the final comparison.
- Spacing and layout: the final pass aligns the `204px` desktop sidebar,
  title/search origin, two-column schedule composition, filter strip, table
  rhythm, three-part expanded course detail, and full-height planned-schedule
  rail. Fine borders and small radii remain consistent with the source.
- Colors and tokens: deep navy, slate, teal, gold/amber, ivory, and stone use
  the approved Lozzi tokens. Eligibility, blocking, selected, and disabled
  states retain readable contrast.
- Image quality and assets: the implementation uses the real Lozzi crest
  component and Lucide icons. No screenshot-derived asset is replaced by CSS
  art, emoji, or a placeholder graphic.
- Copy and content: the title, search prompt, filters, planned schedule, credit
  total, eligibility checklist, and registration-window language match the
  approved information structure. Dynamic statuses truthfully reflect hosted
  synthetic PostgreSQL rows.
- Icons and controls: navigation, search, filters, schedule, status, and
  expansion controls use one consistent outline icon family and remain
  keyboard reachable.
- Responsiveness and accessibility: the `390 × 844` pass has no horizontal
  content overflow. The mobile drawer opens and exposes every student
  destination. Search, selects, checkbox, course disclosure, plan action, and
  submit control have semantic accessible names and visible focus treatment.

## Expected product/data deviations

- The concept depicts CS 2305 as eligible and four sections. The implementation
  correctly shows Aisha's real seeded CS 2305 enrollment and the single
  published hosted section. Inventing additional sections or a false eligible
  state would violate the real-data milestone requirement.
- The product navigation includes the working Schedule destination introduced
  in Milestone 3 and retains the authenticated student/sign-out affordance.
- Notification and support affordances shown in the concept remain outside this
  milestone; their absence does not block the registration task.

## Comparison history

### Pass 1 — blocked

- P2: no department/credit/open filters or visible sort/count controls.
- P2: no prerequisite table column.
- P2: the expanded course used a generic single card instead of the source's
  about/section/eligibility structure.
- P2: the planned-schedule rail was short and started below the page heading.
- P2: the registration sidebar brand block was compressed and shifted the
  navigation substantially above the source.

Fixes made:

- Added functional department, credit, open-section, and sort controls.
- Added the prerequisite column and compact course-count row.
- Rebuilt expanded content as three bounded regions with section details,
  deterministic eligibility evidence, honest blocking feedback, and a plan
  action.
- Raised and lengthened the planned-schedule rail to match the source
  composition.
- Applied the registration-specific sidebar width and vertical crest lockup.

Post-fix evidence:

- Full-view:
  `docs/design/qa/milestone-3-registration-comparison-final.png`
- Focused region:
  `docs/design/qa/milestone-3-registration-focus-comparison.png`

The post-fix comparison contains no remaining P0/P1/P2 mismatch.

## Browser verification

- Tested course search/filtering; selecting `MATH` reduced the catalog to the
  two mathematics courses.
- Expanded MATH 1314, added it to the plan, verified `3 / 18` planned credits
  and an enabled review button, then restored the empty plan.
- Opened and closed the mobile navigation drawer and verified every student
  destination.
- Verified desktop and mobile state, loading completion, and zero browser
  console errors.
- The final live preview was restored to the approved CS 2305 expanded state.

## Follow-up polish

- P3: a future data milestone can publish additional sections and richer course
  descriptions so the expanded panel can demonstrate the same density as the
  concept without inventing client-side data.
