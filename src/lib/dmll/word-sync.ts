import { roundTime } from "./time";
import type { Token } from "./types";

/**
 * Where each word starts, as a fraction of the line, plus 1 for the line's end.
 *
 * The whole rail is this line, so the words divide it in proportion to their
 * text length: `boundaries[i]` is the start of word `i`, and
 * `boundaries[i + 1]` is its end. A one-word token list is `[0, 1]`.
 */
export function wordBoundaries(tokens: Token[]): number[] {
  if (tokens.length === 0) return [0];

  const weights = tokens.map((token) => Math.max(1, token.text.trim().length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const boundaries = [0];
  let sum = 0;
  for (const weight of weights) {
    sum += weight;
    boundaries.push(sum / total);
  }
  // Avoid `0.9999999` at the right edge.
  boundaries[boundaries.length - 1] = 1;
  return boundaries;
}

/**
 * Gives every word a slice of `from`–`to`, in proportion to its text length.
 * This is the sentence-level fill: one span in, all word times out. The last
 * word always ends exactly at `to`; an empty span gives every word a zero
 * length at `from`.
 */
export function spreadWordTimings(tokens: Token[], from: number, to: number): Token[] {
  if (tokens.length === 0) return tokens;

  const boundaries = wordBoundaries(tokens);
  const start = roundTime(Math.max(0, from));
  const end = roundTime(Math.max(0, to));
  const span = Math.max(0, end - start);

  return tokens.map((token, index) => {
    const wordStart = start + span * boundaries[index];
    const wordEnd = index === tokens.length - 1 ? end : start + span * boundaries[index + 1];
    return {
      text: token.text,
      start: roundTime(wordStart),
      end: roundTime(Math.max(wordStart, wordEnd)),
    };
  });
}
