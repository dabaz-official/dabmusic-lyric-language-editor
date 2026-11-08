import { setTokenText } from "./edit";
import { isLine, nextLine, parentOf, resolveVoices, type LineEntry } from "./model";
import { roundTime } from "./time";
import type { Entry, Lyrics, Token } from "./types";
import { spreadWordTimings } from "./word-sync";

/** `word` taps the next word of the active line; `line` taps the line start. */
export type SyncMode = "word" | "line";

/** A token, by its entry index in the lyrics and its index within that line. */
export interface TokenRef {
  entry: number;
  token: number;
}

/** The lyrics, plus where syncing currently is. */
export interface EditorState {
  lyrics: Lyrics;
  /** The line the next tap writes to, or -1 when no line is being synced. */
  active: number;
  /** The token of the active line that the next tap writes to. */
  cursor: number;
  /** The token that the restamp and nudge keys act on. */
  selected?: TokenRef;
}

export interface History {
  past: EditorState[];
  present: EditorState;
}

type Edge = "start" | "end";

export type Action =
  | { type: "load"; lyrics: Lyrics }
  | { type: "replace"; lyrics: Lyrics }
  | { type: "activate"; entry: number; time: number }
  | { type: "selectToken"; ref: TokenRef; time: number }
  | { type: "tap"; time: number; mode: SyncMode }
  | { type: "endWord"; time: number }
  | { type: "closeLine"; time: number }
  | { type: "restamp"; edge: Edge; time: number }
  | { type: "nudge"; edge: Edge; delta: number }
  | { type: "setTokenText"; ref: TokenRef; text: string }
  | { type: "setLineStart"; entry: number; time: number }
  | { type: "shiftLine"; entry: number; delta: number }
  | { type: "setLineWords"; entry: number; start?: number; tokens: Token[] }
  | { type: "setLineEnd"; entry: number; time: number }
  | { type: "clearLineEnd"; entry: number }
  | { type: "nudgeLineEnd"; entry: number; delta: number }
  | { type: "setLineSpan"; entry: number; start?: number; end: number }
  | { type: "toggleVoice"; entry: number }
  | { type: "toggleAdlib"; entry: number }
  | { type: "clearTiming"; entry: number }
  | { type: "estimate" }
  | { type: "undo" };

const HISTORY_LIMIT = 200;
/** Seconds given to a timed line that has no timed line after it. */
const FALLBACK_SPAN = 3;

/** Actions that change the lyrics. Selection and navigation are not undo steps. */
const RECORDED = new Set<Action["type"]>([
  "replace",
  "tap",
  "endWord",
  "closeLine",
  "restamp",
  "nudge",
  "setTokenText",
  "setLineStart",
  "shiftLine",
  "setLineWords",
  "setLineEnd",
  "clearLineEnd",
  "nudgeLineEnd",
  "setLineSpan",
  "toggleVoice",
  "toggleAdlib",
  "clearTiming",
  "estimate",
]);

export function createState(lyrics: Lyrics): EditorState {
  const active = lyrics.findIndex((entry) => isLine(entry));
  const line = active < 0 ? undefined : lyrics[active];
  return { lyrics, active, cursor: isLine(line) ? firstOpenToken(line.tokens) : 0 };
}

export const EMPTY_HISTORY: History = { past: [], present: createState([]) };

/** Applies an action, keeping the states that `undo` steps back through. */
export function historyReducer(history: History, action: Action): History {
  if (action.type === "load") return { past: [], present: createState(action.lyrics) };
  if (action.type === "undo") {
    const previous = history.past[history.past.length - 1];
    return previous ? { past: history.past.slice(0, -1), present: previous } : history;
  }

  const present = step(history.present, action);
  if (present === history.present) return history;
  if (!RECORDED.has(action.type)) return { past: history.past, present };
  return { past: [...history.past.slice(-(HISTORY_LIMIT - 1)), history.present], present };
}

function step(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "replace":
      return createState(action.lyrics);
    case "activate":
      return activate(state, action.entry, action.time);
    case "selectToken":
      return selectToken(state, action.ref, action.time);
    case "tap":
      return tap(state, action.time, action.mode);
    case "endWord":
      return endOpenWord(state, action.time);
    case "closeLine":
      return closeLine(state, action.time);
    case "restamp":
      return restamp(state, action.edge, action.time);
    case "nudge":
      return nudge(state, action.edge, action.delta);
    case "setTokenText":
      return editTokenText(state, action.ref, action.text);
    case "setLineStart":
      return setLineStart(state, action.entry, action.time);
    case "shiftLine":
      return shiftLine(state, action.entry, action.delta);
    case "setLineWords":
      return setLineWords(state, action.entry, action.start, action.tokens);
    case "setLineEnd":
      return setLineEnd(state, action.entry, action.time);
    case "clearLineEnd":
      return clearLineEnd(state, action.entry);
    case "nudgeLineEnd":
      return nudgeLineEnd(state, action.entry, action.delta);
    case "setLineSpan":
      return setLineSpan(state, action.entry, action.start, action.end);
    case "toggleVoice":
      return toggleVoice(state, action.entry);
    case "toggleAdlib":
      return toggleAdlib(state, action.entry);
    case "clearTiming":
      return clearTiming(state, action.entry);
    case "estimate":
      return estimate(state);
    default:
      return state;
  }
}

function lineAt(state: EditorState, index: number): LineEntry | undefined {
  const entry = index >= 0 ? state.lyrics[index] : undefined;
  return isLine(entry) ? entry : undefined;
}

function setLine(lyrics: Lyrics, index: number, entry: Entry): Lyrics {
  return lyrics.map((item, i) => (i === index ? entry : item));
}

/** The token a new tap would write to: the first one without a start. */
function firstOpenToken(tokens: Token[]): number {
  const index = tokens.findIndex((token) => token.start === undefined);
  return index < 0 ? 0 : index;
}

/** A word that has its start but is still waiting for its end. */
function isEndPending(token: Token): boolean {
  return token.start !== undefined && token.end === undefined;
}

/** Ends a word at `time`, never before its start. */
function endAt(token: Token, time: number): Token {
  return { ...token, end: Math.max(token.start ?? time, roundTime(time)) };
}

/** Ends the word just before the cursor, if it is still waiting for its end. */
function endOpenWord(state: EditorState, time: number): EditorState {
  const line = lineAt(state, state.active);
  const index = state.cursor - 1;
  const token = line?.tokens[index];
  if (!line || !token || !isEndPending(token)) return state;

  const tokens = line.tokens.map((item, i) => (i === index ? endAt(item, time) : item));
  return { ...state, lyrics: setLine(state.lyrics, state.active, { ...line, tokens }) };
}

/** Makes `entry` the line being synced, ending the word still open on the line being left. */
function activate(state: EditorState, entry: number, time: number): EditorState {
  const closed = endOpenWord(state, time);
  const line = lineAt(closed, entry);
  if (!line) return { ...closed, active: -1, cursor: 0, selected: undefined };
  return { ...closed, active: entry, cursor: firstOpenToken(line.tokens), selected: undefined };
}

/** Points the cursor and the nudge keys at one token, switching lines when needed. */
function selectToken(state: EditorState, ref: TokenRef, time: number): EditorState {
  const base = ref.entry === state.active ? state : activate(state, ref.entry, time);
  const line = lineAt(base, ref.entry);
  if (!line || !line.tokens[ref.token]) return base;
  return { ...base, cursor: ref.token, selected: ref };
}

/** Taps the next word of the active line, or its start in line mode. */
function tap(state: EditorState, time: number, mode: SyncMode): EditorState {
  const line = lineAt(state, state.active);
  if (!line) return state;

  if (mode === "line") {
    const lyrics = setLine(state.lyrics, state.active, { ...line, start: roundTime(time) });
    return activate({ ...state, lyrics }, nextLine(lyrics, state.active), time);
  }

  const { cursor } = state;
  // Nothing left to stamp: the tap ends the word still being sung, so the last
  // word of a line (or a line of one word) can be closed without leaving it open.
  if (cursor >= line.tokens.length) return endOpenWord(state, time);

  const at = roundTime(time);
  const tokens = line.tokens.map((token, index): Token => {
    if (index === cursor - 1 && isEndPending(token)) return endAt(token, at);
    if (index === cursor) return { text: token.text, start: at };
    return token;
  });
  const start = cursor === 0 ? at : (line.start ?? at);
  const lyrics = setLine(state.lyrics, state.active, { ...line, start, tokens });
  return { ...state, lyrics, cursor: cursor + 1, selected: { entry: state.active, token: cursor } };
}

/** Ends the open word and moves on to the next line. */
function closeLine(state: EditorState, time: number): EditorState {
  if (state.active < 0) return state;
  return activate(state, nextLine(state.lyrics, state.active), time);
}

function withStart(token: Token, start: number): Token {
  return { ...token, start, end: token.end === undefined ? undefined : Math.max(token.end, start) };
}

function withEnd(token: Token, end: number): Token {
  return { ...token, end: Math.max(token.start ?? end, end) };
}

function editToken(state: EditorState, ref: TokenRef, change: (token: Token) => Token): EditorState {
  const line = lineAt(state, ref.entry);
  const token = line?.tokens[ref.token];
  if (!line || !token) return state;

  const tokens = line.tokens.map((item, index) => (index === ref.token ? change(token) : item));
  const start = ref.token === 0 && tokens[0].start !== undefined ? tokens[0].start : line.start;
  return { ...state, lyrics: setLine(state.lyrics, ref.entry, { ...line, start, tokens }) };
}

/** Sets the selected word's start or end to the playhead. */
function restamp(state: EditorState, edge: Edge, time: number): EditorState {
  if (!state.selected) return state;
  const at = roundTime(time);
  return editToken(state, state.selected, (token) =>
    edge === "start" ? withStart(token, at) : withEnd(token, at),
  );
}

/** Moves the selected word's start or end by `delta` seconds. */
function nudge(state: EditorState, edge: Edge, delta: number): EditorState {
  if (!state.selected) return state;
  return editToken(state, state.selected, (token) => {
    if (edge === "start") {
      return token.start === undefined ? token : withStart(token, roundTime(token.start + delta));
    }
    return token.end === undefined ? token : withEnd(token, roundTime(token.end + delta));
  });
}

/**
 * Replaces one word's text, keeping its timing. A word that turns into several
 * words splits its own span, so the cursor and the selected word still point at
 * the same place in the line.
 */
function editTokenText(state: EditorState, ref: TokenRef, text: string): EditorState {
  const line = lineAt(state, ref.entry);
  if (!line || !line.tokens[ref.token]) return state;

  const { tokens, shift } = setTokenText(line.tokens, ref.token, text);
  if (tokens === line.tokens) return state;

  const start = ref.token === 0 && tokens[0].start !== undefined ? tokens[0].start : line.start;
  const lyrics = setLine(state.lyrics, ref.entry, { ...line, start, tokens });

  const cursor =
    ref.entry === state.active && state.cursor > ref.token
      ? Math.min(state.cursor + shift, tokens.length)
      : state.cursor;
  const selected =
    state.selected?.entry === ref.entry && state.selected.token > ref.token
      ? { ...state.selected, token: state.selected.token + shift }
      : state.selected;

  return { ...state, lyrics, cursor, selected };
}

/**
 * Sets a line's start. A line that already had one moves its words with it, so
 * the relative alignment survives a correction.
 */
function setLineStart(state: EditorState, index: number, time: number): EditorState {
  const line = lineAt(state, index);
  if (!line) return state;

  const at = roundTime(time);
  if (line.start === undefined) {
    return { ...state, lyrics: setLine(state.lyrics, index, { ...line, start: at }) };
  }
  return shiftLine(state, index, at - line.start);
}

/** Moves a line's start and every word time by `delta` seconds. */
function shiftLine(state: EditorState, index: number, delta: number): EditorState {
  const line = lineAt(state, index);
  if (!line || line.start === undefined) return state;

  const start = roundTime(Math.max(0, line.start + delta));
  // `roundTime` clamps to zero, so a signed delta needs its own rounding.
  const shift = Math.round((start - line.start) * 100) / 100;
  if (shift === 0) return state;

  const tokens = line.tokens.map((token) => shiftToken(token, shift));
  return { ...state, lyrics: setLine(state.lyrics, index, { ...line, start, tokens }) };
}

function shiftToken(token: Token, delta: number): Token {
  if (token.start === undefined) return token;
  const start = roundTime(Math.max(0, token.start + delta));
  const end = token.end === undefined ? undefined : roundTime(Math.max(start, token.end + delta));
  return { ...token, start, end };
}

/** Replaces a line's word timing after the Word tab's gesture. */
function setLineWords(
  state: EditorState,
  index: number,
  start: number | undefined,
  tokens: Token[],
): EditorState {
  const line = lineAt(state, index);
  if (!line) return state;
  const nextStart = start === undefined ? line.start : roundTime(start);
  return { ...state, lyrics: setLine(state.lyrics, index, { ...line, start: nextStart, tokens }) };
}

/** The start of the line's last word: its own, or where the word before it left off. */
function lastWordStart(line: LineEntry, index: number): number {
  const token = line.tokens[index];
  if (token.start !== undefined) return token.start;
  const previous = line.tokens[index - 1];
  return previous?.end ?? previous?.start ?? line.start ?? 0;
}

/**
 * Sets where a line ends. DMLL has no field for a line end, so it lives on the
 * last word's `end`. A line that has only its start gets its words spread over
 * the new span in proportion to their text, the same way `estimate` does, so
 * the end survives a save; a line that already has word timing only moves the
 * last word's end.
 */
function setLineEnd(state: EditorState, index: number, time: number): EditorState {
  const line = lineAt(state, index);
  const at = line === undefined ? -1 : line.tokens.length - 1;
  const last = at >= 0 ? line?.tokens[at] : undefined;
  if (!line || !last || line.start === undefined) return state;

  const end = roundTime(Math.max(line.start, time));
  const timed = line.tokens.some((token) => token.start !== undefined || token.end !== undefined);

  if (!timed) {
    const tokens = spreadWordTimings(line.tokens, line.start, end);
    return { ...state, lyrics: setLine(state.lyrics, index, { ...line, tokens }) };
  }

  const start = lastWordStart(line, at);
  const endAt = roundTime(Math.max(start, end));
  if (last.start === start && last.end === endAt) return state;

  const tokens = line.tokens.map((token, tokenIndex) =>
    tokenIndex === at ? { ...token, start, end: endAt } : token,
  );
  return { ...state, lyrics: setLine(state.lyrics, index, { ...line, tokens }) };
}

/** Removes the last word's end, which is where the line ended. */
function clearLineEnd(state: EditorState, index: number): EditorState {
  const line = lineAt(state, index);
  const at = line === undefined ? -1 : line.tokens.length - 1;
  if (!line || at < 0 || line.tokens[at].end === undefined) return state;

  const tokens = line.tokens.map((token, tokenIndex) =>
    tokenIndex === at ? { ...token, end: undefined } : token,
  );
  return { ...state, lyrics: setLine(state.lyrics, index, { ...line, tokens }) };
}

/**
 * Fills a whole line from `start`–`end`: every word gets a slice in proportion
 * to its text. This is the Word tab's sentence gesture, so it rewrites any
 * earlier word timing instead of keeping it.
 */
function setLineSpan(
  state: EditorState,
  index: number,
  start: number | undefined,
  end: number,
): EditorState {
  const line = lineAt(state, index);
  if (!line || line.tokens.length === 0) return state;

  const from = roundTime(Math.max(0, start ?? line.start ?? 0));
  const to = roundTime(Math.max(from, end));
  const tokens = spreadWordTimings(line.tokens, from, to);

  const unchanged =
    line.start === from &&
    tokens.every(
      (token, tokenIndex) =>
        token.start === line.tokens[tokenIndex].start && token.end === line.tokens[tokenIndex].end,
    );
  if (unchanged) return state;

  return { ...state, lyrics: setLine(state.lyrics, index, { ...line, start: from, tokens }) };
}

/** Moves the line's end by `delta` seconds; a line without an end keeps none. */
function nudgeLineEnd(state: EditorState, index: number, delta: number): EditorState {
  const line = lineAt(state, index);
  const at = line === undefined ? -1 : line.tokens.length - 1;
  const last = at >= 0 ? line?.tokens[at] : undefined;
  if (!line || !last || last.start === undefined || last.end === undefined) return state;

  const end = roundTime(Math.max(last.start, last.end + delta));
  if (end === last.end) return state;

  const tokens = line.tokens.map((token, tokenIndex) =>
    tokenIndex === at ? { ...token, end } : token,
  );
  return { ...state, lyrics: setLine(state.lyrics, index, { ...line, tokens }) };
}

function toggleVoice(state: EditorState, index: number): EditorState {
  const entry = lineAt(state, index);
  if (entry?.kind !== "lyric") return state;
  const voice = entry.voice === "left" ? "right" : "left";
  return { ...state, lyrics: setLine(state.lyrics, index, { ...entry, voice }) };
}

/** Turns a lyric line into an ad-lib under the lyric above it, and back. */
function toggleAdlib(state: EditorState, index: number): EditorState {
  const entry = lineAt(state, index);
  if (!entry) return state;

  if (entry.kind === "lyric") {
    if (parentOf(state.lyrics, index) < 0) return state;
    const adlib = { kind: "adlib" as const, start: entry.start, tokens: entry.tokens };
    return { ...state, lyrics: setLine(state.lyrics, index, adlib) };
  }

  const voice = resolveVoices(state.lyrics)[index];
  const lyric = { kind: "lyric" as const, voice, start: entry.start, tokens: entry.tokens };
  return { ...state, lyrics: setLine(state.lyrics, index, lyric) };
}

function clearTiming(state: EditorState, index: number): EditorState {
  const entry = lineAt(state, index);
  if (!entry) return state;

  const tokens = entry.tokens.map(({ text }): Token => ({ text }));
  return {
    ...state,
    lyrics: setLine(state.lyrics, index, { ...entry, start: undefined, tokens }),
    cursor: index === state.active ? 0 : state.cursor,
    selected: state.selected?.entry === index ? undefined : state.selected,
  };
}

/** The start of the next line that has a timestamp, if there is one. */
function nextStart(lyrics: Lyrics, index: number): number | undefined {
  for (let later = index + 1; later < lyrics.length; later++) {
    const entry = lyrics[later];
    if (isLine(entry) && entry.start !== undefined) return entry.start;
  }
  return undefined;
}

/** Gives every line that has a timestamp but no word timing an estimated word timing. */
function estimate(state: EditorState): EditorState {
  const needs = state.lyrics.map(
    (entry) => isLine(entry) && entry.start !== undefined && entry.tokens.every((token) => token.start === undefined),
  );
  if (!needs.includes(true)) return state;

  const lyrics = state.lyrics.map((entry, index) => {
    if (!needs[index] || !isLine(entry) || entry.start === undefined) return entry;
    const to = nextStart(state.lyrics, index) ?? entry.start + FALLBACK_SPAN;
    return { ...entry, tokens: spreadWordTimings(entry.tokens, entry.start, to) };
  });
  return { ...state, lyrics };
}
