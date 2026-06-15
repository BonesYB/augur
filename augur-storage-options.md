# Augur — Data & Storage Architecture: Options Compared

**Purpose:** Decide where a campaign's *truth* lives before defining a file format. Everything else — bundling, indexing, importing from Notion — is a layer on top of that one decision.

---

## The core question

A scene isn't just prose. It carries structured fields (duration range, ender strength) and **relationships** to NPCs, locations, clocks, and handouts that are shared across many scenes. So the question is:

> When the GM edits an NPC, where does that change *live*, and how do every scene that references her stay in sync?

Two honest answers compete:

1. **Files are the truth.** Each entity is a file the GM owns; the app reads and writes those files; relationships are references between them.
2. **A database is the truth.** The app owns a single database; files are only an import/export convenience.

The rest is layering. "Bundle it as one shareable file" and "keep a fast in-memory/SQLite index" are *not* separate storage models — they compose with whichever answer wins.

---

## Options at a glance

| Dimension | Markdown vault (files = truth) | JSON files (files = truth) | SQLite `.augur` (DB = truth) |
|---|---|---|---|
| GM owns / no lock-in | **Strong** | **Strong** | OK (one file, but opaque) |
| Edit outside the app | **Strong** | OK (clunky for prose) | **Weak** |
| Prose ergonomics (read-alouds) | **Strong** | Weak | OK (text, but not file-editable) |
| Relational integrity | OK (convention) | OK (convention) | **Strong** (enforced keys) |
| Round-trip editing fidelity | OK (needs discipline) | **Strong** | **Strong** |
| Share a campaign as one file | Weak* | Weak* | **Strong** |
| Git / readable diffs | **Strong** | OK (noisy) | **Weak** (binary) |
| Import existing content (Obsidian, etc.) | **Strong** | Weak | Weak |
| Build effort (in Tauri/Rust) | Medium | Low–Medium | Medium |

\* Solved by bundling the folder into a single `.augur` zip — see *Layers* below.

---

## The three, in brief

### Markdown vault — a folder of `.md` files, one per entity
Structured fields in YAML frontmatter, prose in the body, relationships as id references in frontmatter (`npcs: [morgantha]`) plus soft `[[wikilinks]]` in prose.

- **Why it fits Augur:** TTRPG prep is prose-first — read-alouds, descriptions, beats. Markdown is the natural home for that in a way no data format is. It's also exactly what the design doc already names as the deferred import target ("Markdown/Obsidian folders"), and it honors the "GM owns the data, no hidden system folders" principle. Existing Obsidian campaign vaults import almost for free.
- **Cost:** Referential integrity is *convention*, not enforced — a typo'd `npcs: [morgntha]` silently dangles until the app catches it. Round-trip editing must be disciplined so the app never clobbers the GM's prose.

### JSON files — one structured file per entity
Same "files are truth," but machine-shaped.

- **Why you might:** Trivial to parse and write back losslessly; no frontmatter/body split to get wrong.
- **Why not here:** Prose in JSON is miserable to author and read (`"readAloud": "Three figures...\n\n..."`), and editing outside the app is unpleasant. You'd lose the single biggest advantage of files — that a human can open and edit them anywhere. It buys round-trip safety at the cost of the thing that made files attractive.

### SQLite `.augur` — one database file the app owns
The design doc's stated MVP store.

- **Why it's tempting:** Enforced foreign keys (no dangling refs), fast complex queries, a single portable file to hand someone.
- **Why I'd not make it the *truth*:** Scenes stop "living as files." You can't crack one open in another editor, diff it in git, or hand a friend a single readable scene. At campaign scale (hundreds of entities, not millions) the performance argument is thin — parsing a whole vault into memory is sub-100ms. SQLite earns its keep as a *derived cache*, not as the source of truth.

---

## Layers (these compose with any choice)

- **Bundle → `.augur` (a zip of the vault).** Gives you the "single shareable file" that the folder lacks, while the contents stay plain Markdown — the way a `.docx` is a zip of XML. The app unzips to work, re-zips to save/share. You get folder-friendliness *and* one-file portability.
- **Derived index (in-memory, or SQLite if needed).** Build a fast lookup structure from the vault on load for live-run queries; treat it as disposable and rebuildable. Never edit it directly. At Augur's scale, a plain in-memory graph is likely enough and SQLite is optional.
- **Notion / external import.** Stays a *one-way importer that writes into the vault*, never the storage layer — exactly where the design doc placed it.

---

## Recommendation

**Markdown vault as the source of truth → optional `.augur` zip for sharing → in-memory index for runtime (SQLite only if scale ever demands it).**

This satisfies every requirement you named — scenes that live as importable files, relational data connected across items, in-app authoring/editing, and save/load — without taking on a hosted dependency or making the data opaque. It also collapses the "vault vs database vs bundle" choice into one layered architecture rather than three competing ones: the vault is truth, the zip is a transport, the index is a cache.

The genuine tradeoff you're accepting versus a SQLite-canonical design is **enforced referential integrity**. That's worth accepting because the mitigation is cheap and the upside (ownership, prose, portability, git, Obsidian import) is large.

---

## Risks to design against (these become rules in the format spec)

1. **Dangling references.** Frontmatter ids aren't enforced. → The app validates all references on load and surfaces a "broken links" report; a reference to a missing entity is a visible warning, not a silent failure.
2. **Round-trip fidelity.** App edits must not mangle the GM's prose. → Keep a clean split: the app owns frontmatter and a small set of recognized section headers; everything else in the body is preserved verbatim. Use a battle-tested frontmatter serializer, never hand-rolled string surgery.
3. **Id stability under rename.** If ids are filename slugs, renaming a file breaks references. → Use an explicit `id` field in frontmatter as the join key (independent of filename), so files can be renamed freely; a rename/refactor command can later update referrers.
4. **Two writers.** The GM edits a file in Obsidian while the app has it open. → Watch the folder for external changes and reconcile/reload; last-write-wins with a visible notice is fine for a single-user tool.

---

## What this implies for the next step (format spec)

The spec should pin down, per entity type (scene, sequence, clock, NPC, location, handout, creature, campaign):

- which fields live in **frontmatter** (structured + relations) vs **body** (prose sections),
- the **relation conventions** (id arrays in frontmatter; `[[wikilinks]]` in prose; how each resolves),
- **id/slug rules** (explicit `id`, stable under rename),
- **validation rules** (required fields, allowed enum values, reference checks),
- and the **folder layout** of a vault, plus how it bundles into `.augur`.

With that nailed, the sample vault and the folder-import path in the prototype build directly against it.
