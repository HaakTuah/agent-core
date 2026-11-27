// Checks the description check's lines "Number:" against the entries of scripts/holders/ whose number a pull request
// adds or changes (scripts/pr-number.mjs's entriesMend and entriesChanged; #1138, part 3), git given as a stand-in that
// answers as git does, so no process is started; and the hostile tests of that reader of what a pull request changes
// (SECURITY.md, rule 5): links, a git out of its form, the most it is handed, timed. Run by the core's tests workflow
// (.github/workflows/tests.yml).
//
//   node tests/pr-description-entries-test.mjs
import { quick } from "../scripts/hostile.mjs";
import { mended } from "../scripts/mend.mjs";
import { ENTRIES_MAX, entriesChanged, entriesMend } from "../scripts/pr-number.mjs";

let failed = 0;
const ok = (cond, what, detail = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) { failed++; if (detail) console.log(`     ${detail}`); } };

// ---- the lines against the entries ----
const F = "findings; outcome: robust", C = "check fires; outcome: fast", R = "correction: misread; outcome: asked; rare harm", standing = new Set([F, C, R]);
const holds = (...lines) => `## What holds it\n${lines.map(l => `- ${l}`).join("\n")}\n## Readings taken\nNumber: ${C}\n`;
const two = [{ rule: "AGENTS.md: One", number: F }, { rule: "AGENTS.md: Two", number: F }];
ok(entriesMend(holds(`"One": held by x.\n  Number: ${F}.`, `"Two". Number: Findings; Outcome: robust (the findings fall)`), two, standing) === null
  && entriesMend(holds(`Number: ${R}`, `Number: ${F}`), [{ rule: "AGENTS.md: Three", number: R }], standing) === null
  && entriesMend("No part.", two, standing) === null && entriesMend(holds(`Number: ${C}`), [], standing) === null,
  "a line for each entry the pull request numbers, in any case and whatever follows, passes; so does a line beyond them that names a number an entry holds (a rule widened, its number kept), and a description without the part");
const short = entriesMend(holds(`Number: ${F}`), two, standing), none = entriesMend("## What holds it\nNone\n", [two[0]], standing);
ok(/the entry of "AGENTS\.md: Two" gets the number "findings; outcome: robust", which no line "Number:" under "What holds it" gives \(1 line for 2 entries/.test(short ?? "") && !short.includes("AGENTS.md: One")
  && /the entry of "AGENTS\.md: One" gets the number/.test(none ?? "") && [short, none].every(m => mended(`FAIL ${m}`)),
  "one line for two rules, and \"None\" where an entry gains a number, each fail, naming the entry left without its line, with the mend", `${short}\n${none}`);
const stray = entriesMend(holds(`Number: ${F}`, "Number: correction: looks wrong; outcome: usable", "Number: none yet"), [two[0]], standing), wrong = entriesMend(holds(`Number: ${C}`), [two[0]], standing);
ok(/the line "Number: correction: looks wrong; outcome: usable" under "What holds it" names a number no entry of scripts\/holders\/ holds\. Mend: /.test(stray ?? "") && !/none yet/.test(stray)
  && /the entry of "AGENTS\.md: One" gets the number/.test(wrong ?? "") && mended(`FAIL ${stray}`),
  "a line whose number no entry holds fails, and a line in no form is left to the number's own check; a line of another number does not stand for the entry", `${stray}\n${wrong}`);

// ---- the entries, read from git ----
// (a stand-in for git over two trees, the base HEAD^1 and the head HEAD, each { path: text, or [mode, type] for what is
// no regular file }, answering ls-tree and cat-file --batch as git does; `calls` counts what it is asked)
let calls = 0;
const fake = (base, head, more = {}) => {
  const blobs = new Map(), shaOf = text => { const sha = (blobs.size + 1).toString(16).padStart(40, "0"); blobs.set(sha, text); return sha; };
  const trees = { HEAD: head, "HEAD^1": base }, listed = {};
  for (const [rev, tree] of Object.entries(trees)) listed[rev] = Object.entries(tree).map(([f, t]) => Array.isArray(t) ? `${t[0]} ${t[1]} ${"f".repeat(40)}\t${f}\0` : `100644 blob ${shaOf(t)}\t${f}\0`).join("");
  return (args, input) => {
    calls++;
    if (more[args[0]]) return more[args[0]](args, input);
    if (args[0] === "ls-tree") return { status: 0, stdout: listed[args[4]] };
    if (args[0] === "cat-file") return { status: 0, stdout: Buffer.concat(input.split("\n").filter(Boolean).map(sha => { const b = Buffer.from(blobs.get(sha)); return Buffer.concat([Buffer.from(`${sha} blob ${b.length}\n`), b, Buffer.from("\n")]); })) };
    return { status: 1, stdout: "" };
  };
};
const at = f => `scripts/holders/${f}`, entry = (rule, number, holder = "audit") => JSON.stringify({ rule, holder, ...(number ? { number } : {}), behind: [1] }, null, 2);
const base = { [at("kept.json")]: entry("AGENTS.md: Kept", F), [at("moved.json")]: entry("AGENTS.md: Moved", F), [at("renum.json")]: entry("AGENTS.md: Renum", C), [at("gone.json")]: entry("AGENTS.md: Gone", C), [at("plain.json")]: entry("AGENTS.md: Plain", null), [at("odd-before.json")]: ["120000", "blob"] };
const head = { [at("kept.json")]: `${entry("AGENTS.md: Kept", F)}\n`, [at("moved-now.json")]: entry("AGENTS.md: Moved", F, "check: scripts/a-check.mjs"), [at("renum.json")]: entry("AGENTS.md: Renum", F), [at("plain.json")]: entry("AGENTS.md: Plain", R), [at("new.json")]: entry("AGENTS.md: Ünew ✓", F), [at("odd.txt")]: "x" };
const read = entriesChanged(".", fake(base, head));
ok(JSON.stringify(read?.changed.map(c => c.rule).sort()) === JSON.stringify(["AGENTS.md: Plain", "AGENTS.md: Renum", "AGENTS.md: Ünew ✓"]) && JSON.stringify([...read.standing].sort()) === JSON.stringify([R, F].sort()) && read.odd.length === 0,
  "an entry added with a number, one that gains one and one whose number changes are read; one only edited, one renamed with its holders changed and its number kept (found by its rule), one taken out and a file that is no entry are not", JSON.stringify(read && { changed: read.changed, standing: [...read.standing], odd: read.odd }));
const broken = entriesChanged(".", fake(base, { ...head, [at("renum.json")]: "{ not json" }));
ok(!broken.changed.some(c => c.rule === "AGENTS.md: Renum"), "an entry that cannot be read as JSON is read as holding no number (holders.mjs names it)");

// ---- what a pull request could make of it (SECURITY.md, rule 5) ----
let asked = "";
const odd = entriesChanged(".", fake(base, { ...head, [at("link.json")]: ["120000", "blob"], [at("sub.json")]: ["160000", "commit"] }, { "cat-file": (a, input) => { asked = input; return fake(base, head)(a, input); } }));
const oddMend = odd && entriesMend(holds(`Number: ${F}`), [], standing, odd.odd), oddAlone = odd && entriesMend("No part.", [], standing, odd.odd);
ok(JSON.stringify(odd?.odd) === JSON.stringify([at("link.json"), at("sub.json")]) && !asked.includes("f".repeat(40))
  && /scripts\/holders\/link\.json is a link or a submodule.*scripts\/holders\/sub\.json is a link or a submodule.*Mend: make each entry of scripts\/holders\/ a regular JSON file/su.test(oddMend ?? "") && mended(`FAIL ${oddMend}`) && mended(`FAIL ${oddAlone}`),
  "an entry made a link or a submodule is never read: it fails, named, with its mend, the part there or not", `${JSON.stringify(odd?.odd)}\n${oddMend}`);
const unread = [
  ["git fails", () => ({ status: 128, stdout: "" })],
  ["git stops past ENTRIES_MAX", (a, input) => a[0] === "cat-file" ? { status: null, stdout: Buffer.alloc(0) } : fake(base, head)(a, input)],
  ["the tree's list is out of its form", (a, input) => a[0] === "ls-tree" ? { status: 0, stdout: "100644 blob nothex\tscripts/holders/x.json\0" } : fake(base, head)(a, input)],
  ["the batch names another object", (a, input) => a[0] === "cat-file" ? { status: 0, stdout: Buffer.from(`${"e".repeat(40)} blob 2\n{}\n`) } : fake(base, head)(a, input)],
  ["the batch ends short of a size it gives", (a, input) => a[0] === "cat-file" ? { status: 0, stdout: Buffer.from(`${input.split("\n")[0]} blob 999999\n{}\n`) } : fake(base, head)(a, input)],
  ["the batch says an object is missing", (a, input) => a[0] === "cat-file" ? { status: 0, stdout: Buffer.from(`${input.split("\n")[0]} missing\n`) } : fake(base, head)(a, input)],
];
for (const [what, git] of unread) ok(entriesChanged(".", git) === null, `where ${what}, the change is said unread, failing nothing`);
// (the most a pull request could hand the reader: twenty thousand entries a side, and one entry of 15 MB, under the
// ENTRIES_MAX git hands over, each read within the 5 s SECURITY.md allows, git asked four times at most whatever the count)
const many = n => Object.fromEntries(Array.from({ length: n }, (_, k) => [at(`e${k}.json`), entry(`AGENTS.md: Rule ${k}`, k % 2 ? F : C)]));
const big = { [at("big.json")]: entry(`AGENTS.md: ${"x".repeat(15 * 1024 * 1024)}`, R) };
for (const [what, b, h] of [["twenty thousand entries a side", many(20000), { ...many(20000), [at("e1.json")]: entry("AGENTS.md: Rule 1", R) }], ["an entry of 15 MB", {}, big]]) {
  const git = fake(b, h); calls = 0;
  ok(quick(() => entriesChanged(".", git)?.changed.length === 1) && calls <= 4 && ENTRIES_MAX > 15 * 1024 * 1024, `${what}: read within 5 s, git asked ${calls} times`);
}

console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
