// Tests of the proof that a change to the floor or the review guidelines only follows files the pull request moves
// (path-only.mjs; floor rule 3, "The owner's yes in the PR"; #886, point 1): a move followed is proven, and every other
// change is refused, with its mend. Pure: it gives the proof what git would, and starts no process.
//
//   node tests/path-only-test.mjs
import { INVALID, ROOTS, WORKFLOW, failure, foldersOf, follows, ownFiles, spellings, tokens, verdicts } from "../scripts/path-only.mjs";
import { mended } from "../scripts/mend.mjs";

let failed = 0, count = 0;
const ok = (cond, what) => { count++; console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };

const FLOOR = "floor/security.md", GUIDE = "roles/shared/review-guidelines.md";
const before = "Rule 3: `scripts/old.mjs` proves it; see scripts/tools/ and scripts/tools/a.mjs.\n";
const moves = [{ from: "scripts/old.mjs", to: "scripts/new.mjs" }, { from: "scripts/tools/a.mjs", to: "scripts/kit/a.mjs" }, { from: "scripts/tools", to: "scripts/kit", folder: true }];
const one = (after, extra = {}) => verdicts({ changed: [{ path: FLOOR, status: "M", modes: ["100644", "100644"], before, after, ...extra }], moves, ...extra.opts });
const proven = v => v.proven.length === 1 && v.refused.length === 0;
const refused = (v, re) => v.proven.length === 0 && v.refused.length === 1 && re.test(v.refused[0].why);

ok(proven(one("Rule 3: `scripts/new.mjs` proves it; see scripts/kit/ and scripts/kit/a.mjs.\n")), "a file's path and a folder's, with its slash, that follow the moves are proven");
ok(proven(one("Rule 3: `scripts/new.mjs` proves it; see scripts/tools/ and scripts/kit/a.mjs.\n")), "a path left where it stood, beside one followed, is proven: only what changes is read");
ok(refused(one("Rule 3: `scripts/new.mjs` proves all; see scripts/kit/ and scripts/kit/a.mjs.\n"), /changes words that are no path of a move: ".*proves it.*" becomes ".*proves all.*"/u), "a word changed beside a path followed is refused, saying where");
ok(refused(one("Rule 3: `scripts/other.mjs` proves it; see scripts/tools/ and scripts/tools/a.mjs.\n"), /changes more than paths/u), "a path changed to one no move names is refused");
ok(refused(one("Rule 3: `scripts/kit/a.mjs` proves it; see scripts/tools/ and scripts/tools/a.mjs.\n"), /the path `scripts\/old\.mjs` becomes `scripts\/kit\/a\.mjs`, which is not where/u), "a path changed to another move's new path is refused");
ok(refused(verdicts({ changed: [{ path: FLOOR, status: "M", modes: ["100644", "100644"], before: "see `scripts/new.mjs`", after: "see `scripts/old.mjs`" }], moves }), /not where the pull request moves it/u), "a new path turned back to its old one is refused");
ok(refused(one("Rule 3: `scripts/old.mjs` proves it; see scripts/kit/ and scripts/kit/a.mjs.\n", { status: "A" }), /added, deleted or moved/u), "a file that asks the yes and is added, deleted or moved itself is refused");
ok(refused(one(before.replace("old", "new"), { modes: ["100644", "100755"] }), /not a regular file/u) && refused(one(before.replace("old", "new"), { modes: ["120000", "120000"] }), /not a regular file/u), "a mode changed, or a link, is refused");
ok(refused(verdicts({ changed: [{ path: GUIDE, status: "M", modes: ["100644", "100644"], before, after: before.replace("old", "new") }, { path: "scripts/path-only.mjs", status: "M" }], moves, self: true }), /is not main.s/u), "where the pull request changes the proof or what it imports, nothing is proven");
ok(verdicts({ changed: [{ path: "tasks/x.md", status: "M", before: "a", after: "b" }], moves }).refused.length === 0 && verdicts({ changed: [{ path: "tasks/x.md", status: "D" }], moves }).proven.length === 0, "a file that asks no yes is neither proven nor refused");

const intoFloor = [{ from: "floor/topics/a.md", to: "tasks/a.md" }];
ok(refused(verdicts({ changed: [{ path: FLOOR, status: "M", modes: ["100644", "100644"], before: "read floor/topics/a.md", after: "read tasks/a.md" }], moves: intoFloor }), /changes words that are no path/u) && spellings(intoFloor).size === 0, "a move out of the floor justifies no pointer: it changes the floor itself");
ok(follows("`scripts/old.mjs`.", "`scripts/new.mjs`.", spellings(moves)) === null && follows("scripts/old.mjs.bak", "scripts/new.mjs.bak", spellings(moves)) !== null && follows("ascripts/old.mjs", "ascripts/new.mjs", spellings(moves)) !== null, "a path ends at a stop that ends a sentence, and never inside a longer name");
ok(follows("scripts/tools-old and scripts/tools.json", "scripts/kit-old and scripts/kit.json", spellings(moves)) !== null, "a folder's name inside a longer name is no path of it");
ok(tokens("a b", []).length === 1 && tokens("x scripts/kit/a.mjs y", ["scripts/kit", "scripts/kit/a.mjs"]).join("|") === "x |scripts/kit/a.mjs| y", "the longest path is read first");
ok(JSON.stringify(foldersOf("scripts/tools/a.mjs", "scripts/kit/a.mjs")) === JSON.stringify([{ from: "scripts/tools", to: "scripts/kit" }]) && foldersOf("a.mjs", "b.mjs").length === 0 && foldersOf("x/a.mjs", "y/b.mjs").length === 0, "a file's move moves the folders whose trailing parts it shares");
const words = [{ from: "tests", to: "opinions", folder: true }, { from: "tests/a.mjs", to: "opinions/a.mjs" }, { from: "and/or", to: "and/nor" }];
ok(follows("tests prove it, and/or", "opinions prove it, and/nor", spellings(words)) !== null && follows("see `tests` and tests/", "see `opinions` and opinions/", spellings(words)) === null, "a word of prose is no path: a name with no \"/\", or with no extension or closing \"/\", is read only between backticks");
ok(spellings([{ from: "tests", to: "tests later, not", folder: true }, { from: "a/b.md", to: "a/b\u0301.md" }]).size === 0, "a move whose path holds a space, a comma or a letter beyond ASCII justifies no pointer");
ok(refused(one(INVALID), /no UTF-8/u), "a side that is no UTF-8 text is refused, since two different bytes would read alike");
const graph = { "scripts/pr-description.mjs": 'import { a } from "./owner-yes.mjs";\nimport "./whole-output.mjs";', "scripts/owner-yes.mjs": 'export { b } from "./reading.mjs";', "scripts/path-only.mjs": 'import { asks } from "./owner-yes.mjs";' };
const own = ownFiles(p => graph[p] ?? null);
ok(ROOTS.every(r => own.has(r)) && own.has(WORKFLOW) && ["scripts/owner-yes.mjs", "scripts/reading.mjs", "scripts/whole-output.mjs"].every(f => own.has(f)) && own.size === 6, "the code that decides the proof is the check, its workflow, the proof and all they import, at any depth");
ok(refused(verdicts({ changed: [{ path: FLOOR, status: "M", modes: ["100644", "100644"], before, after: before.replace("old", "new") }, { path: "scripts/reading.mjs", status: "M" }], moves, self: true }), /not main.s/u), "where the pull request changes a file the check imports, nothing is proven");
const named = [{ from: "scripts/a.mjs", to: "scripts/b.mjs", unique: true }, { from: "scripts/c.mjs", to: "scripts/d.mjs" }];
ok(follows("see `a.mjs`", "see `b.mjs`", spellings(named)) === null && follows("see `c.mjs`", "see `d.mjs`", spellings(named)) !== null && follows("see a.mjs", "see b.mjs", spellings(named)) !== null, "a file's name alone follows its move between backticks, and only where no other file bears that name");
ok(mended(failure({ path: FLOOR, why: "it changes words" })), "a refusal says its mend");

console.log(`${failed ? "FAIL" : "ok  "} ${count - failed} of ${count} passed`);
process.exit(failed ? 1 : 0);
