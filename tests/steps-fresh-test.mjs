// Tests fresh.mjs (a project beside a fresh start, with steps.mjs's reading of what the project holds) on projects the
// starter kit of this commit writes in a scratch folder, each a git repository with nothing committed: each kind of
// difference listed and a declared file not compared, a project that lost its hooks' settings or its signature check, a
// path a project's own file names read only inside the project, a file of the project's own that is no regular file or
// is past its size, a NuGet project set up at its root, and the wording an earlier kit wrote. Node's own modules and git.
//
//   node tests/steps-fresh-test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { differences, fresh, kind } from "../scripts/fresh.mjs";
import { TEMPLATES } from "../scripts/init.mjs";
import { heldKitIn, declare } from "../scripts/steps-kit.mjs";
import { STEPS, notDone, project, report } from "../scripts/steps.mjs";
import { READ_MOST } from "../scripts/own-files.mjs";
import { root, scratchDir, tally } from "../scripts/scratch-core.mjs";
import { CORE } from "../scripts/core-address.mjs";

const { ok, done } = tally();
const tmp = scratchDir("steps-fresh-");
const kit = heldKitIn(tmp, ok);

const dirs = { "an-npm-project": kit("an-npm-project", { packages: "." }, { held: false }), "a-game": kit("a-game", { packages: "web", game: true }, { held: false }) };

// ---- beside a fresh start: each kind of difference is listed, and a declared file is not compared ----
const game = dirs["a-game"];
const agents = path.join(game, "AGENTS.md");
fs.writeFileSync(agents, fs.readFileSync(agents, "utf8").replace(/\n## Starting a task\n[\s\S]*?\n## Commands/, "\n## Commands").replace("These whole", "these whole")
  .replace(/at\nthe start of every task\./, "at the start\n  of every task."));
fs.rmSync(path.join(game, ".github/workflows/look.yml"));
const wf = path.join(game, ".github/workflows/copies.yml");
fs.writeFileSync(wf, fs.readFileSync(wf, "utf8").replace(/@[0-9a-f]{40}/g, `@${"b".repeat(40)}`));
const manifest = path.join(game, "core-manifest.md");
fs.writeFileSync(manifest, fs.readFileSync(manifest, "utf8").replace(/^\| \*large file\* \|.*\n/m, "").replace("| `docs/PROGRESS.md` |", "| `PLAN.md` |"));
const cfg = path.join(game, "checks/copies.json");
fs.writeFileSync(cfg, JSON.stringify({ baseline: "checks/copies-baseline.json", code: ["src"] }, null, 2));
let found = differences(project(game), fresh(project(game)));
const has = (file, what) => found.some(d => d.startsWith(`${file}:`) && d.includes(what));
ok(found.length === 4 && has("AGENTS.md", "Starting a task") && has(".github/workflows/look.yml", "missing") && has("core-manifest.md", "the row \"*large file*\"") && has("checks/copies.json", "the key \"prose\""),
  "a paragraph, a file, a table's row and a config's key that the project lacks are listed; a reflowed line, a row's own value and a pin moved are no difference", found.join("\n"));
declare(game, '"AGENTS.md": its own way of starting a task, on the owner\'s word.');
found = differences(project(game), fresh(project(game)));
ok(found.length === 3 && !found.some(d => d.startsWith("AGENTS.md:")), "a file the manifest's \"Differences\" quotes is not compared", found.join("\n"));

// ---- a project that lost its hooks' settings or its signature check: listed, however little of it is left ----
const bare = kit("a-bare-npm-project", { packages: "." }, { held: false });
fs.writeFileSync(path.join(bare, "package-lock.json"), "{}\n");
fs.writeFileSync(path.join(bare, ".claude/settings.json"), '{"permissions": {}, "hooks": {}}\n');
fs.rmSync(path.join(bare, ".github/workflows/signatures.yml"));
found = differences(project(bare), fresh(project(bare)));
ok(found.some(d => d.startsWith(".claude/settings.json: lacks") && d.includes("Edit(//**/.git/**)")) && found.includes(".github/workflows/signatures.yml: missing (the starter kit writes it today)"),
  "hooks' settings emptied, and a signature check lost from an npm project, are listed (its packages read from its lock file too)", found.join("\n"));

// ---- the configs the kit writes beside its templates, and a workflow the core's reader cannot read ----
const plainProject = kit("a-plain-project", {});
fs.rmSync(path.join(plainProject, "checks/sizes.json"));
fs.writeFileSync(path.join(plainProject, "checks/copies-baseline.json"), "{}\n");
found = differences(project(plainProject), fresh(project(plainProject)));
ok(found.includes("checks/sizes.json: missing (the starter kit writes it today)") && found.some(d => d.startsWith("checks/copies-baseline.json: lacks the key \"windows\"")) && found.length === 2,
  "a config the kit writes beside its templates, missing or lacking a key, is listed", found.join("\n"));
// (the list of what holds the project's own rules, which the kit writes too: #1095, point 6)
const holders = path.join(plainProject, "checks/holders.json"), heldList = fs.readFileSync(holders, "utf8");
fs.rmSync(holders);
found = differences(project(plainProject), fresh(project(plainProject)));
const lost = found.includes("checks/holders.json: missing (the starter kit writes it today)");
fs.writeFileSync(holders, '{ "about": {} }\n');
found = differences(project(plainProject), fresh(project(plainProject)));
ok(lost && found.includes('checks/holders.json: lacks the key "holders"'), "the list of what holds the project's own rules, missing or lacking its key, is listed", found.join("\n"));
fs.writeFileSync(holders, heldList);
// (a game's previews and the versions check, read from the project's calls to the core's preview.yml and versions.yml,
// the build and the config's path taken from them, and compared with what the kit writes for them: #1095, point 6)
const base = differences(project(plainProject), fresh(project(plainProject))).join("\n");
const callsTo = { preview: path.join(plainProject, ".github/workflows/preview.yml"), versions: path.join(plainProject, ".github/workflows/versions.yml") };
fs.writeFileSync(callsTo.preview, `on:\n  workflow_run:\n    workflows: ["Build (web)"]\njobs:\n  preview:\n    uses: ${CORE}/.github/workflows/preview.yml@${"a".repeat(40)}\n`);
fs.writeFileSync(callsTo.versions, `on:\n  workflow_dispatch:\njobs:\n  versions:\n    uses: ${CORE}/.github/workflows/versions.yml@${"a".repeat(40)}\n    with:\n      config: tools/versions.json\n`);
const read = kind(project(plainProject)).o;
const kitted = Object.fromEntries(fresh(project(plainProject)).filter(([to]) => [...Object.values(callsTo), path.join(plainProject, "tools/versions.json")].includes(path.join(plainProject, to))));
found = differences(project(plainProject), fresh(project(plainProject)));
ok(read.pages === "Build (web)" && read.versions === "tools/versions.json" && found.includes("tools/versions.json: missing (the starter kit writes it today)") && found.some(d => d.startsWith(".github/workflows/preview.yml: lacks") && d.includes("pull-requests: write")) && found.some(d => d.startsWith(".github/workflows/versions.yml: lacks") && d.includes("issues: write")),
  "a project that calls the core's preview.yml or versions.yml is read as one, its build and config taken from the call, and a line of the kit's its call lacks, or the config it names, is listed", found.join("\n"));
for (const [to, text] of Object.entries(kitted)) { fs.mkdirSync(path.dirname(path.join(plainProject, to)), { recursive: true }); fs.writeFileSync(path.join(plainProject, to), text); }
fs.writeFileSync(path.join(plainProject, "tools/versions.json"), '{ "about": "" }\n');
found = differences(project(plainProject), fresh(project(plainProject)));
ok(found.includes('tools/versions.json: lacks the key "entries"'), "the versions config lacking the key its check reads is listed", found.join("\n"));
fs.writeFileSync(path.join(plainProject, "tools/versions.json"), '{ "entries": [{ "own": true }] }\n');
found = differences(project(plainProject), fresh(project(plainProject)));
ok(Object.keys(kitted).length === 3 && found.join("\n") === base && kitted[".github/workflows/versions.yml"].includes("config: tools/versions.json"), "and once it holds what the kit writes for them, nothing more is listed", found.join("\n"));
for (const f of [...Object.values(callsTo), path.join(plainProject, "tools")]) fs.rmSync(f, { recursive: true });
ok(differences(project(plainProject), fresh(project(plainProject))).join("\n") === base && kind(project(plainProject)).o.pages === undefined, "a project that calls neither is asked for neither");
const secWorkflow = path.join(plainProject, ".github/workflows/security-review.yml");
fs.writeFileSync(secWorkflow, fs.readFileSync(secWorkflow, "utf8").replace(/^jobs:/m, "env: [SAMPLE\n\njobs:"));
// (the copies baseline as the kit writes it, with its list: its step reads that file alone, never a workflow)
fs.writeFileSync(path.join(plainProject, "checks/copies-baseline.json"), '{ "windows": {}, "values": {} }\n');
const unread = notDone(plainProject);
const unreadSec = unread.find(m => m.lead.endsWith("the security review shown on every pull request"));
ok(unreadSec?.mend.includes("could not read the project") && unreadSec.mend.includes("security-review.yml") && unread.every(m => m.mend.includes("could not read the project")),
  "a workflow the core's reader cannot read, a flow sequence never closed, is reported as not read, never as a call that is missing or a step done", report(unread));

// ---- a path a project's own file names is read only inside the project ----
fs.writeFileSync(path.join(plainProject, "checks/copies.json"), JSON.stringify({ baseline: "../a-game/checks/copies-baseline.json", code: [], prose: [], proseFromSecurity: true }));
found = differences(project(plainProject), fresh(project(plainProject)));
ok(found.some(d => d.startsWith("the copies check's baseline not compared: ") && d.includes("../a-game/checks/copies-baseline.json, outside the project")) && !found.some(d => d.startsWith("../")) && project(plainProject).read("../a-game/AGENTS.md") === null,
  "a path that leads out of the project is said not compared, never read as another folder's file", found.join("\n"));

// ---- what the steps read is a regular file of the project's own, of a size a rule file or config keeps to (#362, #423):
// a link (in or out), a folder link that leads out, an endless device and a file past the size read as missing, and the
// last is named in the report ----
{
  const dir = path.join(tmp, "links"), outside = path.join(tmp, "outside");
  fs.mkdirSync(path.join(dir, "docs"), { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: dir });
  fs.writeFileSync(path.join(dir, "AGENTS.md"), "# own\n");
  fs.writeFileSync(path.join(outside, "secret.md"), "outside\n");
  fs.writeFileSync(path.join(dir, "docs/big.md"), "x".repeat(READ_MOST + 1));
  const linked = [];
  // (and git's own folder and a file it ignores, a person's own, read neither by a link nor by name)
  fs.writeFileSync(path.join(dir, ".gitignore"), ".env\n");
  fs.writeFileSync(path.join(dir, ".env"), "# a person's own\n");
  for (const [at, to, type] of [["in.md", "AGENTS.md", "file"], ["gitcfg.md", ".git/config", "file"], ["env.md", ".env", "file"], ["out.md", path.join(outside, "secret.md"), "file"], ["far", outside, "dir"], ...(process.platform === "win32" ? [] : [["zero.md", "/dev/zero", "file"]])]) {
    try { fs.symlinkSync(to, path.join(dir, at), type); linked.push(at); } catch { /* (a system that makes no link here: that case is not run) */ }
  }
  execFileSync("git", ["add", "-A"], { cwd: dir });
  const p = project(dir);
  // (each part named, so that a system where one differs says which; a path through a file is no folder anywhere, and
  // Windows says there is nothing there, where others say it is no folder: neither is handed on)
  const parts = {
    own: p.read("AGENTS.md") === "# own\n",
    "links out or to a device": linked.filter(at => at !== "in.md").every(at => p.read(at === "far" ? "far/secret.md" : at) === null),
    "a folder and a file past the size": p.read("docs") === null && p.read("docs/big.md") === null,
    "a link to a file of its own": !linked.includes("in.md") || p.read("in.md") === "# own\n",
    "git's own and an ignored file, by name": p.read(".env") === null && p.read(".git/config") === null,
    "safe: its own, nothing there, not the big file": p.safe("AGENTS.md") && p.safe("nothing-here.md") && !p.safe("docs/big.md"),
    "safe: a path through a file never throws": typeof p.safe("AGENTS.md/x") === "boolean" && (process.platform === "win32" || !p.safe("AGENTS.md/x")),
    "safe: no link out or to a device": linked.filter(at => at !== "in.md" && at !== "far").every(at => !p.safe(at)),
  };
  const reads = Object.values(parts).every(Boolean);
  const said = report(Object.assign([], { unread: p.unread }));
  ok(reads && p.unread.join() === "docs/big.md" && said.includes(`Left unread, each past ${READ_MOST} bytes`) && said.includes("`docs/big.md`"),
    `the steps read a regular file of the project's own and nothing else: a link to one reads as it, a link out or to a device (${linked.join(", ") || "none made here"}), a folder and a file past the size read as missing, the last named in the report`, `${said}\n${Object.entries(parts).filter(([, v]) => !v).map(([k]) => `not so: ${k}`).join("\n")}`);
  // (the size marks' step never hands the reading-size check a file the reader would not read: a tracked link to an
  // endless device among the files its marks name is reported as not read, at once)
  if (process.platform !== "win32") {
    const kitDir = dirs["an-npm-project"], agents = path.join(kitDir, "AGENTS.md"), was = fs.readFileSync(agents);
    fs.rmSync(agents);
    fs.symlinkSync("/dev/zero", agents);
    const step = STEPS.filter(x => x.lead === "14 November 2026, the size marks' total counts the project's own files");
    const said2 = notDone(kitDir, step); // (a read that never ended would never return: the suite's own time stops it)
    fs.rmSync(agents);
    fs.writeFileSync(agents, was);
    ok(said2.length === 1 && /names `AGENTS\.md`, which is no regular file of the project's own/.test(said2[0].mend), "the size marks' step hands the reading-size check no file the reader would not read, and says which", said2[0]?.mend);
  }
}

// ---- a NuGet project set up at its root, its project file nested; a difference declared: neither is a difference ----
const rootNuget = kit("a-root-nuget-project", { nuget: ".", private: true });
fs.mkdirSync(path.join(rootNuget, "src/App"), { recursive: true });
fs.writeFileSync(path.join(rootNuget, "src/App/App.csproj"), "<Project Sdk=\"Microsoft.NET.Sdk\" />\n");
ok(kind(project(rootNuget)).o.nuget === ".", "a NuGet project whose Dependabot directory is the root reads as one set up at its root", kind(project(rootNuget)).o.nuget);
declare(rootNuget, '"AGENTS.md": its own way of starting a task, on the owner\'s word.');
found = differences(project(rootNuget), fresh(project(rootNuget)));
ok(!found.length, "a manifest whose \"Differences\" declares something, in place of the kit's \"None.\", is no difference", found.join("\n"));

// ---- the wording an earlier kit wrote and the kit has left: listed where the project still holds it ----
const older = path.join(tmp, "older", "setup", "template");
fs.cpSync(path.join(root, TEMPLATES), older, { recursive: true });
const LEFT = "Every builder reads the old way of starting a task, which the core has since left.";
fs.writeFileSync(path.join(older, "AGENTS.md.tmpl"), fs.readFileSync(path.join(older, "AGENTS.md.tmpl"), "utf8").replace("## Commands", `${LEFT}\n\n## Commands`));
fs.writeFileSync(path.join(older, "core-manifest.md.tmpl"), fs.readFileSync(path.join(older, "core-manifest.md.tmpl"), "utf8").replace("| *large file* |", "| *old slot* | gone |\n| *large file* |"));
const another = kit("another-npm-project", { packages: "." }, { held: false });
const npmAgents = path.join(another, "AGENTS.md");
const p0 = project(another), olderKit = fresh(p0, older);
ok(olderKit.length > 0 && !differences(p0, fresh(p0), [olderKit]).length, "an earlier kit whose wording the project does not hold adds no difference");
fs.writeFileSync(npmAgents, fs.readFileSync(npmAgents, "utf8").replace("## Commands", `${LEFT}\n\n## Commands`));
fs.writeFileSync(path.join(another, "core-manifest.md"), fs.readFileSync(path.join(another, "core-manifest.md"), "utf8").replace("| *large file* |", "| *old slot* | gone |\n| *large file* |"));
const p1 = project(another);
found = differences(p1, fresh(p1), [olderKit, olderKit]);
ok(found.length === 2 && found.some(d => d.startsWith("AGENTS.md: still holds the paragraph \"Every builder reads") && d.includes("no longer writes")) && found.some(d => d.startsWith("core-manifest.md: still holds the row \"*old slot*\"")),
  "a paragraph and a row an earlier kit wrote that the kit no longer writes, still held, are listed once each", found.join("\n"));
ok(!fresh(p1, path.join(tmp, "nowhere")).length, "an earlier copy with no starter kit gives no kit to compare");
fs.rmSync(path.join(older, "choices.md.tmpl"));
const lacks = fresh(p1, older);
ok(lacks.length === olderKit.length - 1 && !lacks.some(([to]) => to === "docs/choices.md") && differences(p1, fresh(p1), [lacks]).length === 2,
  "an earlier kit that lacks a template added since still gives its other files to compare", lacks.map(([to]) => to).join());

// ---- a paragraph or line the kit rewords past where its label is cut: one line that shows what differs (#1265, point 2) ----
const reworded = path.join(tmp, "reworded", "setup", "template");
fs.cpSync(path.join(root, TEMPLATES), reworded, { recursive: true });
const NOW_WORDS = "any other tool: open each file named):", OLD_WORDS = "any other tool: open each file, by name,):";
const NOW_LINE = "(core/tasks/updates.md)", OLD_LINE = "(core/tasks/updates.md, point 2)";
const reword = (at, from, to) => { const was = fs.readFileSync(at, "utf8"), now = was.replaceAll(from, to); ok(now !== was, `${path.basename(at)} is reworded as the earlier kit wrote it`); fs.writeFileSync(at, now); };
reword(path.join(reworded, "AGENTS.md.tmpl"), NOW_WORDS, OLD_WORDS);
for (const f of fs.readdirSync(reworded).filter(n => /^dependabot.*\.tmpl$/.test(n))) reword(path.join(reworded, f), NOW_LINE, OLD_LINE);
const third = kit("a-third-npm-project", { packages: "." }, { held: false });
reword(path.join(third, "AGENTS.md"), NOW_WORDS, OLD_WORDS);
reword(path.join(third, ".github/dependabot.yml"), NOW_LINE, OLD_LINE);
const p3 = project(third);
found = differences(p3, fresh(p3), [fresh(p3, reworded)]);
const differs = file => found.filter(d => d.startsWith(`${file}:`));
const [para] = differs("AGENTS.md"), [line] = differs(".github/dependabot.yml");
ok(found.length === 2 && /^AGENTS\.md: differs in the paragraph "This project takes the shared rules/.test(para) && para.includes("open each file named") && para.includes("open each file, by name,")
  && /^\.github\/dependabot\.yml: differs in the line "update-types/.test(line) && line.includes("updates.md, point 2)") && line.includes("updates.md)"),
  "a paragraph and a line an earlier kit wrote, reworded by the kit past where a label is cut, give one line each, which shows the words that differ", found.join("\n"));

done("steps-fresh");
