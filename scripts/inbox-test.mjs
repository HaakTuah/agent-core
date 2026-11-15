// Tests of where the owner's inbox is (inbox.mjs): the repository origin names, GitHub's answer read as yes or no, the
// folder's items, and what is printed in each case; and, on Linux and macOS, the script itself against a stand-in for gh
// that fails as GitHub does, so that only "Not Found" moves the inbox and no other failure does. Git and Node's own
// modules; the upgrade test runs it on a project whose issues answer as switched off.
//
//   node scripts/inbox-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FOLDER, answer, items, repoOf, report } from "./inbox.mjs";

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

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "inbox-test-"));
try {
  ok(items(dir).length === 0, "no folder: no items");
  fs.mkdirSync(path.join(dir, FOLDER));
  for (const f of ["README.md", "b-task.md", "a-bug.md", "notes.txt", "odd `name`.md"]) fs.writeFileSync(path.join(dir, FOLDER, f), "State: new\nBy: owner\n");
  fs.mkdirSync(path.join(dir, FOLDER, "sub.md"));
  ok(items(dir).join() === "a-bug.md,b-task.md" && items(dir).odd === 1, "the items are its Markdown files, its README and folders left out, in order; one whose name is not plain is counted, never printed", items(dir).join());
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

ok(report({ yes: true }, [], false) === "The owner's inbox is this repository's issues.", "issues reachable, no folder: the inbox is the issues, one line");
ok(/take it out/.test(report({ yes: true }, [], true)), "an empty folder beside issues that answer is taken out");
const back = report({ yes: true }, Object.assign(["a-bug.md"], { odd: 1 }), true);
ok(/one place at a time/.test(back) && /a-bug\.md, and 1 more whose name is not plain/.test(back) && /as an issue/.test(back) && /another account added moves over as data/.test(back) && /take `inbox\/` out/.test(back), "issues reachable again, items in the folder: each moved over and the folder taken out, in one pull request", back);
const off = report({ yes: false, why: "its issues are switched off" }, [], false);
ok(/switched off/.test(off) && /State: <new, needs-owner, queued, later, on-hold>/.test(off) && /By: </.test(off) && /ISSUE_TEMPLATE/.test(off) && /name it to the owner once/.test(off) && /nothing waits on it/.test(off),
  "issues not reachable, no folder: the folder is made as said, its item format given, and the owner's setting named once", off);
const kept = report({ yes: false, why: "its issues are switched off" }, ["a.md"], true);
ok(/is the folder `inbox\/` \(1 item/.test(kept) && !/name it to the owner/.test(kept), "the folder standing: it is the inbox, and the owner is not named again", kept);
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
`, { mode: 0o755 }); const r = spawnSync(process.execPath, [new URL("./inbox.mjs", import.meta.url).pathname], { cwd: repo, env, encoding: "utf8" }); return { status: r.status, out: `${r.stdout}${r.stderr}` }; };
    let r = run("echo 'gh: Not Found (HTTP 404)' >&2; exit 1");
    ok(r.status === 0 && /^Issues cannot be read and written here \(GitHub finds no repository someone\/a-game/.test(r.out), "GitHub's Not Found is an answer: the repository cannot be reached for this account, so the folder", r.out);
    for (const [how, said] of [["echo 'gh: API rate limit exceeded (HTTP 403)' >&2; exit 1", "a rate limit"], ["echo 'gh: Bad Gateway (HTTP 502)' >&2; exit 1", "a fault of GitHub's"], ["echo 'error connecting to api.github.com' >&2; exit 1", "no network"], ["echo '{\"has_issues\": true}'", "an answer for no account"]]) {
      r = run(how);
      ok(r.status === 0 && /could not be asked here[\s\S]*nothing moves/.test(r.out), `${said}: nothing is asked, nothing moves, nothing fails`, r.out);
    }
    r = run(`echo '{"has_issues": false, "permissions": {"push": true}}'`);
    ok(r.status === 0 && /\(its issues are switched off\)/.test(r.out), "an answer with issues switched off: the folder", r.out);
  } finally { fs.rmSync(at, { recursive: true, force: true }); }
}

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
