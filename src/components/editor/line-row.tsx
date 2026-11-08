"use client";

import { Play } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { plainText, type LineEntry } from "@/lib/dmll/model";
import { formatTime } from "@/lib/dmll/time";
import type { Voice } from "@/lib/dmll/types";

import { TimeChip } from "./time-chip";

export interface LineRowProps {
  index: number;
  entry: LineEntry;
  /** Whether the playhead is inside this line. */
  current: boolean;
  /** The side this line (or its parent lyric) sits on. */
  voice: Voice;
  /** Whether the Lyric/Ad-lib button can act on this line. */
  canAdlib: boolean;
  onClearStart: (index: number) => void;
  onSetStart: (index: number) => void;
  onSelectStart: (index: number, start: number | undefined) => void;
  onNudgeStart: (index: number, delta: number) => void;
  onPlay: (index: number, start: number | undefined) => void;
  /** Sets the end on the last word at the playhead, filling the words when needed. */
  onSetEnd: (index: number) => void;
  onClearEnd: (index: number) => void;
  onNudgeEnd: (index: number, delta: number) => void;
  onSeekEnd: (end: number) => void;
  onToggleVoice: (index: number) => void;
  onToggleAdlib: (index: number) => void;
}

const STEP = 0.1;

/** One lyric line in the Line tab: start/end chips, play button, words and side/role toggles. */
export const LineRow = memo(function LineRow({
  index,
  entry,
  current,
  voice,
  canAdlib,
  onClearStart,
  onSetStart,
  onSelectStart,
  onNudgeStart,
  onPlay,
  onSetEnd,
  onClearEnd,
  onNudgeEnd,
  onSeekEnd,
  onToggleVoice,
  onToggleAdlib,
}: LineRowProps) {
  const start = entry.start;
  const lastToken = entry.tokens[entry.tokens.length - 1];
  const end = lastToken?.end;
  const isAdlib = entry.kind === "adlib";

  return (
    <li
      className={cx(
        "flex flex-wrap items-center gap-2 rounded-md border-l-2 px-2 py-1.5 transition-colors sm:flex-nowrap",
        current ? "border-timed bg-timed-subtle" : "border-transparent hover:bg-surface-secondary/60",
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:shrink-0 sm:flex-nowrap">
        <TimeChip
          label="Start"
          value={start}
          canTimestamp
          canAdjust={start !== undefined}
          highlighted={current}
          timestampTitle={
            start === undefined ? "Set the line start to the playhead" : `Seek to ${formatTime(start)}`
          }
          clearTitle="Clear this line's timestamp"
          minusTitle="Move the whole line back 0.1 seconds"
          plusTitle="Move the whole line forward 0.1 seconds"
          onTimestamp={() => (start === undefined ? onSetStart(index) : onSelectStart(index, start))}
          onClear={() => onClearStart(index)}
          onMinus={() => onNudgeStart(index, -STEP)}
          onPlus={() => onNudgeStart(index, STEP)}
        />
        <TimeChip
          label="End"
          value={end}
          canTimestamp={start !== undefined}
          canAdjust={end !== undefined}
          highlighted={current}
          timestampTitle={
            start === undefined
              ? "Give this line a start first"
              : end === undefined
                ? "Set the line end to the playhead and fill its words"
                : `Seek to the line end (${formatTime(end)})`
          }
          clearTitle="Clear this line's end"
          minusTitle="Move the line end back 0.1 seconds"
          plusTitle="Move the line end forward 0.1 seconds"
          onTimestamp={() => (end === undefined ? onSetEnd(index) : onSeekEnd(end))}
          onClear={() => onClearEnd(index)}
          onMinus={() => onNudgeEnd(index, -STEP)}
          onPlus={() => onNudgeEnd(index, STEP)}
        />

        <Button
          size="icon"
          variant="ghost"
          className="size-11 sm:size-9"
          title={start === undefined ? "Give this line a timestamp first" : `Play from ${formatTime(start)}`}
          aria-label={start === undefined ? "Play line (no timestamp)" : `Play from ${formatTime(start)}`}
          disabled={start === undefined}
          onClick={() => onPlay(index, start)}
        >
          <Play className="size-4" />
        </Button>
      </div>

      <div className="flex min-h-11 min-w-0 flex-1 basis-full items-center gap-1.5 sm:min-h-0 sm:basis-auto">
        <button
          type="button"
          onClick={() => onSelectStart(index, start)}
          className={cx(
            "flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left sm:min-h-0",
            isAdlib ? "text-sm text-text-secondary" : "text-base text-text-primary",
          )}
        >
          {isAdlib && (
            <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary">
              Ad-lib
            </span>
          )}
          <span className="min-w-0">{plainText(entry.tokens)}</span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            className="size-11 font-mono text-xs sm:size-7"
            title={
              isAdlib
                ? "This side comes from the lyric line above"
                : `Side: ${voice}. Click to switch.`
            }
            aria-label={isAdlib ? "Side inherited from the line above" : `Side ${voice}, switch sides`}
            disabled={isAdlib}
            onClick={() => onToggleVoice(index)}
          >
            {voice === "right" ? "R" : "L"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-11 min-w-[64px] px-2 text-xs sm:h-7"
            title={
              !canAdlib
                ? "An ad-lib needs a lyric line above it"
                : isAdlib
                  ? "Turn into a lyric line"
                  : "Turn into an ad-lib under the line above"
            }
            aria-label={isAdlib ? "Turn this ad-lib into a lyric line" : "Turn this line into an ad-lib"}
            disabled={!canAdlib}
            onClick={() => onToggleAdlib(index)}
          >
            {isAdlib ? "Ad-lib" : "Lyric"}
          </Button>
        </div>
      </div>
    </li>
  );
});
