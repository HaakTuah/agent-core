// What stands on the way to an agent tool's files: a tool's folder of instructions that is a link, or a file there that
// is one, is listed where it leads, in the work tree and at a commit alike, and nothing outside the project is listed
// (rule-files.mjs, toolFiles); an entry file inside a submodule stands but is not read (entry-files.mjs). Each case in
// a scratch repository.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { readAt, ruleFiles, toolFiles } from "../scripts/rule-files.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

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
    git("add", "-A"); git("commit", "-qm", "links");
    const want = ["docs/kiro/steering/a.md", "docs/steer/b.md", ".agent/rules/c.md", "docs/f/c.md"];
    const outside = l => l.some(f => f.includes("x.md") || f.startsWith("..") || path.isAbsolute(f));
    const tree = git("ls-tree", "-r", "--name-only", "-z", "HEAD").split("\0").filter(Boolean);
    process.chdir(dir);
    const here = toolFiles(), rules = ruleFiles(undefined, undefined, { tools: true });
    const at = toolFiles(readAt("HEAD"), d => tree.filter(f => f.startsWith(`${d}/`)));
    process.chdir(was);
    ok(want.every(f => here.includes(f)), `in the work tree, a tool's folder that is a link, or one on its way, is listed where it leads, and a file there that is a link with the file it leads to (${here.join(", ")})`);
    ok(want.every(f => rules.includes(f)), "and so the rule files a check reads with the tools' files hold them");
    ok(!outside(here) && !outside(rules), "while a tool's folder made a link that leads out of the project lists nothing outside it");
    ok(want.every(f => at.includes(f)) && !outside(at), `at a commit, read through readAt, the same (${at.join(", ")})`);
    const plain = toolFiles(f => (tree.includes(f) ? "" : null), d => tree.filter(f => f.startsWith(`${d}/`)));
    ok(plain.join() === ".agent/rules/c.md", "a reader that says nothing of where a path leads lists each folder as it is named, as before");
  } finally { process.chdir(was); fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(away, { recursive: true, force: true }); }
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

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
