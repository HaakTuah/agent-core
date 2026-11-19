// Where a project's tests run and who pays for them (tasks/tests.md, "The slow suites run once per batch, wherever
// they run"; #733, point 6), read and never asked (the core's AGENTS.md, "What can be read is never asked or
// declared"). From the project's workflows (.github/workflows/) it reads whether any runs on a pull request or a push,
// and whether any job takes a runner of its own (`self-hosted` among its labels). From the host it reads whether the
// repository is private, so its minutes are billed. A row of the manifest only overrides each: *test runners*
// (`hosted`, `self-hosted` or `local`) and *billed minutes* (merge-line.mjs, beside this file). It prints what it
// read and how often the slow and platform suites run at the default branch's newest commit:
// - once an hour on the host's free runners;
// - once a night where minutes are billed or the runner is a machine of the owner's;
// - only before a release where the tests run on a computer alone;
// - and in full before each release in every case.
// Where a public repository runs a job on a runner of its own, it advises the owner, by one issue labelled needs-owner,
// since a stranger's pull request would run its code on that machine. It fails nothing ("Nothing locks a project").
// gh, Node's own modules and the core's yaml package.
//
//   node core/scripts/runners.mjs --repo <owner>/<name>
import fs from "node:fs";
import path from "node:path";
import { aRepository, oneLine } from "./guards.mjs";
import { ghApi } from "./labels.mjs";
import { override } from "./merge-line.mjs";
import { loadSync } from "./packages.mjs";
import { started } from "./started.mjs";

const WHERE = ["hosted", "self-hosted", "local"];
const ON = ["pull_request", "pull_request_target", "push", "merge_group"];

// A workflow's triggers, as GitHub reads `on`: a name, a list of names, or a mapping keyed by them.
const triggers = on => typeof on === "string" ? [on] : Array.isArray(on) ? on.map(String) : on && typeof on === "object" ? Object.keys(on) : [];

// Whether a job asks for a runner of its own: `self-hosted` among the labels of its runs-on (a name, a list, or a
// group's labels), or among the values of its matrix, where runs-on is an expression that takes one.
function ownRunner(job) {
  const labels = v => typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(labels) : v && typeof v === "object" ? Object.values(v).flatMap(labels) : [];
  return [...labels(job?.["runs-on"]), ...labels(job?.strategy?.matrix)].some(l => /(^|[\s,'"[])self-hosted($|[\s,'"\]])/u.test(l));
}

// What the workflows in `dir` say: { onHost (any runs on a pull request or a push), selfHosted, unread (the files that
// could not be read) }.
export function workflowsIn(dir, parse = loadSync("yaml").parse) {
  const out = { onHost: false, selfHosted: false, unread: [] };
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /\.ya?ml$/u.test(f)); } catch { return out; }
  for (const f of files) {
    let wf;
    try { wf = parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { out.unread.push(f); continue; }
    if (triggers(wf?.on ?? wf?.true).some(t => ON.includes(t))) out.onHost = true;
    if (Object.values(wf?.jobs ?? {}).some(ownRunner)) out.selfHosted = true;
  }
  return out;
}

// The manifest's row *test runners*, or undefined where none holds a value it takes.
export function runnersRow(manifest) {
  const m = /^\|[ \t]*\*test runners\*[ \t]*\|[ \t]*`([a-z-]+)`/mu.exec(String(manifest ?? ""));
  return m && WHERE.includes(m[1]) ? m[1] : undefined;
}

// Whether the repository is private, as the host says: true, false, or null where it did not answer.
function privateOf(repo, gh) {
  try { return JSON.parse(gh(`repos/${repo}`) || "null")?.private ?? null; } catch { return null; }
}

// Where the tests run and who pays, read and overridden: { where, whereRead, whereRow, billed, billedRow }.
function settled(w, priv, manifest) {
  const whereRead = w.selfHosted ? "self-hosted" : w.onHost ? "hosted" : "local";
  const whereRow = runnersRow(manifest), billedRow = override(manifest, "billed minutes", ["yes", "no"]);
  // (where whether it is private was not read: taken as billed, the cheaper way)
  const billed = billedRow ? billedRow === "yes" : priv !== false;
  return { where: whereRow ?? whereRead, whereRead, whereRow, billed, billedRow };
}

const PLACES = { hosted: "the host's runners", "self-hosted": "a runner of the owner's own", local: "a session's or the owner's computer alone, no workflow running on a pull request or a push" };
const WHEN = { hourly: "once an hour, where it moved", nightly: "once a night, where it moved", release: "before each release, on that computer" };

// The lines that say what was read, and from where.
function saidOf(s, priv, unread) {
  const whereBy = s.whereRow ? `, as the manifest's row *test runners* says (read: ${s.whereRead})` : "";
  const paidBy = s.billedRow ? ", as the manifest's row *billed minutes* says"
    : priv === null ? " (whether the repository is private was not read, so taken as billed)" : `, the repository being ${priv ? "private" : "public"}`;
  return [`where the tests run: ${PLACES[s.where]}${whereBy}`, `who pays: ${s.billed ? "minutes billed" : "the host's free minutes"}${paidBy}`,
    ...unread.length ? [`workflows not read: ${unread.map(f => oneLine(f).slice(0, 60)).join(", ")}`] : []];
}

// Where the tests run, who pays and how often the slow suites run: { where, billed, cadence, said, when, advice }.
export function read({ repo, dir = ".github/workflows", manifest = null, gh = ghApi, parse }) {
  const w = workflowsIn(dir, parse), priv = privateOf(repo, gh), s = settled(w, priv, manifest);
  const cadence = s.where === "local" ? "release" : s.where === "self-hosted" || s.billed ? "nightly" : "hourly";
  const advice = w.selfHosted && priv === false
    ? "A public repository runs a job on a runner of the owner's own, where a stranger's pull request would run its code: where no open issue names it, file one for the owner, labelled needs-owner, to move that job to the host's runners; nothing waits on it."
    : null;
  return { where: s.where, billed: s.billed, cadence, said: saidOf(s, priv, w.unread), when: WHEN[cadence], advice };
}

export function main(argv, { gh = ghApi, say = console.log } = {}) {
  const i = argv.indexOf("--repo"), repo = i >= 0 ? argv[i + 1] : undefined;
  if (!aRepository(repo)) { console.error("FAIL: no repository was named. Mend: run node core/scripts/runners.mjs --repo <owner>/<name> from the project's root"); return 1; }
  const manifest = fs.existsSync("core-manifest.md") ? fs.readFileSync("core-manifest.md", "utf8") : null;
  const r = read({ repo, manifest, gh });
  say([`Where ${repo}'s tests run and who pays:`, ...r.said.map(s => `- ${s}`),
    `A pull request runs the fast suites its change reaches; the slow and platform suites run at the default branch's newest commit ${r.when}, and in full before each release (the core's tasks/tests.md).`,
    ...r.advice ? [r.advice] : []].join("\n"));
  return 0;
}

if (started(import.meta.url)) process.exitCode = main(process.argv.slice(2));
