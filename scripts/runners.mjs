// Where a project's tests run and who pays for them (tasks/tests.md, "The slow suites run once per batch, wherever
// they run"; #733, point 6), read and never asked (the core's AGENTS.md, "What can be read is never asked or
// declared"). From the project's workflows (.github/workflows/) it reads the jobs on a pull request or a push that
// start a suite through the shape check (`shape.mjs ... --suite`), as every suite is started, and the runner each takes
// (`self-hosted` or a runner group: the owner's own; only the host's own labels: the host's; else not read). From the host it reads whether the
// repository is private, so its minutes are billed. A row of the manifest only overrides each: *test runners*
// (`hosted`, `self-hosted` or `local`) and *billed minutes* (merge-line.mjs, beside this file). It prints what it
// read and how often the slow and platform suites run at the default branch's newest commit:
// - once an hour on the host's free runners;
// - once a night where minutes are billed or the runner is a machine of the owner's;
// - only before a release where the tests run on a computer alone;
// - and in full before each release in every case;
// and where every merge goes live (the manifest's *users get*, `merges` where no row says), on each pull request.
// Where a public repository runs a job on a pull request or a push on a runner of its own, or on one it cannot read, it
// prints the advice: keep forks off that job at once, and file one issue for the owner, labelled needs-owner, since a
// stranger's pull request would run its code on that machine (floor rule 18). It fails nothing ("Nothing locks a project").
// gh, Node's own modules and the core's yaml package.
//
//   node core/scripts/runners.mjs --repo <owner>/<name>
import fs from "node:fs";
import path from "node:path";
import { aRepository, oneLine } from "./guards.mjs";
import { ghApi } from "./labels.mjs";
import { coreOwn, override } from "./merge-line.mjs";
import { loadSync } from "./packages.mjs";
import { started } from "./started.mjs";

const WHERE = ["hosted", "self-hosted", "local"];
const ON = ["pull_request", "pull_request_target", "push", "merge_group"];

// A workflow's triggers, as GitHub reads `on`: a name, a list of names, or a mapping keyed by them.
const triggers = on => typeof on === "string" ? [on] : Array.isArray(on) ? on.filter(x => typeof x === "string") : on && typeof on === "object" ? Object.keys(on) : [];

// The labels a job's runner is named by: its runs-on (a name, a list, or a group's), and where runs-on is
// `${{ matrix.<key> }}`, the values that key takes: its list, and that key in each `include` entry, a list written as
// `${{ fromJSON('...') }}` read from the lists its literals hold. Read to a depth and a count, and each object once, so a
// file whose anchors refer to themselves reads as far as it goes and no further.
function labelsOf(job) {
  const out = [], seen = new Set();
  const walk = (v, depth) => {
    if (out.length > 500 || depth > 8 || v === null || v === undefined) return;
    if (typeof v === "string") { out.push(v); return; }
    if (typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    for (const x of Array.isArray(v) ? v : Object.values(v)) walk(x, depth + 1);
  };
  const on = job?.["runs-on"];
  const key = typeof on === "string" ? /^\$\{\{\s*matrix\.([\w-]+)\s*\}\}$/u.exec(on.trim())?.[1] : undefined;
  if (key === undefined) walk(on, 0);
  else {
    const matrix = job?.strategy?.matrix;
    walk(matrix?.[key], 0);
    for (const entry of entriesOf(matrix?.include)) walk(entry?.[key], 0);
    if (!out.length) out.push(on); // (no value read for the key: the expression stands, and is not read)
  }
  return { labels: out, group: !!on && typeof on === "object" && !Array.isArray(on) && "group" in on };
}

// A matrix's `include`: a list, or `${{ fromJSON('...') }}` whose literal lists are read where they parse; [] otherwise.
function entriesOf(include) {
  if (Array.isArray(include)) return include;
  if (typeof include !== "string") return [];
  return [...include.slice(0, 200000).matchAll(/'(\[[^']*\])'/gu)].flatMap(m => { try { const v = JSON.parse(m[1]); return Array.isArray(v) ? v : []; } catch { return []; } });
}

// What a job's runner is: "own" (the label self-hosted, or a runner group), "hosted" (only the host's own labels:
// ubuntu-, windows- and macos-, and a matrix's values among them), or null where it cannot be read (another label, or
// an expression that is no matrix value).
const HOSTED = /^(ubuntu|windows|macos)(-[\w.-]+)?$/u;
function runnerOf(job) {
  const { labels, group } = labelsOf(job);
  if (group || labels.some(l => /(^|[\s,'"[])self-hosted($|[\s,'"\]])/u.test(l))) return "own";
  const plain = labels.filter(l => !/\$\{\{/u.test(l));
  if (plain.length && plain.length === labels.length && plain.every(l => HOSTED.test(l))) return "hosted";
  return null;
}

// Whether a job starts a suite through the shape check, as every suite is started (tasks/tests.md, "A time mark measures
// and never fails"): a step whose run names shape.mjs and --suite.
const startsSuite = job => (Array.isArray(job?.steps) ? job.steps : []).some(st => typeof st?.run === "string" && /shape\.mjs\b/u.test(st.run) && /--suite\b/u.test(st.run));

// What the workflows in `dir` say: { onHost (a job that starts a suite runs on a pull request or a push), where (that
// job's runner, "own", "hosted" or null where it cannot be read), selfHosted (any job on a pull request or a push takes
// a runner of the owner's own), unknown (one whose runner cannot be read), unread (the files that could not be read) }.
export function workflowsIn(dir, parse = loadSync("yaml").parse) {
  const out = { onHost: false, testRunners: [], selfHosted: false, unknown: false, unread: [] };
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /\.ya?ml$/u.test(f)); } catch { return out; }
  const read = {};
  for (const f of files) {
    try { read[f] = parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { out.unread.push(f); }
  }
  const seen = reached(read);
  try {
    for (const f of seen) {
      // (a job that calls a workflow takes no runner of its own: the called workflow's jobs do, followed above where it
      // stands here)
      for (const job of jobsOf(read[f]).filter(j => typeof j?.uses !== "string")) {
        const runner = runnerOf(job);
        out.selfHosted ||= runner === "own";
        out.unknown ||= runner === null;
        if (startsSuite(job)) { out.onHost = true; out.testRunners.push(runner); }
      }
    }
  } catch { out.unread.push(...[...seen].filter(f => !out.unread.includes(f))); }
  return out;
}

// The workflows a pull request or a push starts, and those of this folder they call, `uses: ./.github/workflows/<f>`,
// followed to a depth, each once: their jobs run on the pull request or the push too.
const LOCAL = /^\.\/\.github\/workflows\/([^/]+\.ya?ml)$/u;
function reached(read) {
  const started = Object.keys(read).filter(f => triggers(read[f]?.on ?? read[f]?.true).some(t => ON.includes(t)));
  const seen = new Set(started), queue = started.map(f => [f, 0]);
  for (let k = 0; k < queue.length; k++) {
    const [f, depth] = queue[k];
    const calls = depth < 4 ? jobsOf(read[f]).map(j => LOCAL.exec(typeof j?.uses === "string" ? j.uses.trim() : "")?.[1]) : [];
    for (const c of calls.filter(c => c && c in read && !seen.has(c))) { seen.add(c); queue.push([c, depth + 1]); }
  }
  return seen;
}

// A workflow's jobs, as a list; none where it holds no mapping of them.
const jobsOf = wf => (wf?.jobs && typeof wf.jobs === "object" ? Object.values(wf.jobs) : []);

// The manifest's row *test runners*, or undefined where none holds a value it takes.
export function runnersRow(manifest) {
  const m = /^\|[ \t]*\*test runners\*[ \t]*\|[ \t]*`([a-z-]+)`/mu.exec(String(manifest ?? ""));
  return m && WHERE.includes(m[1]) ? m[1] : undefined;
}

// Whether the repository is private, as the host says: true, false, or null where it did not answer.
function privateOf(repo, gh) {
  let v = null;
  try { v = JSON.parse(gh(`repos/${repo}`) || "null")?.private; } catch { /* (not read) */ }
  return typeof v === "boolean" ? v : null;
}

// Where the tests run and who pays, read and overridden: { where, whereRead, whereRow, billed, billedRow }.
function settled(w, priv, manifest) {
  // (where the tests run: the runners of the jobs that start a suite; one that cannot be read is taken as the owner's
  // own, the stricter reading, and said so)
  const testsUnknown = w.testRunners.includes(null);
  const whereRead = w.testRunners.includes("own") || testsUnknown ? "self-hosted" : w.onHost ? "hosted" : "local";
  const whereRow = runnersRow(manifest), billedRow = override(manifest, "billed minutes", ["yes", "no"]);
  // (where whether it is private was not read: taken as billed, the cheaper way)
  const billed = billedRow ? billedRow === "yes" : priv !== false;
  return { where: whereRow ?? whereRead, whereRead, whereRow, billed, billedRow, unknown: testsUnknown && !w.testRunners.includes("own") };
}

const PLACES = { hosted: "the host's runners", "self-hosted": "a runner of the owner's own", local: "a session's or the owner's computer alone, no job on a pull request or a push starting a suite through the shape check" };
const WHEN = { merge: "on each pull request, before its merge, every merge going live (the manifest's *users get*, `merges` where no row says)", hourly: "once an hour, where it moved", nightly: "once a night, where it moved", release: "before each release, on that computer" };

// The lines that say what was read, and from where.
function saidOf(s, priv, unread) {
  const whereBy = s.whereRow ? `, as the manifest's row *test runners* says (read: ${s.whereRead})` : "";
  const paidBy = s.billedRow ? ", as the manifest's row *billed minutes* says"
    : priv === null ? " (whether the repository is private was not read, so taken as billed)" : `, the repository being ${priv ? "private" : "public"}`;
  return [`where the tests run: ${PLACES[s.where]}${whereBy}${s.unknown && !s.whereRow ? " (a job's runner, named by a label of its own or an expression, could not be read, so taken as the owner's own)" : ""}`, `who pays: ${s.billed ? "minutes billed" : "the host's free minutes"}${paidBy}`,
    ...unread.length ? [`workflows not read: ${unread.map(f => oneLine(f).slice(0, 60)).join(", ")}`] : []];
}

// Where the tests run, who pays and how often the slow suites run: { where, billed, cadence, said, when, advice }.
export function read({ repo, dir = ".github/workflows", manifest = null, gh = ghApi, parse }) {
  const w = workflowsIn(dir, parse), priv = privateOf(repo, gh), s = settled(w, priv, manifest);
  // (where every merge goes live, each merge is a release: the slow suites run before it, on its pull request)
  const users = override(manifest, "users get", ["merges", "releases"]) ?? "merges";
  const cadence = users === "merges" ? "merge" : s.where === "local" ? "release" : s.where === "self-hosted" || s.billed ? "nightly" : "hourly";
  const advice = (w.selfHosted || w.unknown) && priv === false
    ? `A public repository runs a job on ${w.selfHosted ? "a runner of the owner's own" : "a runner that could not be read, perhaps the owner's own"}, where a stranger's pull request would run its code (floor rule 18): keep pull requests from forks off that job at once (an \`if:\` that its head repository is this one), and, where no open issue names it, file one for the owner, labelled needs-owner, to move that job to the host's runners or have every outside contributor's run approved first; nothing else waits on it.`
    : null;
  return { where: s.where, billed: s.billed, cadence, said: saidOf(s, priv, w.unread), when: WHEN[cadence], advice };
}

export function main(argv, { gh = ghApi, say = console.log } = {}) {
  const i = argv.indexOf("--repo"), repo = i >= 0 ? argv[i + 1] : undefined;
  if (!aRepository(repo)) { console.error("FAIL: no repository was named. Mend: run node core/scripts/runners.mjs --repo <owner>/<name> from the project's root"); return 1; }
  // (the core's own repository holds no manifest: its slots stand in its AGENTS.md, read as merge-line.mjs reads them)
  const manifest = fs.existsSync("core-manifest.md") ? fs.readFileSync("core-manifest.md", "utf8") : coreOwn();
  const r = read({ repo, manifest, gh });
  say([`Where ${repo}'s tests run and who pays:`, ...r.said.map(s => `- ${s}`),
    r.cadence === "merge" ? `The slow and platform suites run ${r.when}, and in full before each release (the core's tasks/tests.md).`
      : `A pull request runs the fast suites its change reaches; the slow and platform suites run at the default branch's newest commit ${r.when}, and in full before each release (the core's tasks/tests.md).`,
    ...r.advice ? [r.advice] : []].join("\n"));
  return 0;
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
