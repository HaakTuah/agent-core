// What the selection (select.mjs) allows the reading of the files a pull request changes, so that however many it
// changes the selection answers within SECURITY.md's 5 s, rule 5 (#881): the characters of the changed files of code
// together, and the time the readers take over them together, past which the selection reads no more and the whole
// suite runs, its answer where it cannot tell a file's reach. Each reader holds one file to 2 s on its own
// (tree-walk.mjs); this is the limit on all of them. A file the pull request leaves as it was is the project's own and
// counts for neither. Node's own modules: none.

/** The most characters of changed code, all files together, the readers take; the lexer alone reads a file the parser
 *  is not given (past `LARGEST` in tree-walk.mjs) at about 0.3 s for each million, so 4 million stay within about 1.5 s. */
export const CHARACTERS = 4_000_000;
/** The most time, in milliseconds, the readers take over the changed files together: a file read after the budget is
 *  passed can take about 3 s more, so this keeps the readers within about 4.5 s, and the run stops there (`Late`). */
export const SPENT_MS = 1500;
/** The most time, in milliseconds, the selection takes to link each file to the files whose names it holds and to follow
 *  those links from each test, after the readers: it grows with the files' count times their characters (and with the
 *  tests' count times the links), about 0.7 s on the core's own 375 files. */
export const LINKS_MS = 1500;

/** Raised where the changed files are more than the selection allows to read; `message` says why the whole suite runs. */
export class Late extends Error {}

/** A watch over one run's reading: `files` the paths the pull request changes. `size(texts)` fails at once where the
 *  changed files (of code, and the package files read beside it), as `texts` holds them, are past `characters`; `timed(file, read)` runs `read` and, where the
 *  files read so far have taken past `ms`, fails; a file that is not a changed one is read unwatched. */
export function hurry({ files, ms = SPENT_MS, characters = CHARACTERS, now = Date.now }) {
  let spent = 0;
  return {
    // A check, called as the files are linked and the links followed, that fails once that has taken past `ms` since this was asked.
    pace(ms = LINKS_MS) {
      const from = now();
      return () => { const took = now() - from; if (took > ms) throw new Late(`linking the files and following the links from the tests took ${took} ms, past the ${ms} ms the selection allows, so what each reaches cannot be told in time`); };
    },
    size(texts) {
      const n = Object.entries(texts).reduce((sum, [file, text]) => sum + (files.has(file) ? text.length : 0), 0);
      if (n > characters) throw new Late(`the changed files hold ${n.toLocaleString("en")} characters, past the ${characters.toLocaleString("en")} the selection reads, so what each reaches cannot be told in time`);
    },
    timed(file, read) {
      if (!files.has(file)) return read();
      const from = now(), out = read();
      spent += now() - from;
      if (spent > ms) throw new Late(`reading the changed files of code took ${spent} ms, past the ${ms} ms the selection allows, so what each reaches cannot be told in time`);
      return out;
    },
  };
}
