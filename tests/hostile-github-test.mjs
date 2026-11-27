// Hostile tests of one input the core names under floor rule 5 (floor/topics/input.md): what GitHub's API answers
// (releases and tags, workflow and check runs, pull requests and their merges, whose account holds a repository,
// releases.mjs's hostAccount, and an account's rights to a repository, security-review.mjs's writersOf). Each reader is tried, as its shape
// allows, with too long, the wrong type, markup, a file path, a number or date out of range and nothing at all, and
// takes nothing of it as a pass or a value: core-moved.mjs (with a stand-in git and gh), releases.mjs and release.mjs
// (in a scratch repository), wait.mjs, stalled.mjs, core-cost.mjs, clean-merges.mjs, look.mjs's checksOf and
// tools-offer.mjs's openFrom (an issue's state), and owner-settings.mjs's statesOf, readHost and shown (a repository's
// settings, its default branch's rules and its secrets' names).
// workflow-run.mjs reads no answer of GitHub's (its contexts are the caller's). Test data is made up. Run by the core's
// tests workflow (.github/workflows/tests.yml). Git and Node's own modules.
//
//   node tests/hostile-github-test.mjs
import { execFileSync, spawnSync } from "../scripts/check-runs.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "../scripts/core-address.mjs";
import { TITLE, openIssue } from "../scripts/core-moved.mjs";
import { RELEASE, elsewhere, fetchCore, hostAccount, ownerOf, releasesIn } from "../scripts/releases.mjs";
import { OWN, held } from "../scripts/release.mjs";
import { read as runnersRead } from "../scripts/runners.mjs";
import { line, measure, median, waited } from "../scripts/wait.mjs";
import { openPulls, print, stalled } from "../scripts/stalled.mjs";
import { priced, reading, readings, sessionOf } from "../scripts/core-cost.mjs";
import { isGits, proved } from "../scripts/clean-merges.mjs";
import { checksOf } from "../scripts/look.mjs";
import { writersOf } from "../scripts/security-review.mjs";
import { openFrom } from "../scripts/tools-offer.mjs";
import { SETTINGS, checklist, readHost, shown, statesOf } from "../scripts/owner-settings.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };

const BOT = "github-actions[bot]", repo = "an-owner/a-project", A = "a".repeat(40), B = "b".repeat(40);
const issueLine = (...a) => JSON.stringify(a);
const at = h => new Date(Date.UTC(2026, 10, 16, h)).toISOString();
const run = (name, status = "completed", conclusion = "success", p = `.github/workflows/${name}.yml`) => ({ name, status, conclusion, path: p });
const runs = list => ({ total_count: list.length, workflow_runs: list });
const scratch = scratchDir("hostile-github-test-");
const big = "x".repeat(4 << 20), UNREAD = "the list of the checks on it could not be read", NONE = "no check has passed on it yet", HEADS = "\trefs/heads/main\n";
const script = name => fileURLToPath(new URL(name, new URL("../scripts/", import.meta.url)));

// ---- too long ----
{
  const t0 = Date.now();
  const lines = [...Array.from({ length: 50000 }, (_, k) => issueLine(k + 1, "a-stranger", TITLE)), issueLine(1, BOT, big), issueLine(50001, BOT, TITLE)].join("\n");
  const found = openIssue(lines);
  const pass = held(runs(Array.from({ length: 50000 }, (_, k) => run(`c${k}`))));
  const cut = held({ total_count: 50001, workflow_runs: Array.from({ length: 50000 }, (_, k) => run(`c${k}`)) });
  const wait = waited(Array.from({ length: 50000 }, (_, k) => ({ started_at: at(1), completed_at: at(1 + (k % 3)), conclusion: "success" })));
  const lanes = stalled(Array.from({ length: 50000 }, (_, k) => ({ number: k, ref: big, own: k % 2 === 0, at: at(0) })), Date.parse(at(10)), 3);
  // (65536 characters: the longest description GitHub keeps, one text for every row; one row of megabytes beside them)
  const desc = `${"x".repeat(65000)}\nclaude.ai/code/session_a1`;
  const rows = readings([...Array.from({ length: 50000 }, (_, k) => [k + 1, k % 2 ? repo : "a-stranger/a-project", desc]), [50001, "a-stranger/a-project", big]], repo, 1);
  const read = reading(`Session so far: ${"9,".repeat(1 << 20)}9 answers`);
  ok(Date.now() - t0 < 5000 && found === "50001" && pass.length === 0 && cut.join() === "50001 runs stand on it and 50000 were read" && wait === 7200 && lanes.length === 25000 && lanes.every(l => l.own) && rows.length === 25000 && read === null,
    "fifty thousand issues, runs, checks, lanes and descriptions, and lines of megabytes, are read in seconds and rightly");
  let calls = 0;
  const page = Array.from({ length: 100 }, (_, k) => ({ merged_at: at(k % 20), updated_at: at(20), head: { sha: A } }));
  const t1 = Date.now(), m = measure({ repo, count: 30, gh: route => (calls++, route.includes("/pulls?") ? JSON.stringify(page) : JSON.stringify({ check_runs: [{ started_at: at(1), completed_at: at(2), conclusion: "success" }] })) });
  ok(Date.now() - t1 < 5000 && m.read === 30 && m.median === 3600 && calls <= 41, "a list of pull requests longer than asked: only the count asked is read, ten pages at most");
}

// ---- the wrong type ----
for (const v of [null, {}, [], "1", true]) {
  const what = JSON.stringify(v);
  ok(openIssue(issueLine(v, BOT, TITLE)) === null && openIssue(issueLine(1, v, TITLE)) === null && openIssue(issueLine(1, BOT, v)) === null,
    `an issue whose number, author or title is ${what} is not the one kept`);
  ok(held({ total_count: v, workflow_runs: [run("tests")] }).join() === UNREAD && held({ total_count: 1, workflow_runs: v }).length === 1,
    `a count or a list of runs that is ${what} holds the release`);
  ok(held(runs([run("tests", v, "success")])).length === 1 && held(runs([run("tests", "completed", v)])).length === 1, `a run whose status or conclusion is ${what} holds the release`);
  ok(stalled([{ number: 1, ref: "a", own: true, at: v }], Date.parse(at(10)), 3).length === 0, `a lane whose last push is ${what} is not stalled`);
  ok(waited([{ started_at: v, completed_at: at(2), conclusion: "success" }, { started_at: at(1), completed_at: v, conclusion: "success" }]) === null, `checks whose start or end is ${what} wait no time that can be read`);
  ok(!/^(?:green|red|waiting|none)$/u.test(checksOf([run("x")], { total_count: v, state: "failure" })), `a status whose count is ${what} is not read, so no check is called green or none by it`);
  ok(readings([[1, v, "Session so far: 1 answers"]], repo, 1).length === 0 && reading(v) === null, `a description from a branch that is ${what}, or that is ${what} itself, is not read`);
  ok(proved(v, v, scratch).length === 0 && proved({ head: { sha: v } }, [], scratch).length === 0, `a pull request or its commits as ${what} prove no merge`);
}
ok(held(runs([null, run("tests")])).join() === "a check: unreadable", "a run that is null holds the release");

// ---- markup ----
ok(openIssue([issueLine(1, BOT, `${TITLE}<script>`), issueLine(2, `${BOT}<b>`, TITLE), issueLine(3, BOT, `<!-- ${TITLE} -->`), issueLine(4, BOT, `${TITLE}\n`)].join("\n")) === null,
  "a title or author with markup or a line break round the right words is not the issue kept");
ok(["release-1<script>", "<b>release-1</b>", "release-1\n", "release-١"].every(n => !RELEASE.test(n)), "a tag with markup, a line break or another script's digit is no release");
ok(held(runs([run("<script>x</script>", "completed", "failure"), run("r", "completed", "failure", `${OWN}<b>`)])).join() === "<script>x</script>: failure,r: failure", "a run's name or path with markup holds the release, as text");
ok(!/[\u0000-\u001f]/.test(print([{ number: 1, ref: "a\u001b[2Jb", title: "<script>\r\nx", at: at(0), waited: 9 }], 1, 3).split("\n")[1]), "a lane's branch and title are printed with no control character");
ok(readings([[1, "a-stranger/a-project", "Session so far: 1 answers\nclaude.ai/code/session_a1"]], repo, 1).length === 0 && sessionOf("<!-- claude.ai/code/session_<script> -->") === "",
  "a fork's description is not read; a session link with markup names none");
ok(checksOf([run("x", "completed", "failure")], { total_count: 1, state: "<script>" }) === "red", "a status with markup does not turn a failed run green");

// ---- a file path ----
ok(openIssue(issueLine("../../etc/passwd", BOT, TITLE)) === null && ["release-../../etc/passwd", "/etc/passwd", "C:\\Windows", "refs/tags/release-1"].every(n => !RELEASE.test(n)),
  "a path for an issue's number or a tag's name is neither");
ok(proved({ head: { sha: "../../etc/passwd" } }, [], scratch).length === 0 && !isGits("../../etc/passwd", [A, B], scratch) && !isGits(A, ["/etc/passwd", "C:\\Windows"], scratch),
  "a path in place of a commit is never handed to git");
{
  const asked = [], rows = [issueLine(1, "t", "a", "../../etc/passwd", repo, false, "", []), issueLine(2, "t", "b", "C:\\Windows", repo, false, "", [])].join("\n");
  const got = openPulls(repo, route => (asked.push(route), route.includes("/pulls?") ? rows : at(0)));
  ok(asked.length === 1 && got.every(p => p.at === undefined), "a pull request's head given as a path is never put in a route");
}
{
  const HEAD = "a".repeat(40), asked = [], row = issueLine(3, "t", "c", HEAD, repo, false, "", []);
  for (const parent of ["../../etc/passwd", "C:\\Windows", "<script>", "a".repeat(41), "", "A".repeat(40)]) for (const count of ["2", "x", "-1", "1e9", ""]) {
    openPulls(repo, route => (asked.push(route), route.includes("/pulls?") ? row : `${at(0)} ${count} ${parent}\nm`));
  }
  ok(asked.filter(r => r.includes("/commits/")).every(r => r.endsWith(`/commits/${HEAD}`)) && asked.filter(r => r.includes("/commits/")).length === 30,
    "a commit's first parent given as a path, markup, a wrong length or no hash, or a count that is no number, is never put in a route");
  const chain = []; let lastAsked = 0;
  openPulls(repo, route => { if (route.includes("/pulls?")) return row; chain.push(route); lastAsked++; return `${at(0)} 2 ${"b".repeat(40)}\nm`; });
  ok(lastAsked === 11, "a lane's commits are read at most 11 deep, however long its merges run", `${lastAsked}`);
}
ok(readings([[1, "../../etc/passwd", "x"], [2, "/etc/passwd", "x"]], repo, 1).length === 0, "a branch's repository given as a path is not this one");
{
  const r = spawnSync(process.execPath, [script("./wait.mjs"), "--repo", "../../etc/passwd"], { cwd: scratch, encoding: "utf8", env: { ...process.env, PATH: path.join(scratch, "no-bin") } });
  ok(r.status === 1 && mended(`${r.stdout}${r.stderr}`), "wait.mjs given a path for its repository refuses it, saying its mend");
}

// ---- a number or date out of range ----
ok([Number.MAX_SAFE_INTEGER + 2, -1, 0, 5.5, 1e400].every(n => openIssue(issueLine(n, BOT, TITLE)) === null), "an issue's number past safe, negative, zero, a fraction or infinite is not the one kept");
ok(held({ total_count: Number.MAX_SAFE_INTEGER + 2, workflow_runs: [] }).join() === UNREAD && held({ total_count: -1, workflow_runs: [] }).length === 1,
  "a count of runs past safe or negative holds the release");
ok(["release-0", "release-01", "release-9999999999", "release--1", "release-1e3", "release-0x1"].every(n => !RELEASE.test(n)), "a release numbered zero, with a leading zero, past nine digits, negative or not decimal is none");
ok(waited([{ started_at: at(5), completed_at: at(1), conclusion: "success" }]) === 0, "checks that end before they start wait no negative time");
ok(stalled(["+099999-01-01T00:00:00Z", "99999-01-01T00:00:00Z", "not a date"].map((d, k) => ({ number: k, ref: "a", own: true, at: d })), Date.parse(at(10)), 3).length === 0,
  "a last push in year 99999 or at no readable time stalls no lane");
ok(["99999999999999999", "-5"].every(n => reading(`Session so far: ${n} answers, tokens in 1, cache written 1, cache read 1, out 1.`) === null), "a count past safe or negative in a cost line is not read");
ok(readings([[NaN, repo, "x"], [-1, repo, "x"], [0, repo, "x"], ["12", repo, "x"], [Number.MAX_SAFE_INTEGER + 2, repo, "x"], [1.5, repo, "x"]], repo, 1).length === 0, "a pull request numbered NaN, negative, below the oldest merge, as text, past safe or a fraction is not read");
for (const d of ["2026-13-45T99:99:99Z", "2027-02-30T00:00:00Z", "1", "5"]) {
  ok(waited([{ started_at: d, completed_at: at(2), conclusion: "success" }]) === null && stalled([{ number: 1, ref: "a", own: true, at: d }], Date.parse(at(10)), 3).length === 0,
    `a check's start or a lane's last push of ${d}, no time that can be, waits no time and stalls no lane`);
}
ok(stalled([{ number: 1, ref: "a", own: true, at: 5 }], Date.parse(at(10)), 3).length === 0, "a last push given as the number 5, never a date in 1970, stalls no lane");
ok(!/NaN/u.test(line({ median: median([waited([{ started_at: "2026-13-45T99:99:99Z", completed_at: at(2), conclusion: "success" }])].filter(t => t !== null)), read: 0 })), "a check run at an impossible time prints no \"NaN min\"");
ok(!/^(?:green|none)$/u.test(checksOf([run("x")], { total_count: "1", state: "failure" })) && !/^(?:green|none)$/u.test(checksOf([], { total_count: Number.MAX_SAFE_INTEGER + 2, state: "failure" })),
  "a status counted as text or past safe is not read, never green");

// ---- the releases, in a scratch core ----
{
  for (const name of Object.keys(process.env)) if (elsewhere.test(name)) delete process.env[name];
  Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@x.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@x.invalid", GIT_CONFIG_GLOBAL: path.join(scratch, "none"), GIT_CONFIG_NOSYSTEM: "1" });
  const src = path.join(scratch, "src"), git = (...a) => execFileSync("git", a, { cwd: src, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  fs.mkdirSync(src);
  git("init", "-q", "-b", "main");
  const commit = n => { fs.writeFileSync(path.join(src, "n"), n); git("add", "-A"); git("commit", "-q", "-m", n); return git("rev-parse", "HEAD"); };
  const c1 = commit("1"), c2 = commit("2");
  git("checkout", "-q", "-b", "side"); const side = commit("side"); git("checkout", "-q", "main");
  for (const [tag, on] of [["release-1", c1], ["release-2", c2], ["release-3", c1], ["release-4", side], ...["release-01", "release-0", "release-9999999999", "release-7a", ...(process.platform === "win32" ? [] : ["release-<b>"])].map(t => [t, c2])]) git("tag", tag, on);
  git("tag", "-a", "-m", "a tree", "release-5", `${c2}^{tree}`);
  const bare = path.join(scratch, "bare"), empty = path.join(scratch, "empty"), t0 = Date.now();
  fs.mkdirSync(bare); fs.mkdirSync(empty);
  fetchCore(bare, src);
  const got = releasesIn(bare).map(r => r.name).join();
  ok(Date.now() - t0 < 5000 && got === "release-2,release-1", "a tag on a side branch, an older commit or a tree, numbered 0, 01, past 9 digits or with markup: no release");
  git("tag", "-d", ...git("tag").split("\n"));
  fetchCore(empty, src);
  ok(releasesIn(empty).length === 0, "a core with no tag has no release");
}

// ---- core-moved.mjs whole, with a git and a gh that answer as told (shell scripts: not on Windows) ----
if (process.platform !== "win32") {
  const program = (main, issues) => {
    const dir = fs.mkdtempSync(path.join(scratch, "moved-")), bin = path.join(dir, "bin"), log = path.join(dir, "calls");
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(dir, "core-manifest.md"), `Core: ${CORE} at ${A}, copied whole under core/ (never edited here).\n\n| Slot | Here |\n| --- | --- |\n| *owner's account* | \`an-owner\` |\n| *follows* | \`main\` |\n`);
    fs.writeFileSync(path.join(dir, "main"), main);
    fs.writeFileSync(path.join(dir, "issues"), issues);
    fs.writeFileSync(path.join(bin, "git"), `#!/bin/sh\ncat "${path.join(dir, "main")}"\n`, { mode: 0o755 });
    // (the checks of main's commits, asked of the host, all passed: the newest whose did is what the project takes)
    fs.writeFileSync(path.join(dir, "green"), JSON.stringify({ total_count: 1, workflow_runs: [{ name: "tests", path: ".github/workflows/tests.yml", status: "completed", conclusion: "success" }] }));
    fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh\nprintf 'gh %s\\n' "$*" >> "${log}"\ncase "$2" in *actions/runs*) cat "${path.join(dir, "green")}"; exit 0;; esac\n[ "$1" = api ] && cat "${path.join(dir, "issues")}"\nexit 0\n`, { mode: 0o755 });
    const r = spawnSync(process.execPath, [script("./core-moved.mjs")], { cwd: dir, encoding: "utf8", env: { PATH: `${bin}:${process.env.PATH}`, GITHUB_REPOSITORY: repo, TMPDIR: dir } });
    return { status: r.status, out: `${r.stdout}${r.stderr}`, calls: fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "" };
  };
  // (the stand-in git answers every call with the file "main": the fetch, and main's history, which the newest
  // commit whose checks passed is read from; #733)
  for (const [main, what] of [["../../etc/passwd", "a path"], [A.toUpperCase(), "a commit in capitals"], [`<script>${B}`, "markup"], ["", "nothing"]]) {
    const t0 = Date.now(), r = program(main && `${main}${HEADS}`, "");
    ok(Date.now() - t0 < 5000 && r.status === 0 && /none of the last 0 commits/.test(r.out) && !/^gh (issue|api repos\/[^ ]*\/actions)/m.test(r.calls) && !["etc/passwd", "<script>"].some(w => r.calls.includes(w)) && !/\n\s+at /.test(r.out), `the core's main given as ${what}: no commit taken of it, no check asked for, nothing of it used, and no stack`, r.out + r.calls);
  }
  const hostile = [...[[Number.MAX_SAFE_INTEGER + 2, BOT, TITLE], [-1, BOT, TITLE], ["../../etc/passwd", BOT, TITLE], [7, "a-stranger", TITLE], [8, BOT, `${TITLE}<script>`], [9, BOT, TITLE, "x"]].map(a => issueLine(...a)), "not json", ""].join("\n");
  const r = program(`${B}\n`, hostile);
  ok(r.status === 0 && /^gh issue create /m.test(r.calls) && !/issue (?:edit|close)/.test(r.calls) && !["etc/passwd", "<script>"].some(w => r.calls.includes(w)), "hostile issue lines name no issue to edit or close, and nothing of them is used: a new one opens");
}

// ---- runners.mjs: whether the repository is private, as the host answers (#733) ----
{
  const none = fs.mkdtempSync(path.join(scratch, "runners-"));
  for (const [answer, what] of [[JSON.stringify({ private: "yes" }), "a text"], [JSON.stringify({ private: { a: 1 } }), "an object"], ["not json", "no JSON"], ["null", "null"], ["", "nothing"], [JSON.stringify([{ private: false }]), "a list"]]) {
    const r = runnersRead({ repo: "o/n", dir: none, gh: () => answer });
    ok(r.billed && /was not read, so taken as billed/.test(r.said[1]), `runners.mjs: a repository whose privacy the host gives as ${what} is not read, taken as billed, and said so`);
  }
  const r = runnersRead({ repo: "o/n", dir: none, gh: () => { throw new Error("HTTP 403"); } });
  ok(r.billed && r.where === "local", "runners.mjs: a host that refuses is taken as billed, nothing thrown");
}

// ---- nothing at all ----
for (const v of [undefined, null, "", [], {}]) {
  const what = JSON.stringify(v) ?? "undefined";
  ok(held(v).join() === UNREAD && !RELEASE.test(v) && reading(v) === null && sessionOf(v) === "" && proved(v, v, scratch).length === 0,
    `an answer of ${what} holds the release, and proves and reads nothing`);
}
ok(held(runs([])).join() === NONE && held(runs([run("release", "completed", "success", OWN)])).join() === NONE, "no run, or only the release's own: none passed");
ok(waited([]) === null && median([]) === null && /not read/.test(line({ median: null, read: 0 })), "no checks: no time, no median, and the line says not read");
ok(measure({ repo, gh: () => "" }).median === null && measure({ repo, gh: () => "[]" }).read === 0, "GitHub answering nothing or no pull request: nothing is read");
ok(stalled([], Date.now(), 3).length === 0 && /^No lane stalled/.test(print([], 0, 3)) && readings([], repo, 1).length === 0 && priced([]).size === 0, "no pull requests: no lane, no reading, nothing priced");
ok(checksOf([], null) === "none" && checksOf([], { total_count: 0, state: "failure" }) === "none", "no runs and no status: no checks, never green");
ok(openIssue("") === null && openIssue("\n\n") === null && openPulls(repo, () => "").length === 0, "no issue lines or pull request lines: none kept");
// whose account holds the repository, as gh answers it (#481): an answer of no form reads as nothing, never a guess
for (const answer of ["", "null", "[]", '{"login":"a b","type":"User"}', '{"login":["x"],"type":"User"}', '{"login":"x"}', '{"login":"x","type":7}', "<html>", '{"login":"x\\n::error::y","type":"User"}']) {
  const host = hostAccount({ GITHUB_REPOSITORY: repo }, () => answer);
  ok(host === null && ownerOf("# no row\n", host) === null, `the host's account answered as ${JSON.stringify(answer)} reads as nothing, and no owner is read from it`);
}
ok(ownerOf("# no row\n", { login: "x", type: "Organization" }) === null && ownerOf("# no row\n", { login: "x", type: "User\n" }) === null, "an account the host does not say a person holds gives no owner");

// an account's rights to the repository, as GitHub answers them (#412): only a person's account whose role is write,
// maintain or admin, with the permission GitHub gives that role, counts; any answer of another form makes no one an owner
const user = { login: "a-writer", type: "User", permissions: { push: true } };
ok(writersOf([{ permission: "write", role_name: "write", user }]).has("a-writer"), "a person's account with the role write is read as one the host lets write");
for (const answer of [undefined, null, "", 7, "write", [], {}, { permission: "write" }, { role_name: "write", user }, { permission: "write", role_name: ["write"], user },
  { permission: ["write"], role_name: "write", user }, { permission: "admin", role_name: "write", user }, { permission: "write", role_name: "admin", user },
  { permission: "write", role_name: "toString", user }, { permission: "write", role_name: "__proto__", user }, { permission: "WRITE", role_name: "Write", user },
  { permission: "write", role_name: "write", user: null }, { permission: "write", role_name: "write", user: { ...user, type: "Bot" } },
  { permission: "write", role_name: "write", user: { ...user, type: "Organization" } }, { permission: "write", role_name: "write", user: { ...user, login: "x[bot]" } },
  { permission: "write", role_name: "write", user: { ...user, login: "a b" } }, { permission: "write", role_name: "write", user: { ...user, login: "x".repeat(40) } },
  { permission: "write", role_name: "write", user: { ...user, login: "x\n::error::y" } }, { permission: "write", role_name: "write", user: { ...user, login: 7 } },
  { permission: "write", role_name: "write", user: { ...user, permissions: { push: "true" } } }, { permission: "write", role_name: "write", user: { ...user, permissions: { push: 1 } } },
  { permission: "write", role_name: "write", user: { ...user, permissions: null } }, { permission: "write", role_name: "write", user: { ...user, permissions: { push: false } } }]) {
  ok(writersOf([answer]).size === 0 && writersOf([[answer]]).size === 0, `rights answered as ${JSON.stringify(answer) ?? "undefined"} make no one an owner`);
}
for (const v of [undefined, null, "", 7, {}, "[]"]) ok(writersOf(v).size === 0, `a list of rights of ${JSON.stringify(v) ?? "undefined"} makes no one an owner`);

// ---- tools-offer.mjs: an issue's state ----
ok(openFrom("open\n") === true && openFrom("closed\n") === false, "tools-offer: an issue's state reads open or closed");
ok([undefined, null, "", "OPEN", "opened", "open; closed", 42, ["open"], { state: "open" }, `open${" ".repeat(40)}x`, "x".repeat(5000)].every(a => openFrom(a) === null),
  "tools-offer: nothing, the wrong type, another word and a long answer read as not answered, never as open or closed");

// ---- owner-settings.mjs: a repository's settings, its rules and its secrets' names ----
{
  const bare = scratchDir("hostile-owner-settings-");
  const none = st => Object.values(st).every(s => s.given !== true);
  const lines = st => checklist({ repo: "o/r", states: st, script: "s.mjs" }).split("\n");
  ok(shown("main") === "`main`" && shown("x".repeat(5000)).length === 102 && !/[\n\r`]/.test(shown("a`b\nc\r::error::d").slice(1, -1)),
    "owner-settings: a name is printed as text alone, at most 100 characters, with no backtick or line break of its own");
  ok([undefined, null, "", 7, {}, ["main"], true].every(v => shown(v) === null), "owner-settings: a name of the wrong type, or nothing, is no name");
  for (const host of [{ repo: { why: "x" } }, { repo: {} }, { repo: { body: null } }, { repo: { body: "repo" }, rules: { body: "rules" }, secrets: { body: [] }, actions: { body: 7 } },
    { repo: { body: { private: "false", security_and_analysis: { secret_scanning: { status: "ENABLED" }, secret_scanning_push_protection: { status: true } } } },
      rules: { body: { type: "pull_request" } }, secrets: { body: { secrets: "PERSONAL_TERMS", total_count: 1 } }, actions: { body: { sha_pinning_required: "true" } } },
    { repo: { body: { private: false } }, rules: { body: [{ type: 7 }, { type: ["deletion"] }, { type: "required_status_checks", parameters: { required_status_checks: "core / core" } },
      { type: "required_status_checks", parameters: { required_status_checks: [{ context: ["core / core"] }, { context: 7 }] } }] },
      secrets: { body: { secrets: [{ name: ["PERSONAL_TERMS"] }, { name: 7 }], total_count: "200" } }, actions: { body: { sha_pinning_required: 1 } } }]) {
    const st = statesOf(host, bare);
    ok(none(st) && Object.values(st).every(s => typeof s.said === "string" && !/undefined|\[object/.test(s.said)) && lines(st).length === SETTINGS.length + 2,
      `owner-settings: answers of ${JSON.stringify(host).slice(0, 80)} tick no setting, and print no line of their own`);
  }
  const many = { repo: { body: { private: false, default_branch: "main\n- [x] all given" } }, rules: { body: [
    ...["deletion", "non_fast_forward", "pull_request"].map(type => ({ type })),
    { type: "required_status_checks", parameters: { required_status_checks: ["core / core", ...Array.from({ length: 500 }, (_, i) => `c${i}\`\n- [x] x`)].map(context => ({ context })) } }] } };
  const st = statesOf(many, bare), rows = lines(st);
  ok(st.ruleset.given === null && /and 480 more/.test(st.ruleset.said) && st.ruleset.said.length < 3000 && rows.length === SETTINGS.length + 2 && rows.filter(l => l.startsWith("- [x]")).length === 0,
    "owner-settings: 500 checks with markup in their names are named 20 at most, each as text, and tick nothing");
  const asked = [], ask = route => { asked.push(route); return { body: { default_branch: { name: "main" } } }; };
  readHost("o/r", ask);
  ok(!asked.some(r => /rules\/branches/.test(r)), "owner-settings: a default branch of the wrong type reads no rules");
  asked.length = 0;
  readHost("o/r", route => { asked.push(route); return { body: { default_branch: "../../x?y#z" } }; });
  ok(asked.includes("repos/o/r/rules/branches/..%2F..%2Fx%3Fy%23z"), "owner-settings: a default branch's name is asked as one part of the route, never a path or a query");
  for (const total_count of ["200", 1.5, null, [9], -1]) {
    asked.length = 0;
    readHost("o/r", route => { asked.push(route); return route.includes("secrets") ? { body: { secrets: [], total_count } } : { body: { default_branch: "main" } }; });
    ok(asked.length === 4 && !asked.some(r => r.includes("PERSONAL_TERMS")), `owner-settings: a count of secrets of ${JSON.stringify(total_count)} asks nothing more`);
  }
  fs.rmSync(bare, { recursive: true, force: true });
}

process.exit(failed ? 1 : 0);
