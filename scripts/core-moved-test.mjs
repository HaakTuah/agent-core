// Tests of the core-moved check (core-moved.mjs): what it decides, what it reads from a manifest, what it takes for its
// own issue, and, with a git and a gh of the test's own first on the path, each call it makes. Node's own modules, git,
// and jq, which runs the expression gh is handed.
//
//   node scripts/core-moved-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE, CORE_SOURCE } from "./core-address.mjs";
import { ISSUES, TITLE, body, openIssue, pinOf, plan } from "./core-moved.mjs";
import { ownerOf } from "./releases.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (!cond) { failed++; console.error(`FAIL: ${what}${detail && `\n     ${detail}`}`); } };
const A = "a".repeat(40), B = "b".repeat(40);
const realGit = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout?.trim() ?? "git";
// (the scratch project follows the core's main unless a test says otherwise: what a project follows is releases-test.mjs's)
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
const script = fileURLToPath(new URL("./core-moved.mjs", import.meta.url));
// (`core`: a scratch core, whose address the stand-in git puts in place of the core's and then runs git itself)
function program(pin, newest, issues, args = [], follows = undefined, core = "", extra = "") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "core-moved-test-"));
  const bin = path.join(dir, "bin"), log = path.join(dir, "calls");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(dir, "core-manifest.md"), manifest(pin, undefined, follows) + extra);
  fs.writeFileSync(path.join(bin, "git"), core
    ? `#!/bin/sh\nprintf 'git %s\\n' "$*" >> "${log}"\nfor a; do shift; [ "$a" = "https://github.com/${CORE}" ] && a="${core}"; set -- "$@" "$a"; done\nexec "${realGit}" "$@"\n`
    : `#!/bin/sh\nprintf 'git %s\\n' "$*" >> "${log}"\nprintf '%s\\trefs/heads/main\\n' "${newest}"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(dir, "issues"), issues);
  fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh\nprintf 'gh %s\\n' "$*" >> "${log}"\n[ "$1" = api ] && cat "${path.join(dir, "issues")}"\nexit 0\n`, { mode: 0o755 });
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: dir, encoding: "utf8",
    env: { PATH: `${bin}:${process.env.PATH}`, GITHUB_REPOSITORY: "someone/project", TMPDIR: dir },
  });
  return { status: r.status, out: r.stdout + r.stderr, calls: fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "" };
}
// (its stand-ins for git and gh are shell scripts, which Windows does not run by their name; the workflow that runs
// the program, core-moved.yml, runs on Linux)
if (process.platform === "win32") console.log("skip the program whole: its stand-ins for git and gh are shell scripts");
else {
  let r = program(A, A, "");
  ok(r.status === 0 && r.out.includes("nothing") && !/gh issue/.test(r.calls), "up to date and no issue: nothing is done");
  ok(new RegExp(`^git ls-remote https://github\\.com/${CORE_SOURCE} refs/heads/main$`, "m").test(r.calls), "the core's main is asked for, and nothing else of git");
  r = program(A, B, "");
  ok(r.status === 0 && /gh issue create --repo someone\/project --title The core has moved past this project's copy --body-file \S+ --label enhancement --assignee someone/.test(r.calls), "behind and no issue: one is opened for the owner");
  r = program(A, B, line(12, BOT, TITLE));
  ok(r.status === 0 && /gh issue edit 12 --repo someone\/project --body-file/.test(r.calls) && !/issue create/.test(r.calls), "behind and an issue open: it is brought up to date, no second one");
  r = program(A, A, line(12, BOT, TITLE));
  ok(r.status === 0 && /gh issue close 12 --repo someone\/project/.test(r.calls), "up to date again: the issue is closed");
  r = program(A, B, line(12, "someone-else", TITLE));
  ok(/issue create/.test(r.calls) && !/issue edit/.test(r.calls), "an outsider's issue of the same title is left alone");
  r = program(A, "not-a-commit", "");
  ok(r.status === 1 && !/gh /.test(r.calls), "a main that gives no commit fails before anything is written");
  r = program("abc", B, "");
  ok(r.status === 1 && r.calls === "", "a manifest without its pin fails before anything is asked");
  r = program(A, B, "", ["--dry"]);
  ok(r.status === 0 && r.out.includes("open") && !/gh /.test(r.calls), "--dry says what it would do and calls gh for nothing");
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
  const core = fs.mkdtempSync(path.join(os.tmpdir(), "core-moved-core-"));
  const g = (...a) => execFileSync(realGit, a, { cwd: core, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" } }).trim();
  const release = (file, text, tag) => { fs.mkdirSync(path.dirname(path.join(core, file)), { recursive: true }); fs.writeFileSync(path.join(core, file), text); g("add", "-A"); g("commit", "-q", "-m", tag); g("tag", tag); return g("rev-parse", "HEAD"); };
  g("init", "-q", "-b", "main");
  const r1 = release("modules/a.md", "a", "release-1");
  release("modules/b.md", "b", "release-2");
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
