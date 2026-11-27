// Tests of the code scan's own logic (code-scan.mjs), which need no engine: what a pull request's description lists as
// false alarms and as unread files, hostile descriptions (nothing, the wrong type, markup, a path, a number out of
// range, too long), the files the engine did not read whole, the verdicts on its findings, and whether a change needs
// the engine installed or the host's CodeQL scans the project. The engine's own cases, on samples, and the scan of a pull
// request in a scratch repository are tests/code-scan-test.mjs. Git and Node's own modules.
//
//   node tests/code-scan-logic-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mended } from "../scripts/mend.mjs";
import { scratchDir, tally } from "../scripts/scratch-core.mjs";
import { checkout, copied, OWN_SCRIPT } from "../scripts/core-path-scratch.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { falseAlarms, hostScans, installNot, runEngine, scan, answer as engineAnswer, targets, verdicts, unreadLines, unreadListed, unreadOf } from "../scripts/code-scan.mjs";

const { ok, done } = tally();
const tmp = scratchDir("code-scan-logic-test-");

// what a description lists as false alarms, and whether the host scans a project
ok([...falseAlarms("Scan false alarm: `src/a.js:12`, a fixed list\n- Scan false alarm: `b.py:3`, why\nscan false alarm: `c.cs:1`\nSee Scan false alarm: `d.js:4`")].join(" ") === "src/a.js:12 b.py:3",
  "a false alarm is a line of its own, opening \"Scan false alarm:\" with its place in backticks");
// what the engine was given and did not read whole, and what a description lists as unread
{
  const read = unreadOf(["a.py", "b.py", "c.py", "d.py"], { scanned: new Set(["a.py", "b.py", "c.py"]), errors: [{ path: "b.py", partial: false, what: "Timeout when running py-command on b.py:" }, { path: "c.py", partial: true, what: "Syntax error at line c.py:2:" }] });
  ok(read.map(u => u.file).join(" ") === "b.py d.py" && /stopped on it: Timeout/u.test(read[0].why) && /did not scan it/u.test(read[1].why), "a file the engine did not scan, or stopped on, is unread; one it parsed in part is read", JSON.stringify(read));
  const got = { scanned: new Set(["a.py", "c.py"]), errors: [] };
  const lines = unreadLines(["a.py", "b.py", "c.py", "d.py"], got, { base: "HEAD~1", listed: new Set(["b.py", "c.py", "e.py"]), held: ["e.py"] });
  ok(lines.some(l => /^- passed: b\.py: the engine did not scan it, listed in the description/u.test(l)) && lines.some(l => /^FAIL: d\.py: the engine did not scan it/u.test(l)) && mended(lines.join("\n"))
    && lines.some(l => /^- listed as unread, but the engine read it whole: c\.py/u.test(l)) && lines.some(l => /^- passed: e\.py: the engine gave no answer with it/u.test(l)),
    "a listed file the engine did not read passes, an unlisted one fails with its mend, a listed one it read excuses nothing, and one held back is said", lines.join("\n"));
  // (the retry, with a stand-in for the engine that gives no answer where bomb.py is among its files)
  const ran = [], stand = (dir, root, files) => { ran.push(files.join(" ")); return files.includes("bomb.py") ? { failed: "no answer" } : { findings: files.map(f => ({ file: f })), errors: [], scanned: new Set(files) }; };
  const tried = engineAnswer("engine", ".", ["bomb.py", "evil.py", "a.py"], new Set(["bomb.py", "evil.py"]), stand);
  ok(tried.held.join(" ") === "bomb.py" && tried.read.join(" ") === "evil.py a.py" && tried.got.findings.map(f => f.file).join(" ") === "evil.py a.py" && ran.includes("bomb.py") && ran.includes("evil.py"),
    "where the engine gives no answer, each listed file is tried alone: only the one it still cannot answer on is held back, and a listed file it reads is judged with the rest", ran.join(" | "));
  ok(engineAnswer("engine", ".", ["bomb.py", "a.py"], new Set(), stand).got.failed === "no answer", "with no file listed, an engine that gives no answer is no answer: the scan fails on it");
  // (a base the engine could not read: every finding is the change's own)
  const own = verdicts([{ file: "x.py", line: 3, from: 0, to: 0, rule: "py-command", message: "m" }], { root: tmp, base: "HEAD~1", stood: new Map(), added: new Map(), explained: new Set() });
  ok(own.fails.length === 1 && mended(own.fails.join("\n")), "with nothing known to stand at the base, a finding fails as the change's own, saying its mend", own.fails.join("\n"));
  ok([...unreadListed("Scan unread: `big/data.py`, a generated table\n- Scan unread: `x.cs`\nscan unread: `y.py`\n<b>Scan unread: `z.py`</b>")].join(" ") === "big/data.py x.cs" && unreadListed(undefined).size === 0, "a file is listed unread on a line of its own, opening \"Scan unread:\" with its path in backticks");
}
// (hostile descriptions: nothing, the wrong type, markup, a path, a number out of range, too long; none lists a finding
// it does not name exactly, and none takes long)
{
  const t0 = Date.now();
  const long = `${"Scan false alarm: `".repeat(200000)}x`;
  ok(falseAlarms(undefined).size === 0 && falseAlarms(null).size === 0 && falseAlarms(42).size === 0 && falseAlarms({ toString: () => "Scan false alarm: `a.py:1`" }).size === 1 && falseAlarms("").size === 0,
    "a description that is nothing, or no text, lists no false alarm, and one is read as text");
  ok([...falseAlarms("<b>Scan false alarm: `a.py:1`</b>\nScan false alarm: `<script>`\nScan false alarm: `a.py:1x`")].length === 0, "markup around or in the line lists nothing");
  ok([...falseAlarms("Scan false alarm: `../../etc/passwd:1`\nScan false alarm: `a.py:99999999999999999999999`")].join(" ") === "../../etc/passwd:1 a.py:99999999999999999999999", "a path or a number out of range is listed only as written, matching no finding a file inside the project gives");
  ok(falseAlarms(long).size === 0 && Date.now() - t0 < 2000, "a description far past any real one is read in time, and lists nothing");
}
{
  const p = path.join(tmp, "host"); fs.mkdirSync(path.join(p, ".github", "workflows"), { recursive: true });
  fs.writeFileSync(path.join(p, ".github", "workflows", "codeql.yml"), "# uses: owner/core/.github/workflows/codeql.yml@x (a comment)\njobs: {}\n");
  const before = hostScans(p);
  fs.writeFileSync(path.join(p, ".github", "workflows", "text.yml"), "jobs:\n  a:\n    runs-on: x\n    steps:\n      - run: |\n          uses: owner/core/.github/workflows/codeql.yml@main\n");
  const inText = hostScans(p);
  fs.writeFileSync(path.join(p, ".github", "workflows", "other.yml"), `jobs:\n  a:\n    uses: someone/else/.github/workflows/codeql.yml@${"0".repeat(40)}\n  b:\n    uses: ${CORE}/.github/workflows/codeql.yml@main\n`);
  const another = hostScans(p);
  fs.writeFileSync(path.join(p, ".github", "workflows", "scan.yaml"), `jobs:\n  analyze:\n    uses: ${CORE}/.github/workflows/codeql.yml@0123456789abcdef0123456789abcdef01234567\n`);
  ok(!before && !inText && !another && hostScans(p) && !hostScans(tmp), "the host scans a project where a job calls the core's own codeql.yml at a full commit, not where a comment or a step's text names it, nor another's or one at a branch");
  const nothing = path.join(tmp, "no-code"), g = (...a) => execFileSync("git", a, { cwd: nothing, env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" } });
  fs.mkdirSync(nothing); g("init", "-q"); g("commit", "-q", "--allow-empty", "-m", "base"); fs.writeFileSync(path.join(nothing, "README.md"), "words\n"); g("add", "-A"); g("commit", "-q", "-m", "docs");
  ok(installNot(nothing, "HEAD~1") === "the change adds or alters no file of the kinds the scan reads" && installNot(nothing) === null, "a change of no file the scan reads installs no engine; with no base, as on a push to main, the engine is installed");
  ok(scan(nothing, { base: "HEAD~1", dir: path.join(tmp, "no-engine-here") }).lines.join("").includes("no file of the kinds it reads changed"), "and its scan says so, with no engine to ask");
  ok(/a workflow calls the core's codeql\.yml/u.test(installNot(p) ?? ""), "where the host's CodeQL scans the project, no engine is installed");
  // (a scan's bounds: past its files or its time it fails closed, with its mend, and holds no listed file back)
  for (const f of ["a.js", "b.js", "c.js"]) fs.writeFileSync(path.join(nothing, f), "x();\n");
  g("add", "-A"); g("commit", "-q", "-m", "code");
  const many = scan(nothing, { base: "HEAD~1", dir: path.join(tmp, "no-engine-here"), most: { files: 2, time: 60000 } });
  ok(many.failed && /past the 2 one scan reads/u.test(many.lines.join("\n")) && mended(many.lines.join("\n")), "a change past the files one scan reads fails, with its mend", many.lines.join("\n"));
  const late = runEngine(path.join(tmp, "no-engine-here"), nothing, ["a.js"], Date.now() - 1);
  const calls = [], slow = (dir, root, files, until) => { calls.push(files.join(" ")); return Date.now() >= until ? { failed: "late", late: true } : { failed: "no answer" }; };
  const timed = engineAnswer("engine", ".", ["a.js", "b.js"], new Set(["a.js", "b.js"]), slow, Date.now() - 1);
  const overTime = scan(nothing, { base: "HEAD~1", dir: path.join(tmp, "no-engine-here"), most: { files: 10, time: -1 } });
  ok(overTime.failed && /ran past the \d+ s its runs have together/u.test(overTime.lines.join("\n")) && mended(overTime.lines.join("\n")), "a scan past its time fails closed, with its mend", overTime.lines.join("\n"));
  ok(late.late === true && timed.got.late === true && timed.held.length === 0 && calls.length === 1, "a run past the scan's time is late, and holds no listed file back: the scan fails on it", JSON.stringify({ late, timed, calls }));
}

// The copy told apart from the core's own repository, as core-path.mjs's copyAside does (#1350): where
// scripts/core-path.mjs is tracked at the root, a core-manifest.md beside it names no copy, and the folder it names is
// scanned; in a project, which tracks no such script there, the copy is left out
{
  const both = { "core-manifest.md": copied("lib/"), "lib/a.js": "x();\n", "src/b.js": "y();\n" };
  const own = targets(checkout(tmp, "targets-own", { ...both, ...OWN_SCRIPT })), copy = targets(checkout(tmp, "targets-copy", both));
  ok(own.includes("lib/a.js") && own.includes("scripts/core-path.mjs") && !copy.includes("lib/a.js") && copy.includes("src/b.js"),
    "in the core's own repository a manifest at its root leaves no folder out of the scan; in a project its copy is left out", JSON.stringify([own, copy]));
}

done("the code scan's own logic");
