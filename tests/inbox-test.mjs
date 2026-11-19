// Tests of where the owner's inbox is (inbox.mjs): the repository origin names, GitHub's answer read as yes or no, the
// folder's items, and what is printed in each case; and, on Linux and macOS, the script itself against a stand-in for gh
// that fails as GitHub does, so that only "Not Found" moves the inbox and no other failure does. Git and Node's own
// modules; the upgrade test runs it on a project whose issues answer as switched off.
//
//   node tests/inbox-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FOLDER, answer, asked, items, repoOf, report, tried } from "../scripts/inbox.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

ok(repoOf("https://github.com/someone/a-game") === "someone/a-game" && repoOf("https://x-token@github.com/someone/a-game.git\n") === "someone/a-game"
  && repoOf("git@github.com:someone/a.game.git") === "someone/a.game" && repoOf("ssh://git@github.com/someone/x/") === "someone/x",
"origin's address on github.com names the repository, in each form git writes it");
ok([null, "", "https://gitlab.com/someone/x", "/tmp/x.git", "https://github.com.evil.example/someone/x", "https://github.com/someone", "https://github.com/../user", "https://github.com/someone/.."].every(u => repoOf(u) === null),
  "another host, a path, a look-alike host, an address with no repository or a part that is only dots names none");

const on = { has_issues: true, permissions: { pull: true, triage: true } };
ok(answer(on).yes && answer({ ...on, permissions: { push: true } }).yes, "issues on and the right to triage or more: yes");
ok(!answer({ ...on, has_issues: false }).yes && /switched off/.test(answer({ ...on, has_issues: false }).why), "issues switched off: no, saying so");
ok(!answer({ has_issues: true, permissions: { pull: true } }).yes && /may not write/.test(answer({ has_issues: true, permissions: { pull: true } }).why), "no right to write them: no");
ok(!answer(null).yes && !answer("x").yes, "no answer: no");
ok(["false", "true", 1, {}].every((right) => !answer({ has_issues: true, permissions: { admin: right, maintain: right, push: right, triage: right } }).yes), "a right given as anything but a real true: no");

// an app's token (GitHub's job's own), whose `permissions` read no write whatever the job grants (#338): asked again
const app = { has_issues: true, permissions: { admin: false, maintain: false, push: false, triage: false, pull: false } };
const posts = (...said) => { const sent = []; const post = route => { sent.push(route); return said[sent.length - 1]; }; return { sent, post }; };
const valid = { status: 1, err: 'gh: Invalid request.\n\n"name" wasn\'t supplied. (HTTP 422)' };
const barred = { status: 1, err: "gh: Resource not accessible by integration (HTTP 403)" };
let p = posts(valid, valid);
ok(asked("o/n", app, p.post).yes && p.sent.join() === "repos/o/n/labels,repos/o/n/issues", "an app's token that GitHub takes a write from: yes, asked of a label and an issue", p.sent);
p = posts(barred);
ok(/may not write/.test(asked("o/n", app, p.post)?.why) && /issues: write/.test(asked("o/n", app, posts(barred).post).why) && p.sent.length === 1, "a token GitHub refuses: no, saying what grants it, and nothing more is asked");
ok(asked("o/n", app, posts(valid, barred).post)?.yes === false, "a label but no issue (pull requests' right alone): no");
ok(asked("o/n", app, posts(valid, { status: 1, err: "gh: Not Found (HTTP 404)" }).post)?.yes === false, "GitHub's Not Found to a write: no");
for (const [said, what] of [[{ status: 1, err: "gh: API rate limit exceeded for installation (HTTP 403)" }, "a rate limit"], [{ status: 1, err: "gh: You have exceeded a secondary rate limit (HTTP 403)" }, "a secondary rate limit"], [{ status: 1, err: "gh: Bad Gateway (HTTP 502)" }, "a fault of GitHub's"], [{ status: null, err: "" }, "no gh"], [undefined, "nothing at all"]])
  ok(asked("o/n", app, posts(said).post) === null, `${what} to a write: no answer, so nothing moves`);
p = posts(valid, valid);
ok(asked("o/n", on, p.post).yes && asked("o/n", { ...app, has_issues: false }, p.post).why.includes("switched off") && !p.sent.length, "a role that may write, or issues switched off: nothing more is asked");
ok(tried(0) === "yes" && tried(1, "HTTP 422") === "yes" && tried(1, "HTTP 404") === "no" && tried(1, "HTTP 401") === null && tried(1, "HTTP 4031") === null, "what gh made of a write read exactly");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "inbox-test-"));
try {
  ok(items(dir).length === 0, "no folder: no items");
  fs.mkdirSync(path.join(dir, FOLDER));
  for (const f of ["README.md", "b-task.md", "a-bug.md", "notes.txt", "odd `name`.md"]) fs.writeFileSync(path.join(dir, FOLDER, f), "State: queued\nBy: owner\n");
  fs.mkdirSync(path.join(dir, FOLDER, "sub.md"));
  ok(items(dir).join() === "a-bug.md,b-task.md" && items(dir).odd === 1, "the items are its Markdown files, its README and folders left out, in order; one whose name is not plain is counted, never printed", items(dir).join());
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

ok(report({ yes: true }, [], false) === "The owner's inbox is this repository's issues.", "issues reachable, no folder: the inbox is the issues, one line");
ok(/take it out/.test(report({ yes: true }, [], true)), "an empty folder beside issues that answer is taken out");
const oddOnly = report({ yes: true }, Object.assign([], { odd: 1 }), true);
ok(/one place at a time/.test(oddOnly) && /\(1 whose name is not plain\)/.test(oddOnly) && !/take it out/.test(oddOnly), "a folder holding only items whose name is not plain moves them over, never reads as empty", oddOnly);
const back = report({ yes: true }, Object.assign(["a-bug.md"], { odd: 1 }), true);
ok(/one place at a time/.test(back) && /a-bug\.md, 1 more whose name is not plain/.test(back) && /as an issue/.test(back) && /another account added moves over as data/.test(back) && /take `inbox\/` out/.test(back), "issues reachable again, items in the folder: each moved over and the folder taken out, in one pull request", back);
const off = report({ yes: false, why: "its issues are switched off" }, [], false);
ok(/switched off/.test(off) && /State: <queued, needs-owner, later, on-hold>/.test(off) && /By: </.test(off) && /ISSUE_TEMPLATE/.test(off) && /name it to the owner once/.test(off) && /nothing waits on it/.test(off),
  "issues not reachable, no folder: the folder is made as said, its item format given, and the owner's setting named once", off);
const kept = report({ yes: false, why: "its issues are switched off" }, ["a.md"], true);
ok(/is the folder `inbox\/` \(1 item/.test(kept) && !/name it to the owner/.test(kept), "the folder standing: it is the inbox, and the owner is not named again", kept);
ok(/the 2 item\(s\) of `inbox\/` move over/.test(report(null, Object.assign(["a.md"], { odd: 1 }), true)), "nothing asked: the count of items takes in those whose name is not plain");
ok(/could not be asked here/.test(report(null, [], false)) && /nothing moves/.test(report(null, [], false)) && /own GitHub tools/.test(report(null, [], false)), "nothing asked: nothing moves, and it says what to ask with the session's own tools");

ok(/\(1 item\(s\), and 1 whose name is not plain: rename each/.test(report({ yes: false, why: "x" }, Object.assign(["a.md"], { odd: 1 }), true)), "the folder standing, a name that is not plain is counted and its mend said");

// the script itself, gh failing as GitHub does (a stand-in that is a shell script: not on Windows)
if (process.platform !== "win32") {
  const at = fs.mkdtempSync(path.join(os.tmpdir(), "inbox-run-")), bin = path.join(at, "bin"), repo = path.join(at, "repo");
  try {
    fs.mkdirSync(bin); fs.mkdirSync(repo);
    const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, GIT_CONFIG_GLOBAL: path.join(at, "none"), GIT_CONFIG_NOSYSTEM: "1" };
    spawnSync("git", ["init", "-q"], { cwd: repo, env });
    spawnSync("git", ["remote", "add", "origin", "https://github.com/someone/a-game"], { cwd: repo, env });
    const run = gh => { fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh
${gh}
`, { mode: 0o755 }); const r = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/inbox.mjs", import.meta.url))], { cwd: repo, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
    let r = run("echo 'gh: Not Found (HTTP 404)' >&2; exit 1");
    ok(r.status === 0 && /^Issues cannot be read and written here \(GitHub finds no repository someone\/a-game/.test(r.out), "GitHub's Not Found is an answer: the repository cannot be reached for this account, so the folder", r.out);
    for (const [how, said] of [["echo 'gh: API rate limit exceeded (HTTP 403)' >&2; exit 1", "a rate limit"], ["echo 'gh: Bad Gateway (HTTP 502)' >&2; exit 1", "a fault of GitHub's"], ["echo 'error connecting to api.github.com' >&2; exit 1", "no network"], ["echo '{\"has_issues\": true}'", "an answer for no account"]]) {
      r = run(how);
      ok(r.status === 0 && /could not be asked here[\s\S]*nothing moves/.test(r.out), `${said}: nothing is asked, nothing moves, nothing fails`, r.out);
    }
    // an app's token: the role reads no write, and the writes of an empty body answer for it
    const role = `if [ "$2" = "-X" ]; then cat >/dev/null; echo "$WRITE" >&2; exit 1; fi; echo '{"has_issues": true, "permissions": {"pull": false}}'`;
    r = run(`WRITE='gh: Validation Failed (HTTP 422)'; ${role}`);
    ok(r.status === 0 && /^The owner's inbox is this repository's issues\./.test(r.out), "a GitHub job's token that may write issues: the inbox is its issues", r.out);
    r = run(`WRITE='gh: Resource not accessible by integration (HTTP 403)'; ${role}`);
    ok(r.status === 0 && /^Issues cannot be read and written here \(the account signed in here may not write its issues \(a GitHub job's token may where its workflow's `permissions:` grants `issues: write`\)\)/.test(r.out), "a token GitHub refuses a write: the folder, and what grants the right", r.out);
    r = run(`WRITE='gh: Bad Gateway (HTTP 502)'; ${role}`);
    ok(r.status === 0 && /could not be asked here[\s\S]*nothing moves/.test(r.out), "a fault of GitHub's to the write: nothing moves", r.out);
    r = run(`echo '{"has_issues": false, "permissions": {"push": true}}'`);
    ok(r.status === 0 && /\(its issues are switched off\)/.test(r.out), "an answer with issues switched off: the folder", r.out);
  } finally { fs.rmSync(at, { recursive: true, force: true }); }
}

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
