import { describe, expect, it } from "vitest";

import type { Token } from "./types";
import { spreadWordTimings, wordBoundaries } from "./word-sync";

const words = (...texts: string[]): Token[] => texts.map((text) => ({ text }));

describe("wordBoundaries", () => {
  it("splits the line by the words' text length", () => {
    expect(wordBoundaries(words("a", "bbb"))).toEqual([0, 0.25, 1]);
    expect(wordBoundaries(words("only"))).toEqual([0, 1]);
    expect(wordBoundaries([])).toEqual([0]);
  });
});

describe("spreadWordTimings", () => {
  it("gives equal words an equal slice of the sentence", () => {
    const tokens = spreadWordTimings(words("aaa ", "bbb ", "ccc"), 3, 6);

    expect(tokens).toEqual([
      { text: "aaa ", start: 3, end: 4 },
      { text: "bbb ", start: 4, end: 5 },
      { text: "ccc", start: 5, end: 6 },
    ]);
  });

  it("weights the slices by the words' text length", () => {
    // "alpha" is 5 characters and "beta" 4, so the boundary is 5/9 of the span.
    const tokens = spreadWordTimings(words("alpha ", "beta"), 1, 4);

    expect(tokens).toEqual([
      { text: "alpha ", start: 1, end: 2.67 },
      { text: "beta", start: 2.67, end: 4 },
    ]);
  });

  it("gives one word the whole span", () => {
    expect(spreadWordTimings(words("only"), 2, 2.5)).toEqual([{ text: "only", start: 2, end: 2.5 }]);
  });

  it("turns a zero-length sentence into zero-length words", () => {
    const tokens = spreadWordTimings(words("one ", "two"), 4, 4);

    expect(tokens).toEqual([
      { text: "one ", start: 4, end: 4 },
      { text: "two", start: 4, end: 4 },
    ]);
  });

  it("rewrites earlier word timing instead of keeping it", () => {
    const tokens = spreadWordTimings([{ text: "one ", start: 0, end: 1 }, { text: "two", start: 1, end: 2 }], 5, 7);

    expect(tokens).toEqual([
      { text: "one ", start: 5, end: 6 },
      { text: "two", start: 6, end: 7 },
    ]);
  });
});
