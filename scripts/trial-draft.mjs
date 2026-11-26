// The draft in a release's trial (#1334; AGENTS.md, "A release's trial opens its update as a draft in the owner's own
// projects"): what the host's checks said of the draft pull request that holds a project's sync, pinned to the commit
// tried, set beside what they said of the newest commit of the project's main, counted in the trial's record
// (release-trial.mjs, beside this file). The host's own services that run only on a pull request, its dependency review
// among them, are measured here, where the trial's runs of check.mjs cannot measure them. gh and Node's own modules.
//
//   node scripts/trial-draft.mjs <owner>/<name> <the draft's number> <the commit tried> [--gate <a check's name>]...
//         > <a file outside every repository>
//         reads the draft and its checks on the host and prints, on its last line `draft answer: `, the counts that
//         release.mjs --trial takes with --draft after the project's pair; it gives no answer while a check has not
//         finished, on a pull request that is no open draft, pinned elsewhere, or in a repository the core's owner does
//         not own, or where the project's stop switch stands. `--gate` names a check the builder read, from its own log,
//         as failing on the draft only for being one (the form of a project's test gate, setup/sync-notes/680): it is
//         counted apart and holds nothing, and the record's pull request says why.
import fs from "node:fs";
import { aCommit, aRepository, asText } from "./guards.mjs";
import { OWNER } from "./core-address.mjs";
import { readCore } from "./core-path.mjs";
import { ghAsk } from "./owner-settings.mjs";
import { started } from "./started.mjs";

const LINE = "draft answer: ";

// Each class of a check, by what it said on main's newest commit and on the draft: passed or failed on both; failed on
// main and passed on the draft; passed on main and failed on the draft (the release's, which holds the cut); ran on the
// draft alone, failed (the release's too, as a check that ran not before and failed after; the dependency review runs
// on a pull request alone) or passed; and failed on the draft for being one, as the builder named it (`--gate`).
export const DRAFT_COUNTS = ["draftPassedBoth", "draftFixedAfter", "draftFailedBoth", "draftFailedAfter", "draftFailedAlone", "draftPassedAlone", "draftGated"];

// What a check said, from a check run or a commit status of GitHub's: passed, failed, waiting (not finished), or null
// where it did not run (skipped, as a job skipped on a draft is).
const RUN = { success: "passed", neutral: "passed", failure: "failed", timed_out: "failed", cancelled: "failed", action_required: "failed", startup_failure: "failed", stale: "failed" };
const STATUS = { success: "passed", failure: "failed", error: "failed", pending: "waiting" };
export function saidOf(runs, statuses) {
  const out = {};
  const put = (name, v) => { if (typeof name !== "string" || v === null) return; const was = out[name]; out[name] = was === "waiting" || v === "waiting" ? "waiting" : was === "failed" || v === "failed" ? "failed" : v; };
  for (const r of runs ?? []) put(r?.name, r?.status !== "completed" ? "waiting" : RUN[r?.conclusion] ?? (r?.conclusion === "skipped" ? null : "failed"));
  for (const s of statuses ?? []) put(s?.context, STATUS[s?.state] ?? "failed");
  return out;
}

// The counts of the draft's checks beside main's, `gates` set apart where they failed on the draft; a check that ran on
// main alone (a job of a push) measures nothing of the draft and is not counted.
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

// What a commit's checks said, through `ask` (ghAsk's form), page by page: { said } or { why }.
function checksAt(repo, sha, ask) {
  const runs = [];
  for (let page = 1; page <= 10; page++) {
    const got = ask(`repos/${repo}/commits/${sha}/check-runs?per_page=100&page=${page}`);
    if (!Array.isArray(got.body?.check_runs)) return { why: got.why ?? "GitHub gave no check runs" };
    runs.push(...got.body.check_runs);
    if (got.body.check_runs.length < 100) break;
  }
  const status = ask(`repos/${repo}/commits/${sha}/status`);
  if (!Array.isArray(status.body?.statuses)) return { why: status.why ?? "GitHub gave no statuses" };
  return { said: saidOf(runs, status.body.statuses) };
}

// Why the pull request `pull` of `repo` is no draft a trial reads, through `ask`, or null: a repository the core's owner
// does not own, a stop switch that stands, or a pull request that is not an open draft.
function notDraft(repo, pr, pull, ask) {
  if (!pull || typeof pull !== "object") return `pull request ${pr} could not be read. Mend: run it where gh answers for the owner's account, with the draft's number`;
  if (String(pull.base?.repo?.owner?.login ?? "").toLowerCase() !== OWNER.toLowerCase()) return `the repository is not owned by the core's owner's account, ${OWNER}, where a trial opens no draft. Mend: close that pull request at once, delete its branch, and give the project's pair \`--no-draft another-owner\``;
  if (ask(`repos/${repo}/branches/agents-stop`).body) return "the project's stop switch stands (the branch agents-stop), where a trial opens no draft. Mend: close the draft if one was opened, and give the project's pair `--no-draft stop-switch`";
  if (pull.state !== "open" || pull.draft !== true) return `pull request ${pr} is ${pull.state !== "open" ? "not open" : "no draft"}: the trial's draft stays open and a draft until the cut. Mend: open the sync as a draft again, or mark it a draft`;
  return null;
}

// Why the draft's head, `head`, does not pin the commit tried, `sha`, as its manifest reads through `ask`, or null.
function notPinned(repo, head, sha, ask) {
  const manifest = ask(`repos/${repo}/contents/core-manifest.md?ref=${head}`).body;
  const pin = typeof manifest?.content === "string" ? readCore(Buffer.from(manifest.content, "base64").toString("utf8")).pin : undefined;
  return pin === sha ? null : `the draft's head pins ${pin ? pin.slice(0, 7) : "no copy that could be read"}, not the commit tried, ${sha.slice(0, 7)}. Mend: on its branch, run \`node core/scripts/sync.mjs ${sha}\` (the copy's sync script), commit what it writes, push it, and read again once its checks finish`;
}

// The draft `pr` of `repo` read for the commit tried, `sha`, through `ask`: { answer } (the commit and the counts) with
// the checks `failed` on it that did not fail on main, or { why } it gives none, with its mend.
export function readDraft(repo, pr, sha, gates = [], ask = ghAsk) {
  const pull = ask(`repos/${repo}/pulls/${pr}`).body;
  const head = String(pull?.head?.sha ?? ""), base = String(pull?.base?.ref ?? "");
  const refused = notDraft(repo, pr, pull, ask) ?? (aCommit(head) ? notPinned(repo, head, sha, ask) : "GitHub gave the draft no head commit. Mend: run it again where gh answers for the owner's account");
  if (refused) return { why: refused };
  const main = ask(`repos/${repo}/commits/${encodeURIComponent(base)}`).body?.sha;
  if (!aCommit(main)) return { why: `the newest commit of ${base || "its base"} could not be read. Mend: run it again where gh answers for the owner's account` };
  const [then, now] = [checksAt(repo, main, ask), checksAt(repo, head, ask)];
  if (!then.said || !now.said) return { why: `the checks could not be read: ${then.why ?? now.why}. Mend: run it again where gh answers for the owner's account` };
  const waiting = [then.said, now.said].map(s => Object.values(s).filter(v => v === "waiting").length);
  if (waiting[0] + waiting[1]) return { why: `${waiting[1]} checks on the draft and ${waiting[0]} on main's newest commit have not finished. Mend: read again once they finish, without polling` };
  return { answer: { commit: sha, ...draftCounts(then.said, now.said, gates) }, failed: Object.entries(now.said).filter(([n, v]) => v === "failed" && !gates.includes(n) && then.said[n] !== "failed").map(([n]) => n) };
}

// What trial-draft.mjs printed, `text`, read for the commit `sha`: its last line `draft answer: ` and its JSON, as
// { answer }, the counts, or { why } it is none.
export function draftAnswerOf(text, sha) {
  const line = String(text).split("\n").map(l => l.trimEnd()).filter(l => l.startsWith(LINE)).at(-1);
  let a = null;
  try { a = JSON.parse(line.slice(LINE.length)); } catch { /* (none, or not read) */ }
  if (a === null || typeof a !== "object" || !DRAFT_COUNTS.every(k => Number.isInteger(a[k]) && a[k] >= 0)) return { why: `holds no line \`${LINE}\` as trial-draft.mjs prints it` };
  if (a.commit !== sha) return { why: `answers for ${String(a.commit).slice(0, 7)}, not the commit tried, ${sha.slice(0, 7)}` };
  return { answer: Object.fromEntries(DRAFT_COUNTS.map(k => [k, a[k]])) };
}

// Why no draft was opened in a project tried: another owner's, or its stop switch stood.
export const NO_DRAFT = { "another-owner": "draftsAnotherOwner", "stop-switch": "draftsStopped" };

// The arguments of release.mjs --trial after the commit, with each `--draft <file>` or `--no-draft <why>` taken out and
// given by the index of the pair before it: { rest, drafts }, or { why } where one follows no whole pair or a pair has two.
export function draftsIn(args) {
  const rest = [], drafts = [];
  let files = 0;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sync") { rest.push(args[i], args[i + 1]); i++; continue; }
    if (args[i] !== "--draft" && args[i] !== "--no-draft") { rest.push(args[i]); files++; continue; }
    const at = files / 2 - 1, value = args[i + 1];
    if (!files || files % 2 || drafts[at] !== undefined || value === undefined || (args[i] === "--no-draft" && !Object.hasOwn(NO_DRAFT, value))) return { why: `each project's pair takes one \`--draft <the file trial-draft.mjs wrote>\`, or \`--no-draft another-owner\` or \`--no-draft stop-switch\`, after it` };
    drafts[at] = args[i] === "--draft" ? { file: value } : { none: value };
    i++;
  }
  return { rest, drafts };
}

// Each pair's reading of its draft, from what `drafts` gives after it (draftsIn): { readings }, each { answer } or
// { none }, or { why } the first is none: a pair with neither is refused, so no trial is recorded that never asked it.
export function draftReadingsOf(drafts, sha, pairs) {
  const readings = [];
  for (let n = 0; n < pairs; n++) {
    const d = drafts[n];
    if (d === undefined) return { why: `project ${n + 1}'s runs are given with neither --draft nor --no-draft after them: in a project of the owner's own, open its sync as a draft pull request pinned to ${sha.slice(0, 7)} and give what \`node scripts/trial-draft.mjs <owner>/<name> <its number> ${sha}\` wrote with --draft; in another owner's, give \`--no-draft another-owner\`, and where its stop switch stands, \`--no-draft stop-switch\`` };
    if (d.none) { readings.push(d); continue; }
    let text = null;
    try { text = fs.readFileSync(d.file, "utf8"); } catch { /* (not read) */ }
    const got = text === null ? { why: "cannot be read" } : draftAnswerOf(text, sha);
    if (!got.answer) return { why: `${d.file}, given with --draft for project ${n + 1}, ${got.why}: give the file trial-draft.mjs wrote for the commit tried, ${sha.slice(0, 7)}` };
    readings.push(got);
  }
  return { readings };
}

// The record's counts of the drafts, from each pair's reading: how many were read, how many projects had none and why,
// and the counts of the drafts' checks summed.
export function draftRecord(readings) {
  const out = { drafts: 0, draftsAnotherOwner: 0, draftsStopped: 0, ...Object.fromEntries(DRAFT_COUNTS.map(k => [k, 0])) };
  for (const r of readings) {
    if (r.none) { out[NO_DRAFT[r.none]]++; continue; }
    out.drafts++;
    for (const k of DRAFT_COUNTS) out[k] += r.answer[k];
  }
  return out;
}

// Whether a record's counts of the drafts are in their form: counts, one reading for each project, and the checks'
// counts none where no draft was read; too few drafts for the owner's own projects found is in its form, and holds the
// cut (draftHeld).
export function draftFormed(r) {
  const keys = ["ownProjects", "drafts", "draftsAnotherOwner", "draftsStopped", ...DRAFT_COUNTS];
  return keys.every(k => Number.isInteger(r[k]) && r[k] >= 0) && r.drafts + r.draftsAnotherOwner + r.draftsStopped === r.projects
    && (r.drafts > 0 || DRAFT_COUNTS.every(k => r[k] === 0));
}

// What a record says of them.
export const draftSaid = r => (r.projects === 0 ? "" : `On the drafts of the sync in the owner's own projects, ${r.drafts} read of ${r.ownProjects} such projects found, ${r.draftsAnotherOwner} projects of another owner's with none and ${r.draftsStopped} with none for a stop switch: ${r.draftPassedBoth} checks passed on main and the draft, ${r.draftFixedAfter} failed on main and passed on it, ${r.draftFailedBoth} failed on both (standing before), ${r.draftFailedAfter} passed on main and failed on the draft (the release's), ${r.draftFailedAlone} ran on the draft alone and failed (the release's too), ${r.draftPassedAlone} ran on it alone and passed, and ${r.draftGated} failed on it for being a draft, as its builder read them.`);

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
  let bad = false;
  for (let i = 0; i < more.length; i += 2) { if (more[i] !== "--gate" || !more[i + 1]) { bad = true; break; } gates.push(more[i + 1]); }
  if (bad || !aRepository(repo) || !/^[1-9]\d*$/.test(pr ?? "") || !aCommit(sha)) {
    console.error("FAIL trial-draft.mjs needs <owner>/<name>, the draft's number and the full SHA of the commit tried, then any `--gate <a check's name>`. Mend: give them as its header says");
    process.exit(1);
  }
  const got = readDraft(repo, pr, sha, gates);
  if (!got.answer) { console.error(`FAIL no answer for the draft: ${got.why}.`); process.exit(1); }
  for (const name of got.failed) console.log(`  failed on the draft: ${asText(name)}`);
  console.log(`${LINE}${JSON.stringify(got.answer)}`);
}
