import type { AdlibEntry, Entry, LyricEntry, Lyrics, Token, Voice } from "./types";

export type LineEntry = LyricEntry | AdlibEntry;

/** Whether an entry is a line, as opposed to a blank row, a comment or a tag. */
export function isLine(entry: Entry | undefined): entry is LineEntry {
  return entry?.kind === "lyric" || entry?.kind === "adlib";
}

/** The text of a line: its tokens joined back together. */
export function plainText(tokens: Token[]): string {
  return tokens.map((token) => token.text).join("").trim();
}

/** Index of the next line after `from`, or -1 when there is none. */
export function nextLine(lyrics: Lyrics, from: number): number {
  for (let index = from + 1; index < lyrics.length; index++) {
    if (isLine(lyrics[index])) return index;
  }
  return -1;
}

/** Index of the line before `from`, or -1 when there is none. */
export function previousLine(lyrics: Lyrics, from: number): number {
  for (let index = from - 1; index >= 0; index--) {
    if (isLine(lyrics[index])) return index;
  }
  return -1;
}

/** The 1-based number of each lyric line; ad-libs, blanks, comments and tags have none. */
export function lineNumbers(lyrics: Lyrics): Array<number | undefined> {
  let count = 0;
  return lyrics.map((entry) => {
    if (entry.kind !== "lyric") return undefined;
    count += 1;
    return count;
  });
}

/** Index of the last line entry, or -1 when the file has none. */
export function lastLineIndex(lyrics: Lyrics): number {
  for (let index = lyrics.length - 1; index >= 0; index--) {
    if (isLine(lyrics[index])) return index;
  }
  return -1;
}

/** The line whose start is the latest one at or before `time`; -1 before the first. */
export function currentLineIndex(lyrics: Lyrics, time: number): number {
  let current = -1;
  lyrics.forEach((entry, index) => {
    if (isLine(entry) && entry.start !== undefined && entry.start <= time) current = index;
  });
  return current;
}

/** Index of the lyric line above `index`, which an ad-lib belongs to; -1 when there is none. */
export function parentOf(lyrics: Lyrics, index: number): number {
  for (let above = index - 1; above >= 0; above--) {
    if (lyrics[above].kind === "lyric") return above;
  }
  return -1;
}

/** Whether a line is timed at all: a line timestamp or any word time. */
export function isTimed(entry: LineEntry): boolean {
  return entry.start !== undefined || entry.tokens.some((token) => token.start !== undefined);
}

/** The side of every entry. An ad-lib sits on the side of the lyric line above it. */
export function resolveVoices(lyrics: Lyrics): Voice[] {
  let voice: Voice = "left";
  return lyrics.map((entry) => {
    if (entry.kind === "lyric") voice = entry.voice;
    return voice;
  });
}

/** Whether a line still has a word that has started but not ended. */
export function hasOpenWord(entry: LineEntry): boolean {
  return entry.tokens.some((token) => token.start !== undefined && token.end === undefined);
}

export interface Summary {
  lyrics: number;
  adlibs: number;
  words: number;
  /** Lines with a line timestamp. */
  timed: number;
  /** Lines whose every word has both times. */
  wordSynced: number;
  /** Lines with some words timed but not all. */
  partial: number;
  /** Timed lines with no word timing yet; `estimate` can fill them in. */
  lineOnly: number;
  /** Ad-libs with no timed lyric line above them. */
  orphans: number;
}

export function summarize(lyrics: Lyrics): Summary {
  const summary: Summary = {
    lyrics: 0,
    adlibs: 0,
    words: 0,
    timed: 0,
    wordSynced: 0,
    partial: 0,
    lineOnly: 0,
    orphans: 0,
  };

  lyrics.forEach((entry, index) => {
    if (!isLine(entry)) return;
    const { tokens, start } = entry;
    const timedWords = tokens.filter((token) => token.start !== undefined && token.end !== undefined);

    if (entry.kind === "adlib") summary.adlibs++;
    else summary.lyrics++;
    summary.words += tokens.length;

    if (start !== undefined) summary.timed++;
    if (timedWords.length > 0 && timedWords.length === tokens.length) summary.wordSynced++;
    else if (timedWords.length > 0) summary.partial++;
    if (start !== undefined && tokens.every((token) => token.start === undefined)) summary.lineOnly++;

    if (entry.kind === "adlib") {
      const parent = lyrics[parentOf(lyrics, index)];
      if (!isLine(parent) || parent.start === undefined) summary.orphans++;
    }
  });

  return summary;
}
