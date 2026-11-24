// Tests of copy-tree.mjs, the tree a project's copy of the core must be, and how two copies are compared (the purity
// check of a sync PR rests on it: pure-sync.mjs; core.yml compares the same way). In a scratch repository, against
// what `git archive` itself makes, as sync.mjs makes a copy; on Linux and on Windows. Git, tar and Node's own modules
// only.
//
//   node tests/copy-tree-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KEPT, copyTree, coreIsFolder, entries, executable, recordModes } from "../scripts/copy-tree.mjs";
import { untar } from "../scripts/releases.mjs";
import { install } from "../scripts/sync.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${detail}`}`); } };

const tmp = scratchDir("copy-tree-test-");
// (git's own variables that point at a repository are left out, so every call lands in the scratch one)
const outer = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|COMMON_DIR)$/i.test(name)));
// (copy-tree.mjs calls git with this process's own variables, so they are set here, not handed to each call)
for (const name of Object.keys(process.env)) if (!(name in outer)) delete process.env[name];
// (and git finds no bare repository by itself, as Git 3.0 has it by default: the scripts name each one they make)
Object.assign(process.env, { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid", GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.bareRepository", GIT_CONFIG_VALUE_0: "explicit" });
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const core = path.join(tmp, "core"), repo = path.join(core, ".git"); // (copy-tree.mjs takes the git folder)
const write = (file, text) => { fs.mkdirSync(path.dirname(path.join(core, file)), { recursive: true }); fs.writeFileSync(path.join(core, file), text); };
// a commit of the scratch core whose .gitattributes is `attributes`
let n = 0;
const commit = (attributes) => {
  write(".gitattributes", attributes);
  git(core, "add", "-A");
  git(core, "commit", "-q", "-m", `commit ${++n}`);
  return git(core, "rev-parse", "HEAD");
};
// the tree of the copy `git archive` makes of a commit, as the sync script makes it
const archived = (pin) => {
  const out = fs.mkdtempSync(path.join(tmp, "copy-"));
  git(out, "init", "-q");
  // ("-f -": Windows' own tar reads a tape drive unless told to read its input)
  execFileSync("tar", ["-x", "-f", "-"], { cwd: out, input: execFileSync("git", ["archive", pin], { cwd: core, maxBuffer: 1 << 26 }) });
  git(out, "add", "-A");
  return git(out, "write-tree");
};
const whole = (pin) => git(core, "rev-parse", `${pin}^{tree}`);
const paths = (tree) => git(core, "ls-tree", "-r", "--name-only", tree).split("\n");

git(tmp, "init", "-q", "-b", "main", core);
write("floor/rules.md", "rules\n");
write("floor/reports/nested.md", "a folder of that name deeper down stays\n");
write("reportsx/near.md", "a name that only starts the same stays\n");
write("reports/one.md", "the core's own\n");
write("reports/deep/two.md", "the core's own\n");
write("words/items-001.md", "the owner's own words\n");
write("tests/one-test.mjs", "the core's own tests\n");

const before = commit("* -text\n");
ok(copyTree(before, repo) === whole(before), "a pin from before the line: the whole tree");
ok(archived(before) === whole(before), "  and that is what git archive copies");

const pin = commit("* -text\n/reports export-ignore\n");
const tree = copyTree(pin, repo);
ok(tree === archived(pin), "a pin with the line: exactly the tree git archive copies", `${tree} against ${archived(pin)}`);
ok(tree !== whole(pin), "  which is not the whole tree");
ok(!paths(tree).some((p) => p.startsWith("reports/")), "  the folder at the top is out");
ok(["floor/reports/nested.md", "reportsx/near.md", ".gitattributes"].every((p) => paths(tree).includes(p)), "  a folder of that name deeper down, a name that starts the same and .gitattributes stay");

ok(paths(tree).includes("words/items-001.md"), "  and a folder its own line does not name stays");
const both = commit("* -text\n/reports export-ignore\n/words export-ignore\n");
const bothTree = copyTree(both, repo);
ok(bothTree === archived(both) && !paths(bothTree).some((p) => p.startsWith("reports/") || p.startsWith("words/")), "a pin with both lines: neither folder, exactly as git archive copies (#252)", `${bothTree} against ${archived(both)}`);
const wordsOnly = commit("* -text\n/words export-ignore\n");
ok(copyTree(wordsOnly, repo) === archived(wordsOnly) && paths(copyTree(wordsOnly, repo)).includes("reports/one.md"), "a pin with the words line alone: that folder out, reports kept");
// the core's tests (#527): known before any pin holds their line, so a pin without it keeps them, as every release did
ok(paths(bothTree).includes("tests/one-test.mjs"), "a pin without the tests line keeps tests/ (#527)");
const all = commit("* -text\n/reports export-ignore\n/words export-ignore\n/tests export-ignore\n");
const allTree = copyTree(all, repo);
ok(allTree === archived(all) && !paths(allTree).some((p) => /^(reports|words|tests)\//.test(p)), "a pin with the tests line too: none of the three, exactly as git archive copies (#527)", `${allTree} against ${archived(all)}`);

// any other spelling of the line: the whole tree, so only a copy that still holds the folder can equal it
for (const [what, attributes] of [
  ["two spaces", "/reports  export-ignore\n"],
  ["a tab", "/reports\texport-ignore\n"],
  ["a space before it", " /reports export-ignore\n"],
  ["a space after it", "/reports export-ignore \n"],
  ["another attribute beside it", "/reports export-ignore -text\n"],
  ["no leading slash", "reports export-ignore\n"],
  ["a trailing slash", "/reports/ export-ignore\n"],
  ["another folder", "/floor export-ignore\n"],
  ["a Windows line ending", "/reports export-ignore\r\n"],
  ["the words folder's, a space after it", "/words export-ignore \n"],
  ["the tests folder's, a trailing slash", "/tests/ export-ignore\n"],
]) {
  const other = commit(`* -text\n${attributes}`);
  ok(copyTree(other, repo) === whole(other), `the line with ${what}: the whole tree`);
}

// modes and kinds of entry come through as they are: an executable file and a link, written to the index alone
git(core, "update-index", "--add", "--cacheinfo", `100755,${git(core, "hash-object", "-w", "floor/rules.md")},scripts/run.sh`);
git(core, "update-index", "--add", "--cacheinfo", `120000,${git(core, "hash-object", "-w", "floor/rules.md")},link`);
write(".gitattributes", "* -text\n/reports export-ignore\n");
git(core, "add", ".gitattributes");
git(core, "commit", "-q", "-m", "modes");
const modes = git(core, "rev-parse", "HEAD");
const listed = (rev) => git(core, "ls-tree", "-r", rev).split("\n");
ok(JSON.stringify(listed(copyTree(modes, repo))) === JSON.stringify(listed(modes).filter((line) => !line.split("\t")[1].startsWith("reports/"))),
  "an executable file and a link keep their modes; every entry but the folder's is the pin's own");

// how two copies are compared (core.yml compares the same way): by git's object ids and types, the executable bit aside
const blob = git(core, "hash-object", "-w", "floor/rules.md");
const treeOf = (...lines) => execFileSync("git", ["mktree", "--missing"], { cwd: core, input: lines.map((l) => `${l}\n`).join(""), encoding: "utf8" }).trim();
const plain = treeOf(`100644 blob ${blob}\trun.sh`);
ok(entries(treeOf(`100755 blob ${blob}\trun.sh`), repo) === entries(plain, repo), "a file the copy records 100644 where the core's is 100755 is the same file: the executable bit is no difference");
ok(JSON.stringify(executable(modes, repo)) === JSON.stringify(["scripts/run.sh"]) && !executable(plain, repo).length, "  the files a tree marks executable are read from it, the link and every file of 100644 left out (pure-sync.mjs refuses a bit the core does not mark)");
// the sync records the bits the core marks on a plain file of the copy, never through a link below its folder (#1189)
if (process.platform !== "win32") {
  const project = path.join(tmp, "project"), outside = path.join(tmp, "outside");
  fs.mkdirSync(path.join(project, "core/scripts"), { recursive: true }); fs.mkdirSync(outside);
  fs.writeFileSync(path.join(project, "core/scripts/run.sh"), "x"); fs.writeFileSync(path.join(outside, "run.sh"), "x");
  fs.chmodSync(path.join(outside, "run.sh"), 0o644); git(project, "init", "-q");
  const here = process.cwd(); process.chdir(project);
  try {
    recordModes("core", modes, repo);
    ok((fs.statSync("core/scripts/run.sh").mode & 0o111) && git(project, "ls-files", "-s", "core/scripts/run.sh").startsWith("100755 "), "the sync gives a file the core marks executable its bit, on disk and in the index");
    fs.rmSync("core/scripts", { recursive: true }); fs.symlinkSync(outside, "core/scripts");
    recordModes("core", modes, repo);
    ok(!(fs.statSync(path.join(outside, "run.sh")).mode & 0o111), "  and never through a link to a folder outside the copy, a folder of it that is a link");
  } finally { process.chdir(here); }
}
ok(entries(treeOf(`120000 blob ${blob}\trun.sh`), repo) !== entries(plain, repo), "a link in its place is not");
ok(entries(treeOf(`160000 commit ${modes}\trun.sh`), repo) !== entries(plain, repo), "nor a submodule");
ok(entries(treeOf(`100644 blob ${git(core, "hash-object", "-w", "reports/one.md")}\trun.sh`), repo) !== entries(plain, repo), "nor a file of other content");
ok(entries(treeOf(`100644 blob ${blob}\trun.sh`, `100644 blob ${blob}\textra.md`), repo) !== entries(plain, repo), "nor a copy with a file more");
// (a name holding a line's end and what looks like a second entry is one entry, quoted, never two)
const two = treeOf(`100644 blob ${blob}\ta.md`, `100644 blob ${blob}\tb.md`);
const one = execFileSync("git", ["mktree", "-z", "--missing"], { cwd: core, input: `100644 blob ${blob}\ta.md\n100644 blob ${blob}\tb.md\0`, encoding: "utf8" }).trim();
ok(entries(one, repo) !== entries(two, repo) && entries(one, repo).split("\n").length === 1, "a name that reads as two entries is one, quoted as git quotes it", entries(one, repo));

// whether core/ is a folder: never a submodule's pointer, even one whose id names a tree
// (built through an index of its own, which takes a submodule's pointer to any id, as a pushed commit can hold one)
const folder = (mode, id) => {
  const env = { ...process.env, GIT_INDEX_FILE: path.join(tmp, `index-${++n}`) };
  execFileSync("git", ["update-index", "--add", "--cacheinfo", `${mode},${id},core`], { cwd: core, env });
  const top = execFileSync("git", ["write-tree", "--missing-ok"], { cwd: core, env, encoding: "utf8" }).trim();
  return coreIsFolder(git(core, "commit-tree", top, "-m", "probe"), repo);
};
const inner = treeOf(`100644 blob ${blob}\trun.sh`);
ok(coreIsFolder(git(core, "commit-tree", treeOf(`040000 tree ${inner}\tcore`), "-m", "folder"), repo), "core/ as a folder is one");
ok(!folder("160000", inner), "a submodule's pointer named core, whose id is a tree, is none");
ok(!folder("100644", blob) && !folder("120000", blob), "nor a file or a link named core");
ok(!coreIsFolder(git(core, "commit-tree", plain, "-m", "none"), repo), "nor a commit with no core at all");

// one list, read in two places: core.yml's loop names the folders KEPT names, in its order, and each line of the core's
// own .gitattributes that keeps a folder here names one of them (else every project's check of its copy fails)
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const loop = fs.readFileSync(path.join(root, ".github/workflows/core.yml"), "utf8").match(/^\s*for kept in ([^;]*); do$/m);
ok(loop && loop[1].trim() === KEPT.join(" "), "core.yml's loop names exactly the folders copy-tree.mjs keeps out", loop ? loop[1] : "no loop found");
const lines = fs.readFileSync(path.join(root, ".gitattributes"), "utf8").split("\n").filter((line) => !/^[ \t\r]*#/.test(line) && /export-ignore/.test(line)); // (a comment, which git reads as none, may name it: "#" after spaces, tabs or carriage returns alone, as git skips them)
ok(lines.every((line) => KEPT.some((name) => line === `/${name} export-ignore`)), "each export-ignore line of the core's .gitattributes names a folder both know, spelled as both read it", lines.join(" | "));
// the core's own tests stand in tests/, which the copy leaves out (#527): one anywhere else would travel into every
// project's copy, so every file a test's name ends in is under it, and tests/ holds nothing a project runs
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
const astray = tracked.filter((file) => /-test\.mjs$/.test(file) && !file.startsWith("tests/"));
ok(lines.includes("/tests export-ignore") && astray.length === 0, "every test of the core's own scripts is under tests/, which the copy leaves out (#527)", astray.join(" "));
// (and the other way round: a file of another name under tests/, which a script a project runs might import, would be
// missing from every copy, #614; but tests/mutation/, which pins the core's own mutation tool for its own workflow
// (#581), holds its package files and no code a script could import)
const tool = (file) => /^tests\/mutation\/(?:package\.json|package-lock\.json|\.npmrc)$/.test(file);
const strays = tracked.filter((file) => file.startsWith("tests/") && !/^tests\/[^/]+-test\.mjs$/.test(file) && !tool(file));
ok(strays.length === 0, "tests/ holds the core's tests alone, and the package files of the core's own mutation tool, so nothing a project runs can lean on a file the copy leaves out (#614)", strays.join(" "));

// the core's archive unpacked into a folder whose path tar would misread were it given: GNU tar unquotes a backslash's
// escape in it (`kits\now` as Windows writes the path, a line's end), and Windows' own tar knows no --force-local (#1212)
{
  const tmp = scratchDir("untar-"), from = path.join(tmp, "from");
  fs.mkdirSync(from);
  fs.writeFileSync(path.join(from, "f"), "unpacked\n");
  const into = process.platform === "win32" ? path.join(tmp, "kits", "now") : path.join(tmp, "kits\\now", "a:b");
  fs.mkdirSync(into, { recursive: true });
  let read = null;
  try { untar(into, execFileSync("tar", ["-c", "-f", "-", "f"], { cwd: from })); read = fs.readFileSync(path.join(into, "f"), "utf8"); } catch (e) { read = String(e.stderr ?? e); }
  ok(read === "unpacked\n", "an archive is unpacked into a folder whose path holds a backslash's escape and a colon", read);
}

// the note a sync prints where the copy's packages cannot be installed says so and gives its mend, with no line of the
// installer's own, which can name a path of the machine and goes into the sync pull request's description (#1200)
{
  const dir = path.join(tmp, "install-copy");
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.writeFileSync(path.join(dir, "scripts", "install.mjs"), 'console.error("install error A complete log of this run can be found in: /home/someone/.npm/_logs/x-debug-0.log"); process.exit(1);\n');
  const said = []; const log = console.log; console.log = (...a) => said.push(a.join(" "));
  try { install(dir); } finally { console.log = log; }
  const note = said.join("\n");
  ok(/not installed/.test(note) && / Mend: .*install\.mjs/.test(note) && !/someone|_logs|install error/.test(note), "a failing install leaves the installer's own line, and the path in it, out of the sync's note, which still says it failed and its mend", note);
}

console.log(failed ? `${failed} of ${count} failed` : `all ${count} passed`);
process.exit(failed ? 1 : 0);
