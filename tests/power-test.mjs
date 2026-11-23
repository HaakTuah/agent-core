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
  "scripts/helper.js": "module.exports = 1;\n", "scripts/lib/index.js": "module.exports = 2;\n", "apart/other.js": "module.exports = 3;\n",
  "tools/go.py": "import util\n", "tools/util.py": "x = 1\n",
}));
// a workflow given the secrets whole is powered, as one given one by name; one that names only the token is not
ok(powered("on: push\npermissions:\n  contents: read\njobs:\n  a:\n    env:\n      ALL: ${{ toJSON(secrets) }}\n") && powered("on:\n  workflow_call:\n    secrets:\n      KEY:\npermissions: {}\n")
  && !powered("on: push\npermissions:\n  contents: read\njobs:\n  a:\n    env:\n      T: ${{ secrets.GITHUB_TOKEN }}\n"),
"a workflow given the secrets whole, or declaring one it is called with, is powered; one given only the job's token is not");
// what a powered workflow runs from a folder it moves to: by a step's working-directory, a shell's cd, a module run by
// its name; a name is read in any folder, so the root's and another folder's of that name join too
const moves = setOf(tree({
  ".github/workflows/w.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: ./build.sh\n        working-directory: tools\n      - run: cd ci && node publish.mjs\n      - run: python -m tools2.job\n      - run: python -m pkg\n",
  ".github/workflows/v.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: for d in a b; do (cd \"$d\" && ./make.sh); done\n",
  "tools/build.sh": "echo build\n", "ci/publish.mjs": "console.log(1);\n", "tools2/job.py": "print(1)\n", "pkg/__main__.py": "print(1)\n",
  "a/make.sh": "echo a\n", "b/deep/make.sh": "echo b\n", "build.sh": "echo root\n", "publish.mjs": "console.log(0);\n", "other/build.sh": "echo other\n",
}));
ok(show(moves) === ".github/workflows/v.yml, .github/workflows/w.yml, a/make.sh, b/deep/make.sh, build.sh, ci/publish.mjs, other/build.sh, pkg/__main__.py, publish.mjs, tools/build.sh, tools2/job.py",
  "a powered workflow's script run from a folder it moves to joins the set: by working-directory, by cd, a Python module by its name; a name stands in any folder, so the root's and another folder's of that name join too", show(moves));
// a Python module run by name brings each package above it, whose __init__.py runs first, and what each imports
const python = setOf(tree({
  ".github/workflows/p.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: python -m tools.jobs.run\n",
  "tools/__init__.py": "from . import shared\n", "tools/shared.py": "print(0)\n", "tools/jobs/__init__.py": "", "tools/jobs/run.py": "import helpers.net as net\nfrom .steps import (one, two)\nfrom ..cfg import (\n    load,\n    keys,\n)\n",
  "tools/jobs/steps/__init__.py": "", "tools/jobs/steps/one.py": "", "tools/jobs/steps/two.py": "", "tools/cfg/__init__.py": "", "tools/cfg/load.py": "", "tools/cfg/keys.py": "", "helpers/__init__.py": "", "helpers/net.py": "",
  "tools/apart/unused.py": "", "other/__init__.py": "",
}));
ok(show(python) === ".github/workflows/p.yml, helpers/__init__.py, helpers/net.py, tools/__init__.py, tools/cfg/__init__.py, tools/cfg/keys.py, tools/cfg/load.py, tools/jobs/__init__.py, tools/jobs/run.py, tools/jobs/steps/__init__.py, tools/jobs/steps/one.py, tools/jobs/steps/two.py, tools/shared.py",
  "a Python module run by name brings the __init__.py of each package above it, and the modules it and they import, by an absolute, a relative or a parent-relative name; a module none imports, in a folder none names, stays out", show(python));
// a Python import in a form a line does not hold alone, or loaded by a string, joins the set too
const pythonForms = setOf(tree({
  ".github/workflows/q.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: python run.py\n",
  "run.py": "from pkg import (\n    alpha,  # first\n    beta,\n)\nfrom pkg import gamma, \\\n    delta\nimport os; import lib.mod\nimportlib.import_module('dyn.mod')\n",
  "pkg/__init__.py": "", "pkg/alpha.py": "", "pkg/beta.py": "", "pkg/gamma.py": "", "pkg/delta.py": "", "apart/unused.py": "",
  "lib/__init__.py": "", "lib/mod.py": "", "dyn/__init__.py": "", "dyn/mod.py": "",
}));
ok(show(pythonForms) === ".github/workflows/q.yml, dyn/__init__.py, dyn/mod.py, lib/__init__.py, lib/mod.py, pkg/__init__.py, pkg/alpha.py, pkg/beta.py, pkg/delta.py, pkg/gamma.py, run.py",
  "a Python import over several lines, in brackets or after a backslash, one after a ';', and a module loaded by a plain string join the set; a module in a folder none names stays out", show(pythonForms));
// a write permission whose scope is quoted, and a module loaded by a template whose folder is fixed, join the set too
const quotedAndTemplate = setOf(tree({
  ".github/workflows/r.yml": "on: push\npermissions: { \"contents\": \"write\" }\njobs:\n  a:\n    steps:\n      - run: node scripts/load.mjs\n",
  "scripts/load.mjs": "const name = process.argv[2];\nawait import(`./tasks/${name}.mjs`);\n",
  "scripts/tasks/one.mjs": "", "scripts/tasks/deep/two.mjs": "", "scripts/apart/other.mjs": "",
}));
ok(show(quotedAndTemplate) === ".github/workflows/r.yml, scripts/load.mjs, scripts/tasks/deep/two.mjs, scripts/tasks/one.mjs",
  "a workflow whose write permission names its scope in quotes is powered, and a template's fixed folder brings in every script under it; another folder stays out", show(quotedAndTemplate));
// a template whose fixed start is the script's own folder, or whose placeholder holds spaces, brings in what it may load
const ownFolder = setOf(tree({
  ".github/workflows/s.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.mjs && node tools/go.mjs\n",
  "scripts/run.mjs": "await import(`./${process.argv[2]}.mjs`);\n", "scripts/other.mjs": "", "scripts/sub/deep.mjs": "",
  "tools/go.mjs": "await import(`./steps/${ name }.mjs`);\nspawnSync(node, [\"-e\", `import(${url}).then((m) => m.run())`]);\n", "tools/steps/a.mjs": "", "tools/apart/unrelated.mjs": "", "lib/away.mjs": "",
}));
ok(show(ownFolder) === ".github/workflows/s.yml, scripts/other.mjs, scripts/run.mjs, scripts/sub/deep.mjs, tools/go.mjs, tools/steps/a.mjs",
  "a template that names no folder before its placeholder brings in every script under the script's own, and one whose placeholder holds spaces is read too; a folder neither names stays out, and a template that is code names none", show(ownFolder));
// a module that starts a process names its script from the working directory: the root, a plain `cwd`, or any folder
const spawned = setOf(tree({
  ".github/workflows/t.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.mjs\n",
  "scripts/run.mjs": "execFileSync(process.execPath, [\"scripts/job.mjs\"]);\nspawnSync(\"node\", [\"two.mjs\"], { cwd: \"tools\" });\nexecFileSync(\"node\", [\"three.mjs\"], { cwd: dir });\n",
  "scripts/job.mjs": "", "tools/two.mjs": "", "lib/deep/three.mjs": "", "apart/four.mjs": "",
}));
const templated = setOf(tree({
  ".github/workflows/t.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.mjs\n",
  "scripts/run.mjs": "spawnSync(\"node\", [\"five.mjs\"], { cwd: `${root}/tools` });\n", "lib/tools/five.mjs": "", "apart/four.mjs": "",
}));
// a script started from the working directory a step's `working-directory` gives it starts its own from there; and a
// name a module only prints is read as one it runs, since a text cannot tell the two apart
const inherited = setOf(tree({
  ".github/workflows/t.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.mjs && sh scripts/go.sh\n        working-directory: tools\n      - run: node scripts/plain.mjs\n        working-directory: tools\n",
  "tools/scripts/run.mjs": "execFileSync(process.execPath, [\"job.mjs\"]);\n", "tools/scripts/go.sh": "./step.sh\n", "tools/scripts/plain.mjs": "console.log(\"see other.mjs\");\n",
  "tools/job.mjs": "", "tools/step.sh": "", "tools/other.mjs": "",
}));
// a script that loads a network module by an ESM import is one that calls out, as one that requires it is
const esm = setOf(tree({ "scripts/get.mjs": "import { get } from 'http';\nget(url);\n", "scripts/tls.mjs": "import https from \"https\";\n", "tools/text.mjs": "console.log(\"from http\");\n" }));
ok(show(inherited) === ".github/workflows/t.yml, tools/job.mjs, tools/other.mjs, tools/scripts/go.sh, tools/scripts/plain.mjs, tools/scripts/run.mjs, tools/step.sh"
  && show(esm) === "scripts/get.mjs, scripts/tls.mjs",
  "a script whose working directory its step gives starts its own from there, a name a module prints joins too, and a bare ESM import of a network module calls out; a word does not", `${show(inherited)} | ${show(esm)}`);
ok(show(spawned) === ".github/workflows/t.yml, lib/deep/three.mjs, scripts/job.mjs, scripts/run.mjs, tools/two.mjs"
  && show(templated) === ".github/workflows/t.yml, lib/tools/five.mjs, scripts/run.mjs",
  "a script a module starts as a process joins the set, from the root, from a plain cwd, and from any folder where its cwd is built, by a name or a template; one none names stays out", show(spawned));
// a load whose name is a template with a space or a bracket in a folder's name, or whose name stands on the line after
// its bracket, is read as a path all the same; a template of code that names no folder before its placeholder names none
const spaced = setOf(tree({
  ".github/workflows/u.yml": "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.mjs\n",
  "scripts/run.mjs": "await import(`./release steps/${name}.mjs`);\nawait import(`./kit (old)/${name}.mjs`);\nawait import(\n  `./steps/${name}.mjs`\n);\nexecSync(`node -e ${code}`);\n",
  "scripts/release steps/a.mjs": "", "scripts/kit (old)/b.mjs": "", "scripts/steps/c.mjs": "", "scripts/apart/other.mjs": "", "tools/d.mjs": "",
}));
ok(show(spaced) === ".github/workflows/u.yml, scripts/kit (old)/b.mjs, scripts/release steps/a.mjs, scripts/run.mjs, scripts/steps/c.mjs",
  "a template path with a space or a bracket in a folder's name, and a load whose name stands on the next line, join the set; a template of code names no other script", show(spaced));
ok(show(bareNames) === ".github/workflows/m.yml, scripts/helper.js, scripts/lib/index.js, scripts/run.cjs, tools/go.py, tools/util.py",
  "a module named without its extension joins the set as its language loads it: helper.js, a folder's index.js, a Python module; one not named stays out", show(bareNames));
const files = {
  ".github/workflows/powered.yml": "on: push\npermissions:\n  issues: write\njobs:\n  a:\n    steps:\n      - run: node scripts/run.mjs\n      - uses: ./.github/workflows/called.yml\n      - run: echo see .github/workflows/named.yml\n      - run: ./deploy && bin/release\n",
  ".github/workflows/called.yml": "on: workflow_call\npermissions:\n  contents: read\njobs:\n  a:\n    steps:\n      - run: bash scripts/by-call.sh\n",
  ".github/workflows/named.yml": "on: push\npermissions:\n  contents: read\njobs:\n  a:\n    steps:\n      - run: node aside/by-named.mjs\n",
  ".github/workflows/readonly.yml": "on: push\npermissions:\n  contents: read\njobs:\n  a:\n    steps:\n      - run: node aside/plain.mjs\n",
  "scripts/run.mjs": "import { x } from \"./helper.mjs\";\nconst PARTS = \"parts\";\nconst load = (n) => import(path.join(PARTS, n));\nconst kind = (n) => import(`../kinds/k-${n}.mjs`);\nconsole.log(\"run scripts/not-run.mjs by hand\");\n",
  "scripts/helper.mjs": "export const x = 1;\n",
  "scripts/parts/one.mjs": "export default 1;\n",
  "scripts/parts/deeper/two.mjs": "export default 2;\n",
  "kinds/k-one.mjs": "export default 4;\n",
  "scripts/other/three.mjs": "export default 3;\n",
  "scripts/not-run.mjs": "console.log(1);\n",
  "scripts/by-call.sh": "echo hi\n",
  "aside/by-named.mjs": "console.log(1);\n",
  "aside/plain.mjs": "console.log(1);\n",
  "scripts/calls.mjs": "await fetch(\"https://example.invalid\");\n",
  "scripts/pushes.sh": "git push origin HEAD\n",
  "scripts/unread.py": null,
  ".claude/settings.json": "{}\n",
  "tools/act/action.yml": "runs:\n  using: node20\n  main: ../../scripts/by-action.mjs\n",
  "scripts/by-action.mjs": "console.log(1);\n",
  "core/scripts/calls.mjs": "await fetch(\"https://example.invalid\");\n",
  "vendored/core/scripts/calls.mjs": "await fetch(\"https://example.invalid\");\n",
  "README.md": "node aside/plain.mjs\n",
  "deploy": "#!/bin/sh\necho deploying\n",
  "bin/release": "#!/bin/sh\necho 1\n",
  "bin/publish": "#!/usr/bin/env bash\ngit push origin HEAD\n",
  "docs/notes": "git push is described here, with no #! line\n",
};
const why = new Map();
const set = setOf({ ...tree(files), copy: "vendored/core/" }, why);
const want = [".claude/settings.json", ".github/workflows/called.yml", ".github/workflows/powered.yml", "bin/publish", "bin/release", "core/scripts/calls.mjs", "deploy", "kinds/k-one.mjs", "scripts/by-action.mjs", "scripts/by-call.sh",
  "scripts/calls.mjs", "scripts/helper.mjs", "scripts/not-run.mjs", "scripts/parts/deeper/two.mjs", "scripts/parts/one.mjs", "scripts/pushes.sh", "scripts/run.mjs", "scripts/unread.py", "tools/act/action.yml"];
ok(show(set) === want.join(", "), "the set holds the powered workflow, what it runs and calls and loads, a script that calls out, .claude/, an action and what it runs, and an unread script, and nothing else", show(set));
ok(why.get(".github/workflows/powered.yml") === "power" && why.get(".claude/settings.json") === "place" && why.get("tools/act/action.yml") === "place"
  && why.get("scripts/calls.mjs") === "calls" && why.get("scripts/pushes.sh") === "calls" && why.get("scripts/unread.py") === "unread"
  && why.get("scripts/run.mjs") === "calls" && why.get("scripts/helper.mjs") === "scripts/run.mjs"
  && why.get("scripts/parts/one.mjs") === "scripts/run.mjs" && why.get("kinds/k-one.mjs") === "scripts/run.mjs (built)" && why.get(".github/workflows/called.yml") === ".github/workflows/powered.yml",
"each says what brought it in: the file that names it or its folder, marked (built) where it builds the name; a module that loads by a name it builds, which may be a package's, by itself", JSON.stringify([...why]));
ok(why.get("deploy") === ".github/workflows/powered.yml" && why.get("bin/release") === ".github/workflows/powered.yml" && why.get("bin/publish") === "calls" && !set.has("docs/notes"),
  "a file with no extension a powered workflow runs is in it, and one that starts with #! and calls out, but not one with no #! line", JSON.stringify([...why]));
ok(!set.has(".github/workflows/named.yml") && !set.has("aside/by-named.mjs"), "a workflow a powered one only names is not followed, nor what it runs");
ok(set.has("scripts/not-run.mjs"), "a path a module only prints is followed: a text cannot tell it from one it runs, nor the folder it leads from");
ok(set.has("scripts/parts/deeper/two.mjs") && !set.has("scripts/other/three.mjs"), "a folder a text names whole brings in every script below it, whatever line runs them, and no other folder");
ok(set.has("core/scripts/calls.mjs") && !set.has("vendored/core/scripts/calls.mjs"), "the copy at the path the manifest names is left out, and a folder core/ that is not the copy is read");
ok(setOf(tree(files)).has("vendored/core/scripts/calls.mjs"), "where no manifest names a copy, as in the core's own repository, nothing is left out");
ok(!set.has(".github/workflows/readonly.yml") && !set.has("aside/plain.mjs"), "a workflow that may only read is not in it, nor what it alone runs");

// the files beside a file of the set, and beside each folder above it, join it, whatever its text holds; a folder
// below it, beside it or apart, which no file of the set names, stays out
const beside = setOf(tree({
  ".github/workflows/w.yml": "on: push\njobs:\n  a:\n    steps:\n      - run: node scripts/deep/go.mjs\n",
  "scripts/deep/go.mjs": "const u = load(name);\n", "scripts/deep/sib.mjs": "", "scripts/up.mjs": "", "top.sh": "",
  "scripts/deep/lower/b.mjs": "", "scripts/near/c.mjs": "", "apart/d.mjs": "",
}));
ok(["scripts/deep/sib.mjs", "scripts/up.mjs", "top.sh"].every((f) => beside.has(f)), "a file beside one of the set joins it, and one beside each folder above it, up to the root: a name built whole elsewhere is run from there, whatever runs it", show(beside));
ok(!["scripts/deep/lower/b.mjs", "scripts/near/c.mjs", "apart/d.mjs"].some((f) => beside.has(f)), "  and a folder below it, beside it or apart, which no file of the set names, stays out", show(beside));
// ---- each class a name is read by, and what may call out (#1134): a form of each that the reader before missed ----
const flow = (run) => `on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: ${run}\n`;
const classes = {
  "a template whose first placeholder builds the folder names what follows it in any folder": [{ "scripts/run.mjs": "await import(`${root}/units/${name}.mjs`);\nawait import(`${root}/parts/one.mjs`);\n", "units/x.mjs": "", "lib/units/y.mjs": "", "parts/one.mjs": "" }, ["kinds/two.mjs", "lib/deep/other.mjs"]],
  "a static import whose path holds a space, or a letter outside ASCII, names its file": [{ "scripts/run.mjs": "import './release steps/helper.mjs';\nimport './hjælp.mjs';\n", "scripts/release steps/helper.mjs": "", "scripts/hjælp.mjs": "" }, ["apart/other.mjs"]],
  "a load by a file's URL, a worker, a require createRequire made, and a name written with escapes name their files": [{ "scripts/run.mjs": "await import(pathToFileURL(\"tools/a.mjs\").href);\nnew Worker(\"tools/b.mjs\");\nconst require = createRequire(process.cwd() + \"/\");\nrequire(\"./tools/c.cjs\");\nawait import(decodeURIComponent(\"./d%2De.mjs\"));\n", "tools/a.mjs": "", "tools/b.mjs": "", "tools/c.cjs": "", "scripts/d-e.mjs": "" }, ["apart/f.mjs"]],
  "a name joined by join( or +, a shell's glob, by a workflow or a sourced loop, and a Python f-string name each file that fits": [{ "scripts/run.mjs": "spawnSync(process.execPath, [path.join(ROOT, \"steps\", name + \".mjs\")]);\nawait import(\"./parts/\" + name + \".mjs\");\n", "steps/x.mjs": "", "scripts/parts/deep/y.mjs": "", "tools/steps/z.sh": "", "tools/go.sh": "for f in \"$(dirname \"$0\")\"/bits/*; do . \"$f\"; done\n", "tools/bits/w.sh": "", "tools/go.py": "import importlib\nm = importlib.import_module(f\"mods.{name}\")\n", "tools/mods/__init__.py": "", "tools/mods/v.py": "" }, ["lib/u.mjs"], "node scripts/run.mjs && for f in tools/steps/*.sh; do bash \"$f\"; done && bash tools/go.sh && python tools/go.py"],
  // a name of holes alone, whatever runs it: its folder is written whole somewhere, or is where a file of the set stands
  "a name of holes alone takes each folder its text names whole, on whichever line and in whichever function": [{ "scripts/run.mjs": "const BASE = \"kinds\";\nexport async function run(n) {\n  const dir = path.join(root, BASE);\n  return import(path.join(dir, n));\n}\nfunction other() {\n  const dir = \"packs\";\n}\n", "kinds/deep/x.mjs": "", "packs/y.mjs": "" }, ["lib/q.mjs"]],
  "  and so the folder of a process started by a template or a join( of holes alone": [{ "scripts/run.mjs": "const DIR = 'kinds';\nfor (const f of readdirSync(DIR)) spawnSync('node', [`${DIR}/${f}`]);\nconst PACK = 'packs';\nfor (const f of readdirSync(PACK)) spawnSync('node', [path.join(PACK, f)]);\n", "kinds/p.mjs": "", "packs/deep/r.mjs": "" }, ["lib/q.mjs"]],
  "  and the folder of what a shell sources by a glob, held in a variable, from the root or beside the script": [{ "tools/go.sh": "UNITS=\"tools/units\"\nfor f in \"$UNITS\"/*.sh; do . \"$f\"; done\nPACKS=packs\nfor f in \"$(dirname \"$0\")/$PACKS\"/*.sh; do . \"$f\"; done\n", "tools/units/u.sh": "", "tools/packs/v.sh": "" }, ["lib/q.sh"], "bash tools/go.sh"],
  "  and the package Python imports from, held in a variable, by an f-string or a +": [{ "tools/go.py": "import importlib\nKINDS = \"kinds\"\nm = importlib.import_module(f\"{KINDS}.{n}\")\nOTHER = \"packs\"\nm = importlib.import_module(OTHER + \".\" + n)\n", "tools/kinds/v.py": "", "tools/packs/w.py": "" }, ["lib/q.py"], "python tools/go.py"],
  "  and a folder in a list over several lines, one given as a function's argument, and one set in another module": [{ "scripts/run.mjs": "import { DIR } from \"./places.mjs\";\nconst DIRS = [\n  \"kinds\",\n  \"packs\",\n];\nfor (const d of DIRS) for (const f of readdirSync(d)) await import(path.resolve(d, f));\nconst load = (dir, n) => import(path.join(root, dir, n));\nawait load(\"units\", name);\nfor (const f of readdirSync(DIR)) spawnSync(\"node\", [`${DIR}/${f}`]);\n", "scripts/places.mjs": "export const DIR = \"mods\";\n", "kinds/p.mjs": "", "packs/deep/r.mjs": "", "units/s.mjs": "", "mods/t.mjs": "" }, ["lib/q.mjs"]],
  "  and a folder the workflow hands the script, gives a runner, or moves to before a glob": [{ "scripts/run.mjs": "for (const f of readdirSync(process.argv[2])) spawnSync(process.execPath, [path.join(process.argv[2], f)]);\n", "kinds/p.mjs": "", "checks/c.test.js": "", "tools/units/u.sh": "" }, ["lib/q.mjs", "lib/q.sh"], "node scripts/run.mjs kinds && node --test checks/\n      - run: for f in *.sh; do bash \"$f\"; done\n        working-directory: tools/units"],
  "  and a folder a process is started in, or a shell moved to, its files run by bare names": [{ "scripts/run.mjs": "for (const f of readdirSync(\"kinds\")) spawnSync(\"node\", [f], { cwd: \"kinds\" });\n", "kinds/p.mjs": "", "tools/go.sh": "cd tools/units\nfor f in *.sh; do . \"./$f\"; done\n", "tools/units/u.sh": "" }, ["lib/q.mjs"], "node scripts/run.mjs && bash tools/go.sh"],
  "  and a folder a Python path names, and one written with a backslash": [{ "tools/go.py": "import runpy\nfrom pathlib import Path\nfor p in (Path(\"kinds\")).iterdir():\n    runpy.run_path(p)\n", "tools/kinds/v.py": "", "tools/go.ps1": "$d = \"tools\\units\"\nGet-ChildItem $d | ForEach-Object { & $_.FullName }\n", "tools/units/w.ps1": "" }, ["lib/q.py", "lib/q.ps1"], "python tools/go.py && pwsh tools/go.ps1"],
  "  and the file's own folder, written nowhere: below it by ./ in what is no load, beside it by a call that finds it, at the root by a glob": [{ "scripts/run.mjs": "new Worker(new URL(`./${name}.mjs`, import.meta.url));\n", "scripts/sub/w.mjs": "", "tools/go.mjs": "const here = path.dirname(fileURLToPath(import.meta.url));\nfor (const f of readdirSync(here)) spawnSync(\"node\", [path.join(here, f)]);\n", "tools/sib.mjs": "", "top.sh": "" }, ["lib/q.mjs", "lib/q.sh"], "node scripts/run.mjs && node tools/go.mjs && for f in *.sh; do bash \"$f\"; done"],
  "a name that ends at a folder, a / after it, brings in every file below it": [{ "scripts/run.cjs": "require('./kit/');\n", "scripts/kit/index.js": "", "scripts/kit/deep/more.js": "" }, ["scripts/apart/index.js"], "node scripts/run.cjs"],
  "a name of fixed text and holes with neither / nor ., a folder whose own name is built so, and a name split over two strings name what fits": [{ "scripts/run.mjs": "spawnSync(\"node\", [\"unit-\" + n + EXT], { cwd });\nconst DIR = `kinds-${kind}`;\nfor (const f of readdirSync(DIR)) spawnSync(\"node\", [`${DIR}/${f}`]);\nrequire(\"../kit/hel\" + \"per.cjs\");\n", "packs/unit-b.mjs": "", "kinds-c/p.mjs": "", "kit/helper.cjs": "" }, ["apart/q.mjs"]],
  "a command in a string names its script with a hole, in a module and in what a package's file runs": [{ "scripts/run.mjs": "execSync(`node kinds/${n}.mjs`);\n", "kinds/p.mjs": "", "package.json": "{ \"scripts\": { \"test\": \"node --test checks/*.test.js\" } }\n", "checks/c.test.js": "" }, ["lib/q.mjs", "lib/b.test.js"]],
  "a name in a comment is read as one in code": [{ "scripts/run.mjs": "// see ../mods/noted.mjs\n/* and ../kit/kept.mjs */\n", "mods/noted.mjs": "", "kit/kept.mjs": "" }, ["lib/q.mjs"]],
  "  so no reader of comments loses its place: a load after a template inside a template, after a regular expression with a / in a class, or in a template after a lone backtick, is read": [{ "scripts/run.mjs": "const g = `${dir ? `${dir}/*` : \"*\"}.txt`;\nawait import(\"../kit/first.mjs\");\n/* a note */\n", "scripts/class.mjs": "const globs = list.filter((p) => /[/*?]/.test(p));\nawait import(\"../packs/second.mjs\");\n/* a note */\n", "scripts/tick.mjs": "const tick = /`/;\nawait import(`./units/${n}.mjs`);\n", "kit/first.mjs": "", "packs/second.mjs": "", "scripts/units/third.mjs": "" }, ["lib/q.mjs"], "node scripts/run.mjs && node scripts/class.mjs && node scripts/tick.mjs"],
  // the same names in other letters, other languages and other writings
  "a name is read in whatever letters it is written, a folder's and a file's": [{ "scripts/run.mjs": "const DIR = \"Kinds\";\nexport const run = (n) => import(path.join(root, DIR, n));\nawait import(\"../Kit/Start.mjs\");\n", "kinds/p.mjs": "", "kit/start.mjs": "" }, ["lib/q.mjs"]],
  "  and in the letters of any writing: a folder's, the fixed text of a built name, a file's with no ending, and a letter a tree keeps in two parts": [{ "scripts/run.mjs": "const DIR = \"\u0437\u0430\u0434\u0430\u0447\u0438\";\nfor (const f of readdirSync(DIR)) spawnSync(\"node\", [`${DIR}/${f}`]);\nspawnSync(\"bash\", [`\u0448\u0430\u0433-${n}.sh`]);\nspawnSync(\"\u043f\u0443\u0441\u043a\");\nconst MORE = \"\u0439\u043e\u0434\";\n", "\u0437\u0430\u0434\u0430\u0447\u0438/p.mjs": "", "apart/\u0448\u0430\u0433-a.sh": "", "aside/\u043f\u0443\u0441\u043a": "", "\u0438\u0306\u043e\u0434/p.mjs": "" }, ["lib/q.mjs"]],
  "  and a file that may run under a name no word can give is held, as one too large to read is": [{ "apart/(!)/p.sh": "", "aside/\u{1f4e6}": "" }, ["lib/q.sh"]],
  "a folder whose own name holds a space, set on one line and used on another, is taken whole": [{ "scripts/run.mjs": "const DIR = \"my kinds\";\nexport const run = (n) => spawnSync(\"node\", [path.join(root, DIR, n)]);\n", "my kinds/deep/p.mjs": "" }, ["lib/q.mjs"]],
  "a path whose last part names nothing in its folder, a name built there in a way the reader does not know, brings in the folder": [{ "tools/go.sh": "for f in tools/units/u-[ab]*.sh; do bash \"$f\"; done\n", "tools/units/u-a1.sh": "", "scripts/run.mjs": "spawnSync(\"node\", [render(\"packs/p-{{ n }}.mjs\", { n })]);\n", "packs/p-one.mjs": "" }, ["lib/q.mjs", "lib/q.sh"], "bash tools/go.sh && node scripts/run.mjs"],
  "a built name whose folders a backslash parts is read as one a / parts": [{ "tools/go.ps1": "& \"$PSScriptRoot\\un$kind-x\\w-$n.ps1\"\n", "tools/units-x/w-a.ps1": "" }, ["lib/q.ps1"], "pwsh tools/go.ps1"],
  "a hole is read as each language the reader reads writes it": [{ "tools/go.rb": "load \"un#{kind}/r-#{n}.rb\"\n", "tools/units/r-a.rb": "", "tools/go.cmd": "call pa%kind%\\b-%n%.cmd\n", "tools/packs/b-a.cmd": "", "tools/go.ps1": "& \"ki$env:KIND/p-$n.ps1\"\n", "tools/kinds/p-a.ps1": "", "tools/go.py": "runpy.run_path(\"mo%(kind)s/m-%(n)s.py\" % d)\n", "tools/mods/m-a.py": "" }, ["lib/q.rb"], "ruby tools/go.rb && tools/go.cmd && pwsh tools/go.ps1 && python tools/go.py"],
  "  and two holes of a format, a letter between them, stay two": [{ "tools/go.py": "runpy.run_path(\"mo%sx%s.py\" % (a, b))\n", "tools/kinds/mod-x-1.py": "" }, ["lib/q.py"], "python tools/go.py"],
  "strings joined as other languages join them make the one name, whole or built": [{ "tools/go.php": "require \"mo\" . $kind . \"/m-\" . $n . \".php\";\n", "tools/mods/m-a.php": "", "tools/go.lua": "dofile(\"pa\" .. kind .. \"/l-\" .. n .. \".lua\")\n", "tools/packs/l-a.lua": "" }, ["lib/q.php"], "php tools/go.php && lua tools/go.lua"],
  "a name written without the ending its language adds names its file": [{ "tools/go.rb": "require_relative \"../kit/helper\"\n", "kit/helper.rb": "", "tools/go.lua": "require(\"packs.loader\")\nrequire(\"mods\")\n", "tools/packs/loader.lua": "", "tools/mods/init.lua": "", "tools/go.ps1": "Import-Module ./units/Shared\n", "tools/units/shared.psm1": "" }, ["lib/helper.sh"], "ruby tools/go.rb && lua tools/go.lua && pwsh tools/go.ps1"],
  "a name of holes alone a workflow starts with ./ is read from the root, where its steps run": [{ "kinds/deep/p.sh": "" }, [], "for f in ./*/*/*.sh; do bash \"$f\"; done"],
};
for (const [what, [files, out, run = "node scripts/run.mjs"]] of Object.entries(classes)) {
  const got = setOf(tree({ ".github/workflows/w.yml": flow(run), ...files, ...Object.fromEntries(out.map((f) => [f, ""])) }));
  ok(Object.keys(files).every((f) => got.has(f)) && !out.some((f) => got.has(f)), what, show(got));
}
// each in a folder of its own, so that none joins by standing beside another
const outward = setOf(tree(Object.fromEntries(Object.entries({
  "a.mjs": "const h = await import(\"https\");\n", "b.mjs": "import axios from \"axios\";\n", "c.cjs": "const { Octokit } = require(\"@octokit/rest\");\n", "d.mjs": "import { request } from \"undici\";\n",
  "e.mjs": "import fetch from 'node-fetch';\n", "f.mjs": "import got from\n  \"got\";\n", "g.mjs": "export * from \"node:dns\";\n", "h.mjs": "const m = await import(name);\n",
  "i.mjs": "const t = \"import axios from 'axios'\";\n", "j.mjs": "const u = `${p}://x`; const m = await import(name);\n",
  "k.mjs": "import fs from \"node:fs\";\nimport { a } from \"./a.mjs\";\nBuffer.from(\"axios\");\nawait import(`./steps/${n}.mjs`);\n",
}).map(([name, text]) => [`${name[0]}/${name}`, text]))));
ok(show(outward) === "a/a.mjs, b/b.mjs, c/c.cjs, d/d.mjs, e/e.mjs, f/f.mjs, g/g.mjs, h/h.mjs, i/i.mjs, j/j.mjs",
  "a script that loads a module by a plain name that is no path and none of Node's own that stay on the machine calls out, by any form of load, as does one that loads by a name it builds, after a template that holds // too, and one whose load stands in a string, which a text cannot tell from code; Node's own and a path do not", show(outward));
ok(powered("on: push\npermissions:\n  contents:\n    write\n") && powered("on: push\npermissions:\n  \"contents\": &w write\n") && powered("on: push\npermissions:\n  contents: read\njobs:\n  a:\n    env:\n      K: ${{ SECRETS.KEY }}\n"),
  "a write permission on the line after its scope or after an anchor, and a secret written in capitals, give power");
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
write(ext, "docs/README", "one\n");
const extBase = save(ext, "base");
const fromGit = setOf(gitTree(extBase, ext)), fromDisk = setOf(diskTree(ext));
ok(["deploy", "helper", "bin/publish"].every((f) => fromGit.has(f)) && !fromGit.has("docs/README") && show(fromGit) === show(fromDisk),
  "read from a commit, files with no extension join the set as on disk: what a powered workflow runs, what that runs, and a #! script that pushes", `${show(fromGit)} | ${show(fromDisk)}`);
git(ext, "checkout", "-q", "-b", "pr");
write(ext, "docs/README", "two\n");
const extFirst = save(ext, "the readme");
write(ext, "helper", "#!/bin/sh\necho 2\n");
const extSecond = save(ext, "the helper");
write(ext, "docs/README", "three\n");
const extThird = save(ext, "the readme again");
const extCheckout = path.join(tmp, "ext-checkout");
git(tmp, "clone", "-q", "--branch", "main", ext, extCheckout);
write(tmp, "ext-pull.json", JSON.stringify({ head: { sha: extThird }, base: { sha: extBase } }));
write(tmp, "ext-commits.json", JSON.stringify([[extFirst, extSecond, extThird].map((s) => ({ sha: s, parents: [{ sha: git(ext, "rev-parse", `${s}^`) }] }))]));
write(tmp, "ext-files.json", JSON.stringify([[{ filename: "helper" }, { filename: "docs/README" }]]));
const extOut = spawnSync(process.execPath, [script, path.join(tmp, "ext-pull.json"), path.join(tmp, "ext-commits.json"), path.join(tmp, "ext-files.json"), extCheckout], { cwd: ext, env, encoding: "utf8" });
let extPrinted = null;
try { extPrinted = JSON.parse(extOut.stdout); } catch { /* (read below) */ }
ok(extOut.status === 0 && JSON.stringify(extPrinted) === JSON.stringify({ power: ["helper"], light: [extThird] }),
  "a commit that changes an executable with no extension, run by what a powered workflow runs, is not light, read from its own tree: the readme's after it is", extOut.stdout + extOut.stderr);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${count - failed} of ${count} passed`);
process.exit(failed ? 1 : 0);
