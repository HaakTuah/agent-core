// Tests what a project holds twice (scripts/twice.mjs; tasks/cleaning.md, "The reading asks what a project holds
// twice"; #1087): on a scratch project holding each kind exactly and nearly, with a scratch core of two commits fetched
// beside it, it lists each, corrects with --fix only what is exact (a file equal to the core's, at the copy or an
// earlier one, taken out and its pointers moved; code only with the files it names; the second of two calls the same in
// every input; a pointer to a file the core moved unchanged), lists the rest for the auditor and changes nothing of
// it, reads no dated record nor the core's part of a rule file, and run again finds nothing exact left. Node's own
// modules and git.
//
//   node tests/twice-test.mjs
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { CORE } from "../scripts/core-address.mjs";
import { BEGIN, END } from "../scripts/core-owned.mjs";
import { closeness, findings, pointerTo, pointersTo, projectOf, report, unitsOf, withoutJob } from "../scripts/twice.mjs";
import { root, scratchDir, tally } from "../scripts/scratch-core.mjs";

const { ok, done } = tally();
const git = (cwd, ...args) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8" }).trim();
const write = (dir, files) => { for (const [f, t] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), t); } };

const RULE = "- **A rule of the core.** By default every session reads the queue before it starts any task, and says what it took up in its pull request.";
const NEAR = "- **A rule of the project.** By default every session reads the queue before it starts any task, and says what it took up in its own description.";
const OTHER = "A paragraph of the project's own that says something the core never says, about its build, its players and its own release.";
const TWICE = "Every pull request of this project runs its game's whole suite on a phone before it is marked ready, and says how long it took.";
const GUIDE_OLD = `# A guide\n\n${"The core's guide, as an earlier copy held it, long enough to be compared as a file. ".repeat(3)}\n`;
const GUIDE_NEW = `# A guide\n\n${"The core's guide, as the copy holds it now, long enough to be compared as a file again. ".repeat(3)}\n`;
const PLACE = `# A place\n\n${"A file the core moved from one folder to another, its bytes unchanged by the move. ".repeat(3)}\n`;
const A = `// The core's script a, which reads its sibling b and nothing else at all, long enough.\nimport { b } from "./b.mjs";\nexport const a = () => b() + 1;\n`;
const B = `// The core's script b, which a reads, and which reads nothing of its own at all here.\nexport const b = () => 41;\n`;

// The scratch core: an earlier commit and the pin, on main; the project's copy is the pin's tree.
const tmp = scratchDir("twice-");
const core = path.join(tmp, "core-repo");
fs.mkdirSync(core);
git(core, "init", "-q", "-b", "main");
write(core, { "tasks/x.md": `# x\n\n${RULE}\n`, "docs/guide.md": GUIDE_OLD, "old/place.md": PLACE, "scripts/a.mjs": A, "scripts/b.mjs": B, "gone.md": `${"A file the core took out. ".repeat(6)}\n` });
git(core, "add", "-A"); git(core, "commit", "-qm", "earlier");
const earlier = git(core, "rev-parse", "HEAD");
fs.rmSync(path.join(core, "gone.md"));
fs.mkdirSync(path.join(core, "new"));
fs.renameSync(path.join(core, "old/place.md"), path.join(core, "new/place.md"));
write(core, { "docs/guide.md": GUIDE_NEW });
git(core, "add", "-A"); git(core, "commit", "-qm", "pin");
const pin = git(core, "rev-parse", "HEAD");

const CALL = `${CORE}/.github/workflows/copies.yml@${pin}`;
const WORKFLOW = `name: own\non: pull_request\njobs:\n  one:\n    uses: ${CALL}\n    with:\n      config: checks/copies.json\n  two:\n    uses: ${CALL}\n    with:\n      config: checks/copies.json\n  three:\n    uses: ${CALL}\n    with:\n      config: checks/other.json\n  after:\n    needs: one\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo done\n`;

// The project: its copy, and each kind exactly and nearly.
function project(name) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir);
  git(dir, "init", "-q", "-b", "main");
  execFileSync("tar", ["-x", "-f", "-", "-C", (fs.mkdirSync(path.join(dir, "core")), path.join(dir, "core"))], { input: execFileSync("git", ["archive", pin], { cwd: core }) });
  write(dir, {
    "core-manifest.md": `# The core manifest\n\nCore: ${CORE} at ${pin}, copied whole under core/\n`,
    "AGENTS.md": `# The project\n\n${NEAR}\n\n${OTHER}\n\n${TWICE}\n\n${BEGIN}\n${RULE}\n${END}\n`,
    "CLAUDE.md": `# Claude\n\n${TWICE}\n\nIt reads core/old/place.md, core/gone.md and core/tasks/x.md, and docs/guide.md.\n`,
    "SECURITY.md": `# Security\n\n${RULE}\n`,
    "README.md": `# Read me\n\nThe guide: [the guide](docs/guide.md); the old place: core/old/place.md.\n`,
    "docs/guide.md": GUIDE_OLD,
    "docs/notes.md": "# Notes\n\nSee [the guide](./guide.md) and [again](guide.md).\n",
    "tools/a.mjs": A, "tools/b.mjs": B,
    "lib/a.mjs": A, "lib/b.mjs": B.replace("41", "42"),
    "run.mjs": `import { a } from "./tools/a.mjs";\nimport { a as c } from "./lib/a.mjs";\nconsole.log(a(), c());\n`,
    ".github/workflows/own.yml": WORKFLOW,
    "reports/2026-11-01.md": `# A report\n\n${RULE}\n\nIt names core/gone.md.\n`,
  });
  return dir;
}

// The script run as a session runs it.
const run = (dir, ...args) => spawnSync(process.execPath, [path.join(root, "scripts/twice.mjs"), ...args], { cwd: dir, encoding: "utf8" });
const fetched = ["--fetched", path.join(core, ".git"), "--since", earlier];

// The units of a text, and how close two read.
{
  const u = unitsOf(`# T\n\n${RULE}\n${NEAR}\n\nShort line.\n\n\`\`\`\n${OTHER}\n\`\`\`\n| ${OTHER} |\n`);
  ok(u.length === 2 && u[0].line === 3 && u[1].line === 4, "each list item and paragraph is a unit, by the line it starts on; a code block, a table and a short line are none", JSON.stringify(u.map(x => x.line)));
  ok(closeness(u[0], u[1]) >= 0.6 && closeness(u[0], unitsOf(OTHER)[0]) < 0.6, "a near-copy reads close, an unrelated paragraph does not");
}

// The pointers a text holds to a path, and each moved in the form it stood in.
{
  const t = "docs/guide.md, ./guide.md, [x](guide.md), docs/guide.md.bak, mydocs/guide.md, [y](guide.mdx)";
  const hits = t.match(pointersTo("docs/notes.md", "docs/guide.md"));
  ok(JSON.stringify(hits) === JSON.stringify(["docs/guide.md", "./guide.md", "guide.md"]), "a pointer is the repository's path, a relative one opening with ./, or a link's target; a longer name is none", JSON.stringify(hits));
  const moved = t.replace(pointersTo("docs/notes.md", "docs/guide.md"), pointerTo("docs/notes.md", "docs/guide.md", "core/docs/guide.md"));
  ok(moved.startsWith("core/docs/guide.md, ../core/docs/guide.md, [x](../core/docs/guide.md)"), "each is moved in its own form", moved);
}

// A job taken out only where what is left reads as the workflow did without it.
{
  const out = withoutJob(WORKFLOW, "two");
  ok(out && !out.includes("  two:") && out.includes("  three:") && out.includes("  after:"), "the second call goes, every other job stays", out);
  ok(withoutJob("jobs:\n  a: { uses: x }\n  b: { uses: x }\n", "c") === null, "a job that is not there is taken out of nothing");
}

// The findings on the project, with the core fetched.
{
  const dir = project("found");
  const before = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8");
  const p = projectOf(dir, { fetched: path.join(core, ".git"), since: earlier });
  const found = findings(p), line = re => found.find(f => re.test(f.line));
  const exact = found.filter(f => f.fix).map(f => f.line), close = found.filter(f => !f.fix).map(f => f.line);
  ok(line(/^docs\/guide\.md is the core's docs\/guide\.md at [0-9a-f]{7}, an earlier copy, byte for byte: it goes/u)?.fix, "a file equal to one of an earlier copy goes, its pointers moved to the copy's file", exact.join("\n"));
  ok(line(/^tools\/a\.mjs .*: it goes/u)?.fix && line(/^tools\/b\.mjs .*: it goes/u)?.fix, "code equal to the copy's goes with the file it names, which goes too");
  ok(line(/^lib\/a\.mjs .*names a file that would not stand beside the copy's/u) && !line(/^lib\/a\.mjs/u).fix, "code whose sibling differs from the core's stays, for the auditor", close.join("\n"));
  ok(line(/the job two calls the core's copies\.yml, as \.github\/workflows\/own\.yml#one does, the same in every input: it goes/u)?.fix, "the second of two calls the same in every input goes");
  ok(line(/the job three calls/u) && !line(/the job three calls/u).fix, "a call with other inputs is listed, not corrected");
  ok(line(/^CLAUDE\.md:\d+ names core\/old\/place\.md, .*moved it unchanged to core\/new\/place\.md/u)?.fix, "a pointer to a file the core moved unchanged moves to where it stands");
  ok(line(/^CLAUDE\.md:\d+ names core\/gone\.md, which the copy does not hold$/u) && !line(/core\/gone\.md/u).fix, "a pointer to a file the core took out is listed");
  ok(line(/^SECURITY\.md:3 is a copy of core\/tasks\/x\.md:3, the core's text/u), "a rule that is a copy of the core's is listed for the auditor", close.join("\n"));
  ok(line(/^AGENTS\.md:3 reads close to core\/tasks\/x\.md:3 \(\d+% of its runs of words shared\), the core's text/u), "a rule that reads close to the core's is listed");
  ok(line(/^AGENTS\.md:7 is a copy of CLAUDE\.md:3, the project's own/u), "the same rule twice in the project's own files is listed");
  ok(!found.some(f => /AGENTS\.md:5\b|reports\/|AGENTS\.md:1[01]\b/u.test(f.line)), "a paragraph of its own, a dated record and the core's part of a rule file are not listed", found.map(f => f.line).join("\n"));
  ok(found.filter(f => f.fix).length === 6, "six are exact, the pointers moved counted one by one", exact.join("\n"));

  const fixed = run(dir, "--fix", ...fetched);
  ok(fixed.status === 0 && /Corrected, for a pull request of its own/u.test(fixed.stdout), "--fix says what it corrected", fixed.stdout + fixed.stderr);
  const read = f => fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), "utf8") : null;
  ok(read("docs/guide.md") === null && read("tools/a.mjs") === null && read("tools/b.mjs") === null && read("lib/a.mjs") === A, "the exact files went, and the one for the auditor stayed");
  ok(read("README.md").includes("[the guide](core/docs/guide.md)") && read("README.md").includes("core/new/place.md") && read("docs/notes.md").includes("[the guide](../core/docs/guide.md) and [again](../core/docs/guide.md)"), "their pointers moved, each in its form", read("README.md") + read("docs/notes.md"));
  ok(read("run.mjs").includes(`from "./core/scripts/a.mjs"`) && read("run.mjs").includes(`from "./lib/a.mjs"`), "an import of code that went names the copy's", read("run.mjs"));
  ok(!read(".github/workflows/own.yml").includes("  two:") && read(".github/workflows/own.yml").includes("  three:"), "the second call went, the other stayed");
  ok(read("CLAUDE.md").includes("core/new/place.md") && read("CLAUDE.md").includes("core/gone.md") && read("CLAUDE.md").includes("core/docs/guide.md."), "a pointer moved, one to a file gone stays", read("CLAUDE.md"));
  ok(read("AGENTS.md") === before && read("reports/2026-11-01.md").includes("core/gone.md"), "no rule's text and no dated record is changed");
  const again = run(dir, ...fetched);
  ok(!/Exact, which/u.test(again.stdout) && /For the auditor/u.test(again.stdout), "run again it finds nothing exact left", again.stdout);
}

// Without the core fetched: what an earlier copy held is not found, and a pointer to a path left is listed alone.
{
  const dir = project("unfetched");
  const r = run(dir);
  ok(r.status === 0 && !/docs\/guide\.md is the core's/u.test(r.stdout) && /core\/old\/place\.md, which the copy does not hold\n/u.test(`${r.stdout}\n`), "with nothing fetched, nothing of an earlier copy is read, and a pointer to a path left is listed", r.stdout);
}

// The core's own repository holds no copy: nothing is read.
{
  const r = run(root);
  ok(r.status === 0 && /No copy of the core stands here/u.test(r.stdout), "in the core's own repository it reads nothing", r.stdout);
  ok(report([], "core/") .endsWith("nothing the scripts read."), "a project with nothing found says so");
}

done("what a project holds twice");
