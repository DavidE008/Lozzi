# Registrar workspace production contract

## Source of truth

- Reference: `docs/design/concepts/registrar-workspace.png`
- Native reference: 1536 × 1024 pixels
- Product state: Jordan Lee, Registrar, Northstar University, Fall 2026,
  synthetic data

The supplied concept is the production reference. Existing Lozzi tokens,
locally bundled Lora and Inter fonts, the shared crest, and the established
outline icon family remain authoritative.

## Desktop composition

- A 212-pixel deep-navy rail carries the Lozzi lockup, workspace label,
  navigation, and settings.
- A 56-pixel ivory utility header carries institution, selected term,
  synthetic-demo state, notifications, and Jordan Lee's role identity.
- The main canvas begins with “Registrar workspace” and the supporting line
  “Oversee academic records and manage registration operations.”
- A single open summary band presents Registration, Active students, Course
  sections, and Records awaiting publication.
- The primary area is a wide attention table paired with a narrower academic
  term panel.
- Institution activity spans the lower content width as an open audit table.
- Borders are one pixel, radii are restrained, shadows are minimal, and data
  remains table- or list-led rather than card-grid-led.

## Navigation and destination contract

| Label    | Route                 | Milestone 2 behavior                                                             |
| -------- | --------------------- | -------------------------------------------------------------------------------- |
| Overview | `/registrar`          | Live database summary, record attention, term, and audit activity                |
| Students | `/registrar/students` | Institution-scoped student directory, read-only                                  |
| Catalog  | `/registrar/catalog`  | Manage departments, programs, versions, requirements, courses, and prerequisites |
| Terms    | `/registrar/terms`    | Manage term dates, credit limits, and registration state                         |
| Sections | `/registrar/sections` | Manage sections, instructor assignments, and meeting times                       |
| Records  | `/registrar/records`  | Honest read-only queue; publication remains Milestone 4                          |
| Audit    | `/registrar/audit`    | Institution-scoped append-only activity                                          |
| Settings | `/registrar/settings` | Institution details, memberships, and staff-role assignments                     |

## Visual tokens

- Deep navy `#0D1B2A`: rail, headings, primary actions.
- Slate `#334A68`: supporting copy and secondary emphasis.
- Teal `#1FAE9A`: active registration and successful outcomes.
- Gold `#D4A017`: compact attention counts and institutional accent.
- Ivory `#FAF8F3`: page canvas.
- Light stone `#E9ECEF`: dividers and quiet surfaces.
- Lora Semibold: product name, page title, section headings.
- Inter Regular/Medium/Semibold: navigation, controls, tables, and metadata.

## Component and state inventory

- Shared crest lockup and existing Lozzi outline icons; no new raster assets are
  required.
- Active navigation uses the concept's brighter navy field and teal leading
  rule.
- Tables use open rows, generous horizontal alignment, small status labels,
  explicit action names, and keyboard-visible focus.
- Forms use code-native labels, inputs, selects, inline validation, disabled
  submission, pending state, and an announced success or error result.
- Deactivation replaces destructive deletion.
- Empty, loading, denied, error, and successful mutation states are required.
- The “Publish approved records” control remains visibly unavailable with an
  honest Milestone 4 explanation; no publication success is simulated.

## Responsive contract

- At tablet and mobile widths, navigation moves into the existing accessible
  sheet pattern.
- Summary items wrap without horizontal scrolling.
- Dense tables keep their semantic desktop presentation and become labelled
  row groups on small screens.
- Forms use one column on mobile and preserve control labels, validation, and
  action order.
- No primary action, status, or record detail may become hover-only.
