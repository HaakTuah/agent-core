// Tests the steps' writers (steps.mjs --write, step-writers.mjs; #1091) on a project the starter kit of this commit
// writes in a scratch folder, committed: each step a writer does whole, taken out, reads done after `--write`, the
// project's rule files keeping their words; the step of the rules' move and that of the agent tools' files written as far
// as they are exact, the rest left to their mends; a file with changes not yet committed, a writer that cannot run, a
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
import { OLD_PATHS, Unwritten, oldPathsIn, writable } from "../scripts/step-writers.mjs";
import { root, scratchDir, tally } from "../scripts/scratch-core.mjs";
import { MERGED } from "../scripts/converge.mjs";

const { ok, done } = tally();
const dir = kitIn(scratchDir("steps-write-"))("an-npm-project", { packages: "." });
const git = (...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd: dir, encoding: "utf8" });
const commit = what => { git("add", "-A"); git("commit", "-q", "--allow-empty", "-m", what); };
const write = (...args) => spawnSync(process.execPath, ["core/scripts/steps.mjs", "--write", ...args], { cwd: dir, encoding: "utf8" });
const read = f => fs.readFileSync(path.join(dir, f), "utf8");
const put = (f, text) => fs.writeFileSync(path.join(dir, f), text);
const missed = lead => notDone(dir).filter(m => m.lead === lead);
const dirty = () => git("status", "--porcelain", "--untracked-files=all").trim();
commit("the starter kit");
const kit = git("rev-parse", "HEAD").trim(), rules = ruleTexts(dir);
const back = () => { git("reset", "-q", "--hard", kit); git("clean", "-qfd"); };

// ---- a project with every step done: nothing written ----
let r = write();
ok(r.status === 0 && r.stdout.startsWith("No step left a script could write") && !dirty(), "on the starter kit's project, every step done, --write writes nothing and says so", `${r.stdout}${r.stderr}`);

// ---- each step a writer does whole, taken out: done after --write, the rule files' words kept ----
const lead = n => STEPS.find(s => s.lead.startsWith(n)).lead;
const WHOLE = ["14 November 2026, the size marks' total", "16 November 2026, how code is put together", "18 November 2026, the shape check reads C#", "19 November 2026, the shape check reads the functions of JavaScript", "19 November 2026, the shape check reads the functions of Python", "19 November 2026, a project's own rules", "20 November 2026, no workflow holds a line break"].map(lead);
ok(WHOLE.every(l => STEPS.find(s => s.lead === l).write && STAGES[l]), "each step a writer does whole has its writer and its stage", WHOLE.join("\n"));
for (const l of WHOLE) {
  STAGES[l].stage(dir);
  commit(`staged: ${l}`);
  const before = missed(l).length;
  r = write();
  ok(before === 1 && r.status === 0 && !missed(l).length && r.stdout.includes(`- ${l}: wrote `) && r.stdout.includes("the step is done") && wordsKept(rules, ruleTexts(dir)),
    `"${l}", taken out, is written by --write: it reads done after it, and no rule file's words changed`, `${r.stdout}${r.stderr}\n---\n${report(notDone(dir))}`);
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
  put("AGENTS.md", agents.replace("@core/roles/shared/how-to-work.md", "@core/modules/how-to-work.md"));
  put("checks/copies.json", copies.split(`${MOVED_GLOB}, ${MOVED_GLOBS}`).join(MOVED_GLOB));
  put("core-manifest.md", manifest.replace(/^Paths: .*$/mu, OLD_PATHS));
  commit("the paths before the move");
  const before = missed(l).length;
  r = write();
  ok(before === 1 && !missed(l).length && read("AGENTS.md") === agents && read("checks/copies.json") === copies && read("core-manifest.md") === manifest,
    "the rules' move, where each path leads to one file: --write writes each as the kit does now, and the step reads done", `${r.stdout}${r.stderr}\n---\n${report(notDone(dir))}`);
  back();
  // (the step's own stage: two old paths that lead to one file, a rule that left its file, and a "Paths:" line in no
  // kit's words; only the copies config is written, and the step still asks the rest)
  STAGES[l].stage(dir);
  commit("the paths the step's stage plants");
  const staged = { agents: read("AGENTS.md"), manifest: read("core-manifest.md"), record: read("docs/records/2026-01-05.md") };
  r = write();
  const left = missed(l)[0]?.mend ?? "";
  ok(r.stdout.includes(`- ${l}: wrote \`checks/copies.json\`; still to do: `) && read("AGENTS.md") === staged.agents && read("core-manifest.md") === staged.manifest && read("docs/records/2026-01-05.md") === staged.record
    && left.includes("core/modules/git.md") && left.includes('"Paths:"') && !left.includes(MOVED_GLOB),
    "the rules' move, where a path needs judgement: --write writes the copies config alone, leaves the rule files and a dated record as they stand, and the step asks the rest", `${r.stdout}${r.stderr}\n---\n${left}`);
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
  const stashed = git("stash", "list");
  ok(r.status === 0 && r.stdout.includes(`set aside in the stash "${ASIDE}"`) && r.stdout.includes("git stash pop stash@{N}") && dirty() === "?? sync-own.md" && stashed.includes(ASIDE) && missed(l).length === 1,
    "--aside sets what it wrote aside in a stash, the tree as it stood, the sync's own change left out of it, and names the stash to pop", `${r.stdout}${r.stderr}\n${stashed}\n${dirty()}`);
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
  // (at a sync, which moves the manifest's pin before the writers run: the module lines placed and set aside, the
  // moved pin left in the tree for the sync's pull request, and the stash popped onto that pull request's merge)
  STAGES[placing].stage(dir);
  commit("a module neither taken nor left out");
  const moved = read("core-manifest.md").replace(/^(Core: .*?)\b[0-9a-f]{40}\b/mu, `$1${"c".repeat(40)}`), pin = /^Core: .*$/mu.exec(moved)[0];
  put("core-manifest.md", moved);
  r = write("--aside");
  const left = read("core-manifest.md");
  ok(r.status === 0 && r.stdout.includes(`- ${placing}: wrote \`core-manifest.md\``) && r.stdout.includes(`set aside in the stash "${ASIDE}"`) && left === moved && dirty() === "M core-manifest.md",
    "at a sync that moved the manifest's pin, --aside writes its module lines and sets them aside, the moved pin left where the sync put it", `${r.stdout}${r.stderr}\n---\n${left}\n---\n${dirty()}`);
  commit("the sync's pull request, merged");
  git("stash", "pop", "-q");
  ok(!missed(placing).length && read("core-manifest.md").includes(`${pin}\n`), "and the stash, popped once the sync merged, brings the module lines back on the moved pin", read("core-manifest.md"));
  back();
  // (the same where git writes the tree's line ends as Windows does, and the manifest gone, which stays busy, and fails nothing)
  STAGES[placing].stage(dir);
  commit("a module neither taken nor left out");
  git("config", "core.autocrlf", "true");
  put("core-manifest.md", moved.replace(/\r?\n/gu, "\r\n"));
  r = write();
  ok(r.status === 0 && r.stdout.includes(`- ${placing}: wrote \`core-manifest.md\``), "and where the tree holds the manifest with Windows line ends", `${r.stdout}${r.stderr}`);
  git("config", "--unset", "core.autocrlf");
  back();
  // (and, where git leaves line ends as they are, a tree with Windows ones over the blob's: the stash leaves the blob's,
  // and the moved pin is put back with no line end of its own)
  STAGES[placing].stage(dir);
  commit("a module neither taken nor left out");
  put("core-manifest.md", moved.replace(/\r?\n/gu, "\r\n"));
  r = write("--aside");
  ok(r.status === 0 && read("core-manifest.md") === moved, "and with --aside, the pin put back on a file whose line ends the stash changed, keeping them", JSON.stringify(read("core-manifest.md").slice(0, 300)));
  back();
  STAGES[placing].stage(dir);
  commit("a module neither taken nor left out");
  fs.rmSync(path.join(dir, "core-manifest.md"));
  r = write();
  ok(r.status === 0 && !r.stdout.includes(`- ${placing}: wrote \`core-manifest.md\``) && !fs.existsSync(path.join(dir, "core-manifest.md")), "a manifest taken out and not yet committed is written by none, and --write fails nothing", `${r.stdout}${r.stderr}`);
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
