// Checks the pointer check (pointers.mjs, beside this file) on a small project made for it: its rule files with either
// line ending, a pointer that leads nowhere, a project with no SECURITY.md yet, and its agent tools' files. Run by the
// core's tests workflow (.github/workflows/tests.yml).
//
//   node scripts/pointers-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "./mend.mjs";

let failed = 0;
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) failed++; };
const here = fileURLToPath(new URL(".", import.meta.url));
const FILES = {
  "AGENTS.md": "# A project\n\n## Where things are\n\nIts rules: `SECURITY.md`, rule 3, and \"Running it\" in `docs/developing.md`.\n",
  "SECURITY.md": "# Security\n\n**3. The protected files,** here, **the rule files:** `docs/developing.md`;\n",
  "docs/developing.md": "# Developing\n\n## Running it\n\nAs \"Where things are\" in `AGENTS.md` says.\n",
};
function run(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pointers-test-"));
  try {
    for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
    fs.mkdirSync(path.join(dir, "core/scripts"), { recursive: true });
    for (const f of ["pointers.mjs", "rule-files.mjs", "guards.mjs", "core-path.mjs", "core-address.mjs", "started.mjs"]) fs.copyFileSync(path.join(here, f), path.join(dir, "core/scripts", f));
    for (const args of [["init", "-q"], ["add", "-A"]]) execFileSync("git", args, { cwd: dir, stdio: "ignore" });
    const r = spawnSync(process.execPath, [path.join(dir, "core/scripts/pointers.mjs")], { cwd: dir, encoding: "utf8" });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const crlf = files => Object.fromEntries(Object.entries(files).map(([f, text]) => [f, text.replaceAll("\n", "\r\n")]));
const broken = { ...FILES, "AGENTS.md": FILES["AGENTS.md"].replace("Running it", "Shipping it") };
const { "SECURITY.md": _, ...bare } = FILES;

let r = run(FILES);
ok(r.code === 0 && /^ok /m.test(r.out), "rule files whose pointers all lead somewhere pass");
r = run(crlf(FILES));
ok(r.code === 0 && /^ok /m.test(r.out), "the same files with a Windows checkout's line endings pass");
for (const [files, ending] of [[broken, "either"], [crlf(broken), "a Windows"]]) {
  r = run(files);
  ok(r.code === 1 && /AGENTS\.md:5: "shipping it" is no heading/.test(r.out), `a section that is not there fails, named with its line, with ${ending} line ending`);
}
r = run(bare);
ok(r.code === 1 && mended(r.out) && /^FAIL: the project has no SECURITY\.md yet/m.test(r.out) && !/^\s+at /m.test(r.out), "a project with no SECURITY.md yet is told so in a line, with no stack");
// a floor rule and an archive item, read in the project's copy of the core's floor and archive
const CORE = { "core/floor/security.md": "# The floor\n\n**1. Nothing secret.** Text.\n\n**8. Reviews.** As rule 1 says.\n", "core/floor/topics.md": "# Topics\n\n**10. Licences.** Text.\n",
  "core/archive/instructions/items-001.md": "# Items\n\n1. **1 November 2026**. Words.\n\n2. **2 November 2026**. Words.\n" };
const cites = text => ({ ...FILES, ...CORE, "AGENTS.md": `${FILES["AGENTS.md"]}\n${text}\n` });
r = run(cites("As floor rules 8 and 10 say, and floor rule 1 (core archive 1 and 2; core archive 1 to 2)."));
ok(r.code === 0 && !/floor rule|core archive/.test(r.out.split("\n").filter(l => l.startsWith("note")).join("\n")), "a floor rule is read in the floor's files, by its bold number, and an archive item in the archive's item files");
r = run(cites("As floor rule 19 says (core archive 999)."));
ok(r.code === 0 && /note .*floor rule 19: no such rule in the floor/.test(r.out) && /note .*core archive 999: no such item in the archive/.test(r.out), "in a project, a floor rule or an archive item that is not there is listed, each named, and fails nothing: a sync never fails a project over a citation of its own");
ok(/read and not found/.test(r.out) && !/\(2 in forms it cannot read/.test(r.out), "and it is listed as read and not found, not as a form it cannot read", r.out);
// a file that only points: a pointer through it leads to what stands where it names
const MOVED = { "core/modules/roles.md": "# Moved: Who does what\n\n[`tasks/roles.md`](../tasks/roles.md) holds these rules now: read it whole.\n\nNow in [`roles/orchestrator.md`](../roles/orchestrator.md): **The builders**.\n",
  "core/tasks/roles.md": "# Who does what\n\n**The roles.** Text.\n", "core/roles/orchestrator.md": "# The orchestrator\n\n**The builders** are picked so:\n1. One.\n2. Two.\n",
  "core/modules/git.md": "# Moved: Git\n\n[`roles/shared/git.md`](../roles/shared/git.md) holds these rules now: read it whole.\n", "core/roles/shared/git.md": "# Git\n\n- **Push after every commit,** always.\n\n1. One.\n2. Two.\n",
  "core/floor/topics.md": "# Moved: the floor, by topic\n\n[`floor/topics/`](topics/) holds these rules now, a file a topic: read the one the task touches.\n", "core/floor/topics/licences.md": "# Licences\n\n**10. Licences.** Text.\n\n## Reporting\n\nText.\n" };
r = run({ ...cites("As `core/modules/git.md`, \"Push after every commit\", says, with `core/modules/git.md`, point 2, and \"Reporting\" in `core/floor/topics.md`, and `core/floor/topics.md`, rule 10; and `core/modules/roles.md`, \"The builders\", point 2, with \"The roles\" in `core/modules/roles.md`; and `core/modules/roles.md`, point 2."), ...MOVED });
ok(r.code === 0, "a pointer through a file that only points leads to the section or the point where it now stands, in the file it names or a folder's own files, and a rule it says went elsewhere is found there, its numbered points too, named with the rule or by the old file alone");
r = run({ ...cites("As `core/modules/git.md`, \"Push once\", says, with `core/modules/git.md`, point 3, and `core/modules/roles.md`, point 9."), ...MOVED });
ok(r.code === 1 && /"push once" is no heading or bold lead-in/i.test(r.out) && /point 3: no such numbered point/.test(r.out) && /point 9: no such numbered point/.test(r.out), "and one that stands in neither place still fails, named");
// an agent tool's files (#405): a broken pointer the pull request's base held there is noted and fails nothing, one it
// did not hold fails, and with no base each is noted
const tools = fs.mkdtempSync(path.join(os.tmpdir(), "pointers-test-tools-"));
try {
  const put = (f, body) => { fs.mkdirSync(path.join(tools, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(tools, f), body); };
  const g = (...args) => execFileSync("git", args, { cwd: tools, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  for (const [f, body] of Object.entries(FILES)) put(f, body);
  fs.mkdirSync(path.join(tools, "core/scripts"), { recursive: true });
  for (const f of ["pointers.mjs", "rule-files.mjs", "guards.mjs", "core-path.mjs", "core-address.mjs", "started.mjs"]) fs.copyFileSync(path.join(here, f), path.join(tools, "core/scripts", f));
  const OLD = "# Steering\n\nAs \"Shipping it\" in `docs/developing.md` says.\n";
  put(".kiro/steering/own.md", OLD);
  g("init", "-q"); g("add", "-A"); g("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", "base");
  const base = g("rev-parse", "HEAD").trim();
  const check = (env = {}) => { const r = spawnSync(process.execPath, [path.join(tools, "core/scripts/pointers.mjs")], { cwd: tools, encoding: "utf8", env: { ...process.env, POINTERS_BASE: "", ...env } }); return { status: r.status, out: r.stdout + r.stderr }; };
  let t = check();
  ok(t.status === 0 && /^note a broken pointer in an agent tool's file: \.kiro\/steering\/own\.md:3: "shipping it" is no heading .*with no base to read against, so it fails nothing/m.test(t.out) && /1 old in an agent tool's file/.test(t.out), "with no base, a broken pointer in an agent tool's file is noted, and fails nothing", t.out);
  t = check({ POINTERS_BASE: base });
  ok(t.status === 0 && /^note a broken pointer in an agent tool's file: \.kiro\/steering\/own\.md:3: .*the pull request's base held it/m.test(t.out), "one the pull request's base held is noted, and fails nothing", t.out);
  put(".kiro/steering/own.md", `# Steering\n\nA line above it now.\n\n${OLD.split("\n\n")[1]}`);
  put(".agents/rules/new.md", "# A rule\n\nAs `docs/gone.md` says.\n");
  put("GEMINI.md", "# Gemini\n\nAs \"Building it\" in `docs/developing.md` says.\n");
  g("add", "-A");
  t = check({ POINTERS_BASE: base });
  ok(t.status === 1 && mended(t.out) && /^FAIL: a broken pointer: \.agents\/rules\/new\.md:3: `docs\/gone\.md` is no tracked file or folder\. Mend: /m.test(t.out) && /^FAIL: a broken pointer: GEMINI\.md:3: "building it" is no heading/m.test(t.out)
    && /^note a broken pointer in an agent tool's file: \.kiro\/steering\/own\.md:5: .*the pull request's base held it/m.test(t.out) && !/FAIL.*own\.md/.test(t.out),
    "one it did not hold fails, in a tool's folder or GEMINI.md, saying its mend, while the old one, its line moved, is still noted", t.out);
  t = check({ POINTERS_BASE: "no-such-branch" });
  ok(t.status === 1 && mended(t.out) && /^FAIL: POINTERS_BASE no-such-branch is not a commit here\. Mend: fetch it/m.test(t.out), "a base that is no commit here fails, saying to fetch it", t.out);
  put(".agents/rules/new.md", "# A rule\n\nAs `docs/developing.md` says.\n");
  put("GEMINI.md", "# Gemini\n\nAs \"Running it\" in `docs/developing.md` says.\n");
  g("add", "-A");
  t = check({ POINTERS_BASE: base });
  ok(t.status === 0 && /own\.md:5/.test(t.out), "and once those lead somewhere, it passes, the old one noted", t.out);
  // (a file under a tool's folder whose link leads out of the project is not read: its pointers are no rule's)
  if (process.platform !== "win32") {
    const away = fs.mkdtempSync(path.join(os.tmpdir(), "pointers-test-away-"));
    fs.writeFileSync(path.join(away, "out.md"), "# Out\n\nAs `docs/nowhere.md` says.\n");
    fs.symlinkSync(path.join(away, "out.md"), path.join(tools, ".kiro/steering/out.md"));
    g("add", "-A");
    t = check({ POINTERS_BASE: base });
    fs.rmSync(away, { recursive: true, force: true });
    ok(t.status === 0 && !/nowhere/.test(t.out), "a file in a tool's folder whose link leads out of the project is not read", t.out);
  }
} finally { fs.rmSync(tools, { recursive: true, force: true }); }
// the core's own run: there it fails
const coreDir = fs.mkdtempSync(path.join(os.tmpdir(), "pointers-test-core-"));
try {
  const put = (f, text) => { fs.mkdirSync(path.join(coreDir, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(coreDir, f), text); };
  put("floor/security.md", "# The floor\n\n**1. Nothing secret.** As rule 1 says, and rule 10 (core archive 1).\n");
  put("floor/topics.md", "# Topics\n\n**10. Licences.** Text.\n");
  put("floor/threat-model.md", "# The threat model\n\n19. A list item, no rule.\n");
  put("tasks/a.md", "# A module\n\nAs floor rule 19 says (core archive 999).\n");
  put("archive/instructions/items-001.md", "# Items\n\n1. **1 November 2026**. Words.\n");
  fs.mkdirSync(path.join(coreDir, "scripts"));
  for (const f of ["pointers.mjs", "rule-files.mjs", "guards.mjs", "core-path.mjs", "core-address.mjs", "started.mjs"]) fs.copyFileSync(path.join(here, f), path.join(coreDir, "scripts", f));
  for (const args of [["init", "-q"], ["add", "-A"]]) execFileSync("git", args, { cwd: coreDir, stdio: "ignore" });
  const c = spawnSync(process.execPath, [path.join(coreDir, "scripts/pointers.mjs"), "--core"], { cwd: coreDir, encoding: "utf8" });
  ok(c.status === 1 && mended(c.stdout + c.stderr) && /FAIL: a broken pointer: tasks\/a\.md:3: floor rule 19/.test(c.stdout + c.stderr) && /core archive 999/.test(c.stdout + c.stderr) && !/floor\/security\.md/.test(c.stderr), "in the core's own run it fails, a list item numbered 19 is no rule, and a lone rule in the floor's own file is the floor's, wherever in the floor it stands", c.stdout + c.stderr);
  const core = (file, text) => { put(file, text); execFileSync("git", ["add", "-A"], { cwd: coreDir, stdio: "ignore" }); const r = spawnSync(process.execPath, [path.join(coreDir, "scripts/pointers.mjs"), "--core"], { cwd: coreDir, encoding: "utf8" }); return { status: r.status, out: r.stdout + r.stderr }; };
  put("tasks/a.md", "# A module\n\nNothing cited.\n");
  const ten = core("floor/security.md", "# The floor\n\n**1. Nothing secret.** As rule 10 says.\n");
  ok(ten.status === 0 && !/rule 10/.test(ten.out), "a lone rule in the floor's own file is found in any of the floor's files: rule 10 in topics.md, cited from security.md", ten.out);
  const nineteen = core("floor/security.md", "# The floor\n\n**1. Nothing secret.** As rule 19 says.\n");
  ok(nineteen.status === 1 && mended(nineteen.out) && /FAIL: a broken pointer: floor\/security\.md:3: rule 19: no such rule in the floor\. Mend: point it at/.test(nineteen.out), "and one that no floor file holds fails", nineteen.out);
  put("floor/security.md", "# The floor\n\n**1. Nothing secret.** Text.\n");
  // (a file that points from a path the rules left is read too: the path it names and its import line)
  const points = core("modules/a.md", "# Moved: A module\n\n[`tasks/a.md`](../tasks/a.md) holds these rules now: read it whole.\n\n@../tasks/a.md\n");
  ok(points.status === 0, "in the core's own run a file at a path the rules left is read: the path it names and its import line, each leading to a file", points.out);
  const astray = core("modules/a.md", "# Moved: A module\n\n[`tasks/gone.md`](../tasks/gone.md) holds these rules now: read it whole.\n\n@../tasks/gone.md\n");
  ok(astray.status === 1 && mended(astray.out) && /modules\/a\.md:3: `tasks\/gone\.md` is no tracked file or folder/.test(astray.out) && /modules\/a\.md:5: the import line @\.\.\/tasks\/gone\.md leads to no tracked file/.test(astray.out), "and one whose path or import line leads nowhere fails, each named", astray.out);
  fs.rmSync(path.join(coreDir, "modules"), { recursive: true });
  const capital = core("tasks/a.md", "# A module\n\nFloor rule 16 says so (Core archive 998).\n");
  ok(capital.status === 1 && /floor rule 16/i.test(capital.out) && /core archive 998/i.test(capital.out), "a citation opening a sentence, \"Floor rule\" or \"Core archive\", is read too", capital.out);
  const backwards = core("tasks/a.md", "# A module\n\nAs core archive 1 to 0 says.\n");
  ok(backwards.status === 1 && /core archive 1 to 0/.test(backwards.out), "a range written backwards leads nowhere, and is named", backwards.out);
  put("tasks/a.md", "# A module\n\nNothing cited.\n");
  // (the core's own agent tools' files are read too, and there a broken pointer fails)
  const steering = core(".agents/rules/core.md", "# The core, for a tool\n\nAs \"Running it\" in `tasks/a.md` says.\n");
  ok(steering.status === 1 && mended(steering.out) && /FAIL: a broken pointer: \.agents\/rules\/core\.md:3: "running it" is no heading/.test(steering.out), "in the core's own run an agent tool's file is read, and a broken pointer in it fails", steering.out);
} finally { fs.rmSync(coreDir, { recursive: true, force: true }); }
process.exit(failed ? 1 : 0);
