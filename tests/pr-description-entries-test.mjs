// Checks the description check's lines "Number:" against the entries of scripts/holders/ whose number a pull request
// adds or changes (scripts/pr-number.mjs's entriesMend and entriesChanged; #1138, part 3), git given as a stand-in that
// answers as git does, so no process is started. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/pr-description-entries-test.mjs
import { mended } from "../scripts/mend.mjs";
import { entriesChanged, entriesMend } from "../scripts/pr-number.mjs";

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
// (a stand-in for git over two trees, the base HEAD^1 and the head HEAD, each { path: text }; the diff as git's
// --name-status -M -z gives it, a rename found where a file gone from the base stands in the head with its text)
const fake = (base, head) => (...a) => {
  const ok0 = stdout => ({ status: 0, stdout });
  if (a[0] === "show") { const [rev, f] = a[1].split(/:(.*)/su); const t = (rev === "HEAD" ? head : base)[f]; return t === undefined ? { status: 128, stdout: "" } : ok0(t); }
  if (a[0] === "ls-tree") return ok0(Object.keys(head).map(f => `${f}\0`).join(""));
  if (a[0] === "diff") {
    const out = [], gone = Object.keys(base).filter(f => !(f in head)), added = Object.keys(head).filter(f => !(f in base));
    const renamed = new Map(gone.map(f => [f, added.find(g => head[g] === base[f])]).filter(([, g]) => g));
    for (const f of Object.keys(base).filter(f => f in head && base[f] !== head[f])) out.push("M", f);
    for (const [f, g] of renamed) out.push("R100", f, g);
    for (const f of gone.filter(f => !renamed.has(f))) out.push("D", f);
    for (const g of added.filter(g => ![...renamed.values()].includes(g))) out.push("A", g);
    return ok0(out.map(x => `${x}\0`).join(""));
  }
  return { status: 1, stdout: "" };
};
const at = f => `scripts/holders/${f}`, entry = (rule, number, extra = "") => JSON.stringify({ rule, holder: "audit", ...(number ? { number } : {}), behind: [1] }, null, 2) + extra;
const base = { [at("kept.json")]: entry("AGENTS.md: Kept", F), [at("moved.json")]: entry("AGENTS.md: Moved", F), [at("renum.json")]: entry("AGENTS.md: Renum", F), [at("gone.json")]: entry("AGENTS.md: Gone", C), [at("plain.json")]: entry("AGENTS.md: Plain", null) };
const head = { [at("kept.json")]: entry("AGENTS.md: Kept", F, "\n"), [at("moved-now.json")]: base[at("moved.json")], [at("renum.json")]: entry("AGENTS.md: Renum", C), [at("plain.json")]: entry("AGENTS.md: Plain", R), [at("new.json")]: entry("AGENTS.md: New", F), [at("odd.txt")]: "x" };
const read = entriesChanged(".", fake(base, head));
ok(JSON.stringify(read?.changed.map(c => c.rule).sort()) === JSON.stringify(["AGENTS.md: New", "AGENTS.md: Plain", "AGENTS.md: Renum"]) && JSON.stringify([...read.standing].sort()) === JSON.stringify([R, C, F].sort()),
  "an entry added with a number, one that gains one and one whose number changes are read; one only edited or renamed with its number, one taken out and a file that is no entry are not", JSON.stringify(read && { changed: read.changed, standing: [...read.standing] }));
const broken = entriesChanged(".", fake(base, { ...head, [at("renum.json")]: "{ not json" }));
ok(!broken.changed.some(c => c.rule === "AGENTS.md: Renum"), "an entry that cannot be read as JSON is read as holding no number (holders.mjs names it)");
ok(entriesChanged(".", () => ({ status: 128, stdout: "" })) === null, "where the change cannot be read against its base, nothing is read");

console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
