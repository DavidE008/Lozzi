# Milestone 5 integration experience contract

## Visual source

Milestone 5 extends the approved Lozzi student and registrar product system. It
does not introduce a sixth visual concept or a Web3-styled dashboard. Existing
student Settings, student Progress, registrar Settings, shell navigation,
typography, tokens, icon language, borders, and responsive rules are the
production reference.

## Student Settings

The page keeps its current two-column profile/capability structure on desktop
and one-column flow on mobile.

World verification and ENS identity are the only actionable partner rows:

- Each row begins with a familiar line icon, human label, and one-sentence
  explanation.
- A right-aligned status treatment uses the established small rectangular
  badge.
- `Available` uses teal, `Mock development` uses gold, `Not configured` uses
  slate, and `Failed` uses the existing destructive treatment with text and
  icon—not color alone.
- The primary action appears only when the server capability allows the
  operation. Missing configuration shows a direct non-interactive explanation.
- World copy says what the signal proves and explicitly says it does not prove
  enrollment or grades.
- ENS copy displays a resolved name before any abbreviated address. A no-name
  result is normal, not an error.

## Student Progress

The deterministic degree audit remains the dominant content. The optional 0G
explanation sits in the existing right rail beneath the planning note:

- Title: `Progress explanation`
- Supporting label: `Advisory AI`
- Primary action: `Explain my progress`
- Loading text: `Preparing a private explanation…`
- Success sections: summary, progress highlights, possible next courses, and
  risks.
- The disclaimer is always visible and cannot be collapsed.
- Provider/model metadata is secondary and contains no request contents.
- Invalid, unavailable, rate-limited, and network-failure states remain within
  the panel and never erase the deterministic degree audit.

## Registrar Settings

Institution integration health uses the current open table/list anatomy:

- Provider
- Operational purpose
- Capability state
- Last checked
- Required configuration category

Secret values never render. A registrar may see status; only an institution
administrator may request a health refresh. No screen offers raw key entry in
Milestone 5.

## Interaction and accessibility

- All actions are keyboard reachable and expose visible focus.
- Async controls use `aria-live` feedback and retain their accessible names.
- Loading disables duplicate submission.
- Failure details are user-safe categories, not provider payloads.
- Status icons are decorative when adjacent text carries the same meaning.
- Mobile layouts preserve a minimum 44-pixel action target and avoid horizontal
  scrolling.
- Partner terminology appears only where useful; the rest of the SIS retains
  academic language.

## Fidelity checks

Final QA must compare the updated pages against their pre-Milestone 5 Lozzi
screens and verify:

1. No shell, typography, color, radius, or spacing regression.
2. Deterministic degree progress remains visually primary.
3. Capability states are truthful, readable, and not color-only.
4. Mobile settings and progress flows remain complete without clipped actions.
5. Development mocks carry an unmistakable visible label.
