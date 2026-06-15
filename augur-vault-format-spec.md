# Augur Vault Format — Specification v0.2

**Status:** Draft for build. (v0.2 adds the stat-block convention and the optional `item`, `table`, `trap`, and `quest` entity types — see the Addendum at the end.) Defines how a campaign's source content is stored as a Markdown vault and bundled into a portable `.augur` file. This is the contract the importer and (later) the in-app editor both build against.

**Design stance (from the storage decision):** the Markdown vault is the *source of truth*. Entity content is human-authored Markdown; per-session timeline state is machine JSON; the whole thing zips into one `.augur` for sharing. The app reads and writes these files; any database is a disposable index, never the truth.

---

## 1. Principles

1. **One file, one entity.** A scene, an NPC, a clock — each is its own file, referenced by others.
2. **Frontmatter is identity + structure + relations. The body is prose.** Short machine-shaped facts go in YAML frontmatter; everything a human writes at length (read-alouds, descriptions, beats) lives in the Markdown body under recognized headers.
3. **Relations are id references, not embedded copies.** Edit an NPC once; every scene that references her stays current.
4. **The app preserves what it doesn't understand.** Unknown frontmatter keys and unrecognized body sections round-trip untouched. This protects the GM's notes and keeps the format forward-compatible.
5. **Prose is never machine-shaped, and machine state is never prose-shaped.** Entities are Markdown; sessions/timelines are JSON.

---

## 2. Vault layout

```
my-campaign/                 # a vault is a folder…
  augur.json                 # manifest (format version, metadata)
  campaign.md                # campaign-level meta + overview
  scenes/        old-windmill.md, st-andrals-church.md, …
  sequences/     st-andrals-bones.md, …
  clocks/        the-bones-hunt.md, strahd-watches-ireena.md, …
  npcs/          morgantha.md, father-lucian.md, …
  locations/     vallaki.md, blue-water-inn.md, …
  handouts/      wanted-poster.md, …
  creatures/     night-hag.md, …
  sessions/      session-07.json    # timeline state (machine, not prose)
  assets/        wanted-poster.png, vallaki-map.jpg, …
```

`…/my-campaign.augur` is simply this folder zipped (see §11). The app can open **either** an unzipped folder **or** a `.augur` file — same structure inside.

---

## 3. Conventions shared by all entity files

### 3.1 Identity
- `id` — **required.** Lowercase kebab slug matching `^[a-z0-9][a-z0-9-]*$`, unique within its type. This is the join key.
- `type` — **required.** One of `scene | sequence | clock | npc | location | handout | creature | campaign`.
- The **filename should mirror the `id`** (`scenes/old-windmill.md`), but `id` is authoritative — files can be renamed freely without breaking references.

### 3.2 Relations
- A relation is a frontmatter key whose value is an array of ids of a known target type: `npcs: [morgantha, bella-sunbane]`. The target type is implied by the key, so ids are resolved against that type's folder.
- Order is preserved where it matters (e.g. `sequences.scenes`).
- A reference that doesn't resolve is a **warning, not an error** — the entity still loads, and the app surfaces a broken-links report.
- In the Monitor, every resolved reference renders as a clickable chip that opens a read-only card for that entity (NPC, location, item, trap, table, quest, creature). Cards show the entity's recognized sections plus its own relations as chips, so you can navigate the web of links at the table.

### 3.3 Prose body
- Prose lives under recognized level-2 headers (`## Read-aloud`). Each entity type below lists the headers the app maps to fields.
- Any header the app doesn't recognize, and any free text, is **preserved verbatim** and shown as "Notes" in the UI.
- `## Read-aloud` is the GM's own licensed text. Augur stores and displays it but never generates or reproduces it; an optional `source:` line (e.g. a page citation) may sit at the top of the section.

### 3.4 Soft links in prose
Inside body text, `[[id]]` (or `[[type:id]]` when ambiguous) is a soft mention. These power backlinks and "mentioned in" views but are **not** authoritative relations — the frontmatter arrays are. This keeps Obsidian-style writing natural while keeping the data model crisp.

### 3.5 Timestamps
- `updated` — ISO 8601, written by the app on save. Optional in hand-authored files.
- `created` — optional, ISO 8601.

---

## 4. Scene

```markdown
---
id: old-windmill
type: scene
title: The Old Windmill
duration: { min: 30, max: 140, confidence: loose }   # confidence: tight | loose
ender: true                                          # boolean flag — "can close a session" (optional). Legacy strong/usable/weak accepted as truthy.
stub: false                                          # true for emergent/unfleshed (optional)
npcs: [morgantha, bella-sunbane, offalia-wormwiggle]
locations: [windmill-moor]
clocks: [the-bones-hunt]
handouts: [dream-pastry-recipe]
creatures: [night-hag]
tags: [side-quest, horror]                           # optional, free-form
updated: 2026-06-14T20:00:00Z
---

## Purpose
Optional dungeon; hags & dream pastries.

## Read-aloud
> Three figures move behind the grimy windows, and the wind carries the smell of warm sugar across the rotting moor.

## Summary
A crumbling windmill on the moor. The Night Hags lure with sweet pastries baked from stolen children.

## Beats
- Approach & the smell of pastries
- Meeting the "old women"
- Discovering the cages above
- Hag combat or escape

## Sensory
Warm sugar over wet rot; floorboards that breathe; a child's lullaby from upstairs.

## If they…
- …eat a pastry → addiction hook; see [[the-bones-hunt]] pressure
- …attack early → hags scatter to mist form
```

**Recognized headers:** `Purpose`, `Read-aloud`, `Summary`, `Beats` (markdown list), `Sensory`, `If they…` (the reactivity reservoir), `Notes`.
**Required:** `id`, `type`, `title`, `duration`. Everything else optional.

---

## 5. Sequence

```markdown
---
id: st-andrals-bones
type: sequence
kind: distributed            # tight | distributed
title: St. Andral's Bones
scenes: [st-andrals-church, coffin-makers-shop]   # ordered
updated: 2026-06-14T20:00:00Z
---

## Summary
A thread whose beats interleave across sessions; often fired by a clock.
```

**Recognized headers:** `Summary`, `Notes`.
**Required:** `id`, `type`, `kind`, `title`, `scenes`. `scenes` ids must resolve and be unique.

---

## 6. Clock

```markdown
---
id: the-bones-hunt
type: clock
title: The Bones Hunt
scope: local                 # campaign | local
segments: 4
thresholds:
  - { at: 2, fires: run_beat, sequence: st-andrals-bones }
  - { at: 4, fires: world_state, note: "The buyer flees Vallaki with the stolen bones." }
updated: 2026-06-14T20:00:00Z
---

## Summary
Each tick, the coffin maker's buyer grows bolder.
```

**Required:** `id`, `type`, `title`, `segments`. `thresholds` optional but each must satisfy: `1 ≤ at ≤ segments`; `fires` ∈ `{run_beat, world_state}`; `run_beat` requires a `sequence` that resolves; `world_state` requires a `note`.

---

## 7. NPC

```markdown
---
id: morgantha
type: npc
title: Morgantha
affiliations: [The Windmill Coven]   # optional, free-text list → shown as chips
locations: [windmill-moor, vallaki]
creatures: [night-hag]       # optional combat stat block
tags: [hag, villain]
updated: 2026-06-14T20:00:00Z
---

## Description
A stooped pastry-seller with too many teeth.

## Voice
Grandmotherly, sing-song; calls everyone "dearie."

## Goals
Harvest dream-essence from Barovia's children.

## Mood
Falsely warm; impatient under the sweetness.

## Secrets
One of three Night Hags; coven hides in the windmill.
```

**Recognized headers:** `Description`, `Voice`, `Goals`, `Mood`, `Secrets`, `Notes`. **Optional frontmatter:** `affiliations` (free-text list). **Required:** `id`, `type`, `title`. In the app, NPC chips in the Monitor are clickable: they open a read-only card showing description, voice, goals, mood, affiliations, linked locations, and GM-only secrets, with an Edit shortcut.

---

## 8. Location

```markdown
---
id: blue-water-inn
type: location
title: Blue Water Inn
parent: vallaki              # parent/sublocation tree (optional)
npcs: [urwin-martikov, rictavio]
handouts: [vallaki-map]
updated: 2026-06-14T20:00:00Z
---

## Description
The warmest room in Vallaki.

## Read-aloud
> A fire crackles. A wiry man in a red coat winks at you over the rim of a tankard.
```

**Recognized headers:** `Description`, `Read-aloud`, `Notes`. **Required:** `id`, `type`, `title`. `parent` (if present) must resolve and the tree must be acyclic.

---

## 9. Handout & Creature

**Handout** — player-facing artifact (image and/or text).
```markdown
---
id: vallaki-map
type: handout
title: Map of Vallaki
kind: map                    # image | text | map  (optional)
image: assets/vallaki-map.jpg   # path relative to vault root (optional)
updated: 2026-06-14T20:00:00Z
---

Body text rendered to players (rumors printed on the back, etc.).
```

**Creature** — a stat block, SRD-resolved or custom.
```markdown
---
id: night-hag
type: creature
title: Night Hag
srd: night-hag               # optional: resolve from SRD; omit for fully custom
cr: 5                        # inline fields only needed for custom creatures
updated: 2026-06-14T20:00:00Z
---

## Notes
Coven of three shares Nightmare Haunting.
```
If `srd` is present the app resolves the full block from its SRD bestiary (the prototype's existing behavior); otherwise the body carries the custom block. Stat-block body format is an **open question** (§12).

---

## 10. Campaign file & Session files

**`campaign.md`** — vault metadata + overview.
```markdown
---
id: curse-of-strahd
type: campaign
title: Curse of Strahd — Tuesday Group
system: "5e"                 # optional; Augur is system-agnostic
created: 2026-01-10T00:00:00Z
updated: 2026-06-14T20:00:00Z
---

## Overview
Gothic horror in Barovia.
```

**`sessions/<id>.json`** — timeline state. This is machine state (positions, indices, statuses), so it is **JSON, not Markdown** — round-trip-safe and never hand-edited for prose.
```json
{
  "id": "session-07",
  "type": "session",
  "title": "Session 7 — Vallaki Nightfall",
  "targetDurationMinutes": 210,
  "playheadMinutes": 35,
  "clips": [
    { "id": "c1", "sourceType": "sequence", "sourceId": "st-andrals-bones",
      "label": null, "startMinutes": 95, "displayDurationMinutes": 80,
      "trackIndex": 0, "stackIndex": 0, "status": "planned", "collapsed": true },
    { "id": "c6", "sourceType": "clock", "sourceId": "the-bones-hunt",
      "startMinutes": 95, "displayDurationMinutes": 110, "trackIndex": 3,
      "isOverlay": true, "filled": 2 }
  ],
  "fires": [
    { "id": "f1", "clockClipId": "c6", "clockId": "the-bones-hunt",
      "at": 2, "flavor": "run_beat", "sequence": "st-andrals-bones", "atMinutes": 35 }
  ],
  "updated": "2026-06-14T20:00:00Z"
}
```
A clip's `sourceId` resolves into the vault; `status` ∈ `{planned, played}` (current prototype model); `filled`/`fires` carry clock runtime state.

---

## 11. Manifest & the `.augur` bundle

**`augur.json`** at the vault root:
```json
{ "formatVersion": "0.1", "augurVersion": "0.x", "title": "Curse of Strahd — Tuesday Group",
  "created": "2026-01-10T00:00:00Z", "updated": "2026-06-14T20:00:00Z" }
```

**`.augur`** is the vault folder zipped (DEFLATE), with `augur.json` and `campaign.md` at the archive root. The app:
- **Opens** a `.augur` by reading it (in memory or an extracted working copy).
- **Saves** by writing the vault back and re-zipping.
- Treats an unzipped folder and a `.augur` as equivalent inputs.

Because the archive is just zipped Markdown + JSON + images, a `.augur` stays inspectable (rename to `.zip`, open) and diff-friendly when unpacked — single-file portability without giving up transparency.

---

## 12. Validation rules (consolidated)

Run on import; surface results as a report.

**Errors (entity skipped, reported):**
- Missing required field for the type, or `id` not matching the slug pattern, or duplicate `id` within a type.
- Enum value out of range (`confidence`, `kind`, `scope`, `fires`, clip `status`). (`ender` is a free boolean flag — not validated.)
- `duration.min > duration.max`, or non-positive durations.
- Clock threshold `at` outside `1…segments`; `run_beat` without `sequence`; `world_state` without `note`.

**Warnings (entity loads, reference flagged):**
- Any relation id that doesn't resolve to an existing entity of the expected type.
- `sequence.scenes` containing a missing or duplicate id.
- `location.parent` cycle.
- Image `image:` path not found under `assets/`.

---

## 13. Versioning & forward-compatibility

- `formatVersion` lives in `augur.json`. Additive changes bump the minor version; breaking changes bump major and ship a migration note.
- Unknown frontmatter keys and unrecognized body sections are preserved on round-trip, so older vaults open in newer apps and hand-added GM fields survive editing.

---

## 14. Open questions (resolve as we build)

1. **Stat-block body format.** RESOLVED — `srd:` for stock monsters, a `## Statblock` Markdown body for custom (see Addendum). The full **SRD 5.2 (2024)** bestiary (330 monsters, CC-BY-4.0) is now bundled as `srd-bestiary.js`; `srd:` ids render full stats. (Magic items from SRD 5.2 can be bundled the same way once items are first-class.)
2. **Sequence nesting.** Allow a sequence to contain sequences? Deferred; flat for now.
3. **Map/pin data.** Coordinates for a future map view on `location`/`handout`. Deferred.
4. **Read-aloud provenance.** A standard `source:` citation format (book + page) that records where licensed text came from without reproducing it.
5. **Multi-campaign linking.** Sharing an NPC/creature across campaigns — a shared library vault? Deferred.

---

## Addendum (v0.2) — Stat blocks, items, tables, traps, quests

### Creatures / stat blocks
A `creature` is stock, custom, or both:
- **Stock:** `srd: giant-centipede` resolves the full block from the bundled **SRD 5.2 (2024)** bestiary (`srd-bestiary.js`, 330 monsters, CC-BY-4.0, loaded as a `<script>` global so it works offline). If an id isn't in the bundle, the app shows the reference + your `## Notes`.
- **Custom:** put the block in a `## Statblock` body section as plain Markdown — bold (`**X**`), bold-italic action names (`***X.***`), `###` headings (Actions, Reactions, Legendary), and a pipe table for the ability scores all render. Optional frontmatter `cr` (and any other at-a-glance fields) sit alongside.
- Scenes reference creatures with `creatures: [id, …]`; the Monitor shows each one's stat block inline when the scene is up.

```markdown
---
id: giant-inferno-spider
type: creature
title: Giant Inferno Spider
cr: 1
---
## Statblock
**Giant Inferno Spider**
*Large monstrosity, unaligned*

- **Armor Class** 14 (natural armor)
- **Hit Points** 32 (5d10 + 5)

| STR | DEX | CON | INT | WIS | CHA |
|-----|-----|-----|-----|-----|-----|
| 14 (+2) | 14 (+2) | 12 (+1) | 2 (-4) | 11 (+0) | 4 (-3) |

### Actions
***Flaming Bite.*** *Melee Weapon Attack:* +5 to hit … 7 (2d6) fire damage on a fail.
```

### Loot — items + treasure
Two complementary ways, both optional:
- **Reusable `item` entity** (`items/flame-tongue.md`): frontmatter `rarity` (common…artifact), optional `attunement`; body `## Description`. Referenced by `items: [id, …]` on scenes/creatures/locations so the same item shows wherever it appears.
- **Per-scene treasure prose:** a `## Treasure` (or `## Loot`) section on a scene for gold and mundane drops. (Either is fine; you can also keep loot inside `## If they…` as free prose, as in the sample one-shot.)

### Other optional types
- **`table`** (`tables/rumors.md`): a random table you roll on — title + a Markdown table/list in the body. Referenced by `tables: […]`.
- **`trap`** (`traps/pit.md`): trigger/effect/DCs in the body (recognized `## Trigger`, `## Effect`); optional `creatures:` relation. Referenced by `traps: […]`.
- **`quest`** (`quests/clear-the-cellar.md`): an objective; optional `scenes:` relation to where it advances. Referenced by `quests: […]`.

All four are **optional** — a vault may use none of them, and scenes only carry the relations that apply. Validation requires just `id`, `type`, `title`; unknown rarities and dangling references are warnings, not errors.
