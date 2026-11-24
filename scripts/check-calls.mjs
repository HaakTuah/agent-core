// Which of a project's calls of the core's workflows check.mjs runs on a change (tasks/hosts.md, "One layer knows no
// host"): those whose triggers start on it, as GitHub reads them, and, of a sync, its own. The calls are the base's, so
// a change cannot leave a check out by taking its call out; but a change that moves the manifest's pin forward along the
// core's main, a sync, runs its own calls as GitHub runs its merge, at the new pin, since the old pin's core.yml reads
// a copy the new one leaves otherwise as differing (#1245, point 1); and every call the base makes that the sync's
// own calls leave out runs as the base holds it, so a sync too leaves no check out. Node's own modules, and the
// runner's path filter (workflow-run.mjs).
import { pathsLetThrough } from "./workflow-run.mjs";

// Whether the change moves the core's pin forward along its main: from `from`, the base's pin, to `to`, the head's,
// each a commit, `to` on the core's main and past `from`. `past(older, newer)` asks the core's history.
export function movesForward(from, to, past) {
  const sha = /^[0-9a-f]{40}$/u;
  return sha.test(from ?? "") && sha.test(to ?? "") && from !== to && past(to, "refs/heads/main") && past(from, to);
}

// A sync's calls: its own (`head`, each { file, wf }), and, of the base's, each job that calls a workflow of the core's
// (`calls(job)`) that the head's file of that name does not, as the base holds it.
export function syncCalls(base, head, calls) {
  const out = [...head];
  for (const { file, wf } of base) {
    const mine = head.find(h => h.file === file)?.wf.jobs ?? {};
    const left = Object.entries(wf.jobs ?? {}).filter(([id, job]) => calls(job) && !calls(mine[id]));
    if (left.length) out.push({ file, wf: { ...wf, jobs: Object.fromEntries(left) } });
  }
  return out;
}

// Whether a workflow's triggers start it on this pull request or push, as GitHub reads them.
export function triggered(on, { event, base, changed }) {
  const trigger = triggerOf(on, event);
  if (trigger === null) return false;
  // (a branch filter is a list of patterns, as GitHub reads it: main must pass the patterns and none of the ignored)
  if (trigger.branches && !pathsLetThrough(trigger.branches, ["main"])) return false;
  if (trigger["branches-ignore"] && pathsLetThrough(trigger["branches-ignore"], ["main"])) return false;
  if (!base) return true;
  if (trigger.types && !trigger.types.includes("synchronize") && !trigger.types.includes("opened")) return false;
  if (trigger.paths && !pathsLetThrough(trigger.paths, changed)) return false;
  return !(trigger["paths-ignore"] && changed.every(f => pathsLetThrough(trigger["paths-ignore"], [f])));
}

// The trigger a workflow's "on" gives an event: its settings, {} where it names the event bare, null where none.
function triggerOf(on, event) {
  if (typeof on === "string") return on === event ? {} : null;
  if (Array.isArray(on)) return on.includes(event) ? {} : null;
  return on?.[event] === undefined ? null : on[event] ?? {};
}
