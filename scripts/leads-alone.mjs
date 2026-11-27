// Whether the old path at `at` in `text`, the text of the file `file`, is a pointer to the file alone, so that the
// paths writer (step-writers.mjs, `movedIn`) writes it as the folder the file moved to: in a Markdown file, outside a
// fenced block, a code span `core/<old>` whose sentence names no quoted title, no numbered rule, point, section, step
// or part and no `'s`. A section or rule cited through it would lead into no file, and anything else (a pull-in, `@` or
// `#[[file:`, an exclusion, a permission's path, a path a script reads) would lead into a folder no tool reads or widen
// to its every file, so each is left for the step's mend (#1361, point 8). The test is the writer's own and wider than
// the pointers check's joining (scripts/pointers.mjs): where it errs, a path is left for the mend. The size marks keep
// their own guard: a mark of a folder means nothing (marksMoved).
const CITES = /["“”]|\b(?:rules?|points?|sections?|steps?|parts?)\s+\d|^['’]s\b/iu;
const FENCE = /^ {0,3}(?:```|~~~)/gmu, BREAK = /\n\s*\n|\n\s*(?:[-*+]|\d+[.)])\s|[.!?;](?=\s)/gu;
export function leadsAlone(file, text, at, length) {
  if (!/\.(?:md|mdc|markdown)$/iu.test(file) || text[at - 1] !== "`"
    || text[at + length] !== "`" || (text.slice(0, at).match(FENCE)?.length ?? 0) % 2) return false;
  const before = text.slice(Math.max(0, at - 201), at - 1), after = text.slice(at + length + 1, at + length + 201);
  const from = [...before.matchAll(BREAK)].at(-1), to = after.search(BREAK);
  return !CITES.test(from ? before.slice(from.index + from[0].length) : before) && !CITES.test(to < 0 ? after : after.slice(0, to));
}
