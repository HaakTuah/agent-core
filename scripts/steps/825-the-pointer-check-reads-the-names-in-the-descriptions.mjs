// The step of setup/sync-notes/825-the-pointer-check-reads-the-names-in-the-descriptions.md, which steps.mjs, beside this
// folder, loads with the rest in the order of their names.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { LIST, listOf } from "../names.mjs";
import { COST, shown } from "../step-checks.mjs";
import { Unwritten, writable } from "../step-writers.mjs";
import { Unread, copyAt } from "../workflow-calls.mjs";

const MEND = `run \`node core/scripts/pointers.mjs --write-names\`, which writes \`${LIST}\` with each name in the descriptions that stands nowhere, and commit it in a pull request of its own; until then what the pull request's base held is noted, never failed`;
// (the project's copy of the pointer check, run with no base, where it notes every name that stands nowhere)
const pointers = (p, args = []) => {
  const at = path.join(p.root, copyAt(p), "scripts", "pointers.mjs");
  if (!fs.existsSync(at)) throw new Unread("no copy of pointers.mjs to run");
  return spawnSync(process.execPath, [at, ...args], { cwd: p.root, encoding: "utf8", maxBuffer: 1 << 28, env: { ...process.env, POINTERS_BASE: "" } });
};

export default { lead: "26 November 2026, the pointer check reads the names in the descriptions", cost: COST.config,
  // (the list stands and reads, or nothing is left to list; a run that never reached its verdict read nothing)
  check: p => {
    const text = p.read(LIST);
    if (text !== null) return listOf(text) ? null : `\`${LIST}\` cannot be read as { "names": [{ "file", "name" }] }: delete it, then ${MEND}.`;
    const r = pointers(p);
    if (r.error || !(/^ok {3}\d+ pointers/m.test(r.stdout) || /^FAIL: a broken pointer: /m.test(r.stderr))) throw new Unread("the pointer check did not run to its verdict");
    const found = [...r.stdout.matchAll(/^note a name in a description that stands nowhere: (.*?) \(with no base to read against/gm)].map(m => shown(m[1]));
    return found.length ? `The descriptions hold ${found.length} names that stand nowhere (${found.join("; ")}): ${MEND}.` : null;
  },
  write: (p, busy) => {
    writable(p, LIST, busy);
    const r = pointers(p, ["--write-names"]);
    if (r.error || r.status !== 0) throw new Unwritten(`pointers.mjs wrote no list: ${shown((r.stderr || "").split(/\r?\n/u).find(l => l.startsWith("FAIL")) ?? `it ended with status ${r.status}`)}`);
    return [LIST];
  } };
