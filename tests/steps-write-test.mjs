// Tests the steps' writers (steps.mjs --write, step-writers.mjs; #1091) on a project the starter kit of this commit
// writes in a scratch folder, committed: each step a writer does whole, taken out, reads done after `--write`, the
// project's rule files keeping their words, a baseline skipped by the size marks; the step of the rules' move and that of the agent tools' files written as far
// as they are exact, the rest left to their mends; a file with changes not yet committed (but the pins a sync moved), a writer that cannot run, a
// step the manifest declares undone on purpose, a file git ignores and a run outside the copy write nothing; `--aside` sets what it
// wrote aside in a stash, which brings it back; and the key merge of the checks' configs (#1095, point 5). Node's own modules and git.
//
//   node tests/steps-write-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { STAGES } from "../scripts/steps-stage.mjs";
import { declare, kitIn, ruleTexts, wordsKept } from "../scripts/steps-kit.mjs";
import { ASIDE, MOVED_GLOB, MOVED_GLOBS, STEPS, notDone, report, setAside, writeReport } from "../scripts/steps.mjs";
import { OLD_PATHS, Unwritten, held, oldPathsIn, writable, writeShape } from "../scripts/step-writers.mjs";
import { MANIFEST, pinsBack, pinsOf } from "../scripts/sync-pins.mjs";
import { CORE } from "../scripts/core-address.mjs";
import { root, scratchDir, tally } from "../scripts/scratch-core.mjs";
import { MERGED } from "../scripts/converge.mjs";
import { scanMend } from "../scripts/shape.mjs";

const { ok, done } = tally();
const dir = kitIn(scratchDir("steps-write-"))("an-npm-project", { packages: "." });
const git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" });
const commit = what => { git("add", "-A"); git("commit", "-q", "--allow-empty", "-m", what); };
const write = (...args) => spawnSync(process.execPath, ["core/scripts/steps.mjs", "--write", ...args], { cwd: dir, encoding: "utf8" });
const crlf = text => text.replace(/\r?\n/gu, "\r\n"), raw = f => fs.readFileSync(path.join(dir, f), "utf8"), read = f => raw(f).replace(/\r\n/gu, "\n");
const put = (f, text) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), text); };
const missed = lead => notDone(dir).filter(m => m.lead === lead);
const dirty = () => git("status", "--porcelain", "--untracked-files=all").trim();
commit("the starter kit");
const kit = git("rev-parse", "HEAD").trim(), rules = ruleTexts(dir);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const back = () => { git("reset", "-q", "--hard", kit); git("clean", "-qfd"); };

// (the reading of a rule file's words: two pull-ins that now lead to one file read as one, a pull-in dropped as words changed)
ok(wordsKept({ "A.md": "@core/modules/work-flow.md\n@core/x.md\n@core/modules/git.md\n" }, { "A.md": "@core/roles/shared/work-flow.md\n@core/x.md\n" })
  && !wordsKept({ "A.md": "@AGENTS.md\n@core/floor/security.md\n@core/roles/builder.md\n" }, { "A.md": "@AGENTS.md\n@core/roles/builder.md\n" }), "a rule file's words: two pull-ins the move makes one are kept, a pull-in dropped is not");

// ---- a project with every step done: nothing written ----
let r = write();
ok(r.status === 0 && r.stdout.startsWith("No step left a script could write") && !dirty(), "on the starter kit's project, every step done, --write writes nothing and says so", `${r.stdout}${r.stderr}`);

// ---- each step a writer does whole, taken out: done after --write, the rule files' words kept ----
const lead = n => STEPS.find(s => s.lead.startsWith(n)).lead;
const WHOLE = ["14 November 2026, the size marks' total", "16 November 2026, how code is put together", "18 November 2026, the shape check reads C#", "19 November 2026, the shape check reads the functions of JavaScript", "19 November 2026, the shape check reads the functions of Python", "19 November 2026, a project's own rules", "20 November 2026, no workflow holds a line break", "24 November 2026, the size marks read what"].map(lead);
ok(WHOLE.every(l => STEPS.find(s => s.lead === l).write && STAGES[l]), "each step a writer does whole has its writer and its stage", WHOLE.join("\n"));
for (const l of WHOLE) {
  STAGES[l].stage(dir);
  commit(`staged: ${l}`);
  const before = missed(l).length;
  r = write();
  // (the shape check's baseline named under the size marks' "skip": #1247, point 2)
  const skipped = l !== WHOLE[1] || JSON.parse(read("checks/sizes.json")).skip.includes("checks/shape-baseline.json");
  // (each step that writes the shape baseline names on its line what a project's own scan of paths named does about it,
  // which the core cannot read: #1289)
  const line = r.stdout.split("\n").find(x => x.startsWith(`- ${l}: wrote `)) ?? "";
  const scan = STEPS.find(s => s.lead === l).write !== writeShape || line.includes(`the step is done; left to the project: ${scanMend("checks/shape-baseline.json")}.`);
  ok(before === 1 && r.status === 0 && !missed(l).length && line && r.stdout.includes("the step is done") && wordsKept(rules, ruleTexts(dir)) && skipped && scan,
    `"${l}", taken out, is written by --write: it reads done after it, no rule file's words changed, a baseline skipped by the size marks, and each shape baseline's writer's line naming what a project's own scan of paths does about it`, `${r.stdout}${r.stderr}\n---\n${report(notDone(dir))}`);
  back();
}

// ---- the size marks: a mark the check fails as shrunk lowered to what its failure gives (a step a check of the
// project's holds, which steps.mjs reads no answer of) ----
{
  const marks = JSON.parse(read("checks/sizes.json")), [f] = Object.keys(marks.read), was = marks.read[f];
  put("checks/sizes.json", `${JSON.stringify({ ...marks, read: { ...marks.read, [f]: Math.max(was, marks.each) + 4096 } }, null, 2)}\n`);
  commit("a mark past its file");
  const check = () => spawnSync(process.execPath, ["core/scripts/reading-size.mjs", "checks/sizes.json"], { cwd: dir, encoding: "utf8", env: { ...process.env, SIZES_BASE: "" } });
  const failed = check().status;
  r = write();
  ok(failed === 1 && check().status === 0 && JSON.parse(read("checks/sizes.json")).read[f] === Math.max(fs.statSync(path.join(dir, f)).size, marks.each) && r.stdout.includes("wrote `checks/sizes.json`"),
    "a size mark the reading-size check fails as shrunk is lowered by --write to what its failure gives, and the check passes", `${r.stdout}${r.stderr}`);
  back();
}

// ---- the rules' move: an old path that leads to one file, a copies config of the old folder alone and the manifest's
// "Paths:" line of releases 1 to 5, all written; the cases that need judgement left to the mend ----
{
  const l = lead("16 November 2026, the rules in folders"), agents = read("AGENTS.md"), copies = read("checks/copies.json"), manifest = read("core-manifest.md");
  ok(agents.includes("@core/roles/shared/how-to-work.md") && copies.includes(`${MOVED_GLOB}, ${MOVED_GLOBS}`) && /^Paths: .*$/mu.test(manifest), "the kit's project names how-to-work.md, the copies config's patterns and the manifest's line the case moves");
  put("AGENTS.md", agents.replace("<!-- The core's part:", "@core/modules/how-to-work.md\n<!-- The core's part:"));
  put("checks/copies.json", copies.split(`${MOVED_GLOB}, ${MOVED_GLOBS}`).join(MOVED_GLOB));
  put("core-manifest.md", manifest.replace(/^Paths: .*$/mu, OLD_PATHS));
  commit("the paths before the move");
  const before = missed(l).length;
  r = write();
  ok(before === 1 && !missed(l).length && read("AGENTS.md") === agents && read("checks/copies.json") === copies && read("core-manifest.md") === manifest,
    "the rules' move, where each path leads to one file: --write writes each as the kit does now, and the step reads done", `${r.stdout}${r.stderr}\n---\n${report(notDone(dir))}`);
  back();
  // (the step's own stage: two old paths that lead to one file, a rule that left its file, and a "Paths:" line in no
  // kit's words; the rule file written as the step's mend writes it, each path on its own, even marked generated, but
  // another file git's attributes mark so, and the step still asks the "Paths:" line: #1248, point 5)
  STAGES[l].stage(dir);
  put(".gitattributes", "gen/** linguist-generated\nAGENTS.md linguist-generated\n");
  fs.mkdirSync(path.join(dir, "gen"));
  put("gen/out.md", "From `core/modules/git.md`.\n");
  commit("the paths the step's stage plants");
  const staged = { manifest: read("core-manifest.md"), record: read("docs/records/2026-01-05.md"), gen: read("gen/out.md") };
  r = write();
  const left = missed(l)[0]?.mend ?? "", wrote = read("AGENTS.md"), kept = [read("core-manifest.md"), read("gen/out.md")].join() === [staged.manifest, staged.gen].join();
  const marks = JSON.parse(read("checks/sizes.json")).read;
  STAGES[l].mend(dir);
  ok(r.stdout.includes(`- ${l}: wrote \`AGENTS.md\`, \`checks/copies.json\`, \`checks/sizes.json\`; still to do: `) && marks["core/roles/shared/work-flow.md"] === 20480 && !Object.keys(marks).some(f => f.includes("modules/")) && read("AGENTS.md") === wrote && kept && read("docs/records/2026-01-05.md") === staged.record
    && !left.includes("core/modules/") && left.includes('"Paths:"') && !left.includes(MOVED_GLOB),
    "the rules' move: --write writes each path on its own as the mend does, two pull-ins of one file made one, the size marks merged, a dated record and a generated file left, and the step asks the rest", `${r.stdout}${r.stderr}\n---\n${left}\n---\n${wrote}`);
  back();
  // (the core's part is never written: an old import above it, whose new path the part holds, is taken out, and an old
  // path inside it stays for the one process to write; #1272, point 1)
  const claude = read("CLAUDE.md"), stale = claude.replace("@core/tools/claude.md\n<!-- The core's part ends.", "@core/modules/claude.md\n<!-- The core's part ends.");
  put("CLAUDE.md", claude.replace("<!-- The core's part:", "@core/modules/claude.md\n<!-- The core's part:"));
  commit("an old import above the core's part");
  r = write();
  ok(read("CLAUDE.md") === claude && r.stdout.includes("wrote `CLAUDE.md`") && !(missed(l)[0]?.mend ?? "").includes("CLAUDE.md"),
    "the rules' move: an old import outside the core's part, whose new path the part holds, is taken out, the part as it stands (#1272, point 1)", `${r.stdout}${r.stderr}\n---\n${read("CLAUDE.md")}`);
  put("CLAUDE.md", stale);
  commit("an old path inside the core's part");
  r = write();
  ok(read("CLAUDE.md") === stale, "  and an old path inside the part is the one process's to write: left as it stands", `${r.stdout}${r.stderr}\n---\n${read("CLAUDE.md")}`);
  back();
  // (only the root's AGENTS.md and CLAUDE.md hold a part the one process writes: marks in another file, copied there, are
  // the project's text, read and written whole)
  fs.mkdirSync(path.join(dir, "packages/app"), { recursive: true });
  put("packages/app/AGENTS.md", "<!-- The core's part: a sync writes it; write yours outside. -->\n@../../core/modules/git.md\n<!-- The core's part ends. -->\n");
  commit("a nested rule file holding the core's marks");
  const nested = missed(l)[0]?.mend ?? "";
  r = write();
  ok(nested.includes("packages/app/AGENTS.md") && read("packages/app/AGENTS.md").includes("@../../core/roles/shared/work-flow.md"),
    "the rules' move: a rule file in a folder, the core's marks in it, is read and written whole, the marks no part of the core's there", `${r.stdout}${r.stderr}\n---\n${nested}\n---\n${read("packages/app/AGENTS.md")}`);
  back();
  // (a file of the project's that is no rule file, no file at the root under a dot and none of the step's configs is
  // written only once .gitattributes says which files a tool writes, and one marked so is left: #1272, point 3)
  fs.mkdirSync(path.join(dir, "notes"));
  fs.mkdirSync(path.join(dir, "gen"));
  put("notes/design.md", "See `core/modules/git.md` and `core/floor/topics.md`.\n");
  put("gen/design.md", "See `core/modules/git.md`.\n");
  commit("old paths in a folder no attribute marks");
  r = write();
  const unmarked = missed(l)[0]?.mend ?? "";
  ok(read("notes/design.md").includes("core/modules/git.md") && read("gen/design.md").includes("core/modules/git.md") && unmarked.includes("`notes/design.md`") && unmarked.includes("`gen/design.md`") && unmarked.includes("linguist-generated") && unmarked.includes(".gitattributes"),
    "the rules' move: with no .gitattributes that says which files a tool writes, --write leaves the project's other files, and the mend asks for the marks (#1272, point 3)", `${r.stdout}${r.stderr}\n---\n${unmarked}`);
  // (each file by its own attribute: a vendored library's own .gitattributes, or one that marks the generated folder
  // alone, says nothing of the notes, which stay left until a line gives them a value)
  fs.mkdirSync(path.join(dir, "vendor"));
  put("vendor/.gitattributes", "*.js linguist-vendored\n");
  put(".gitattributes", "gen/** linguist-generated\n");
  commit("the generated folder marked, the notes not");
  r = write();
  const half = missed(l)[0]?.mend ?? "";
  ok(read("notes/design.md").includes("core/modules/git.md") && half.includes("`notes/design.md`") && !half.includes("`gen/design.md`") && half.includes("* -linguist-generated"),
    "  and with only the generated folder marked, the notes' file, which no attribute decides, is still left and named", `${r.stdout}${r.stderr}\n---\n${half}`);
  put(".gitattributes", "* -linguist-generated\ngen/** linguist-generated\n");
  commit("every other file marked as the project's own");
  r = write();
  ok(read("notes/design.md") === "See `core/roles/shared/work-flow.md` and `core/floor/topics/`.\n" && read("gen/design.md") === "See `core/modules/git.md`.\n" && !missed(l).length,
    "  and once a line gives it its value, --write writes the notes' file (a pointer to the floor's topics.md, which now leads to a folder, to that folder), the marked one left, and the step reads done", `${r.stdout}${r.stderr}\n---\n${report(notDone(dir))}`);
  // (a pointer to topics.md that cites a section or rule, a pull-in, an exclusion, a permission's path, one in a fenced
  // block or a path a script reads would lead into no file or widen to the folder's every file, so only the bare one in
  // Markdown is written: #1361, point 8)
  const cited = ['"Reporting" in `core/floor/topics.md`.', "`core/floor/topics.md`, rule 10.", "rule 10 of `core/floor/topics.md`.", "`core/floor/topics.md` (point 2).",
    "@core/floor/topics.md", "#[[file:core/floor/topics.md]]", "git ls-files ':!core/floor/topics.md'", "Edit(core/floor/topics.md)",
    "Rule 10 of `core/floor/topics.md`.", "`core/floor/topics.md`'s rule 10.", 'The "Reporting" section of `core/floor/topics.md`.', "Section 3 of `core/floor/topics.md`.",
    "`core/floor/topics.md`: \"Reporting\".", "```", "cat `core/floor/topics.md`", "```"];
  const script = "fs.readFileSync(`core/floor/topics.md`);\n";
  put(".claude/hooks/read.mjs", script);
  put("notes/cited.md", [...cited, "And `core/floor/topics.md` and `core/modules/git.md`.", ""].join("\n"));
  commit("pointers to topics.md that cite in it, pull it in or name it in a pattern");
  r = write();
  const citedLeft = missed(l)[0]?.mend ?? "";
  ok(read("notes/cited.md") === [...cited, "And `core/floor/topics/` and `core/roles/shared/work-flow.md`.", ""].join("\n") && read(".claude/hooks/read.mjs") === script && citedLeft.includes("`notes/cited.md`"),
    "  and of the pointers to topics.md only the bare one in Markdown is written as the folder: one citing a section or rule, a pull-in, an exclusion, a permission's path, one in a fenced block or in a script is left for the step's mend", `${r.stdout}${r.stderr}\n---\n${read("notes/cited.md")}\n---\n${citedLeft}`);
  back();
}

// ---- the agent tools' files: the copies listed by the check's own --tools, the pointer that leads nowhere left to the mend ----
{
  const l = lead("16 November 2026, the agent tools' files");
  STAGES[l].stage(dir);
  commit("an agent tool's file with a copy and a pointer that leads nowhere");
  const asked = missed(l)[0]?.mend ?? "", staged = ruleTexts(dir);
  r = write();
  const left = missed(l)[0]?.mend ?? "";
  ok(asked.includes("--tools") && r.stdout.includes(`- ${l}: wrote \`checks/copies-baseline.json\``) && left.includes("staged-nowhere.md") && !left.includes("--tools") && wordsKept(staged, ruleTexts(dir)),
    "the agent tools' files: --write lists the copies with the check's --tools, and the step asks the pointer alone", `${r.stdout}${r.stderr}\n---\n${left}`);
  back();
}

// ---- nothing written: a file with changes not yet committed, a writer that cannot run, a step declared undone, a run
// outside the copy ----
{
  const l = lead("19 November 2026, a project's own rules");
  STAGES[l].stage(dir);
  r = write();
  ok(r.stdout.includes(`- ${l}: wrote nothing, since \`checks/holders.json\` has changes not yet committed`) && !fs.existsSync(path.join(dir, "checks/holders.json")),
    "a file with changes not yet committed (here taken out) is never written: --write says so and writes nothing", `${r.stdout}${r.stderr}`);
  // (at a sync, whose own changes are not yet committed: the run says to write again once the sync merges, with the
  // command, and sets nothing aside, so one command then writes it all: #1259, point 2)
  const before = dirty();
  r = write("--aside");
  ok(r.status === 0 && /once this sync's pull request merges, on a fresh branch from `main`, run `node core\/scripts\/steps\.mjs --write`/u.test(r.stdout) && r.stdout.includes("`checks/holders.json`") && !git("stash", "list").trim() && dirty() === before,
    "at a sync, a writer kept from a file by changes not yet committed is said, with the command to run once the sync merges, and nothing is set aside", `${r.stdout}${r.stderr}`);
  back();
  STAGES[l].stage(dir);
  fs.mkdirSync(path.join(dir, "checks/holders.json"));
  put("checks/holders.json/x", "x\n");
  commit("a folder where the list stands");
  r = write();
  ok(r.status === 0 && r.stdout.includes(`- ${l}: wrote nothing, since \`checks/holders.json\` is no regular file`) && !dirty(), "a writer that cannot write its file says why and writes nothing", `${r.stdout}${r.stderr}`);
  back();
  STAGES[l].stage(dir);
  put(".gitignore", `${fs.existsSync(path.join(dir, ".gitignore")) ? read(".gitignore") : ""}checks/holders.json\n`);
  commit("the list ignored");
  r = write();
  ok(r.status === 0 && r.stdout.includes(`- ${l}: wrote nothing, since git ignores \`checks/holders.json\``) && !fs.existsSync(path.join(dir, "checks/holders.json")) && !dirty(),
    "a file git ignores, which no stash could set aside, is never written: --write says so and writes nothing", `${r.stdout}${r.stderr}`);
  back();
  STAGES[l].stage(dir);
  declare(dir, `"${l}": the owner's word`);
  commit("declared");
  r = write();
  ok(r.status === 0 && !r.stdout.includes(l) && !dirty(), "a step the manifest declares undone on purpose is not written", `${r.stdout}${r.stderr}`);
  back();
  STAGES[l].stage(dir);
  commit("taken out");
  r = spawnSync(process.execPath, [path.join(root, "scripts/steps.mjs"), "--write"], { cwd: dir, encoding: "utf8" });
  ok(r.status === 1 && /^FAIL: .*the copy's own script.*Mend: /u.test(r.stderr) && !dirty(), "run as another script than the copy's, it refuses with its mend and writes nothing", `${r.stdout}${r.stderr}`);

  // ---- --aside: what it wrote set aside in a stash, which brings it back; a change of the sync's own, not yet
  // committed, left where it stands ----
  put("sync-own.md", "the sync's own\n");
  r = write("--aside");
  const stashed = git("stash", "list"), named = out => /set aside in the stash "([^"]+)"/u.exec(out)?.[1] ?? "", name = named(r.stdout);
  ok(r.status === 0 && name.startsWith(ASIDE) && /, \d{4}-\d\d-\d\dT[\d:.]+Z$/u.test(name) && r.stdout.includes(`N the number it gives the stash "${name}"`) && dirty() === "?? sync-own.md" && stashed.includes(name) && missed(l).length === 1,
    "--aside sets what it wrote aside in a stash named by the time, the tree as it stood, the sync's own change left out of it, and names the stash to pop", `${r.stdout}${r.stderr}\n${stashed}\n${dirty()}`);
  r = write("--aside");
  const second = named(r.stdout), both = git("stash", "list");
  ok(second && second !== name && both.includes(name) && both.includes(second), "run again, as a sync run again at its pin is, it sets its writes aside under a name of their own, which its report names, never the earlier's (#1264)", `${r.stdout}\n${both}`);
  git("stash", "drop", "-q", "stash@{0}");
  git("stash", "pop", "-q");
  ok(!missed(l).length && read("sync-own.md") === "the sync's own\n", "and the stash, popped, brings it back: the step reads done", report(notDone(dir)));
  back();
  // (a path that is not plain is refused; paths reach git as written, never as patterns; an old path inside a longer
  // name is no old path)
  const refused = f => { try { writable({ root: dir }, f, new Set()); return false; } catch (e) { return e instanceof Unwritten; } };
  ok(refused("./checks/holders.json") && refused("checks/../checks/holders.json") && !refused("checks/holders.json"), "a path that is not plain is never written");
  put("a[b].json", "{}\n");
  put("ab.json", "{}\n");
  commit("two names a pattern would mix up");
  put("a[b].json", "{ }\n");
  put("ab.json", "{ }\n");
  ok(setAside(dir, ["a[b].json"]) && dirty() === "M ab.json" && read("a[b].json") === "{}\n", "a name with [ or * is set aside as written, never as a pattern that takes another file", dirty());
  git("stash", "drop", "-q");
  back();
  const old = oldPathsIn({ "rules/git.md": "floor/topics/git.md" }), hits = t => [...t.matchAll(old)].map(m => m[1]);
  ok(hits("see core/rules/git.md, `core/rules/git.md`.").length === 2 && !hits("hardcore/rules/git.md my-core/rules/git.md core/rules/git.md.bak core/rules/git.mdx core/rules/git.md/x").length,
    "an old path is read alone, never inside a longer name", hits("hardcore/rules/git.md my-core/rules/git.md core/rules/git.md.bak core/rules/git.mdx core/rules/git.md/x").join());
  // (git refusing the stash after it staged what it was given: each file it wrote put back as it stood, index and tree,
  // a new one taken out, and the report says to write them after the merge)
  STAGES[l].stage(dir);
  const stamped = "checks/sizes.json", stood = read(stamped);
  commit("taken out");
  put(stamped, `${stood} `);
  put("checks/holders.json", "{}\n");
  const kept = setAside(dir, [stamped, "checks/holders.json"], () => { git("add", "--", stamped, "checks/holders.json"); throw new Error("no stash"); });
  ok(kept === false && read(stamped) === stood && !fs.existsSync(path.join(dir, "checks/holders.json")) && !dirty() && writeReport([{ lead: l, wrote: [stamped], mend: null }], "put back").includes("put back as they stood"),
    "where git cannot make the stash, each file the writers wrote is put back as it stood, a new one taken out, and the report says to write them after the merge", dirty());
  back();
}

// ---- the modules a list neither takes nor leaves out: placed by --write from what is read, the manifest's module lines
// alone written, and the one taken by choice asked of the owner (#1094) ----
{
  const [placing, choice, confirm] = [lead("13 November 2026, the modules a project takes"), lead("16 November 2026, how done will be judged"), lead("23 November 2026, the modules a project takes, placed")];
  STAGES[placing].stage(dir);
  STAGES[choice].stage(dir);
  commit("two modules neither taken nor left out");
  const before = [placing, choice].map(l => missed(l).length), was = read("core-manifest.md");
  r = write();
  const now = read("core-manifest.md"), outside = text => text.replace(/\n\nModules to confirm: [^\n]*/u, "").split("\n").filter(l => !/^(Floor: |Not taken: |Modules to confirm: )/u.test(l)).join("\n");
  ok(before.join() === "1,1" && r.status === 0 && !missed(placing).length && !missed(choice).length && missed(confirm).length === 1 && r.stdout.includes(`- ${placing}: wrote \`core-manifest.md\``)
    && /^Not taken: `game-design\.md` \(the project is no game: its manifest holds no game's row\)\.$/m.test(now) && /\n\nModules to confirm: `done-when\.md`\.\n/u.test(now) && /^Floor: whole\. Modules: .*`done-when\.md`/m.test(now) && outside(now) === outside(was),
    "a module the list misses is placed by --write: left out where a fact decides it, taken and asked of the owner where none does, and nothing of the manifest written but its module lines", `${r.stdout}${r.stderr}\n---\n${now}`);
  back();
  // (at a sync, which moves the pin first: the module lines set aside, the moved pin left for the sync's pull request,
  // and the stash popped onto its merge)
  STAGES[placing].stage(dir);
  commit("a module neither taken nor left out");
  const moved = raw("core-manifest.md").replace(/^(Core: .*?)\b[0-9a-f]{40}\b/mu, `$1${"c".repeat(40)}`), pin = /^Core: .*$/mu.exec(moved)[0];
  put("core-manifest.md", moved);
  r = write("--aside");
  const left = raw("core-manifest.md");
  ok(r.status === 0 && r.stdout.includes(`- ${placing}: wrote \`core-manifest.md\``) && r.stdout.includes(`set aside in the stash "${ASIDE} at ${"c".repeat(7)}, `) && left === moved && dirty() === "M core-manifest.md",
    "at a sync that moved the manifest's pin, --aside writes its module lines and sets them aside, the moved pin left where the sync put it", `${r.stdout}${r.stderr}\n---\n${left}\n---\n${dirty()}`);
  commit("the sync's pull request, merged");
  git("stash", "pop", "-q");
  ok(!missed(placing).length && read("core-manifest.md").includes(`${pin}\n`), "and the stash, popped once the sync merged, brings the module lines back on the moved pin", read("core-manifest.md"));
  back();
  // (the same where git writes the tree with Windows line ends: the manifest keeps them)
  STAGES[placing].stage(dir);
  commit("a module neither taken nor left out");
  git("config", "core.autocrlf", "true");
  put("core-manifest.md", crlf(moved));
  r = write();
  ok(r.status === 0 && r.stdout.includes(`- ${placing}: wrote \`core-manifest.md\``) && /^([^\n]*\r\n)+$/u.test(raw("core-manifest.md")), "and where the tree holds the manifest with Windows line ends", `${r.stdout}${r.stderr}`);
  git("config", "--unset", "core.autocrlf");
  back();
  // (and, where git leaves line ends as they are, a tree with Windows ones over the blob's: the stash leaves the blob's,
  // and the moved pin is put back with no line end of its own)
  STAGES[placing].stage(dir);
  commit("a module neither taken nor left out");
  put("core-manifest.md", crlf(moved));
  r = write("--aside");
  ok(r.status === 0 && raw("core-manifest.md") === moved, "and with --aside, the pin put back on a file whose line ends the stash changed, keeping them", JSON.stringify(read("core-manifest.md").slice(0, 300)));
  back();
  STAGES[placing].stage(dir);
  commit("a module neither taken nor left out");
  fs.rmSync(path.join(dir, "core-manifest.md"));
  r = write();
  ok(r.status === 0 && !r.stdout.includes(`- ${placing}: wrote \`core-manifest.md\``) && !fs.existsSync(path.join(dir, "core-manifest.md")), "a manifest taken out and not yet committed is written by none, and --write fails nothing", `${r.stdout}${r.stderr}`);
  back();
}

// (a workflow the sync changed in its calls' pins alone is let through to the writers, and its moved pin put back after
// they are set aside (scripts/sync-pins.mjs); one changed beyond them is held: #1248, point 4)
{
  const wf = ".github/workflows/own.yml", calls = (sha, note) => `# ${note}\njobs:\n  core:\n    uses: ${CORE.toLowerCase()}/.github/workflows/core.yml@${sha}\n`;
  fs.mkdirSync(path.join(dir, ".github/workflows"), { recursive: true });
  put(wf, calls("a".repeat(40), "see core/x.md"));
  commit("a call to the core");
  put(wf, calls("c".repeat(40), "see core/x.md"));
  const through = !held(dir).has(wf);
  put(wf, calls("c".repeat(40), "see core/y.md"));
  ok(through && held(dir).has(wf) && setAside(dir, [wf]) && read(wf) === calls("c".repeat(40), "see core/x.md") && dirty() === `M ${wf}`,
    "a workflow whose calls' pins alone the sync moved is written, its write set aside and the moved pin put back; one changed beyond them is held", read(wf));
  git("stash", "drop", "-q");
  // (the manifest's first `Core:` line alone is its pin; a file whose count of pins changed is left and named)
  put(MANIFEST, "Core: a\nCore: b\n");
  const pins = pinsOf(dir, [MANIFEST, wf]);
  put(wf, calls("d".repeat(40), "two").replace("jobs:", `# ${CORE}/.github/workflows/x.yml@${"e".repeat(40)}\njobs:`));
  ok(same(pins[MANIFEST], ["Core: a"]) && same(pinsBack(dir, pins), [wf]) && read(wf).includes("d".repeat(40)), "the manifest's first `Core:` line is its pin, and a file whose pins changed in count is left and named", JSON.stringify(pins));
  back();
}

// (the module lines read past in the manifest alone, never in another rule file)
{
  const m = "Floor: whole. Modules: `a.md`.\n", t = { "core-manifest.md": m, "AGENTS.md": m };
  ok(wordsKept(t, { ...t, "core-manifest.md": "Floor: whole. Modules: `a.md`, `b.md`.\n\nModules to confirm: `b.md`.\n" }) && !wordsKept(t, { ...t, "AGENTS.md": "Floor: whole. Modules: `b.md`.\n" }),
    "the words kept read past the module lines of the manifest, and of no other rule file");
}

// ---- the key merge (converge.mjs, `merged`; #1095, point 5) ----
{
  const json = f => JSON.parse(read(f)), copies = json("checks/copies.json"), shape = json("checks/shape.json"), lic = json("checks/licences.json");
  delete copies.proseFromSecurity;
  delete copies.code;
  copies.prose = ["docs/*.md"];
  delete shape.tests;
  delete shape.systems;
  delete lic.scan.skip;
  delete lic.ships;
  delete lic.scan.served;
  put("checks/copies.json", `${JSON.stringify(copies, null, 4)}\n`);
  put("checks/shape.json", `${JSON.stringify(shape, null, 2)}\n`);
  put("checks/licences.json", `${JSON.stringify(lic, null, 2)}\n`);
  commit("configs that lack keys of the kit's and hold values of the project's");
  r = write();
  const [c, s, l] = ["checks/copies.json", "checks/shape.json", "checks/licences.json"].map(json);
  ok(r.status === 0 && r.stdout.includes(`- ${MERGED}: wrote `) && ["copies", "shape", "licences"].every(n => r.stdout.includes(`checks/${n}.json`))
    && Array.isArray(c.code) && !c.code.length && c.prose.join() === "docs/*.md" && read("checks/copies.json").startsWith('{\n    "')
    && s.systems && !Object.keys(s.systems).length && Array.isArray(l.scan.skip) && !l.scan.skip.length,
  "--write adds the kit's keys a config lacks whose value reads nothing, at any depth, keeping the project's values and indent", `${r.stdout}${r.stderr}`);
  ok(!("proseFromSecurity" in c) && !("tests" in s) && !("ships" in l) && !("served" in l.scan), "a key that has a check read more, or whose absence fails (what ships or is served), is not added", JSON.stringify([c, s, l]));
  r = write();
  ok(r.status === 0 && !r.stdout.includes(MERGED), "run again, it writes nothing more", r.stdout);
  back();
  put("checks/copies.json", `${JSON.stringify({ ...json("checks/copies.json"), code: undefined }, null, 2)}\n`);
  put("checks/shape.json", "[]\n");
  commit("a config that lacks a key, and one that is no JSON object");
  put("checks/copies.json", `${read("checks/copies.json")} `);
  r = write();
  ok(r.status === 0 && r.stdout.includes("checks/copies.json` has changes not yet committed") && r.stdout.includes("`checks/shape.json` is no JSON object") && read("checks/shape.json") === "[]\n" && !("code" in json("checks/copies.json")),
    "a config with changes not committed, or no JSON object, is left, and the report says why", r.stdout);
  back();
}

done("the steps' writers");
