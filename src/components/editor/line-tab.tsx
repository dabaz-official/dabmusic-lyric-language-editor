"use client";

import { useCallback, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { isLine, currentLineIndex, parentOf } from "@/lib/dmll/model";
import { roundTime } from "@/lib/dmll/time";

import { LineRow } from "./line-row";
import type { EditorController } from "./use-editor";

interface LineTabProps {
  editor: EditorController;
  /** Switch to the text editor when there is nothing to show. */
  onEdit: () => void;
}

/** The line list: each line's start and end, playback, and the player. */
export function LineTab({ editor, onEdit }: LineTabProps) {
  const { lyrics, voices, dispatch, activate, playback } = editor;
  const { time, currentTime, seek, playing, togglePlay } = playback;

  const current = currentLineIndex(lyrics, time);

  const hasLines = useMemo(() => lyrics.some((entry) => isLine(entry)), [lyrics]);

  const setStart = useCallback(
    (index: number) => dispatch({ type: "setLineStart", entry: index, time: currentTime() }),
    [currentTime, dispatch],
  );
  const clear = useCallback((index: number) => dispatch({ type: "clearTiming", entry: index }), [dispatch]);
  const nudge = useCallback(
    (index: number, delta: number) => {
      const entry = lyrics[index];
      if (!isLine(entry) || entry.start === undefined) return;
      const start = roundTime(Math.max(0, entry.start + delta));
      dispatch({ type: "shiftLine", entry: index, delta });
      // The fine tune is a listening tool: follow the line with the playhead.
      seek(start);
    },
    [dispatch, lyrics, seek],
  );
  const select = useCallback((index: number, start: number | undefined) => activate(index, start), [activate]);
  const toggleVoice = useCallback((index: number) => dispatch({ type: "toggleVoice", entry: index }), [dispatch]);
  const toggleAdlib = useCallback((index: number) => dispatch({ type: "toggleAdlib", entry: index }), [dispatch]);
  const playLine = useCallback(
    (index: number, start: number | undefined) => {
      if (start === undefined) return;
      activate(index, start);
      if (!playing) togglePlay();
    },
    [activate, playing, togglePlay],
  );

  const setEnd = useCallback(
    (index: number) => dispatch({ type: "setLineEnd", entry: index, time: currentTime() }),
    [currentTime, dispatch],
  );
  const clearEnd = useCallback(
    (index: number) => dispatch({ type: "clearLineEnd", entry: index }),
    [dispatch],
  );
  const nudgeEnd = useCallback(
    (index: number, delta: number) => {
      const entry = lyrics[index];
      if (!isLine(entry)) return;
      const last = entry.tokens[entry.tokens.length - 1];
      if (!last || last.start === undefined || last.end === undefined) return;
      const end = roundTime(Math.max(last.start, last.end + delta));
      dispatch({ type: "nudgeLineEnd", entry: index, delta });
      // Like the start nudge, this is a listening tool: follow the end.
      seek(end);
    },
    [dispatch, lyrics, seek],
  );

  if (!hasLines) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-text-secondary">No lyrics yet.</p>
        <Button onClick={onEdit}>Go to Edit</Button>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-3 py-4 md:px-4">
        <ol className="flex flex-col gap-0.5">
          {lyrics.map((entry, index) => {
            if (entry.kind === "blank") return <li key={index} aria-hidden className="h-3" />;
            if (!isLine(entry)) return null;

            return (
              <LineRow
                key={index}
                index={index}
                entry={entry}
                current={current === index}
                voice={voices[index]}
                canAdlib={entry.kind === "adlib" || parentOf(lyrics, index) >= 0}
                onClearStart={clear}
                onSetStart={setStart}
                onSelectStart={select}
                onNudgeStart={nudge}
                onPlay={playLine}
                onSetEnd={setEnd}
                onClearEnd={clearEnd}
                onNudgeEnd={nudgeEnd}
                onSeekEnd={seek}
                onToggleVoice={toggleVoice}
                onToggleAdlib={toggleAdlib}
              />
            );
          })}
        </ol>
      </div>
    </div>
  );
}
