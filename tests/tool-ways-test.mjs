// What stands on the way to an agent tool's files: a tool's folder of instructions that is a link, or a file there that
// is one, is listed where it leads, in the work tree and at a commit alike, and nothing outside the project is listed
// (rule-files.mjs, toolFiles), a folder that leads to the root holding every file there, and each link of a chain to a
// tool's or floor file is listed with it, each on the way to a tool's folder named (wayLinks), by the shared readers and
// by the callers that bring readers of their own; a rule file by its name holds every agent tool's own folder (RULES);
// an entry file inside a submodule, or reached through a link into one, stands but is not read, and a tool's folder a
// submodule holds fails (entry-files.mjs). Each case in a scratch repository.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { RULES, inToolFolder, placeAt, readAt, ruleFiles, toolFiles, toolFolders, wayLinks } from "../scripts/rule-files.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";
import { ownHolders } from "../scripts/holders-own.mjs";
import { ruleTexts } from "../scripts/steps-kit.mjs";

let count = 0, failed = 0;
const ok = (cond, what) => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}`); } };
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts/entry-files.mjs");
const repo = prefix => {
  const dir = scratchDir(prefix);
  const git = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  git("init", "-q"); git("config", "user.email", "x@example.invalid"); git("config", "user.name", "x"); git("config", "commit.gpgsign", "false");
  const write = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
  const link = (to, f) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.symlinkSync(to, path.join(dir, f)); };
  return { dir, git, write, link };
};

// ---- a tool's folder, or a file in it, that is a link ----
{
  const { dir, git, write, link } = repo("tool-ways-");
  const away = `${dir}-away`;
  const was = process.cwd();
  try {
    fs.mkdirSync(path.join(away, "agents"), { recursive: true }); fs.writeFileSync(path.join(away, "agents/x.md"), "away\n");
    write("SECURITY.md", "**the rule files:** `docs/t.md`;\n");
    write("docs/kiro/steering/a.md", "a\n"); link("docs/kiro", ".kiro");
    write("docs/steer/b.md", "b\n"); link("../docs/steer", ".agents/rules");
    write("docs/f/c.md", "c\n"); link("../../docs/f/c.md", ".agent/rules/c.md");
    link(path.join(away, "agents"), "docs/kiro/agents");
    write("docs/claude.md", "@AGENTS.md\n"); link("docs/claude.md", "CLAUDE.md"); write("docs/agents.md", "a\n"); link("docs/agents.md", "AGENTS.md");
    git("add", "-A"); git("commit", "-qm", "links");
    const want = ["docs/kiro/steering/a.md", "docs/steer/b.md", ".agent/rules/c.md", "docs/f/c.md"];
    const outside = l => l.some(f => f.includes("x.md") || f.startsWith("..") || path.isAbsolute(f));
    const tree = git("ls-tree", "-r", "--name-only", "-z", "HEAD").split("\0").filter(Boolean);
    process.chdir(dir);
    const here = toolFiles(), rules = ruleFiles(undefined, undefined, { tools: true }), bare = ruleFiles();
    const at = toolFiles(readAt("HEAD"), d => tree.filter(f => f.startsWith(`${d}/`)));
    const rulesAt = ruleFiles(readAt("HEAD"), d => tree.filter(f => f.startsWith(`${d}/`)), { tools: true });
    process.chdir(was);
    ok(want.every(f => here.includes(f)), `in the work tree, a tool's folder that is a link, or one on its way, is listed where it leads, and a file there that is a link with the file it leads to (${here.join(", ")})`);
    ok(want.every(f => rules.includes(f)), "and so the rule files a check reads with the tools' files hold them");
    ok(!outside(here) && !outside(rules), "while a tool's folder made a link that leads out of the project lists nothing outside it");
    ok(want.every(f => at.includes(f)) && !outside(at), `at a commit, read through readAt, the same (${at.join(", ")})`);
    ok(["CLAUDE.md", "docs/claude.md", "AGENTS.md", "docs/agents.md"].every(f => rules.includes(f) && rulesAt.includes(f)) && !bare.includes("docs/agents.md"),
      "an entry file or a floor file that is a link is a rule file with the file it leads to, in the work tree and at a commit, where the tools' files are read (as the code-review wait reads them), and the floor's target not without them");
    const plain = toolFiles(f => (tree.includes(f) ? "" : null), d => tree.filter(f => f.startsWith(`${d}/`)));
    ok(plain.join() === "CLAUDE.md,.agent/rules/c.md", "a reader that says nothing of where a path leads lists each folder as it is named, as before");
  } finally { process.chdir(was); fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(away, { recursive: true, force: true }); }
}

// ---- a tool's folder that leads to the project's root, and a file added where a folder leads ----
{
  const { dir, git, write, link } = repo("tool-ways-root-");
  const was = process.cwd();
  try {
    write("SECURITY.md", "**the rule files:** `docs/t.md`;\n"); write("README.md", "r\n"); write("QUEUE.md", "q\n");
    link("..", ".kiro/steering"); write("docs/steer/b.md", "b\n"); link("../docs/steer", ".agents/rules");
    git("add", "-A"); git("commit", "-qm", "root");
    const tree = git("ls-tree", "-r", "--name-only", "-z", "HEAD").split("\0").filter(Boolean);
    process.chdir(dir);
    const here = toolFiles(), folders = toolFolders();
    const at = toolFiles(readAt("HEAD"), d => tree.filter(f => d === "." || f.startsWith(`${d}/`)));
    process.chdir(was);
    ok(["README.md", "QUEUE.md"].every(f => here.includes(f) && at.includes(f)), `a tool's folder that is a link to the project's root lists the files there, in the work tree and at a commit (${here.join(", ")})`);
    ok(folders.includes("") && folders.includes("docs/steer") && inToolFolder("docs/steer/new.md", ["docs/steer"]) && inToolFolder("x/new.md", [""]) && !inToolFolder("docs/steerage.md", ["docs/steer"]),
      "and a file a pull request adds where a tool's folder leads lies in a tool's folder before any list holds it, as the code-review wait reads it");
  } finally { process.chdir(was); fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---- an entry file reached through a link into a submodule ----
{
  const { dir, git, write, link } = repo("tool-ways-sublink-");
  const run = env => {
    try { return { status: 0, out: execFileSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8", env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] }) }; }
    catch (e) { return { status: e.status, out: `${e.stdout}${e.stderr}` }; }
  };
  try {
    write("AGENTS.md", "@a.md\n"); write("a.md", "a\n"); git("add", "-A"); git("commit", "-qm", "base");
    git("update-index", "--add", "--cacheinfo", `160000,${git("rev-parse", "HEAD").trim()},vendor/kiro`);
    write("vendor/kiro/steering/core.md", "---\ninclusion: always\n---\n@AGENTS.md\n"); link("vendor/kiro", ".kiro");
    const refused = (r, what) => ok(r.status === 1 && mended(r.out) && r.out.includes(".kiro/steering/core.md stands here but is not read"), what);
    refused(run({ ENTRY_BASE: "HEAD" }), "an entry file reached through a link into a submodule, checked out, fails, saying its mend, its text unread");
    fs.rmSync(path.join(dir, "vendor/kiro/steering"), { recursive: true });
    refused(run({ ENTRY_BASE: "HEAD" }), "and so does one through a link into a submodule not checked out");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---- an entry file inside a submodule ----
{
  const { dir, git, write } = repo("tool-ways-sub-");
  const run = env => {
    try { return { status: 0, out: execFileSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8", env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] }) }; }
    catch (e) { return { status: e.status, out: `${e.stdout}${e.stderr}` }; }
  };
  try {
    write("AGENTS.md", "@a.md\n"); write("a.md", "a\n"); git("add", "-A"); git("commit", "-qm", "base");
    git("update-index", "--add", "--cacheinfo", `160000,${git("rev-parse", "HEAD").trim()},.kiro`);
    write(".kiro/steering/core.md", "---\ninclusion: always\n---\nnothing pulled in\n");
    const refused = (r, what) => ok(r.status === 1 && mended(r.out) && r.out.includes(".kiro/steering/core.md stands here but is not read") && r.out.includes("submodule"), what);
    refused(run({ ENTRY_BASE: "HEAD" }), "against a base that held nothing there, an entry file the pull request brings inside a submodule, checked out, fails, saying its mend");
    fs.rmSync(path.join(dir, ".kiro/steering"), { recursive: true });
    refused(run({ ENTRY_BASE: "HEAD" }), "and so does one inside a submodule not checked out, as a check's checkout leaves it");
    git("commit", "-qm", "submodule");
    const r = run({ ENTRY_BASE: "HEAD" });
    ok(r.status === 0 && r.out.includes("note") && r.out.includes(".kiro/steering/core.md stands here but is not read"), "against a base that held the same submodule, it is noted and fails nothing");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---- each link of a chain, and each on the way to a tool's folder ----
{
  const { dir, git, write, link } = repo("tool-ways-chain-");
  const was = process.cwd();
  try {
    write("SECURITY.md", "**the rule files:** `docs/t.md`;\n");
    write("docs/end.md", "- **A rule of the steering.** Text.\n"); link("end.md", "docs/mid.md"); link("docs/mid.md", "CLAUDE.md");
    write("docs/k/steering/a.md", "- **A rule in a linked folder.** Text.\n"); link("docs/k", "kiro"); link("kiro", ".kiro");
    git("add", "-A"); git("commit", "-qm", "chains");
    const tree = git("ls-tree", "-r", "--name-only", "-z", "HEAD").split("\0").filter(Boolean), under = d => tree.filter(f => d === "." || f.startsWith(`${d}/`));
    process.chdir(dir);
    const here = ruleFiles(undefined, undefined, { tools: true }), ways = wayLinks();
    const at = ruleFiles(readAt("HEAD"), under, { tools: true }), waysAt = wayLinks(readAt("HEAD"));
    process.chdir(was);
    ok(["CLAUDE.md", "docs/mid.md", "docs/end.md", "docs/k/steering/a.md"].every(f => here.includes(f) && at.includes(f)), `each link of a chain to a floor file is a rule file, the middle one too, in the work tree and at a commit (${here.join(", ")})`);
    ok([".kiro", "kiro"].every(l => ways.includes(l) && waysAt.includes(l)) && !here.includes(".kiro"), `each link on the way to a tool's folder is named, in the work tree and at a commit, and none is listed as a file (${ways.join(", ")})`);
    // (from another folder: a reader of the project's own that follows links as the checks' readers follow them)
    const sha = git("rev-parse", "HEAD").trim(), other = placeAt(sha, args => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    ok(ruleFiles(readAt(sha, other), under, { tools: true }).includes("docs/k/steering/a.md"), "a commit of another repository is read through the git it is given, its links followed, as the staged case reads main");
    const own = ownHolders(dir).rules.map(r => r.file);
    ok(own.includes("docs/k/steering/a.md") && own.includes("docs/end.md"), `the project's own rules are read where a tool's linked folder leads (holders-own.mjs: ${own.join(", ")})`);
    ok(Object.keys(ruleTexts(dir)).includes("docs/k/steering/a.md"), "and the steps' tests read the rule files' words there too (steps-kit.mjs)");
  } finally { process.chdir(was); fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---- a rule file by its name: every agent tool's own folder ----
ok([".kiro/specs/a/tasks.md", ".codex/prompts/p.md", "x/.kiro/notes.md", ".gemini/styleguide.md", ".cursor/rules/r.md", ".github/x.md", ".agents/a.md"].every(f => RULES.test(f)) && !RULES.test("docs/kiro.md") && !RULES.test("docs/.kirofile.md"),
  "a Markdown file in any agent tool's own folder is a rule file by its name, so a pull request of it alone is never docs alone (code-review-wait.mjs)");

// ---- a tool's folder that a submodule holds ----
{
  const { dir, git, write, link } = repo("tool-ways-subfolder-");
  const run = env => {
    try { return { status: 0, out: execFileSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8", env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] }) }; }
    catch (e) { return { status: e.status, out: `${e.stdout}${e.stderr}` }; }
  };
  try {
    write("AGENTS.md", "@a.md\n"); write("a.md", "a\n"); git("add", "-A"); git("commit", "-qm", "base");
    const head = git("rev-parse", "HEAD").trim(), sub = at => git("update-index", "--add", "--cacheinfo", `160000,${head},${at}`);
    const said = (r, f) => r.out.includes(`${f}, where an agent tool takes its instructions from, lies in a submodule`);
    sub(".agents");
    let r = run({ ENTRY_BASE: "HEAD" });
    ok(r.status === 1 && mended(r.out) && said(r, ".agents/rules"), "a tool's folder that a submodule the pull request brings holds fails, saying its mend", r.out);
    git("rm", "-q", "--cached", ".agents"); sub("vendor/k"); link("vendor/k", ".kiro");
    r = run({ ENTRY_BASE: "HEAD" });
    ok(r.status === 1 && said(r, ".kiro/steering") && said(r, ".kiro/agents"), "and so does one reached through a link into a submodule", r.out);
    fs.rmSync(path.join(dir, ".kiro")); link("vendor/k/deep", ".kiro");
    r = run({ ENTRY_BASE: "HEAD" });
    ok(r.status === 1 && said(r, ".kiro/steering"), "and one reached through a link to a folder inside a submodule not checked out", r.out);
    fs.rmSync(path.join(dir, ".kiro")); git("rm", "-q", "--cached", "vendor/k"); fs.mkdirSync(path.join(dir, ".agent/rules"), { recursive: true }); sub(".agent/rules/vendor");
    r = run({ ENTRY_BASE: "HEAD" });
    ok(r.status === 1 && said(r, ".agent/rules"), "and one that holds a submodule", r.out);
    git("commit", "-qm", "a submodule in a tool's folder");
    r = run({ ENTRY_BASE: "HEAD" });
    ok(r.status === 0 && r.out.includes("note") && said(r, ".agent/rules"), "against a base that held it so, it is noted and fails nothing", r.out);
    r = run({ ENTRY_BASE: head });
    ok(r.status === 1 && said(r, ".agent/rules"), "against a base that held it in its own tree, it fails", r.out);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
