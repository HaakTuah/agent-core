// The question a file past the *size marks*' split mark asks (tasks/cleaning.md, "Size asks; a reader who reads less
// answers"; #469): in what ways could it be split so that someone reads less? Its line under the marks' "past" answers
// it, with a why or the split's issue, until the file grows a quarter past that line's mark. One judgement, read in two
// places (#1413, point 6): the reading-size check notes it on a pull request that changes such a file and fails
// nothing for it (reading-size.mjs), and the scheduled look keeps it as a task (look-split.mjs). Plain JavaScript.

const num = v => Number.isInteger(v) && v > 0;

// A line's mark: a mark alone, as written before a line took a why, or { "mark", "why" }.
export const markOf = line => num(line) ? line : line?.mark;

// The line to write under "past" for a file of `n` bytes.
export const entryFor = n => `{ "mark": ${n}, "why": "<why no split lets anyone read less, or the split's issue>" }`;

// What a session does with the question, the line to write following it.
export const ASK = `ask in what ways it could be split so that someone reads less (core/tasks/cleaning.md, "Size asks"): split it along one, in a pull request of its own that proves its behaviour unchanged; or, where there is none, write its line under "past" as`;

// Why the question stands for a file of `n` bytes whose line under "past" is `line`, or null where that line answers
// it. `stood`: the line stood as it is before the change read, so a mark alone, written before lines took a why,
// stands until its file grows past it, where one a change writes says why.
export function unanswered(n, line, stood = true) {
  if (line === undefined) return `it has no line under "past"`;
  const mark = markOf(line);
  if (num(line)) return n > mark ? `it has grown past its mark alone, ${mark}, under "past"` : stood ? null : `its line under "past" is a mark alone, with no why`;
  if (!/\p{L}|#\d/u.test(String(line.why ?? "").trim())) return `its line under "past" gives no why`;
  return n > mark * 1.25 ? `it has grown more than a quarter past its mark of ${mark} under "past"` : null;
}
