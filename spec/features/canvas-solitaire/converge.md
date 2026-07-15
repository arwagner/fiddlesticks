<!-- CONVERGE LEDGER — generated & append-only (spec-flow contract §13).
     Written ONLY by /spec-flow:converge. Never hand-edit, never rewrite or delete a prior run
     block, never renumber runs or gap ids. Each run appends one `## run N` block: a baseline line,
     the gap events (opened | confirmed | reclassed | closed), and a verdict line whose open counts
     equal the open set computed from the full event history. This is drift history, committed. -->

# Converge ledger — canvas-solitaire

## run 1 — 2026-07-15
baseline: spec sha256:7529cddf6329 · plan absent · tasks absent
context: first run — brownfield adopt fitness test. Auditor read `src/solitaire.ts` (mounted by
`src/game.ts`) independently against spec.md AC-1…AC-13 + constitution + product-global. 10/13 ACs
implemented; static/client-only, mobile touch-action, and slug-agreement checks all clean.

- opened gap-001 [contradicts] spec:"AC-3 — foundation accepts next ascending rank of the SAME suit; Ace on empty foundation"
    evidence: `canPlaceOnFoundation` (src/solitaire.ts:299-308) checks only `card.rank === 1` for an
    empty pile — never `card.suit === suit`. Any Ace is accepted into any suit-labeled foundation slot
    (e.g. Ace of Spades into the "H" slot drawn at src/solitaire.ts:637); the slot then silently tracks
    the wrong suit. Reachable via click auto-play (src/solitaire.ts:529-550) and drag-drop (src/solitaire.ts:463-474).
    route: /spec-flow:change — decide fidelity-defect (add the suit check) vs spec change. Anchored to
    an AC (not constitution/product-global), so not blocking-hard; at mvp depth an open contradicts holds the feature from `done`.

- opened gap-002 [partial] spec:"AC-4 — tableau placement rule + correct targeting"
    evidence: the rank/color rule (`canPlaceOnTableau`, src/solitaire.ts:310-322) is correct, but the
    drop hit-test (`tryDropDrag`, src/solitaire.ts:476-489) and pickup hit-test (`onPointerDown`,
    src/solitaire.ts:552-575) mix SCALED positions (pileX / tableauCardPositions) with UNSCALED
    constants (CARD_W/CARD_H/TABLEAU_Y/FACEUP_SHIFT, lines 480-481, 560). Correct at scale === 1 only;
    at any other responsive scale, targeting drifts from drawn positions (legal drops rejected, clicks
    miss/hit wrong card). Confirms the spec's own "Known sharp edges" note (spec.md:68-73). Bears directly
    on the product-global mobile/iOS NFR — phones run at scale ≠ 1.
    route: /spec-flow:clarify first (spec.md carries two open markers asking whether correct-at-all-scales
    is required or an accepted limitation); the answer decides fidelity-defect vs narrowing the spec.

- opened gap-003 [partial] spec:"AC-8 — removing a tableau card that exposes a face-down card flips it"
    evidence: implemented for foundation-bound removals only (`moveTableauToFoundation` →
    `revealLastInTableau`, src/solitaire.ts:352-355). NOT implemented for tableau→tableau drag moves:
    `startDragFromTableau` (src/solitaire.ts:422-440) splices cards off the source column but never
    reveals the new top card, and neither success branch of `tryDropDrag` touches the source. Dragging a
    run off a column leaves the exposed card face-down until separately clicked — contradicts the
    "or a move exposes it" clause (spec.md:43-46).
    route: /spec-flow:change — decide fidelity-defect (flip on all removals) vs narrowing the spec.

verdict: open 3 (missing 0, partial 2, contradicts 1, unrequested 0)

## run 2 — 2026-07-15
baseline: spec sha256:dc8a07ca4150 · plan absent · tasks absent
context: re-audit after the run-1 gaps were remediated (chg-001 spec change + code, plus two fidelity
defects). Auditor re-read `src/solitaire.ts` against the updated spec (AC-1…AC-14); all 14 ACs read
implemented, no new unrequested behavior, shared non-negotiables clean.

- closed gap-001 [contradicts] — AC-3 no longer suit-locked. `canPlaceOnFoundation` gates on the pile's
    actual top card only (src/solitaire.ts:299-308); empty foundations draw a generic "A-K" hint, no suit
    letter (src/solitaire.ts:654). Spec corrected via chg-001. Any Ace starts any empty foundation.
- closed gap-002 [partial] — AC-4/AC-14 hit-testing now fully scaled: tableau drop (src/solitaire.ts:487-503),
    tableau pickup (src/solitaire.ts:566-589), waste drag anchor (src/solitaire.ts:404-421). No unscaled
    CARD_W/CARD_H/TABLEAU_Y/FACEUP_SHIFT remain in hit-testing/anchor math; targeting tracks drawn positions
    at every scale.
- closed gap-003 [partial] — AC-8 `revealExposedSource` in `tryDropDrag` (src/solitaire.ts:467-471) flips the
    exposed source card on every successful commit to a different pile (foundation :480 and tableau :499 branches).

verdict: open 0 (missing 0, partial 0, contradicts 0, unrequested 0)

## run 3 — 2026-07-15
baseline: spec sha256:dc8a07ca4150 · plan sha256:84aaf5cb62ee · tasks sha256:804770d0895e
context: post-implement re-audit (plan task T7). A behavior-preserving refactor extracted the pure rules
and geometry into `src/solitaire-rules.ts` (imported by `src/solitaire.ts`) and added a Vitest suite
(solitaire-rules/hittest/stock .test.ts). Auditor re-read both modules + tests: all 14 ACs still
implemented, behavior identical, no new unrequested behavior; tests cite feat-003/AC-N for
AC-1,2,3,4,5,6,7,8,9,10,11,12,14 (AC-13 remains manual per plan). Static/client-only and mobile
touch-action intact; Vitest is a dev-only dependency. No gaps opened or closed.

verdict: open 0 (missing 0, partial 0, contradicts 0, unrequested 0)
