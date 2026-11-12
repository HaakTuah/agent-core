// Tests of the core-moved check (core-moved.mjs): what it decides, what it reads from a manifest, and, with a git and
// a gh of the test's own first on the path, each call it makes. Node's own modules.
//
//   node scripts/core-moved-test.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TITLE, body, openIssue, ownerOf, pinOf, plan } from "./core-moved.mjs";

let failed = 0, count = 0;
const ok = (cond, what) => { count++; if (!cond) { failed++; console.error(`FAIL: ${what}`); } };
const A = "a".repeat(40), B = "b".repeat(40);
const manifest = (pin, owner = "| *owner's account* | `someone` |") =>
  `# Core manifest\n\nCore: HaakTuah/agent-core at ${pin}, copied whole under core/ (never edited here).\n\n| Slot | Here |\n| --- | --- |\n${owner}\n`;

ok(plan(A, A, null) === "nothing" && plan(A, A, "7") === "close" && plan(A, B, null) === "open" && plan(A, B, "7") === "update", "the four cases");
ok(pinOf(manifest(A)) === A && pinOf("Core: HaakTuah/agent-core at abc, copied whole under core/") === null, "a pin is 40 hex characters");
ok(pinOf(manifest(A) + manifest(B)) === null && pinOf(`> Core: HaakTuah/agent-core at ${A}, copied whole under core/`) === null, "one line, at a line's start");
ok(pinOf(`Core: someone/else at ${A}, copied whole under core/`) === null, "only the core's own address");
ok(ownerOf(manifest(A)) === "someone" && ownerOf(manifest(A, "| *owner's account* | someone |")) === null, "the owner's account, in backticks");
ok(ownerOf(manifest(A, "| *owner's account* | `a; rm -rf x` |")) === null, "an account is letters, digits and hyphens");
ok(body(A, B).includes(`/compare/${A}...${B}`) && body(A, B).includes("node core/scripts/sync.mjs"), "the issue says what changed and how to take it");
ok(openIssue(`3\tsomeone\t${TITLE}\n9\tgithub-actions[bot]\t${TITLE}\n`) === "9", "only an issue the workflow opened counts");
ok(openIssue(`9\tgithub-actions[bot]\t${TITLE} too\n`) === null && openIssue("") === null, "the whole title, or none");
ok(openIssue(`x9\tgithub-actions[bot]\t${TITLE}\n`) === null, "a number is digits");

// The program whole, in a scratch project, with a git and a gh that answer as told and write down what they were asked.
const script = fileURLToPath(new URL("./core-moved.mjs", import.meta.url));
function program(pin, newest, issues, args = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "core-moved-test-"));
  const bin = path.join(dir, "bin"), log = path.join(dir, "calls");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(dir, "core-manifest.md"), manifest(pin));
  fs.writeFileSync(path.join(bin, "git"), `#!/bin/sh\nprintf 'git %s\\n' "$*" >> "${log}"\nprintf '%s\\trefs/heads/main\\n' "${newest}"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(dir, "issues"), issues);
  fs.writeFileSync(path.join(bin, "gh"), `#!/bin/sh\nprintf 'gh %s\\n' "$*" >> "${log}"\n[ "$1" = api ] && cat "${path.join(dir, "issues")}"\nexit 0\n`, { mode: 0o755 });
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: dir, encoding: "utf8",
    env: { PATH: `${bin}:${process.env.PATH}`, GITHUB_REPOSITORY: "someone/project", TMPDIR: dir },
  });
  return { status: r.status, out: r.stdout + r.stderr, calls: fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "" };
}
let r = program(A, A, "");
ok(r.status === 0 && r.out.includes("nothing") && !/gh issue/.test(r.calls), "up to date and no issue: nothing is done");
ok(/^git ls-remote https:\/\/github\.com\/HaakTuah\/agent-core refs\/heads\/main$/m.test(r.calls), "the core's main is asked for, and nothing else of git");
r = program(A, B, "");
ok(r.status === 0 && /gh issue create --repo someone\/project --title The core has moved past this project's copy --body-file \S+ --label enhancement --assignee someone/.test(r.calls), "behind and no issue: one is opened for the owner");
r = program(A, B, `12\tgithub-actions[bot]\t${TITLE}\n`);
ok(r.status === 0 && /gh issue edit 12 --repo someone\/project --body-file/.test(r.calls) && !/issue create/.test(r.calls), "behind and an issue open: it is brought up to date, no second one");
r = program(A, A, `12\tgithub-actions[bot]\t${TITLE}\n`);
ok(r.status === 0 && /gh issue close 12 --repo someone\/project/.test(r.calls), "up to date again: the issue is closed");
r = program(A, B, `12\tsomeone-else\t${TITLE}\n`);
ok(/issue create/.test(r.calls) && !/issue edit/.test(r.calls), "an outsider's issue of the same title is left alone");
r = program(A, "not-a-commit", "");
ok(r.status === 1 && !/gh /.test(r.calls), "a main that gives no commit fails before anything is written");
r = program("abc", B, "");
ok(r.status === 1 && r.calls === "", "a manifest without its pin fails before anything is asked");
r = program(A, B, "", ["--dry"]);
ok(r.status === 0 && r.out.includes("open") && !/gh /.test(r.calls), "--dry says what it would do and calls gh for nothing");

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the core-moved check`);
process.exitCode = failed ? 1 : 0;
