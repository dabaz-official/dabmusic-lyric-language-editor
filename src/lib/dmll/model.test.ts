import { describe, expect, it } from "vitest";

import { currentLineIndex, lastLineIndex, lineNumbers, nextLine, previousLine } from "./model";
import type { Lyrics } from "./types";

const lyrics: Lyrics = [
  { kind: "comment", text: "// a note" },
  { kind: "lyric", voice: "left", start: 1, tokens: [{ text: "one" }] },
  { kind: "blank" },
  { kind: "adlib", start: 2, tokens: [{ text: "two" }] },
  { kind: "meta", text: "[ar:Artist]" },
  { kind: "lyric", voice: "right", start: 3, tokens: [{ text: "three" }] },
];

const timed: Lyrics = [
  {
    kind: "lyric",
    voice: "left",
    start: 1,
    tokens: [
      { text: "a ", start: 1, end: 2 },
      { text: "b", start: 2, end: 3 },
    ],
  },
  { kind: "blank" },
  { kind: "adlib", start: 4, tokens: [{ text: "c" }] },
  { kind: "lyric", voice: "left", start: 5, tokens: [{ text: "d", start: 5, end: 6 }] },
  { kind: "comment", text: "// end" },
];

describe("line navigation", () => {
  it("skips blanks, comments, tags and ad-libs", () => {
    expect(nextLine(lyrics, -1)).toBe(1);
    expect(nextLine(lyrics, 1)).toBe(3);
    expect(nextLine(lyrics, 3)).toBe(5);
    expect(nextLine(lyrics, 5)).toBe(-1);

    expect(previousLine(lyrics, 5)).toBe(3);
    expect(previousLine(lyrics, 3)).toBe(1);
    expect(previousLine(lyrics, 1)).toBe(-1);
    expect(previousLine(lyrics, 0)).toBe(-1);
  });

  it("numbers only lyric lines", () => {
    expect(lineNumbers(lyrics)).toEqual([undefined, 1, undefined, undefined, undefined, 2]);
  });
});

describe("playback helpers", () => {
  it("finds the line whose start is the latest at or before the time", () => {
    expect(currentLineIndex(timed, 0.5)).toBe(-1);
    expect(currentLineIndex(timed, 1)).toBe(0);
    expect(currentLineIndex(timed, 3.5)).toBe(0);
    expect(currentLineIndex(timed, 4)).toBe(2);
    expect(currentLineIndex(timed, 5)).toBe(3);
    expect(currentLineIndex(timed, 60)).toBe(3);
    expect(lastLineIndex(timed)).toBe(3);
  });
});
