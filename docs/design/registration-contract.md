# Registration experience contract

## Source

`docs/design/concepts/registration.png` is the selected production reference.
The implementation uses the existing Lozzi shell, crest, typography, tokens, and
component conventions.

## Layout

- Desktop: fixed deep-navy student rail, institutional top bar, wide registration
  workspace, and a narrow planned-schedule summary.
- Mobile: the existing sheet navigation, stacked search/results, and a sticky
  review summary that never obscures form controls.
- Course results use an open table/list treatment. Expanded rows reveal sections
  and structured eligibility rather than introducing a separate modal.

## Navigation

| Label        | Route               |
| ------------ | ------------------- |
| Overview     | `/student`          |
| Registration | `/student/register` |
| Schedule     | `/student/schedule` |
| Record       | `/student/record`   |
| Progress     | `/student/progress` |
| Shares       | `/student/shares`   |
| Settings     | `/student/settings` |

## Visual tokens

- Deep navy `#0D1B2A`: navigation, headings, primary actions.
- Slate blue `#334A68`: supporting type and secondary information.
- Teal `#1FAE9A`: selection, eligibility, focus, and success.
- Warm gold `#D4A017`: time-sensitive warnings and institutional emphasis.
- Ivory `#FAF8F3`: page background.
- Light stone `#E9ECEF`: dividers, inputs, and quiet surfaces.
- Lora is reserved for page and section headings; Inter is used for interface copy.
- Borders are fine, radii are restrained, and decorative shadow is minimal.

## Required states

- Search loading, no offered courses, and query with no matches.
- Eligible, registered, ineligible, full, closed, and schedule-conflict section
  states.
- Review empty, submitting, success, and transaction failure.
- Withdrawal confirmation, success, and rule rejection.
- Missing hosted-data configuration remains an honest error state; no mock
  registration success appears outside development.

## Accessibility

- Search is labelled and submits with the keyboard.
- Expansion buttons expose `aria-expanded` and reference their section details.
- Eligibility is conveyed by icon, label, and text—not color alone.
- Registration results use live-region feedback without moving keyboard focus.
- Desktop table semantics degrade to labelled stacked rows on narrow screens.

