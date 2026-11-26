// Tests the dose (scripts/dose.mjs): the state read from the shares, the one a project names instead, when
// an audit is due in each state and when it is the owner's to see, what is cleaned first, and whole runs in a scratch
// repository: the two tasks the scheduled look keeps, the share the cleaning lane got, and an audit recorded. Run by
// the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/dose-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditDue, auditIsDue, auditOf, BATCH, cleaningDue, DAYS, DEBT, fileOf, MOVED, named, reading, STANDARD, stateOf, TITLES, worstFirst } from "../scripts/dose.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { shallowCopy } from "../scripts/scratch-shallow.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1500).replace(/\n/g, "\n     ")}`}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- the state ----
ok(stateOf({ listed: 0, read: 0 }) === "in standard" && stateOf({ listed: 5, read: 1000 }) === "in standard" && stateOf({ listed: 6, read: 1000 }) === "paying down" && stateOf({ listed: 50, read: 1000 }) === "paying down" && stateOf({ listed: 51, read: 1000 }) === "in debt",
  `the state is read from the share the baseline lists: in standard to ${STANDARD}, in debt past ${DEBT}, paying down between`);
ok(stateOf({ listed: 500, read: 1000 }, "in standard") === "in standard" && named("| *dose* | `paying down` |") === "paying down" && named("the *dose*: `in debt`, on the owner's word") === "in debt" && named("| *dose* | soon |") === null && named("`in debt` is a state\n| *copies check* | x |") === null,
  "a project's owner names the state instead, in one line of its rules; a line that names none changes nothing");

// ---- when an audit is due ----
const at = "2026-12-20T05:00:00Z", day = n => new Date(Date.parse(at) - n * 86400000).toISOString().slice(0, 10);
const due = (state, audited, listed = 100, read = 1000) => auditDue({ state, audited, listed, read, at });
ok(due("in debt", null).why.includes("no audit yet") && due("paying down", { day: "soon", listed: 1, read: 1 }).why.includes("no audit yet") && due("in standard", null) === null, "where no audit is recorded, one is due in debt and paying down, none in standard");
ok(due("paying down", { day: day(DAYS - 1), listed: 100, read: 1000 }) === null && same(due("paying down", { day: day(DAYS), listed: 100, read: 1000 }), { why: `the audit of ${day(DAYS)} is ${DAYS} days old`, owner: false }), `paying down, an audit is due ${DAYS} days after the last, and is never the owner's to see`);
ok(due("in debt", { day: day(3), listed: 111, read: 1000 }) === null && due("in debt", { day: day(3), listed: 112, read: 1000 }).why.includes("a cleaning batch is done") && due("paying down", { day: day(3), listed: 200, read: 1000 }) === null,
  `in debt, an audit is due after each cleaning batch: the baseline ${BATCH} smaller than at the last`);
ok(due("in debt", { day: day(DAYS), listed: 100, read: 1000 }).owner === true && due("in debt", { day: day(DAYS), listed: 90, read: 1000 }).owner === true && due("in debt", { day: day(DAYS), listed: 101, read: 1000 }).owner === false,
  "in debt, an audit that comes due by its days with the baseline no smaller than at the last is the owner's to see");
ok(due("in standard", { day: day(400), listed: 0, read: 1000 }) === null && due("in standard", { day: day(2), listed: 0, read: 800 }).why.includes("much of the code has changed") && due("in standard", { day: day(2), listed: 0, read: 1334 }) !== null && due("in standard", { day: day(2), listed: 0, read: 801 }) === null,
  `in standard, an audit is due only once what the check reads has moved by ${MOVED} since the last`);
ok(auditOf({ day: "2026-11-15", listed: 3, read: 9 }) !== null && auditOf({ day: "2026-11-15", listed: -1, read: 9 }) === null && auditOf({ day: "15 November", listed: 3, read: 9 }) === null && auditOf(null) === null, "an audit's record is read only where it holds a day and two counts");

// ---- what is cleaned first ----
ok(same(["function: src/a.js#f#2", "crossing: rules -> view: src/r/a.js -> src/v/b.js", "inside: (no system) -> rules: main.js -> src/r/x.js", "cycle: a.js -> b.js", "platform: src/x.js -> electron", "package: src/y.js -> @x/y", "clock: src/r/t.js: new Date()", "change: src/a.js: a change's heading", "screen: src/t.test.js -> playwright"].map(fileOf),
  ["src/a.js", "src/r/a.js", "main.js", "a.js", "src/x.js", "src/y.js", "src/r/t.js", "src/a.js", "src/t.test.js"]), "an entry's file is the function's own, or the importing one, or a comment's or a test's");
const first = worstFirst(["function: a.js#f", "function: a.js#g", "function: b.js#f", "cycle: c.js -> a.js", "function: d.js#f"], new Map([["a.js", 1], ["b.js", 9], ["c.js", 0]]));
ok(same(first.map(f => f.file), ["b.js", "a.js", "c.js", "d.js"]) && first[1].entries === 2 && first[0].changes === 9, "worst first is where change meets tangle: what is listed of a file, times how often it changed", JSON.stringify(first));

// ---- whole runs, in a scratch repository ----
const script = fileURLToPath(new URL("../scripts/dose.mjs", import.meta.url)), shape = fileURLToPath(new URL("../scripts/shape.mjs", import.meta.url));
const dir = scratchDir("dose-test-");
const git = (...args) => execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "-c", "core.autocrlf=false", ...args], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const put = (file, text) => { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), text); };
const run = (file, args = []) => { const r = spawnSync(process.execPath, [file, ...args], { cwd: dir, encoding: "utf8", env: { ...process.env, SHAPE_BASE: "" } }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
const commit = what => { git("add", "-A"); git("commit", "-q", "-m", what); };
const long = (name, lines) => `export function ${name}(a) {\n${"  a++;\n".repeat(lines - 2)}}\n`;
const manifest = "# Core manifest\n\n## Slots\n| Slot | Here |\n| --- | --- |\n| *shape check* | `core/scripts/shape.mjs` with `checks/shape.json` |\n";
const now = new Date().toISOString();
git("init", "-q", "-b", "main");
put("core-manifest.md", manifest);
put("src/a.js", long("one", 70) + long("two", 80) + "export const fine = 1;\n");
put("src/b.js", long("three", 90));
commit("a project");
ok(reading(manifest, dir) === null && cleaningDue({ manifest, at: now, root: dir }).body === null && auditIsDue({ manifest, at: now, root: dir }).body === null && /No config of the shape check/.test(run(script).out),
  "a project with no config of the shape check has no dose: the look keeps no issue for it");
put("checks/shape.json", JSON.stringify({ baseline: "checks/shape-baseline.json", code: ["src"] }));
run(shape, ["checks/shape.json", "--first"]);
commit("the shape check");
for (const n of [1, 2, 3]) { put("src/b.js", `${long("three", 90)}// touched ${n}\n`); commit(`change ${n} to b`); }
let r = reading(manifest, dir);
ok(r.state === "in debt" && r.listed === 3 && r.read === 3 && r.named === null, "its state is read from its baseline and its code", JSON.stringify({ state: r.state, listed: r.listed, read: r.read }));
let cleaning = cleaningDue({ manifest, at: now, root: dir });
ok(cleaning.title === TITLES.cleaning && /\*\*in debt\*\*/.test(cleaning.body) && /most of the work/.test(cleaning.body) && /0 of the 5 changes that reached this branch in the last 30 days lowered the baseline/.test(cleaning.body)
  && cleaning.body.indexOf("`src/b.js`: 1 listed, changed 4 times") > 0 && cleaning.body.indexOf("`src/b.js`: 1 listed") < cleaning.body.indexOf("`src/a.js`: 2 listed, changed 1 times") && /node core\/scripts\/shape\.mjs --write/.test(cleaning.body),
  "in debt, the cleaning task says the state, the lane's share and what it got, the files worst first, and how", cleaning.body);
let audit = auditIsDue({ manifest, at: now, root: dir });
ok(audit.title === TITLES.audit && audit.owner === false && /no audit yet/.test(audit.body) && /core\/tasks\/cleaning\.md/.test(audit.body) && /dose\.mjs --audited/.test(audit.body) && !/read-total/.test(audit.body), "and an audit is due, since none is recorded, its reader given the core's candidates of the total read only in the core's own repository", audit.body);
r = run(script, ["--audited"]);
const baseline = () => JSON.parse(fs.readFileSync(path.join(dir, "checks/shape-baseline.json"), "utf8"));
ok(r.status === 0 && same(baseline().audited, { day: now.slice(0, 10), listed: 3, read: 3 }) && Object.keys(baseline().listed).length === 3 && run(shape).status === 0, "--audited records the day and the counts in the baseline, which the shape check still reads", r.out);
ok(auditIsDue({ manifest, at: now, root: dir }).body === null, "after which no audit is due");
commit("the audit recorded");
ok(/0 of the 6 changes that reached this branch in the last 30 days lowered the baseline/.test(cleaningDue({ manifest, at: new Date().toISOString(), root: dir }).body), "a change that only records an audit lowered nothing, and is no part of the cleaning lane's share");
const later = new Date(Date.parse(now) + (DAYS + 1) * 86400000).toISOString();
audit = auditIsDue({ manifest, at: later, root: dir });
ok(audit.owner === true && /For the owner to see/.test(audit.body) && /no smaller than at the last audit \(3 then\)/.test(audit.body) && /Nothing fails/.test(audit.body), "a month on, in debt and no smaller, the audit's task is the owner's to see, and says that nothing fails", audit.body);
put("src/b.js", "export const three = 3;\n");
run(shape, ["--write"]);
commit("b cleaned");
cleaning = cleaningDue({ manifest, at: new Date().toISOString(), root: dir });
ok(/1 of the 7 changes/.test(cleaning.body) && !/src\/b\.js/.test(cleaning.body), "a change that lowers the baseline counts to the cleaning lane's share", cleaning.body);
ok(/a cleaning batch is done/.test(auditIsDue({ manifest, at: now, root: dir }).body), "and a batch done makes the next audit due");
// A shallow clone holds no history before its boundary: the cleaning task is left as it stands, unread, and the script fails, each with the mend (#1422).
{
  const cut = shallowCopy(dir, "shallow", 1);
  const gap = cleaningDue({ manifest, at: new Date().toISOString(), root: cut }), cli = spawnSync(process.execPath, [script], { cwd: cut, encoding: "utf8", env: { ...process.env, SHAPE_BASE: "" } });
  ok(gap.body === null && /shallow/.test(gap.unread) && /boundary/.test(gap.unread) && !/Mend:/.test(gap.unread), "in a shallow clone the cleaning task is left unread, not counted from the part the clone holds", gap.unread);
  ok(cli.status === 1 && mended(`${cli.stdout}${cli.stderr}`) && /git fetch --unshallow/.test(cli.stderr), "and the script fails there, saying the mend", `${cli.stdout}${cli.stderr}`);
  fs.rmSync(cut, { recursive: true, force: true });
}
put("core-manifest.md", `${manifest}| *dose* | \`in standard\` |\n`);
run(script, ["--audited"]);
r = run(script);
ok(r.status === 0 && /\*\*in standard\*\* \(named so in the project's rules\)/.test(r.out) && /No cleaning beyond what the shape check holds/.test(r.out) && /No audit by a reader is due/.test(r.out)
  && cleaningDue({ manifest: fs.readFileSync(path.join(dir, "core-manifest.md"), "utf8"), at: now, root: dir }).body === null, "a state the owner names in one line of the manifest sets the dose instead", r.out);
put("checks/shape-baseline.json", "{}");
const unread = cleaningDue({ manifest, at: now, root: dir });
ok(unread.body === null && /no "listed" object/.test(unread.unread) && run(script).status === 1 && mended(run(script).out), "a baseline that cannot be read leaves the look's issue as it stands, and the script fails with the mend", `${unread.unread}\n${run(script).out}`);
ok(run(script, ["--sideways"]).status === 1 && mended(run(script, ["--sideways"]).out), "an option it does not know is refused, with its mend");

// the core's own: its AGENTS.md names its config, and its state is read from it
const core = fileURLToPath(new URL("..", import.meta.url));
const own = reading(fs.readFileSync(path.join(core, "AGENTS.md"), "utf8"), core);
ok(own !== null && own.at === ".github/shape.json" && own.read > 0, "the core's own dose is read from the config its AGENTS.md names", own && own.at);

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
