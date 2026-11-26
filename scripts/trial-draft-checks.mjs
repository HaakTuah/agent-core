// What a commit's checks said on the host, for the draft in a release's trial (trial-draft.mjs, beside this file;
// #1334): each check run, status and workflow run read page by page, each check named by its workflow and job, and read
// beside the other commit's, a rename's skip, a name two workflows meet on and the checks still waiting. Node alone.
import { asText } from "./guards.mjs";

// What each check said, from GitHub's check runs and statuses: skipped, passed, failed or waiting, a name twice its worse.
const RANK = { skipped: 0, passed: 1, failed: 2, waiting: 3 };
const RUN = { skipped: "skipped", success: "passed", neutral: "passed", failure: "failed", timed_out: "failed", cancelled: "failed", action_required: "failed", startup_failure: "failed", stale: "failed" };
const STATUS = { success: "passed", failure: "failed", error: "failed", pending: "waiting" };
export function saidOf(runs, statuses) {
  const out = Object.create(null);
  const put = (name, v) => { if (typeof name === "string" && !(RANK[out[name]] >= RANK[v])) out[name] = v; };
  for (const r of runs ?? []) put(r?.name, r?.status !== "completed" ? "waiting" : RUN[r?.conclusion] ?? "failed");
  for (const s of statuses ?? []) put(s?.context, STATUS[s?.state] ?? "failed");
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

// What a commit's checks said, through `ask` (ghAsk's form), every page read: { said, active, flows, unfinished,
// pairOf }, or { why }. A workflow run of the commit that failed with no failed job of its own (one that could not start
// among them) is a check that failed, and one not finished waits, each named by its workflow; `active` is `said` with
// no run GitHub holds for a person (its own status `waiting`, a deploy's reviewer say), `flows` names each workflow run,
// `unfinished` each one not finished, by its name in `said` and its workflow's, and `pairOf` each check's workflow (null
// where none is tied) and job.
export function checksAt(repo, sha, ask) {
  const runs = pagesOf(`repos/${repo}/commits/${sha}/check-runs`, "check_runs", ask);
  if (runs.why) return runs;
  const status = pagesOf(`repos/${repo}/commits/${sha}/status`, "statuses", ask);
  if (status.why) return status;
  const flows = pagesOf(`repos/${repo}/actions/runs?head_sha=${sha}`, "workflow_runs", ask);
  if (flows.why) return flows;
  const label = w => `${w.name ?? "a workflow"} (${w.status !== "completed" ? "workflow" : w.conclusion === "startup_failure" ? "could not start" : "failed outside its jobs"})`;
  const ownFailed = w => runs.items.some(r => r?.check_suite?.id != null && r.check_suite.id === w.check_suite_id && RUN[r.conclusion] === "failed");
  const open = flows.items.filter(w => w?.status !== "completed" || (RUN[w?.conclusion] === "failed" && !ownFailed(w)));
  const { jobs, statuses, pairOf, clash } = keyed(runs.items, flows.items, status.items, open.map(w => [label(w), w.name ?? "a workflow"]));
  if (clash) return { why: clashWhy(clash, `of ${sha.slice(0, 7)}`) };
  const unstarted = open.map(w => ({ name: label(w), status: w.status === "completed" ? "completed" : "queued", conclusion: "failure", person: w.status === "waiting" }));
  const unfinished = open.filter(w => w.status !== "completed").map(w => ({ name: label(w), flow: w.name }));
  const notHeld = r => r?.status !== "waiting" && !r?.person;
  return { said: saidOf([...jobs, ...unstarted], statuses), active: saidOf([...jobs, ...unstarted].filter(notHeld), statuses), flows: new Set(flows.items.map(w => w?.name)), unfinished, pairOf };
}

// Why two checks meeting on one name, `name`, give no answer, with its mend: a session of the trial writes nothing in
// the project but the sync, so the project's own pull request renames one.
const clashWhy = (name, where) => `two checks ${where} meet on the name "${asText(name)}" from two workflows or jobs, so neither can be told apart. Mend: tell the owner; in a pull request of the project's own, never the sync's draft, give one of them another name, and read again once it has merged`;

// Each check run named by its workflow and job, `<workflow>: <job>`, where GitHub ties its check suite to a workflow
// run, so a job of one workflow is never read against another's of the same name; by its job alone where none is tied,
// and as `<job> (no workflow)` where that is a tied one's name or a workflow run's own, `labels` ([its name, its
// workflow]); a status as `<context> (status)` where a check run or a run's own holds its context. { jobs, statuses,
// pairOf (each name's [workflow, job], a run's own with the job "(run)", a status's with the workflow "(status)"),
// clash }: `clash` a name two pairs meet on.
function keyed(runs, flows, statusList = [], labels = []) {
  const flowOf = new Map(flows.filter(w => w?.check_suite_id != null).map(w => [w.check_suite_id, w.name]));
  const tiedTo = r => (flowOf.has(r?.check_suite?.id) ? flowOf.get(r.check_suite.id) ?? "a workflow" : null);
  const tied = new Set([...runs.filter(r => tiedTo(r) !== null).map(r => `${tiedTo(r)}: ${r?.name}`), ...labels.map(([n]) => n)]);
  const pairOf = new Map(), apart = n => (tied.has(n) ? `${n} (no workflow)` : n);
  let clash = null;
  const put = (name, pair) => {
    if (pairOf.has(name) && !samePair(pairOf.get(name), pair)) clash ??= name;
    pairOf.set(name, pair);
    return name;
  };
  for (const [n, flow] of labels) put(n, [flow, "(run)"]);
  const jobs = runs.map(r => ({ ...r, name: put(tiedTo(r) !== null ? `${tiedTo(r)}: ${r?.name}` : apart(r?.name), [tiedTo(r), r?.name]) }));
  const taken = new Set(pairOf.keys()), own = c => (taken.has(c) ? `${c} (status)` : c);
  const statuses = statusList.map(s => (typeof s?.context === "string" ? { ...s, context: put(own(s.context), ["(status)", s.context]) } : s));
  return { jobs, statuses, pairOf, clash };
}

const samePair = (a, b) => a[0] === b[0] && a[1] === b[1];

// A name main's newest commit and the draft both hold from two workflows or jobs, as a reason with its mend, or null.
export function crossedOf(then, now) {
  const name = [...now.pairOf.keys()].find(n => then.pairOf.has(n) && !samePair(then.pairOf.get(n), now.pairOf.get(n)));
  return name === undefined ? null : clashWhy(name, "of main's newest commit and the draft");
}

// `main`'s checks with each the draft skipped read as passed where its job passed on main
// under a name gone from the draft (a workflow renamed, or a job moved to another), so a skip after passing is not lost
// to a new name; while one whose check still runs on the draft stands for no other workflow's job of its name.
export function alignedOf(then, now) {
  const job = (side, n) => side.pairOf.get(n)?.[1] ?? n;
  const gone = n => then.active[n] === "passed" && !Object.hasOwn(now.said, n);
  const passed = new Set(Object.keys(then.active).filter(gone).map(n => job(then, n)));
  const renamed = ([n, v]) => v === "skipped" && passed.has(job(now, n));
  return { ...then.active, ...Object.fromEntries(Object.entries(now.said).filter(renamed).map(([n]) => [n, "passed"])) };
}

// How many checks wait, as checksAt gives them: [on main, on the draft]. On main only a check the draft holds, skipped
// there or not, or a workflow it ran too, skipped whole or not, counts, and no run GitHub holds for a person: a deploy
// waiting for its reviewer measures nothing of the draft, while one still running on main is read before a skip of it
// is named.
export function waitingOf(then, now) {
  const flow = n => then.unfinished.filter(u => u.name === n);
  const counts = ([n, v]) => v === "waiting" && (flow(n).length ? flow(n).some(u => now.flows.has(u.flow)) : Object.hasOwn(now.said, n));
  return [Object.entries(then.active).filter(counts).length, Object.values(now.said).filter(v => v === "waiting").length];
}
