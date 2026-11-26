// The draft in a release's trial (#1334; AGENTS.md, "A release's trial opens its update as a draft in the owner's own
// projects"): what the host's checks said of the draft pull request holding a project's sync, pinned to the commit
// tried, beside what they said of main's newest commit, for the trial's record (release-trial.mjs). gh and Node alone.
//
//   node scripts/trial-draft.mjs <owner>/<name> <the draft's number> <the commit tried> [--gate <a check's name>]...
//         prints, last, `draft answer: ` and the counts release.mjs --trial takes with --draft, with a short hash of the
//         repository's id so no project is given twice; none while a check or workflow waits or none ran, where a list
//         could not be read whole, or for a pull request no open draft from the project's own branch by the owner's
//         account, against the default branch, pinned to the commit, or of another owner's repository, or behind a stop
//         switch that stands or cannot be read. A workflow that could not start counts as a failed check. `--gate` names a check its builder read as failing only for being a
//         draft (setup/sync-notes/680): counted apart, holding nothing, named on its own line.
//   node scripts/trial-draft.mjs <owner>/<name> none <the commit tried>
//         where no draft was opened: reads why (another owner's, a stop switch that stands) and prints it as the answer;
//         none for a repository whose manifest names no copy of this core, or the owner's own without a stop switch.
import { createHash } from "node:crypto";
import { aCommit, aRepository, asText } from "./guards.mjs";
import { OWNER } from "./core-address.mjs";
import { readCore } from "./core-path.mjs";
import { ghAsk } from "./owner-settings.mjs";
import { started } from "./started.mjs";
import { DRAFT_COUNTS, LINE } from "./trial-draft-record.mjs";

// A short hash of a repository's id on the host, which ties a reading to its project under any name and names none.
export const repoHash = id => createHash("sha256").update(String(id)).digest("hex").slice(0, 12);

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

// What a commit's checks said, through `ask` (ghAsk's form), every page read: { said }, or { why }. A workflow run of
// the commit that could not start is a check that failed, and one not finished waits, each named by its workflow.
function checksAt(repo, sha, ask) {
  const runs = pagesOf(`repos/${repo}/commits/${sha}/check-runs`, "check_runs", ask);
  if (runs.why) return runs;
  const status = pagesOf(`repos/${repo}/commits/${sha}/status`, "statuses", ask);
  if (status.why) return status;
  const flows = pagesOf(`repos/${repo}/actions/runs?head_sha=${sha}`, "workflow_runs", ask);
  if (flows.why) return flows;
  const unstarted = flows.items.filter(w => w?.conclusion === "startup_failure" || w?.status !== "completed").map(w => ({ name: `${w.name ?? "a workflow"} (${w.status === "completed" ? "could not start" : "workflow"})`, status: w.status === "completed" ? "completed" : "queued", conclusion: "failure" }));
  return { said: saidOf([...runs.items, ...unstarted], status.items) };
}

// Whether the stop switch of `repo` stands, through `ask`: true or false, or { why } where it could not be read; GitHub's
// 404 alone says it does not.
function stopOf(repo, ask) {
  const got = ask(`repos/${repo}/branches/agents-stop`);
  if (got.body) return true;
  return /^GitHub answered 404\b/.test(got.why ?? "") ? false : { why: `the project's stop switch could not be read (${got.why ?? "no answer"}), and one not read may stand. Mend: run it again where gh answers for the owner's account` };
}

const NONE_MEND = "give the project's pair the reading of `node scripts/trial-draft.mjs <owner>/<name> none <the commit tried>`";

// Why the pull request `pull` stands where no trial's draft does, or null: against a branch that is not the default,
// from another repository than the project, or opened by another account than the owner's (`ours`).
function notPlaced(pr, pull, ours) {
  const base = pull.base?.ref, main = pull.base?.repo?.default_branch;
  if (typeof main !== "string" || !main || base !== main) return `pull request ${pr} is opened against ${base || "no branch that could be read"}, not the project's default branch${main ? `, ${main}` : ""}, whose checks the draft's are read beside. Mend: open the sync as a draft against the default branch, and read that one`;
  if (pull.head?.repo?.id !== pull.base?.repo?.id || !ours(pull.user?.login)) return `pull request ${pr} comes from ${pull.head?.repo?.id !== pull.base?.repo?.id ? "another repository than the project's" : "another account than the core's owner's"}, and the trial's draft is opened from a branch of the project itself, by the owner's account. Mend: write nothing more there, tell the owner that it stands, and open the trial's own draft as the release's trial says`;
  return null;
}

// Why the pull request `pull` of `repo` is no draft a trial reads, through `ask`, or null: a repository the core's owner
// does not own, a stop switch that stands or cannot be read, a base that is not the default branch, or a pull request
// that is not an open draft. Where a draft stands that no trial opens, the session writes nothing more there and tells
// the owner (floor rule 14).
function notDraft(repo, pr, pull, ask) {
  if (!pull || typeof pull !== "object") return `pull request ${pr} could not be read. Mend: run it where gh answers for the owner's account, with the draft's number`;
  const ours = login => String(login ?? "").toLowerCase() === OWNER.toLowerCase();
  if (!ours(pull.base?.repo?.owner?.login)) return `the repository is not owned by the core's owner's account, ${OWNER}, where a trial opens no draft. Mend: write nothing more there, tell the owner at once that a pull request stands there, and ${NONE_MEND}`;
  const stop = stopOf(repo, ask);
  if (stop.why) return stop.why;
  if (stop) return `the project's stop switch stands (the branch agents-stop), where a trial opens no draft. Mend: write nothing more there, tell the owner that a draft stands there, and ${NONE_MEND}`;
  const placed = notPlaced(pr, pull, ours);
  if (placed) return placed;
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
  const [then, now] = [checksAt(repo, main, ask), checksAt(repo, head, ask)];
  if (!then.said || !now.said) return { why: `the checks could not be read: ${then.why ?? now.why}. Mend: run it again where gh answers for the owner's account` };
  if (!Object.keys(now.said).length) return { why: "no check has run on the draft yet (a skipped one does not), and a draft with none measures nothing. Mend: read again once its checks have started and finished, without polling" };
  const waiting = [then.said, now.said].map(s => Object.values(s).filter(v => v === "waiting").length);
  if (waiting[0] + waiting[1]) return { why: `${waiting[1]} checks on the draft and ${waiting[0]} on main's newest commit have not finished. Mend: read again once they finish, without polling` };
  const failedHere = Object.entries(now.said).filter(([n, v]) => v === "failed" && then.said[n] !== "failed").map(([n]) => n);
  return { answer: { commit: sha, repo: repoHash(pull.base.repo.id), ...draftCounts(then.said, now.said, gates) }, failed: failedHere.filter(n => !gates.includes(n)), gated: failedHere.filter(n => gates.includes(n)) };
}

// Why no draft was opened in `repo`, read through `ask`: { answer } (the commit, the repository's hash and `none`), or
// { why } it gives none: a repository whose manifest names no copy of this core is no project tried, and a project of
// the owner's own whose stop switch does not stand takes a draft.
export function readNone(repo, sha, ask = ghAsk) {
  const got = ask(`repos/${repo}`);
  const owner = got.body?.owner?.login, id = got.body?.id;
  if (typeof owner !== "string" || !Number.isInteger(id)) return { why: `the repository could not be read (${got.why ?? "no owner or id in GitHub's answer"}). Mend: run it again where gh answers for the owner's account` };
  const manifest = ask(`repos/${repo}/contents/core-manifest.md`).body;
  if (typeof manifest?.content !== "string" || readCore(Buffer.from(manifest.content, "base64").toString("utf8")).wrong) return { why: "the repository's manifest names no copy of this core, so it is no project that takes it. Mend: give the reading of a project the trial ran in" };
  const answer = none => ({ answer: { commit: sha, repo: repoHash(id), none } });
  if (owner.toLowerCase() !== OWNER.toLowerCase()) return answer("another-owner");
  const stop = stopOf(repo, ask);
  if (stop.why) return stop;
  return stop ? answer("stop-switch") : { why: "the project is the owner's own and its stop switch does not stand, so the trial opens a draft there. Mend: open its sync as a draft pull request pinned to the commit tried, and read it by its number" };
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
