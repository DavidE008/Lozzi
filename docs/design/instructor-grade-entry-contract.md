# Instructor grade-entry experience contract

## Source

`docs/design/concepts/instructor-grade-entry.png` is the selected production
reference. The implementation reuses the existing Lozzi crest, typography,
tokens, shell conventions, and accessible component patterns.

## Layout

- Desktop: fixed deep-navy instructor rail, institutional top bar, a wide grade
  table, and a narrow submission-summary rail.
- Mobile: the existing sheet-navigation pattern, stacked section context, a
  horizontally scrollable grade table, and action controls that remain reachable
  without covering inputs.
- The lifecycle stepper remains visible above the roster and clearly distinguishes
  draft, submitted, approved, and published states.

## Navigation

| Label     | Route                   |
| --------- | ----------------------- |
| Sections  | `/instructor`           |
| Gradebook | `/instructor/gradebook` |
| Messages  | `/instructor/messages`  |
| Settings  | `/instructor/settings`  |

Section rows link to `/instructor/sections/[sectionId]/grades`.

## Visual tokens

- Deep navy `#0D1B2A`: navigation, headings, primary actions.
- Slate blue `#334A68`: supporting type and secondary information.
- Teal `#1FAE9A`: current stage, completion, focus, and success.
- Warm gold `#D4A017`: validation attention and institutional emphasis.
- Ivory `#FAF8F3`: page background.
- Light stone `#E9ECEF`: dividers, inputs, and quiet surfaces.
- Lora is reserved for page and section headings; Inter is used for interface
  copy.
- Borders are fine, radii are restrained, and decorative shadow is minimal.

## Interaction contract

- The section page proves assignment with explicit copy: “You can only manage
  this section.”
- Draft grade inputs are keyboard reachable, labelled by student and field, and
  validate before submission.
- Save draft is idempotent and does not publish student-visible outcomes.
- Submit grades is disabled while any roster row is incomplete or invalid.
- Submitted, approved, and published rosters are read-only to instructors.
- The summary announces complete, needs-attention, and not-started counts using
  icon, label, and text rather than color alone.
- A persistent audit note explains that post-submission changes require the
  registrar correction workflow.

## Required states

- Assigned roster, empty roster, loading, and authorization denial.
- Clean draft, dirty draft, validation failure, saving, and saved.
- Complete draft, submitting, submitted, approved, and published.
- Mutation replay, recoverable server error, and stale-version conflict.
- Missing hosted-data configuration remains an honest error; no mock grade
  success appears outside development.

## Accessibility

- The lifecycle is an ordered list with current-step semantics.
- Inputs expose programmatic labels and field-level error descriptions.
- Status is never conveyed by color alone.
- Save and submit feedback uses a polite live region.
- Desktop table semantics remain intact; narrow screens retain row and column
  context while allowing controlled horizontal scrolling.
