// Checks the names the pointer check (scripts/pointers.mjs) reads in a project's descriptions (scripts/names.mjs; #460,
// point 4), on small projects made for it: a file's name or a package script's that stands nowhere fails where the pull
// request's base did not hold it, is noted where it did (or its list held it) and with no base, and a name the check
// cannot resolve exactly is left alone; the list `checks/names.json`, written and lowered; the descriptions the
// manifest's row names; and the core's own run, where every such name fails. The rest of the check:
// tests/pointers-test.mjs. Run by the core's tests workflow (.github/workflows/tests.yml).
//
//   node tests/names-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { DEEPEST, SEARCHED, brokenNames } from "../scripts/names.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0;
const ok = (cond, what, detail = "") => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) { failed++; if (detail) console.log(`     ${String(detail).split("\n").join("\n     ")}`); } };
const root = fileURLToPath(new URL("../", import.meta.url));
// (the core's scripts whole, and the package its Markdown is read with as the core's install leaves it)
const carry = core => {
  fs.cpSync(path.join(root, "scripts"), path.join(core, "scripts"), { recursive: true });
  for (const f of ["package.json", "package-lock.json", ".npmrc", "node_modules/.package-lock.json", "node_modules/marked"]) fs.cpSync(path.join(root, ".packages", f), path.join(core, ".packages", f), { recursive: true });
};
const FILES = {
  "AGENTS.md": "# A project\n\n## Where things are\n\nIts rules: `SECURITY.md`, rule 3, and \"Running it\" in `docs/developing.md`.\n",
  "SECURITY.md": "# Security\n\n**3. The protected files,** here, **the rule files:** `docs/developing.md`;\n",
  "docs/developing.md": "# Developing\n\n## Running it\n\nAs \"Where things are\" in `AGENTS.md` says.\n",
};

// the names in the descriptions (#460, point 4): a file's name or a package script's that stands nowhere fails where
// the pull request's base did not hold it, is noted where it did (or its list held it), and with no base; a name the
// check cannot resolve exactly is left alone
const desc = scratchDir("names-test-");
try {
  const put = (f, body) => { fs.mkdirSync(path.join(desc, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(desc, f), body); };
  const g = (...args) => execFileSync("git", args, { cwd: desc, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const commit = () => { g("add", "-A"); g("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", "c"); return g("rev-parse", "HEAD").trim(); };
  for (const [f, body] of Object.entries(FILES)) put(f, body);
  carry(path.join(desc, "core"));
  put("src/app.ts", "export const report = 'out/report.json', record = 'records/log.json';\n");
  put("package.json", JSON.stringify({ scripts: { build: "tsc" } }));
  put(".gitignore", "out/\n");
  const OLD = "# A project\n\nRun `npm run build`; the code is `src/app.ts` (or `app.ts`), and it was `src/old.ts`.\n";
  put("README.md", OLD);
  g("init", "-q");
  const base = commit();
  const check = (env = {}, args = []) => { const r = spawnSync(process.execPath, [path.join(desc, "core/scripts/pointers.mjs"), ...args], { cwd: desc, encoding: "utf8", env: { ...process.env, POINTERS_BASE: "", ...env } }); return { status: r.status, out: r.stdout + r.stderr }; };
  let t = check();
  ok(t.status === 0 && /^note a name in a description that stands nowhere: README\.md:3: `src\/old\.ts` names no file the project tracks \(with no base to read against, so it fails nothing/m.test(t.out) && !/`src\/app\.ts`|`app\.ts`|npm run build/.test(t.out), "with no base, a name that stands nowhere is noted and fails nothing, and the names that stand pass", t.out);
  t = check({ POINTERS_BASE: base });
  ok(t.status === 0 && /^note a name in a description that stands nowhere: README\.md:3: `src\/old\.ts` .*the pull request's base held it/m.test(t.out), "one the pull request's base held is noted, and fails nothing", t.out);
  put("README.md", `${OLD}\nNow \`npm run lint\` checks \`lib/gone.ts\` and \`gone.ts\`.\n\nLeft alone: \`npm run lint -w a\`, \`notes.xyz\`, \`src/*.ts\`, \`node src/new.ts\`, \`<file>.ts\`; standing elsewhere: \`out/report.json\` (ignored) and \`records/log.json\` (the code names it).\n`);
  commit();
  t = check({ POINTERS_BASE: base });
  ok(t.status === 1 && mended(t.out) && /^FAIL: a broken pointer: README\.md:5: `npm run lint` names no script of the package file at the project's root\. Mend: /m.test(t.out) && /^FAIL: a broken pointer: README\.md:5: `lib\/gone\.ts` names no file/m.test(t.out) && /^FAIL: a broken pointer: README\.md:5: `gone\.ts` names no file/m.test(t.out)
    && !/FAIL.*(old\.ts|-w a|notes\.xyz|\*|new\.ts|<file>|report\.json|log\.json)/.test(t.out) && /README\.md:3: `src\/old\.ts` .*base held it/.test(t.out),
    "a name the base did not hold fails, a file's or a package script's, with its mend; one it held is still noted, and a name it cannot resolve exactly, one git ignores and one the code names pass", t.out);
  // (the list: written once, it is what the base holds; it is only lowered, never grown)
  t = check({}, ["--write-names"]);
  const list = () => JSON.parse(fs.readFileSync(path.join(desc, "checks/names.json"), "utf8")).names.map(x => x.name).sort().join(",");
  ok(t.status === 0 && list() === "`gone.ts`,`lib/gone.ts`,`npm run lint`,`src/old.ts`".replaceAll("`", ""), "--write-names writes the list of the names that stand nowhere", t.out);
  put("README.md", OLD.replace("`src/old.ts`", "`src/new.ts`") + "\nAs `lib/gone.ts` and `npm run lint` say.\n");
  t = check({}, ["--write-names"]);
  ok(t.status === 0 && list() === "lib/gone.ts,npm run lint", "written again, it keeps of its names those that still stand nowhere and adds none", list());
  const listed = commit();
  put("README.md", `${OLD.replace("`src/old.ts`", "`src/new.ts`")}\nAs \`lib/gone.ts\`, \`npm run lint\` and \`docs/gone.md\` say.\n`);
  put("src/new.ts", "export {};\n");
  commit();
  t = check({ POINTERS_BASE: listed });
  ok(t.status === 1 && /^FAIL: a broken pointer: README\.md:5: `docs\/gone\.md`/m.test(t.out) && /^note .*`lib\/gone\.ts` .*base held it/m.test(t.out) && /^note .*`npm run lint` .*base held it/m.test(t.out), "where the base holds a list, a name it lists is noted and one it does not fails", t.out);
  // (the manifest's row *descriptions* names what is read: a folder's Markdown files; one naming none is said)
  put("docs/guide.md", "# Guide\n\nSee `src/older.ts`.\n");
  put("core-manifest.md", "# Manifest\n\n| Slot | Value |\n| --- | --- |\n| *descriptions* | `docs/` |\n");
  g("add", "-A");
  t = check();
  ok(t.status === 0 && /`src\/older\.ts`/.test(t.out) && !/README\.md:5/.test(t.out), "the manifest's row *descriptions* names what is read, a folder's Markdown files among it", t.out);
  put("core-manifest.md", "# Manifest\n\n| Slot | Value |\n| --- | --- |\n| *descriptions* | the project's README and `AGENTS.md` |\n");
  g("add", "-A");
  t = check();
  ok(t.status === 0 && /^note .*README\.md:\d+: `lib\/gone\.ts`/m.test(t.out) && !/`src\/older\.ts`/.test(t.out), "the row as the starter kit writes it, \"the project's README\" outside code marks, reads the README at the root", t.out);
  put("core-manifest.md", "# Manifest\n\n| Slot | Value |\n| --- | --- |\n| *descriptions* | the rulebook |\n");
  g("add", "-A");
  t = check();
  ok(t.status === 0 && /^note the manifest's row \*descriptions\* names no tracked file or folder in code marks, nor the README, so no names in the descriptions were read/m.test(t.out), "a row that names no tracked file reads none, and says so", t.out);
  // a description that is a link is noted and never followed, and the names searched for in the code are capped
  put("core-manifest.md", "# Manifest\n\n| Slot | Value |\n| --- | --- |\n| *descriptions* | `docs/link.md` and `docs/many.md` |\n");
  put("docs/many.md", `# Many\n\n\`records/log.json\` ${Array.from({ length: SEARCHED }, (_, i) => `\`gone/n${i}.ts\``).join(" ")}\n`);
  let linked = true;
  try { fs.symlinkSync("guide.md", path.join(desc, "docs/link.md")); } catch { linked = false; }
  g("add", "-A");
  t = check();
  const noted = t.out.match(/^note a name in a description that stands nowhere: docs\/many\.md/gmu)?.length ?? 0;
  ok(t.status === 0 && noted === SEARCHED - 1 && /^note 1 names in the descriptions were left alone: /m.test(t.out) && !/`records\/log\.json`/.test(t.out), `past ${SEARCHED} names, the rest are left alone and counted, and the code is searched for the others in one run`, t.out.slice(-600));
  if (linked) ok(/^note docs\/link\.md is a link or no regular file/m.test(t.out) && !/docs\/link\.md:/.test(t.out), "a description that is a link is noted and not read", t.out.slice(-600));
  if (linked) {
    // a package file that is a link is read as none, so its scripts are left alone; and no list is written through a link
    fs.rmSync(path.join(desc, "package.json"));
    fs.symlinkSync("README.md", path.join(desc, "package.json"));
    put("docs/many.md", "# Many\n\nRun `npm run nowhere`.\n");
    g("add", "-A");
    t = check();
    ok(t.status === 0 && !/npm run nowhere/.test(t.out), "a package file that is a link is read as none, and its scripts are left alone", t.out.slice(-600));
    fs.rmSync(path.join(desc, "checks/names.json"), { force: true });
    fs.symlinkSync("../README.md", path.join(desc, "checks/names.json"));
    const before = fs.readFileSync(path.join(desc, "README.md"), "utf8");
    t = check({}, ["--write-names"]);
    ok(t.status === 1 && mended(t.out) && fs.readFileSync(path.join(desc, "README.md"), "utf8") === before, "--write-names writes nothing through a list that is a link, and says the mend", t.out);
    // a name that lies past a tracked link is not asked of git's ignore rules, so a name after it that git ignores still reads so
    fs.rmSync(path.join(desc, "checks/names.json"));
    fs.symlinkSync("src", path.join(desc, "srclink"));
    put("docs/many.md", "# Many\n\n`srclink/gone.ts` and `out/other.json`.\n");
    g("add", "-A");
    t = check();
    ok(t.status === 0 && /srclink\/gone\.ts/.test(t.out) && !/out\/other\.json/.test(t.out), "a name past a tracked link leaves the names after it that git ignores read as ignored", t.out.slice(-600));
  }
} finally { fs.rmSync(desc, { recursive: true, force: true }); }
// the core's own run: there every name that stands nowhere fails, and no list is kept
const coreDir = scratchDir("names-test-core-");
try {
  const put = (f, text) => { fs.mkdirSync(path.join(coreDir, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(coreDir, f), text); };
  put("floor/security.md", "# The floor\n\n**1. Nothing secret.** Text.\n");
  put("floor/topics.md", "# Topics\n\n**10. Licences.** Text.\n");
  put("tasks/a.md", "# A module\n\nNothing cited.\n");
  carry(coreDir);
  execFileSync("git", ["init", "-q"], { cwd: coreDir, stdio: "ignore" });
  const core = (file, text) => { put(file, text); execFileSync("git", ["add", "-A"], { cwd: coreDir, stdio: "ignore" }); const r = spawnSync(process.execPath, [path.join(coreDir, "scripts/pointers.mjs"), "--core"], { cwd: coreDir, encoding: "utf8" }); return { status: r.status, out: r.stdout + r.stderr }; };
  // (the core's description is its README: a name under core/ is the core's own, one under a folder it does not hold a
  // project's, left alone, and one that stands nowhere fails)
  const readme = core("README.md", "# The core\n\nIt holds `core/tasks/a.md` and `floor/topics.md`; a project holds `docs/PROGRESS.md`.\n");
  ok(readme.status === 0 && /and [1-9]\d* names in the descriptions lead somewhere/.test(readme.out), "in the core's own run its README's names are read: core/ is the core, and a folder it does not hold a project's", readme.out);
  const gone = core("README.md", "# The core\n\nIt holds `tasks/names-test-gone.md`.\n");
  ok(gone.status === 1 && mended(gone.out) && /FAIL: a broken pointer: README\.md:3: `tasks\/names-test-gone\.md` names no file the project tracks\. Mend: /.test(gone.out), "and a name there that stands nowhere fails", gone.out);
  fs.rmSync(path.join(coreDir, "README.md"));
  execFileSync("git", ["add", "-A"], { cwd: coreDir, stdio: "ignore" });
  const listless = spawnSync(process.execPath, [path.join(coreDir, "scripts/pointers.mjs"), "--core", "--write-names"], { cwd: coreDir, encoding: "utf8" });
  ok(listless.status === 1 && mended(listless.stdout + listless.stderr), "the core keeps no list of names", listless.stdout + listless.stderr);
} finally { fs.rmSync(coreDir, { recursive: true, force: true }); }
// each name is looked up once, not against every tracked path: 40,000 names that stand nowhere among 10,000 tracked
// files are read in seconds (Codex's code review on #1195: they took a CPU for over 40 seconds)
{
  const tracked = Array.from({ length: 10000 }, (_, i) => `src/deep/f${i}.ts`);
  const text = Array.from({ length: 40000 }, (_, i) => `\`gone${i}.ts\``).join(" ");
  const started = Date.now();
  const r = brokenNames({ read: () => null, tracked, blocksOf: () => [{ i: 0, text }], core: true });
  const took = Date.now() - started;
  ok(r.count === 40000 && took < 10000, "many names among many tracked paths are read in seconds, each looked up once", `${r.count} names in ${took} ms`);
}
// and the index of the tracked paths is bounded by depth: four paths of 2,000 segments are indexed in seconds, and a name
// deeper than DEEPEST is left alone and counted (the fallback security review on #1195: 29 s and 450 MB for one before)
{
  const deep = Array.from({ length: 2000 }, () => "a").join("/");
  const tracked = ["b", "c", "d", "e"].map(x => `${deep}/${x}.ts`);
  // (a name of exactly DEEPEST segments that stands is read and stands; one as deep as the tracked paths is left alone)
  const edge = `${Array.from({ length: DEEPEST - 1 }, () => "a").join("/")}/b.ts`;
  const started = Date.now();
  const r = brokenNames({ read: () => null, tracked, blocksOf: () => [{ i: 0, text: `\`a/a/b.ts\` \`a/z.ts\` \`${edge}\` \`${tracked[0]}\`` }], core: true });
  const took = Date.now() - started;
  ok(took < 10000 && r.count === 3 && r.left >= 1 && !r.found.some(x => x.name === "a/a/b.ts" || x.name === edge), `deep tracked paths are indexed in seconds, a name of ${DEEPEST} segments is read, and one past it is left alone and counted`, `${took} ms, ${JSON.stringify({ count: r.count, left: r.left, found: r.found.map(x => x.name.slice(0, 40)) })}`);
}
process.exit(failed ? 1 : 0);
