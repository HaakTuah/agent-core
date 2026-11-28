// The step of setup/sync-notes/825-the-pointer-check-reads-the-names-in-the-descriptions.md, which steps.mjs, beside this
// folder, loads with the rest in the order of their names.
import { runCopy } from "../copy-runs.mjs";
import { LIST, listOf } from "../names.mjs";
import { COST, shown } from "../step-checks.mjs";
import { Unwritten, writable } from "../step-writers.mjs";
import { Unread, copyAt } from "../workflow-calls.mjs";

const MEND = `run \`node core/scripts/pointers.mjs --write-names\`, which writes \`${LIST}\` with each name in the descriptions that stands nowhere, and commit it in a pull request of its own; until then what the pull request's base held is noted, never failed`;
// (the project's copy of the pointer check, run with no base, where it notes every name that stands nowhere, and only
// where copy-runs.mjs lets it run; else `Refused`, Unread or Unwritten, is thrown with the reason)
const pointers = (p, Refused, args = []) => {
  const r = runCopy(p.root, copyAt(p), "pointers.mjs", args, { POINTERS_BASE: "" });
  if (r.refused) throw new Refused(r.refused);
  return r;
};

export default { lead: "26 November 2026, the pointer check reads the names in the descriptions", cost: COST.config,
  // (the list stands and reads, or nothing is left to list; a run that never reached its verdict read nothing)
  check: p => {
    const text = p.read(LIST);
    if (text !== null) return listOf(text) ? null : `\`${LIST}\` cannot be read as { "names": [{ "file", "name" }] }: delete it, then ${MEND}.`;
    const r = pointers(p, Unread);
    if (r.error || !(/^ok {3}\d+ pointers/m.test(r.out) || /^FAIL: a broken pointer: /m.test(r.err))) throw new Unread("the pointer check did not run to its verdict");
    const found = [...r.out.matchAll(/^note a name in a description that stands nowhere: (.*?) \(with no base to read against/gm)].map(m => shown(m[1]));
    return found.length ? `The descriptions hold ${found.length} names that stand nowhere (${found.join("; ")}): ${MEND}.` : null;
  },
  write: (p, busy) => {
    writable(p, LIST, busy);
    const r = pointers(p, Unwritten, ["--write-names"]);
    if (r.error || r.status !== 0) throw new Unwritten(`pointers.mjs wrote no list: ${shown((r.err || "").split(/\r?\n/u).find(l => l.startsWith("FAIL")) ?? `it ended with status ${r.status}`)}`);
    return [LIST];
  } };
