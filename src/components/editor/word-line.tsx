"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { isLine, lineNumbers, nextLine, plainText, type LineEntry } from "@/lib/dmll/model";
import { formatTime, roundTime } from "@/lib/dmll/time";
import type { Token } from "@/lib/dmll/types";
import { spreadWordTimings, wordBoundaries } from "@/lib/dmll/word-sync";

import { codeOf, isTypingTarget } from "./keyboard";
import { SentenceSlider } from "./sentence-slider";
import type { EditorController } from "./use-editor";

interface WordLineProps {
  editor: EditorController;
  index: number;
  entry: LineEntry;
}

/** A preview of the sentence end while the rail is being dragged. */
interface Preview {
  start: number;
  end: number;
  tokens: Token[];
}

/** The buttons' fine-tune step; the keyboard uses 10 ms, or 100 ms with Shift. */
const NUDGE = 0.05;

interface WordEdgeProps {
  label: string;
  value?: number;
  onSet: () => void;
  onMinus: () => void;
  onPlus: () => void;
}

/** One edge of the selected word: its time, a set-at-playhead button and two nudges. */
function WordEdge({ label, value, onSet, onMinus, onPlus }: WordEdgeProps) {
  const lower = label.toLowerCase();
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1">
      <span className="w-9 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
        {label}
      </span>
      <span className="min-w-[70px] flex-1 font-mono text-xs tabular-nums text-text-primary">
        {value === undefined ? "--:--.--" : formatTime(value)}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-11 min-w-11 px-2 text-xs sm:h-7 sm:min-w-0"
        title={`Set the word's ${lower} to the playhead`}
        onClick={onSet}
      >
        Set
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-11 sm:size-7"
        title={`Move the word's ${lower} back ${NUDGE} seconds`}
        disabled={value === undefined}
        onClick={onMinus}
      >
        <Minus className="size-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-11 sm:size-7"
        title={`Move the word's ${lower} forward ${NUDGE} seconds`}
        disabled={value === undefined}
        onClick={onPlus}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

/**
 * One sentence in the Word tab. The rail runs from the line's start to the next
 * line (or the track's end); one drag sets where the sentence stops and every
 * word gets a proportional slice of that span. Clicking a word opens a small
 * start/end editor, so a word can still be nudged by hand.
 */
export function WordLine({ editor, index, entry }: WordLineProps) {
  const { lyrics, summary, playback, dispatch, selected, selectToken } = editor;
  const { currentTime, time, duration, hasAudio } = playback;

  const [source, setSource] = useState(entry);
  const [preview, setPreview] = useState<Preview>();

  // Adopt changes from outside (undo, the Line tab, an import) and drop any
  // preview that belonged to the old line.
  if (source !== entry) {
    setSource(entry);
    setPreview(undefined);
  }

  const lastToken = entry.tokens[entry.tokens.length - 1];
  const start = preview?.start ?? entry.start ?? time;
  const end = preview?.end ?? lastToken?.end;
  const shownTokens = preview?.tokens ?? entry.tokens;
  const boundaries = useMemo(() => wordBoundaries(shownTokens), [shownTokens]);
  const number = lineNumbers(lyrics)[index];
  const isAdlib = entry.kind === "adlib";

  const next = nextLine(lyrics, index);
  const nextEntry = next >= 0 ? lyrics[next] : undefined;
  const nextStart = isLine(nextEntry) ? nextEntry.start : undefined;

  // The rail reaches the next line so a sentence can be extended past an old
  // end; the track's duration is the fallback for the last line.
  const right = useMemo(() => {
    // A duration that ends before this line (bad metadata) must not collapse it.
    const fallback = duration > start ? duration : start + 10;
    return Math.max(nextStart ?? fallback, lastToken?.end ?? 0, start + 0.01);
  }, [nextStart, duration, start, lastToken?.end]);

  const selectedIndex =
    selected?.entry === index && selected.token < entry.tokens.length ? selected.token : undefined;
  const selectedToken = selectedIndex === undefined ? undefined : entry.tokens[selectedIndex];

  function previewAt(value: number) {
    if (!hasAudio) return;
    const at = roundTime(Math.min(right, Math.max(start, value)));
    setPreview({ start, end: at, tokens: spreadWordTimings(entry.tokens, start, at) });
  }

  function commit(value: number) {
    if (!hasAudio) return;
    const at = roundTime(Math.min(right, Math.max(start, value)));
    setPreview(undefined);
    // A tap at the very start would collapse the sentence to zero length.
    if (at <= start) return;
    dispatch({ type: "setLineSpan", entry: index, start, end: at });
  }

  function nudgePreview(delta: number) {
    previewAt((preview?.end ?? end ?? start) + delta);
  }

  const setEdge = (edge: "start" | "end") => {
    dispatch({ type: "restamp", edge, time: currentTime() });
  };
  const nudgeEdge = (edge: "start" | "end", delta: number) => {
    dispatch({ type: "nudge", edge, delta });
  };

  // The selected word keeps the legacy fine-tune keys: S/E stamp an edge at the
  // playhead, and the punctuation keys nudge it (Shift: 100 ms).
  useEffect(() => {
    if (selectedIndex === undefined) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || isTypingTarget(event.target) || event.metaKey || event.ctrlKey) return;

      const at = currentTime();
      const delta = event.shiftKey ? 0.1 : 0.01;
      let handled = true;

      switch (codeOf(event)) {
        case "KeyS":
          dispatch({ type: "restamp", edge: "start", time: at });
          break;
        case "KeyE":
          dispatch({ type: "restamp", edge: "end", time: at });
          break;
        case "Comma":
          dispatch({ type: "nudge", edge: "start", delta: -delta });
          break;
        case "Period":
          dispatch({ type: "nudge", edge: "start", delta });
          break;
        case "Semicolon":
          dispatch({ type: "nudge", edge: "end", delta: -delta });
          break;
        case "Quote":
          dispatch({ type: "nudge", edge: "end", delta });
          break;
        default:
          handled = false;
      }

      if (handled) event.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex, dispatch, currentTime]);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 py-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="flex flex-wrap items-center justify-center gap-2 text-xs tabular-nums text-text-tertiary">
          {isAdlib ? (
            <span className="rounded-full border border-border px-2 py-0.5 font-medium">Ad-lib</span>
          ) : (
            <span>
              Line {number ?? "—"} of {summary.lyrics}
            </span>
          )}
          <span>
            {shownTokens.length} word{shownTokens.length === 1 ? "" : "s"}
          </span>
          {selectedIndex !== undefined && <span>Word {selectedIndex + 1}</span>}
        </p>

        <p className="max-w-3xl text-balance text-2xl leading-8 sm:text-[2rem] sm:leading-10">
          {shownTokens.map((token, tokenIndex) => {
            const timed = token.start !== undefined;
            const isSelected = preview === undefined && tokenIndex === selectedIndex;
            return (
              <button
                key={tokenIndex}
                type="button"
                disabled={!hasAudio || preview !== undefined}
                onClick={() => selectToken({ entry: index, token: tokenIndex }, token.start)}
                title={preview === undefined ? "Click to fine-tune this word" : undefined}
                className={cx(
                  "min-h-11 whitespace-pre rounded-xs py-0.5 transition-colors sm:min-h-0",
                  timed ? "text-timed" : "text-text-tertiary",
                  isSelected && "bg-timed-subtle underline decoration-focus decoration-2 underline-offset-8",
                  preview === undefined && hasAudio && "hover:bg-surface-secondary",
                )}
              >
                {token.text}
              </button>
            );
          })}
        </p>
      </div>

      <div className="w-full max-w-3xl">
        <div className="mb-2 flex items-center justify-between gap-2 font-mono text-xs tabular-nums text-text-tertiary">
          <span>{formatTime(start)}</span>
          <span className="truncate font-sans text-[11px] uppercase tracking-wide">
            {end === undefined ? "Drag to the sentence end" : `End ${formatTime(end)}`}
          </span>
          <span>{formatTime(right)}</span>
        </div>

        <SentenceSlider
          start={start}
          end={end}
          right={right}
          boundaries={boundaries}
          disabled={!hasAudio}
          onPreview={previewAt}
          onCommit={commit}
          onCancel={() => setPreview(undefined)}
          onNudge={nudgePreview}
        />

        <p className="mt-3 text-center text-xs text-text-tertiary">
          {hasAudio
            ? "Drag once to where the sentence ends: every word is spread across that span. Click a word to fine-tune it."
            : "Open the audio to sync the sentence."}
        </p>
      </div>

      {selectedToken && (
        <div className="w-full max-w-2xl rounded-lg border border-border bg-surface-secondary px-2 py-2">
          <p className="mb-1 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 text-xs text-text-tertiary">
            <span>
              Word {selectedIndex !== undefined ? selectedIndex + 1 : 0} / {shownTokens.length}
            </span>
            <span className="max-w-64 truncate font-medium text-text-primary">{plainText([selectedToken])}</span>
            <span>Playhead {formatTime(time)}</span>
          </p>
          <div className="grid gap-1 sm:grid-cols-2">
            <WordEdge
              label="Start"
              value={selectedToken.start}
              onSet={() => setEdge("start")}
              onMinus={() => nudgeEdge("start", -NUDGE)}
              onPlus={() => nudgeEdge("start", NUDGE)}
            />
            <WordEdge
              label="End"
              value={selectedToken.end}
              onSet={() => setEdge("end")}
              onMinus={() => nudgeEdge("end", -NUDGE)}
              onPlus={() => nudgeEdge("end", NUDGE)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
