# data/

## Audio model B — one file per clip

Ratified 2026-08-18. Every clip is its own MP3 under `public/audio/group1/`.
Playback is "play this file". There are no cue points, no offsets, and nothing
to seek. `clip(id, role)` returns a file or `null`; `null` is a normal answer.

The clip table is **`src/data/group1_clips.json`** — the same file the app loads
and the one verified serving 200 in production (P0-E3-S2). The generator reads it
directly rather than keeping a second copy under `data/`, because two copies of
one table drift and only one of them deploys.

## Files

| Path | Read by the build? | What it is |
|---|---|---|
| `group1_entries.json` | yes | Curriculum entries: IDs, shapes, parts, words, declared media config |
| `fixtures/unit_fixture_per_item.json` | yes (`--fixtures`) | Shape coverage in the reserved `UF-` namespace. Never ships — V9 fails the build if a `UF-*` id reaches production output |
| `../src/data/group1_clips.json` | yes | The clip table. Authoritative |
| `asset_manifest.json` | when present | Image manifest. Absent today, so V7 is not enforced — blocked on P0-E3 (F-04) |
| `provenance/Group1_Cue_Points.csv` | **no** | Historical. See below |

## provenance/Group1_Cue_Points.csv

This is the cue table from the superseded offset model, where one `<id>.m4a` per
entry was carved into three clips by `anchor`/`word1`/`word2` offsets. **Nothing
reads it.** It is kept only because its `src_start`/`src_end` columns record where
in the original session recording each cut came from — the one piece of
information the per-clip files do not carry.

Do not wire it back into the build. If a future story needs source offsets, read
them from here as provenance; do not reintroduce runtime seeking.
