// A stand-in for the host, for the tests of the draft in a release's trial (tests/trial-draft-test.mjs,
// tests/trial-draft-names-test.mjs): a draft pull request of the owner's own project pinned to the commit tried, beside
// main's newest commit, each list given page by page, and what `over` changes of it. No call reaches the network. Run
// by itself, it checks its own pages.
//
//   node tests/trial-draft-host-test.mjs
import { CORE, OWNER } from "../scripts/core-address.mjs";
import { tally } from "../scripts/scratch-core.mjs";
import { started } from "../scripts/started.mjs";

export const SHA = n => String(n).repeat(40);
export const TRIED = SHA("a"), MAIN = SHA("b"), HEAD = SHA("c");

const page = (route, key, all) => {
  const n = Number(/[?&]page=(\d+)/.exec(route)?.[1] ?? 0);
  return n ? { body: { [key]: all.slice((n - 1) * 100, n * 100), total_count: all.length } } : { why: "no page asked" };
};
// (`fork`: "own" or "theirs", the project a fork of a repository of its own account's or of another's, its parent and
// source given only in the repository's own answer, as GitHub's pull request gives none; "unread", that answer refused;
// "silent", an answer that does not say whether it is a fork)
export const host = (over = {}) => route => {
  const forked = over.fork === "silent" ? {} : over.fork ? { fork: true, parent: { owner: { login: over.fork === "own" ? OWNER : "someone-else" } }, source: { owner: { login: over.fork === "own" ? OWNER : "someone-else" } } } : { fork: false };
  const pulls = { state: "open", draft: true, user: { login: OWNER }, head: { sha: HEAD, repo: { id: 41 } }, base: { ref: "main", repo: { id: 41, full_name: "o/p", fork: Boolean(over.fork), owner: { login: OWNER }, default_branch: "main" } }, ...over.pull };
  const draftRuns = over.empty ? (over.empty === "skipped" ? [{ name: "tests", status: "completed", conclusion: "skipped" }] : []) : [{ name: "tests", status: "completed", conclusion: "success" }, ...(over.deployRun ? [{ name: "deploy", status: "completed", conclusion: "skipped" }] : []), ...(over.draftRuns ?? []), { name: "dependency review", status: over.late ? "queued" : "completed", conclusion: over.late ? null : over.skipReview ? "skipped" : "failure" }, ...(over.many ? Array.from({ length: 150 }, (_, i) => ({ name: `job ${i}`, status: "completed", conclusion: "success" })) : [])];
  if (route === "repos/o/p/pulls/7") return { body: pulls };
  if (route === "repos/o/p") return over.fork === "unread" ? { why: "GitHub answered 502 (Bad Gateway)" } : { body: { id: 41, full_name: "o/p", owner: { login: over.owner ?? OWNER }, ...forked } };
  if (route === "repos/o/p/contents/core-manifest.md") return over.manifest === "unread" ? { why: "GitHub answered 502 (Bad Gateway)" } : over.noCore ? { why: "GitHub answered 404 (Not Found)" } : { body: { content: Buffer.from(over.carried ? `Core: ${CORE}, carried by lib/ under lib/core/\n` : `Core: ${CORE} at ${MAIN}, copied whole under core/\n`).toString("base64") } };
  if (route === "repos/o/p/branches/agents-stop") return over.stop === "unread" ? { why: "GitHub answered 403 (forbidden)" } : over.stop ? { body: { name: "agents-stop" } } : { why: "GitHub answered 404 (Not Found)" };
  if (route === `repos/o/p/contents/core-manifest.md?ref=${HEAD}`) return { body: { content: Buffer.from(`Core: ${CORE} at ${over.pin ?? TRIED}, copied whole under core/\n`).toString("base64") } };
  if (route === "repos/o/p/commits/main") return { body: { sha: MAIN } };
  if (route.startsWith(`repos/o/p/commits/${MAIN}/check-runs`)) return page(route, "check_runs", [{ name: "tests", status: over.mainLate ? "in_progress" : "completed", conclusion: over.mainLate ? null : "success" }, ...(over.deployRun ? [{ name: "deploy", status: "waiting", conclusion: null }] : []), ...(over.skipReview === "after" ? [{ name: "dependency review", status: "completed", conclusion: "success" }] : []), ...(over.mainRuns ?? [])]);
  if (route.startsWith(`repos/o/p/commits/${HEAD}/check-runs`)) return over.short ? { body: { check_runs: draftRuns, total_count: draftRuns.length + 1 } } : page(route, "check_runs", draftRuns);
  if (route.startsWith(`repos/o/p/actions/runs?head_sha=${HEAD}`)) return page(route, "workflow_runs", [...(over.unstarted ? [{ name: "audit", status: "completed", conclusion: "startup_failure" }] : []), ...(over.queued ? [{ name: "review", status: "queued", conclusion: null }] : []), { name: "tests", status: "completed", conclusion: "success" }, ...(over.draftFlows ?? [])]);
  if (route.startsWith(`repos/o/p/actions/runs?head_sha=${MAIN}`)) return page(route, "workflow_runs", [...(over.unstarted === "both" ? [{ name: "audit", status: "completed", conclusion: "startup_failure" }] : []), ...(over.mainWaits ? [{ name: over.mainWaits, status: "waiting", conclusion: null }] : []), ...(over.mainQueued ? [{ name: "tests", status: "queued", conclusion: null }] : []), ...(over.mainFlows ?? [])]);
  if (/\/status\?/.test(route)) return page(route, "statuses", route.includes(HEAD) ? over.draftStatuses ?? [] : over.mainStatuses ?? []);
  return { why: "no such route in the stand-in" };
};

if (started(import.meta.url)) {
  const { ok, done } = tally(), ask = host({ many: true });
  const [one, two] = [1, 2].map(n => ask(`repos/o/p/commits/${HEAD}/check-runs?per_page=100&page=${n}`).body);
  ok(one?.check_runs.length === 100 && two?.check_runs.length === one.total_count - 100 && ask(`repos/o/p/commits/${HEAD}/check-runs`).why && ask("repos/o/q").why,
    "the stand-in gives each list a hundred to a page, all of its count, and no answer to a route it does not hold", JSON.stringify([one?.total_count, two?.check_runs.length]));
  done("the stand-in for the host in the draft's tests");
}
