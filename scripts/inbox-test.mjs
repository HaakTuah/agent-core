// Tests of where the owner's inbox is (inbox.mjs): the repository origin names, GitHub's answer read as yes or no, the
// folder's items, and what is printed in each case. Node's own modules only; the calls to git and gh are the program's
// own and are made only by the upgrade test, on a project whose issues answer as switched off.
//
//   node scripts/inbox-test.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FOLDER, answer, items, repoOf, report } from "./inbox.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

ok(repoOf("https://github.com/someone/a-game") === "someone/a-game" && repoOf("https://x-token@github.com/someone/a-game.git\n") === "someone/a-game"
  && repoOf("git@github.com:someone/a.game.git") === "someone/a.game" && repoOf("ssh://git@github.com/someone/x/") === "someone/x",
"origin's address on github.com names the repository, in each form git writes it");
ok([null, "", "https://gitlab.com/someone/x", "/tmp/x.git", "https://github.com.evil.example/someone/x", "https://github.com/someone"].every(u => repoOf(u) === null),
  "another host, a path, a look-alike host or an address with no repository names none");

const on = { has_issues: true, permissions: { pull: true, triage: true } };
ok(answer(on).yes && answer({ ...on, permissions: { push: true } }).yes, "issues on and the right to triage or more: yes");
ok(!answer({ ...on, has_issues: false }).yes && /switched off/.test(answer({ ...on, has_issues: false }).why), "issues switched off: no, saying so");
ok(!answer({ has_issues: true, permissions: { pull: true } }).yes && /may not write/.test(answer({ has_issues: true, permissions: { pull: true } }).why), "no right to write them: no");
ok(!answer(null).yes && !answer("x").yes, "no answer: no");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "inbox-test-"));
try {
  ok(items(dir).length === 0, "no folder: no items");
  fs.mkdirSync(path.join(dir, FOLDER));
  for (const f of ["README.md", "b-task.md", "a-bug.md", "notes.txt"]) fs.writeFileSync(path.join(dir, FOLDER, f), "State: new\nBy: owner\n");
  fs.mkdirSync(path.join(dir, FOLDER, "sub.md"));
  ok(items(dir).join() === "a-bug.md,b-task.md", "the items are its Markdown files, its README and folders left out, in order", items(dir).join());
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

ok(report({ yes: true }, [], false) === "The owner's inbox is this repository's issues.", "issues reachable, no folder: the inbox is the issues, one line");
ok(/take it out/.test(report({ yes: true }, [], true)), "an empty folder beside issues that answer is taken out");
const back = report({ yes: true }, ["a-bug.md"], true);
ok(/one place at a time/.test(back) && /a-bug\.md/.test(back) && /as an issue/.test(back) && /take `inbox\/` out/.test(back), "issues reachable again, items in the folder: each moved over and the folder taken out, in one pull request", back);
const off = report({ yes: false, why: "its issues are switched off" }, [], false);
ok(/switched off/.test(off) && /State: <new, needs-owner, queued, later, on-hold>/.test(off) && /By: </.test(off) && /ISSUE_TEMPLATE/.test(off) && /name it to the owner once/.test(off) && /nothing waits on it/.test(off),
  "issues not reachable, no folder: the folder is made as said, its item format given, and the owner's setting named once", off);
const kept = report({ yes: false, why: "its issues are switched off" }, ["a.md"], true);
ok(/is the folder `inbox\/` \(1 item/.test(kept) && !/name it to the owner/.test(kept), "the folder standing: it is the inbox, and the owner is not named again", kept);
ok(/could not be asked here/.test(report(null, [], false)) && /own GitHub tools/.test(report(null, [], false)), "nothing asked: what to ask with the session's own tools");

console.log(`\n${count - failed} of ${count} passed`);
if (failed) process.exit(1);
