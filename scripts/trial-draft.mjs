// The draft in a release's trial (#1334; AGENTS.md, "A release's trial opens its update as a draft in the owner's own
// projects"): what the host's checks said of the draft pull request holding a project's sync, pinned to the commit
// tried, beside what they said of main's newest commit, for the trial's record (release-trial.mjs). gh and Node alone.
//
//   node scripts/trial-draft.mjs <owner>/<name> <the draft's number> <the commit tried> [--gate <a check's name>]...
//         prints, last, `draft answer: ` and the counts release.mjs --trial takes with --draft, with a short hash of the
//         repository's name so no project is given twice; none while a check waits or none started, where a list could
//         not be read whole, or for a pull request no open draft against the default branch pinned to the commit, of
//         another owner's repository, or behind a stop switch that stands or cannot be read. A workflow that could not
//         start counts as failed on the draft. `--gate` names a check its builder read as failing only for being a
//         draft (setup/sync-notes/680): counted apart, holding nothing, named on its own line.
//   node scripts/trial-draft.mjs <owner>/<name> none <the commit tried>
//         where no draft was opened: reads why (another owner's, a stop switch that stands) and prints it as the answer;
//         none for a project of the owner's own whose stop switch does not stand.
import { createHash } from "node:crypto";
import fs from "node:fs";
import { aCommit, aRepository, asText } from "./guards.mjs";
import { OWNER } from "./core-address.mjs";
import { readCore } from "./core-path.mjs";
import { ghAsk } from "./owner-settings.mjs";
import { started } from "./started.mjs";

const LINE = "draft answer: ";

// Each class of a check by what it said on main and on the draft; failed on the draft after passing on main, or run on
// it alone (the dependency review) and failed, is the release's and holds the cut; `--gate` sets a failure apart.
export const DRAFT_COUNTS = ["draftPassedBoth", "draftFixedAfter", "draftFailedBoth", "draftFailedAfter", "draftFailedAlone", "draftPassedAlone", "draftGated"];

// Why no draft was opened, as `none` reads it, with the record's count it adds to.
export const NO_DRAFT = { "another-owner": "draftsAnotherOwner", "stop-switch": "draftsStopped" };

// A short hash of a repository's name, which ties a reading to its project and names none.
export const repoHash = repo => createHash("sha256").update(String(repo).toLowerCase()).digest("hex").slice(0, 12);

// What each check said, from GitHub's check runs and statuses: passed, failed or waiting; a skipped run is left out.
const RUN = { success: "passed", neutral: "passed", failure: "failed", timed_out: "failed", cancelled: "failed", action_required: "failed", startup_failure: "failed", stale: "failed" };
const STATUS = { success: "passed", failure: "failed", error: "failed", pending: "waiting" };
export function saidOf(runs, statuses) {
  const out = {};
  const put = (name, v) => { if (typeof name !== "string" || v === null) return; const was = out[name]; out[name] = was === "waiting" || v === "waiting" ? "waiting" : was === "failed" || v === "failed" ? "failed" : v; };
  for (const r of runs ?? []) put(r?.name, r?.status !== "completed" ? "waiting" : RUN[r?.conclusion] ?? (r?.conclusion === "skipped" ? null : "failed"));
  for (const s of statuses ?? []) put(s?.context, STATUS[s?.state] ?? "failed");
  return out;
}

// The counts of the draft's checks beside main's; one run on main alone (a push's job) is not counted.
export function draftCounts(main, draft, gates = []) {
  const out = Object.fromEntries(DRAFT_COUNTS.map(k => [k, 0]));
  for (const [name, now] of Object.entries(draft)) {
    const then = main[name];
    if (now === "failed" && gates.includes(name)) out.draftGated++;
    else if (then === "passed" || then === "failed") out[now === "passed" ? (then === "passed" ? "draftPassedBoth" : "draftFixedAfter") : (then === "passed" ? "draftFailedAfter" : "draftFailedBoth")]++;
    else out[now === "passed" ? "draftPassedAlone" : "draftFailedAlone"]++;
  }
  return out;
}

// Each item of a list GitHub gives page by page at `route` under `key`, all of `total_count`: { items } or { why }.
function pagesOf(route, key, ask) {
  const items = [];
  for (let page = 1; page <= 10; page++) {
    const got = ask(`${route}${route.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
    const list = got.body?.[key], total = got.body?.total_count;
    if (!Array.isArray(list) || !Number.isInteger(total)) return { why: got.why ?? `GitHub gave no ${key}` };
    items.push(...list);
    if (items.length >= total || list.length < 100) return items.length >= total ? { items } : { why: `GitHub gave ${items.length} of ${total} ${key}` };
  }
  return { why: `more than 1000 ${key}, past what is read` };
}

// What a commit's checks said, through `ask` (ghAsk's form), every page read: { said, ran }, the number of check runs
// and statuses it holds (skipped ones too), or { why }. With `starts`, a workflow run of the commit that could not
// start is a check that failed, named by its workflow.
function checksAt(repo, sha, ask, starts = false) {
  const runs = pagesOf(`repos/${repo}/commits/${sha}/check-runs`, "check_runs", ask);
  if (runs.why) return runs;
  const status = pagesOf(`repos/${repo}/commits/${sha}/status`, "statuses", ask);
  if (status.why) return status;
  const flows = starts ? pagesOf(`repos/${repo}/actions/runs?head_sha=${sha}`, "workflow_runs", ask) : { items: [] };
  if (flows.why) return flows;
  const unstarted = flows.items.filter(w => w?.conclusion === "startup_failure").map(w => ({ name: `${w.name ?? "a workflow"} (could not start)`, status: "completed", conclusion: "failure" }));
  return { said: saidOf([...runs.items, ...unstarted], status.items), ran: runs.items.length + status.items.length + unstarted.length };
}

// Whether the stop switch of `repo` stands, through `ask`: true or false, or { why } where it could not be read; GitHub's
// 404 alone says it does not.
function stopOf(repo, ask) {
  const got = ask(`repos/${repo}/branches/agents-stop`);
  if (got.body) return true;
  return /^GitHub answered 404\b/.test(got.why ?? "") ? false : { why: `the project's stop switch could not be read (${got.why ?? "no answer"}), and one not read may stand. Mend: run it again where gh answers for the owner's account` };
}

const NONE_MEND = "give the project's pair the reading of `node scripts/trial-draft.mjs <owner>/<name> none <the commit tried>`";

// Why the pull request `pull` of `repo` is no draft a trial reads, through `ask`, or null: a repository the core's owner
// does not own, a stop switch that stands or cannot be read, a base that is not the default branch, or a pull request
// that is not an open draft. Where a draft stands that no trial opens, the session writes nothing more there and tells
// the owner (floor rule 14).
function notDraft(repo, pr, pull, ask) {
  if (!pull || typeof pull !== "object") return `pull request ${pr} could not be read. Mend: run it where gh answers for the owner's account, with the draft's number`;
  if (String(pull.base?.repo?.owner?.login ?? "").toLowerCase() !== OWNER.toLowerCase()) return `the repository is not owned by the core's owner's account, ${OWNER}, where a trial opens no draft. Mend: write nothing more there, tell the owner at once that a pull request stands there, and ${NONE_MEND}`;
  const stop = stopOf(repo, ask);
  if (stop.why) return stop.why;
  if (stop) return `the project's stop switch stands (the branch agents-stop), where a trial opens no draft. Mend: write nothing more there, tell the owner that a draft stands there, and ${NONE_MEND}`;
  const base = pull.base?.ref, main = pull.base?.repo?.default_branch;
  if (typeof main !== "string" || !main || base !== main) return `pull request ${pr} is opened against ${base || "no branch that could be read"}, not the project's default branch${main ? `, ${main}` : ""}, whose checks the draft's are read beside. Mend: open the sync as a draft against the default branch, and read that one`;
  if (pull.state !== "open" || pull.draft !== true) return `pull request ${pr} is ${pull.state !== "open" ? "not open" : "no draft"}: the trial's draft stays open and a draft until the cut. Mend: open the sync as a draft again, or mark it a draft`;
  return null;
}

// Why the draft's head, `head`, does not pin the commit tried, `sha`, as its manifest reads through `ask`, or null.
function notPinned(repo, head, sha, ask) {
  const manifest = ask(`repos/${repo}/contents/core-manifest.md?ref=${head}`).body;
  const pin = typeof manifest?.content === "string" ? readCore(Buffer.from(manifest.content, "base64").toString("utf8")).pin : undefined;
  return pin === sha ? null : `the draft's head pins ${pin ? pin.slice(0, 7) : "no copy that could be read"}, not the commit tried, ${sha.slice(0, 7)}. Mend: on its branch, run \`node core/scripts/sync.mjs ${sha}\` (the copy's sync script), commit what it writes, push it, and read again once its checks finish`;
}

// The draft `pr` of `repo` read for the commit tried, `sha`, through `ask`: { answer } (the commit, the repository's
// hash and the counts) with the checks `failed` on it that did not fail on main and those `gated`, or { why } it gives
// none, with its mend.
export function readDraft(repo, pr, sha, gates = [], ask = ghAsk) {
  const pull = ask(`repos/${repo}/pulls/${pr}`).body;
  const head = String(pull?.head?.sha ?? ""), base = String(pull?.base?.ref ?? "");
  const refused = notDraft(repo, pr, pull, ask) ?? (aCommit(head) ? notPinned(repo, head, sha, ask) : "GitHub gave the draft no head commit. Mend: run it again where gh answers for the owner's account");
  if (refused) return { why: refused };
  const main = ask(`repos/${repo}/commits/${encodeURIComponent(base)}`).body?.sha;
  if (!aCommit(main)) return { why: `the newest commit of ${base || "its base"} could not be read. Mend: run it again where gh answers for the owner's account` };
  const [then, now] = [checksAt(repo, main, ask), checksAt(repo, head, ask, true)];
  if (!then.said || !now.said) return { why: `the checks could not be read: ${then.why ?? now.why}. Mend: run it again where gh answers for the owner's account` };
  if (now.ran === 0) return { why: "no check has started on the draft yet, and a draft with none measures nothing. Mend: read again once its checks have started and finished, without polling" };
  const waiting = [then.said, now.said].map(s => Object.values(s).filter(v => v === "waiting").length);
  if (waiting[0] + waiting[1]) return { why: `${waiting[1]} checks on the draft and ${waiting[0]} on main's newest commit have not finished. Mend: read again once they finish, without polling` };
  const failedHere = Object.entries(now.said).filter(([n, v]) => v === "failed" && then.said[n] !== "failed").map(([n]) => n);
  return { answer: { commit: sha, repo: repoHash(repo), ...draftCounts(then.said, now.said, gates) }, failed: failedHere.filter(n => !gates.includes(n)), gated: failedHere.filter(n => gates.includes(n)) };
}

// Why no draft was opened in `repo`, read through `ask`: { answer } (the commit, the repository's hash and `none`), or
// { why } it gives none: a project of the owner's own whose stop switch does not stand takes a draft.
export function readNone(repo, sha, ask = ghAsk) {
  const got = ask(`repos/${repo}`);
  const owner = got.body?.owner?.login;
  if (typeof owner !== "string") return { why: `the repository could not be read (${got.why ?? "no owner in GitHub's answer"}). Mend: run it again where gh answers for the owner's account` };
  const answer = none => ({ answer: { commit: sha, repo: repoHash(repo), none } });
  if (owner.toLowerCase() !== OWNER.toLowerCase()) return answer("another-owner");
  const stop = stopOf(repo, ask);
  if (stop.why) return stop;
  return stop ? answer("stop-switch") : { why: "the project is the owner's own and its stop switch does not stand, so the trial opens a draft there. Mend: open its sync as a draft pull request pinned to the commit tried, and read it by its number" };
}

// What trial-draft.mjs printed, `text`, read for the commit `sha`: its last line `draft answer: ` and its JSON, as
// { answer, repo } (the counts), { none, repo }, or { why } it is none.
export function draftAnswerOf(text, sha) {
  const line = String(text).split("\n").map(l => l.trimEnd()).filter(l => l.startsWith(LINE)).at(-1);
  let a = null;
  try { a = JSON.parse(line.slice(LINE.length)); } catch { /* (none, or not read) */ }
  const counted = a !== null && typeof a === "object" && DRAFT_COUNTS.every(k => Number.isInteger(a[k]) && a[k] >= 0);
  if (!counted && !Object.hasOwn(NO_DRAFT, a?.none ?? "") || !/^[0-9a-f]{12}$/.test(a?.repo ?? "")) return { why: `holds no line \`${LINE}\` as trial-draft.mjs prints it` };
  if (a.commit !== sha) return { why: `answers for ${String(a.commit).slice(0, 7)}, not the commit tried, ${sha.slice(0, 7)}` };
  return counted ? { answer: Object.fromEntries(DRAFT_COUNTS.map(k => [k, a[k]])), repo: a.repo } : { none: a.none, repo: a.repo };
}

// The arguments of release.mjs --trial after the commit, with each `--draft <file>` taken out and given by the index of
// the pair before it: { rest, drafts }, or { why } where one follows no whole pair or a pair has two.
export function draftsIn(args) {
  const rest = [], drafts = [];
  let files = 0;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sync") { rest.push(args[i], args[i + 1]); i++; continue; }
    if (args[i] !== "--draft") { rest.push(args[i]); files++; continue; }
    const at = files / 2 - 1;
    if (!files || files % 2 || drafts[at] !== undefined || args[i + 1] === undefined) return { why: "each project's pair takes one `--draft <the file trial-draft.mjs wrote>` after it" };
    drafts[at] = { file: args[++i] };
  }
  return { rest, drafts };
}

// Each pair's reading of its draft, from what `drafts` gives after it (draftsIn): { readings }, each { answer } or
// { none }, or { why } the first is none: a pair with no reading is refused, so no trial is recorded that never asked
// it, and so is a project's reading given twice.
export function draftReadingsOf(drafts, sha, pairs) {
  const readings = [], seen = new Set();
  for (let n = 0; n < pairs; n++) {
    const d = drafts[n];
    if (d === undefined) return { why: `project ${n + 1}'s runs are given with no --draft after them: in a project of the owner's own, open its sync as a draft pull request pinned to ${sha.slice(0, 7)} and give what \`node scripts/trial-draft.mjs <owner>/<name> <its number> ${sha}\` wrote; where no draft was opened, what \`node scripts/trial-draft.mjs <owner>/<name> none ${sha}\` wrote` };
    let text = null;
    try { text = fs.readFileSync(d.file, "utf8"); } catch { /* (not read) */ }
    const got = text === null ? { why: "cannot be read" } : draftAnswerOf(text, sha);
    if (got.why) return { why: `${d.file}, given with --draft for project ${n + 1}, ${got.why}: give the file trial-draft.mjs wrote for the commit tried, ${sha.slice(0, 7)}` };
    if (seen.has(got.repo)) return { why: `${d.file}, given with --draft for project ${n + 1}, reads a project already given a reading: give each project tried its own` };
    seen.add(got.repo);
    readings.push(got.answer ? { answer: got.answer } : { none: got.none });
  }
  return { readings };
}

// Why the readings of a trial with pairs fall short of the owner's own projects, `own` as state-report.mjs --projects
// found them (null where it could not), or null: each needs a draft's reading or a stop switch that stood.
export function draftsShort(own, readings) {
  if (own === null) return "which of the owner's projects take the core could not be read (scripts/state-report.mjs --projects), so the drafts cannot be told one for each. Mend: run it where gh answers for the owner's account, then --trial again";
  const opened = readings.filter(r => !r.none || r.none === "stop-switch").length;
  return opened < own ? `${own} of the owner's projects take the core, as scripts/state-report.mjs --projects finds them, and ${opened} ${opened === 1 ? "was" : "were"} given a draft's reading or a stop switch. Mend: try each of them, its sync opened as a draft pull request and read with trial-draft.mjs, and give its pair` : null;
}

// The record's counts of the drafts, from each pair's reading.
export function draftRecord(readings) {
  const out = { drafts: 0, draftsAnotherOwner: 0, draftsStopped: 0, ...Object.fromEntries(DRAFT_COUNTS.map(k => [k, 0])) };
  for (const r of readings) {
    if (r.none) { out[NO_DRAFT[r.none]]++; continue; }
    out.drafts++;
    for (const k of DRAFT_COUNTS) out[k] += r.answer[k];
  }
  return out;
}

// Whether a record's counts of the drafts are in their form: one reading a project, no checks' counts with no draft;
// too few drafts is in its form and holds the cut (draftHeld).
export function draftFormed(r) {
  const keys = ["ownProjects", "drafts", "draftsAnotherOwner", "draftsStopped", ...DRAFT_COUNTS];
  return keys.every(k => Number.isInteger(r[k]) && r[k] >= 0) && r.drafts + r.draftsAnotherOwner + r.draftsStopped === r.projects
    && (r.drafts > 0 || DRAFT_COUNTS.every(k => r[k] === 0));
}

// What a record says of them, the gated checks in a sentence of their own.
export const draftSaid = r => (r.projects === 0 ? "" : `On the drafts of the sync in the owner's own projects, ${r.drafts} read of ${r.ownProjects} such projects found, ${r.draftsAnotherOwner} projects of another owner's with none and ${r.draftsStopped} with none for a stop switch: ${r.draftPassedBoth} checks passed on main and the draft, ${r.draftFixedAfter} failed on main and passed on it, ${r.draftFailedBoth} failed on both (standing before), ${r.draftFailedAfter} passed on main and failed on the draft (the release's), ${r.draftFailedAlone} ran on the draft alone and failed (the release's too), and ${r.draftPassedAlone} ran on it alone and passed. ${r.draftGated} failed on the draft and were set apart by its builder as failing for being a draft, holding nothing: the record's pull request names each and why.`);

// Why the drafts hold the cut, or null: a check the release's, or one of the owner's own projects found with no draft
// read and no stop switch.
export function draftHeld(r, again) {
  const failed = r.draftFailedAfter + r.draftFailedAlone, missing = r.ownProjects - r.drafts - r.draftsStopped;
  return [
    failed && `${failed} check${failed === 1 ? "" : "s"} failed on the draft of the sync in the owner's own projects, ${r.draftFailedAfter} of them passing on main and ${r.draftFailedAlone} run on the draft alone. Mend: find the release's fault from the draft's failed checks, mend it in the core in a pull request of its own, move the draft forward to the commit that mends it, and ${again}`,
    missing > 0 && `${missing} of the owner's own projects that take the core ${missing === 1 ? "was" : "were"} tried with no draft of the sync read. Mend: open each one's sync as a draft pull request pinned to the commit tried, read it with \`node scripts/trial-draft.mjs\`, and ${again}`,
  ].filter(Boolean).join("; and ") || null;
}

if (started(import.meta.url)) {
  const [repo, pr, sha, ...more] = process.argv.slice(2);
  const gates = [];
  let bad = pr === "none" && more.length > 0;
  for (let i = 0; i < more.length; i += 2) { if (more[i] !== "--gate" || !more[i + 1]) { bad = true; break; } gates.push(more[i + 1]); }
  if (bad || !aRepository(repo) || !/^([1-9]\d*|none)$/.test(pr ?? "") || !aCommit(sha)) {
    console.error("FAIL trial-draft.mjs needs <owner>/<name>, the draft's number or `none`, and the full SHA of the commit tried, then, with a number, any `--gate <a check's name>`. Mend: give them as its header says");
    process.exit(1);
  }
  const got = pr === "none" ? readNone(repo, sha) : readDraft(repo, pr, sha, gates);
  if (!got.answer) { console.error(`FAIL no answer for the ${pr === "none" ? "project" : "draft"}: ${got.why}.`); process.exit(1); }
  for (const name of got.failed ?? []) console.log(`  failed on the draft: ${asText(name)}`);
  for (const name of got.gated ?? []) console.log(`  set apart as the draft's gate: ${asText(name)}`);
  console.log(`${LINE}${JSON.stringify(got.answer)}`);
}
