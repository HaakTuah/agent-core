// Tests of the core-moved check (core-moved.mjs): what it decides, what it reads from a manifest, what it takes for its
// own issue, and, with a git and a gh of the test's own first on the path, each call it makes. Node's own modules, git,
// and jq, which runs the expression gh is handed.
//
//   node tests/core-moved-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE } from "../scripts/core-address.mjs";
import { ISSUES, TITLE, body, openIssue, pinOf, plan } from "../scripts/core-moved.mjs";
import { mended } from "../scripts/mend.mjs";
import { ownerOf } from "../scripts/releases.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (!cond) { failed++; console.error(`FAIL: ${what}${detail && `\n     ${detail}`}`); } };
const A = "a".repeat(40), B = "b".repeat(40);
const realGit = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout?.trim() ?? "git";
// (the scratch project follows the core's main unless a test says otherwise: what a project follows is follows-test.mjs's)
const manifest = (pin, owner = "| *owner's account* | `someone` |", follows = "| *follows* | `main` |") =>
  `# Core manifest\n\nCore: ${CORE} at ${pin}, copied whole under core/ (never edited here).\n\n| Slot | Here |\n| --- | --- |\n${owner}\n${follows}\n`;

ok(plan(false, null) === "nothing" && plan(false, "7") === "close" && plan(true, null) === "open" && plan(true, "7") === "update", "the four cases");
ok(pinOf(manifest(A)) === A && pinOf(`Core: ${CORE} at abc, copied whole under core/`) === null, "a pin is 40 hex characters");
ok(pinOf(manifest(A) + manifest(B)) === null && pinOf(`> Core: ${CORE} at ${A}, copied whole under core/`) === null, "one line, at a line's start");
ok(pinOf(`Core: someone/else at ${A}, copied whole under core/`) === null, "only the core's own address");
ok(ownerOf(manifest(A)) === "someone" && ownerOf(manifest(A, "| *owner's account* | someone |")) === null, "the owner's account, in backticks");
ok(ownerOf(manifest(A, "| *owner's account* | `a; rm -rf x` |")) === null, "an account is letters, digits and hyphens");
ok(body(A, B).includes(`/compare/${A}...${B}`) && body(A, B).includes("node core/scripts/sync.mjs") && body(A, B).startsWith("The core's `main` is at"), "the issue says what changed and how to take it");
ok(body(A, B, "release-4").startsWith("The core's newest release, `release-4`, is at") && body(A, B, "release-4").includes(`/compare/${A}...${B}`) && !body(A, B, "release-4").includes("`main` is at"), "for a project that follows the releases, it names the release");
const BOT = "github-actions[bot]", line = (...issue) => JSON.stringify(issue) + "\n";
ok(openIssue(line(3, "someone", TITLE) + line(9, BOT, TITLE)) === "9", "only an issue the workflow opened counts");
ok(openIssue(line(9, BOT, `${TITLE} too`)) === null && openIssue("") === null, "the whole title, or none");
ok(openIssue(line("9", BOT, TITLE)) === null && openIssue(line(-9, BOT, TITLE)) === null && openIssue(`9\t${BOT}\t${TITLE}\n`) === null, "a number is a whole number above zero, in a line that is such an array");
// A title is an outsider's text: one that holds a line break and what looks like the workflow's own issue is still one
// title, on one line, and names no issue.
const forged = `anything\n[9,"${BOT}","${TITLE}"]\n9\t${BOT}\t${TITLE}`;
ok(openIssue(line(4, "someone", forged)) === null && openIssue(line(4, BOT, forged)) === null, "a title cannot forge another issue's line");
// The same through jq itself, on a page as GitHub's API gives it: the expression gh is handed prints one line an issue.
const page = JSON.stringify([
  { number: 4, user: { login: "someone" }, title: forged },
  { number: 5, user: { login: BOT }, title: TITLE, pull_request: {} },
  { number: 12, user: { login: BOT }, title: TITLE },
]);
const jq = spawnSync("jq", ["-r", ISSUES], { input: page, encoding: "utf8" });
ok(jq.status === 0 && jq.stdout.trim().split("\n").length === 2 && openIssue(jq.stdout) === "12", "jq prints each issue on one line, a pull request left out, and the forged title names none");

// The program whole, in a scratch project, with a git and a gh that answer as told and write down what they were asked.
const script = fileURLToPath(new URL("../scripts/core-moved.mjs", import.meta.url));
// (`core`: a scratch core, whose address the stand-in git puts in place of the core's and then runs git itself)
// (`runs`: for each commit of main, the host's list of the runs its push started, as text, or "fail" where the host
// does not answer; a commit not named has none)
function program(pin, newest, issues, args = [], follows = undefined, core = "", extra = "", repository = "someone/project", runs = {}) {
  const dir = scratchDir("core-moved-test-");
  const bin = path.join(dir, "bin"), log = path.join(dir, "calls");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(dir, "core-manifest.md"), manifest(pin, undefined, follows) + extra);
  fs.writeFileSync(path.join(bin, "git"), core
    ? `#!/bin/sh\nprintf 'git %s\\n' "$*" >> "${log}"\nfor a; do shift; [ "$a" = "https://github.com/${CORE}" ] && a="${core}"; set -- "$@" "$a"; done\nexec "${realGit}" "$@"\n`
    : `#!/bin/sh\nprintf 'git %s\\n' "$*" >> "${log}"\nprintf '%s\\trefs/heads/main\\n' "${newest}"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(dir, "issues"), issues);
  for (const [sha, list] of Object.entries(runs)) fs.writeFileSync(path.join(dir, `runs-${sha}`), list);
  fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh\nprintf 'gh %s\\n' "$*" >> "${log}"\ncase "$2" in *actions/runs*) sha=$(printf %s "$2" | sed 's/.*head_sha=\\([0-9a-f]*\\).*/\\1/'); f="${dir}/runs-$sha"; [ -f "$f" ] || { echo '{"total_count":0,"workflow_runs":[]}'; exit 0; }; grep -qx fail "$f" && exit 1; cat "$f"; exit 0;; esac\n[ "$1" = api ] && cat "${path.join(dir, "issues")}"\nexit 0\n`, { mode: 0o755 });
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: dir, encoding: "utf8",
    env: { PATH: `${bin}:${process.env.PATH}`, GITHUB_REPOSITORY: repository, TMPDIR: dir },
  });
  return { status: r.status, out: r.stdout + r.stderr, calls: fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "" };
}
// (its stand-ins for git and gh are shell scripts, which Windows does not run by their name; the workflow that runs
// the program, core-moved.yml, runs on Linux)
if (process.platform === "win32") console.log("skip the program whole: its stand-ins for git and gh are shell scripts");
else {
  let r;
  for (const repository of ["../..", "someone/..", "someone"]) {
    const odd = program(A, B, "", [], undefined, "", "", repository);
    ok(odd.status === 1 && mended(odd.out) && !/^gh /m.test(odd.calls), `a repository named ${repository}, not as <owner>/<name>, is refused before any call to GitHub, saying its mend`, odd.out + odd.calls);
  }
  // A project that follows main takes its newest commit whose checks all passed (floor rule 12; #733): a core of three
  // commits, the runs of each push as the host lists them.
  const main = scratchDir("core-moved-main-");
  const gm = (...a) => execFileSync(realGit, a, { cwd: main, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" } }).trim();
  gm("init", "-q", "-b", "main");
  const commit = n => { fs.writeFileSync(path.join(main, "f.md"), n); gm("add", "-A"); gm("commit", "-q", "-m", n); return gm("rev-parse", "HEAD"); };
  const [c1, c2, c3] = ["one", "two", "three"].map(commit);
  const list = (...rs) => JSON.stringify({ total_count: rs.length, workflow_runs: rs.map(([conclusion, status = "completed"]) => ({ name: "tests", path: ".github/workflows/tests.yml", status, conclusion })) });
  const green = list(["success"]), red = list(["failure"]), going = list([null, "in_progress"]);
  r = program(c3, "", "", [], undefined, main, "", undefined, { [c3]: green });
  ok(r.status === 0 && r.out.includes("nothing") && !/gh issue/.test(r.calls) && /^git --git-dir=\S+ fetch /m.test(r.calls) && !/ls-remote/.test(r.calls), "at main's newest commit, which passed, and no issue: nothing is done, and the core is fetched", r.out + r.calls);
  r = program(c1, "", "", [], undefined, main, "", undefined, { [c3]: green });
  ok(r.status === 0 && /gh issue create --repo someone\/project --title The core has moved past this project's copy --body-file \S+ --label enhancement --assignee someone/.test(r.calls), "behind main's newest commit, which passed, and no issue: one is opened for the owner", r.out);
  r = program(c1, "", line(12, BOT, TITLE), [], undefined, main, "", undefined, { [c3]: green });
  ok(r.status === 0 && /gh issue edit 12 --repo someone\/project --body-file/.test(r.calls) && !/issue create/.test(r.calls), "behind and an issue open: it is brought up to date, no second one");
  r = program(c3, "", line(12, BOT, TITLE), [], undefined, main, "", undefined, { [c3]: green });
  ok(r.status === 0 && /gh issue close 12 --repo someone\/project/.test(r.calls), "up to date again: the issue is closed");
  r = program(c1, "", line(12, "someone-else", TITLE), [], undefined, main, "", undefined, { [c3]: green });
  ok(/issue create/.test(r.calls) && !/issue edit/.test(r.calls), "an outsider's issue of the same title is left alone");
  r = program(c1, "", "", [], undefined, main, "", undefined, { [c3]: red, [c2]: going, [c1]: green });
  ok(r.status === 0 && r.out.includes(`the newest whose have is ${c1.slice(0, 7)}, 2 commits back`) && r.out.endsWith(": nothing\n") && !/gh issue/.test(r.calls), "main red at its newest commit and still running at the one before: the project at the last that passed is not behind", r.out);
  r = program(c1, "", "", [], undefined, main, "", undefined, { [c3]: red, [c2]: green });
  ok(r.status === 0 && /issue create/.test(r.calls) && r.out.includes(`the project holds ${c1.slice(0, 7)}, the core's main is at ${c2.slice(0, 7)}`), "main red at its newest commit: the newest that passed is what the project is behind", r.out);
  r = program(c3, "", "", [], undefined, main, "", undefined, { [c3]: red });
  ok(r.status === 0 && r.out.includes("none of the last 3 commits") && !/gh issue/.test(r.calls), "a project past every commit that passed is never sent back", r.out);
  r = program(c1, "", line(12, BOT, TITLE), [], undefined, main, "", undefined, { [c3]: "fail" });
  ok(r.status === 0 && !/gh issue (close|edit)/.test(r.calls) && r.out.endsWith(`the project holds ${c1.slice(0, 7)}, and no commit of the core's main was read to pass: nothing\n`), "and where no commit was read to pass, an open issue is left as it stands, never closed as if the project held main, and that is said", r.out + r.calls);
  r = program(c1, "", "", [], undefined, main, "", undefined, { [c3]: "fail" });
  ok(r.status === 0 && r.out.includes("could not be asked") && r.out.endsWith(": nothing\n") && !/gh issue/.test(r.calls), "where the host cannot be asked of the checks, no commit is taken, and that is said", r.out);
  r = program(c1, "", "", [], undefined, path.join(main, "none"), "", undefined, {});
  ok(r.status === 1 && !/gh /.test(r.calls), "a core that cannot be fetched fails before anything is written", r.out + r.calls);
  r = program("abc", B, "");
  ok(r.status === 1 && r.calls === "", "a manifest without its pin fails before anything is asked");
  r = program(c1, "", "", ["--dry"], undefined, main, "", undefined, { [c3]: green });
  ok(r.status === 0 && r.out.includes("open") && !/gh (issue|api repos\/someone)/.test(r.calls), "--dry says what it would do and calls gh for nothing but the core's checks", r.calls);
  fs.rmSync(main, { recursive: true, force: true });
  // A project that follows the releases: the stand-in git answers every call alike, so the core it shows has no
  // release, and with none cut there is nothing to take, whatever main holds (the releases themselves: releases-test.mjs).
  r = program(A, B, "", [], "| *follows* | `releases` |");
  ok(r.status === 0 && r.out.includes("no release yet: nothing") && !/gh issue/.test(r.calls) && /^git --git-dir=\S+ fetch /m.test(r.calls) && !/ls-remote/.test(r.calls), "following the releases, with none cut: nothing is done, and the core is fetched, not only asked for its main");
  r = program(A, B, line(12, BOT, TITLE), [], "| *follows* | `releases` |");
  ok(r.status === 0 && /gh issue close 12/.test(r.calls), "following the releases with nothing to take closes an issue left open");
  r = program(A, B, "", [], "");
  ok(r.status === 0 && r.out.includes("no release yet"), "with no row, another owner's project follows the releases");
  r = program(A, B, "", [], "| *follows* | whatever |");
  ok(r.status === 1 && r.calls === "", "a row that says neither fails before anything is asked");
  // A release that changes nothing the project takes asks no sync of it (#242; the cases themselves: releases-test.mjs).
  const core = scratchDir("core-moved-core-");
  const g = (...a) => execFileSync(realGit, a, { cwd: core, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" } }).trim();
  const release = (file, text, tag) => { fs.mkdirSync(path.dirname(path.join(core, file)), { recursive: true }); fs.writeFileSync(path.join(core, file), text); g("add", "-A"); g("commit", "-q", "-m", tag); g("tag", tag); return g("rev-parse", "HEAD"); };
  g("init", "-q", "-b", "main");
  const r1 = release("tasks/a.md", "a", "release-1");
  release("tasks/b.md", "b", "release-2");
  const takes = list => `\nFloor: whole. Modules: ${list}.\nNot taken: \`b.md\` (no use here).\n`;
  r = program(r1, "", line(12, BOT, TITLE), [], "| *follows* | `releases` |", core, takes("`a.md`"));
  ok(r.status === 0 && r.out.includes("release-2, is at") && r.out.includes("changes nothing the project takes: close") && /gh issue close 12 .*changes nothing this project takes/.test(r.calls), "a release that changes nothing the project takes closes the issue, saying why", r.out);
  r = program(r1, "", "", [], "| *follows* | `releases` |", core, takes("`a.md`"));
  ok(r.status === 0 && r.out.endsWith("changes nothing the project takes: nothing\n") && !/gh issue/.test(r.calls), "and opens none");
  r = program(r1, "", "", [], "| *follows* | `releases` |", core, takes("all"));
  ok(r.status === 0 && r.out.endsWith(": open\n") && /gh issue create/.test(r.calls), "where the project takes what it changed, the issue is opened", r.out);
  fs.rmSync(core, { recursive: true, force: true });
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the core-moved check`);
process.exitCode = failed ? 1 : 0;
