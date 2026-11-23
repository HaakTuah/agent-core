// Tests the steps' writers (steps.mjs --write, step-writers.mjs; #1091) on a project the starter kit of this commit
// writes in a scratch folder, committed: each step a writer does whole, taken out, reads done after `--write`, the
// project's rule files keeping their words; the step of the rules' move and that of the agent tools' files written as far
// as they are exact, the rest left to their mends; a file with changes not yet committed, a writer that cannot run, a
// step the manifest declares undone on purpose and a run outside the copy write nothing; and `--aside` sets what it
// wrote aside in a stash, which brings it back. Node's own modules and git.
//
//   node tests/steps-write-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { STAGES } from "../scripts/steps-stage.mjs";
import { declare, kitIn, ruleTexts, wordsKept } from "../scripts/steps-kit.mjs";
import { ASIDE, MOVED_GLOB, MOVED_GLOBS, STEPS, notDone, report, setAside, writeReport } from "../scripts/steps.mjs";
import { OLD_PATHS } from "../scripts/step-writers.mjs";
import { root, scratchDir, tally } from "../scripts/scratch-core.mjs";

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
  declare(dir, `"${l}": the owner's word`);
  commit("declared");
  r = write();
  ok(r.status === 0 && !r.stdout.includes(l) && !dirty(), "a step the manifest declares undone on purpose is not written", `${r.stdout}${r.stderr}`);
  back();
  STAGES[l].stage(dir);
  commit("taken out");
  r = spawnSync(process.execPath, [path.join(root, "scripts/steps.mjs"), "--write"], { cwd: dir, encoding: "utf8" });
  ok(r.status === 1 && /^FAIL: .*the copy's own script.*Mend: /u.test(r.stderr) && !dirty(), "run as another script than the copy's, it refuses with its mend and writes nothing", `${r.stdout}${r.stderr}`);

  // ---- --aside: what it wrote set aside in a stash, which brings it back ----
  r = write("--aside");
  const stashed = git("stash", "list");
  ok(r.status === 0 && r.stdout.includes(`set aside in the stash "${ASIDE}"`) && !dirty() && stashed.includes(ASIDE) && missed(l).length === 1, "--aside sets what it wrote aside in a stash, the tree as it stood", `${r.stdout}${r.stderr}\n${stashed}`);
  git("stash", "pop", "-q");
  ok(!missed(l).length, "and the stash, popped, brings it back: the step reads done", report(notDone(dir)));
  back();
  // (git refusing the stash: each file it wrote put back as it stood, a new one taken out, and the report says to write
  // them after the merge)
  STAGES[l].stage(dir);
  const stamped = "checks/sizes.json", stood = read(stamped);
  commit("taken out");
  put(stamped, `${stood} `);
  put("checks/holders.json", "{}\n");
  const kept = setAside(dir, [stamped, "checks/holders.json"], () => { throw new Error("no stash"); });
  ok(kept === false && read(stamped) === stood && !fs.existsSync(path.join(dir, "checks/holders.json")) && !dirty() && writeReport([{ lead: l, wrote: [stamped], mend: null }], "put back").includes("put back as they stood"),
    "where git cannot make the stash, each file the writers wrote is put back as it stood, a new one taken out, and the report says to write them after the merge", dirty());
  back();
}

done("the steps' writers");
