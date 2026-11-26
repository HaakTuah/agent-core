// The step of setup/sync-notes/826-the-copies-check-lists-the-values-written-twice.md, which steps.mjs, beside this
// folder, loads with the rest in the order of their names.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { copiesConfig } from "../check-configs.mjs";
import { listForm } from "../copies-values.mjs";
import { READ_MOST } from "../own-files.mjs";
import { COST, shown } from "../step-checks.mjs";
import { Unwritten, writable } from "../step-writers.mjs";
import { Unread, copyAt } from "../workflow-calls.mjs";

// (the copies check's config and the baseline it names, read as the check reads them)
const baselineOf = p => {
  const config = copiesConfig(p);
  if (!p.safe(config)) throw new Unread(`the copies check's config \`${shown(config)}\` is no regular file of the project's own of at most ${READ_MOST} bytes`);
  let baseline;
  try { baseline = JSON.parse(p.read(config))?.baseline; } catch { /* (said below) */ }
  if (typeof baseline !== "string") throw new Unread(`the copies check's config \`${shown(config)}\` names no baseline`);
  return { config, baseline };
};
const mend = config => `run \`node core/scripts/copies.mjs ${config} --first\`, which writes the list "values" of each value two files of the project's own hold, and commit it in a pull request of its own; until then the pull request's base counts as the list`;

export default { lead: "26 November 2026, the copies check lists the values written twice", cost: COST.config,
  // (the baseline stands and holds its list in its form; one with none, or none at all, is the step's to write)
  check: p => {
    const { config, baseline } = baselineOf(p);
    const text = p.read(baseline);
    if (text === null) return `The copies check's baseline \`${shown(baseline)}\` is not there: ${mend(config)}.`;
    let json;
    try { json = JSON.parse(text); } catch { return `\`${shown(baseline)}\` cannot be read as JSON: take it back as the project's \`main\` holds it, and where \`main\` holds no list either, ${mend(config)}.`; }
    if (!json || typeof json !== "object" || Array.isArray(json) || !("values" in json)) return `\`${shown(baseline)}\` holds no list "values": ${mend(config)}.`;
    return listForm(json.values) ? null : `\`${shown(baseline)}\`'s "values" is no object of keys of 12 hexadecimal characters, each to a whole count of one or more: take it back as the project's \`main\` holds it, and where \`main\` holds no list either, ${mend(config)}.`;
  },
  write: (p, busy) => {
    const { config, baseline } = baselineOf(p);
    writable(p, baseline, busy);
    const at = path.join(p.root, copyAt(p), "scripts", "copies.mjs");
    if (!fs.existsSync(at)) throw new Unwritten("no copy of copies.mjs to run");
    const r = spawnSync(process.execPath, [at, config, "--first"], { cwd: p.root, encoding: "utf8", maxBuffer: 1 << 28, env: { ...process.env, COPIES_BASE: "" } });
    if (r.error || r.status !== 0) throw new Unwritten(`copies.mjs wrote no list: ${shown((r.stderr || "").split(/\r?\n/u).find(l => l.startsWith("FAIL")) ?? `it ended with status ${r.status}`)}`);
    return [baseline];
  } };
