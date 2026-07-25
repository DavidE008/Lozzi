# Milestone 4 — Grades, records, and progress

## Outcome

Milestone 4 delivers a complete synthetic academic-record path:

1. An assigned instructor opens an authorized section roster.
2. The instructor saves draft grades and submits the complete roster.
3. A registrar approves and publishes the submission.
4. Published grades become visible in the student's official record.
5. GPA and degree progress are recalculated deterministically.
6. A correction produces a new, linked version without erasing history.

The approved instructor concept in
`docs/design/concepts/instructor-grade-entry.png` is the production visual
reference.

## Included

- Assigned-section and roster reads derived from database role assignments.
- The grade lifecycle `draft → submitted → approved → published`.
- Idempotent draft, submission, approval, publication, and correction
  boundaries.
- Institution-scoped registrar review and publication.
- Append-only published grade records with one current version per enrollment.
- Append-only academic record versions with previous-version links,
  correction-reason codes, content commitments, actor, timestamp, and explicit
  anchor state.
- Deterministic GPA, earned-credit, and program-requirement calculations.
- Instructor grade entry, registrar record review, student record, and student
  progress routes.
- pgTAP, domain, component, repository, and browser acceptance tests.

## Explicitly excluded

- Grade values, student identifiers, or roster data onchain.
- Contract deployment, anchor submission, or claims of live verification.
- Arbitrary assessment-weight configuration or a learning-management-system
  gradebook.
- Bulk CSV import, transcript PDF generation, transfer-credit evaluation, and
  incomplete-grade expiry.
- Production notifications or live partner integrations.
- Real student information.

## Lifecycle decisions

- Draft grades remain editable by an instructor assigned to the section.
- A section submission is accepted only when every eligible roster row has a
  valid final grade.
- Submitted grades are immutable to instructors. A registrar may approve them;
  publication is a separate explicit action.
- Publication creates the official `grade_records` row and a student-level
  `academic_record_versions` row in one transaction.
- A correction is a new grade submission with a required reason code. Publishing
  it marks the previous grade and academic-record versions historical and links
  the replacements to them.
- The current record always points to the latest published version. Historical
  rows remain queryable to authorized users.
- GPA uses current published grade records only:
  `sum(grade_points × attempted_credit_hours) / sum(attempted_credit_hours)`.
- Earned credits include current published passing grades only. Program progress
  is capped at 100% and evaluated from versioned program requirements.
- Official outcomes are deterministic; AI is not involved.

## Acceptance

- Elena Martinez can manage only her assigned sections and rosters.
- James Wilson is rejected when attempting to read or mutate Elena's section.
- An instructor can save a draft and submit a complete grade roster.
- Jordan Lee can approve and publish submitted grades for Northstar University.
- Publication exposes the official grade only to the authorized student and
  authorized institutional roles.
- A correction creates version 2, links version 1, preserves version 1 for
  audit, and makes version 2 current.
- GPA and degree progress reproduce the seeded synthetic outcomes.
- The approved instructor concept and final desktop implementation pass a
  same-input visual comparison; the workflow also passes mobile and keyboard QA.
