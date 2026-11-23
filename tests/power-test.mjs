// Tests of what runs with power and which later commits touch none of it (power.mjs, #1134, points 1 and 4): the set
// read from a tree held in memory (each way a file joins it, and each way one stays out), the light commits read with
// stand-ins, and the script run as security-review.yml runs it, in a scratch git repository, its failures read for
// their mends. Git and Node's own modules.
//
//   node tests/power-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { diskTree, gitTree, lightOf, powered, setOf } from "../scripts/power.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir, scratchEnv } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 1600).replace(/\n/g, "\n     ")}`}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/power.mjs");
const show = (set) => [...set].sort().join(", ");

// ---- which workflow has power ----
ok(powered("on: push\npermissions:\n  contents: write\njobs: {}\n"), "a workflow with a write permission has power");
ok(powered("on: push\npermissions: write-all\n"), "  and one with write-all");
ok(powered("on: push\njobs:\n  a:\n    steps:\n      - run: x\n"), "  and one with no top-level permissions, which the host's default token may let write");
ok(powered("on: push\npermissions:\n  contents: read\njobs:\n  a:\n    env:\n      T: ${{ secrets.PERSONAL_TERMS }}\n"), "  and one that reads a secret");
ok(powered("on: push\npermissions: {}\njobs:\n  a:\n    secrets: inherit\n"), "  and one that hands its secrets on");
ok(!powered("on: push\npermissions:\n  contents: read\njobs:\n  a:\n    env:\n      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n"), "a workflow that reads only the token its own permissions bound, and may only read, has none");
ok(!powered("on: push\npermissions:\n  contents: read\n# contents: write\njobs:\n  a:\n    steps:\n      - run: echo \"Mend: write that down\"\n"), "  nor one whose write stands only in a comment or in a line's text");
ok(powered(null), "a workflow that cannot be read has power");
ok(powered("on: push\r\npermissions:\r\n  contents: write\r\njobs: {}\r\n"), "a workflow written with CRLF line ends has its write permission read as with LF");

// ---- the set of a tree ----
const tree = (files) => ({ paths: Object.keys(files), read: (name) => (Object.hasOwn(files, name) ? files[name] : null) });
const crlf = setOf(tree({ ".github/workflows/c.yml": "on: push\r\npermissions:\r\n  contents: write\r\njobs:\r\n  a:\r\n    steps:\r\n      - run: node scripts/run.cjs\r\n", "scripts/run.cjs": "console.log(1);\r\n" }));
ok(show(crlf) === ".github/workflows/c.yml, scripts/run.cjs", "a workflow written with CRLF line ends brings in what it runs, as with LF", show(crlf));
const files = {
  ".github/workflows/powered.yml": "on: push\npermissions:\n  issues: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.mjs\n      - uses: ./.github/workflows/called.yml\n      - run: echo see .github/workflows/named.yml\n      - run: ./deploy && bin/release\n",
  ".github/workflows/called.yml": "on: workflow_call\npermissions:\n  contents: read\njobs:\n  a:\n    steps:\n      - run: bash scripts/by-call.sh\n",
  ".github/workflows/named.yml": "on: push\npermissions:\n  contents: read\njobs:\n  a:\n    steps:\n      - run: node scripts/by-named.mjs\n",
  ".github/workflows/readonly.yml": "on: push\npermissions:\n  contents: read\njobs:\n  a:\n    steps:\n      - run: node scripts/plain.mjs\n",
  "scripts/run.mjs": "import { x } from \"./helper.mjs\";\nconst STEPS = \"steps\";\nconst load = (n) => import(path.join(STEPS, n));\nconsole.log(\"run scripts/not-run.mjs by hand\");\n",
  "scripts/helper.mjs": "export const x = 1;\n",
  "scripts/steps/one.mjs": "export default 1;\n",
  "scripts/steps/deeper/two.mjs": "export default 2;\n",
  "scripts/other/three.mjs": "export default 3;\n",
  "scripts/not-run.mjs": "console.log(1);\n",
  "scripts/by-call.sh": "echo hi\n",
  "scripts/by-named.mjs": "console.log(1);\n",
  "scripts/plain.mjs": "console.log(1);\n",
  "scripts/calls.mjs": "await fetch(\"https://example.invalid\");\n",
  "scripts/pushes.sh": "git push origin HEAD\n",
  "scripts/unread.py": null,
  ".claude/settings.json": "{}\n",
  "tools/act/action.yml": "runs:\n  using: node20\n  main: ../../scripts/by-action.mjs\n",
  "scripts/by-action.mjs": "console.log(1);\n",
  "core/scripts/calls.mjs": "await fetch(\"https://example.invalid\");\n",
  "vendored/core/scripts/calls.mjs": "await fetch(\"https://example.invalid\");\n",
  "README.md": "node scripts/plain.mjs\n",
  "deploy": "#!/bin/sh\necho deploying\n",
  "bin/release": "#!/bin/sh\necho 1\n",
  "bin/publish": "#!/usr/bin/env bash\ngit push origin HEAD\n",
  "bin/notes": "git push is described here, with no #! line\n",
};
const why = new Map();
const set = setOf({ ...tree(files), copy: "vendored/core/" }, why);
const want = [".claude/settings.json", ".github/workflows/called.yml", ".github/workflows/powered.yml", "bin/publish", "bin/release", "deploy", "scripts/by-action.mjs", "scripts/by-call.sh",
  "scripts/calls.mjs", "scripts/helper.mjs", "scripts/pushes.sh", "scripts/run.mjs", "scripts/steps/one.mjs", "scripts/unread.py", "tools/act/action.yml"];
ok(show(set) === want.join(", "), "the set holds the powered workflow, what it runs and calls and loads, a script that calls out, .claude/, an action and what it runs, and an unread script, and nothing else", show(set));
ok(why.get(".github/workflows/powered.yml") === "power" && why.get(".claude/settings.json") === "place" && why.get("tools/act/action.yml") === "place"
  && why.get("scripts/calls.mjs") === "calls" && why.get("scripts/pushes.sh") === "calls" && why.get("scripts/unread.py") === "unread"
  && why.get("scripts/run.mjs") === ".github/workflows/powered.yml" && why.get("scripts/helper.mjs") === "scripts/run.mjs"
  && why.get("scripts/steps/one.mjs") === "scripts/run.mjs (built)" && why.get(".github/workflows/called.yml") === ".github/workflows/powered.yml",
"each says what brought it in", JSON.stringify([...why]));
ok(why.get("deploy") === ".github/workflows/powered.yml" && why.get("bin/release") === ".github/workflows/powered.yml" && why.get("bin/publish") === "calls" && !set.has("bin/notes"),
  "a file with no extension a powered workflow runs is in it, and one that starts with #! and calls out, but not one with no #! line", JSON.stringify([...why]));
ok(!set.has(".github/workflows/named.yml") && !set.has("scripts/by-named.mjs"), "a workflow a powered one only names is not followed, nor what it runs");
ok(!set.has("scripts/not-run.mjs"), "a root-relative path a module only prints is not followed: a module's names lead from its own folder");
ok(!set.has("scripts/steps/deeper/two.mjs") && !set.has("scripts/other/three.mjs"), "a module loaded by a built name brings in the folder it names alone, not one below it or another");
ok(!set.has("core/scripts/calls.mjs") && !set.has("vendored/core/scripts/calls.mjs"), "the copy of the core is left out, wherever it stands");
ok(!set.has(".github/workflows/readonly.yml") && !set.has("scripts/plain.mjs"), "a workflow that may only read is not in it, nor what it alone runs");

// a built name in a test's string is no load, and a script whose built name names no folder brings in none
const quiet = setOf(tree({
  ".github/workflows/w.yml": "on: push\njobs:\n  a:\n    steps:\n      - run: node scripts/a.mjs && bash tools/b.sh\n",
  "scripts/a.mjs": "const t = \"await import(name)\";\nconst u = require(name);\n",
  "scripts/sib.mjs": "export default 1;\n",
  "tools/b.sh": "source \"$DIR/$name\"\n",
  "tools/sib.sh": "echo 1\n",
}));
ok(!quiet.has("scripts/sib.mjs"), "a module whose built name names no folder brings in nothing: the name comes from what calls it", show(quiet));
ok(!quiet.has("tools/sib.sh"), "  and a shell script's line with no import( or require( is no load", show(quiet));
// ---- the light commits, with stand-ins ----
const sha = (n) => String(n).repeat(40).slice(0, 40);
const [A, B, C, D, E, M] = ["a", "b", "c", "d", "e", "f"].map(sha);
const commit = (s, ...parents) => ({ sha: s, parents: parents.map((p) => ({ sha: p })) });
const commits = [commit(A, sha(0)), commit(B, A), commit(C, B), commit(M, C, sha(9)), commit(D, M), commit(E, D)];
const sets = { [A]: new Set(["w.yml"]), [B]: new Set(["w.yml"]), [C]: new Set(["w.yml", "new.mjs"]), [M]: new Set(["w.yml"]), [D]: new Set(["w.yml"]), [E]: new Set(["w.yml"]) };
const changes = { [B]: ["README.md"], [C]: ["new.mjs"], [D]: ["README.md"], [E]: ["boom"] };
const changed = (parent, at) => { if (changes[at]?.[0] === "boom") throw new Error("no"); return changes[at]; };
const light = lightOf(commits, { setAt: (at) => sets[at], changed });
ok(light.join() === [D, B].join(), "light: a commit with one parent of the pull request's that changes nothing in the set; not the first (its parent is main's), one that adds to the set, a merge, or one not read", light.join());
const gone = { ...sets, [D]: new Set() };
ok(!lightOf([commit(C, B), commit(D, C)], { setAt: (at) => gone[at], changed: () => ["w.yml"] }).length, "a commit that takes a file out of the set is not light");
let t = 0;
ok(lightOf(commits, { setAt: (at) => sets[at], changed, deadline: 2, now: () => (t += 1) }).length === 1, "once the deadline passes, no older commit is read: the newest first");
ok(!lightOf([commit("short", B)], { setAt: () => new Set(), changed: () => [] }).length && !lightOf(null, { setAt: () => new Set(), changed: () => [] }).length, "a commit with no whole SHA, or no list, gives none");

// ---- the script as the workflow runs it ----
const tmp = scratchDir("power-test-");
const env = scratchEnv(tmp, tmp);
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const write = (dir, f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
const save = (dir, message) => { git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", message); return git(dir, "rev-parse", "HEAD"); };
const repo = path.join(tmp, "repo");
fs.mkdirSync(repo);
git(repo, "init", "-q", "-b", "main");
write(repo, ".github/workflows/w.yml", "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.mjs\n");
write(repo, "scripts/run.mjs", "console.log(1);\n");
write(repo, "README.md", "one\n");
const base = save(repo, "base");
git(repo, "checkout", "-q", "-b", "pr");
write(repo, "scripts/run.mjs", "console.log(2);\n");
const first = save(repo, "a script that runs with power");
write(repo, "README.md", "two\n");
const second = save(repo, "the readme");
write(repo, "scripts/run.mjs", "console.log(3);\n");
const third = save(repo, "the script again");
write(repo, "notes.md", "four\n");
const fourth = save(repo, "a note");
const listed = [first, second, third, fourth].map((s) => ({ sha: s, parents: [{ sha: git(repo, "rev-parse", `${s}^`) }] }));
const checkout = path.join(tmp, "checkout");
git(tmp, "clone", "-q", "--branch", "main", repo, checkout);
write(tmp, "pull.json", JSON.stringify({ head: { sha: fourth }, base: { sha: base } }));
write(tmp, "commits.json", JSON.stringify([listed]));
write(tmp, "files.json", JSON.stringify([[{ filename: "scripts/run.mjs" }, { filename: "README.md" }, { filename: "notes.md", previous_filename: ".github/workflows/w.yml" }]]));
const run = (args, extra = {}) => spawnSync(process.execPath, [script, ...args], { cwd: repo, env: { ...env, ...extra }, encoding: "utf8" });
const out = run([path.join(tmp, "pull.json"), path.join(tmp, "commits.json"), path.join(tmp, "files.json"), checkout]);
let printed = null;
try { printed = JSON.parse(out.stdout); } catch { /* (read below) */ }
ok(out.status === 0 && JSON.stringify(printed) === JSON.stringify({ power: [".github/workflows/w.yml", "scripts/run.mjs"], light: [fourth, second] }),
  "run in a clone, it prints the files that run with power, by either name, and the light commits, the newest first: the readme and the note, not the scripts", out.stdout + out.stderr);
const late = run([path.join(tmp, "pull.json"), path.join(tmp, "commits.json"), path.join(tmp, "files.json"), checkout], { DEADLINE: "1" });
ok(late.status === 0 && JSON.parse(late.stdout).light.length === 0, "past its deadline, it reads none light, so each review is asked as before", late.stdout + late.stderr);
write(tmp, "elsewhere.json", JSON.stringify({ head: { sha: sha(7) } }));
const missing = run([path.join(tmp, "elsewhere.json"), path.join(tmp, "commits.json"), path.join(tmp, "files.json"), checkout]);
ok(missing.status === 1 && mended(missing.stderr) && /could not read the head/u.test(missing.stderr), "a head the clone does not hold fails, saying the mend", missing.stderr);
write(tmp, "bad.json", "{");
const bad = run([path.join(tmp, "bad.json"), path.join(tmp, "commits.json"), path.join(tmp, "files.json"), checkout]);
ok(bad.status === 1 && mended(bad.stderr), "a file that is no JSON fails, saying the mend", bad.stderr);
write(tmp, "headless.json", "{}");
const headless = run([path.join(tmp, "headless.json"), path.join(tmp, "commits.json"), path.join(tmp, "files.json"), checkout]);
ok(headless.status === 1 && mended(headless.stderr) && /no head commit/u.test(headless.stderr), "a pull request with no head fails, saying the mend", headless.stderr);
ok(run([]).status === 2, "with no arguments it prints its usage");
const list = run(["--list", checkout]);
ok(list.status === 0 && list.stdout === ".github/workflows/w.yml\tpower\nscripts/run.mjs\t.github/workflows/w.yml\n", "--list prints a folder's set, each path with what brought it in", list.stdout + list.stderr);
const nowhere = run(["--list", path.join(tmp, "nowhere")]);
ok(nowhere.status === 1 && mended(nowhere.stderr), "--list of a folder that is not there fails, saying the mend", nowhere.stderr);

// An executable with no extension, read from a commit as from disk: a powered workflow runs `./deploy`, which runs
// `./helper`, and `bin/publish` calls `git push` after its `#!` line.
const ext = path.join(tmp, "ext");
fs.mkdirSync(ext);
git(ext, "init", "-q", "-b", "main");
write(ext, ".github/workflows/d.yml", "on: push\npermissions:\n  issues: write\njobs:\n  a:\n    steps:\n      - run: ./deploy\n");
write(ext, "deploy", "#!/bin/sh\n./helper\n");
write(ext, "helper", "#!/bin/sh\necho 1\n");
write(ext, "bin/publish", "#!/usr/bin/env bash\ngit push origin HEAD\n");
write(ext, "README", "one\n");
const extBase = save(ext, "base");
const fromGit = setOf(gitTree(extBase, ext)), fromDisk = setOf(diskTree(ext));
ok(["deploy", "helper", "bin/publish"].every((f) => fromGit.has(f)) && !fromGit.has("README") && show(fromGit) === show(fromDisk),
  "read from a commit, files with no extension join the set as on disk: what a powered workflow runs, what that runs, and a #! script that pushes", `${show(fromGit)} | ${show(fromDisk)}`);
git(ext, "checkout", "-q", "-b", "pr");
write(ext, "README", "two\n");
const extFirst = save(ext, "the readme");
write(ext, "helper", "#!/bin/sh\necho 2\n");
const extSecond = save(ext, "the helper");
write(ext, "README", "three\n");
const extThird = save(ext, "the readme again");
const extCheckout = path.join(tmp, "ext-checkout");
git(tmp, "clone", "-q", "--branch", "main", ext, extCheckout);
write(tmp, "ext-pull.json", JSON.stringify({ head: { sha: extThird }, base: { sha: extBase } }));
write(tmp, "ext-commits.json", JSON.stringify([[extFirst, extSecond, extThird].map((s) => ({ sha: s, parents: [{ sha: git(ext, "rev-parse", `${s}^`) }] }))]));
write(tmp, "ext-files.json", JSON.stringify([[{ filename: "helper" }, { filename: "README" }]]));
const extOut = spawnSync(process.execPath, [script, path.join(tmp, "ext-pull.json"), path.join(tmp, "ext-commits.json"), path.join(tmp, "ext-files.json"), extCheckout], { cwd: ext, env, encoding: "utf8" });
let extPrinted = null;
try { extPrinted = JSON.parse(extOut.stdout); } catch { /* (read below) */ }
ok(extOut.status === 0 && JSON.stringify(extPrinted) === JSON.stringify({ power: ["helper"], light: [extThird] }),
  "a commit that changes an executable with no extension, run by what a powered workflow runs, is not light, read from its own tree: the readme's after it is", extOut.stdout + extOut.stderr);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${count - failed} of ${count} passed`);
process.exit(failed ? 1 : 0);
