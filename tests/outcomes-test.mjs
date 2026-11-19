// Tests outcomes.mjs and outcomes-read.mjs, the outcomes the monthly state report leads with (#302): how a correction
// is read (its label, its kind, the pull request it names, the owner's account alone), each measure over a span, the
// months added where a count is small, the report's form under the five outcomes, what is read through a gh that
// answers from fixtures, the line a project's report gives the core's, and the command's failure with its mend. Its
// tests workflow runs it on every pull request here. Node's own modules.
//
//   node tests/outcomes-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { FIRST, HEADING, KINDS, LABEL, LEAST, MEASURES, MONTHS, OUTCOMES, corrections, counted, kindOf, lines, measure, outcomesFrom, windowOf } from "../scripts/outcomes.mjs";
import { CALLS, firstOf, gather, read, report as monthly, spending } from "../scripts/outcomes-read.mjs";
import { body, countsFrom } from "../scripts/state-report.mjs";
import { COUNT, LINES, TITLE as BLIND_TITLE, answersOf, bodyOf, draw, drawOf, earlierOf, laidOut, line as blindLine, reader as blindReader, shareOf } from "../scripts/blind-sample.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1200)}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OWNER = "owner-acct";
const of = key => MEASURES.find(m => m.key === key);

// ---- a correction ----
const labels = JSON.parse(fs.readFileSync(path.join(root, "scripts/labels.json"), "utf8"));
ok(Object.values(labels).some(g => g && typeof g === "object" && LABEL in g), "the label `correction` stands in the one list, labels.json");
ok(kindOf("x\nCorrection: misread\n") === "misread" && kindOf("Correction: looks wrong\r\nCorrection: rule missing") === "rule missing" && kindOf("Correction: does not work  ") === "does not work",
  "a kind is read from its line, the last one winning");
ok(kindOf("Correction: wrong") === null && kindOf("see Correction: misread") === null && kindOf("<!--\nCorrection: misread\n-->") === null && kindOf("```\nCorrection: misread\n```") === null && kindOf(null) === null,
  "a kind outside the four, inside a line, or hidden from the reader is not read");
const issue = (number, login, body, names = [LABEL], at = "2026-10-05T00:00:00Z") => ({ number, user: { login }, body, created_at: at, labels: names.map(name => ({ name })) });
const found = corrections([
  issue(1, OWNER, "What.\nCorrection: misread\nBrought in by: #10"),
  issue(2, OWNER, "A bug.\nBrought in by: #11", [LABEL, "bug"]),
  issue(3, "someone-else", "Correction: misread\nBrought in by: #12"),
  issue(4, OWNER, "Correction: looks wrong\nBrought in by: #13", ["bug"]),
  issue(5, OWNER, "Brought in by: #14"),
  { ...issue(6, OWNER, "Correction: misread"), pull_request: {} },
  issue(7, OWNER, "A bug.", [LABEL, "bug"]),
], [
  { issue: 1, at: "2026-10-06T00:00:00Z", login: OWNER, body: "Correction: rule missing\nBrought in by: #15" },
  { issue: 1, at: "2026-10-07T00:00:00Z", login: OWNER, body: "Correction: looks wrong" },
  { issue: 1, at: "2026-10-08T00:00:00Z", login: "someone-else", body: "Correction: misread" },
  { issue: 1, at: "2026-10-09T00:00:00Z", login: OWNER, body: "no kind here" },
  { issue: 5, at: "2026-10-10T00:00:00Z", login: "someone-else", body: "Brought in by: #99" },
  { issue: 7, at: "2026-10-10T00:00:00Z", login: OWNER, body: "Brought in by: #7" },
], OWNER);
ok(JSON.stringify(found) === JSON.stringify([
  { at: "2026-10-05T00:00:00Z", pull: 10, kind: "misread" }, { at: "2026-10-06T00:00:00Z", pull: 15, kind: "rule missing" }, { at: "2026-10-07T00:00:00Z", pull: 10, kind: "looks wrong" },
  { at: "2026-10-05T00:00:00Z", pull: 11, kind: "does not work" }, { at: "2026-10-05T00:00:00Z", pull: 14, kind: null },
  { at: "2026-10-05T00:00:00Z", pull: 7, kind: "does not work" },
]), "a correction is the owner's labelled issue and each note of the owner's on it with a kind; a bug with none does not work; the pull request named in a note of the owner's where the body names none; another's, an unlabelled one and a pull request are not one", JSON.stringify(found));

// ---- the measures ----
ok(counted(0) === "0 (± 0)" && counted(9) === "9 (± 6)" && counted(30) === "30 (± 11)", "a count stands with twice its square root");
const oct = windowOf("2026-10"), two = windowOf("2026-10", 2);
ok(new Date(oct.from).toISOString() === "2026-10-01T00:00:00.000Z" && new Date(oct.to).toISOString() === "2026-11-01T00:00:00.000Z" && new Date(two.from).toISOString() === "2026-09-01T00:00:00.000Z"
  && new Date(windowOf("2026-01", 2).from).toISOString() === "2025-12-01T00:00:00.000Z", "a window is the month, and the months before it where asked");
const pull = (number, when, extra = {}) => ({ number, when, created: when, mends: false, took: null, ...extra });
const data = {
  merged: [pull(10, "2026-10-02T00:00:00Z", { took: { answers: 10, out: 1000, into: 5000 } }), pull(11, "2026-10-03T00:00:00Z", { mends: true, took: { answers: 30, out: 3000, into: 9000 } }),
    pull(12, "2026-10-04T00:00:00Z"), pull(13, "2026-09-20T00:00:00Z"), pull(14, "2026-10-28T00:00:00Z")],
  reverts: [{ when: "2026-10-05T00:00:00Z", of: 12 }, { when: "2026-12-01T00:00:00Z", of: 14 }],
  queued: [{ joined: "2026-10-01T00:00:00Z", done: "2026-10-02T00:00:00Z" }, { joined: "2026-10-01T00:00:00Z", done: "2026-10-04T00:00:00Z" }],
  bugs: [{ at: "2026-10-01T00:00:00Z", closed: "2026-10-01T06:00:00Z" }],
  corrections: [{ at: "2026-10-05T00:00:00Z", pull: 10, kind: "misread" }, { at: "2026-10-20T00:00:00Z", pull: 14, kind: "does not work" }, { at: "2026-09-21T00:00:00Z", pull: 13, kind: "misread" }],
  sample: [{ ...pull(10, "2026-10-02T00:00:00Z"), created: "2026-10-01T00:00:00Z", events: ["2026-10-01T00:30:00Z", "2026-10-01T22:00:00Z"], after: ["finding", "check", "neither", "base"] }],
};
const t = (key, w = oct) => of(key).of(data, w).text;
ok(t("misread") === "1 (± 2) of 4 merged, 2.5 for every ten" && t("misread", two) === "2 (± 3) of 5 merged, 4 for every ten" && t("corrected") === "2 (± 3) of 4 merged, 5 for every ten",
  "corrections for every ten merged tasks, by kind and in all, within the span");
ok(t("failed") === "2 (± 3) of 4, 50%", "a merge counts as failed where a correction named it within two weeks or a revert undid it then, and not later", t("failed"));
ok(t("mending") === "1 (± 2) of 4, 25%" && t("queued") === "2 days (of 2)" && t("live") === "6 h (of 1)", "unplanned mending, the queue's time and a bug's time to live", [t("mending"), t("queued"), t("live")].join(" | "));
ok(t("cost") === "20 answers, 2,000 output tokens (of 2 priced)" && t("uncorrected") === "40 answers, 4,000 output tokens (of 2 priced, 1 not corrected)" && t("carried") === "400 (of 2 priced)",
  "the cost of a merged task, and of one not corrected after, carries all that was priced; the tokens carried into each answer", [t("cost"), t("uncorrected"), t("carried")].join(" | "));
ok(t("idle") === "98% of 24 open hours (of the 1 newest merged)", "the open hours in a gap of over an hour with no event", t("idle"));
ok(t("rework") === "3 (± 3) in 1 pull requests: a review finding 1, a failed check 1, neither (measuring again, or the builder's own) 1; and 1 bringing the branch up to date", "commits after ready, by cause, and the base's apart", t("rework"));
const rows = measure(data, "2026-10");
ok(lines({ rows, grown: null }).join("\n").includes(`for every ten, over the last ${MONTHS} months, still under ${LEAST}.`), "a count still under thirty when the months run out says so");
ok(rows.find(r => r.key === "misread").months === MONTHS && rows.every(r => r.months >= 1 && r.months <= MONTHS) && LEAST === 30,
  "where a count is under thirty the months before are added, up to the most");
const big = { ...data, merged: Array.from({ length: 40 }, (_, i) => pull(100 + i, "2026-10-10T00:00:00Z", { mends: i < 31 })) };
ok(measure(big, "2026-10").find(r => r.key === "mending").months === 1, "a count of thirty or more stands on its month alone");

// ---- the lines ----
const grown = { kb: 500, files: 100, large: 3, over: { lines: 2, depth: 0, branches: 5 }, marks: { lines: 60, depth: 4, branches: 15 } };
const out = lines({ rows, grown, first: { misread: "0 (± 0) of 207 merged, 0 for every ten" }, previous: "- corrections that a rule was missing, for every ten merged tasks: 9 (± 6) of 50 merged, 1.8 for every ten." });
const text = out.join("\n");
const again = lines({ rows, grown, previous: `**${HEADING} in 2026-09**\n${out.join("\n")}` }).join("\n");
ok(/a rule was missing[^\n]*At the last report: [^\n]*for every ten, over the last \d months, still under 30\./.test(again) && !/At the last report:[^\n]*At the /.test(again),
  "a report the script wrote is read back as the last report, indented as it writes it", again.split("\n").find(l => l.includes("a rule was missing")));
ok(OUTCOMES.filter(([k]) => k !== "cost").every(([, name]) => text.includes(`- **${name}**`)) && out[1].startsWith("- **The product does what was asked**"), "the report leads with the five outcomes, in their order");
ok(/\*\*It is fast\*\*: no direct measure yet/.test(text) && /\*\*A new user can use it\*\*: no direct measure yet/.test(text) && !/does what was asked\*\*: no direct/.test(text) && !/does not break\*\*: no direct/.test(text),
  "an outcome with no direct measure says so");
ok(text.indexOf("the task was misread") < text.indexOf("a rule was missing") && text.indexOf("**It does not break**") < text.indexOf("followed within two weeks"),
  "each outcome's direct measure stands first under it");
ok(/the task was misread[^\n]*At the first reading: 0 \(± 0\) of 207/.test(text) && /a rule was missing[^\n]*At the last report: 9 \(± 6\) of 50 merged, 1\.8 for every ten\./.test(text),
  "each line carries the first reading and the last report beside it");
ok(/- the code's size: 500 KB in 100 files, 3 of them over 20 KB\./.test(text) && /2 over 60 lines, 0 over 4 depth, 5 over 15 branches/.test(text) && /dropped errors: not measured yet \(#309\)/.test(text),
  "how the code grows, and dropped errors said not measured yet");
ok(lines({ rows, grown: null }).join("\n").includes("the code's size: not read"), "a code that cannot be read is said so, never a zero");
ok(text.includes(FIRST) && fs.existsSync(path.join(root, FIRST)), "the first reading stands in the core where the report says");

// ---- carried to the core's report ----
const report = body({ core: false, month: "2026-11", measures: null, previous: null, overdue: [], outcomes: out, scripts: "core/scripts" });
ok(report.indexOf(`**${HEADING} in 2026-10**`) > 0 && report.indexOf(`**${HEADING} in 2026-10**`) < report.indexOf("**The measures against their baselines**"), "the state report leads with the outcomes");
ok(body({ core: true, month: "2026-11", measures: null, previous: null, overdue: [], holders: [], scripts: "scripts" }).includes("- Not read: `scripts/outcomes-read.mjs` was not run for 2026-10."), "and says where they were not read");
const carried = outcomesFrom(report);
ok(carried.startsWith("outcomes in 2026-10: corrections that the task was misread") && carried.includes("the code's size 500 KB in 100 files") && countsFrom(report, true)?.includes("outcomes in 2026-10")
  && countsFrom(report, false, undefined, true)?.includes("outcomes in 2026-10"), "a public project's outcomes reach the core's report as one part of its line", carried);
ok(!(countsFrom(report, false) ?? "").includes("outcomes"), "a private project's outcomes do not");
const forged = report.replace("- the code's size: 500 KB", "- the code's size: our secret plan 500 KB").replace("- dropped errors", "- a name of ours: 3");
ok(!outcomesFrom(forged).includes("secret") && !outcomesFrom(forged).includes("name of ours") && outcomesFrom("no heading") === null, "a word or a measure not its own is not carried", outcomesFrom(forged));

// ---- read through gh ----
const iso = d => `2026-10-${String(d).padStart(2, "0")}T00:00:00Z`;
const fixtures = {
  pulls: [{ number: 20, merged_at: iso(10), created_at: iso(9), user: { login: "a" }, head: { repo: { full_name: "o/r" } }, title: "x", body: "Fixes #5\nSession so far: 10 answers; tokens in 1, cache written 1, cache read 1, out 10.\nhttps://claude.ai/code/session_A" },
    { number: 21, merged_at: iso(11), created_at: iso(10), user: { login: "dependabot[bot]" }, head: { repo: { full_name: "o/r" } }, title: "Bump", body: "" },
    { number: 22, merged_at: iso(12), created_at: iso(11), user: { login: "a" }, head: { repo: { full_name: "o/r" } }, title: 'Revert "x"', body: "Reverts o/r#20" },
    { number: 23, merged_at: null, created_at: iso(11), user: { login: "a" }, head: { repo: { full_name: "o/r" } }, title: "y", body: "" }],
  issues: [{ number: 5, state: "closed", state_reason: "completed", created_at: iso(8), closed_at: iso(10), labels: [{ name: "bug" }, { name: "queued" }], user: { login: "o" }, body: "" }],
};
const calls = [];
const gh = route => {
  calls.push(route);
  const page1 = rows => JSON.stringify(/page=1$/.test(route) || !/page=/.test(route) ? rows : []);
  if (/\/pulls\?state=all/.test(route)) return page1(fixtures.pulls);
  if (/\/issues\?state=all/.test(route)) return page1(fixtures.issues);
  if (/\/issues\/5\/events/.test(route)) return page1([{ event: "labeled", created_at: iso(8), label: { name: "queued" } }]);
  if (/\/issues\/20\/events/.test(route)) return page1([{ event: "ready_for_review", created_at: iso(9) }]);
  if (/\/issues\/6\/comments/.test(route)) return page1([{ created_at: iso(12), user: { login: "o" }, body: "Correction: looks wrong\nBrought in by: #20" }]);
  if (/\/pulls\/20\/commits/.test(route)) return page1([{ sha: "a1", commit: { committer: { date: iso(9).replace("00:00:00", "01:00:00") } }, parents: [{}] }, { sha: "b2", commit: { committer: { date: iso(9).replace("00:00:00", "05:00:00") } }, parents: [{}] }]);
  if (/\/commits\/a1\/check-runs/.test(route)) return JSON.stringify({ check_runs: [{ conclusion: "failure" }] });
  return "[]";
};
fixtures.issues.push({ number: 6, state: "open", created_at: iso(11), labels: [{ name: "correction" }], user: { login: "o" }, body: "Correction: misread\nBrought in by: #20" });
const got = read("o/r", Date.parse(iso(1)), Date.parse("2026-11-01T00:00:00Z"), "o", gh);
ok(got.merged.map(p => p.number).join() === "20,22" && got.merged[0].mends && got.reverts[0].of === 20 && got.queued.length === 1 && got.queued[0].joined === iso(8) && got.bugs.length === 1,
  "what is read: Dependabot's merge and an unmerged one left out, a merge closing a bug is mending, a revert names what it undid, the queue's and a bug's times");
ok(JSON.stringify(got.corrections) === JSON.stringify([{ at: iso(11), pull: 20, kind: "misread" }, { at: iso(12), pull: 20, kind: "looks wrong" }]), "a correction's notes are read on its own issue", JSON.stringify(got.corrections));
ok(got.sample.find(p => p.number === 20).after.join() === "neither,check" && calls.some(r => /pulls\/20\/commits/.test(r)),
  "a commit after ready with no finding before it, where a check failed on the commit before, counts as a failed check, and the first after ready, with no commit before it to read, as neither", JSON.stringify(got.sample));
ok(!calls.some(r => /issues\/comments|pulls\/comments\?|issues\/events\?/.test(r)), "nothing is listed repository-wide but the pull requests and issues of the span", calls.join(" "));
ok(calls.some(r => /pulls\?state=all&sort=updated&direction=desc/.test(r)) && !calls.some(r => /sort=created/.test(r)), "the pull requests are listed newest updated first, so one opened before the span and merged in it is read");
const manifest = "| *owner's account* | `o` |\n";
ok(/the task was misread[^\n]*: 1 \(± 2\)/.test(monthly({ repo: "someone/r", month: "2026-10", manifest, root, gh }).join("\n")) && /the task was misread[^\n]*: 0 \(± 0\)/.test(monthly({ repo: "someone/r", month: "2026-10", manifest: "", root, gh }).join("\n")),
  "the owner's corrections are read by the account the manifest names, not the repository's");
ok(gather({ repo: "o/r", owner: "o", to: Date.parse(iso(11)), pulls: fixtures.pulls, issues: [] }).sample.map(p => p.number).join() === "20",
  "the sample is of the merges before the span's end");

// ---- the budget ----
let spent = 0;
const counting = route => { spent++; return gh(route); };
const small = read("o/r", Date.parse(iso(1)), Date.parse("2026-11-01T00:00:00Z"), "o", counting, { calls: 4, ms: 60e3 });
ok(spent <= 4 && small.sample.length === 0 && small.merged.length === 2, "a run spends no more calls than its budget: the listings first, the items one by one only while it lasts", `${spent} calls, ${small.sample.length} sampled`);
ok(/^- Not read: the pull requests and issues of the months to 2026-10 took more than the \d+ calls/.test(monthly({ repo: "o/r", month: "2026-10", manifest: "", root, gh: () => { throw new RangeError("spent"); } })[0]),
  "where the listings alone pass the budget, nothing is read, and the line says why");
const spend = spending(() => "[]", { calls: 2, ms: 60e3 });
spend(); spend();
ok(!spend.left() && (() => { try { spend(); return false; } catch (e) { return e instanceof RangeError; } })() && CALLS <= 200, "the budget refuses the call past it");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "outcomes-"));
fs.mkdirSync(path.join(tmp, "reports"));
fs.writeFileSync(path.join(tmp, FIRST), "[".repeat(20000) + "]".repeat(20000));
const deep = firstOf("o/r", tmp);
fs.writeFileSync(path.join(tmp, FIRST), JSON.stringify({ repos: { "o/r": { misread: "1 (± 2)", bad: { x: 1 }, long: "x".repeat(400) } } }));
ok(deep === null && JSON.stringify(firstOf("o/r", tmp)) === JSON.stringify({ misread: "1 (± 2)" }), "a first reading too deep is refused, and only short texts are taken from it");
ok(!monthly({ repo: "o/r", month: "2026-10", manifest: "| *owner's account* | `o` |\n", root: tmp, gh }).join("\n").includes("At the first reading"), "a project's own file is never read as the first reading");
fs.rmSync(tmp, { recursive: true, force: true });

// ---- the command ----
const run = args => spawnSync(process.execPath, [path.join(root, "scripts/outcomes-read.mjs"), ...args], { encoding: "utf8" });
for (const args of [[], ["--repo", "o/r"], ["--repo", "../x", "--month", "2026-10"], ["--repo", "o/r", "--month", "2026-13"], ["--repo", "o/r", "--from", "2026-10-01"], ["--repo", "o/r", "--from", "2026-10-01", "--to", "2026-11-01", "--root", "/no/such/folder"]]) {
  const r = run(args);
  ok(r.status === 1 && mended(r.stderr), `a wrong call (${args.join(" ") || "none"}) fails with its mend`, r.stderr);
}
ok(KINDS.length === 4, "four kinds of correction");

// ---- the blind sample (#594): drawn by the month alone, laid out without its story, answered by the owner ----
const merged = Array.from({ length: 30 }, (_, i) => ({ number: i + 1, merged_at: "2026-10-05T00:00:00Z", head: { ref: i === 3 ? "dependabot/npm/x" : `b${i}` }, user: { login: i === 4 ? "dependabot[bot]" : "o" } }));
const picked = draw(merged, "o/n", "2026-10");
ok(picked.length === COUNT && JSON.stringify(picked) === JSON.stringify(draw([...merged].reverse(), "O/N", "2026-10")) && !picked.includes(4) && !picked.includes(5)
  && JSON.stringify(picked) !== JSON.stringify(draw(merged, "o/n", "2026-09")) && draw(merged.slice(0, 3), "o/n", "2026-10").length === 3,
  "the draw: ten of the month's merges, the same whatever their order, none of Dependabot's, another for another month", JSON.stringify(picked));
const long = laidOut([{ filename: "a`b.md", status: "modified", additions: 99, deletions: 1, patch: Array.from({ length: 80 }, (_, i) => `+line ${i} \`\`\``).join("\n") }]);
ok(long.includes("- `a?b.md` (modified, +99 -1)") && !long.split("```diff")[1].split("\n```")[0].includes("```") && long.includes(`(${81 - LINES} more lines of the diff not shown)`),
  "a change is laid out by its files and its diff, capped, its own fences and backticks made harmless", long.slice(0, 300));
const sample = bodyOf("2026-10", "2026-11-01T05:00:00Z", [7, 9, 12], n => [{ filename: `f${n}.mjs`, status: "added", additions: 1, deletions: 0, patch: "+x" }]);
ok(/^### 3$/m.test(sample) && !/#7\b|Fixes|merged by|author/i.test(sample.split("<!--")[0]) && JSON.stringify(drawOf(sample)) === JSON.stringify({ month: "2026-10", drawn: "2026-11-01T05:00:00Z", pulls: [7, 9, 12] }) && drawOf("no draw") === null,
  "the issue's text shows each change by its place alone; the draw it holds is read back from it", sample.slice(0, 400));
// (a diff that holds a draw's own mark is not taken for it; the draws before are kept; the whole stays under the limit)
const copied = bodyOf("2026-10", "2026-11-01T05:00:00Z", [7], () => [{ filename: "x.md", status: "modified", patch: "+<!-- blind-sample 2020-01 drawn 2020-02-01T00:00:00Z pulls 999 -->" }], [{ month: "2026-09", drawn: "2026-10-01T05:00:00Z", pulls: [3, 4] }]);
ok(drawOf(copied)?.month === "2026-10" && JSON.stringify(drawOf(copied).pulls) === "[7]" && earlierOf(copied).length === 1 && earlierOf(copied)[0].pulls.join() === "3,4",
  "a mark inside a diff is no draw's, and the draws before stay noted", JSON.stringify(drawOf(copied)));
const wide = bodyOf("2026-10", "2026-11-01T05:00:00Z", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], () => Array.from({ length: 40 }, (_, i) => ({ filename: `f${i}.md`, status: "modified", patch: Array.from({ length: 60 }, () => `+${"x".repeat(300)}`).join("\n") })));
ok(wide.length < 65536 && drawOf(wide)?.pulls.length === 10 && /and 20 more files/.test(wide), "ten wide changes stay under GitHub's limit for an issue's text", wide.length);
const at = t => `2026-11-0${t}T00:00:00Z`, me = { login: "owner" };
const said = [
  { user: me, created_at: "2026-10-30T00:00:00Z", body: "1: no, misread" },
  { user: me, created_at: at(2), body: "1: yes\n2: no, looks wrong\n9: yes\nwhy not" },
  { user: { login: "someone" }, created_at: at(3), body: "3: yes" },
  { user: me, created_at: at(4), body: "From a builder session, on #1: 3: yes\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_" },
  { user: me, created_at: at(5), body: "1: No" },
];
const d = drawOf(sample), answers = answersOf(d, said, "OWNER"), share = shareOf({ body: sample }, said, "owner");
ok(Object.keys(answers).join() === "1,2" && answers[1].yes === false && answers[2].kind === "looks wrong" && answers[2].pull === 9
  && share.answered === 2 && share.approved === 0 && share.no.map(x => x.pull).join() === "7,9",
  "the owner's own answers since the draw count, the last to each place; an agent's, another account's, an earlier one and a place past the draw do not", JSON.stringify(answers));
const late = answersOf(d, [...said, { user: me, created_at: at(6), body: "2026-09 2: yes\n2026-10 3: yes" }], "owner");
ok(late[2].yes === false && late[3]?.yes === true, "an answer that names another month's draw is not this one's, and one that names this month is", JSON.stringify(late));
ok(blindLine(share) === "- the share of the blind sample approved: 0 (± 0) of 2 answered, 0%, of 3 drawn from 2026-10." && /not read, none of 3 drawn from 2026-10 answered/.test(blindLine({ ...share, answered: 0 })) && /not read, none drawn yet/.test(blindLine(null)),
  "the report's line: the share approved of those answered, or not read", blindLine(share));
const withBlind = lines({ rows, grown, blind: blindLine(share) }), blindReport = `**${HEADING} in 2026-10**\n${withBlind.join("\n")}`;
ok(withBlind.some(l => l === `  ${blindLine(share)}`) && outcomesFrom(blindReport).includes("the share of the blind sample approved 0 (± 0) of 2 answered, 0%, of 3 drawn from 2026-10"),
  "the share stands beside the other outcomes, and a project's reaches the core's report", outcomesFrom(blindReport));
const pullsOct = JSON.stringify(merged.slice(0, 2).map(p => ({ ...p, updated_at: p.merged_at })));
const ghOf = issues => route => (route.includes("/issues?") ? (route.includes("page=1") || !route.includes("page=") ? JSON.stringify(issues) : "[]") : route.includes("/pulls?") ? (route.includes("page=1") ? pullsOct : "[]") : route.includes("/files") ? JSON.stringify([{ filename: "x.md", status: "modified", patch: "+y" }]) : "[]");
const fresh = blindReader({ repo: "o/n", at: "2026-11-01T05:12:34.567Z", gh: ghOf([]) });
ok(fresh.title === BLIND_TITLE && fresh.owner === true && drawOf(fresh.body)?.month === "2026-10" && drawOf(fresh.body).drawn === "2026-11-01T05:12:34Z" && drawOf(fresh.body).pulls.length === 2,
  "the look's reader lays out the month before's draw on the month's first run, needs-owner, drawn at that run", fresh.body?.slice(-120));
const rolled = blindReader({ repo: "o/n", at: "2026-12-01T05:00:00Z", gh: ghOf([{ number: 3, title: BLIND_TITLE, body: fresh.body }]) });
ok(drawOf(rolled.body)?.month === "2026-11" && earlierOf(rolled.body).map(d => d.month).join() === "2026-10", "the next month's draw keeps the one it replaces noted", rolled.body?.slice(-200));
const stands = blindReader({ repo: "o/n", at: "2026-11-09T05:00:00Z", gh: ghOf([{ number: 3, title: BLIND_TITLE, body: fresh.body }]) });
ok(stands.unread && !stands.body && blindReader({ repo: "o/n", at: "2026-11-09T05:00:00Z", gh: () => { throw new Error("403"); } }).unread && blindReader({ at: "2026-11-09T05:00:00Z" }) === null,
  "on later runs of the month the issue stands as it is; where GitHub does not answer, nothing is changed", JSON.stringify(stands));

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
