// The draft in a release's trial (#1334; AGENTS.md, "A release's trial opens its update as a draft in the owner's own
// projects"): what the host's checks said of the draft pull request holding a project's sync, pinned to the commit
// tried, beside what they said of main's newest commit, for the trial's record (release-trial.mjs). gh and Node alone.
//
//   node scripts/trial-draft.mjs <owner>/<name> <the draft's number> <the commit tried> [--gate <a check's name>]...
//         prints, last, `draft answer: ` and the counts release.mjs --trial takes with --draft, with a short hash of the
//         repository's id so no project is given twice; none while a check or workflow on the draft waits, or one on
//         main the draft holds, skipped or not, waits on no person, where none but skipped ones ran on the draft or a
//         list could not be read whole, or for a pull request no open draft from the project's own branch by the
//         owner's account, against the default branch, pinned to the commit, or of a repository another owner's, whose
//         default branch's manifest pins no copy of this core or could not be read, or behind a stop switch that stands
//         or cannot be read. A workflow run that failed with no failed job of its own counts as a failed check, and two
//         checks meeting on one name from two workflows or jobs, in one commit or across main's and the draft's, give
//         none; one skipped on the draft is counted and named apart, and where it passed on main, not run after, holds the cut. `--gate` names a check its
//         builder read as failing, or skipping after passing on main, only for being a draft (setup/sync-notes/680):
//         counted apart, holding nothing, named on its own line. A check run is named `<workflow>: <job>` where GitHub ties it
//         to a workflow run, so the same job name in two workflows is two checks, and `--gate` takes that name; one GitHub ties
//         to none (an app's) named as a workflow's job is named `<its name> (no workflow)`, and a status named as any
//         check `<its context> (status)`.
//   node scripts/trial-draft.mjs <owner>/<name> none <the commit tried>
//         where no draft was opened: reads why (another owner's, a stop switch that stands) and prints it as the answer;
//         none for a repository whose manifest pins no copy of this core or could not be read, or the owner's own
//         without a stop switch.
import { createHash } from "node:crypto";
import { aCommit, aRepository, asText } from "./guards.mjs";
import { OWNER } from "./core-address.mjs";
import { readCore } from "./core-path.mjs";
import { ghAsk } from "./owner-settings.mjs";
import { started } from "./started.mjs";
import { DRAFT_COUNTS, LINE } from "./trial-draft-record.mjs";
import { alignedOf, checksAt, crossedOf, waitingOf } from "./trial-draft-checks.mjs";

// A short hash of a repository's id on the host, which ties a reading to its project under any name; the line that
// carries it goes to a file outside every repository alone, and the record keeps none.
export const repoHash = id => createHash("sha256").update(String(id)).digest("hex").slice(0, 12);

// The counts of the draft's checks beside main's; one run on main alone (a push's job) is not counted, and one skipped
// on the draft is counted apart, measuring nothing there, as not run after where it passed on main, save one gated.
export function draftCounts(main, draft, gates = []) {
  const out = Object.fromEntries(DRAFT_COUNTS.map(k => [k, 0]));
  for (const [name, now] of Object.entries(draft)) {
    const then = main[name];
    if (now === "skipped") out[then !== "passed" ? "draftSkipped" : gates.includes(name) ? "draftGated" : "draftSkippedAfter"]++;
    else if (now === "failed" && gates.includes(name)) out.draftGated++;
    else if (then === "passed" || then === "failed") out[now === "passed" ? (then === "passed" ? "draftPassedBoth" : "draftFixedAfter") : (then === "passed" ? "draftFailedAfter" : "draftFailedBoth")]++;
    else out[now === "passed" ? "draftPassedAlone" : "draftFailedAlone"]++;
  }
  return out;
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
  if (!Number.isInteger(pull.base?.repo?.id) || pull.head?.repo?.id !== pull.base.repo.id || !ours(pull.user?.login)) return `pull request ${pr} comes from ${ours(pull.user?.login) ? "another repository than the project's, or one GitHub gave no id" : "another account than the core's owner's"}, and the trial's draft is opened from a branch of the project itself, by the owner's account. Mend: write nothing more there, tell the owner that it stands, and open the trial's own draft as the release's trial says`;
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

// Why `repo` is no project that takes this core, as state-report.mjs --projects finds one (its default branch's manifest
// pins a copy), read through `ask`, or null; a manifest not read is said so, never read as none.
function notTaking(repo, ask) {
  const got = ask(`repos/${repo}/contents/core-manifest.md`);
  if (!got.body && !/^GitHub answered 404\b/.test(got.why ?? "")) return `the repository's manifest could not be read (${got.why ?? "no answer"}). Mend: run it again where gh answers for the owner's account`;
  const text = typeof got.body?.content === "string" ? Buffer.from(got.body.content, "base64").toString("utf8") : "";
  return readCore(text).pin ? null : "the manifest on the repository's default branch pins no copy of this core, so it is no project state-report.mjs --projects finds. Mend: give the reading of a project the trial ran in";
}

// Why the draft's head, `head`, does not pin the commit tried, `sha`, as its manifest reads through `ask`, or null.
function notPinned(repo, head, sha, ask) {
  const manifest = ask(`repos/${repo}/contents/core-manifest.md?ref=${head}`).body;
  const pin = typeof manifest?.content === "string" ? readCore(Buffer.from(manifest.content, "base64").toString("utf8")).pin : undefined;
  return pin === sha ? null : `the draft's head pins ${pin ? pin.slice(0, 7) : "no copy that could be read"}, not the commit tried, ${sha.slice(0, 7)}. Mend: on its branch, run \`node core/scripts/sync.mjs ${sha}\` (the copy's sync script), commit what it writes, push it, and read again once its checks finish`;
}

// The draft `pr` of `repo` read for the commit tried, `sha`, through `ask`: { answer } (the commit, the repository's
// hash and the counts) with the checks `failed` on it that did not fail on main, those `gated` and those `skipped`
// (`skippedAfter`, those of them that passed on main), or { why } it gives none, with its mend.
export function readDraft(repo, pr, sha, gates = [], ask = ghAsk) {
  const pull = ask(`repos/${repo}/pulls/${pr}`).body;
  const head = String(pull?.head?.sha ?? ""), base = String(pull?.base?.ref ?? "");
  const refused = notDraft(repo, pr, pull, ask) ?? notTaking(repo, ask) ?? (aCommit(head) ? notPinned(repo, head, sha, ask) : "GitHub gave the draft no head commit. Mend: run it again where gh answers for the owner's account");
  if (refused) return { why: refused };
  const main = ask(`repos/${repo}/commits/${encodeURIComponent(base)}`).body?.sha;
  if (!aCommit(main)) return { why: `the newest commit of ${base || "its base"} could not be read. Mend: run it again where gh answers for the owner's account` };
  const [then, now] = [checksAt(repo, main, ask), checksAt(repo, head, ask)];
  const unread = then.why ?? now.why ?? crossedOf(then, now);
  if (unread) return { why: /Mend:/.test(unread) ? unread : `the checks could not be read: ${unread}. Mend: run it again where gh answers for the owner's account` };
  if (!Object.values(now.said).some(v => v !== "skipped")) return { why: "no check has run on the draft yet (a skipped one does not), and a draft with none measures nothing. Mend: read again once its checks have started and finished, without polling" };
  const waiting = waitingOf(then, now);
  if (waiting[0] + waiting[1]) return { why: `${waiting[1]} checks on the draft and ${waiting[0]} on main's newest commit have not finished. Mend: read again once they finish, without polling` };
  const mainNow = alignedOf(then, now);
  return { answer: { commit: sha, repo: repoHash(pull.base.repo.id), ...draftCounts(mainNow, now.said, gates) }, ...namedOf(mainNow, now.said, gates) };
}

// The draft's checks by name, beside main's `active`: those `failed` that did not fail on main, those `gated`, failed
// there or skipped after passing on main, and those `skipped`, `skippedAfter` those of them that passed on main.
function namedOf(active, said, gates) {
  const after = n => said[n] === "skipped" && active[n] === "passed";
  const failedHere = Object.keys(said).filter(n => said[n] === "failed" && active[n] !== "failed");
  const skipped = Object.keys(said).filter(n => said[n] === "skipped" && !(after(n) && gates.includes(n)));
  return { failed: failedHere.filter(n => !gates.includes(n)), gated: [...failedHere, ...Object.keys(said).filter(after)].filter(n => gates.includes(n)), skipped, skippedAfter: skipped.filter(after) };
}

// Why no draft was opened in `repo`, read through `ask`: { answer } (the commit, the repository's hash and `none`), or
// { why } it gives none: a repository whose default branch's manifest pins no copy of this core, or could not be read,
// is no project tried, and a project of the owner's own whose stop switch does not stand takes a draft.
export function readNone(repo, sha, ask = ghAsk) {
  const got = ask(`repos/${repo}`);
  const owner = got.body?.owner?.login, id = got.body?.id;
  if (typeof owner !== "string" || !Number.isInteger(id)) return { why: `the repository could not be read (${got.why ?? "no owner or id in GitHub's answer"}). Mend: run it again where gh answers for the owner's account` };
  const taking = notTaking(repo, ask);
  if (taking) return { why: taking };
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
  for (const name of got.skipped ?? []) console.log(`  skipped on the draft, measuring nothing there${got.skippedAfter.includes(name) ? ", passed on main, so not run after: it holds the cut unless set apart with --gate" : ""}: ${asText(name)}`);
  console.log(`${LINE}${JSON.stringify(got.answer)}`);
}
