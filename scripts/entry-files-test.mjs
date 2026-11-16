// Tests the entry-files check (entry-files.mjs; modules/tools.md, "One door in"): on small texts made here, then as it
// runs, in a scratch repository and on the starter kit's templates and the core's own entry files. Its tests workflow
// runs it on every pull request here. Git and Node's own modules.
//
//   node scripts/entry-files-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENTRY, lacking, verdict } from "./entry-files.mjs";
import { mended } from "./mend.mjs";
import { ruleFiles } from "./rule-files.mjs";

let failed = 0, count = 0;
const ok = (cond, what) => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(root, "scripts/entry-files.mjs");
const reader = files => f => (f in files ? files[f] : null);
const AGENTS = "# p\n\nRead these (Claude Code imports them):\n\n@core-manifest.md\n@core/floor/security.md\n\nMore text, `core/modules/roles.md` named in passing.\n";
const KIRO = "---\ninclusion: always\n---\n#[[file:core-manifest.md]]\n#[[file:core/floor/security.md]]\n";
const AG = "---\ntrigger: always_on\n---\n@[m](../../core-manifest.md)\n@[s](../../core/floor/security.md)\n";

ok(lacking(reader({ "AGENTS.md": AGENTS, "CLAUDE.md": "@AGENTS.md\n@core/modules/claude.md\n", ".kiro/steering/core.md": KIRO, ".agents/rules/core.md": AG })).length === 0,
  "entry files that pull in each file AGENTS.md names, each in its tool's form, lack nothing");
const ranged = lacking(reader({ "AGENTS.md": AGENTS, ".kiro/steering/core.md": KIRO.replace("security.md]]", "security.md:1]]") }));
ok(ranged.length === 1 && ranged[0].missing.join() === "core/floor/security.md", "a Kiro include with a line range pulls in part of a file, so the file is still lacking");
ok(lacking(reader({ "AGENTS.md": AGENTS })).length === 0 && lacking(reader({ "CLAUDE.md": "x" })).length === 0,
  "an entry file the project does not hold, or a project with no AGENTS.md, is not looked for");
let l = lacking(reader({ "AGENTS.md": AGENTS, "CLAUDE.md": "@core-manifest.md\n" }));
ok(l.length === 1 && l[0].file === "CLAUDE.md" && l[0].missing.join() === "core/floor/security.md",
  "a CLAUDE.md that imports neither AGENTS.md nor each of its files lacks the one it leaves out");
l = lacking(reader({ "AGENTS.md": AGENTS, ".kiro/steering/core.md": "#[[file:core-manifest.md]]\n#[[file:core/modules/roles.md]]\n" }));
ok(l.length === 1 && l[0].missing.join() === "core/floor/security.md", "a file named in passing is no @ line, and a steering file that leaves one out lacks it");
l = lacking(reader({ "AGENTS.md": AGENTS, ".agents/rules/core.md": "---\ntrigger: always_on\n---\n@[m](core-manifest.md)\n@[s](../../core/floor/security.md)\n" }));
ok(l.length === 1 && l[0].missing.join() === "core-manifest.md", "an Antigravity rule's path is read from the rule's own folder, so one written from the root lacks it");
l = lacking(reader({ "AGENTS.md": AGENTS, ".kiro/steering/core.md": "@core-manifest.md\n@core/floor/security.md\n" }));
ok(l.length === 1 && l[0].missing.length === 2, "a line in another tool's form pulls in nothing");

l = lacking(reader({ "AGENTS.md": AGENTS, ".kiro/steering/core.md": KIRO.replace("inclusion: always", "inclusion: manual"), ".agents/rules/core.md": AG.replace("always_on", "model_decision") }));
ok(l.length === 2 && l.every(x => x.off && x.off.includes("Mend:")), "an entry file its tool would not load at every start, by its front matter, is said so, with the key to set");
ok(lacking(reader({ "AGENTS.md": AGENTS, ".kiro/steering/core.md": "#[[file:core-manifest.md]]\n#[[file:core/floor/security.md]]\n" })).length === 0
  && lacking(reader({ "AGENTS.md": AGENTS, ".agents/rules/core.md": AG.replace("---\ntrigger: always_on\n---\n", "") })).length === 1,
  "a steering file with no front matter loads always, as Kiro's documentation says; an Antigravity rule with none does not");
l = lacking(reader({ "AGENTS.md": AGENTS, ".kiro/steering/core.md": "#[[file:core-manifest.md]]\n```\n#[[file:core/floor/security.md]]\n```\n<!-- #[[file:core/floor/security.md]] -->\n" }));
ok(l.length === 1 && l[0].missing.join() === "core/floor/security.md", "a line inside a fenced block or an HTML comment pulls in nothing");
const v0 = verdict(reader({ "AGENTS.md": AGENTS, ".kiro/steering/core.md": KIRO.replace("inclusion: always", "inclusion: manual") }));
ok(v0.fails.length === 1 && v0.fails[0].includes("is not loaded at a session's start") && mended(`FAIL: ${v0.fails[0]}`), "its failure says so, with the mend");

const head = reader({ "AGENTS.md": `${AGENTS}@core/modules/git.md\n`, ".kiro/steering/core.md": "#[[file:core-manifest.md]]\n" });
const base = reader({ "AGENTS.md": AGENTS, ".kiro/steering/core.md": "#[[file:core-manifest.md]]\n" });

let v = verdict(head, base);
ok(v.fails.length === 1 && v.fails[0].includes("core/modules/git.md") && v.notes.length === 1 && v.notes[0].includes("core/floor/security.md"),
  "against a base, only what the pull request leaves out fails; what the base already lacked is noted (nothing locks a project)");
v = verdict(head);
ok(v.fails.length === 2 && v.notes.length === 0, "with no base, as in the core's own repository, everything fails");
ok(v.fails.every(f => f.includes("Mend: add the line #[[file:")), "each failure names the line to add, in the tool's own form");
const added = ENTRY.find(e => e.file === ".agents/rules/core.md").line("core/modules/git.md");
ok(lacking(reader({ "AGENTS.md": `${AGENTS}@core/modules/git.md\n`, ".agents/rules/core.md": `${AG}${added}\n` })).length === 0, "the line a mend names is one the check then reads");

// as it runs: in a scratch repository, a failure with its mend; against its base, a note and a pass
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "entry-files-"));
const git = (...a) => execFileSync("git", a, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const write = (f, t) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); };
const run = (env = {}) => {
  try { return { status: 0, out: execFileSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8", env: { ...process.env, ENTRY_BASE: "", ...env }, stdio: ["ignore", "pipe", "pipe"] }) }; }
  catch (e) { return { status: e.status, out: `${e.stdout}${e.stderr}` }; }
};
try {
  git("init", "-q"); git("config", "user.email", "x@example.invalid"); git("config", "user.name", "x"); git("config", "commit.gpgsign", "false");
  write("AGENTS.md", AGENTS); write(".kiro/steering/core.md", "#[[file:core-manifest.md]]\n"); git("add", "-A"); git("commit", "-qm", "base");
  let r = run();
  ok(r.status === 0 && r.out.includes("note") && r.out.includes("#[[file:core/floor/security.md]]"), "run in a project with no base, as on a push to main, a steering file that lacks one is noted and fails nothing");
  const own = (() => { try { return { status: 0, out: execFileSync(process.execPath, [SCRIPT, "--core"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; } catch (e) { return { status: e.status, out: `${e.stdout}${e.stderr}` }; } })();
  ok(own.status === 1 && mended(own.out) && own.out.includes("#[[file:core/floor/security.md]]"), "run as the core's own (--core), it fails, saying its mend");
  r = run({ ENTRY_BASE: "HEAD" });
  ok(r.status === 0 && r.out.includes("note") && r.out.includes("core/floor/security.md"), "run against a base that lacked it too, it is noted and passes");
  write("AGENTS.md", `${AGENTS}@core/modules/git.md\n`);
  r = run({ ENTRY_BASE: "HEAD" });
  ok(r.status === 1 && mended(r.out) && r.out.includes("#[[file:core/modules/git.md]]"), "against its base, a file the pull request adds to AGENTS.md and to no entry file fails, saying its mend");
  write("AGENTS.md", AGENTS);
  write(".kiro/steering/core.md", KIRO);
  ok(run().status === 0, "once the line is added, it passes");
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

// the starter kit's entry files pull in what its AGENTS.md names, each with its tool's part; and the core's own
const kit = name => fs.readFileSync(path.join(root, "setup/template", name), "utf8");
const kitAgents = kit("AGENTS.md.tmpl"), kitFiles = { "AGENTS.md": kitAgents, "CLAUDE.md": kit("CLAUDE.md.tmpl"), ".kiro/steering/core.md": kit("kiro-steering.md.tmpl"), ".agents/rules/core.md": kit("antigravity-rule.md.tmpl") };
ok(/^@core-manifest\.md$/mu.test(kitAgents) && lacking(reader(kitFiles)).length === 0, "the starter kit's entry files pull in every file its AGENTS.md names");
ok(kitFiles[".kiro/steering/core.md"].includes("#[[file:core/modules/kiro.md]]") && kitFiles[".agents/rules/core.md"].includes("(../../core/modules/antigravity.md)"),
  "and each its own tool's part");
const own = f => (fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), "utf8") : null);
ok(lacking(own).length === 0 && ENTRY.every(e => own(e.file) !== null), "the core's own entry files stand and pull in every file its AGENTS.md names");

// the rule files the copies and pointer checks read take in the entry files and every file of a tool's folders
const rfRead = reader({ "SECURITY.md": "**the rule files:** `docs/t.md`;", "AGENTS.md": "", ".kiro/steering/core.md": "", "GEMINI.md": "" });
const rfList = d => (d === ".kiro/steering" ? [".kiro/steering/core.md", ".kiro/steering/api.md"] : d === ".agents/rules" ? [".agents/rules/x.md"] : []);
const rf = ruleFiles(rfRead, rfList, { tools: true });
ok([".kiro/steering/core.md", ".kiro/steering/api.md", ".agents/rules/x.md", "GEMINI.md", "docs/t.md", "AGENTS.md"].every(f => rf.includes(f)) && new Set(rf).size === rf.length,
  "with the tools' files, the rule files are the entry files, GEMINI.md, every file git tracks in a tool's folders of instructions, and SECURITY.md's list, each once");
ok(JSON.stringify(ruleFiles(rfRead, rfList).sort()) === JSON.stringify(["AGENTS.md", "SECURITY.md", "docs/t.md"]),
  "without them, as the copies and pointer checks read, the list is what it was before the tools' files came (#405)");

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
