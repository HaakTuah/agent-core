// Checks the words check (scripts/general.mjs) on a scratch repository: a word that fits only some projects
// fails in the floor or a module; under the dated records' folders a gendered pronoun fails only in a line a change
// adds, read against the base, and not in a line quoting the owner, nor in an older line, nor without a base. A phrase
// a rule may not use fails in a line a change adds to a rule file and is only reported where it stood before, moved
// word for word, quoted, in code marks or read without a base; so does one in a Markdown template of a folder the list
// names, among them a title or a stake a brief may not give (#282). On Linux and on Windows. Git and Node's own modules.
//
//   node tests/general-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mended } from "../scripts/mend.mjs";
import { scratchDir } from "../scripts/scratch-core.mjs";

let failed = 0, count = 0;
const ok = (cond, what, detail = "") => { count++; if (cond) console.log(`ok   ${what}`); else { failed++; console.error(`FAIL ${what}${detail && `\n     ${String(detail).slice(0, 600).replace(/\n/g, "\n     ")}`}`); } };
const script = fileURLToPath(new URL("../scripts/general.mjs", import.meta.url));
const tmp = scratchDir("general-test-");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name)));
Object.assign(env, { GIT_CONFIG_GLOBAL: path.join(tmp, "none"), GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" });
const git = (dir, ...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const config = { paths: ["floor", "tasks"], exempt: [], words: [
  { pattern: "\\bgames?\\b", say: "the project" },
  { pattern: "\\b(he|him|his|himself|she|her|hers|herself)\\b", say: "the owner", added: ["archive", "reports"] }],
  phrases: { paths: ["floor", "tasks", "AGENTS.md"], list: [{ pattern: "\\bshould consider\\b", say: "name who does what" }] } };

let n = 0;
// A repository whose first commit holds `start` and whose second adds `change`; the check's exit and words.
function words(start, change, base = true, json = config) {
  const dir = path.join(tmp, `repo-${++n}`);
  const put = files => { for (const [f, text] of Object.entries(files)) { if (text === null) { fs.rmSync(path.join(dir, f)); continue; } fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); } };
  fs.mkdirSync(dir);
  git(dir, "init", "-q", "-b", "main");
  put({ "floor/a.md": "# The floor\n", "tasks/b.md": "# A module\n", "AGENTS.md": "# Here\n", "general.json": JSON.stringify(json), ...start });
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  put(change);
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "--allow-empty", "-m", "a change");
  const r = spawnSync(process.execPath, [script, "general.json", ...(base ? ["--base", "HEAD^1"] : [])], { cwd: dir, env, encoding: "utf8" });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}
const OLD = "1. **1 November** (a game). The owner said, and he meant it:\n\n   > Fine.\n";

let r = words({}, { "tasks/b.md": "# A module\n\nFor every game.\n" });
ok(r.status === 1 && r.out.includes("tasks/b.md:3") && /fits only some projects\. Mend: say /.test(r.out) && mended(r.out), "a word that fits only some projects fails in a module, by file and line", r.out);
r = words({ "archive/items.md": OLD }, { "archive/items.md": `${OLD}\n2. **2 November**. Asked, he said yes.\n` });
ok(r.status === 1 && r.out.includes("archive/items.md:5:") && !r.out.includes("archive/items.md:1:") && mended(r.out), "a pronoun for the owner in a line a change adds to the archive fails, by its line; the older line in the same file does not", r.out);
r = words({}, { "reports/2026-11-13-x.md": "# A report\n\nThe owner read it, and his answer was yes.\n" });
ok(r.status === 1 && r.out.includes("reports/2026-11-13-x.md:3"), "so does one in a new report", r.out);
// (a file's name the change chooses is printed as text alone, no workflow command read in it; #1348; Windows holds no
// ":" in a name)
if (process.platform !== "win32") {
  r = words({}, { "archive/x::notice::y##[group]z.md": "Asked, he said yes.\n" });
  ok(r.status === 1 && r.out.includes("archive/x: :notice: :y# #[group]z.md:1:") && !/::|##\[/u.test(r.out), "a failing line names a file whose name holds \"::\" and \"##[\" with each pair broken", r.out);
}
r = words({ "archive/items.md": OLD }, { "archive/items.md": `${OLD}\n2. **2 November**. Asked, the owner said:\n\n   > She can have it, he said.\n` });
ok(r.status === 0, "a line quoting the owner's own words is not read: they are kept as said", r.out);
r = words({ "archive/items.md": OLD }, { "floor/a.md": "# The floor\n\nNothing here.\n" });
ok(r.status === 0, "an older record left as it was passes, whatever it holds", r.out);
r = words({}, { "archive/items.md": "Asked, he said yes.\n" }, false);
ok(r.status === 0 && r.out.includes("no --base given"), "without a base the records are not read, and it says so", r.out);
r = words({}, { "archive/items.md": "One.\n++ Asked, he said yes.\nThen she did.\n" });
ok(r.status === 1 && r.out.includes("archive/items.md:2:") && r.out.includes("archive/items.md:3:"), "an added line that starts as a diff's file header does is read as the line it is, and the lines after it keep their numbers", r.out);
r = words({ "archive/old.md": `${OLD}\n2. **2 November**. Then he asked again.\n` }, { "archive/old.md": null, "archive/moved.md": `${OLD}\n2. **2 November**. Then he asked again.\n` });
ok(r.status === 0, "a record moved to another file, its lines taken away and added word for word, is not new text", r.out);
r = words({ "archive/old.md": `${OLD}\n2. **2 November**. Then he asked again.\n` }, { "archive/old.md": null, "archive/moved.md": `${OLD}\n2. **2 November**. Then he asked again.\n`, "reports/new.md": "Then he asked again.\n2. **2 November**. Then he asked again.\n" });
ok(r.status === 1 && /reports\/new\.md:2: "he"/.test(r.out), "a moved line added a second time is new text: each line taken away excuses one", r.out);
// (a model's name, in its own case, outside the tools' parts alone: #467)
const models = { ...config, paths: ["floor", "tasks", "tools"], words: [...config.words, { pattern: "\\b(?:Opus|Fable)\\b", case: true, outside: ["tools"], say: "the tier" }] };
r = words({}, { "tasks/b.md": "# A module\n\nThe builder runs on Opus.\n", "tools/c.md": "# A part\n\nStrongest: Opus. A fable here.\n" }, true, models);
ok(r.status === 1 && r.out.includes("tasks/b.md:3") && !r.out.includes("tools/c.md") && mended(r.out), "a model's name fails in a module and passes in a tool's part (#467)", r.out);
r = words({}, { "tasks/b.md": "# A module\n\nA fable, and an opus.\n", "tools/c.md": "# A part\n" }, true, models);
ok(r.status === 0, "a word matched in its own case passes in another case", r.out);
const bad = spawnSync(process.execPath, [script, "general.json", "--base", "--ext-diff"], { cwd: path.join(tmp, "repo-1"), env, encoding: "utf8" });
const none = spawnSync(process.execPath, [script, "general.json", "--base", "no-such-commit"], { cwd: path.join(tmp, "repo-1"), env, encoding: "utf8" });
ok(bad.status === 1 && none.status === 1 && /--base needs a commit/.test(bad.stdout + none.stdout) && mended(bad.stdout) && mended(none.stdout), "a --base that is an option, or no commit, is refused", `${bad.stdout}${bad.stderr}${none.stdout}`);
r = words({}, { "tasks/b.md": "# A module\n\nAsked, he said yes.\n" });
ok(r.status === 1, "in the floor and the modules the pronoun fails wherever it stands, as before", r.out);

// the phrases a rule may not use
const RULE = "- The builder should consider a test.\n";
r = words({}, { "tasks/b.md": `# A module\n\n${RULE}` });
ok(r.status === 1 && r.out.includes("tasks/b.md:3:") && r.out.includes("in a rule or brief this change writes. Mend: name who does what") && mended(r.out), "a phrase a rule may not use fails in a line a change adds to a module, by file and line", r.out);
r = words({}, { "AGENTS.md": `# Here\n\n${RULE}` });
ok(r.status === 1 && r.out.includes("AGENTS.md:3:"), "and in a line a change adds to a rule file the list names", r.out);
r = words({ "tasks/b.md": `# A module\n\n${RULE}` }, { "floor/a.md": "# The floor\n\nNothing here.\n" });
ok(r.status === 0 && /tasks\/b\.md:3: "should consider" reported/.test(r.out), "one that stood before the change is reported, and passes", r.out);
r = words({ "tasks/b.md": `# A module\n\n${RULE}` }, { "tasks/b.md": "# A module\n", "floor/a.md": `# The floor\n\n${RULE}` });
ok(r.status === 0 && r.out.includes("floor/a.md:3:") && r.out.includes("reported"), "one moved word for word to another rule file is reported, not failed", r.out);
r = words({}, { "tasks/b.md": "# A module\n\n> The owner: we should consider it.\n\n- A phrase is named in code marks: `should consider`.\n" });
ok(r.status === 0 && !r.out.includes("tasks/b.md:"), "one in a line quoting the owner, or in code marks, is not read", r.out);
r = words({}, { "tasks/b.md": `# A module\n\n${RULE}` }, false);
ok(r.status === 0 && r.out.includes("only reported") && r.out.includes("tasks/b.md:3:"), "without a base each is only reported, and it says so", r.out);
r = words({}, { "floor/a.md": "# The floor\n\nNothing here.\n" }, true, { ...config, phrases: { paths: ["floor"], list: [] } });
ok(r.status === 1 && r.out.includes("list of phrases a rule may not use is empty") && mended(r.out), "an empty list of phrases fails: it would pass anything", r.out);
r = words({}, { "floor/a.md": "# The floor\n\nNothing here.\n" }, true, { ...config, phrases: { paths: ["rules"], list: config.phrases.list } });
ok(r.status === 1 && r.out.includes("not there: rules") && mended(r.out), "a file or folder of the list that is not there fails", r.out);

// a brief is written as a rule is (tasks/helpers.md; #282): the list reads the starter kit's templates too, and holds
// a title and a stake that are not real
const kit = { ...config, phrases: { ...config.phrases, paths: [...config.phrases.paths, "setup/template"] } };
r = words({}, { "setup/template/AGENTS.md.tmpl": `# {{project}}\n\n${RULE}`, "setup/template/workflows/a.yml.tmpl": "# should consider\n" }, true, kit);
ok(r.status === 1 && r.out.includes("setup/template/AGENTS.md.tmpl:3:") && !r.out.includes("a.yml.tmpl") && mended(r.out), "one in a line a change adds to a Markdown template of a folder the list names fails; a workflow's template is not read", r.out);
r = words({}, { "tasks/a b.md": `# A module\n\n${RULE}`, "tasks/\u00e9.md": `# A module\n\n${RULE}`, "tasks/more/c.md": `# A module\n\n${RULE}`, "setup/template/x y.md.tmpl": `# {{project}}\n\n${RULE}`, "tasks/z.yml.tmpl": "# should consider\n" }, true, kit);
ok(r.status === 1 && ["tasks/a b.md:3:", "tasks/\u00e9.md:3:", "tasks/more/c.md:3:", "setup/template/x y.md.tmpl:3:", "tasks/z.yml.tmpl:1:"].every(f => r.out.includes(`FAIL ${f}`)), "one added to a file whose name git quotes (a space, a letter beyond ASCII) or that stands in a subfolder fails too, and so does a template of another kind outside a folder of templates", r.out);
const real = JSON.parse(fs.readFileSync(path.join(path.dirname(script), "general.json"), "utf8"));
const primed = { ...kit, phrases: { ...kit.phrases, list: real.phrases.list } };
r = words({}, { "setup/template/AGENTS.md.tmpl": "# {{project}}\n\nYou are a world-class expert in this stack.\nThe fate of the world rests on it, and I will tip you.\n" }, true, primed);
ok(r.status === 1 && r.out.includes("AGENTS.md.tmpl:3:") && r.out.includes("AGENTS.md.tmpl:4:") && /by what it does/.test(r.out) && /real reason/.test(r.out) && mended(r.out), "the core's list fails a brief that calls its reader an expert or gives it stakes that are not real", r.out);
r = words({ "setup/template/AGENTS.md.tmpl": "# {{project}}\n" }, { "tasks/b.md": "# A module\n\n- You built none of this; find what is wrong with it, as a demanding expert would. Its lower stakes stay low.\n" }, true, primed);
ok(r.status === 0, "a role named by what it does, an expert named as a standard and stakes as a measure pass", r.out);

// (only real files of the checkout's own are read: a tracked link is refused, with its mend, and nothing it leads to is
// read; a folder of a file's name is no file)
if (process.platform !== "win32") {
  const dir = path.join(tmp, "links"), outside = path.join(tmp, "outside.md");
  fs.mkdirSync(path.join(dir, "tasks", "d.md"), { recursive: true }); fs.mkdirSync(path.join(dir, "floor"));
  fs.writeFileSync(outside, "For every game.\n"); fs.writeFileSync(path.join(dir, "floor", "a.md"), "# The floor\n"); fs.writeFileSync(path.join(dir, "AGENTS.md"), "# Here\n");
  fs.writeFileSync(path.join(dir, "general.json"), JSON.stringify(config));
  fs.symlinkSync(outside, path.join(dir, "tasks", "c.md")); fs.symlinkSync("/dev/zero", path.join(dir, "tasks", "e.md"));
  git(dir, "init", "-q", "-b", "main"); git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "links");
  const got = spawnSync(process.execPath, [script, "general.json"], { cwd: dir, env, encoding: "utf8", timeout: 60000 }), out = `${got.stdout}${got.stderr}`;
  ok(got.status === 1 && /tasks\/c\.md is a symbolic link/u.test(out) && /tasks\/e\.md is a symbolic link/u.test(out) && !/tasks\/c\.md:1/u.test(out) && !/EISDIR/u.test(out) && mended(out),
    "a tracked link where the rules stand is refused, with its mend, and nothing it leads to is read; a folder of a file's name is none", out);
}

console.log(failed ? `${failed} of ${count} failed` : `ok   ${count} assertions on the words check`);
process.exitCode = failed ? 1 : 0;
