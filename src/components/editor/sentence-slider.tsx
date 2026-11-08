"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { cx } from "@/lib/cx";
import { formatTime } from "@/lib/dmll/time";

const PADDING = 8;
const TRACK_HEIGHT = 88;
const BAR_HEIGHT = 44;
const STEP = 0.1;

interface SentenceSliderProps {
  /** The sentence's start; the bar begins here. */
  start: number;
  /** The sentence's end, or undefined while it has none. */
  end?: number;
  /** The furthest the rail reaches: the next line's start or the track's end. */
  right: number;
  /** Word start fractions; the last `1` is the end and is not drawn. */
  boundaries: number[];
  disabled?: boolean;
  /** The pointer moved the end (a live preview). */
  onPreview: (end: number) => void;
  /** The pointer released or Enter committed. */
  onCommit: (end: number) => void;
  /** The gesture was cancelled. */
  onCancel: () => void;
  /** Arrow key: move the end by `delta` seconds. */
  onNudge: (delta: number) => void;
}

/**
 * The sentence rail. The whole bar is the line's span, from its start to the
 * next line (or the track's end); the filled part runs to the sentence end.
 * One dot marks each word's proportional place. Dragging anywhere on the rail
 * moves the end and previews the word split; releasing commits it.
 */
export function SentenceSlider({
  start,
  end,
  right,
  boundaries,
  disabled = false,
  onPreview,
  onCommit,
  onCancel,
  onNudge,
}: SentenceSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const geometry = useRef({ trackLeft: 0, inner: 1 });
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    // Read once up front: some embedded browsers defer ResizeObserver callbacks.
    const measure = () => setWidth(track.getBoundingClientRect().width);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const inner = Math.max(0, width - PADDING * 2);
  const span = Math.max(0, right - start);
  const value = end === undefined ? start : Math.min(right, Math.max(start, end));
  const progress = span > 0 ? Math.min(1, Math.max(0, (value - start) / span)) : 0;
  // The last boundary is the line's end, which the right edge already shows.
  const marks = boundaries.length > 1 ? boundaries.slice(0, -1) : [];

  function begin(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    const track = trackRef.current?.getBoundingClientRect();
    if (!track) return;

    dragging.current = true;
    geometry.current = { trackLeft: track.left, inner };
    event.currentTarget.setPointerCapture(event.pointerId);
    onPreview(timeAt(event.clientX));
  }

  function timeAt(clientX: number): number {
    const geom = geometry.current;
    const at = Math.min(1, Math.max(0, (clientX - geom.trackLeft - PADDING) / Math.max(1, geom.inner)));
    return start + at * span;
  }

  function move(clientX: number) {
    if (!dragging.current) return;
    onPreview(timeAt(clientX));
  }

  function finish(clientX: number) {
    if (!dragging.current) return;
    dragging.current = false;
    onCommit(timeAt(clientX));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      onNudge(-STEP);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      onNudge(STEP);
    } else if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      onCommit(value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  }

  return (
    <div
      ref={trackRef}
      className={cx(
        "relative w-full select-none rounded-2xl border border-border bg-surface-secondary",
        disabled && "opacity-60",
      )}
      style={{ height: TRACK_HEIGHT }}
    >
      <div
        aria-hidden
        className="absolute inset-x-2 top-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-border bg-background"
        style={{ height: BAR_HEIGHT }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-timed-subtle transition-[width] duration-75"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {marks.map((mark, index) => (
        <span
          key={index}
          aria-hidden
          className={cx(
            "absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
            mark <= progress + 1e-9 && !disabled ? "bg-timed" : "bg-border-strong",
          )}
          style={{ left: PADDING + mark * inner }}
        />
      ))}

      <span
        aria-hidden
        className={cx(
          "absolute top-1/2 h-11 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full",
          disabled ? "bg-border-strong" : "bg-timed",
        )}
        style={{ left: PADDING + progress * inner }}
      />

      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Sentence end"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`Sentence end ${formatTime(value)}`}
        aria-disabled={disabled}
        title="Drag to where the sentence ends"
        className={cx(
          "absolute inset-0 touch-none rounded-2xl outline-none",
          disabled ? "cursor-default" : "cursor-ew-resize",
          "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
        onPointerDown={begin}
        onPointerMove={(event) => move(event.clientX)}
        onPointerUp={(event) => finish(event.clientX)}
        onPointerCancel={() => {
          dragging.current = false;
          onCancel();
        }}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
