// Tests of what runs with power and which later commits touch none of it (power.mjs, #1134, points 1 and 4): the set
// read from a tree held in memory (each seed, every file that may run beside one, and what stays out), the light commits read with
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
const crlf = setOf(tree({ ".github/workflows/c.yml": "on: push\r\npermissions:\r\n  contents: write\r\njobs: {}\r\n", "scripts/run.cjs": "console.log(1);\r\n" }));
ok(show(crlf) === ".github/workflows/c.yml, scripts/run.cjs", "a workflow written with CRLF line ends is a seed, as with LF", show(crlf));
// a workflow given the secrets whole is powered, as one given one by name; one that names only the token is not
ok(powered("on: push\npermissions:\n  contents: read\njobs:\n  a:\n    env:\n      ALL: ${{ toJSON(secrets) }}\n") && powered("on:\n  workflow_call:\n    secrets:\n      KEY:\npermissions: {}\n")
  && !powered("on: push\npermissions:\n  contents: read\njobs:\n  a:\n    env:\n      T: ${{ secrets.GITHUB_TOKEN }}\n"),
"a workflow given the secrets whole, or declaring one it is called with, is powered; one given only the job's token is not");
ok(powered("on: push\npermissions:\n  contents:\n    write\n") && powered("on: push\npermissions:\n  \"contents\": &w write\n") && powered("on: push\npermissions:\n  contents: read\njobs:\n  a:\n    env:\n      K: ${{ SECRETS.KEY }}\n"),
  "a write permission on the line after its scope or after an anchor, and a secret written in capitals, give power");
// with a seed, every file that may run is in the set, whatever names it or none
const fetches = "await fetch(\"https://example.invalid\");\n";
const files = {
  ".github/workflows/powered.yml": "on: push\npermissions:\n  issues: write\njobs:\n  a:\n    steps:\n      - run: echo hi\n",
  ".github/workflows/readonly.yml": "on: push\npermissions:\n  contents: read\njobs:\n  a:\n    steps:\n      - run: node scripts/plain.mjs\n",
  "scripts/plain.mjs": "console.log(1);\n", "scripts/deep/far/unnamed.mjs": "export default 1;\n", "tools/go.py": "print(1)\n", "tools/b.sh": "echo 1\n", "lib/x.rb": "puts 1\n",
  "scripts/calls.mjs": fetches, "scripts/pushes.sh": "git push origin HEAD\n", "scripts/unread.py": null,
  ".claude/settings.json": "{}\n", "tools/act/action.yml": "runs:\n  using: node20\n  main: index.js\n",
  "core/scripts/calls.mjs": fetches, "vendored/core/scripts/calls.mjs": fetches,
  "deploy": "#!/bin/sh\necho deploying\n", "bin/publish": "#!/usr/bin/env bash\ngit push origin HEAD\n", "bin/notes": "git push is described here, with no #! line\n",
  "src/App.cs": "class App {}\n", "src/App.csproj": "<Project />\n", "cmd/main.go": "package main\n", "web/page.html": "<script src=\"a.js\"></script>\n",
  "README.md": "node scripts/plain.mjs\n", "config/list.json": "[\"scripts/plain.mjs\"]\n", "config/set.yaml": "a: 1\n", "notes.txt": "x\n", "docs/picture.png": null,
};
const why = new Map();
const set = setOf({ ...tree(files), copy: "vendored/core/" }, why);
const want = [".claude/settings.json", ".github/workflows/powered.yml", "bin/notes", "bin/publish", "cmd/main.go", "core/scripts/calls.mjs", "deploy", "lib/x.rb", "scripts/calls.mjs", "scripts/deep/far/unnamed.mjs",
  "scripts/plain.mjs", "scripts/pushes.sh", "scripts/unread.py", "src/App.cs", "src/App.csproj", "tools/act/action.yml", "tools/b.sh", "tools/go.py", "web/page.html"];
ok(show(set) === want.join(", "), "with a seed, every file that may run is in the set: a script, an action, a compiled language's source, a project file, a page, a file with no extension; text, data, pictures and a read-only workflow are not", show(set));
ok(why.get(".github/workflows/powered.yml") === "power" && why.get(".claude/settings.json") === "place" && why.get("tools/act/action.yml") === "place"
  && why.get("scripts/calls.mjs") === "calls" && why.get("scripts/pushes.sh") === "calls" && why.get("bin/publish") === "calls" && why.get("scripts/unread.py") === "unread"
  && why.get("scripts/plain.mjs") === "runs" && why.get("deploy") === "runs" && why.get("bin/notes") === "runs",
"each says what brought it in: a seed's power, place, calls or unread, or runs, a file that may run beside a seed", JSON.stringify([...why]));
ok(set.has("core/scripts/calls.mjs") && !set.has("vendored/core/scripts/calls.mjs"), "the copy at the path the manifest names is left out, and a folder core/ that is not the copy is read");
ok(setOf(tree(files)).has("vendored/core/scripts/calls.mjs"), "where no manifest names a copy, as in the core's own repository, nothing is left out");
// each seed alone brings in every file that may run; with none, the set is empty
const seeds = {
  "a powered workflow": [".github/workflows/w.yml", "on: push\npermissions:\n  contents: write\n"],
  "a workflow with no top-level permissions": [".github/workflows/w.yml", "on: push\njobs: {}\n"],
  "an action": ["act/action.yaml", "runs:\n  using: composite\n"],
  "a file of .claude/": [".claude/hooks.json", "{}\n"],
  "a file that runs by itself beyond .github/": ["package.json", "{}\n"],
  "a script that calls out": ["x.py", "import urllib.request\n"],
  "a script that loads a package": ["x.mjs", "import axios from \"axios\";\n"],
  "a #! file that pushes": ["publish", "#!/bin/sh\ngit push\n"],
  "a script that cannot be read": ["x.sh", null],
};
for (const [what, [seed, text]] of Object.entries(seeds)) {
  const got = setOf(tree({ [seed]: text, "scripts/a.mjs": "", "tools/b.sh": "", "README.md": "", "data.json": "{}" }));
  ok(got.has(seed) && got.has("scripts/a.mjs") && got.has("tools/b.sh") && !got.has("README.md") && !got.has("data.json"), `${what} is a seed that brings in every file that may run, and nothing else`, show(got));
}
for (const [name, text] of [["x.py", "import socket"], ["x.rb", "Net::HTTP.get(u)"], ["x.go", "import \"net/http\""], ["X.cs", "new HttpClient()"], ["X.java", "import java.net.URL;"], ["x.rs", "reqwest::get(u)"], ["x.sh", "rsync -a o/ h:o/"]])
  ok(setOf(tree({ [name]: text })).has(name), `${name} on \`${text}\` calls out, a seed`);
const unseeded = setOf(tree({ ".github/workflows/r.yml": "on: push\npermissions:\n  contents: read\njobs:\n  a:\n    steps:\n      - run: node scripts/a.mjs\n", "scripts/a.mjs": "// await fetch(url) in a comment runs nothing\nconsole.log(1);\n", "deploy": "#!/bin/sh\necho 1\n", "README.md": "git push\n" }));
ok(unseeded.size === 0, "with no seed (a workflow that may only read, a script whose call stands only in a comment, a #! file that calls nothing), the set is empty", show(unseeded));
// what calls out, read by why: the files with no seed of their own join beside the others
const esm = new Map();
setOf(tree({ "scripts/get.mjs": "import { get } from 'http';\nget(url);\n", "scripts/tls.mjs": "import https from \"https\";\n", "scripts/text.mjs": "console.log(\"from http\");\n" }), esm);
ok(esm.get("scripts/get.mjs") === "calls" && esm.get("scripts/tls.mjs") === "calls" && esm.get("scripts/text.mjs") === "runs", "a bare ESM import of a network module calls out; a word does not", JSON.stringify([...esm]));
const outward = new Map();
setOf(tree({
  "a.mjs": "const h = await import(\"https\");\n", "b.mjs": "import axios from \"axios\";\n", "c.cjs": "const { Octokit } = require(\"@octokit/rest\");\n", "d.mjs": "import { request } from \"undici\";\n",
  "e.mjs": "import fetch from 'node-fetch';\n", "f.mjs": "import got from\n  \"got\";\n", "g.mjs": "export * from \"node:dns\";\n", "h.mjs": "const m = await import(name);\n",
  "i.mjs": "import fs from \"node:fs\";\nimport { a } from \"./a.mjs\";\nconst t = \"import axios from 'axios'\";\nBuffer.from(\"axios\");\nawait import(`./steps/${n}.mjs`);\n",
}), outward);
ok([..."abcdefgh"].every((f) => outward.get(`${f}.${f === "c" ? "cjs" : "mjs"}`) === "calls") && outward.get("i.mjs") === "runs",
  "a script that loads a module by a plain name that is no path and none of Node's own that stay on the machine calls out, by any form of load, as does one that loads by a name it builds; Node's own, a path, and a load inside a string do not", JSON.stringify([...outward]));
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
const cloned = (from, to) => (execFileSync("git", ["clone", "-q", "-n", "-b", "main", "--", ".", to], { cwd: from }), git(to, "reset", "-q", "--hard"), to);
const write = (dir, f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
const save = (dir, message) => { git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", message); return git(dir, "rev-parse", "HEAD"); };
const init = (name) => { git(tmp, "init", "-q", "-b", "main", name); return path.join(tmp, name); };
const repo = init("repo");
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
const checkout = cloned(repo, path.join(tmp, "checkout"));
write(tmp, "pull.json", JSON.stringify({ head: { sha: fourth }, base: { sha: base } }));
write(tmp, "commits.json", JSON.stringify([listed]));
write(tmp, "files.json", JSON.stringify([[{ filename: "scripts/run.mjs" }, { filename: "README.md" }, { filename: "notes.md", previous_filename: ".github/workflows/w.yml" }]]));
const rest = [path.join(tmp, "commits.json"), path.join(tmp, "files.json"), checkout];
const run = (args, extra = {}) => spawnSync(process.execPath, [script, ...args], { cwd: repo, env: { ...env, ...extra }, encoding: "utf8" });
const out = run([path.join(tmp, "pull.json"), ...rest]);
let printed = null;
try { printed = JSON.parse(out.stdout); } catch { /* (read below) */ }
ok(out.status === 0 && JSON.stringify(printed) === JSON.stringify({ power: [".github/workflows/w.yml", "scripts/run.mjs"], light: [fourth, second] }),
  "run in a clone, it prints the files that run with power, by either name, and the light commits, the newest first: the readme and the note, not the scripts", out.stdout + out.stderr);
const late = run([path.join(tmp, "pull.json"), path.join(tmp, "commits.json"), path.join(tmp, "files.json"), checkout], { DEADLINE: "1" });
ok(late.status === 0 && JSON.parse(late.stdout).light.length === 0, "past its deadline, it reads none light, so each review is asked as before", late.stdout + late.stderr);
write(tmp, "elsewhere.json", JSON.stringify({ head: { sha: sha(7) } }));
const missing = run([path.join(tmp, "elsewhere.json"), ...rest]);
ok(missing.status === 1 && mended(missing.stderr) && /could not read the head/u.test(missing.stderr), "a head the clone does not hold fails, saying the mend", missing.stderr);
write(tmp, "bad.json", "{");
const bad = run([path.join(tmp, "bad.json"), ...rest]);
ok(bad.status === 1 && mended(bad.stderr), "a file that is no JSON fails, saying the mend", bad.stderr);
write(tmp, "headless.json", "{}");
const headless = run([path.join(tmp, "headless.json"), ...rest]);
ok(headless.status === 1 && mended(headless.stderr) && /no head commit/u.test(headless.stderr), "a pull request with no head fails, saying the mend", headless.stderr);
ok(run([]).status === 2, "with no arguments it prints its usage");
const list = run(["--list", checkout]);
ok(list.status === 0 && list.stdout === ".github/workflows/w.yml\tpower\nscripts/run.mjs\truns\n", "--list prints a folder's set, each path with what brought it in", list.stdout + list.stderr);
const nowhere = run(["--list", path.join(tmp, "nowhere")]);
ok(nowhere.status === 1 && mended(nowhere.stderr), "--list of a folder that is not there fails, saying the mend", nowhere.stderr);

// Files with no extension, read from a commit as from disk: beside a powered workflow, `./deploy`, `./helper` and
// `bin/publish` may run.
const ext = init("ext");
write(ext, ".github/workflows/d.yml", "on: push\npermissions:\n  issues: write\njobs:\n  a:\n    steps:\n      - run: ./deploy\n");
write(ext, "deploy", "#!/bin/sh\n./helper\n");
write(ext, "helper", "#!/bin/sh\necho 1\n");
write(ext, "bin/publish", "#!/usr/bin/env bash\ngit push origin HEAD\n");
write(ext, "README.md", "one\n");
const extBase = save(ext, "base");
const fromGit = setOf(gitTree(extBase, ext)), fromDisk = setOf(diskTree(ext));
ok(["deploy", "helper", "bin/publish"].every((f) => fromGit.has(f)) && !fromGit.has("README.md") && show(fromGit) === show(fromDisk),
  "read from a commit, files with no extension join the set as on disk, beside a seed; a Markdown file does not", `${show(fromGit)} | ${show(fromDisk)}`);
git(ext, "checkout", "-q", "-b", "pr");
write(ext, "README.md", "two\n");
const extFirst = save(ext, "the readme");
write(ext, "helper", "#!/bin/sh\necho 2\n");
const extSecond = save(ext, "the helper");
write(ext, "README.md", "three\n");
const extThird = save(ext, "the readme again");
const extCheckout = cloned(ext, path.join(tmp, "ext-checkout"));
write(tmp, "ext-pull.json", JSON.stringify({ head: { sha: extThird }, base: { sha: extBase } }));
write(tmp, "ext-commits.json", JSON.stringify([[extFirst, extSecond, extThird].map((s) => ({ sha: s, parents: [{ sha: git(ext, "rev-parse", `${s}^`) }] }))]));
write(tmp, "ext-files.json", JSON.stringify([[{ filename: "helper" }, { filename: "README.md" }]]));
const extOut = spawnSync(process.execPath, [script, path.join(tmp, "ext-pull.json"), path.join(tmp, "ext-commits.json"), path.join(tmp, "ext-files.json"), extCheckout], { cwd: ext, env, encoding: "utf8" });
let extPrinted = null;
try { extPrinted = JSON.parse(extOut.stdout); } catch { /* (read below) */ }
ok(extOut.status === 0 && JSON.stringify(extPrinted) === JSON.stringify({ power: ["helper"], light: [extThird] }),
  "a commit that changes a file with no extension beside a seed is not light, read from its own tree: the readme's after it is", extOut.stdout + extOut.stderr);

// A submodule's pointer (a gitlink), read from a commit, may run beside a seed whatever its name ends in; a commit that
// moves it is not light. A tab's name, in the index alone (Windows refuses one).
const sub = init("sub");
write(sub, ".github/workflows/p.yml", "on: push\npermissions:\n  contents: write\njobs:\n  a:\n    steps:\n      - run: node vendor/tool.md/run.mjs\n");
write(sub, "README.md", "one\n");
git(sub, "add", "-A");
git(sub, "-c", "core.protectNTFS=false", "update-index", "--add", "--cacheinfo", `160000,${sha(1)},vendor/tool.md`, "--cacheinfo", `100644,${git(sub, "rev-parse", ":README.md")},scripts/a\tb.sh`);
git(sub, "commit", "-q", "-m", "base");
const subBase = git(sub, "rev-parse", "HEAD");
git(sub, "update-index", "--cacheinfo", `160000,${sha(2)},vendor/tool.md`);
git(sub, "commit", "-q", "-m", "moved");
const subMoved = git(sub, "rev-parse", "HEAD");
const subWhy = new Map(), subSet = setOf(gitTree(subMoved, sub), subWhy);
const subChanged = (parent, at) => git(sub, "diff-tree", "-r", "--no-renames", "--name-only", parent, at).split("\n").filter(Boolean);
ok(subWhy.get("vendor/tool.md") === "runs" && subWhy.get("scripts/a\tb.sh") === "runs" && !subSet.has("README.md")
  && lightOf([commit(subBase, sha(0)), commit(subMoved, subBase)], { setAt: (at) => setOf(gitTree(at, sub)), changed: subChanged }).length === 0,
  "read from a commit, a submodule's pointer joins the set beside a seed, whatever its name ends in, and a commit that moves it is not light; a name with a tab is read whole", JSON.stringify([...subWhy]));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${count - failed} of ${count} passed`);
process.exit(failed ? 1 : 0);
