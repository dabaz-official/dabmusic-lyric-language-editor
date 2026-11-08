# Rebuild progress

dablrc was an LRC editor: paste lines, stamp each line's start, export `.lrc`.
It is now a DMLL editor for DabMusic: paste the lyrics (plain, LRC or DMLL),
open the track, tap each word, and export the `.dmll` that sits next to the
audio in `public/music/<album>/`.

The PRs below are squash-merged into `master`. Every remote branch was kept. The
old pages, the shadcn components and the LRC-only parser are gone from `master`;
`git show 99beb77` still has them.

| PR | Commit | Branch | What landed |
| --- | --- | --- | --- |
| #1 | `a5d2803` | `dmll-editor` | The DMLL editor, start to finish |
| #2 | `975e6c6` | `slow-playback` | 0.5× / 0.75× playback |
| #3 | `5c516ea` | `fix-last-word` | Ends the last word when no word is left |
| #4 | `67f87e5` | `timed-highlight` | Timed words and lines are blue |
| #5 | `3e30ccd` | `rename-site` | Renamed the site, added `metadataBase` |
| #6 | `95f36a1` | `word-edit` | Edit a word in place without losing its timing |
| #7 | `49333b8` | `waveform` | Waveform with a following, zoomable window |
| #8 | `6da0176` | `album-folder` | Open an album folder and write the lyric file back |
| #9 | `aa8854f` | `format-fidelity` | Keep comments, tags and repeated timestamps |
| #10 | `9d8a0ea` | `hold-touch` | Hold-to-sing, touch pad and narrow-screen rows |
| #11 | `716e86e` | `focus-editor` | The single-line Focus editor, with Legacy kept |
| #12 | `c80d154` | `tabs-editor` | Rebuilt as Edit, Line and Word tabs; Legacy kept at `?view=legacy` |
| #13 | `48af83b` | `edit-margins` | Edit tab aligned with the header margins |
| #14 | `6062c81` | `line-step-buttons` | Line step chevrons, row side/role toggles, header-aligned margins |
| #15 | `00289b3` | `line-nudge-seek` | Line ± nudge moves the playhead to the adjusted time |
| #16 | `d188ec9` | `word-rail-position` | Position-based Word rail across the whole line |

## Why a rewrite

The old editor parsed only `[mm:ss.xx] text`, stamped whole lines, and wrote
`.lrc`. DabMusic now reads DMLL with word-level timing (`docs/dmll-format.md`
there), and word timing is what makes the Apple-style sweep work, so line-level
editing could not produce the files the site renders.

The format rules are not guessed: `src/lib/dmll/parse.ts` is a port of
DabMusic's `src/lib/lrc.ts`, the reader the site actually runs, and
`docs/dmll-format.md` is the spec. That keeps the editor and the site agreeing
on what a file means.

## Done

### Stack

- [x] Matches DabMusic: Next 16.4.3 (App Router, `src/`, `@/*`), React 19.3.1,
      Tailwind 4.3.3 through `@tailwindcss/turbopack`, TypeScript 6.0.3, ESLint
      10 flat config with `eslint-config-next` 16.4.3, `@types/node` 24, pnpm
      12.14.0.
- [x] `pnpm-workspace.yaml` sets `allowBuilds: unrs-resolver: false`, the same
      supply-chain policy DabMusic uses; pnpm 12 refuses to install without it.
- [x] TypeScript and Tailwind are pinned to the versions in DabMusic's
      lockfile. A fresh `pnpm install` had resolved `tailwindcss` to 4.1.13
      while `@tailwindcss/turbopack` pulled 4.3.3, which would have run two
      copies of the engine.
- [x] Inter Variable vendored in `src/app/fonts/` through `next/font/local`
      (the same file and OFL licence as DabMusic); semantic colour tokens
      mirrored from its `globals.css` (light and dark), including the approved
      functional colours and the focus ring.
- [x] Tests: vitest 5.0.5, which DabMusic does not have. 112 cases in 12 files.

### Format core

Pure TypeScript in `src/lib/dmll/`, no React:

- `types.ts`: `Token`, `LyricEntry`, `AdlibEntry`, `BlankEntry`, `Lyrics`.
- `time.ts`: `mm:ss.xx` formatting and rounding to the centisecond.
- `tokenize.ts`: Latin words split on spaces with the space kept at the end,
  CJK runs one character per token, punctuation stays with the word before it.
- `parse.ts`: plain lines, line timestamps, `{start~end}` word tokens, text
  before the first token, multiple timestamps (each copy gets the words shifted
  by its offset), `[v:left|right]`, `[ad:]`, blank rows, comments, metadata, the
  legacy `>> a | b` duet form, and a byte-order mark. Anything else that looks
  like plain LRC still parses.
- `serialize.ts`: `[dmll:1]`, voice directives only where the side changes,
  word tokens only when every word of the line is timed, ad-libs as `[ad:]`
  when the line above is timed and as plain text when it is not. `toLrcText`
  writes the same lines with timestamps but without word tokens, for the edit
  box.
- `merge.ts`: keeps timing across text edits (see "Resolved decisions").
- `sync.ts`: the sync state machine, as a pure reducer with undo history.
- `model.ts`: line helpers, voice resolution, `summarize` for the status bar.

### Editor

One page, `src/app/page.tsx` to `components/editor/lyrics-editor.tsx`
(now `legacy-editor.tsx`; the tab editor is the default since PR #12), with:

- Top bar: audio, import, export, theme. Import accepts `.dmll`, `.lrc`, `.txt`;
  export writes `.dmll` named after the imported file or the audio.
- Lyrics panel: paste or edit as plain text or as LRC-shaped text. Applying
  always merges, never replaces.
- Line list: one row per line, ad-libs indented, voice toggle, ad-lib toggle,
  timestamp (click to seek), per-word spans, clear-timing.
- Status bar: counts, "Estimate N lines" when line-level timing exists, Undo,
  Edit lyrics, Clear.
- Transport: play/pause, ±2 s, waveform seek (8 s / 20 s / whole track), Word/Line
  mode, speed, key hints.
- Drafts persist in `localStorage` under `dablrc.draft`; the audio does not, so
  it has to be opened again after a reload.

Keys (`event.code`, so they work on any layout): `Space` taps, `Shift+Space`
ends the current word early, `Enter` ends the line, `Backspace`/`Cmd+Z` undoes,
`P` plays, arrows seek 2 s (Shift: 10 s), `S`/`E` restamp the selected word,
`,` `.` `;` `'` nudge it 10 ms (Shift: 100 ms), `[` `]` step the speed.

### Slow playback (PR #2)

- `0.5×`, `0.75×`, `1×`, by button or `[` `]`; `src/lib/playback.ts` holds the
  list and the clamped stepping.
- The playhead is media time at any rate, so taps record the song position, not
  wall time. At `0.5×` a tap is twice as precise in wall time, which is the
  point for rap.
- Pitch is preserved, so words stay recognisable; the rate is re-applied when a
  new source loads, and changing it never moves the playhead.

### Last word (PR #3)

A tap with no next word used to do nothing, so the last word of a line, and the
only word of a one-word line, stayed open: the status bar said "partly timed"
and the export fell back to line-level timing. That tap now ends the open word;
`Enter` still ends the line and moves on. A line with nothing left to stamp
shows an `Enter ↵` hint.

### Timed highlighting (PR #4)

- Word mode: a word with a time is blue, an untimed word gray. The word being
  sung, or one that has started but not ended, also carries a pale blue wash.
- Line mode: the whole line is blue once it has a timestamp.
- Tokens in `globals.css`: `--dz-color-timed` / `--dz-color-timed-subtle`,
  light `#1d4ed8` on `#e8efff`, dark `#8ab4ff` on `#1b2a42`.
- Contrast: 6.7:1 on white, 7.9:1 on the dark page background `#1f1f1f`; both
  clear WCAG AA for normal text. The blue is distinct from the focus blue
  `#4c89ef` used for the cursor underline and the selected ring.

### Name and metadata (PR #5)

- The site is **DabMusic Lyric Language Editor**. The tab title is that name,
  and a page title would read `%s | DabMusic Lyric Language Editor`.
- The top bar shows the full name only from `md` up; below that the logo alone
  carries the brand, because the wordmark would crowd out the audio file name.
  The logo images are decorative, since the wordmark names the site.
- `metadataBase` is `https://dmll.dabaz.me`, so the Open Graph image resolves to
  an absolute URL and `next build` no longer warns about it.
- The draft key is still `dablrc.draft`. Renaming it would throw away every
  draft already in a browser, so the old name stays there on purpose.

### Editing a word (PR #6)

Editing text used to mean the LRC-shaped panel, which has no word tokens, so
`mergeLyrics` dropped the line's word timing as soon as the wording changed: a
typo fix cost a whole line of synced words.

- Double-click a word, or select it and press `F2`, to edit it in place. `Enter`
  or blur saves, `Esc` cancels.
- `src/lib/dmll/edit.ts` re-splits the typed text with `tokenize()`. One word
  keeps its start and end exactly; several words split that span in proportion
  to their length, the same way `estimate` spreads a line. An untimed word stays
  untimed, and a word that had only started keeps its start on the first word.
- The spacing invariant holds: a word keeps the space that followed it, and the
  last word of a line keeps none, so Latin and CJK lines still join back exactly.
- `setTokenText` is a recorded action, so one undo restores the old text and
  timing together. The cursor and the selected word move with the words that
  were added.
- Keys are read by `event.code`, with `event.key` as the fallback when a source
  sends no code (automation and some assistive input do not).

### Waveform (PR #7)

Finding a word boundary used to be ear-only: the transport had a time readout and
a range slider, and a four-minute track across 1000 px puts 1 px at 0.24 s, far
too coarse for a 100 ms gap.

- `src/lib/waveform.ts` reduces samples to peaks — the loudest absolute sample of
  each slice, normalised to the track's own maximum, the same shape as DabMusic's
  `*.waveform.json`. `peaksInRange` groups the stored peaks into the bars a window
  draws, so zooming costs no extra decoding.
- `use-waveform.ts` decodes the opened file in a separate `AudioContext` at 8 kHz,
  mixes to mono and keeps 12,000 peaks. It never touches the `<audio>` element, so
  playback, time and rate are unaffected, and a failed decode only costs the
  picture.
- `waveform.tsx` draws the peaks, the playhead and a tick for every timed line.
  The window follows the playhead: 8 s by default, 20 s, or the whole track.
  Click or drag seeks; arrows, Home and End work when it has focus.
- Colours come from the existing tokens (`text-tertiary` for the unplayed bars,
  `text-primary` for the played part, `focus` for the playhead and the active
  line's tick). A class observer redraws after next-themes switches, because the
  tokens are read from the DOM at draw time.
- The fixed footer now reports its height, and the page reserves exactly that much
  space instead of the old fixed `pb-44`, so a taller footer cannot cover a line.
- Rows that are not singing keep the previous `time` value, so the per-frame
  playhead update no longer re-renders every row.

### Album folder (PR #8)

The last manual step was moving the exported file into `public/music/<album>/`
and adding `dmll` to `album.json`. A wrong name, or a forgotten manifest edit,
leaves the file present but unused.

- `src/lib/album.ts` reads the manifest (only `tracks[].file` is required), finds
  a track, picks the lyric file it already names (`dmll` before `lrc`), and
  writes the manifest back with the line endings and trailing newline it had.
- `Save to album` writes `<audio stem>.dmll` (or the name the track already
  lists) and sets `dmll` on the track. A track that listed `lrc` has that key
  dropped, because the site refuses a track with both; the old `.lrc` file is
  left on disk, unlisted and harmless.
- `use-album.ts` uses `showDirectoryPicker` and keeps the handle in IndexedDB, so
  a later visit either reopens the folder directly, when the browser still
  grants it, or offers one click to re-allow it.
- The album bar shows the album's title, its tracks and which one is being
  edited. `Save` is enabled only while the open audio is the selected track, so
  a save cannot land on the wrong file.
- Chrome and Edge on desktop only. Without the API the button says so, and the
  manual export/import path still works.### Format fidelity (PR #9)

Import used to drop `//` comments, `[ar:]`-style tags and the multi-timestamp
form, so a file edited here came back shorter than the one DabMusic wrote.

- `Entry` gained `comment` and `meta` kinds, and `isLine` now names the two line
  kinds instead of meaning "not blank". Comments and
  `ar|ti|al|by|re|ve|length|offset` tags are kept in file order and written back
  unchanged; `[dmll:*]` is still regenerated, since the writer owns the header.
- `[offset:]` is preserved but not applied, which is what the site does. Keeping
  it means the file still means the same thing outside this editor.
- A line with several timestamps still becomes one entry per timestamp, but the
  copies carry a shared `group` id. The writer puts them back on one line while
  every copy has the same words at the same offsets; editing any copy's words or
  times separates them into valid single lines instead of guessing.
- `mergeLyrics` takes the group from the new text, so re-pasting or editing
  through the panel keeps the structure.
- The lyric list shows comments as dim italic rows and hides metadata tags.
  Neither counts as a line, so numbering, voices and ad-lib parents are
  unchanged.

### Hold, touch and narrow screens (PR #10)

- `Hold` in the transport turns `Space` into a press-and-release gesture: down
  starts the word, up ends it, and a window blur ends it too, so a lost focus
  does not leave a word open. `Shift+Space` still ends the word early.
- Below `sm`, the transport shows `Tap`, `End word`, `End line` and `Undo`
  buttons (`src/components/editor/sync-pad.tsx`). `Tap` supports hold the same
  way. A phone has no keyboard, so without this there was no way to stamp a word
  at all.
- A lyric row below `sm` puts the words on their own line with the controls
  (side, ad-lib, timestamp, clear) beneath them, and the line number moves down
  with the controls. Targets are 44 px and the clear button is always visible,
  because a hover-only control cannot be reached with a finger.
- The key hints are hidden below `sm`, and the footer pads for the iPhone home
  bar. Word buttons use `touch-action: manipulation`, so a double tap does not
  zoom while editing.

### Single-line focus editor (PR #11)

The list editor is precise but, on a phone, syncing a line means moving the eyes
between the list, the transport and the waveform. The Focus view shows one line
centred on a large stage with a tall waveform underneath, so the line, the
marker and the audio are in one place.

- `src/components/editor/use-editor.ts` now owns the shared session: the sync
  history, playback, waveform, album folder, draft, mode and every action. The
  shell (`editor-shell.tsx`) renders the top bar, album bar, the selected view
  and the single `<audio>` element, so switching views keeps the track loaded,
  the playhead and the undo history.
- The top bar has a `Focus` / `Legacy` switch. `?view=legacy` opens the list
  editor directly; the switch updates the query with `replaceState`, without a
  navigation. Focus is the default.
- `focus-editor.tsx` shows only the active line (`focus-line.tsx`): 24 px on
  phones and 32/40 px above `sm`, with the line number, a timed-word blue and a
  pale wash on the word being sung. In word mode the words are buttons, so a
  word can be picked and re-timed; in line mode the whole line is coloured.
- The waveform is 112 px tall with a 12 px tick strip and a knob at the marker.
  Pointer drag and click seek live and freeze the 8 s window for the gesture;
  the `8s` / `20s` / `All` buttons set the span. Letting go commits at the
  pointer time. The former list waveform keeps its 56 px defaults.
- Committing reuses the existing reducer: line mode uses `tap`, word mode uses
  `tap` (ending the previous word and starting the picked one), and the commit
  after the last word uses `closeLine`. A drag or an Enter is one undo step.
  The focus index is the first word without a start; when every word has one,
  the next commit ends the line. A fully timed line opens at its end, where the
  primary button is `Next line`; clicking a word re-times it.
- Desktop keys are the drag equivalent: `←` / `→` nudge the marker by 10 ms
  (Shift 100 ms) and seek with it, `Enter` commits and advances, `Space` plays,
  `↑` / `↓` change line, `Backspace` / `Cmd+Z` undoes and `[` / `]` change the
  speed. The legacy key map is untouched. A drag pauses playback; the `Sync`
  button while playing does not, so it can be tapped along with the song.
- Opening a track seeds the playhead at the active line's timestamp instead of
  0, so an existing timed line starts in view. Switching views does not move it.
- Mobile targets are 44 px: the icon buttons, the mode and speed pills, the
  span pills and the words themselves. The dock uses the safe-area inset and
  the page has no horizontal overflow at 390 px.
- No parser, serializer, merge or format change. Both views produce the same
  DMLL; the draft key is still `dablrc.draft`.

### Three-tab rebuild (PR #12)

PR #11's Focus view was replaced with a Musixmatch-style three-tab editor. The
list editor remains as Legacy at `?view=legacy`; the new header does not link to
it, and the Legacy header's `Editor` button comes back without a reload.

- **Header** (`editor-header.tsx`): logo and track name; `Edit` / `Line` / `Word`
  tablist (arrow keys); audio upload, `.dmll` upload and a download-only export;
  the existing theme toggle. On phones the logo/actions are one row and the tabs
  are a second row; every control is at least 44 px.
- **Edit** (`edit-tab.tsx`): a full-height plain-text textarea. Comments and
  `[ar:]` tags are ordinary lines. Applying trims every line, then
  `parseLyrics` + `mergeLyrics`; a debounce, blur and tab change all apply.
  `mergeLyrics` gained a positional pass for equal-length files: a wording edit
  keeps its line timestamp, side and ad-lib role (word timing still goes).
- **Line** (`line-tab.tsx`, `line-row.tsx`): the per-line time chip
  (`X`, `mm:ss.xx`, `-`, `+` at 0.1 s), play-from-line, the words, a blue
  playhead highlight, and an `End of lyrics` row. `-`/`+` shift the line and all
  its words together. Clicking an untimed timestamp stamps it at the playhead.
  End of lyrics is the last line's last word `end`, the only end DMLL stores.
  The standard player has play/pause, a seek bar, and ±3 s.
- **Word** (`word-tab.tsx`, `word-line.tsx`, `word-slider.tsx`): one centred
  line and a forward-only rail with one dot per word and a long pill.
  `word-sync.ts` turns the drag samples into timings: each word slot entered
  takes the current **media time** as its start, the previous word ends there,
  and a jump over slots interpolates. Playing uses the audio clock; paused uses
  a linear map from the line start to its end. The line start comes from the
  first word if it had none. A release finalizes the current word; reaching the
  right end completes the line and activates the next one. The rail never moves
  left. `Back` / `Play` / `Slow` (0.5×/1×) are large lucide controls; the rate
  returns to 1× on a tab change. Keyboard: `→` steps a word, `Enter` commits.
- **Player** (`player.tsx`): Edit and Line share it; the Word tab has its own
  three controls. `use-player-keys.ts` gives Space and Cmd/Ctrl+Z outside the
  textarea.
- **Shell**: `?view=legacy` chooses the Legacy header, album bar and list;
  otherwise `TabsEditor`. Both share one `useEditor` session and one `<audio>`.
  `useEditor` no longer decodes the waveform; only the Legacy view calls
  `useWaveform`.
- The old `focus-editor.tsx`, `focus-line.tsx` and `use-focus-keys.ts` are gone.
  No new tokens: the highlight and Word pill use the approved `timed` /
  `timed-subtle` blue, not Musixmatch purple.

### Line step controls and row toggles (PR #14)

- Above the Line player are two chevrons. Down stamps the next line at the
  playhead and activates it; up clears the highlighted line's timing and
  activates the previous one. "Current" is `currentLineIndex`, the row the
  playhead highlights. Down uses `setLineStart` (an existing line and its words
  shift together); up uses `clearTiming`. Both work without audio; down then
  uses the 0 playhead.
- At the right of each Line row: an `L`/`R` side toggle (`toggleVoice`) and a
  `Lyric`/`Ad-lib` role toggle (`toggleAdlib`). New lines are left/lyric. An
  ad-lib inherits the side of the lyric above, so its side button is read-only.
  The first lyric line has no parent, so its role button is disabled. The
  labels show the current state, not the next action.
- The Line list now uses the header's `max-w-6xl px-3 md:px-4`, so its rows
  start and end at the Edit card and header content edges (80–1200 at 1280,
  12–378 at 390). The chevrons are capped at `max-w-lg` (250 px each at 1280)
  and sit centred above the player.
- No new reducer actions or tokens: the toggles use `toggleVoice`/
  `toggleAdlib`, and the steps use the existing line/timing actions.

Verified: `pnpm typecheck`, `pnpm lint`, `pnpm build`; at 1280 the row and
header edges are 80–1200, at 390 12–378; the chevrons measured 250×56; the step
sequence set alpha/beta/gamma at 1.00/2.00/3.00, and up cleared gamma and
returned to beta at 2.00; the row toggles changed beta L→R, lyric→ad-lib (side
inherited and read-only) and back to lyric; the first line's role button stayed
disabled.

### Nudge follows the playhead (PR #15)

- A Line row's `-`/`+` now computes the new line start (clamped and rounded),
  dispatches `shiftLine`, then seeks to that start. The `End of lyrics` `-`/`+`
  computes the new end, dispatches `nudgeTokenEnd`, then seeks to that end. The
  playhead follows the adjusted time, so the row, its highlight and the audio
  stay in step.
- No reducer, format or token change; the work is in `line-tab.tsx`.
- Verified: a line set to `03.21` with `-` became `03.11` and the audio
  `03.11`; `+` returned both to `03.21`. An `End of lyrics` at `03.50` with
  `+` became `03.60` and the audio `03.60`. `pnpm typecheck`, `pnpm lint`,
  `pnpm test` and `pnpm build` pass.

### Position-based Word rail (PR #16)

- The Word rail is the whole line. `wordBoundaries()` in `word-sync.ts` gives
  every word a segment proportional to its trimmed text length; the rail's left
  is the line start and its right is the line end (last word end or next line
  start; the track duration is a fallback). One dot marks each word's start;
  the last word's end is the right edge.
- The cursor's position maps linearly to the line's time. Crossing a word's
  start boundary ends the previous word and starts the next at that mapped
  time; a jump interpolates; the last word ends at the right edge. The audio
  clock is no longer used for the timing; Play and Slow are listening aids.
- The pill is a long handle whose centre follows the cursor (56–96 px, no longer
  one word wide). The drag still only moves right, and a release is one undo
  step. Reaching the right edge completes the line and advances.
- `wordIndexAt()` now takes the boundary list; `syncWordTimings()` crosses the
  same fractional boundaries. The tests cover the proportional split, jumps,
  the monotonic clamp and early releases: 109 cases in 12 files.
- Verified at 1280: imported `[00:01.00] alpha beta` and `[00:04.00] gamma
  delta`; dragging the rail from left to right gave alpha `1.00–2.67` and beta
  `2.67–4.00` (the 5/9 text-length boundary), then advanced to the next line.
  The rail showed `01.00`/`04.00`, two start dots and a ~90 px pill.

### Manual line end (PR #17)

The only end DMLL stores is the last word's `end`, and the Line tab could only
edit that for the very last line (`End of lyrics`). A line-synced file had no
way to say where a sentence actually stops, so the Word tab's rail ran to the
next line's start, gap included.

- Every Line row now has a **Start** and an **End** chip. The End chip edits the
  last word's `end`: `X` clears it, the timestamp sets it to the playhead or
  seeks there, and `-`/`+` move it by 0.1 s and follow with the playhead.
- Setting the end of a line that has only a start spreads all its words over
  start–end in proportion to their text, so the end is part of a valid word-timed
  line and survives export. A line that is already word-timed only moves its
  last word's end; the earlier words stay exactly where they were.
- The end never moves before the last word's start. A line without a start
  cannot take an end.
- The `End of lyrics` row is gone: the last line has the same End chip as every
  other line.
- `setTokenEnd` / `clearTokenEnd` / `nudgeTokenEnd` are replaced by
  `setLineEnd` / `clearLineEnd` / `nudgeLineEnd`, which own the last-word rule.
- Verified with the attached 137-line line-synced file and a generated silent
  track: on `Love got me numb` at `06.48`, setting the end at `08.00` filled the
  words to `06.48–06.95–07.30–07.53–08.00`; `+` made it `08.10` and moved the
  audio to `08.10`; `X` cleared the last end; Undo restored `08.10`. On a
  word-timed line, `+` moved only the last word (`01.36` → `01.46`). The last
  line had an End chip, and the `End of lyrics` row was absent. The 390 px rows
  kept 44 px targets, with Start and End each on their own line.

## Resolved decisions

- **Word timing belongs to an exact line.** Kept only while the line's text is
  identical. If the line's timestamp moved, the words move by the same delta. If
  only the wording changed, the line keeps its timestamp and loses its word
  timing; guessing word times for new words would be worse than none.
- **Matching order on paste/import.** Text first (longest common subsequence, so
  an inserted line does not shift the rest), then timestamp (so a revised LRC
  keeps its timing when only the words changed).
- **Pasting merges, importing replaces.** The panel is an edit of what is there;
  `Import` loads a file and replaces, behind a confirmation.
- **`Edit lyrics` shows timestamps.** That is why a wording fix keeps the line's
  time: the time is attached to the row the user edits.
- **A partly timed line exports line-only.** Any word missing a start or end
  makes the whole line fall back to `[mm:ss.xx] text`, per the format rules, so
  the file never carries a half-timed sweep. The status bar says so.
- **Blue means timed; gray means still to do.** Two modes, one colour language.
- **Word time comes from the rail position, not the audio clock.** The rail is
  the whole line; the words split it in proportion to their text length. The
  cursor's position maps to the line's time; crossing a word's start boundary
  records the previous end and the next start at that time, and the last word
  ends at the right edge. Only rightward movement is allowed.
- **A line's end is its last word's end.** DMLL has no separate line-end field,
  so every Line row's End chip edits that value. Setting it on a line with only
  a start spreads the words over start–end, which makes the end exportable; a
  word-timed line moves only its last word's end. The last line is no different,
  so `End of lyrics` is gone.
- **Edit is plain text.** Comments and tags are ordinary lines; applying pairs
  leftovers by position when both files have the same line count, so a wording
  edit keeps its line time/side/ad-lib role. Word timing is still dropped when
  the words change.
- **Legacy is a hidden fallback.** The new header follows the requested layout
  and does not link to it; `?view=legacy` still has the list editor, inline word
  editing, side/ad-lib toggles and the album folder.

## Verified

- 112 vitest cases: timing, tokenizing, parsing (including the spec's quick
  reference, multi-timestamp lines, the duet form, BOM), serializing,
  round-trips, merging, the sync reducer, rate stepping.
- All 14 real `.lrc` files in DabMusic's `public/music` (564 timestamped lines,
  plain line-level, some CJK): every line's time and text survive exactly, an
  export re-parses to the same lyrics, and re-pasting the same source changes
  nothing.
- Chrome (`playwright-core` against the installed Chrome, production build):
  - tapping, voices, ad-libs, merge on text edit, reload from the draft, import
    round-trip;
  - editing a word in place: a rename kept its word times, splitting one word
    into two split its span (4.00–4.57 / 4.57–5.00), `F2` opened the editor,
    `Esc` cancelled, editing the first word kept the line timestamp, and one
    Undo restored text and timing together;
  - Line mode and `Estimate`;
  - a real 72-line LRC pasted, word-tapped, edited through the LRC-shaped panel,
    then imported over;
  - slow playback: 2.44 s of wall time advanced the media by 1.12 s at `0.5×`,
    and the tap recorded `00:03.12`, the media time;
  - highlighting: computed colours match in both modes and both themes;
  - waveform: a 3:08 track decoded to peaks, a click at 25 % of the 8 s window
    seeked to 2.00 s, `←` moved to 1.00 s, playing advanced to 3.18 s, `All`
    brought the whole track into view, the played bars drew in `text-primary`,
    and the bars followed the theme (light `#737373`, dark `#a3a3a3`);
  - album folder, against a stubbed directory handle: the manifest loaded its
    three tracks, opening one loaded its audio and its `.dmll`, saving wrote the
    same file back and updated the manifest, and saving the track that listed
    `lrc` wrote `<stem>.dmll`, dropped `lrc` and left the old file in place;
  - format fidelity: a file with a comment, an `[ar:]` tag and a repeated
    timestamp exported byte-for-byte again, the edit panel showed the repeated
    timestamp once and kept the comment and tag, and applying it unchanged
    changed nothing;
  - hold and narrow screens: `Space` held for 0.8 s while playing produced
    `00:00.28 to 00:01.08`; the pad's `Tap` left a word open at 1.43 and
    `End word` closed it; at 390 px a row was 96 px with the words above the
    controls, all four pad buttons were 44 px, the hints were hidden and the
    page reserved the footer's measured 219 px; at 1280 px the row was still one
    32 px line in its original order;
  - focus editor: a drag from 30 % to 45 % of the 8 s window set `alpha` at
    `00:03.60` and advanced to `beta`; two more drags set `beta` at `00:04.00`
    and `gamma` at `00:04.80`, and the fourth ended the line at `00:06.40` and
    moved to line 2. On line 2, `←` added 10 ms (`00:06.41`), `Shift+→` added
    100 ms, and Enter committed each word; `Backspace` restored the open last
    word and Enter closed the line again. Line mode set line 3 at `00:08.00` and
    reached the 3-of-3 completion state. `Sync` while playing wrote `zeta` at
    `00:08.43` and left the audio playing; a word-mode drag at 390 px set
    `zeta` 08.00–08.80 and `eta` 08.80–09.60, with no horizontal overflow and
    every control at 44 px. Switching to Legacy and back kept the same blob
    source and `08.00` playhead; `?view=legacy` opened the list directly;
    `F2` and `Edit lyrics` still work there. With a track open, the playhead
    seeded to the active line's `03.60`. Both themes render, and the export read
    back as
    `[00:03.60] {00:03.60~00:04.00}alpha {00:04.00~00:04.80}beta {00:04.80~00:06.40}gamma`
    plus the matching `delta` and `zeta` lines;
  - three-tab rebuild (in-app Chromium, production build): the header showed
    the three tabs, both uploads and the export; the imported DMLL (comment,
    `[ar:]`, voice, ad-lib, repeated timestamp) produced the expected Line rows
    and an End at `06.60`. Edit changed `Hello world` to `Hi world` with edge
    spaces: the textarea trimmed, the line kept `00:00.90` and voice right with
    untimed words, the ad-lib kept `02.50` and its word times, and the export
    wrote the comment, tag, `[v:right]`, `[ad:]` and the now-separate `again`
    lines. Line: play from `01.00` highlighted the row; `-0.1` moved the line
    and its words to `00:00.90 / 01.40 / 01.90`; `X` cleared and Cmd+Z
    restored; End `+0.1` reached `06.60`, and clearing/undo worked; an untimed
    ad-lib timestamp was set at the `02.60` playhead. The player seeked to
    `10.00`, `-3`/`+3` gave `7.00`/`10.00`, and the highlight measured
    `#1b2a42`/`#8ab4ff` in dark and `#e8efff`/`#1d4ed8` in light. Word: a paused
    drag mapped `Hi world` to `0.90–2.50` and advanced; an unknown-start ad-lib
    became `2.60–4.00` and advanced; an audio-clock drag started `again` at
    `4.30` with the line start at `4.00` and ended at `4.50`; `0.5×` played at
    half media speed; Back returned to the earlier line; a right-then-left drag
    stayed at 60 %, ending at `4.30`; `→` twice plus Enter completed a line.
    The rail's pointer/arrow/Enter paths were driven with synthetic events on
    the pill because the in-app browser's CUA input did not deliver to it; the
    same React handlers and timing math ran. At 390 px there was no horizontal
    overflow, every header/footer/row button was 44 px, the header was 118 px,
    rows 113 px and the player 65 px. `?view=legacy` opened the list and its
    Editor button returned to the tabs; the old list kept the comments, voices
    and draft.
- Exported files were read back with a copy of DabMusic's `lrc.ts`: word times,
  gaps after an early `Shift+Space`, `[ad:]` folding into its parent line, voices
  and untimed lines all agree.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` pass on `master`.

## Remaining

- The album folder is written directly, but nothing commits or deploys it: the
  owner still has to commit `public/music/<album>/` in DabMusic.

## Working notes

- **Ports.** DabMusic's `next dev` normally holds 3000, so dablrc lands on 3001.
  Verification runs used `next start` on 3123. Do not kill the 3000 process
  unless asked.
- **`next dev` rewrites `tsconfig.json`** (`jsx`, `.next/dev/types/**/*.ts`,
  reformatted arrays). Discard that change before switching branches instead of
  committing it.
- **Browser colour assertions need transitions disabled.** `transition-colors`
  makes `getComputedStyle` return an in-between value; inject
  `* { transition: none !important; }` first. The tertiary gray differs per
  theme (`#737373` light, `#a3a3a3` dark).
- **Partially timed lines are correct, not a bug.** The export rule above has
  caught two test expectations already.
- **The verification loop that has caught real problems:** vitest, then
  `typecheck`/`lint`/`build`, then Chrome against a production build, then the
  exported file through DabMusic's own parser. The browser scripts live in
  `/tmp/dablrc-e2e` and are not committed.
