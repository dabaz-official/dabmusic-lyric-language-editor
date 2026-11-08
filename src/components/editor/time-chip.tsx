"use client";

import { Minus, Plus, X } from "lucide-react";

import { cx } from "@/lib/cx";
import { formatTime } from "@/lib/dmll/time";

interface TimeChipProps {
  /** A short caption such as `Start` or `End`, shown inside the chip. */
  label?: string;
  /** The timestamp shown, or undefined for `--:--.--`. */
  value?: number;
  /** Whether the timestamp itself can be clicked to set/seek. */
  canTimestamp: boolean;
  /** Whether X and the +/- buttons act on a value. */
  canAdjust: boolean;
  highlighted?: boolean;
  timestampTitle: string;
  clearTitle: string;
  minusTitle: string;
  plusTitle: string;
  onTimestamp: () => void;
  onClear: () => void;
  onMinus: () => void;
  onPlus: () => void;
}

const ICON_BUTTON =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface hover:text-text-primary disabled:pointer-events-none disabled:opacity-40 sm:size-8";

/** The X / timestamp / minus / plus control used by the Line rows. */
export function TimeChip({
  label,
  value,
  canTimestamp,
  canAdjust,
  highlighted = false,
  timestampTitle,
  clearTitle,
  minusTitle,
  plusTitle,
  onTimestamp,
  onClear,
  onMinus,
  onPlus,
}: TimeChipProps) {
  return (
    <div
      className={cx(
        "flex shrink-0 items-center rounded-full border p-0.5",
        highlighted ? "border-timed/40 bg-background/70" : "border-border bg-surface-secondary",
      )}
    >
      {label && (
        <span
          aria-hidden
          className="pl-2 pr-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary"
        >
          {label}
        </span>
      )}

      <button
        type="button"
        className={ICON_BUTTON}
        title={clearTitle}
        aria-label={clearTitle}
        disabled={!canAdjust}
        onClick={onClear}
      >
        <X className="size-3.5" />
      </button>

      <button
        type="button"
        className="min-h-11 min-w-[78px] rounded-full px-1 font-mono text-xs tabular-nums text-text-primary transition-colors hover:bg-surface disabled:pointer-events-none disabled:text-text-tertiary sm:min-h-7"
        title={timestampTitle}
        aria-label={timestampTitle}
        disabled={!canTimestamp && value === undefined}
        onClick={onTimestamp}
      >
        {value === undefined ? "--:--.--" : formatTime(value)}
      </button>

      <button
        type="button"
        className={ICON_BUTTON}
        title={minusTitle}
        aria-label={minusTitle}
        disabled={!canAdjust}
        onClick={onMinus}
      >
        <Minus className="size-3.5" />
      </button>
      <button
        type="button"
        className={ICON_BUTTON}
        title={plusTitle}
        aria-label={plusTitle}
        disabled={!canAdjust}
        onClick={onPlus}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
