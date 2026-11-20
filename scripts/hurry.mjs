// What the selection (select.mjs) allows its reading, so that however many files a pull request changes, and however
// large the project, the selection answers within SECURITY.md's 5 s, rule 5 (#881, #962): the characters of the changed
// files of code together, the time the readers take over them together, the time the linking takes, and the time the
// whole run takes from the watch's start, the project's own files read too, past any of which the selection reads no
// more and the whole suite runs, its answer where it cannot tell a file's reach. Each reader holds one file to 2 s on
// its own (tree-walk.mjs); these are the limits on all of them. Node's own modules: none.

/** The most characters of changed code, all files together, the readers take; the lexer alone reads a file the parser
 *  is not given (past `LARGEST` in tree-walk.mjs) at about 0.3 s for each million, so 4 million stay within about 1.5 s. */
export const CHARACTERS = 4_000_000;
/** The most time, in milliseconds, the readers take over the changed files together: a file read after the budget is
 *  passed can take about 3 s more, so this keeps the readers within about 4.5 s, and the run stops there (`Late`). The
 *  changed files are read first (shape.mjs, survey()), so this is spent before the project's own files are read. */
export const SPENT_MS = 1500;
/** The most time, in milliseconds, the selection takes to link each file to the files whose names it holds and to follow
 *  those links from each test, after the readers: about 0.3 s on the core's own 383 files, and in step with the files'
 *  characters (name-trie.mjs), so that what takes it near this is a pull request's own files, as many tests each naming
 *  many others, or a project about four times the core's size, 20 million characters, as `ALL_MS` is. */
export const LINKS_MS = 1500;
/** The most time, in milliseconds, from the watch's start, the selection takes to read every file of code, the project's
 *  own that the pull request leaves as they were among them, and to link them and follow the links (#962): with the
 *  process's start, its reading of the tree and git's answer before the watch (about 0.3 s), and one file read or one
 *  stretch of linking past it, the run stays within about 4 s. The selection reads only imports, no functions, so
 *  JavaScript and TypeScript take about 0.15 s for each million characters all told and the core's own 383 files about
 *  0.9 s, and a project of about 20 million characters runs the whole suite on its size alone; Python and C#, whose
 *  imports only their parser reads, take about 1.2 s and 1.9 s for each million, so for them it is about 2.5 million
 *  characters of Python, or 1.7 million of C#. */
export const ALL_MS = 3500;

/** Raised where the changed files are more than the selection allows to read; `message` says why the whole suite runs. */
export class Late extends Error {}

/** A watch over one run's reading: `files` the paths the pull request changes. `size(texts)` fails at once where the
 *  changed files (of code, and the package files read beside it), as `texts` holds them, are past `characters`;
 *  `first(paths)` gives the changed ones first, in the order given, then the rest; `timed(file, read)` runs `read` and,
 *  where the changed files read so far have taken past `ms`, or the run since the watch began past `all`, fails. */
export function hurry({ files, ms = SPENT_MS, characters = CHARACTERS, all = ALL_MS, now = Date.now }) {
  let spent = 0;
  const began = now();
  const whole = () => { const took = now() - began; if (took > all) throw new Late(`reading the project's files of code and linking them took ${took} ms, past the ${all} ms the selection allows, so what each reaches cannot be told in time`); };
  return {
    // A check, called as the files are linked and the links followed, that fails once that has taken past `ms` since this
    // was asked, or the run past `all` since the watch began.
    pace(ms = LINKS_MS) {
      const from = now();
      return () => { const took = now() - from; if (took > ms) throw new Late(`linking the files and following the links from the tests took ${took} ms, past the ${ms} ms the selection allows, so what each reaches cannot be told in time`); whole(); };
    },
    size(texts) {
      const n = Object.entries(texts).reduce((sum, [file, text]) => sum + (files.has(file) ? text.length : 0), 0);
      if (n > characters) throw new Late(`the changed files hold ${n.toLocaleString("en")} characters, past the ${characters.toLocaleString("en")} the selection reads, so what each reaches cannot be told in time`);
    },
    first: paths => [...paths.filter(f => files.has(f)), ...paths.filter(f => !files.has(f))],
    timed(file, read) {
      const from = now(), out = read();
      if (files.has(file)) spent += now() - from;
      if (spent > ms) throw new Late(`reading the changed files of code took ${spent} ms, past the ${ms} ms the selection allows, so what each reaches cannot be told in time`);
      whole();
      return out;
    },
  };
}
