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
const bareNames = setOf(tree({
  ".github/workflows/m.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.cjs && python tools/go.py\n",
  "scripts/run.cjs": "const helper = require(\"./helper\");\nconst lib = require(\"./lib\");\n",
  "scripts/helper.js": "module.exports = 1;\n", "scripts/lib/index.js": "module.exports = 2;\n", "scripts/other.js": "module.exports = 3;\n",
  "tools/go.py": "import util\n", "tools/util.py": "x = 1\n",
}));
// a workflow given the secrets whole is powered, as one given one by name; one that names only the token is not
ok(powered("on: push\npermissions:\n  contents: read\njobs:\n  a:\n    env:\n      ALL: ${{ toJSON(secrets) }}\n") && powered("on:\n  workflow_call:\n    secrets:\n      KEY:\npermissions: {}\n")
  && !powered("on: push\npermissions:\n  contents: read\njobs:\n  a:\n    env:\n      T: ${{ secrets.GITHUB_TOKEN }}\n"),
"a workflow given the secrets whole, or declaring one it is called with, is powered; one given only the job's token is not");
// what a powered workflow runs from a folder it moves to: by a step's working-directory, a shell's cd, a module run by
// its name, and, where the folder's name is built, a name that stands in any folder
const moves = setOf(tree({
  ".github/workflows/w.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: ./build.sh\n        working-directory: tools\n      - run: cd ci && node publish.mjs\n      - run: python -m tools2.job\n      - run: python -m pkg\n",
  ".github/workflows/v.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: for d in a b; do (cd \"$d\" && ./make.sh); done\n",
  "tools/build.sh": "echo build\n", "ci/publish.mjs": "console.log(1);\n", "tools2/job.py": "print(1)\n", "pkg/__main__.py": "print(1)\n",
  "a/make.sh": "echo a\n", "b/deep/make.sh": "echo b\n", "build.sh": "echo root\n", "publish.mjs": "console.log(0);\n", "other/build.sh": "echo other\n",
}));
ok(show(moves) === ".github/workflows/v.yml, .github/workflows/w.yml, a/make.sh, b/deep/make.sh, build.sh, ci/publish.mjs, pkg/__main__.py, publish.mjs, tools/build.sh, tools2/job.py",
  "a powered workflow's script run from a folder it moves to joins the set: by working-directory, by cd, a Python module by its name, and in any folder where the folder's name is built; the root's of the same name too, and one in a folder it does not move to stays out", show(moves));
// a Python module run by name brings each package above it, whose __init__.py runs first, and what each imports
const python = setOf(tree({
  ".github/workflows/p.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: python -m tools.jobs.run\n",
  "tools/__init__.py": "from . import shared\n", "tools/shared.py": "print(0)\n", "tools/jobs/__init__.py": "", "tools/jobs/run.py": "import helpers.net as net\nfrom .steps import (one, two)\nfrom ..cfg import (\n    load,\n    keys,\n)\n",
  "tools/jobs/steps/__init__.py": "", "tools/jobs/steps/one.py": "", "tools/jobs/steps/two.py": "", "tools/cfg/__init__.py": "", "tools/cfg/load.py": "", "tools/cfg/keys.py": "", "helpers/__init__.py": "", "helpers/net.py": "",
  "tools/unused.py": "", "other/__init__.py": "",
}));
ok(show(python) === ".github/workflows/p.yml, helpers/__init__.py, helpers/net.py, tools/__init__.py, tools/cfg/__init__.py, tools/cfg/keys.py, tools/cfg/load.py, tools/jobs/__init__.py, tools/jobs/run.py, tools/jobs/steps/__init__.py, tools/jobs/steps/one.py, tools/jobs/steps/two.py, tools/shared.py",
  "a Python module run by name brings the __init__.py of each package above it, and the modules it and they import, by an absolute, a relative or a parent-relative name; a module none imports stays out", show(python));
// a Python import in a form a line does not hold alone, or loaded by a string, joins the set too
const pythonForms = setOf(tree({
  ".github/workflows/q.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: python run.py\n",
  "run.py": "from pkg import (\n    alpha,  # first\n    beta,\n)\nfrom pkg import gamma, \\\n    delta\nimport os; import lib.mod\nimportlib.import_module('dyn.mod')\n",
  "pkg/__init__.py": "", "pkg/alpha.py": "", "pkg/beta.py": "", "pkg/gamma.py": "", "pkg/delta.py": "", "pkg/unused.py": "",
  "lib/__init__.py": "", "lib/mod.py": "", "dyn/__init__.py": "", "dyn/mod.py": "",
}));
ok(show(pythonForms) === ".github/workflows/q.yml, dyn/__init__.py, dyn/mod.py, lib/__init__.py, lib/mod.py, pkg/__init__.py, pkg/alpha.py, pkg/beta.py, pkg/delta.py, pkg/gamma.py, run.py",
  "a Python import over several lines, in brackets or after a backslash, one after a ';', and a module loaded by a plain string join the set; a module none names stays out", show(pythonForms));
// a write permission whose scope is quoted, and a module loaded by a template whose folder is fixed, join the set too
const quotedAndTemplate = setOf(tree({
  ".github/workflows/r.yml": "on: push\npermissions: { \"contents\": \"write\" }\njobs:\n  a:\n    steps:\n      - run: node scripts/load.mjs\n",
  "scripts/load.mjs": "const name = process.argv[2];\nawait import(`./tasks/${name}.mjs`);\n",
  "scripts/tasks/one.mjs": "", "scripts/tasks/deep/two.mjs": "", "scripts/other.mjs": "",
}));
ok(show(quotedAndTemplate) === ".github/workflows/r.yml, scripts/load.mjs, scripts/tasks/deep/two.mjs, scripts/tasks/one.mjs",
  "a workflow whose write permission names its scope in quotes is powered, and a template's fixed folder brings in every script under it; another folder stays out", show(quotedAndTemplate));
// a template whose fixed start is the script's own folder, or whose placeholder holds spaces, brings in what it may load
const ownFolder = setOf(tree({
  ".github/workflows/s.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.mjs && node tools/go.mjs\n",
  "scripts/run.mjs": "await import(`./${process.argv[2]}.mjs`);\n", "scripts/other.mjs": "", "scripts/sub/deep.mjs": "",
  "tools/go.mjs": "await import(`./steps/${ name }.mjs`);\nspawnSync(node, [\"-e\", `import(${url}).then((m) => m.run())`]);\n", "tools/steps/a.mjs": "", "tools/unrelated.mjs": "", "lib/away.mjs": "",
}));
ok(show(ownFolder) === ".github/workflows/s.yml, scripts/other.mjs, scripts/run.mjs, scripts/sub/deep.mjs, tools/go.mjs, tools/steps/a.mjs",
  "a template that names no folder before its placeholder brings in every script under the script's own, and one whose placeholder holds spaces is read too; a folder neither names stays out, and a template that is code names none", show(ownFolder));
// a module that starts a process names its script from the working directory: the root, a plain `cwd`, or any folder
const spawned = setOf(tree({
  ".github/workflows/t.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.mjs\n",
  "scripts/run.mjs": "execFileSync(process.execPath, [\"scripts/job.mjs\"]);\nspawnSync(\"node\", [\"two.mjs\"], { cwd: \"tools\" });\nexecFileSync(\"node\", [\"three.mjs\"], { cwd: dir });\n",
  "scripts/job.mjs": "", "tools/two.mjs": "", "lib/deep/three.mjs": "", "lib/four.mjs": "",
}));
const templated = setOf(tree({
  ".github/workflows/t.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.mjs\n",
  "scripts/run.mjs": "spawnSync(\"node\", [\"five.mjs\"], { cwd: `${root}/tools` });\n", "lib/tools/five.mjs": "", "lib/four.mjs": "",
}));
// a script started from the working directory a step's `working-directory` gives it starts its own from there, so a
// shell script's names, and those of a module that starts a process, may stand in any folder; a module's that starts
// none, and a workflow's, do not
const inherited = setOf(tree({
  ".github/workflows/t.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.mjs && sh scripts/go.sh\n        working-directory: tools\n      - run: node scripts/plain.mjs\n        working-directory: tools\n",
  "tools/scripts/run.mjs": "execFileSync(process.execPath, [\"job.mjs\"]);\n", "tools/scripts/go.sh": "./step.sh\n", "tools/scripts/plain.mjs": "console.log(\"see other.mjs\");\n",
  "tools/job.mjs": "", "tools/step.sh": "", "tools/other.mjs": "",
}));
// a script that loads a network module by an ESM import is one that calls out, as one that requires it is
const esm = setOf(tree({ "scripts/get.mjs": "import { get } from 'http';\nget(url);\n", "scripts/tls.mjs": "import https from \"https\";\n", "scripts/text.mjs": "console.log(\"from http\");\n" }));
ok(show(inherited) === ".github/workflows/t.yml, tools/job.mjs, tools/scripts/go.sh, tools/scripts/plain.mjs, tools/scripts/run.mjs, tools/step.sh"
  && show(esm) === "scripts/get.mjs, scripts/tls.mjs",
  "a script whose working directory its step gives starts its own from there, and a bare ESM import of a network module calls out; a module that starts nothing, and a word, do not", `${show(inherited)} | ${show(esm)}`);
ok(show(spawned) === ".github/workflows/t.yml, lib/deep/three.mjs, scripts/job.mjs, scripts/run.mjs, tools/two.mjs"
  && show(templated) === ".github/workflows/t.yml, lib/tools/five.mjs, scripts/run.mjs",
  "a script a module starts as a process joins the set, from the root, from a plain cwd, and from any folder where its cwd is built, by a name or a template; one none names stays out", show(spawned));
// a load whose name is a template with a space or a bracket in a folder's name, or whose name stands on the line after
// its bracket, is read as a path all the same; a template of code that names no folder before its placeholder names none
const spaced = setOf(tree({
  ".github/workflows/u.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.mjs\n",
  "scripts/run.mjs": "await import(`./release steps/${name}.mjs`);\nawait import(`./kit (old)/${name}.mjs`);\nawait import(\n  `./steps/${name}.mjs`\n);\nexecSync(`node -e ${code}`);\n",
  "scripts/release steps/a.mjs": "", "scripts/kit (old)/b.mjs": "", "scripts/steps/c.mjs": "", "scripts/other.mjs": "", "tools/d.mjs": "",
}));
ok(show(spaced) === ".github/workflows/u.yml, scripts/kit (old)/b.mjs, scripts/release steps/a.mjs, scripts/run.mjs, scripts/steps/c.mjs",
  "a template path with a space or a bracket in a folder's name, and a load whose name stands on the next line, join the set; a template of code names no other script", show(spaced));
ok(show(bareNames) === ".github/workflows/m.yml, scripts/helper.js, scripts/lib/index.js, scripts/run.cjs, tools/go.py, tools/util.py",
  "a module named without its extension joins the set as its language loads it: helper.js, a folder's index.js, a Python module; one not named stays out", show(bareNames));
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
const want = [".claude/settings.json", ".github/workflows/called.yml", ".github/workflows/powered.yml", "bin/publish", "bin/release", "core/scripts/calls.mjs", "deploy", "scripts/by-action.mjs", "scripts/by-call.sh",
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
ok(set.has("core/scripts/calls.mjs") && !set.has("vendored/core/scripts/calls.mjs"), "the copy at the path the manifest names is left out, and a folder core/ that is not the copy is read");
ok(setOf(tree(files)).has("vendored/core/scripts/calls.mjs"), "where no manifest names a copy, as in the core's own repository, nothing is left out");
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
