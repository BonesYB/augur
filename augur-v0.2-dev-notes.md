# Augur — v0.2 Development Notes

_Working doc started after the first playtest (v0.1.0 installers shared with friends)._

## 1. What's landing (keep these)

The first reactions converge on the same strengths — protect them as the app grows:

- **Lightweight & simple.** "I like how lightweight it is." / "well-organized and lightweight."
  The whole pitch is being a fast, un-bloated alternative to notecards and heavy VTTs. Every
  new feature should be weighed against this. Resist creep.
- **The GUI reads well.** "nice GUI." The three-region layout and dark NLE look are working.
- **The core idea resonates for prep-minded GMs.** One tester immediately grasped the
  "library of prepped stuff you drag in" model.

## 2. Issues & signal from the playtest

### A. Dead-end for new users — no way to start from scratch (P0, blocking)

> "there is no augur file to load so I am stuck in the tutorial… if that is the case then I
> can't create anything new."

This is the biggest problem. The built-in tour is read-only (it's seed data, not a vault),
and `tutorial.augur` ships **embedded in the app**, not as a file on disk — so a tester has
nothing to load and no way to make anything. The app effectively looks read-only on first run.

> **Naming note:** `tutorial.augur` _is_ the Toadwallow Bridge sample adventure. The name is
> misleading — it reads like the built-in tour (which is separate baked-in seed data). Rename it
> to `toadwallow-bridge.augur` (or `sample-adventure.augur`), and **ship it as a real download**
> (attach to the GitHub release + keep in the repo), not just embedded — that's exactly why
> testers said it "didn't come with the package."

Two fixes needed:
- **"New / Blank Vault" action.** A button that creates an empty, editable vault in memory
  (a campaign + an empty session, maybe one starter scene) and drops the user into vault mode
  so New / Library / Save all light up. This is the real unblock — start creating immediately.
- **"Load the sample adventure" in-app.** A button that loads the bundled `tutorial.augur`
  directly (in the Tauri build, app assets are same-origin, so `fetch('tutorial.augur')` →
  unzip → load should work — needs verifying). So "Toadwallow Bridge" is one click away with
  no file hunting. Also keep shipping the loose `.augur` for people who want the files.

### B. Save is invisible / confusing (P0, tied to A)

> "I see a load option but not a save option btw"

Save only appears once a vault is loaded, so a tutorial-only user never sees it. Fixing A
fixes most of this, but also: make the save affordance more discoverable, and consider an
auto-save / "you have unsaved changes" cue once they're editing a real vault.

### C. "What are the multiple tracks for?" — discoverability (P1)

The contingency-planning purpose isn't explained anywhere in-app. The intended model (worth
writing into the tutorial + a hover/help):
- Tracks let you lay **parallel / optional** content — the branches you prepped but might not
  use. As play passes a fork, you **remove the path not taken from the timeline** (it stays in
  the Bag, just leaves the session). Plan-while-playing.
- Add an explicit tutorial lesson on tracks-as-contingencies, and clarify that "remove from
  timeline" ≠ "delete."

### D. Notes during play + a real recap (P1, repeatedly implied)

Two connected, currently-missing pieces:
- **Per-scene/session notes captured _while playing_** — "what actually happened." There's no
  way to jot this right now.
- **Recap built from what's left on the timeline** — events that were played + those notes.
  (A Markdown recap export exists but doesn't include play notes.) This closes the loop the
  tester intuitively expected: prep → play → a record of what happened.

### E. The big one — "timing out an RPG session is unrealistic" (design question)

> "biggest problem is how unrealistic trying to time out an rpg session is."

This is the critique that goes at the heart of the metaphor, so it deserves a real answer
rather than a feature. Both things are true at once:

- **The critique is fair.** You can't predict to the minute how long a scene runs; players
  blow up your estimates constantly. A timeline that _looks_ like a strict schedule sets a
  false expectation and can feel like busywork.
- **The intent is still sound** (from the designer's own framing): the value isn't predicting
  exact minutes, it's (1) a **prep budget** — "do I have too much or too little for the slot?",
  (2) **relative pacing & ordering**, and (3) **live re-planning** so you don't feel lost. That's
  the video-editor insight: it's about what footage you have and roughly how it fits, not a stopwatch.

Design directions to reconcile them (pick a lean subset for v0.2):
- **Make time soft and optional.** A scene shouldn't _require_ a duration. Default everything to
  "loose." Let a scene carry no time at all and just be an ordered beat.
- **De-emphasize the clock.** Treat durations as a faint guide, not a schedule. Consider hiding
  the exact "ends 3:00 / target 3:00" readout behind a toggle, or expressing it as a soft band
  ("looks like a bit much for a 3-hour slot") instead of precise math.
- **Coarse buckets instead of minutes** (option): short / medium / long, or S/M/L sizing, which
  matches how GMs actually think and removes false precision.
- **Keep time for those who want it.** One-shots and convention slots _do_ care about time, so
  make it opt-in/visible-when-useful rather than removing it. The metaphor can survive as
  "sequence + rough sizing," with literal minutes as an optional layer.
- **Let the GM set the target.** Right now the target session length isn't adjustable in-app —
  it's read from the loaded session file or a hardcoded default, so there's no "I've got a
  4-hour slot tonight" control. Whatever stance we pick, the target must be user-settable (click
  the readout to edit, or a small field) — and skippable/hidden if time is turned off.

This is the most important strategic decision for v0.2 — worth deciding the stance before building.

### F. Clips don't push each other around — NLE paradigm expectation (P1, design)

> "rearranging was intuitive but i was surprised that the pieces of the timeline don't push each
> other around." (from a tester _with_ video-editing experience)

Augur uses **free placement** (clips sit wherever you drop them, gaps and overlaps allowed). Editor-
trained users expect **magnetic / ripple** behavior — dropping a clip shoves its neighbors and gaps
close automatically. This is a genuine fork, and it connects to §2E:

- If we lean into **"ordering, not a stopwatch,"** a magnetic single-track timeline fits beautifully —
  clips just sequence left-to-right and push each other; absolute minutes matter less.
- But free placement is what makes **tracks-as-contingencies** (§2C) work — parallel options need to
  sit side-by-side without shoving.
- Likely answer: **magnetic _within_ a track** (no gaps/overlaps, dragging ripples neighbors) while
  **tracks stay independent** for parallel content. Or offer ripple as a toggle/modifier-drag.
  Decide alongside the time-model stance.

### G. Polish nits (P2, quick wins)

- **Sequence expand-caret (▸) is too small**, especially on a 2K/hi-DPI monitor — enlarge the glyph
  and its click target.
- **Playhead reads as "less clear"** than the Bag — it's grasped eventually but the affordance could
  be more obvious (label, grabber handle, or a one-time hint).
- Reinforces §2A/#1: a second tester explicitly wanted to **create NPCs/locations in-app**. (You can
  already via the scene editor's relations, but a dedicated **vault editor** to set those up _before_
  building scenes is wanted — bump its visibility.)

### H. Playhead — anchor, not follow (decided)

> "I move the playhead while I have something selected, nothing changes… should it snap to the
> selection to follow you around, or be separate to hold your spot?"

The playhead **holds your spot** ("where I am in tonight's session"); selection is a **transient
peek** (glance at / edit a scene). We do **not** snap the playhead to selection — losing your place
every time you peek ahead or back is the one thing to avoid mid-session. The fix isn't to merge them,
it's to make the relationship legible and reversible:

- Monitor shows a **"Peeking — ↵ back to where you are"** cue whenever selection ≠ the playhead's
  clip; one click returns. (This is what currently makes the playhead feel inert.)
- **Deselect / Esc** → Monitor falls back to the playhead. Playhead is home base.
- **Click empty timeline / the ruler** → moves the playhead there + clears selection (scrub).
- **Double-click a clip** → "I'm here now": moves the playhead to it _and_ selects (on-demand snap —
  the bit of "follow" you actually want, on purpose).
- _NLE note:_ editors drive the preview from the playhead and use selection only for edit ops;
  Augur flipped that to "selection wins the Monitor," which is why an editor-brained tester feels
  friction. The peek cue reconciles the two without a rework.
- _Live-play payoff:_ the playhead is the cursor you nudge forward as the session moves, marking
  beats played as you pass them → feeds the recap.

## 3. Proposed v0.2 backlog (priority order)

| # | Item | Priority | Notes |
|---|------|----------|-------|
| 1 | New / Blank Vault — **seeded scaffold** (campaign + 1 example scene) | P0 | Unblocks creation; pairs with Save |
| 2 | "Load sample adventure" button (bundled Toadwallow) | P0 | One-click sample, no file hunting |
| 3 | Make Save discoverable + unsaved-changes cue | P0 | Falls out of #1 |
| 4 | ~~Per-instance **play notes — two fields**~~ DONE v0.2 | P1 | "What happened" (player-safe) + "GM notes" (private) per clip, editable in the Monitor read view (autosave); persists to localStorage + session JSON, round-trips on load. |
| 5 | ~~Recap — **GM** + **player-facing** versions~~ DONE v0.2 | P1 | View → Export Recap → chooser. GM = outcomes + GM notes + clocks/fires + "didn't get to". Player = outcomes only ("Previously…"), GM notes/clocks stripped. Both Markdown downloads. _(Note: download path may need native-bridge wiring in the Tauri build — verify.)_ |
| 6 | Tracks-as-contingencies: tutorial lesson + hover help | P1 | Fixes the "what are tracks for" gap |
| 7 | Time model: durations stay **soft & optional** (no toggle/buckets for v0.2) | P1 | Decided; main work is settable target (#13) |
| 8 | Inline click-to-edit polish (deferred from v0.1) | P2 | Edit in the Monitor, not just modal |
| 9 | ~~Magnetic/ripple timeline within a track~~ DONE v0.2 | P1 | Decided: **push-on-collision, gaps OK** (not zero-gap). Drag/trim a clip and same-track neighbors shove out of overlap (cascading); reversible (reset-to-originals each frame); Bag-drops push too. Tracks independent; clocks/overlays untouched. |
| 10 | Enlarge sequence expand-caret + hit area (hi-DPI) | P2 | Quick win |
| 11 | Playhead model (§2H): peek cue + snap gestures (Esc→playhead, click-empty→scrub, dbl-click→move+select) + clearer affordance | P1 | Makes the playhead feel active; "hold your spot" |
| 12 | Rename `tutorial.augur` → `toadwallow-bridge.augur` + ship as a real download | P1 | Clears the naming/"didn't come with it" confusion |
| 13 | Editable session target length (set/adjust in-app) | P1 | No control today; pairs with the time-model decision (§2E) |
| 14 | **Right-click "add element" menu** (Bag + empty timeline) | P1 | Lightweight creation; with scaffold (#1) likely replaces a dedicated vault editor |
| 15 | "Schedule a break" block | P3 | Deferred — possible bloat; just a generic timed block if ever wanted |
| 16 | ~~**Inline editing in the Monitor**~~ DONE v0.2 | P1 ↑ | Edit-mode ✎ toggle → full inline editor. **Now document-style (Obsidian-like):** label-less, borderless, auto-growing fields that match the read view (title as title, read-aloud as a box, headings + seamless prose), focus shows a left accent bar. Inline relations add/link/remove/＋new, rename, typed-delete. _Raw markdown markers still visible (Obsidian "source" feel); live-rendered editing = future #2._ Supersedes #8. |
| 17 | Replace native `prompt`/`confirm`/`alert` with themed in-app dialogs | P1 | The "127.0.0.1 says" browser dialogs look broken; done for target + delete, remaining ones (rename, durations, thresholds, emergent clip) still native |
| 18 | Edit / delete an entity **from the Bag** (right-click) + typed-DELETE confirm | P1 | DONE in v0.1.1 — was: could only edit via Monitor selection |
| 19 | ~~**BUG:** new scene clip resists drag/resize~~ FIXED v0.1.1 | P0 | Cause: a scene with no min/max duration → `expectedDur` = NaN → NaN-width clip. Fix: `createEntity` defaults scene duration (30–45 loose) + `expectedDur` is now NaN-proof. _Designer has ideas for a better duration UX — revisit._ |
| 21 | ~~**Inline references** (`[[id]]` links + `![[id]]` embeds)~~ DONE v0.2 | P1 | Right-click in a section → Insert reference → search/pick (or create) → drops a token at the cursor (link=chip, embed=full stat block/card) and auto-registers the formal relation. Read view renders tokens; also added bold/italic + escaping to prose. Single-pass token parse (no double-process). |
| 20 | **First-run onboarding for non-editors** — "what is this / why a timeline" before the panel tour | P1 | Pattern: editor-experienced testers got it cold; both non-editor testers needed the concept explained verbally first. Tour answers "what each panel is" before the user buys the "why." Candidate: a one-screen intro reusing the 10,000-ft framing, then the tour. |

## 4. Decisions (settled with the designer)

- **Time stance → soft & optional.** Use it or don't; it's nice-to-have info that mostly feels
  fine as-is. **No visibility toggle for now.** The one real gap is being able to **set the target
  time** (#13). So: keep durations + the readout, don't force them, skip the toggle/coarse-buckets
  work for v0.2. _Maybe later:_ a "schedule a break" block — flagged as possible bloat; deferred
  (and if wanted, it's just a generic timed block, not a whole feature). See item #15.
- **Creation model → lightweight, no heavy "vault editor."** Favor a **seeded scaffold** on New
  Vault (campaign + one example scene so you're not staring at a blank page) **plus a right-click
  "add element" menu** in the Bag / on empty timeline space. Together these likely **replace the
  need for a dedicated vault-editor screen** — which keeps the app lean (a stated value). The
  existing ＋New / edit modals stay as the underlying forms; right-click is the ergonomic entry.
- **Notes → per instance, two fields.** Notes attach to the clip/session, not the reusable scene
  entity, so scenes stay clean. Two fields (both GM-entered — the app is GM-facing):
  1. **"What happened" / Outcome** — player actions & results; **player-safe**, feeds _both_ recaps.
  2. **GM notes** — private planning / for-next-session; **GM recap only**.
  The player-facing recap is just "strip Secrets + GM notes, keep outcomes" — mirrors the existing
  GM-only `Secrets` section on scenes.
- **Playhead → anchor, not follow.** It "holds your spot"; selection is a transient peek. No
  snap-to-selection; instead add a "peeking / back to where you are" cue and snap gestures
  (Esc→playhead, click-empty→scrub, double-click→move+select). Full rationale in §2H.
- **Recap → both.** A **GM recap** (full game state: clocks, secrets, played beats + notes) _and_
  a **player-facing recap** that omits behind-the-screen content (secrets, GM notes). The player
  version is essentially the GM one with GM-only fields filtered out.

## 5. Distribution notes (from the v0.1 rollout)

- Installers built via GitHub Actions; Windows `.exe`/`.msi` + macOS universal `.dmg`.
- Both unsigned → SmartScreen (Win) / quarantine (`xattr -cr`) (Mac). See `TESTERS.md`.
- App is fully offline/local; no runtime network.
