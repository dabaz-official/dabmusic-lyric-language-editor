"use client";

import { CornerUpLeft, CornerUpRight, Pause, Play, Snail } from "lucide-react";
import { useCallback, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { isLine, nextLine, previousLine } from "@/lib/dmll/model";

import type { EditorController } from "./use-editor";
import { WordLine } from "./word-line";

interface WordTabProps {
  editor: EditorController;
  onEdit: () => void;
}

interface WordControlProps {
  label: string;
  title: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  pressed?: boolean;
}

function WordControl({ label, title, icon, onClick, disabled, primary, pressed }: WordControlProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "flex h-20 flex-col items-center justify-center gap-2 rounded-lg text-xs font-medium uppercase tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-40 sm:h-24",
        primary
          ? "bg-primary text-on-primary hover:bg-primary-hover"
          : pressed
            ? "bg-primary text-on-primary"
            : "bg-surface-secondary text-text-secondary hover:bg-surface-secondary/80 hover:text-text-primary",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * The sentence-sync view: one line, a rail that sets where the sentence ends,
 * and four controls (back, play, slow, next). Committing a sentence stays on
 * the line for fine-tuning; Next moves on and keeps the audio playing.
 */
export function WordTab({ editor, onEdit }: WordTabProps) {
  const { lyrics, active, playback, activate } = editor;
  const { hasAudio, playing, rate, setRate, seek, togglePlay } = playback;

  const first = lyrics.findIndex((entry) => isLine(entry));
  const index = isLine(lyrics[active]) ? active : first;
  const entry = index >= 0 ? lyrics[index] : undefined;
  const line = isLine(entry) ? entry : undefined;
  const previous = index >= 0 ? previousLine(lyrics, index) : -1;
  const previousEntry = previous >= 0 ? lyrics[previous] : undefined;
  const next = index >= 0 ? nextLine(lyrics, index) : -1;
  const nextEntry = next >= 0 ? lyrics[next] : undefined;

  const play = useCallback(() => {
    if (!line) return;
    if (playing) {
      togglePlay();
      return;
    }
    // Seek rather than activate: a selected word must survive a listen.
    if (line.start !== undefined) seek(line.start);
    togglePlay();
  }, [line, playing, seek, togglePlay]);

  const back = useCallback(() => {
    if (previous < 0) return;
    activate(previous, isLine(previousEntry) ? previousEntry.start : undefined);
  }, [activate, previous, previousEntry]);

  const goNext = useCallback(() => {
    if (next < 0) return;
    activate(next, isLine(nextEntry) ? nextEntry.start : undefined);
  }, [activate, next, nextEntry]);

  const slow = useCallback(() => setRate(rate === 0.5 ? 1 : 0.5), [rate, setRate]);

  if (!line) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-text-secondary">No lyrics yet.</p>
        <Button onClick={onEdit}>Go to Edit</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WordLine key={index} editor={editor} index={index} entry={line} />

      <div className="shrink-0 px-3 pb-[env(safe-area-inset-bottom)] pt-2 sm:pb-3">
        <div className="mx-auto grid w-full max-w-3xl grid-cols-4 gap-2 sm:gap-3">
          <WordControl
            label="Back"
            title="Back to the previous line"
            icon={<CornerUpLeft className="size-6" />}
            disabled={previous < 0}
            onClick={back}
          />
          <WordControl
            label={playing ? "Pause" : "Play"}
            title={playing ? "Pause" : "Play this line"}
            icon={playing ? <Pause className="size-6" /> : <Play className="size-6" />}
            disabled={!hasAudio}
            primary
            onClick={play}
          />
          <WordControl
            label="Slow"
            title={rate === 0.5 ? "Play at normal speed" : "Play at 0.5×"}
            icon={<Snail className="size-6" />}
            disabled={!hasAudio}
            pressed={rate === 0.5}
            onClick={slow}
          />
          <WordControl
            label="Next"
            title="Go to the next line"
            icon={<CornerUpRight className="size-6" />}
            disabled={next < 0}
            onClick={goNext}
          />
        </div>
      </div>
    </div>
  );
}
