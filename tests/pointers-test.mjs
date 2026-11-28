// Checks the pointer check (scripts/pointers.mjs) on a small project made for it: its rule files with either
// line ending, a pointer that leads nowhere, a project with no SECURITY.md yet and its agent tools' files; the names in
// its descriptions: tests/names-test.mjs. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/pointers-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { markdownReader } from "../scripts/markdown.mjs";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what, detail = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}${!cond && detail ? `\n     ${detail}` : ""}`); if (!cond) failed++; };
const here = fileURLToPath(new URL("../scripts/", import.meta.url));
// (the check's scripts, and the package its Markdown is read with as the core's install leaves it: the lock file, npm's
// record of the install and the package itself, from the core's own install, which its tests' job runs)
const carry = core => {
  fs.mkdirSync(path.join(core, "scripts"), { recursive: true });
  for (const f of ["pointers.mjs", "links.mjs", "markdown.mjs", "packages.mjs", "rule-files.mjs", "runs-by-itself.mjs", "guards.mjs", "core-path.mjs", "core-address.mjs", "started.mjs", "mend.mjs", "names.mjs"]) fs.copyFileSync(path.join(here, f), path.join(core, "scripts", f));
  for (const f of ["package.json", "package-lock.json", ".npmrc", "node_modules/.package-lock.json", "node_modules/marked"]) fs.cpSync(path.join(here, "../.packages", f), path.join(core, ".packages", f), { recursive: true });
};
const FILES = {
  "AGENTS.md": "# A project\n\n## Where things are\n\nIts rules: `SECURITY.md`, rule 3, and \"Running it\" in `docs/developing.md`.\n",
  "SECURITY.md": "# Security\n\n**3. The protected files,** here, **the rule files:** `docs/developing.md`;\n",
  "docs/developing.md": "# Developing\n\n## Running it\n\nAs \"Where things are\" in `AGENTS.md` says.\n",
};
function run(files, { installed = true, prepare } = {}) {
  const dir = scratchDir("pointers-test-");
  try {
    for (const [f, text] of Object.entries(files)) { fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); }
    carry(path.join(dir, "core"));
    // (with nothing installed, the copy's installer, which the check runs first, stands in for one that cannot install)
    if (!installed) {
      fs.rmSync(path.join(dir, "core/.packages/node_modules"), { recursive: true, force: true });
      fs.writeFileSync(path.join(dir, "core/scripts/install.mjs"), `console.log("FAIL: the core's packages were not installed: npm could not be started. Mend: install npm beside Node, then run this again");\nprocess.exit(1);\n`);
    }
    for (const args of [["init", "-q"], ["add", "-A"]]) execFileSync("git", args, { cwd: dir, stdio: "ignore" });
    prepare?.(dir);
    const r = spawnSync(process.execPath, [path.join(dir, "core/scripts/pointers.mjs")], { cwd: dir, encoding: "utf8", timeout: 120000 });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const crlf = files => Object.fromEntries(Object.entries(files).map(([f, text]) => [f, text.replaceAll("\n", "\r\n")]));
const broken = { ...FILES, "AGENTS.md": FILES["AGENTS.md"].replace("Running it", "Shipping it") };
const { "SECURITY.md": _, ...bare } = FILES;

let r = run(FILES);
ok(r.code === 0 && /^ok /m.test(r.out), "rule files whose pointers all lead somewhere pass");
// (a rule file is read only where it is a regular file of the project's own within the bound, a link inside the
// project followed: else it fails, saying so, and nothing it leads to is read)
if (process.platform !== "win32") {
  const away = scratchDir("pointers-away-");
  try {
    fs.writeFileSync(path.join(away, "words.md"), "# Outside\n\nwords that stand outside the project\n");
    const relink = (to, f = "docs/developing.md") => dir => { fs.rmSync(path.join(dir, f), { force: true }); fs.symlinkSync(to, path.join(dir, f)); execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" }); };
    r = run(FILES, { prepare: relink("AGENTS.md", "CLAUDE.md") });
    ok(r.code === 0 && /^ok /m.test(r.out), "a rule file that is a link inside the project is read as the file it leads to", r.out);
    for (const [to, what] of [["/dev/zero", "a device"], ["gone.md", "nowhere"], [path.join(away, "words.md"), "a file outside the project"]]) {
      r = run(FILES, { prepare: relink(to) });
      ok(r.code === 1 && mended(r.out) && /the rule file docs\/developing\.md is no regular file of the project's own/.test(r.out) && !/words that stand outside/.test(r.out), `a rule file that is a link to ${what} fails, saying its mend, and is not read`, r.out);
    }
  } finally { fs.rmSync(away, { recursive: true, force: true }); }
}
// (a project's own job that runs the check with nothing installed has the copy install the core's packages first, and
// where that fails, the sync never turns it red: #1093, point 1)
r = run(broken, { installed: false });
ok(r.code === 0 && /::warning::The pointer check did not run: the package marked could not be installed in \S+: npm could not be started\. Mend: install npm/.test(r.out), "in a project with the core's packages not installed, the check runs the copy's installer, and where it installs nothing says as a warning that it did not run, with its mend, and fails nothing", r.out);
// (a rule file nested deeper than the lexer follows fails, saying so, never in silence: the fallback reviewer's finding)
r = run({ ...FILES, "docs/developing.md": `${FILES["docs/developing.md"]}${">".repeat(5000)} deep\n` });
ok(r.code === 1 && mended(r.out) && /docs\/developing\.md could not be read as Markdown/.test(r.out), "a rule file nested deeper than the lexer can follow fails, naming the file, with its mend");
// (a project whose tracked paths list past 1 MB, Node's default buffer for what git prints, crashed the check with ENOBUFS and
// no mend: #1204. The paths are made cheaply, entries of the index that point at the empty blob, no file written)
r = run(FILES, { prepare: dir => {
  const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: dir, input: "", encoding: "utf8" }).trim();
  const entries = Array.from({ length: 30000 }, (_, i) => `100644 ${blob} 0\tgenerated/folder-${i}/a-file-with-a-path-of-fifty-characters-${i}.txt\n`).join("");
  execFileSync("git", ["update-index", "--add", "--index-info"], { cwd: dir, input: entries });
  ok(execFileSync("git", ["ls-files", "-z"], { cwd: dir, maxBuffer: 1 << 28 }).length > (1 << 20), "the scratch project's tracked paths list past 1 MB");
} });
ok(r.code === 0 && /^ok /m.test(r.out) && !/ENOBUFS/.test(r.out), "a project whose tracked paths list past 1 MB passes, the listing read whole", r.out);
// (where git cannot list at all, the check fails saying what is wrong, with its mend, never a stack trace)
r = run(FILES, { prepare: dir => fs.writeFileSync(path.join(dir, ".git/index"), "not an index") });
ok(r.code === 1 && mended(r.out) && /git could not list the tracked paths/.test(r.out) && !/at .*\.mjs:\d+/.test(r.out), "where git cannot list the tracked paths, the check fails saying so, with its mend", r.out);
// (lists nested a couple of thousand deep ran the lexer out of memory, which no try catches; a bound before it reads refuses them: #1032)
const deepList = n => Array.from({ length: n }, (_, k) => `${"  ".repeat(k)}- x`).join("\n");
const read = await markdownReader();
let refused = "";
try { read(deepList(2000)); } catch (e) { refused = e.message; }
ok(/line 101 nests lists or quotes deeper than the reader follows/.test(refused), "the reader refuses a list nested 2000 deep before parsing it (the lexer would run out of memory), naming the line");
const inline = n => Array.from({ length: n }, (_, k) => `${"- ".repeat(k)}x`).join("\n");
const refuses = text => { try { read(text); return false; } catch { return true; } };
ok([inline(2100), Array.from({ length: 250 }, (_, k) => `${"1. ".repeat(k)}x`).join("\n"), Array.from({ length: 250 }, (_, k) => `${"> - ".repeat(k)}x`).join("\n"), Array.from({ length: 60 }, (_, k) => `${"\t".repeat(k)}- x`).join("\n")].every(refuses) && !refuses(inline(90)) && !refuses(`${" ".repeat(300)}\n`), "markers written inline, numbered, mixed with quotes, and tabs are refused past the bound too, and a line of blanks nests nothing");
ok(read(deepList(90)).blocks.length === 90, "a list nested 90 deep is still read");
// (900 deep keeps the file under the mebibyte the check reads of a rule file, past which it is refused unread)
r = run({ ...FILES, "docs/developing.md": `${FILES["docs/developing.md"]}\n${deepList(900)}\n` });
ok(r.code === 1 && mended(r.out) && /docs\/developing\.md could not be read as Markdown \(line \d+ nests lists or quotes deeper than the reader follows/.test(r.out), "a rule file whose lists nest 900 deep fails the pointer check, naming the file and line, with its mend");
r = run({ ...FILES, "docs/developing.md": `${FILES["docs/developing.md"]}\n${deepList(2000)}\n` });
ok(r.code === 1 && mended(r.out) && /docs\/developing\.md is no regular file of the project's own of at most 1 MiB/.test(r.out), "and one of 2000 deep, past that mebibyte, fails unread, with its mend");
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
  "core/archive/instructions/items-001.md": "# Items\n\n1. **1 November 2026**. Words.\n\n2. **2 November 2026**. Words.\n",
  "core/archive/instructions/issue-744.md": "# Item 744\n\n#744. **19 November 2026**. Words.\n",
  "core/archive/instructions/issue-744.2.md": "# Item 744.2\n\n#744.2. **19 November 2026**. Words.\n" };
const cites = text => ({ ...FILES, ...CORE, "AGENTS.md": `${FILES["AGENTS.md"]}\n${text}\n` });
r = run(cites("As floor rules 8 and 10 say, and floor rule 1 (core archive 1 and 2; core archive 1 to 2)."));
ok(r.code === 0 && !/floor rule|core archive/.test(r.out.split("\n").filter(l => l.startsWith("note")).join("\n")), "a floor rule is read in the floor's files, by its bold number, and an archive item in the archive's item files");
r = run(cites("As core archive #744 and #744.2 say, beside core archive 1."));
ok(r.code === 0 && !/core archive/.test(r.out.split("\n").filter(l => l.startsWith("note")).join("\n")), "an archive item keyed by its issue, or a point of it, is read in its own file (#744)", r.out);
r = run(cites("As core archive #745 says, and core archive 1 to #9999, and core archive 1 to 9999999999."));
ok(r.code === 0 && ["#745", "1 to #9999", "1 to 9999999999"].every(a => r.out.includes(`core archive ${a}: no such item in the archive`)), "and a keyed item that is not there is listed, named by its key, as are a range with a key in it and one too wide to build, never read as nothing nor crashing", r.out);
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
const tools = scratchDir("pointers-test-tools-");
try {
  const put = (f, body) => { fs.mkdirSync(path.join(tools, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(tools, f), body); };
  const g = (...args) => execFileSync("git", args, { cwd: tools, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  for (const [f, body] of Object.entries(FILES)) put(f, body);
  carry(path.join(tools, "core"));
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
  // (a new break in the same file as an old one fails; a tool's file SECURITY.md already names fails as before)
  put(".kiro/steering/own.md", `${fs.readFileSync(path.join(tools, ".kiro/steering/own.md"), "utf8")}\nAnd \"Testing it\" in \`docs/developing.md\`.\n`);
  put(".kiro/steering/listed.md", "# Listed\n\nAs \"Releasing it\" in `docs/developing.md` says.\n");
  put("SECURITY.md", FILES["SECURITY.md"].replace("`docs/developing.md`;", "`docs/developing.md`, `.kiro/steering/listed.md`;"));
  g("add", "-A");
  t = check();
  ok(t.status === 1 && /^FAIL: a broken pointer: \.kiro\/steering\/listed\.md:3: "releasing it"/m.test(t.out), "a tool's file that SECURITY.md names as a rule file fails as before, with no base", t.out);
  t = check({ POINTERS_BASE: base });
  ok(t.status === 1 && /^FAIL: a broken pointer: \.kiro\/steering\/own\.md:7: "testing it"/m.test(t.out) && /^note a broken pointer in an agent tool's file: \.kiro\/steering\/own\.md:5: /m.test(t.out), "a new break in the same file as an old one fails, the old one still noted", t.out);
  put(".kiro/steering/own.md", fs.readFileSync(path.join(tools, ".kiro/steering/own.md"), "utf8").replace(/\nAnd "Testing it".*\n/u, ""));
  put("SECURITY.md", FILES["SECURITY.md"]);
  g("rm", "-q", "-f", ".kiro/steering/listed.md"); g("add", "-A");
  for (const bad of ["no-such-branch", "--output=x"]) {
    t = check({ POINTERS_BASE: bad });
    ok(t.status === 1 && mended(t.out) && t.out.includes(`FAIL: POINTERS_BASE ${bad} is not a commit here. Mend: fetch it`) && !fs.existsSync(path.join(tools, "x")), `a base that is no commit (${bad}) fails, saying to fetch it, and is never read as an option`, t.out);
  }
  put(".agents/rules/new.md", "# A rule\n\nAs `docs/developing.md` says.\n");
  put("GEMINI.md", "# Gemini\n\nAs \"Running it\" in `docs/developing.md` says.\n");
  g("add", "-A");
  t = check({ POINTERS_BASE: base });
  ok(t.status === 0 && /own\.md:5/.test(t.out), "and once those lead somewhere, it passes, the old one noted", t.out);
  // (a file under a tool's folder whose link leads out of the project is not read: its pointers are no rule's)
  if (process.platform !== "win32") {
    const away = scratchDir("pointers-test-away-");
    fs.writeFileSync(path.join(away, "out.md"), "# Out\n\nAs `docs/nowhere.md` says.\n");
    fs.symlinkSync(path.join(away, "out.md"), path.join(tools, ".kiro/steering/out.md"));
    g("add", "-A");
    t = check({ POINTERS_BASE: base });
    fs.rmSync(away, { recursive: true, force: true });
    ok(t.status === 0 && !/nowhere/.test(t.out), "a file in a tool's folder whose link leads out of the project is not read", t.out);
    // (one whose link leads inside the project is read through it, at the base as in the work tree)
    fs.rmSync(path.join(tools, ".kiro/steering/out.md"));
    put("docs/linked.md", "# Linked\n\nAs `docs/nowhere-inside.md` says.\n");
    fs.symlinkSync("../../docs/linked.md", path.join(tools, ".kiro/steering/inside.md"));
    g("add", "-A"); g("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", "a steering file that is a link inside");
    t = check({ POINTERS_BASE: "HEAD" });
    ok(t.status === 0 && /^note a broken pointer in an agent tool's file: \.kiro\/steering\/inside\.md:3: .*the pull request's base held it/m.test(t.out), "a tool's file that is a link inside the project is read through it at the base too, so what it held is noted", t.out);
    fs.symlinkSync("../../docs", path.join(tools, ".kiro/steering/docs"));
    g("add", "-A"); g("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", "a link to a folder");
    t = check({ POINTERS_BASE: "HEAD" });
    ok(t.status === 0 && !/EISDIR/.test(t.out), "a link to a folder in a tool's folder is passed over, failing nothing", t.out);
    // (a file past the bound where a tool's folder that is a link leads: noted where the base held it as it stands, failed
    // where the pull request changes it)
    put("docs/big/huge.md", `# Huge\n\n${"x".repeat((1 << 20) + 10)}\n`);
    fs.symlinkSync("../docs/big", path.join(tools, ".kiro/agents"));
    g("add", "-A"); g("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", "a linked tool's folder with a large file");
    t = check({ POINTERS_BASE: "HEAD" });
    ok(t.status === 0 && /^note the rule file docs\/big\/huge\.md is no regular file .*the pull request's base held it/m.test(t.out), "a file past the bound where a linked tool's folder leads, which the base held as it stands, is noted and fails nothing", t.out);
    put("docs/big/huge.md", `# Huge\n\n${"y".repeat((1 << 20) + 10)}\n`);
    t = check({ POINTERS_BASE: "HEAD" });
    ok(t.status === 1 && mended(t.out) && /FAIL: the rule file docs\/big\/huge\.md is no regular file/.test(t.out), "and one the pull request changes fails, saying its mend", t.out);
    // (and a link there to a large file inside the project, both held by the base as they stand: noted)
    put("docs/big/huge.md", `# Huge\n\n${"x".repeat((1 << 20) + 10)}\n`);
    put("docs/large.md", `# Large\n\n${"z".repeat((1 << 20) + 10)}\n`);
    fs.symlinkSync("../large.md", path.join(tools, "docs/big/to-large.md"));
    g("add", "-A"); g("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", "a link to a large file there");
    t = check({ POINTERS_BASE: "HEAD" });
    ok(t.status === 0 && /^note the rule file docs\/big\/to-large\.md is no regular file .*the pull request's base held it/m.test(t.out), "a link there to a large file, held by the base as it stands, is noted too, as git reads a link", t.out);
    // (at a commit, each link of a chain to a tool's file is a tool's file too, its broken pointers keyed by it, as the
    // work tree's reader lists it; and a file past the bound is read as empty there, as in the work tree)
    put("docs/chain/end.md", "# End\n\nAs `docs/gone-chain.md` says.\n");
    fs.symlinkSync("end.md", path.join(tools, "docs/chain/mid.md"));
    fs.mkdirSync(path.join(tools, ".agent/rules"), { recursive: true }); fs.symlinkSync("../../docs/chain/mid.md", path.join(tools, ".agent/rules/c.md"));
    put("docs/big/huge.md", `# Huge\n\nAs \`docs/gone-huge.md\` says.\n${"x".repeat((1 << 20) + 10)}\n`);
    g("add", "-A"); g("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", "a chain of links to a tool's file");
    const at = spawnSync(process.execPath, [path.join(tools, "core/scripts/pointers.mjs"), "--tools-at", g("rev-parse", "HEAD").trim()], { cwd: tools, encoding: "utf8" });
    let keys = [];
    try { keys = JSON.parse(at.stdout).map(k => k.split("\t")[0]); } catch { /* (none read) */ }
    ok(["docs/chain/mid.md", "docs/chain/end.md", ".agent/rules/c.md"].every(f => keys.includes(f)) && !keys.includes("docs/big/huge.md"),
      "at a commit, a broken pointer in a tool's file reached through a chain of links is keyed by each link of it, and one in a file past the bound is not read", `${at.stdout}${at.stderr}`);
  }
} finally { fs.rmSync(tools, { recursive: true, force: true }); }
// the core's own run: there it fails
const coreDir = scratchDir("pointers-test-core-");
try {
  const put = (f, text) => { fs.mkdirSync(path.join(coreDir, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(coreDir, f), text); };
  put("floor/security.md", "# The floor\n\n**1. Nothing secret.** As rule 1 says, and rule 10 (core archive 1).\n");
  put("floor/topics.md", "# Topics\n\n**10. Licences.** Text.\n");
  put("floor/threat-model.md", "# The threat model\n\n19. A list item, no rule.\n");
  put("tasks/a.md", "# A module\n\nAs floor rule 19 says (core archive 999).\n");
  put("archive/instructions/items-001.md", "# Items\n\n1. **1 November 2026**. Words.\n");
  carry(coreDir);
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
  const manifest = core("tasks/a.md", "# A module\n\nRead when a pull request changes the path `core-manifest.md`, or `core-manifests.md`.\n");
  ok(manifest.status === 1 && !/`core-manifest\.md`/.test(manifest.out) && /`core-manifests\.md` is no tracked file/.test(manifest.out), "in the core's own run a project's manifest, which only a project has, is not looked for; a name beside it still is", manifest.out);
  put("tasks/a.md", "# A module\n\nNothing cited.\n");
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
// ---- what the check reads of Markdown (markdown.mjs, on the installed package; #530's held-out cases) ----
{
  const readMarkdown = await markdownReader();
  const md = readMarkdown("---\nname: x\n# not a heading\n---\n# Real\n\n```\n# in code, `x.md`\n```\n\nText #123 goes on\nand on, rule 3 <!-- rule 4 -->.\n\n| **a** | b |\n| --- | --- |\n| c | **d** |\n");
  ok(JSON.stringify(md.heads.map(h => [h.level, h.i, h.text])) === JSON.stringify([[1, 4, "Real"]]), "a heading is read where Markdown has one: none in front matter or code");
  ok(!md.blocks.some(b => b.text.includes("x.md")) && md.blocks.some(b => b.i === 1 && b.text.includes("name: x")), "nothing in a code block is read, and front matter is text");
  ok(md.blocks.some(b => b.i === 10 && b.text === " Text #123 goes on and on, rule 3 <!-- rule 4 -->."), "a line led by #123 goes on its paragraph, which is one block by its first line, and an HTML comment in it is read as written, as an agent reads the file");
  ok(JSON.stringify(md.bolds.map(b => [b.i, b.text])) === JSON.stringify([[13, "a"], [15, "d"]]), "a bold lead-in in a table's row is read on that row's line");
  // (what the search for differences found on the first build: HTML read as plain lines, a heading underlined over two
  // lines whole, a lone carriage return a line's end, a bold lead-in only by two asterisks)
  const html = readMarkdown("Before.\n<details>\n**Lead.** See `a.md`.\n</details>\n- after, rule 2\n\n<!-- `b.md`\n\nstill a comment, `c.md` -->\n\nLast.\n");
  ok(["a.md", "b.md", "c.md"].every(f => html.blocks.some(b => b.text.includes(f))) && html.bolds.some(b => b.i === 2 && b.text === "Lead.") && html.blocks.some(b => b.i === 4 && b.text === " - after, rule 2") && html.blocks.some(b => b.i === 10 && b.text === " Last."), "what HTML holds, a comment over blank lines among it, is read as plain lines: its blocks, its bold lead-ins, and a list item after it a block of its own", JSON.stringify(html));
  const setext = readMarkdown("A heading\nover two lines\n---\n\nText.\n");
  ok(setext.heads.length === 1 && setext.heads[0].i === 0 && setext.blocks[0].text === "A heading over two lines" && setext.blocks.some(b => b.i === 4), "a heading underlined on the line after it is one block of all its lines, its underline left out", JSON.stringify(setext));
  const cr = readMarkdown("# One\rText.\r\r# Two\r");
  ok(JSON.stringify(cr.heads.map(h => [h.i, h.text])) === JSON.stringify([[0, "One"], [3, "Two"]]), "a lone carriage return ends a line, as the pointer check splits the file's lines", JSON.stringify(cr));
  const under = readMarkdown("__Not a lead__ and **a lead** and ***both***.\n");
  ok(JSON.stringify(under.bolds.map(b => b.text)) === JSON.stringify(["a lead", "both"]), "a bold lead-in is one written with two asterisks", JSON.stringify(under.bolds));
}
process.exit(failed ? 1 : 0);
