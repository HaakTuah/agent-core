// Checks how done will be judged (scripts/done-when.mjs; tasks/done-when.md; #305): an entry's form, the
// evidence a pull request gives, which issues join the progress file or are closed, and that every failure says its
// mend. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/done-when-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { closes, currentText, CURRENT, doneMends, entryFaults, entryOf, isFeature, joined, MOST, ownerAt, PAGES, progressOf, provedFaults, queueAt, readItem, section, takesIt } from "../scripts/done-when.mjs";
import { OWNER } from "../scripts/core-address.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

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
const hostile = faults("**Done when**\n- When a\u0000b\rc\u2028::set-env ##[group]x. Proof: none\n- If c, then d. Proof: a test\n- Out of scope: e\n").join("\n");
ok(!/[\u0000\r\u2028]/u.test(hostile) && !hostile.includes("##[") && hostile.split("\n").every(l => !l.startsWith("::")), "a line an outsider wrote is shown with no control character and no command to the runner", hostile);

// the evidence
const e = entryOf(good);
ok(provedFaults("## Proved by use\n- Ran: open the save. Saw: the last round.\n- Ran: break the save. Saw: a new round, and the message.\n", e).length === 0, "a Ran and a Saw for each line pass");
const short = provedFaults("## Proved by use\n- Ran: open the save. Saw: the last round.\n- Ran: the tests.\n", e);
ok(short.length === 1 && /for 1 of the 2 lines of its entry/.test(short[0]) && mended(`FAIL ${short[0]}`), "an item with no Saw does not count, and the fault says its mend", short);
ok(/no such heading/.test(provedFaults("Nothing here.", e)[0] ?? ""), "no heading at all is named so");
ok(provedFaults("## Proved by use\n- Ran: a. Saw: b.\n", entryOf("**Done when**\n- None: x\n")).length === 0, "one item proves an entry of \"None:\"");

// which issues
ok(isFeature({ labels: ["feature"], body: "" }) && isFeature({ labels: [], body: "**What to read**\n`feature`, `test`\n" }) && isFeature({ labels: [], body: "**What to read**\n`core/tasks/done-when.md`\n" }),
  "a feature's issue names the kind by its label, under \"What to read\", or names the module there");
ok(!isFeature({ labels: ["enhancement"], body: "a feature, `feature`\n" }), "the word elsewhere, or another label, is not the kind");
ok(currentText("old", [{ author: "O", body: `${CURRENT}\nnew` }, { author: "x", body: `${CURRENT}\nnot theirs` }], "o") === `${CURRENT}\nnew` && currentText("old", [{ author: "o", body: "a note" }], "o") === "old",
  "the current text is the owner's account's newest note that says so, its login in any case, else the description");
ok(ownerAt("| *owner's account* | `Ann-1` |\n", "core/", "x/r") === "Ann-1" && ownerAt("", "core/", "x/r") === "x" && ownerAt("anything", "", "x/r") === OWNER,
  "the owner's account is the manifest's row, else the repository's account; in the core, the core's own");
ok(takesIt("Floor: whole. Modules: all.\n", "core/") && takesIt("Floor: whole. Modules: `a.md`.\nNot taken: `done-when.md` (x).\n", "") && !takesIt("Floor: whole. Modules: `a.md`.\nNot taken: `done-when.md` (no feature).\n", "core/"),
  "a project whose manifest leaves the module out is asked nothing; the core always takes it");
ok(joined("| #1 | a | |\n| #2 | b | #1 |\n", "| #1 | a | |\n| #3 | b | #2 |\n| #2 | b | #1 |\n1. `inbox/x.md`, builder\n").join() === "#3,inbox/x.md", "the items that join: each line's first, named nowhere in the base's file");
ok(joined("| #2 | b | |\n", "| #4 | c | #2 |\n").join() === "#4" && joined(null, "").length === 0, "an item waited on is not one that joins; no file is none");
ok(joined("| #1 | a | #3 |\n", "| #1 | a | #3 |\n| #3 | b | |\n").join() === "#3", "an item named before only as one another waits on joins with a line of its own");
ok(closes("Fixes #12. Closes: #3, resolves #4 and fixed #12; see #9").join() === "#12,#3,#4", "the issues a description closes, as GitHub reads them, each once");

// the whole, with issues read through a stand-in for gh
const issues = { "#5": { labels: ["feature"], body: "What it is.\n" }, "#6": { labels: ["feature"], body: good }, "#7": { labels: ["bug"], body: "A bug.\n" },
  "#9": { labels: ["enhancement"], body: "**Done when**\n- When ..., it .... Proof: ...\n" } };
const read = item => issues[item] ?? null, queue = (...items) => ({ before: "| #1 | a | |\n", after: `| #1 | a | |\n${items.map(i => `| ${i} | b | |\n`).join("")}` });
issues["#10"] = { labels: ["feature"], body: "**Done when**\n- When ..., it .... Proof: ...\n- If ..., then it .... Proof: ...\n- Out of scope: ...\n" };
let r = doneMends({ body: "x", queue: queue("#5", "#6", "#7", "#10"), read });
ok(r.mends.length === 1 && /#5, a feature's issue that joins the progress file, has no "Done when"/.test(r.mends[0]) && mended(`FAIL ${r.mends[0]}`),
  "of the issues that join, only a feature's with no heading fails, saying its mend; lines not in the form, the form's own left as they came, wait for its builder", r.mends);
r = doneMends({ body: "Fixes #10\n", queue: null, read });
ok(r.mends.length === 1 && /no "Done when" lines in the form, and nor has the description/.test(r.mends[0]), "its builder then writes them: the issue's lines not in the form do not count", r.mends);
r = doneMends({ body: "x", queue: queue("#8"), read });
ok(r.mends.length === 0 && /#8 could not be read, so nothing is asked/.test(r.notes[0]), "an issue that cannot be read is asked nothing, and that is said", r);
r = doneMends({ body: "Fixes #6\n## Proved by use\n- Ran: a. Saw: b.\n", queue: null, read });
ok(r.mends.length === 1 && /for 1 of the 2 lines of its entry/.test(r.mends[0]), "a pull request that closes a feature's issue with lines gives the evidence for each", r.mends);
r = doneMends({ body: "Fixes #5\nNothing more.\n", queue: null, read });
ok(r.mends.length === 1 && /nor has the description/.test(r.mends[0]) && mended(`FAIL ${r.mends[0]}`), "a feature's issue with no lines, closed by a description with none, fails: the builder writes them", r.mends);
issues["#11"] = { labels: ["feature"], body: good };
r = doneMends({ body: "Fixes #6, fixes #11\n## Proved by use\n- Ran: a. Saw: b.\n- Ran: c. Saw: d.\n", queue: null, read });
ok(r.mends.length === 1 && /for 2 of the 4 lines of its entries/.test(r.mends[0]), "a pull request that closes two features proves the lines of both", r.mends);
r = doneMends({ body: `Fixes #5\n${good}\n## Proved by use\n- Ran: a. Saw: b.\n- Ran: c. Saw: d.\n`, queue: null, read });
ok(r.mends.length === 0, "where the issue has none, the description's own lines are proved", r.mends);
r = doneMends({ body: "Fixes #7\n", queue: null, read });
ok(r.mends.length === 0 && r.notes.length === 0, "a bug's pull request with no entry is asked nothing", r);
r = doneMends({ body: "Fixes #9\n", queue: queue("#9"), read });
ok(r.mends.length === 0, "an issue of no feature, its template's heading left as it came, is asked nothing", r.mends);
let calls = 0;
r = doneMends({ body: Array.from({ length: 7000 }, (_, i) => `fix #${i + 1}`).join(" "), queue: queue(...Array.from({ length: 5 }, (_, i) => `#${i + 90000}`)), read: () => (calls++, null) });
ok(calls === 0 && r.mends.length === 1 && new RegExp(`queues or closes 7005 items, more than the ${MOST}`).test(r.mends[0]) && mended(`FAIL ${r.mends[0]}`), "more items than the check reads fail before any is read, saying the mend", r.mends);
r = doneMends({ body: Array.from({ length: MOST }, (_, i) => `Fixes #${i + 20}`).join("\n"), queue: null, read: () => (calls++, null) });
ok(calls === MOST && r.mends.length === 0, "as many as it reads are each read once", calls);
calls = 0;
r = doneMends({ body: "Fixes #6\n## Proved by use\n- Ran: a. Saw: b.\n- Ran: c. Saw: d.\n", queue: queue("#6"), read: item => (calls++, read(item)) });
ok(calls === 1 && r.mends.length === 0, "an item both queued and closed is read once", calls);
r = doneMends({ body: "Fixes #6\n", queue: queue("#5"), read: () => ({ limited: true }) });
ok(r.mends.length === 2 && r.mends.every(m => /rate limit/.test(m) && mended(`FAIL ${m}`)) && r.notes.length === 0, "an item the rate limit refused fails, saying to run the check again", r);
r = doneMends({ body: "Fixes #8\n", queue: queue(), read });
ok(r.mends.length === 0 && r.notes.length === 1, "a closed issue that cannot be read is asked nothing, and that is said", r);

// the progress file, by the slot, read from git as the merge commit against its base
ok(progressOf("| *progress file* | `docs/QUEUE.md` |\n") === "docs/QUEUE.md" && progressOf("the *progress file*: `QUEUE.md` (\"The queue\")") === "QUEUE.md" && progressOf("") === "docs/PROGRESS.md",
  "the progress file is the manifest's row, the core's own slot, else the kit's");
const dir = scratchDir("done-when-");
const git = (...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...a], { cwd: dir, encoding: "utf8" });
const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
try {
  git("init", "-q");
  put("core-manifest.md", "| *progress file* | `plan/QUEUE.md` |\n"); put("plan/QUEUE.md", "1. #1\n"); git("add", "-A"); git("commit", "-qm", "base");
  ok(queueAt(dir, "core/") === null, "a checkout with no base reads no queue");
  put("plan/QUEUE.md", "1. #1\n2. #2\n"); put("inbox/idea.md", "**What to read**\n`feature`\n"); git("add", "-A"); git("commit", "-qm", "head");
  const q = queueAt(dir, "core/");
  ok(q?.before === "1. #1\n" && q.after === "1. #1\n2. #2\n" && joined(q.before, q.after).join() === "#2", "the queue's file is read on the base and the head, where the base's manifest names it", q);
  // (a file past the bound git's read has is unread: a failure with its mend, never an empty queue)
  put("plan/QUEUE.md", Buffer.alloc((1 << 26) + 1, 0x61)); git("add", "-A"); git("commit", "-qm", "past the bound");
  let past = null;
  try { queueAt(dir, "core/"); } catch (e) { past = e; }
  ok(past !== null && mended(past.message), "a queue past the bound of git's read is unread, and fails with its mend", past?.message);
  git("reset", "-q", "--hard", "HEAD~1");
  const path0 = process.env.PATH;
  process.env.PATH = dir;
  try { ok(readItem("o/r", "#1") === null, "an issue gh cannot be run to read is none"); } finally { process.env.PATH = path0; }
  // (an answer of gh's past its bound is unread: a failure with its mend, never an item that asks nothing; one gh ends
  // refusing is none)
  if (process.platform !== "win32") {
    const bin = path.join(dir, "..", `done-when-bin-${process.pid}`), fake = how => { fs.mkdirSync(bin, { recursive: true }); fs.writeFileSync(path.join(bin, "gh"), `#!${process.execPath}\n${how}\n`, { mode: 0o755 }); };
    process.env.PATH = bin;
    try {
      fake(`process.stdout.write("a".repeat((1 << 24) + 1))`);
      let big = null;
      try { readItem("o/r", "#1"); } catch (e) { big = e; }
      fake("process.exit(1)");
      ok(big !== null && mended(big.message) && readItem("o/r", "#1") === null, "an answer past the bound of gh's read is unread, and fails with its mend; one gh refuses is none", big?.message);
    } finally { process.env.PATH = path0; fs.rmSync(bin, { recursive: true, force: true }); }
  }
  ok(isFeature(readItem("o/r", "inbox/idea.md", dir)) && readItem("o/r", "inbox/none.md", dir) === null, "an inbox file is read from the head's commit, and one not there is none");
  // (a link committed as an inbox file is read as its own text, never followed out of the checkout)
  const secret = path.join(dir, "..", `done-when-secret-${process.pid}.txt`);
  fs.writeFileSync(secret, "**What to read**\n`feature`\nSECRET\n");
  try {
    fs.symlinkSync(secret, path.join(dir, "inbox", "link.md")); git("add", "-A"); git("commit", "-qm", "a link");
    const got = readItem("o/r", "inbox/link.md", dir);
    ok(got !== null && !got.body.includes("SECRET") && got.body.trim().endsWith(path.basename(secret)), "an inbox file that is a link is read as the link's own text (its target's path, as git writes it on each system)", got);
  } catch (e) { ok(/EPERM|symlink/i.test(String(e)), `no link could be made here (${e.code ?? e})`); } finally { fs.rmSync(secret, { force: true }); }
  // an issue's notes, through a stand-in for gh: its current text found on the newest pages, and no more read than PAGES
  const bin = path.join(dir, "bin"), log = path.join(dir, "calls.log");
  fs.mkdirSync(bin);
  const note = (login, body) => ({ user: { login }, body });
  const pages = { 1: [note("o", `${CURRENT}\nthe oldest`), ...Array.from({ length: 99 }, () => note("x", "a"))], 2: Array.from({ length: 100 }, () => note("x", "b")),
    3: [note("o", `${CURRENT}\nnewer`), ...Array.from({ length: 99 }, () => note("x", "c"))], 4: Array.from({ length: 100 }, () => note("x", "d")), 5: [note("x", "e")] };
  fs.writeFileSync(path.join(dir, "routes.json"), JSON.stringify({ "repos/o/r/issues/7": { user: { login: "o" }, labels: [{ name: "feature" }], body: "the description", comments: 401 },
    ...Object.fromEntries(Object.entries(pages).map(([p, v]) => [`repos/o/r/issues/7/comments?per_page=100&page=${p}`, v])) }));
  fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh\necho "$2" >> "${log}"\nexec node -e 'const r=require(process.argv[1])[process.argv[2]]; if (r === undefined) process.exit(1); console.log(JSON.stringify(r))' "${path.join(dir, "routes.json")}" "$2"\n`, { mode: 0o755 });
  if (process.platform !== "win32") {
    process.env.PATH = `${bin}${path.delimiter}${path0}`;
    try {
      const got = readItem("o/r", "#7"), read = fs.readFileSync(log, "utf8").trim().split("\n");
      ok(got?.body === `${CURRENT}\nnewer` && got.labels.join() === "feature" && read.length === 1 + PAGES && read.at(-1).endsWith("page=3"),
        `the current text is the author's newest such note, read from the newest pages, ${PAGES} at most`, { got, read });
      fs.writeFileSync(path.join(bin, "gh"), "#!/bin/sh\necho 'gh: API rate limit exceeded for installation.' >&2\nexit 1\n", { mode: 0o755 });
      ok(readItem("o/r", "#7")?.limited === true, "a read GitHub's rate limit refused is told from one that cannot be read");
    } finally { process.env.PATH = path0; }
  }
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
