# Milestone 3 — Registration vertical slice

## Outcome

Milestone 3 delivers a complete student registration path backed by deterministic
PostgreSQL rules:

1. Search the current term's offered courses.
2. Inspect section availability, meetings, instructor, and eligibility.
3. Submit an idempotent registration request.
4. Withdraw or drop while institutional rules permit.
5. Review the resulting student schedule.

The approved registration concept in
`docs/design/concepts/registration.png` is the production visual reference.

## Included

- Server-side course and section search from hosted PostgreSQL rows.
- Structured eligibility results with blocking reasons and warnings.
- Academic-status, registration-window, section-state, capacity, duplicate,
  repeat, prerequisite, co-requisite, credit-load, blocking-hold, meeting-conflict,
  and configurable section-restriction checks.
- Atomic registration with section row locking, an idempotency key, a bounded
  request size, and an append-only audit event.
- Atomic drop or withdrawal with deadline and minimum-credit checks.
- Seat counters updated inside the same transaction as enrollment state.
- Student registration and schedule routes.
- Read-only registrar registration oversight.
- pgTAP coverage for eligibility, authorization, idempotency, withdrawal, and
  final-seat concurrency.

## Explicitly excluded

- Waitlist promotion and registrar overrides.
- Cross-listed sections and variable-credit courses.
- Production notifications.
- Live World, ENS, 0G, wallet, or blockchain calls.
- Contract deployment or onchain registration data.
- Real student information.

## Rule decisions

- Official eligibility is deterministic; AI is not involved.
- A registration request may contain at most ten sections.
- Sections are locked in UUID order to prevent deadlocks.
- The transaction validates every requested section before writing any
  enrollment. A blocking result rejects the whole request.
- If an eligible section is full at commit time, registration is rejected rather
  than silently creating a waitlist entry.
- A withdrawal before the add/drop deadline records `dropped`; a later permitted
  withdrawal records `withdrawn`.
- Completed courses cannot be repeated unless the course restriction JSON
  explicitly sets `allowRepeat` to `true`.
- Section restriction JSON is deny-by-default for unknown rule keys.

## Acceptance

- An eligible synthetic student can register successfully.
- Missing prerequisites, blocking holds, a closed window, full sections,
  duplicates, credit overload, and timetable conflicts are rejected with stable
  reason codes.
- Two students racing for the last seat cannot over-enroll the section.
- A valid withdrawal changes the enrollment state and frees the seat.
- Every successful mutation has a PII-free audit event.
- Desktop and mobile registration/schedule flows match the approved Lozzi visual
  system and pass keyboard and accessible-name checks.

