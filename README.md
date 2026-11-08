# DabMusic Lyric Language Editor

Create and edit DMLL lyric files for DabMusic. Paste the lyrics, load the track, and put every word in time with the audio.

The main editor has three tabs: **Edit** for the words, **Line** for each line's start and end, and **Word** for the word-level timing. The old list editor is kept as **Legacy** at `?view=legacy`.

## Header

- Left: the logo and the current track or lyric file name.
- Centre: `Edit`, `Line`, `Word` (the tab bar also works with the arrow keys).
- Right: open an audio file, upload a `.dmll` (also `.lrc`/`.txt`), and export. Export downloads a `.dmll`; this view does not write to a folder.
- On a phone the actions and the logo share the first row, and the tabs get the second row. Targets are 44 px.

## Edit

- The lyric text lives in one full-height textarea, one line per row. Blank rows are section breaks. `//` comments and `[ar:]`-style tags are shown as ordinary lines, so a save keeps them.
- Leading and trailing spaces are removed from every line when the text is applied: on blur, on a tab change, and while typing after a short pause.
- Applying merges with the previous lyrics. A line whose text did not change keeps its line and word timing, side, ad-lib role and repeated-timestamp group. A line whose words changed keeps its line timestamp, side and ad-lib role, but its word timing is dropped: the new words have not been sung yet.

## Line

- One row per lyric line, using the same width and side padding as the header. Comments and tags are hidden; blank rows become gaps; ad-libs carry a badge.
- Each row has a **Start** chip: `X` clears the line's start and word timing, `mm:ss.xx` is the start, and `-`/`+` move the whole line by 0.1 s (the start and every word move together). The playhead follows the new time, so a nudge is also a listen-at-that-moment control.
- Clicking an untimed Start sets it to the playhead; clicking a timed one seeks there. The play button starts playback from the line start.
- Each row also has an **End** chip. DMLL has no separate line-end field, so the end is the last word's `end`. Clicking `--:--.--` sets it at the playhead: a line with only a start gets every word spread across start–end in proportion to its text, so the end is part of the exported file; a line that is already word-timed only moves its last word's end. Clicking a set End seeks there. `X` clears the last word's end and `-`/`+` move it 0.1 s, following with the playhead.
- At the right of the words: an `L`/`R` side toggle (left by default) and a `Lyric`/`Ad-lib` role toggle (lyric by default). An ad-lib takes the side of the lyric above, so its side button is read-only; the first lyric line has no parent and cannot become an ad-lib.
- The row at the playhead is highlighted with the timed blue background and left border.
- Above the player: the up chevron clears the current (highlighted) line's timestamp and moves to the previous line; the down chevron sets the next line's timestamp to the playhead and moves to it.
- The last line has an End chip like every other line, so there is no separate `End of lyrics` row.
- The player below has play/pause, a draggable seek bar, and the two three-second jumps.

## Word

- One line at a time, centred, with a `Word k / N` counter. Timed words are blue; the word under the cursor is underlined.
- The rail is the **whole line**: its left is the line start, its right is the line end (the last word's end, or the next line's start; `--:--.--` when neither is known). The words split that span in proportion to their text length, and one dot marks each word's start. The long pill is the cursor and only moves forward.
- Drag from the far left to the far right. The cursor's position maps linearly to the line's time; when it passes a word's start boundary, the previous word ends and the next starts at that mapped time. The last word ends at the right edge. A jump over several boundaries interpolates. The times come from the position, not the audio clock; the Play and Slow controls are for listening.
- Releasing early finalises the current word at the release position. Reaching the right edge completes the line and moves to the next one.
- `Back` returns to the previous line. `Slow` is a 0.5× listening aid and does not change the recorded positions. The rate goes back to 1× when the tab changes.
- Each release is one undo step. The line start is set from the first word when it had none; a line with an existing start keeps it.
- Keyboard: `Space` plays or pauses, `→` on the rail steps to the next boundary, `Enter` commits the current word. `Ctrl/Cmd+Z` undoes outside the textarea.

## Legacy

`?view=legacy` opens the old list editor. It keeps its key map (Space/Shift+Space/Enter, `S`/`E`, the nudge keys, `F2`), inline word editing, side and ad-lib toggles, `Estimate`, `Clear`, and the album-folder `Save to album`. Its `Editor` button returns to the tab editor while keeping the audio, playhead and undo history.

## Format

The output is DMLL, described in DabMusic's `docs/dmll-format.md`. `src/lib/dmll/parse.ts` is a port of DabMusic's `src/lib/lrc.ts`, the reader on the site.

Comments, `[ar:]`-style tags and lines with several timestamps are kept as they are. An `[offset:]` tag is preserved but not applied, which is what the site does. The output is always `.dmll`; there is no LRC export.

The draft is saved in local storage under `dablrc.draft`, unchanged from earlier versions. The audio is not stored and has to be opened again after a reload.

## Develop

```bash
pnpm install
pnpm dev         # http://localhost:3000
pnpm test        # format, sync, word-gesture and merge tests
pnpm typecheck
pnpm lint
pnpm build
```

## Layout

- `src/lib/dmll/`: the format (parse, serialize, tokenize), the sync state machine, the merge that keeps timing when lyric text is edited, and the Word gesture's interpolation (`word-sync.ts`). Pure TypeScript with no UI.
- `src/components/editor/`: the shared session (`use-editor.ts`), the shell (`editor-shell.tsx`), the tab editor (`tabs-editor.tsx`, `editor-header.tsx`, `edit-tab.tsx`, `line-tab.tsx`, `word-tab.tsx`), the player (`player.tsx`), and the legacy list editor and transport.
- Stack: Next.js 16, React 19, Tailwind CSS 4, TypeScript, next-themes and lucide-react, with the same versions and conventions as DabMusic.
