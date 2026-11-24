// Which of a project's calls of the core's workflows check.mjs runs on a change (tasks/hosts.md, "One layer knows no
// host"): those whose triggers start on it, as GitHub reads them, and, of a sync, its own. The calls are the base's, so
// a change cannot leave a check out by taking its call out; but a change that moves the manifest's pin forward along the
// core's main, a sync, runs its own calls as GitHub runs its merge, at the new pin, since the old pin's core.yml reads
// a copy the new one leaves otherwise as differing (#1245, point 1); and every call the base makes that the sync's
// own calls leave out runs as the base holds it, and each they call otherwise runs too, so a sync leaves no check out. Also the reading of the project's
// own workflows. Node's own modules, the core's address, its YAML reader and the runner's path filter.
import { CORE } from "./core-address.mjs";
import { parseYaml } from "./parse-yaml.mjs";
import { needsOf } from "./workflow-needs.mjs";
import { pathsLetThrough } from "./workflow-run.mjs";

// Whether the change moves the core's pin forward along its main: from `from`, the base's pin, to `to`, the head's,
// each a commit, `to` on the core's main and past `from`. `past(older, newer)` asks the core's history.
export function movesForward(from, to, past) {
  const sha = /^[0-9a-f]{40}$/u;
  return sha.test(from ?? "") && sha.test(to ?? "") && from !== to && past(to, "refs/heads/main") && past(from, to);
}

// A sync's calls: its own (`head`, each { file, wf }), and, of the base's, each job that calls a workflow of the core's
// (`calls(job)`) that the head's file of that name does not, as the base holds it; and each the head calls otherwise
// than the base but for the pin, as the base calls it at the head's pin where `moved(uses)` gives it there, beside the
// head's own, so a sync that weakens a call's inputs, or calls another workflow in its place, drops no check.
export function syncCalls(base, head, calls, moved = uses => uses) {
  const out = [...head];
  for (const { file, wf } of base) {
    const mine = head.find(h => h.file === file)?.wf.jobs ?? {};
    const jobs = Object.entries(wf.jobs ?? {}).filter(([, job]) => calls(job)).flatMap(([id, job]) => {
      if (!calls(mine[id])) return [[id, job]];
      const there = { ...job, uses: moved(job.uses) };
      return canonical(there) === canonical(mine[id]) ? [] : [[`${id} (as the base calls it)`, there]];
    });
    if (jobs.length) out.push({ file, wf: { ...wf, jobs: Object.fromEntries(jobs) } });
  }
  return out;
}
// A value as text, its keys in order, so two jobs written alike in another order read the same.
const canonical = v => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b))) : x));

// Whether a workflow's triggers start it on this pull request or push, as GitHub reads them.
export function triggered(on, { event, base, changed }) {
  const trigger = triggerOf(on, event);
  if (trigger === null || !onMain(trigger, event)) return false;
  if (!base) return true;
  if (trigger.types && !trigger.types.includes("synchronize") && !trigger.types.includes("opened")) return false;
  if (trigger.paths && !pathsLetThrough(trigger.paths, changed)) return false;
  return !(trigger["paths-ignore"] && changed.every(f => pathsLetThrough(trigger["paths-ignore"], [f])));
}

// Whether a trigger's branches let main through, as GitHub reads a filter, a list of patterns: main must pass the
// patterns and none of the ignored; and a push that names tags and no branch starts on a tag alone (#1245, point 8).
function onMain(trigger, event) {
  const { branches, "branches-ignore": ignored } = trigger;
  if (event === "push" && (trigger.tags || trigger["tags-ignore"]) && !branches && !ignored) return false;
  return !(branches && !pathsLetThrough(branches, ["main"])) && !(ignored && pathsLetThrough(ignored, ["main"]));
}

// The trigger a workflow's "on" gives an event: its settings, {} where it names the event bare, null where none.
function triggerOf(on, event) {
  if (typeof on === "string") return on === event ? {} : null;
  if (Array.isArray(on)) return on.includes(event) ? {} : null;
  return on?.[event] === undefined ? null : on[event] ?? {};
}

// A workflow of the project's, read: one in a form parse-yaml.mjs does not read is passed over and said so, since it
// is the project's own; one of those that calls the core's fails, since a check would go unrun. Moved from check.mjs, whose
// `say` and `fail` it is given.
export function readable(file, text, { say, fail }) {
  try { return { file, wf: parseYaml(text) }; } catch (e) {
    if (text.toLowerCase().includes(`${CORE.toLowerCase()}/.github/workflows/`)) fail(`.github/workflows/${file} calls the core's workflows and is written in a form this check cannot read (${e.message}).`, "write that file's calls to the core as the starter kit writes them, in plain YAML, or run the core's checks on the host meanwhile and report the form to the core (core/README.md, \"Reporting to the core\").");
    say(`note .github/workflows/${file} is written in a form this check does not read (${e.message}); it calls none of the core's workflows, so nothing is left unrun`);
    return null;
  }
}

// A workflow kept to its jobs that call no workflow and name no environment (a job that names one deploys, or holds
// what the host guards: the host's own, never run here, and said so); none where none is left. A kept job's need of a
// job left out is dropped, said so, as before the needs were read (#1245, point 3): what that job gives is not known here.
export function ownJobs({ file, wf }, say) {
  const jobs = Object.entries(wf.jobs ?? {}).filter(([, job]) => job && typeof job === "object" && job.uses === undefined);
  for (const [id] of jobs.filter(([, job]) => job.environment !== undefined)) say(`host ${file}/${id}: it names an environment, so it is the host's own, not run here`);
  const ids = new Set(jobs.filter(([, job]) => job.environment === undefined).map(([id]) => id));
  const kept = [...ids].map(id => {
    const job = wf.jobs[id], needs = needsOf(job), left = needs.filter(n => !ids.has(n));
    if (!left.length) return [id, job];
    say(`note ${file}/${id} needs ${left.join(", ")}, not run here, so it runs without ${left.length === 1 ? "it" : "them"}`);
    return [id, { ...job, needs: needs.filter(n => ids.has(n)) }];
  });
  return kept.length ? [{ file, wf: { ...wf, jobs: Object.fromEntries(kept) } }] : [];
}
