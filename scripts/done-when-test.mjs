// Checks how done will be judged (done-when.mjs, beside this file; tasks/done-when.md; #305): an entry's form, the
// evidence a pull request gives, which issues join the progress file or are closed, and that every failure says its
// mend. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/done-when-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closes, currentText, CURRENT, doneMends, entryFaults, entryOf, isFeature, joined, progressOf, provedFaults, queueAt, readItem, section } from "./done-when.mjs";
import { mended } from "./mend.mjs";

let failed = 0;
const ok = (cond, what, got) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}${cond || got === undefined ? "" : `\n     got: ${JSON.stringify(got).slice(0, 400)}`}`); if (!cond) failed++; };
const good = ["**Done when**", "- When a save is opened, it shows the last round. Proof: a test written first.",
  "- If the save is broken, then it says so and starts a new round. Proof: a test written first.", "- Out of scope: the cloud saves.", ""].join("\n");
const faults = body => entryFaults(entryOf(body), "the issue #1");

ok(entryOf("No heading here.") === null && section("x", "Done when") === null, "a text with no heading has no entry");
ok(faults(good).length === 0, "two lines, an If, each with its proof, and one out of scope: in the form", faults(good));
ok(faults("## Done when\n1. When a, it b. Proof: a check\n2. While c lasts, it d.\n   Proof: a picture\n3. If e, then f. Proof: \"the owner tries this\"\n4. Out of scope: g\n## Next\n- When x, y. Proof: nothing\n").length === 0,
  "a Markdown heading, numbered items, a line carried on indented, and the section ending at the next heading");
ok(faults("**Done when**\n- When a line quotes \"Proof:\" before its own, it reads the last. Proof: a test\n- If e, then f. Proof: a check\n- Out of scope: g\n").length === 0, "the proof is what follows the line's last \"Proof:\"");
ok(faults("**Done when**\n- None: the button is renamed.\n").length === 0, "the one line \"None:\" for a change said in one sentence");
ok(faults("**Done when**\n- None: x\n- When a, b. Proof: a test\n").length === 1, "\"None:\" beside other lines is a fault");
const one = faults("**Done when**\n- If a, then b. Proof: a test\n- Out of scope: c\n");
ok(one.length === 1 && /holds 1 line/.test(one[0]), "one line is too few", one);
const seven = faults(`**Done when**\n${Array.from({ length: 7 }, (_, i) => `- If ${i}, then it stops. Proof: a test\n`).join("")}- Out of scope: c\n`);
ok(seven.length === 1 && /holds 7 lines/.test(seven[0]), "seven lines are too many", seven);
ok(faults("**Done when**\n- When a, b. Proof: a test\n- While c, d. Proof: a test\n- Out of scope: e\n").some(f => /starting "If"/.test(f)), "no line for what goes wrong is a fault");
ok(faults("**Done when**\n- When a, b.\n- If c, then d. Proof: it works\n- Out of scope: e\n").filter(f => /names no proof/.test(f)).length === 2, "a line without a proof, or with one of no kind the rule names, is a fault");
ok(faults("**Done when**\n- As a user I want a, so that b.\n- When a, b. Proof: a test\n- If c, then d. Proof: a test\n- Out of scope: e\n").some(f => /in none of the shapes/.test(f)), "a user story is in none of the shapes");
ok(faults("**Done when**\n- When a, b. Proof: a test\n- If c, then d. Proof: a test\n").some(f => /0 "Out of scope:"/.test(f)), "no line out of scope is a fault");
ok(faults("**Done when**\n- When a, b. Proof: a test\n").every(f => mended(`FAIL ${f}`)), "each fault says its mend");

// the evidence
const e = entryOf(good);
ok(provedFaults("## Proved by use\n- Ran: open the save. Saw: the last round.\n- Ran: break the save. Saw: a new round, and the message.\n", e).length === 0, "a Ran and a Saw for each line pass");
const short = provedFaults("## Proved by use\n- Ran: open the save. Saw: the last round.\n- Ran: the tests.\n", e);
ok(short.length === 1 && /for 1 of the entry's 2 lines/.test(short[0]) && mended(`FAIL ${short[0]}`), "an item with no Saw does not count, and the fault says its mend", short);
ok(/no such heading/.test(provedFaults("Nothing here.", e)[0] ?? ""), "no heading at all is named so");
ok(provedFaults("## Proved by use\n- Ran: a. Saw: b.\n", entryOf("**Done when**\n- None: x\n")).length === 0, "one item proves an entry of \"None:\"");

// which issues
ok(isFeature({ labels: ["feature"], body: "" }) && isFeature({ labels: [], body: "**What to read**\n`feature`, `test`\n" }) && isFeature({ labels: [], body: "**What to read**\n`core/tasks/done-when.md`\n" }),
  "a feature's issue names the kind by its label, under \"What to read\", or names the module there");
ok(!isFeature({ labels: ["enhancement"], body: "a feature, `feature`\n" }), "the word elsewhere, or another label, is not the kind");
ok(currentText({ author: "o", body: "old" }, [{ author: "o", body: `${CURRENT}\nnew` }, { author: "x", body: `${CURRENT}\nnot theirs` }]) === `${CURRENT}\nnew` && currentText({ author: "o", body: "old" }, [{ author: "o", body: "a note" }]) === "old",
  "the current text is the author's newest note that says so, else the description");
ok(joined("| #1 | a | |\n| #2 | b | #1 |\n", "| #1 | a | |\n| #3 | b | #2 |\n| #2 | b | #1 |\n1. `inbox/x.md`, builder\n").join() === "#3,inbox/x.md", "the items that join: each line's first, named nowhere in the base's file");
ok(joined("| #2 | b | |\n", "| #4 | c | #2 |\n").join() === "#4" && joined(null, "").length === 0, "an item waited on is not one that joins; no file is none");
ok(closes("Fixes #12. Closes: #3, resolves #4 and fixed #12; see #9").join() === "#12,#3,#4", "the issues a description closes, as GitHub reads them, each once");

// the whole, with issues read through a stand-in for gh
const issues = { "#5": { labels: ["feature"], body: "What it is.\n" }, "#6": { labels: ["feature"], body: good }, "#7": { labels: ["bug"], body: "A bug.\n" },
  "#9": { labels: ["enhancement"], body: "**Done when**\n- When ..., it .... Proof: ...\n" } };
const read = item => issues[item] ?? null, queue = (...items) => ({ before: "| #1 | a | |\n", after: `| #1 | a | |\n${items.map(i => `| ${i} | b | |\n`).join("")}` });
let r = doneMends({ body: "x", queue: queue("#5", "#6", "#7"), read });
ok(r.mends.length === 1 && /#5, a feature's issue that joins the progress file, has no "Done when"/.test(r.mends[0]) && mended(`FAIL ${r.mends[0]}`), "of the issues that join, only a feature's with no entry fails, saying its mend", r.mends);
r = doneMends({ body: "x", queue: queue("#8"), read });
ok(r.mends.length === 0 && /#8 could not be read, so nothing is asked/.test(r.notes[0]), "an issue that cannot be read is asked nothing, and that is said", r);
r = doneMends({ body: "Fixes #6\n## Proved by use\n- Ran: a. Saw: b.\n", queue: null, read });
ok(r.mends.length === 1 && /for 1 of the entry's 2 lines/.test(r.mends[0]), "a pull request that closes a feature's issue with lines gives the evidence for each", r.mends);
r = doneMends({ body: "Fixes #5\nNothing more.\n", queue: null, read });
ok(r.mends.length === 1 && /nor has the description/.test(r.mends[0]) && mended(`FAIL ${r.mends[0]}`), "a feature's issue with no lines, closed by a description with none, fails: the builder writes them", r.mends);
r = doneMends({ body: `Fixes #5\n${good}\n## Proved by use\n- Ran: a. Saw: b.\n- Ran: c. Saw: d.\n`, queue: null, read });
ok(r.mends.length === 0, "where the issue has none, the description's own lines are proved", r.mends);
r = doneMends({ body: "Fixes #7\n", queue: null, read });
ok(r.mends.length === 0 && r.notes.length === 0, "a bug's pull request with no entry is asked nothing", r);
r = doneMends({ body: "Fixes #9\n", queue: queue("#9"), read });
ok(r.mends.length === 0, "an issue of no feature, its template's heading left as it came, is asked nothing", r.mends);
r = doneMends({ body: "Fixes #8\n", queue: queue(), read });
ok(r.mends.length === 0 && r.notes.length === 1, "a closed issue that cannot be read is asked nothing, and that is said", r);

// the progress file, by the slot, read from git as the merge commit against its base
ok(progressOf("| *progress file* | `docs/QUEUE.md` |\n") === "docs/QUEUE.md" && progressOf("the *progress file*: `QUEUE.md` (\"The queue\")") === "QUEUE.md" && progressOf("") === "docs/PROGRESS.md",
  "the progress file is the manifest's row, the core's own slot, else the kit's");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "done-when-"));
const git = (...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...a], { cwd: dir, encoding: "utf8" });
const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
try {
  git("init", "-q");
  put("core-manifest.md", "| *progress file* | `plan/QUEUE.md` |\n"); put("plan/QUEUE.md", "1. #1\n"); git("add", "-A"); git("commit", "-qm", "base");
  ok(queueAt(dir, "core/") === null, "a checkout with no base reads no queue");
  put("plan/QUEUE.md", "1. #1\n2. #2\n"); put("inbox/idea.md", "**What to read**\n`feature`\n"); git("add", "-A"); git("commit", "-qm", "head");
  const q = queueAt(dir, "core/");
  ok(q?.before === "1. #1\n" && q.after === "1. #1\n2. #2\n" && joined(q.before, q.after).join() === "#2", "the queue's file is read on the base and the head, where the base's manifest names it", q);
  ok(isFeature(readItem("o/r", "inbox/idea.md", dir)) && readItem("o/r", "inbox/none.md", dir) === null, "an inbox file is read from the checkout, and one not there is none");
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

// the idea forms: the core's own and the one the starter kit writes
for (const form of [".github/ISSUE_TEMPLATE/feature_request.md", "setup/template/issue-idea.md.tmpl"]) {
  const text = fs.readFileSync(new URL(`../${form}`, import.meta.url), "utf8"), e = entryOf(text);
  ok(e !== null && e.lines.some(l => l.shape === "If") && e.scope.length === 1 && /`feature`/.test(text), `${form} holds the heading "Done when" with an "If" and an out of scope, and names the kind`);
}

const slow = Date.now();
const n = 100000;
entryOf(`# x${" ".repeat(n)}${"#".repeat(n)}${" ".repeat(n)}y\n${"## ".concat(" \t".repeat(n), "#")}\n**${"a".repeat(n)}\n**Done when**\n- When ${" ".repeat(n)}Proof:${" ".repeat(n)}\n${"- When a, b. Proof: a test ".repeat(20000)}\n${"   x\n".repeat(50000)}${"1".repeat(n)}\n`);
joined(`${"#1 ".repeat(n)}${"inbox/".repeat(n)}${"inbox/a".concat(".md".repeat(n))}x`, `#2\n`.repeat(n) + `inbox/${"a".repeat(n)}`);
closes(`${"fixes ".repeat(n)}fix${" ".repeat(n)}${"fix:".repeat(n)}`);
ok(Date.now() - slow < 3000, "long texts of any shape are read in no time");

console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);
