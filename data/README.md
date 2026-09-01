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

## images/ — image manifests

Uploaded 2026-08-26. **Nothing reads these yet.** They are the raw inventory behind
`asset_manifest.json`, which does not exist, so V7 is still not enforced (F-04).

| File | Rows | Covers |
|---|---|---|
| `images/IMAGE_MANIFEST_extras.csv` | 60 | **Group 1 A-D.** `word,folder,file,path,width,height,bytes` |
| `images/IMAGE_MANIFEST.csv` | 189 | G2–G6. Adds `entry_id,slot` — binds each image to an entry and a word slot |
| `images/image_lookup.json` | 189 | G2–G6, keyed by word. Same word set as `IMAGE_MANIFEST.csv`, no `entry_id`/`slot` |

`IMAGE_MANIFEST_extras.csv` is the only one that touches G1: it covers all 36 imageIds
the current registry references, and 24 more that no G1 entry uses yet. The other two
files are for groups that have no registry data.

Note the manifests list image *metadata*. The `.webp` files themselves are not in this
repo, so a V13-style "does the file exist on disk" check is not possible for images the
way it is for audio.

### Known defects in the uploaded data

- `img/Group 5 Q-T/red.webp` is 208 bytes and `img/Group 6 U-Z/yellow.webp` is 438 bytes.
  Both are marked `OK`. A webp that small is almost certainly a broken or placeholder
  render, not a picture of anything.
- `U2-GI` has a `word1` (Ginger) and no `word2`. Every other entry in the manifest has both.
