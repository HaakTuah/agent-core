// Tests the entry-files check (entry-files.mjs; tasks/tools.md, "One door in"): on small texts made here, then as it
// runs, in a scratch repository and on the starter kit's templates and the core's own entry files. Its tests workflow
// runs it on every pull request here. Git and Node's own modules.
//
//   node tests/entry-files-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ENTRY, lacking, verdict } from "../scripts/entry-files.mjs";
import { mended } from "../scripts/mend.mjs";
import { followLinks, ruleFiles } from "../scripts/rule-files.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what) => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}`); } };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(root, "scripts/entry-files.mjs");
const reader = files => f => (f in files ? files[f] : null);
const AGENTS = "# p\n\nRead these (Claude Code imports them):\n\n@core-manifest.md\n@core/floor/security.md\n\nMore text, `core/tasks/roles.md` named in passing.\n";
const KIRO = "---\ninclusion: always\n---\n#[[file:core-manifest.md]]\n#[[file:core/floor/security.md]]\n";
const AG = "---\ntrigger: always_on\n---\n@[m](../../core-manifest.md)\n@[s](../../core/floor/security.md)\n";

ok(lacking(reader({ "AGENTS.md": AGENTS, "CLAUDE.md": "@AGENTS.md\n@core/tools/claude.md\n", ".kiro/steering/core.md": KIRO, ".agents/rules/core.md": AG })).length === 0,
  "entry files that pull in each file AGENTS.md names, each in its tool's form, lack nothing");
const ranged = lacking(reader({ "AGENTS.md": AGENTS, ".kiro/steering/core.md": KIRO.replace("security.md]]", "security.md:1]]") }));
ok(ranged.length === 1 && ranged[0].missing.join() === "core/floor/security.md", "a Kiro include with a line range pulls in part of a file, so the file is still lacking");
ok(lacking(reader({ "AGENTS.md": AGENTS })).length === 0 && lacking(reader({ "CLAUDE.md": "x" })).length === 0,
  "an entry file the project does not hold, or a project with no AGENTS.md, is not looked for");
// (the one walk the base and the work tree read a link by, on a tree of links given as { path: text })
const walk = (links, f, folder = () => true) => followLinks(f, p => p in links, p => links[p] ?? null, folder);
ok(walk({ "a": "b/c", "b": "d" }, "a/e") === "d/c/e" && walk({ "a": "/etc" }, "a") === null && walk({ "a": "a" }, "a") === null && walk({ "a": "../x" }, "a") === null
  && walk({ "x": "d/e" }, "x/../y") === "d/y" && walk({}, "f/../y", p => p !== "f") === null && walk({}, "f/", p => p !== "f") === null,
  "one walk follows each link from its own folder, steps back by a `..` from the folder a link reached, refuses to step through a part that is no folder, and refuses one written from a root, one that climbs out and a loop past 40");
let l = lacking(reader({ "AGENTS.md": AGENTS, "CLAUDE.md": "@core-manifest.md\n" }));
ok(l.length === 1 && l[0].file === "CLAUDE.md" && l[0].missing.join() === "core/floor/security.md",
  "a CLAUDE.md that imports neither AGENTS.md nor each of its files lacks the one it leaves out");
l = lacking(reader({ "AGENTS.md": AGENTS, ".kiro/steering/core.md": "#[[file:core-manifest.md]]\n#[[file:core/tasks/roles.md]]\n" }));
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

const head = reader({ "AGENTS.md": `${AGENTS}@core/roles/shared/git.md\n`, ".kiro/steering/core.md": "#[[file:core-manifest.md]]\n" });
const base = reader({ "AGENTS.md": AGENTS, ".kiro/steering/core.md": "#[[file:core-manifest.md]]\n" });

let v = verdict(head, base);
ok(v.fails.length === 1 && v.fails[0].includes("core/roles/shared/git.md") && v.notes.length === 1 && v.notes[0].includes("core/floor/security.md"),
  "against a base, only what the pull request leaves out fails; what the base already lacked is noted (nothing locks a project)");
v = verdict(head);
ok(v.fails.length === 2 && v.notes.length === 0, "with no base, as in the core's own repository, everything fails");
ok(v.fails.every(f => f.includes("Mend: add the line #[[file:")), "each failure names the line to add, in the tool's own form");
const added = ENTRY.find(e => e.file === ".agents/rules/core.md").line("core/roles/shared/git.md");
ok(lacking(reader({ "AGENTS.md": `${AGENTS}@core/roles/shared/git.md\n`, ".agents/rules/core.md": `${AG}${added}\n` })).length === 0, "the line a mend names is one the check then reads");

// as it runs: in a scratch repository, a failure with its mend; against its base, a note and a pass
const dir = scratchDir("entry-files-");
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
  write("AGENTS.md", `${AGENTS}@core/roles/shared/git.md\n`);
  r = run({ ENTRY_BASE: "HEAD" });
  ok(r.status === 1 && mended(r.out) && r.out.includes("#[[file:core/roles/shared/git.md]]"), "against its base, a file the pull request adds to AGENTS.md and to no entry file fails, saying its mend");
  write("AGENTS.md", AGENTS);
  write(".kiro/steering/core.md", KIRO);
  ok(run().status === 0, "once the line is added, it passes");
  // (an entry file the base held as a link inside the project reads there as the file it leads to, as the work tree's)
  git("add", "-A"); git("commit", "-qm", "kiro");
  fs.symlinkSync("AGENTS.md", path.join(dir, "CLAUDE.md")); git("add", "-A"); git("commit", "-qm", "linked");
  ok(run({ ENTRY_BASE: "HEAD" }).status === 0, "a tracked link inside the project reads as the file it leads to, at the base and in the work tree alike");
  fs.rmSync(path.join(dir, "CLAUDE.md")); write("CLAUDE.md", "@core-manifest.md\n");
  r = run({ ENTRY_BASE: "HEAD" });
  ok(r.status === 1 && r.out.includes("FAIL") && r.out.includes("@core/floor/security.md"), "against a base that held it as a link, an entry file that now pulls in less fails");
  const away = path.join(path.dirname(dir), `${path.basename(dir)}-away.md`);
  fs.writeFileSync(away, "@elsewhere.md\n");
  try {
    const swap = (f, make) => { fs.rmSync(path.join(dir, f), { recursive: true, force: true }); make(path.join(dir, f)); };
    const refused = what => { const res = run({ ENTRY_BASE: "HEAD" }); ok(res.status === 1 && mended(res.out) && res.out.includes("stands here but is not read"), what); };
    swap("CLAUDE.md", f => fs.symlinkSync(away, f));
    refused("against a base that read it, an entry file that is a link leading out of the project fails, saying its mend");
    r = run();
    ok(r.status === 0 && r.out.includes("note") && r.out.includes("stands here but is not read"), "with no base, the same is noted and fails nothing");
    swap("CLAUDE.md", f => fs.symlinkSync("nowhere.md", f));
    refused("so does one that is a link leading nowhere");
    swap("CLAUDE.md", f => fs.writeFileSync(f, `@AGENTS.md\n${"x".repeat(1 << 20)}\n`));
    refused("and one past the bound");
    swap("CLAUDE.md", f => fs.symlinkSync("AGENTS.md", f));
    ok(run({ ENTRY_BASE: "HEAD" }).status === 0, "once it is again what the base held, it passes");
    swap("AGENTS.md", f => fs.symlinkSync(away, f));
    refused("and AGENTS.md as a link leading out of the project fails too");
    // (what the base held: a file past the bound, nothing, or a file behind a folder that is a link)
    const commit = what => { git("add", "-A"); git("commit", "-qm", what); };
    swap("AGENTS.md", f => fs.writeFileSync(f, AGENTS));
    swap("CLAUDE.md", f => fs.writeFileSync(f, `@AGENTS.md\n${"x".repeat(1 << 20)}\n`)); commit("past the bound");
    r = run({ ENTRY_BASE: "HEAD" });
    ok(r.status === 0 && r.out.includes("note") && r.out.includes("stands here but is not read"), "against a base that held it past the bound too, an entry file past the bound is noted and fails nothing");
    swap("CLAUDE.md", f => fs.symlinkSync("nowhere.md", f)); commit("a link that leads nowhere");
    r = run({ ENTRY_BASE: "HEAD" });
    ok(r.status === 0 && r.out.includes("note") && r.out.includes("stands here but is not read"), "against a base that held the same link leading nowhere, it is noted and fails nothing");
    swap("CLAUDE.md", f => fs.writeFileSync(f, "@AGENTS.md\n")); commit("within the bound");
    write(".agents/rules/.keep", ""); swap(".agents/rules/core.md", f => fs.symlinkSync("nowhere.md", f));
    refused("against a base that held nothing there, an entry file the pull request adds as a link leading nowhere fails, saying its mend");
    swap(".agents/rules/core.md", f => fs.writeFileSync(f, AG)); commit("antigravity");
    for (const [up, file] of [[".kiro", ".kiro/steering/core.md"], [".kiro/steering", ".kiro/steering/core.md"], [".agents", ".agents/rules/core.md"]]) {
      const kept = fs.readFileSync(path.join(dir, file), "utf8");
      swap(up, f => fs.symlinkSync("nowhere", f));
      refused(`against a base that read it, ${file} behind ${up} made a link leading nowhere fails, saying its mend`);
      fs.rmSync(path.join(dir, up)); write(file, kept);
    }
    ok(run({ ENTRY_BASE: "HEAD" }).status === 0, "once each folder is again what the base held, it passes");
    write("docs/ag2/rules/core.md", AG); swap(".agents", f => fs.symlinkSync(path.join(dir, "docs/ag2"), f));
    refused("against a base that read it, an entry file behind a folder made a link written from the machine's root fails, saying its mend");
    swap(".agents", () => write(".agents/rules/core.md", AG)); fs.rmSync(path.join(dir, "docs/ag2"), { recursive: true });
    swap("CLAUDE.md", f => fs.symlinkSync(`../${path.basename(dir)}/AGENTS.md`, f));
    refused("and so does an entry file made a link that climbs above the project's root, whatever it leads to");
    swap("CLAUDE.md", f => fs.writeFileSync(f, "@AGENTS.md\n"));
    ok(run({ ENTRY_BASE: "HEAD" }).status === 0, "once each is again what the base held, it passes");
    // (a base that held a link leading nowhere by a longer way: through a second link, or through a part that is not there)
    write("z/.keep", "");
    for (const [what, made] of [
      ["CLAUDE.md led through a second link to a folder lacking the file", () => { swap("CLAUDE.md", f => fs.symlinkSync("x/c.md", f)); fs.symlinkSync("z", path.join(dir, "x")); }],
      [".agents led through a second link to a folder lacking the rest", () => { swap(".agents", f => fs.symlinkSync("x/y", f)); fs.symlinkSync("z", path.join(dir, "x")); }],
      [".agents led up out of a folder that is not there", () => swap(".agents", f => fs.symlinkSync("w/..", f))],
      ...["AGENTS.md/", "AGENTS.md/.", "README.md/../AGENTS.md", "nothere/../AGENTS.md"].map(to => [`CLAUDE.md led through a part that is no folder (${to})`, () => { write("README.md", "x\n"); swap("CLAUDE.md", f => fs.symlinkSync(to, f)); }]),
      ["CLAUDE.md led through a link and back up from the folder it reached, which lacks the file", () => { swap("CLAUDE.md", f => fs.symlinkSync("x/../AGENTS.md", f)); write("docs/d/.keep", ""); fs.symlinkSync("docs/d", path.join(dir, "x")); }],
    ]) {
      made(); commit(what);
      r = run({ ENTRY_BASE: "HEAD" });
      ok(r.status === 0 && r.out.includes("note") && r.out.includes("stands here but is not read"), `against a base where ${what}, left so, it is noted and fails nothing`);
      fs.rmSync(path.join(dir, "x"), { force: true }); swap("CLAUDE.md", f => fs.writeFileSync(f, "@AGENTS.md\n")); swap(".agents", () => write(".agents/rules/core.md", AG)); commit(`${what}, undone`);
    }
    // (a link through a folder link, then back up from the folder it reached, to a file there: read as the system reads it)
    write("docs/d/.keep", ""); write("docs/A2.md", "@AGENTS.md\n"); fs.symlinkSync("docs/d", path.join(dir, "x")); swap("CLAUDE.md", f => fs.symlinkSync("x/../A2.md", f)); commit("CLAUDE.md through a folder link and up");
    ok(run({ ENTRY_BASE: "HEAD" }).status === 0, "against a base that held an entry file as a link through a folder link and back up from the folder it reached, left so, it is read and passes");
    fs.rmSync(path.join(dir, "x")); swap("CLAUDE.md", f => fs.writeFileSync(f, "@AGENTS.md\n")); commit("CLAUDE.md through a folder link and up, undone");
    const awayDir = `${away}.d`;
    fs.mkdirSync(path.join(awayDir, "rules"), { recursive: true }); fs.writeFileSync(path.join(awayDir, "rules/core.md"), AG);
    swap(".agents", f => fs.symlinkSync(awayDir, f)); commit("antigravity's folder elsewhere");
    r = run({ ENTRY_BASE: "HEAD" });
    ok(r.status === 0 && r.out.includes("note") && r.out.includes(".agents/rules/core.md stands here but is not read"), "against a base that held the same folder as a link leading out of the project, it is noted and fails nothing");
    write("docs/ag/.keep", ""); swap(".agents", f => fs.symlinkSync("docs/ag", f)); commit("antigravity's folder inside");
    write("docs/ag/rules/.keep", ""); fs.symlinkSync("nowhere.md", path.join(dir, "docs/ag/rules/core.md"));
    refused("against a base whose folder on the way was a link to a folder that held nothing there, an entry file added as a link leading nowhere fails, saying its mend");
    fs.rmSync(path.join(dir, "docs/ag/rules"), { recursive: true });
    swap(".kiro", f => fs.symlinkSync("nowhere", f)); commit("kiro's folder a link leading nowhere");
    r = run({ ENTRY_BASE: "HEAD" });
    ok(r.status === 0 && r.out.includes("note") && r.out.includes(".kiro/steering/core.md stands here but is not read"), "against a base that held the same folder as a link leading nowhere, it is noted and fails nothing");
  } finally { fs.rmSync(away, { force: true }); fs.rmSync(`${away}.d`, { recursive: true, force: true }); }
} finally { fs.rmSync(dir, { recursive: true, force: true }); }

// the starter kit's entry files pull in what its AGENTS.md names, each with its tool's part; and the core's own
const kit = name => fs.readFileSync(path.join(root, "setup/template", name), "utf8");
const kitAgents = kit("AGENTS.md.tmpl"), kitFiles = { "AGENTS.md": kitAgents, "CLAUDE.md": kit("CLAUDE.md.tmpl"), ".kiro/steering/core.md": kit("kiro-steering.md.tmpl"), ".agents/rules/core.md": kit("antigravity-rule.md.tmpl") };
ok(/^@core-manifest\.md$/mu.test(kitAgents) && lacking(reader(kitFiles)).length === 0, "the starter kit's entry files pull in every file its AGENTS.md names");
ok(kitFiles[".kiro/steering/core.md"].includes("#[[file:core/tools/kiro.md]]") && kitFiles[".agents/rules/core.md"].includes("(../../core/tools/antigravity.md)"),
  "and each its own tool's part");
const own = f => (fs.existsSync(path.join(root, f)) ? fs.readFileSync(path.join(root, f), "utf8") : null);
ok(lacking(own).length === 0 && ENTRY.every(e => own(e.file) !== null), "the core's own entry files stand and pull in every file its AGENTS.md names");

// the rule files the copies and pointer checks read take in the entry files and every file of a tool's folders
const rfRead = reader({ "SECURITY.md": "**the rule files:** `docs/t.md`;", "AGENTS.md": "", ".kiro/steering/core.md": "", ".kiro/steering/api.md": "", ".agents/rules/x.md": "", "GEMINI.md": "" });
const rfList = d => (d === ".kiro/steering" ? [".kiro/steering/core.md", ".kiro/steering/api.md", ".kiro/steering/out.md"] : d === ".agents/rules" ? [".agents/rules/x.md"] : []);
const rf = ruleFiles(rfRead, rfList, { tools: true });
ok([".kiro/steering/core.md", ".kiro/steering/api.md", ".agents/rules/x.md", "GEMINI.md", "docs/t.md", "AGENTS.md"].every(f => rf.includes(f)) && new Set(rf).size === rf.length,
  "with the tools' files, the rule files are the entry files, GEMINI.md, every file git tracks in a tool's folders of instructions, and SECURITY.md's list, each once");
ok(!rf.includes(".kiro/steering/out.md"), "and a file of a tool's folder that the reader cannot read, such as a link that leads out of the project, is none of them");
ok(JSON.stringify(ruleFiles(rfRead, rfList).sort()) === JSON.stringify(["AGENTS.md", "SECURITY.md", "docs/t.md"]),
  "without them, the list is the floor's files and SECURITY.md's, as it was before the tools' files came");

console.log(`${count - failed} of ${count} passed`);
if (failed) process.exitCode = 1;
