// The round trips of #1108: in projects the kit writes of each kind the upgrade test holds, each file the kit, a check, a
// step or a sync writes is read back by each reader of the core's that reads it, to the meaning written.
//
//   node tests/round-trip-test.mjs
import fs from "node:fs";
import path from "node:path";
import { kits, plan } from "../scripts/converge.mjs";
import { blockOf } from "../scripts/core-owned.mjs";
import { readCore } from "../scripts/core-path.mjs";
import { recordOf } from "../scripts/core-reading.mjs";
import { auditOf, reading } from "../scripts/dose.mjs";
import { differences, fresh, kind } from "../scripts/fresh.mjs";
import { ownHolders } from "../scripts/holders-own.mjs";
import { SENDERS, STATES, items } from "../scripts/inbox.mjs";
import { options } from "../scripts/init.mjs";
import { inboxFile, slug } from "../scripts/look-keep.mjs";
import { differencesOf, modulesOf } from "../scripts/manifest-reads.mjs";
import { markdownReader } from "../scripts/markdown.mjs";
import { parseYaml } from "../scripts/parse-yaml.mjs";
import { ownerOf } from "../scripts/releases.mjs";
import { npmOnce } from "../scripts/npm-once.mjs";
import { npmWithCache, root, scratch, scratchDir, scratchEnv, tally } from "../scripts/scratch-core.mjs";
import { parseBaseline, parseConfig } from "../scripts/shape.mjs";
import { KIT_CONFIGS, call, configs, project } from "../scripts/steps.mjs";
import { CORE } from "../scripts/core-address.mjs";

const { ok, done } = tally();

// ---- the list: each script that writes a file, and where its round trip stands ----
// `here`: this test; else the test that holds it. Each is read back by the reader named.
const WRITERS = {
  "init.mjs": ["here", "the starter kit's files, read by the YAML, Markdown and JSON readers, the manifest's, the configs', the one process and the fresh comparison"],
  "converge.mjs": ["here", "the one process's files, the kit's as it renders them, which its own plan reads back as nothing to write"],
  "sync.mjs": ["here", "the manifest's Core: line and the calls' pins, read by the manifest's reader and the calls' reader"],
  "copies.mjs": ["here", "the copies baseline, read by the copies check"],
  "shape.mjs": ["here", "the shape baseline, read by the shape check and the dose"],
  "dose.mjs": ["here", "the last audit in the shape baseline, read by the dose and the shape check"],
  "holders-own.mjs": ["here", "checks/holders.json, read by holders.mjs --own"],
  "mutation-tools.mjs": ["tests/mutation-tools-test.mjs", "its row, list, size marks"],
  "core-reading.mjs": ["here", "checks/core-reading.json, read by its own `due`"],
  "look-keep.mjs": ["here", "an inbox file, read by the inbox's reader"],
  "pointers.mjs": ["tests/names-test.mjs", "checks/names.json, read back as its list"],
  "queue.mjs": ["tests/queue-test.mjs", "the progress file --clear rewrites, read by its reader"],
  "screens.mjs": ["tests/screens-test.mjs", "the screens' baseline --write rewrites, read by readBaseline"],
  "strength.mjs": ["tests/strength-test.mjs", "the strength baseline --whole and --lower write, read by the check"],
  "step-writers.mjs": ["tests/steps-write-test.mjs", "read by each step's check"],
  "sync-pins.mjs": ["tests/steps-write-test.mjs", "the pins put back"],
  "twice.mjs": ["tests/twice-test.mjs", "the workflows and pointers --fix corrects, read again by its YAML reader: nothing exact left"],
};
// The scripts that write a file no reader of the core reads in a project, each with why.
const ELSEWHERE = {
  "agent-tools-scratch.mjs": "a scratch project for a test", "releases-scratch.mjs": "a test's scratch core", "stage-helpers.mjs": "a test's stage", "steps-kit.mjs": "a test's kit project",
  "licence-scan-stage.mjs": "a test's stage", "nuget-gate-scratch.mjs": "a test's scratch project", "scratch-core.mjs": "a test's scratch folders", "scratch-shallow.mjs": "a test's scratch history", "twice-scratch.mjs": "a test's scratch project", "core-path-scratch.mjs": "a test's scratch checkouts",
  "check.mjs": "the verdicts, to a file outside every repository, read by release-trial.mjs in the core",
  "checks.mjs": "a job's output (GITHUB_OUTPUT)", "install.mjs": "a job's environment (GITHUB_ENV)", "select.mjs": "a job's output",
  "tests-parts.mjs": "a job's output", "lookup.mjs": "a job's summary", "look.mjs": "a job's output and summary",
  "workflow-run.mjs": "a workflow's run for a test, into its scratch folder", "workflow-install.mjs": "an install set aside for a test's runner",
  "attached.mjs": "a link to the packages, for a verdict run",
  "code-scan.mjs": "a scan's files in a temporary folder", "hostile.mjs": "files in a temporary folder", "links.mjs": "a temporary folder",
  "workflows.mjs": "a temporary folder", "pure-sync.mjs": "the base it renders, in a temporary folder",
  "core-moved.mjs": "an issue's text, handed to gh", "helper-call.mjs": "a helper's mark, read by nothing of a project's",
  "mutate.mjs": "a mutation run's files", "stryker.mjs": "a mutation run's config and report", "stryker-plugin.mjs": "a mutation run's report",
  "npm-once.mjs": "a program fetched to a cache", "nuget-fetch.mjs": "a program fetched to a cache", "session-cost.mjs": "its own part of a session's cost",
  "code-shape.mjs": "the JSON asked for with --json", "pruning.mjs": "the core's own record of a pruning", "pruning-record.mjs": "the core's own record of a pruning",
  "staged.mjs": "the core's own record of the staged cases", "security-review-record.mjs": "the core's own record of reviews",
  "release-trial.mjs": "the core's own record of a release's trial",
  "daily-try.mjs": "its clones, logs and counts, in a folder of the runner's outside every repository",
};
// (and every staged case, which writes its scratch project: scripts/staged/)
const STAGED = "staged/";
const WRITES = /\b(?:writeFileSync|appendFileSync|writeFile|createWriteStream|copyFileSync|cpSync|symlinkSync|linkSync)\s*\(/u;
const scripts = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? scripts(path.posix.join(dir, e.name)) : e.name.endsWith(".mjs") ? [path.posix.join(dir, e.name)] : []);
const writing = scripts("scripts").filter(f => WRITES.test(fs.readFileSync(path.join(root, f), "utf8"))).map(f => f.slice("scripts/".length));
const unlisted = writing.filter(f => !(f in WRITERS) && !(f in ELSEWHERE) && !f.startsWith(STAGED));
ok(unlisted.length === 0, "each script that writes a file is a writer with its round trip, or named with why it writes nothing a reader of the core reads in a project",
  unlisted.map(f => `scripts/${f} writes a file and stands in neither list of tests/round-trip-test.mjs. Mend: add its round trip there, a project of the upgrade test's kinds written and read back by each reader of the core's that reads it, and list it in WRITERS; or name it in ELSEWHERE with why no reader of a project reads it`).join("\n"));
const gone = [...Object.keys(WRITERS), ...Object.keys(ELSEWHERE)].filter(f => !writing.includes(f));
ok(gone.length === 0, "each script the lists name still writes a file", gone.map(f => `tests/round-trip-test.mjs names scripts/${f}, which writes no file now. Mend: take it out of the list`).join("\n"));
for (const [f, [at]] of Object.entries(WRITERS).filter(([, [at]]) => at !== "here")) {
  const text = fs.existsSync(path.join(root, at)) ? fs.readFileSync(path.join(root, at), "utf8") : "";
  ok(text.includes(`scripts/${f}`), `  ${f}: its round trip stands in ${at}`, `${at} does not name scripts/${f}. Mend: write the round trip there, or here and mark it "here"`);
}
const ran = new Set();

// ---- each kind of project, as the kit writes it ----
const { tmp, env, git, run, core, pin, project: kitProject } = scratch("round-trip-");
const md = await markdownReader();
const CASES = [
  { args: ["--name", "An npm project", "--npm", "."] },
  { args: ["--name", "A game (the 2nd), its packages in a folder", "--npm", "web", "--game", "--pages", "Build (web)", "--versions"] },
  { args: ["--name", "A private .NET project", "--nuget", ".", "--private"], crlf: true },
];
const fenced = text => { let inFence = false; return text.split("\n").map(l => { if (/^ {0,3}(```|~~~)/u.test(l)) { inFence = !inFence; return null; } return inFence ? null : l; }); };
const headsOf = text => fenced(text.replace(/\r\n/g, "\n")).flatMap(l => { const m = l !== null && /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/u.exec(l); return m ? [`${m[1].length} ${m[2]}`] : []; });
const usesIn = node => !node || typeof node !== "object" ? [] : Object.entries(node).flatMap(([k, v]) => k === "uses" && typeof v === "string" ? [v] : usesIn(v));
const usesLines = text => [...text.matchAll(/^\s*(?:-\s+)?uses:\s*["']?([^\s"'#]+)/gmu)].map(m => m[1]);
const commit = (dir, m) => { git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", m); };
let first = null;
for (const c of CASES) {
  const o = options(["--owner", "the-owner", ...c.args]);
  const name = `p-${CASES.indexOf(c)}`;
  const p = kitProject(name, "--owner", "the-owner", ...c.args);
  ok(p.status === 0, `${o.name}: the starter kit writes it`, p.out);
  // a rule of the project's own, outside the core's part, for its holders' list
  fs.appendFileSync(path.join(p.dir, "AGENTS.md"), "\n## The project's own\n\n- **A rule of its own.** By default the project keeps it. Reason: a case.\n");
  commit(p.dir, "the kit");
  if (c.crlf) {
    git(p.dir, "config", "core.autocrlf", "true");
    for (const f of git(p.dir, "ls-files").split("\n").filter(f => !f.startsWith("core/") && /\.(md|ya?ml|json)$/u.test(f))) {
      const at = path.join(p.dir, f);
      fs.writeFileSync(at, fs.readFileSync(at, "utf8").replace(/\r?\n/g, "\r\n"));
    }
  }
  ran.add("init.mjs");
  const held = project(p.dir);
  const own = held.files.filter(f => !f.startsWith("core/"));

  // the YAML reader: each workflow and Dependabot's config read, every `uses` as written, each call to the core's pinned where the kit pinned it
  const yml = own.filter(f => /\.ya?ml$/u.test(f));
  for (const f of yml) {
    const text = held.read(f);
    let y = null, why = "";
    try { y = parseYaml(text); } catch (e) { why = e.message; }
    ok(y && typeof y === "object", `${o.name}: ${f} is read by the core's YAML reader`, why);
    ok(JSON.stringify(usesIn(y).sort()) === JSON.stringify(usesLines(text).sort()), `  ${f}: every \`uses\` read as written`, `${usesIn(y)} / ${usesLines(text)}`);
    const theCore = usesIn(y).filter(u => u.startsWith(`${CORE}/`));
    ok(theCore.every(u => u.endsWith(`@${pin}`)), `  ${f}: each call to the core's workflows read at the kit's pin`, theCore.join("\n"));
  }
  const coreCall = call(held, "core.yml");
  ok(coreCall?.uses === `${CORE}/.github/workflows/core.yml@${pin}`, `${o.name}: the calls' reader finds the call to core.yml at the pin`, JSON.stringify(coreCall));
  const withText = Object.fromEntries([...(/^ {4}with:\r?\n((?: {6}.*\r?\n)*)/mu.exec(held.read(".github/workflows/core.yml"))?.[1] ?? "").matchAll(/^ {6}([\w-]+):\s*(.*?)\s*$/gmu)].map(m => [m[1], m[2]]));
  ok(JSON.stringify(Object.fromEntries(Object.entries(coreCall?.with ?? {}).map(([k, v]) => [k, String(v)]))) === JSON.stringify(withText), `  the inputs core.yml is given are read as written`, `${JSON.stringify(coreCall?.with)} / ${JSON.stringify(withText)}`);

  // the Markdown reader: each file read, its headings as written
  for (const f of own.filter(x => x.endsWith(".md"))) {
    const text = held.read(f);
    let r = null, why = "";
    try { r = md(text); } catch (e) { why = e.message; }
    const heads = (r?.heads ?? []).map(h => `${h.level} ${h.text}`);
    ok(r && JSON.stringify(heads) === JSON.stringify(headsOf(text)), `${o.name}: ${f} is read by the core's Markdown reader, its headings as written`, why || `${heads.join(" | ")}\n${headsOf(text).join(" | ")}`);
  }

  // the JSON configs: each parsed, and the configs' readers find each where the kit put it
  for (const f of own.filter(x => x.endsWith(".json"))) {
    let why = "";
    try { JSON.parse(held.read(f)); } catch (e) { why = e.message; }
    ok(!why, `${o.name}: ${f} is read as JSON`, why);
  }
  const at = configs(held);
  ok(at.unread.length === 0 && at.licences === KIT_CONFIGS.licences && at.copies === KIT_CONFIGS.copies && at.sizes === KIT_CONFIGS.sizes && at.baseline === KIT_CONFIGS.baseline && at.audit === KIT_CONFIGS.audit,
    `${o.name}: the configs' readers find each config where the kit wrote it`, JSON.stringify(at));
  ok(at.packages === (o.packages ?? undefined) || (o.packages === undefined && at.packages === null), `  the signature check's folder read as the kit was given it`, `${at.packages} / ${o.packages}`);
  // each config read by the check that reads it: the licence check (its config and the audit it names), the agent tools'
  // (the tools' settings and hooks the kit writes: .claude/settings.json, .codex/hooks.json, .kiro/hooks/) and the size marks'
  for (const [script, file, what] of [["licences.mjs", at.licences, "the licence check reads its config and the audit it names"],
    ["agent-tools.mjs", at.licences, "the agent tools' check reads the tools' settings and hooks the kit wrote, each listed"],
    ["reading-size.mjs", at.sizes, "the size marks' check reads its marks"]]) {
    const read = run(p.dir, `core/scripts/${script}`, file);
    ok(read.status === 0, `  ${what}`, read.out);
  }

  // the manifest's readers: the kit's options, its pin, its copy, its modules
  const k = kind(held);
  const want = Object.fromEntries(["owner", "name", "packages", "nuget", "private", "game", "pages", "versions"].filter(key => o[key]).map(key => [key, o[key]]));
  ok(JSON.stringify(k.o) === JSON.stringify(want) && k.pin === pin && !k.unread, `${o.name}: the kind is read back as the kit was given it`, `${JSON.stringify(k)} / ${JSON.stringify(want)}`);
  const line = readCore(held.manifest);
  ok(line.form === "copied" && line.pin === pin && line.path === "core/" && ownerOf(held.manifest) === o.owner && JSON.stringify(differencesOf(held.manifest)) === '["None."]',
    `  the manifest's Core: line, owner and differences read as written`, JSON.stringify(line));
  const { taken } = modulesOf(held.manifest);
  const all = ["tasks", "roles/shared", "tools"].flatMap(d => fs.readdirSync(path.join(core, d)).filter(n => n.endsWith(".md")));
  ok(o.game ? taken === "all" : taken instanceof Set && !taken.has("game-design.md") && [...taken].every(n => all.includes(n)) && taken.has("cleaning.md"),
    `  the modules it takes read as written`, taken instanceof Set ? [...taken].join(" ") : String(taken));

  // the one process and the fresh comparison: the kit's text read back as their own
  const { kit } = kits(held, null, k);
  const pl = plan(held, kit);
  ok(pl.write.length === 0 && pl.remove.length === 0 && pl.left.length === 0, `${o.name}: the one process reads back what the kit wrote as nothing to write`, JSON.stringify(pl).slice(0, 600));
  ran.add("converge.mjs");
  for (const f of ["AGENTS.md", "CLAUDE.md"]) {
    const want = blockOf(kit.find(([to]) => to === f)?.[1] ?? "");
    ok(want !== null && blockOf(held.read(f)) === want, `  ${f}: the core's part read between its marks as the kit writes it`, blockOf(held.read(f)));
  }
  const diff = differences(held, fresh(held));
  ok(diff.length === 0, `  the comparison with a fresh kit reads no difference`, diff.join("\n"));

  // the baselines and records a check or a step writes in the project, read back
  const copies = run(p.dir, "core/scripts/copies.mjs", "checks/copies.json", "--write");
  const copiesRead = run(p.dir, "core/scripts/copies.mjs", "checks/copies.json");
  ok(copies.status === 0 && copiesRead.status === 0, `${o.name}: the copies baseline written is read by the copies check`, `${copies.out}\n${copiesRead.out}`);
  ran.add("copies.mjs");
  const shape = run(p.dir, "core/scripts/shape.mjs", "checks/shape.json", "--write");
  const shapeRead = run(p.dir, "core/scripts/shape.mjs", "checks/shape.json");
  const config = parseConfig(held.read("checks/shape.json"), "checks/shape.json");
  let baseline = null, why = "";
  try { baseline = parseBaseline(fs.readFileSync(path.join(p.dir, config.baseline), "utf8"), config.baseline, "run the shape check"); } catch (e) { why = e.message; }
  ok(shape.status === 0 && shapeRead.status === 0 && baseline, `  the shape baseline written is read by the shape check and its reader`, `${shape.out}\n${shapeRead.out}\n${why}`);
  ran.add("shape.mjs");
  const dose = run(p.dir, "core/scripts/dose.mjs", "--audited");
  let r = null; why = "";
  try { r = reading(held.manifest, p.dir); } catch (e) { why = e.message; }
  const last = auditOf(r?.baseline?.audited);
  ok(dose.status === 0 && last !== null && last.listed === r.listed && last.read === r.read && run(p.dir, "core/scripts/shape.mjs", "checks/shape.json").status === 0,
    `  the audit the dose records is read back by the dose, and the shape check still reads its baseline`, `${dose.out}\n${why}\n${JSON.stringify(r?.baseline?.audited)}`);
  ran.add("dose.mjs");
  const holders = run(p.dir, "core/scripts/holders.mjs", "--own", "--write");
  const h = ownHolders(p.dir);
  const key = h.rules.find(x => /A rule of its own/u.test(x.key))?.key;
  ok(holders.status === 0 && key && h.wrong.length === 0 && h.list, `  the project's own holders written are read back, its own rule named`, `${holders.out}\n${JSON.stringify(h.wrong)}`);
  ran.add("holders-own.mjs");
  const recorded = run(p.dir, "core/scripts/core-reading.mjs", "--recorded");
  let record = null;
  try { record = recordOf(fs.readFileSync(path.join(p.dir, "checks/core-reading.json"), "utf8")); } catch (e) { why = e.message; }
  const due = run(p.dir, "core/scripts/core-reading.mjs");
  ok(recorded.status === 0 && record?.day === last?.day && record?.marks?.size > 0 && due.status === 0 && /^No reading of the project against the core is due/mu.test(due.out),
    `  the reading against the core recorded is read back: nothing is due`, `${recorded.out}\n${due.out}\n${why}`);
  ran.add("core-reading.mjs");
  first ??= p;
}

// ---- the inbox file the scheduled look writes, as the inbox reads it ----
{
  const dir = scratchDir("round-trip-inbox-"), title = "Steps of a release not done";
  fs.mkdirSync(path.join(dir, "inbox"));
  fs.writeFileSync(path.join(dir, "inbox", slug(title)), inboxFile(title, "Two steps.", "GitHub's daily job"));
  const [stateLine, byLine] = fs.readFileSync(path.join(dir, "inbox", slug(title)), "utf8").split("\n");
  ok(items(dir).join() === slug(title) && items(dir).odd === 0 && STATES.includes(stateLine.replace(/^State: /u, "")) && SENDERS.includes(byLine.replace(/^By: /u, "")),
    "the inbox file the look writes is read by the inbox's reader, its state and sender in its lists", `${items(dir)} ${stateLine} ${byLine}`);
  ran.add("look-keep.mjs");
}

// ---- a sync: the new pin and the moved calls, read back ----
{
  fs.appendFileSync(path.join(core, ".github/workflows/core.yml"), "# moved\n");
  git(core, "commit", "-q", "-am", "the core moves");
  const next = git(core, "rev-parse", "HEAD");
  // (the sync reaches its scratch core through the core's own address, scratchEnv's rewrite, and the copy's packages are
  // installed by the real npm once, reading a copy of the machine's cache first, as in check-test.mjs: the last runs
  // here, so the scratch's environment becomes the sync's)
  const syncEnv = npmOnce(scratchEnv(core, tmp), tmp, { real: npmWithCache(tmp) });
  for (const name of Object.keys(env)) delete env[name];
  Object.assign(env, syncEnv);
  const synced = run(first.dir, "core/scripts/sync.mjs", next);
  const held = project(first.dir);
  const k = kind(held);
  const theCore = Object.values(held.workflows).flatMap(w => usesIn(w.yaml)).filter(u => u.startsWith(`${CORE}/`));
  ok(synced.status === 0 && readCore(held.manifest).pin === next && k.pin === next && theCore.length > 0 && theCore.every(u => u.endsWith(`@${next}`)),
    "a sync's new pin and its moved calls are read back by the manifest's reader and the YAML reader", synced.out);
  const pl = plan(held, kits(held, null, k).kit);
  ok(pl.write.length === 0 && pl.remove.length === 0, "  and the one process reads the synced project back as nothing to write", JSON.stringify(pl).slice(0, 600));
  ran.add("sync.mjs");
}

const notRun = Object.entries(WRITERS).filter(([f, [at]]) => at === "here" && !ran.has(f)).map(([f]) => f);
ok(notRun.length === 0, "each writer marked here had its round trip run", notRun.map(f => `${f} is marked "here" in tests/round-trip-test.mjs but no round trip of it ran. Mend: write its round trip there`).join("\n"));
done("the round trips of the core's writers and readers");
